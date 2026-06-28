#!/usr/bin/env python3
"""
Complete Image Ingestion Pipeline
"""

import os
import sys
import hashlib
import json
import logging
from pathlib import Path
from typing import List, Dict, Optional, Any
from tqdm import tqdm
import numpy as np

# Add services directory to path
current_dir = Path(__file__).parent
services_dir = current_dir.parent.parent
sys.path.insert(0, str(services_dir))

from image_indexer.config.milvus import get_milvus_client as get_qdrant_client, ensure_collections, IMAGES_COLLECTION, FACES_COLLECTION
from image_indexer.config.quickwit import ensure_quickwit_index, index_document
from image_indexer.embeddings.siglip import SigLIPEmbedder
from image_indexer.embeddings.dino import DINOv2Embedder
from image_indexer.embeddings.arcface import ArcFaceEmbedder
from image_indexer.embeddings.uniface import UniFaceEmbedder
from image_indexer.embeddings.hybrid_face import HybridFaceEmbedder
from image_indexer.utils.image_tools import (
    load_image, load_image_cv2,
    extract_metadata, extract_objects_yolo, extract_text_easyocr, extract_text_tesseract
)
from image_indexer.utils.phash import generate_phash
from image_indexer.utils.minio_storage import (
    upload_original_to_minio, upload_thumbnail_to_minio,
    upload_webp_to_minio, upload_face_crop_to_minio,
    get_image_url, ensure_bucket_exists, HAS_MINIO
)

from pymilvus import Collection
from PIL import Image
import cv2

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize models (lazy loading)
siglip_embedder = None
dino_embedder = None
arcface_embedder = None
uniface_embedder = None
hybrid_face_embedder = None  # Hybrid: ArcFace + UniFace
yolo_model = None
easyocr_reader = None


def initialize_models():
    """Initialize all ML models"""
    global siglip_embedder, dino_embedder, arcface_embedder, uniface_embedder, hybrid_face_embedder, yolo_model, easyocr_reader

    if siglip_embedder is None:
        siglip_embedder = SigLIPEmbedder()

    if dino_embedder is None:
        dino_embedder = DINOv2Embedder()

    # Prefer ArcFace when available
    if arcface_embedder is None:
        arcface_embedder = ArcFaceEmbedder()

    # If ArcFace is not available (common on some Windows installs), fall back to UniFace
    if (arcface_embedder is None or not arcface_embedder.is_available()) and uniface_embedder is None:
        try:
            uniface_embedder = UniFaceEmbedder()
            if uniface_embedder.is_available():
                logger.info("[OK] UniFace embedder initialized (ArcFace fallback)")
        except Exception as e:
            logger.warning(f"[WARN] UniFace embedder failed to initialize: {e}")
            uniface_embedder = None

    # Hybrid embedder is OPTIONAL - only use if explicitly enabled via env var
    use_hybrid = os.getenv("USE_HYBRID_FACE", "false").lower() == "true"
    if use_hybrid and hybrid_face_embedder is None:
        try:
            hybrid_face_embedder = HybridFaceEmbedder(use_ensemble=True, arcface_weight=0.6)
            logger.info("[OK] Hybrid Face Embedder (ArcFace + UniFace) initialized")
        except Exception as e:
            logger.warning(f"[WARN] Hybrid embedder failed, using non-hybrid face embedder: {e}")
            hybrid_face_embedder = None
    
    # Initialize YOLO
    if yolo_model is None:
        try:
            from ultralytics import YOLO
            yolo_model = YOLO("yolov8n.pt")
            logger.info("[OK] YOLOv8 model loaded")
        except Exception as e:
            logger.warning(f"[WARN] YOLO not available: {e}")
    
    # Initialize EasyOCR
    if easyocr_reader is None:
        try:
            import easyocr
            import torch
            easyocr_reader = easyocr.Reader(['en'], gpu=torch.cuda.is_available())
            logger.info("[OK] EasyOCR initialized")
        except Exception as e:
            logger.warning(f"[WARN] EasyOCR not available: {e}")


def generate_image_id(image_path: str) -> str:
    """Generate unique image ID from path + content hash (allows same filename, different content)"""
    # Use path + file content hash to ensure uniqueness even for same filename
    try:
        with open(image_path, 'rb') as f:
            content_hash = hashlib.md5(f.read()).hexdigest()
        path_hash = hashlib.md5(image_path.encode()).hexdigest()
        # Combine path and content hash for unique ID
        return hashlib.md5(f"{path_hash}_{content_hash}".encode()).hexdigest()
    except Exception as e:
        logger.warning(f"Error generating image_id, using path only: {e}")
        return hashlib.md5(image_path.encode()).hexdigest()


def process_image(image_path: str) -> Optional[Dict[str, Any]]:
    """
    Process a single image:
    1. Load image
    2. Generate embeddings (SigLIP, DINOv2)
    3. Detect faces and generate ArcFace embeddings
    4. Extract OCR text
    5. Detect objects
    6. Generate thumbnail and WebP
    7. Extract metadata and perceptual hash
    
    Returns processed data dict or None on error
    """
    # Initialize models if not already done
    initialize_models()
    
    try:
        # Load image
        img_pil = load_image(image_path)
        if img_pil is None:
            return None
        
        img_cv2 = load_image_cv2(image_path)
        if img_cv2 is None:
            return None
        
        # Generate image ID
        image_id = generate_image_id(image_path)
        
        # Extract country from path (default to pakistan)
        country = "pakistan"  # Default
        # Try to extract from path like /data/pakistan/image.jpg
        path_parts = Path(image_path).parts
        if len(path_parts) > 1:
            for part in path_parts:
                if part.lower() in ["pakistan", "india", "afghanistan", "iran", "china", "bangladesh"]:
                    country = part.lower()
                    break
        
        # Extract metadata
        metadata = extract_metadata(img_pil, image_path)
        metadata["country"] = country  # Add country to metadata
        
        # Generate embeddings
        siglip_emb = None
        dino_emb = None
        
        if siglip_embedder and siglip_embedder.is_available():
            siglip_tensor = siglip_embedder.generate(img_pil)
            if siglip_tensor is not None:
                siglip_emb = siglip_tensor.tolist()
        
        if dino_embedder and dino_embedder.is_available():
            dino_tensor = dino_embedder.generate(img_pil)
            if dino_tensor is not None:
                dino_emb = dino_tensor.tolist()
        
        # Detect objects
        objects = extract_objects_yolo(image_path, yolo_model)
        object_classes = [obj["class"] for obj in objects]
        
        # Extract OCR text
        ocr_text = extract_text_easyocr(image_path, easyocr_reader)
        if not ocr_text:
            ocr_text = extract_text_tesseract(img_pil)
        
        # Ensure MinIO bucket exists
        if HAS_MINIO:
            ensure_bucket_exists()
        
        # Upload original image to MinIO with country folder
        original_minio_path = upload_original_to_minio(image_path, image_id, country)
        
        # Detect faces and generate embeddings
        # Prefer hybrid (if enabled), else ArcFace, else UniFace fallback
        faces_data = []
        use_hybrid = os.getenv("USE_HYBRID_FACE", "false").lower() == "true"

        face_embedder = None
        if use_hybrid and hybrid_face_embedder and hybrid_face_embedder.is_available():
            face_embedder = hybrid_face_embedder
        elif arcface_embedder and arcface_embedder.is_available():
            face_embedder = arcface_embedder
        elif uniface_embedder and uniface_embedder.is_available():
            face_embedder = uniface_embedder

        if face_embedder and face_embedder.is_available():
            face_results = face_embedder.detect_and_embed(img_cv2)
            
            for i, (embedding, face_meta) in enumerate(face_results):
                face_id = f"{image_id}_face_{i+1}"
                bbox = face_meta["bbox"]
                
                # Extract face crop
                x1, y1, x2, y2 = bbox
                # Add padding
                padding = 20
                h, w = img_cv2.shape[:2]
                x1_padded = max(0, x1 - padding)
                y1_padded = max(0, y1 - padding)
                x2_padded = min(w, x2 + padding)
                y2_padded = min(h, y2 + padding)
                
                face_crop = img_cv2[y1_padded:y2_padded, x1_padded:x2_padded]
                
                # Upload face crop to MinIO
                face_minio_path = None
                if HAS_MINIO:
                    face_minio_path = upload_face_crop_to_minio(face_crop, face_id, country)
                
                # Ensure embedding is properly normalized (ArcFace already normalizes, but ensure it)
                import numpy as np
                if isinstance(embedding, np.ndarray):
                    norm = np.linalg.norm(embedding)
                    if norm > 0:
                        embedding = embedding / norm
                
                faces_data.append({
                    "face_id": face_id,
                    "image_id": image_id,
                    "bbox": bbox,
                    "confidence": face_meta["confidence"],
                    "path": face_minio_path or f"faces/{face_id}.webp",  # MinIO path or fallback
                    "url": get_image_url(face_minio_path) if face_minio_path and HAS_MINIO else "",
                    "embedding": embedding.tolist() if hasattr(embedding, 'tolist') else list(embedding)  # 512-dim face embedding (normalized)
                })
        
        # Generate and upload thumbnail to MinIO
        thumbnail_minio_path = None
        if HAS_MINIO:
            thumbnail_minio_path = upload_thumbnail_to_minio(img_pil, image_id, country)
        
        # Convert to WebP and upload to MinIO
        webp_minio_path = None
        if HAS_MINIO:
            webp_minio_path = upload_webp_to_minio(img_pil, image_id, country)
        
        # Generate perceptual hash
        phash_data = generate_phash(img_pil)
        phash = phash_data.get("phash", "")
        
        # Build result with MinIO paths
        result = {
            "image_id": image_id,
            "image_path": image_path,  # Original local path (for reference)
            "metadata": metadata,
            "embeddings": {
                "siglip": siglip_emb,
                "dino": dino_emb
            },
            "faces": faces_data,
            "objects": object_classes,
            "ocr_text": ocr_text,
            "thumbnail_path": thumbnail_minio_path,  # MinIO path
            "thumbnail_url": get_image_url(thumbnail_minio_path) if thumbnail_minio_path and HAS_MINIO else None,
            "webp_path": webp_minio_path,  # MinIO path
            "webp_url": get_image_url(webp_minio_path) if webp_minio_path and HAS_MINIO else None,
            "original_path": original_minio_path,  # MinIO path for original
            "original_url": get_image_url(original_minio_path) if original_minio_path and HAS_MINIO else None,
            "phash": phash
        }
        
        return result
        
    except Exception as e:
        logger.error(f"[ERROR] Error processing image {image_path}: {e}")
        import traceback
        traceback.print_exc()
        return None


def index_to_qdrant(client, image_data: Dict[str, Any], batch_size: int = 200) -> bool:
    """
    Index image and faces to Milvus
    """
    try:
        # Prepare image data for Milvus
        siglip_emb = image_data["embeddings"].get("siglip")
        dino_emb = image_data["embeddings"].get("dino")
        
        if not siglip_emb and not dino_emb:
            logger.warning(f"[WARN] No embeddings for image {image_data['image_id']}")
            return False
        
        # Load images collection
        images_collection = Collection(IMAGES_COLLECTION)
        images_collection.load()
        
        # Prepare entity data for Milvus (row-based format)
        image_id = str(image_data["image_id"])
        entity_row = {
            "id": image_id,
            "image_id": image_id,
            "path": str(image_data.get("original_path") or image_data.get("image_path", "")),
            "url": str(image_data.get("original_url") or ""),
            "thumbnail_url": str(image_data.get("thumbnail_url") or ""),
            "country": str(image_data["metadata"].get("country", "pakistan")),
            "width": int(image_data["metadata"].get("width", 0)),
            "height": int(image_data["metadata"].get("height", 0)),
            "faces_count": int(len(image_data.get("faces", [])))
        }
        
        # Add vectors (both must be present for multi-vector)
        if siglip_emb:
            entity_row["siglip"] = siglip_emb
        if dino_emb:
            entity_row["dino"] = dino_emb
        
        # Insert image (as list of rows)
        images_collection.insert([entity_row])
        images_collection.flush()
        
        # Index faces
        if image_data.get("faces"):
            faces_collection = Collection(FACES_COLLECTION)
            faces_collection.load()
            
            face_rows = []
            for face in image_data["faces"]:
                face_rows.append({
                    "id": str(face["face_id"]),
                    "face_id": str(face["face_id"]),
                    "identity_id": str(face.get("identity_id", "")),  # For centroids
                    "image_id": str(face["image_id"]),
                    "embedding": face["embedding"],
                    "path": str(face.get("path", "")),
                    "url": str(face.get("url", "")),
                    "confidence": float(face.get("confidence", 0.0)),
                    "is_centroid": bool(face.get("is_centroid", False)),
                    "quality_score": float(face.get("quality_score", 0.0))
                })
            
            if face_rows:
                faces_collection.insert(face_rows)
                faces_collection.flush()
        
        return True
        
    except Exception as e:
        logger.error(f"[ERROR] Error indexing to Milvus: {e}")
        import traceback
        traceback.print_exc()
        return False


def index_to_quickwit(image_data: Dict[str, Any]) -> bool:
    """Index image metadata to Quickwit"""
    try:
        import time
        
        doc = {
            "image_id": image_data["image_id"],
            "file_path": image_data["image_path"],
            "ocr_text": image_data.get("ocr_text", ""),
            "objects": image_data.get("objects", []),
            "phash": image_data.get("phash", ""),
            "faces_count": len(image_data.get("faces", [])),
            "width": image_data["metadata"].get("width", 0),
            "height": image_data["metadata"].get("height", 0),
            "format": image_data["metadata"].get("format", "unknown"),
            "timestamp": int(time.time())
        }
        
        return index_document(doc)
        
    except Exception as e:
        logger.error(f"[ERROR] Error indexing to Quickwit: {e}")
        return False


def index_images(image_paths: List[str], batch_size: int = 200) -> Dict[str, int]:
    """
    Main indexing pipeline
    
    Args:
        image_paths: List of image file paths
        batch_size: Batch size for Qdrant operations
    
    Returns:
        dict with success/failure counts
    """
    # Initialize
    initialize_models()
    
    # Ensure collections/indexes exist
    client = get_qdrant_client()
    ensure_collections(client)
    ensure_quickwit_index()
    
    stats = {
        "total": len(image_paths),
        "success": 0,
        "failed": 0,
        "skipped": 0
    }
    
    # Process images
    for image_path in tqdm(image_paths, desc="Processing images"):
        try:
            # Process image
            image_data = process_image(image_path)
            if image_data is None:
                stats["skipped"] += 1
                continue
            
            # Index to Qdrant
            qdrant_ok = index_to_qdrant(client, image_data, batch_size)
            
            # Index to Quickwit
            quickwit_ok = index_to_quickwit(image_data)
            
            if qdrant_ok:
                stats["success"] += 1
            else:
                stats["failed"] += 1
                
        except Exception as e:
            logger.error(f"[ERROR] Error in indexing pipeline for {image_path}: {e}")
            stats["failed"] += 1
            continue
    
    return stats


if __name__ == "__main__":
    # Example usage
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python index_images.py <image_path1> [image_path2] ...")
        sys.exit(1)
    
    image_paths = sys.argv[1:]
    stats = index_images(image_paths)
    
    print("\n=== Indexing Complete ===")
    print(f"Total: {stats['total']}")
    print(f"Success: {stats['success']}")
    print(f"Failed: {stats['failed']}")
    print(f"Skipped: {stats['skipped']}")

