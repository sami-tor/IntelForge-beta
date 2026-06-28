#!/usr/bin/env python3
"""
Thumbnail-First Smart Scraper
Downloads 80-120 thumbnails, selects 10-20 best diverse photos, downloads full-size only for selected
"""

import os
import sys
import asyncio
import aiohttp
import hashlib
import logging
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
import numpy as np
from PIL import Image
import cv2
import io

# Add services directory to path
current_dir = Path(__file__).parent
services_dir = current_dir.parent
sys.path.insert(0, str(services_dir))

from face_scraper.face_detectors import SCRFDFaceDetector, RetinaFaceDetector
from face_scraper.face_quality import FaceQualityChecker
from face_scraper.deduplication import ThumbnailDeduplicator
from face_scraper.variety_selector import VarietySelector

logger = logging.getLogger(__name__)


@dataclass
class ThumbnailCandidate:
    """Represents a thumbnail candidate for processing"""
    url: str
    thumbnail_url: str
    thumbnail_data: bytes
    thumbnail_path: Optional[str] = None
    face_detected: bool = False
    face_quality_score: float = 0.0
    face_metadata: Optional[Dict] = None
    shallow_embedding: Optional[np.ndarray] = None
    selected_for_full_download: bool = False


class ThumbnailFirstScraper:
    """
    Smart scraper that:
    1. Downloads 80-120 thumbnails (20-60 KB each)
    2. Detects faces on thumbnails
    3. Filters by quality
    4. Deduplicates
    5. Selects 10-20 most diverse
    6. Downloads full-size only for selected
    """
    
    def __init__(
        self,
        output_dir: str = "/data/scraped_faces",
        min_thumbnails: int = 80,
        max_thumbnails: int = 120,
        target_selected: int = 15,  # 10-20 best photos
        min_face_height: int = 70,
        max_face_angle: float = 30.0
    ):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        self.min_thumbnails = min_thumbnails
        self.max_thumbnails = max_thumbnails
        self.target_selected = target_selected
        self.min_face_height = min_face_height
        self.max_face_angle = max_face_angle
        
        # Initialize components
        self.scrfd_detector = SCRFDFaceDetector()
        self.retina_detector = RetinaFaceDetector()
        self.quality_checker = FaceQualityChecker(
            min_face_height=min_face_height,
            max_face_angle=max_face_angle
        )
        self.deduplicator = ThumbnailDeduplicator()
        self.variety_selector = VarietySelector(target_count=target_selected)
        
        self.candidates: List[ThumbnailCandidate] = []
    
    async def scrape_user(
        self,
        user_id: str,
        thumbnail_urls: List[str],
        full_image_urls: Dict[str, str]  # thumbnail_url -> full_url mapping
    ) -> Dict[str, any]:
        """
        Scrape a user's photos using thumbnail-first strategy
        
        Args:
            user_id: Unique user identifier
            thumbnail_urls: List of thumbnail URLs (80-120)
            full_image_urls: Mapping from thumbnail_url to full-size URL
        
        Returns:
            Dict with scraping results
        """
        logger.info(f"🔍 Starting thumbnail-first scrape for user {user_id}")
        logger.info(f"   Thumbnails to process: {len(thumbnail_urls)}")
        
        # Step 1: Download thumbnails
        await self._download_thumbnails(thumbnail_urls)
        logger.info(f"[OK] Downloaded {len(self.candidates)} thumbnails")
        
        # Step 2: Detect faces on thumbnails
        await self._detect_faces_on_thumbnails()
        face_candidates = [c for c in self.candidates if c.face_detected]
        logger.info(f"[OK] Found faces in {len(face_candidates)} thumbnails")
        
        # Step 3: Check quality
        quality_candidates = await self._check_quality(face_candidates)
        logger.info(f"[OK] Quality check passed: {len(quality_candidates)} thumbnails")
        
        # Step 4: Deduplication
        unique_candidates = await self._deduplicate(quality_candidates)
        logger.info(f"[OK] After deduplication: {len(unique_candidates)} unique thumbnails")
        
        # Step 5: Variety selection
        selected_candidates = await self._select_variety(unique_candidates)
        logger.info(f"[OK] Selected {len(selected_candidates)} diverse photos for full download")
        
        # Step 6: Download full-size images
        full_images = await self._download_full_images(selected_candidates, full_image_urls, user_id)
        logger.info(f"[OK] Downloaded {len(full_images)} full-size images")
        
        return {
            "user_id": user_id,
            "thumbnails_processed": len(self.candidates),
            "faces_detected": len(face_candidates),
            "quality_passed": len(quality_candidates),
            "unique_after_dedup": len(unique_candidates),
            "selected_for_download": len(selected_candidates),
            "full_images_downloaded": len(full_images),
            "full_image_paths": full_images
        }
    
    async def _download_thumbnails(self, thumbnail_urls: List[str]):
        """Download thumbnails (20-60 KB each)"""
        self.candidates = []
        
        async with aiohttp.ClientSession() as session:
            tasks = []
            for url in thumbnail_urls[:self.max_thumbnails]:
                tasks.append(self._download_single_thumbnail(session, url))
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            for result in results:
                if isinstance(result, ThumbnailCandidate):
                    self.candidates.append(result)
                elif isinstance(result, Exception):
                    logger.warning(f"Failed to download thumbnail: {result}")
    
    async def _download_single_thumbnail(
        self,
        session: aiohttp.ClientSession,
        url: str
    ) -> Optional[ThumbnailCandidate]:
        """Download a single thumbnail"""
        try:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as response:
                if response.status == 200:
                    data = await response.read()
                    if 20 * 1024 <= len(data) <= 60 * 1024:  # 20-60 KB
                        return ThumbnailCandidate(
                            url=url,
                            thumbnail_url=url,
                            thumbnail_data=data
                        )
        except Exception as e:
            logger.debug(f"Error downloading thumbnail {url}: {e}")
        return None
    
    async def _detect_faces_on_thumbnails(self):
        """Detect faces on all thumbnails using SCRFD (fast) and RetinaFace (accurate)"""
        for candidate in self.candidates:
            try:
                # Load thumbnail image
                img = Image.open(io.BytesIO(candidate.thumbnail_data))
                img_array = np.array(img)
                
                # Convert RGB to BGR for OpenCV
                if len(img_array.shape) == 3 and img_array.shape[2] == 3:
                    img_bgr = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
                else:
                    continue
                
                # Try SCRFD first (fastest)
                faces = self.scrfd_detector.detect(img_bgr)
                
                # If no face found, try RetinaFace (more accurate)
                if len(faces) == 0:
                    faces = self.retina_detector.detect(img_bgr)
                
                # Check: exactly one face
                if len(faces) == 1:
                    candidate.face_detected = True
                    candidate.face_metadata = faces[0]
                else:
                    candidate.face_detected = False
                    
            except Exception as e:
                logger.debug(f"Error detecting face in thumbnail: {e}")
                candidate.face_detected = False
    
    async def _check_quality(self, candidates: List[ThumbnailCandidate]) -> List[ThumbnailCandidate]:
        """Check face quality: height, angle, blur, lighting"""
        quality_candidates = []
        
        for candidate in candidates:
            if candidate.face_metadata:
                quality_score = self.quality_checker.check_quality(
                    candidate.face_metadata,
                    candidate.thumbnail_data
                )
                
                if quality_score > 0.5:  # Quality threshold
                    candidate.face_quality_score = quality_score
                    quality_candidates.append(candidate)
        
        return quality_candidates
    
    async def _deduplicate(self, candidates: List[ThumbnailCandidate]) -> List[ThumbnailCandidate]:
        """Deduplicate thumbnails using shallow embeddings"""
        # Generate shallow embeddings
        for candidate in candidates:
            try:
                img = Image.open(io.BytesIO(candidate.thumbnail_data))
                # Resize to 112x112 for embedding
                img_resized = img.resize((112, 112), Image.Resampling.LANCZOS)
                candidate.shallow_embedding = self.deduplicator.generate_embedding(img_resized)
            except Exception as e:
                logger.debug(f"Error generating shallow embedding: {e}")
        
        # Remove duplicates (similarity > 0.95)
        unique_candidates = self.deduplicator.remove_duplicates(candidates, threshold=0.95)
        return unique_candidates
    
    async def _select_variety(self, candidates: List[ThumbnailCandidate]) -> List[ThumbnailCandidate]:
        """Select 10-20 most diverse photos"""
        return self.variety_selector.select_diverse(candidates)
    
    async def _download_full_images(
        self,
        candidates: List[ThumbnailCandidate],
        full_image_urls: Dict[str, str],
        user_id: str
    ) -> List[str]:
        """Download full-size images only for selected candidates"""
        user_dir = self.output_dir / user_id
        user_dir.mkdir(parents=True, exist_ok=True)
        
        downloaded_paths = []
        
        async with aiohttp.ClientSession() as session:
            for idx, candidate in enumerate(candidates):
                full_url = full_image_urls.get(candidate.thumbnail_url)
                if not full_url:
                    continue
                
                try:
                    async with session.get(full_url, timeout=aiohttp.ClientTimeout(total=30)) as response:
                        if response.status == 200:
                            data = await response.read()
                            
                            # Save full image
                            file_hash = hashlib.md5(data).hexdigest()[:12]
                            file_path = user_dir / f"{idx:03d}_{file_hash}.jpg"
                            
                            with open(file_path, 'wb') as f:
                                f.write(data)
                            
                            downloaded_paths.append(str(file_path))
                            candidate.selected_for_full_download = True
                            
                except Exception as e:
                    logger.warning(f"Failed to download full image {full_url}: {e}")
        
        return downloaded_paths

