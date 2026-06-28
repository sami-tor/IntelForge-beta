"""
Threads Profile Indexer
Processes scraped profiles and indexes to MinIO, Milvus, and Quickwit
"""

import os
import sys
import hashlib
from typing import Dict, List, Optional
from datetime import datetime
import logging
from pathlib import Path

# Add services to path
service_path = Path(__file__).parent.parent
sys.path.insert(0, str(service_path))

from image_indexer.utils.minio_storage import (
    upload_image_pil, get_image_url, ensure_bucket_exists, HAS_MINIO
)
from image_indexer.embeddings.arcface import ArcFaceEmbedder
from image_indexer.embeddings.hybrid_face import HybridFaceEmbedder
from image_indexer.config.milvus import MILVUS_HOST, MILVUS_PORT, FACES_COLLECTION
from pymilvus import connections, Collection
import requests
import json

logger = logging.getLogger(__name__)

QUICKWIT_URL = os.getenv("QUICKWIT_URL", "http://localhost:7280")
THREADS_INDEX = "threads-profiles"


class ThreadsProfileIndexer:
    """Index Threads profiles to storage and search systems"""

    def __init__(self):
        self.country = "threads"  # Use 'threads' as the folder
        
        # Initialize face embedder
        # Use ArcFace by default (faster) - hybrid only if explicitly enabled
        use_hybrid = os.getenv("USE_HYBRID_FACE", "false").lower() == "true"
        if use_hybrid:
            try:
                self.arcface = HybridFaceEmbedder(use_ensemble=True, arcface_weight=0.6)
                logger.info("Hybrid Face Embedder (ArcFace + UniFace) initialized")
            except Exception as e:
                logger.warning(f"Hybrid embedder failed, falling back to ArcFace only: {e}")
                self.arcface = ArcFaceEmbedder()
        else:
            # Default: Use ArcFace only (faster)
            try:
                self.arcface = ArcFaceEmbedder()
                logger.info("ArcFace embedder initialized (fast mode)")
            except Exception as e:
                logger.error(f"Failed to initialize ArcFace: {e}")
                self.arcface = None
        
        # Connect to Milvus
        try:
            connections.connect("default", host=MILVUS_HOST, port=MILVUS_PORT)
            logger.info("Connected to Milvus")
        except Exception as e:
            logger.error(f"Failed to connect to Milvus: {e}")

        # Ensure MinIO bucket
        if HAS_MINIO:
            ensure_bucket_exists()

    def index_profile(self, profile_data: Dict) -> Dict:
        """
        Index a Threads profile
        
        Args:
            profile_data: Dict from scraper with profile info and images
            
        Returns:
            Dict with indexing results
        """
        username = profile_data.get('username')
        logger.info(f"Indexing Threads profile: @{username}")

        results = {
            'username': username,
            'indexed_faces': 0,
            'uploaded_images': 0,
            'quickwit_indexed': False,
            'errors': []
        }

        try:
            # Process each image for faces
            images = profile_data.get('profile_images', [])
            profile_pic_url = None

            for idx, image in enumerate(images):
                try:
                    # Generate unique ID for this image
                    image_id = hashlib.md5(f"{username}_{idx}".encode()).hexdigest()

                    # Upload to MinIO
                    object_name = f"intel_data_images/{self.country}/threads/{image_id}.jpg"
                    minio_path = upload_image_pil(image, object_name, format="JPEG", quality=90)
                    
                    if minio_path:
                        results['uploaded_images'] += 1
                        image_url = get_image_url(minio_path)
                        
                        # Save first image as profile pic
                        if idx == 0:
                            profile_pic_url = image_url

                        # Detect and index faces
                        if self.arcface and self.arcface.is_available():
                            import cv2
                            import numpy as np
                            
                            # Convert PIL to CV2
                            img_array = np.array(image)
                            img_cv2 = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
                            
                            # Detect faces
                            face_results = self.arcface.detect_and_embed(img_cv2)
                            
                            for face_idx, face_data in enumerate(face_results):
                                # Unpack tuple: (embedding, metadata)
                                embedding, metadata = face_data
                                
                                face_id = f"{image_id}_face_{face_idx+1}"  # Match format: _face_1, _face_2, etc.
                                
                                # Crop face from bbox
                                bbox = metadata.get('bbox')
                                if bbox:
                                    x1, y1, x2, y2 = bbox
                                    face_crop = img_cv2[y1:y2, x1:x2]
                                    
                                    # Upload face crop to MinIO
                                    face_object_name = f"intel_data_images/{self.country}/faces/{face_id}.jpg"
                                    face_rgb = cv2.cvtColor(face_crop, cv2.COLOR_BGR2RGB)
                                    from PIL import Image as PILImage
                                    face_pil = PILImage.fromarray(face_rgb)
                                    face_minio_path = upload_image_pil(face_pil, face_object_name, format="JPEG")
                                    face_url = get_image_url(face_minio_path) if face_minio_path else image_url
                                else:
                                    face_url = image_url

                                # Insert to Milvus faces collection
                                if embedding is not None and len(embedding) == 512:
                                    # Ensure embedding is properly normalized (ArcFace already normalizes, but ensure it)
                                    import numpy as np
                                    if isinstance(embedding, np.ndarray):
                                        norm = np.linalg.norm(embedding)
                                        if norm > 0:
                                            embedding = embedding / norm
                                    
                                    # Ensure we have a valid URL and path
                                    face_path = face_object_name if face_minio_path else None
                                    if not face_url and face_minio_path:
                                        face_url = get_image_url(face_minio_path)
                                    
                                    # Convert to list for storage
                                    embedding_list = embedding.tolist() if hasattr(embedding, 'tolist') else list(embedding)
                                    
                                    self._insert_face_to_milvus(
                                        face_id=face_id,
                                        image_id=image_id,
                                        embedding=embedding_list,
                                        url=face_url or "",
                                        path=face_path or f"intel_data_images/{self.country}/faces/{face_id}.webp",
                                        username=username,
                                        confidence=metadata.get('confidence', 0.0)
                                    )
                                    results['indexed_faces'] += 1

                except Exception as e:
                    logger.error(f"Error processing image {idx}: {e}")
                    results['errors'].append(f"Image {idx}: {str(e)}")

            # Index profile metadata to Quickwit
            try:
                self._index_to_quickwit(profile_data, profile_pic_url)
                results['quickwit_indexed'] = True
            except Exception as e:
                logger.error(f"Failed to index to Quickwit: {e}")
                results['errors'].append(f"Quickwit: {str(e)}")

        except Exception as e:
            logger.error(f"Error indexing profile: {e}")
            results['errors'].append(str(e))

        return results

    def _insert_face_to_milvus(self, face_id: str, image_id: str, embedding: List[float], 
                                url: str, path: str, username: str, confidence: float):
        """Insert face to Milvus"""
        try:
            collection = Collection(FACES_COLLECTION)
            collection.load()

            # Ensure URL is a full URL, not just a path
            full_url = url
            if url and not url.startswith('http'):
                # If URL is just a path, construct full URL
                full_url = get_image_url(url) if url else ""
            
            data = [{
                "id": str(face_id),  # Primary key
                "face_id": str(face_id),
                "image_id": str(image_id),
                "embedding": embedding,
                "path": str(path),  # MinIO object path (e.g., intel_data_images/threads/faces/{face_id}.jpg)
                "url": str(full_url) if full_url else "",
                "confidence": float(confidence),
                "identity_id": str(username),  # Link to Threads username
                "is_centroid": False,
                "quality_score": float(confidence)
            }]

            collection.insert(data)
            logger.debug(f"Inserted face {face_id} to Milvus: path={path}, url={full_url[:80] if full_url else 'None'}")

        except Exception as e:
            logger.error(f"Error inserting to Milvus: {e}")
            raise

    def _index_to_quickwit(self, profile_data: Dict, profile_pic_url: Optional[str]):
        """Index profile metadata to Quickwit"""
        try:
            # Create Quickwit document
            doc = {
                "timestamp": int(datetime.utcnow().timestamp()),
                "username": profile_data.get('username', ''),
                "full_name": profile_data.get('full_name', ''),
                "bio": profile_data.get('bio', ''),
                "profile_url": profile_data.get('threads_url', ''),
                "profile_pic_url": profile_pic_url or profile_data.get('profile_pic_url', ''),
                "follower_count": profile_data.get('follower_count', 0),
                "is_verified": profile_data.get('is_verified', False),
                "is_private": profile_data.get('is_private', False),
                "platform": "threads",
                "country": self.country,
                "scraped_at": profile_data.get('scraped_at', datetime.utcnow().isoformat())
            }

            # Send to Quickwit
            url = f"{QUICKWIT_URL}/api/v1/{THREADS_INDEX}/ingest"
            response = requests.post(
                url,
                data=json.dumps(doc) + "\n",
                headers={"Content-Type": "application/x-ndjson"},
                timeout=30
            )

            if response.status_code in [200, 201]:
                logger.info(f"Indexed @{profile_data.get('username')} to Quickwit")
            else:
                logger.error(f"Quickwit error: {response.status_code} - {response.text}")

        except Exception as e:
            logger.error(f"Error indexing to Quickwit: {e}")
            raise


# Global instance
threads_indexer = ThreadsProfileIndexer()

