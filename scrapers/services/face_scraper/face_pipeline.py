#!/usr/bin/env python3
"""
Complete Face Processing Pipeline
Integrates: scraper → alignment → ensemble ArcFace → centroid → indexing
"""

import os
import sys
import logging
from pathlib import Path
from typing import List, Dict, Optional
import numpy as np
import cv2
from PIL import Image

# Add services directory to path
current_dir = Path(__file__).parent
services_dir = current_dir.parent
sys.path.insert(0, str(services_dir))

from face_scraper.thumbnail_scraper import ThumbnailFirstScraper
from face_scraper.face_alignment import FaceAligner
from face_scraper.ensemble_arcface import EnsembleArcFace
from face_scraper.centroid import CentroidCalculator
from image_indexer.config.milvus import get_milvus_client, FACES_COLLECTION
from pymilvus import Collection

logger = logging.getLogger(__name__)


class FaceProcessingPipeline:
    """Complete pipeline: scrape → align → embed → centroid → index"""
    
    def __init__(self, output_dir: str = "/data/scraped_faces"):
        self.output_dir = Path(output_dir)
        self.scraper = ThumbnailFirstScraper(output_dir=str(self.output_dir))
        self.aligner = FaceAligner()
        self.ensemble_arcface = EnsembleArcFace()
        self.centroid_calc = CentroidCalculator()
        
        # Connect to Milvus
        get_milvus_client()
        self.faces_collection = Collection(FACES_COLLECTION)
        self.faces_collection.load()
    
    async def process_user(
        self,
        user_id: str,
        thumbnail_urls: List[str],
        full_image_urls: Dict[str, str]
    ) -> Dict:
        """
        Complete pipeline for one user:
        1. Scrape thumbnails → select 10-20 best
        2. Download full images
        3. Align faces
        4. Generate ensemble embeddings
        5. Calculate centroid
        6. Index to Milvus
        """
        logger.info(f"[START] Starting face processing pipeline for user {user_id}")
        
        # Step 1: Scrape and select best photos
        scrape_result = await self.scraper.scrape_user(
            user_id=user_id,
            thumbnail_urls=thumbnail_urls,
            full_image_urls=full_image_urls
        )
        
        if scrape_result["full_images_downloaded"] == 0:
            logger.warning(f"No images downloaded for user {user_id}")
            return {
                "user_id": user_id,
                "success": False,
                "error": "No images downloaded"
            }
        
        # Step 2: Process full images
        full_image_paths = scrape_result["full_image_paths"]
        embeddings = []
        quality_scores = []
        face_crops = []
        
        for img_path in full_image_paths:
            try:
                # Load image
                img = cv2.imread(img_path)
                if img is None:
                    continue
                
                # Detect face (re-detect on full image for accuracy)
                from face_scraper.face_detectors import RetinaFaceDetector
                detector = RetinaFaceDetector()
                faces = detector.detect(img)
                
                if len(faces) != 1:
                    continue
                
                face_metadata = faces[0]
                
                # Align face
                aligned_face = self.aligner.align_from_metadata(img, face_metadata)
                if aligned_face is None:
                    continue
                
                # Generate ensemble embedding
                embedding = self.ensemble_arcface.generate_embedding(aligned_face)
                if embedding is None:
                    continue
                
                embeddings.append(embedding)
                quality_scores.append(face_metadata.get("confidence", 0.5))
                face_crops.append({
                    "path": img_path,
                    "metadata": face_metadata
                })
                
            except Exception as e:
                logger.error(f"Error processing image {img_path}: {e}")
                continue
        
        if len(embeddings) == 0:
            logger.warning(f"No valid embeddings for user {user_id}")
            return {
                "user_id": user_id,
                "success": False,
                "error": "No valid embeddings"
            }
        
        # Step 3: Calculate centroid
        centroid = self.centroid_calc.calculate_centroid_with_quality(
            embeddings=embeddings,
            quality_scores=quality_scores
        )
        
        if centroid is None:
            logger.warning(f"Failed to calculate centroid for user {user_id}")
            return {
                "user_id": user_id,
                "success": False,
                "error": "Centroid calculation failed"
            }
        
        # Step 4: Index to Milvus
        # Index individual embeddings
        individual_ids = []
        for idx, (emb, crop) in enumerate(zip(embeddings, face_crops)):
            face_id = f"{user_id}_face_{idx:03d}"
            individual_ids.append(face_id)
            
            self._index_face(
                face_id=face_id,
                identity_id=user_id,
                embedding=emb,
                image_path=crop["path"],
                is_centroid=False,
                quality_score=quality_scores[idx]
            )
        
        # Index centroid
        centroid_id = f"{user_id}_centroid"
        self._index_face(
            face_id=centroid_id,
            identity_id=user_id,
            embedding=centroid,
            image_path=full_image_paths[0],  # Use first image as reference
            is_centroid=True,
            quality_score=1.0
        )
        
        logger.info(f"[OK] Completed pipeline for user {user_id}: {len(embeddings)} faces + 1 centroid")
        
        return {
            "user_id": user_id,
            "success": True,
            "faces_processed": len(embeddings),
            "centroid_id": centroid_id,
            "individual_ids": individual_ids
        }
    
    def _index_face(
        self,
        face_id: str,
        identity_id: str,
        embedding: np.ndarray,
        image_path: str,
        is_centroid: bool,
        quality_score: float
    ):
        """Index face embedding to Milvus"""
        try:
            entity = {
                "id": [face_id],
                "embedding": [embedding.tolist()],
                "face_id": [face_id],
                "identity_id": [identity_id],
                "image_id": [Path(image_path).stem],
                "path": [str(image_path)],
                "url": [""],  # MinIO URL if available
                "confidence": [quality_score],
                "is_centroid": [is_centroid],
                "quality_score": [quality_score]
            }
            
            self.faces_collection.insert(entity)
            self.faces_collection.flush()
            
        except Exception as e:
            logger.error(f"Error indexing face {face_id}: {e}")

