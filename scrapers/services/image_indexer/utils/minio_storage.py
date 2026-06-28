#!/usr/bin/env python3
"""
MinIO Storage Utilities for Image Indexer
"""

import os
import sys
import io
import logging
from pathlib import Path
from typing import Optional, Tuple
from PIL import Image
import cv2
import numpy as np

# Add lib to path
lib_dir = Path(__file__).parent.parent.parent.parent / "lib"
if lib_dir.exists():
    sys.path.insert(0, str(lib_dir))

try:
    from minio import Minio
    HAS_MINIO = True
except ImportError:
    HAS_MINIO = False
    logger = logging.getLogger(__name__)
    logger.warning("MinIO client not available")

# MinIO configuration from environment
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "intelforge-images")
MINIO_PUBLIC_URL = os.getenv("MINIO_PUBLIC_URL", f"http://{MINIO_ENDPOINT}/{MINIO_BUCKET}")

_minio_client = None

def get_minio_client():
    """Get or create MinIO client"""
    global _minio_client
    if not HAS_MINIO:
        return None
    if _minio_client is None:
        _minio_client = Minio(
            MINIO_ENDPOINT,
            access_key=MINIO_ACCESS_KEY,
            secret_key=MINIO_SECRET_KEY,
            secure=False
        )
    return _minio_client

def ensure_bucket_exists(bucket_name: str = None):
    """Ensure MinIO bucket exists"""
    if not HAS_MINIO:
        return False
    bucket = bucket_name or MINIO_BUCKET
    try:
        client = get_minio_client()
        if not client.bucket_exists(bucket):
            client.make_bucket(bucket)
            logger.info(f"Created MinIO bucket: {bucket}")
        return True
    except Exception as e:
        logger.error(f"Error ensuring bucket exists: {e}")
        return False

def get_image_url(object_path: str) -> Optional[str]:
    """Get public URL for MinIO object"""
    if not HAS_MINIO or not object_path:
        return None
    return f"{MINIO_PUBLIC_URL}/{object_path}"

def upload_image_file(image_path: str, object_prefix: str = "") -> Optional[str]:
    """Upload image file to MinIO"""
    if not HAS_MINIO:
        return None
    try:
        client = get_minio_client()
        ensure_bucket_exists()
        object_name = f"{object_prefix}/{Path(image_path).name}" if object_prefix else Path(image_path).name
        client.fput_object(MINIO_BUCKET, object_name, image_path)
        return object_name
    except Exception as e:
        logger.error(f"Error uploading image file: {e}")
        return None

def upload_image_pil(image: Image.Image, object_name: str, format: str = "JPEG", quality: int = 90) -> Optional[str]:
    """Upload PIL image to MinIO"""
    if not HAS_MINIO:
        return None
    try:
        client = get_minio_client()
        ensure_bucket_exists()
        
        # Convert RGBA to RGB for JPEG (JPEG doesn't support transparency)
        img_to_save = image
        if format.upper() == "JPEG" and image.mode == 'RGBA':
            background = Image.new('RGB', image.size, (255, 255, 255))
            background.paste(image, mask=image.split()[3])
            img_to_save = background
        elif format.upper() == "JPEG" and image.mode != 'RGB':
            img_to_save = image.convert('RGB')
        
        img_bytes = io.BytesIO()
        img_to_save.save(img_bytes, format=format, quality=quality)
        img_bytes.seek(0)
        client.put_object(MINIO_BUCKET, object_name, img_bytes, length=img_bytes.getvalue().__len__(), content_type=f"image/{format.lower()}")
        return object_name
    except Exception as e:
        logger.error(f"Error uploading PIL image: {e}")
        return None

logger = logging.getLogger(__name__)


def upload_original_to_minio(image_path: str, image_id: str, country: str = "pakistan") -> Optional[str]:
    """
    Upload original image to MinIO
    
    Args:
        image_path: Local file path
        image_id: Unique image ID
        country: Country name for folder organization
    
    Returns:
        MinIO object path or None
    """
    if not HAS_MINIO:
        return None
    
    try:
        ext = Path(image_path).suffix.lower() or ".jpg"
        # Store in intel_data_images/{country}/ folder structure
        object_prefix = f"intel_data_images/{country}/images"
        return upload_image_file(image_path, object_prefix=object_prefix)
    except Exception as e:
        logger.error(f"Error uploading original to MinIO: {e}")
        return None


def upload_thumbnail_to_minio(image: Image.Image, image_id: str, country: str = "pakistan") -> Optional[str]:
    """
    Generate and upload thumbnail to MinIO
    
    Args:
        image: PIL Image
        image_id: Unique image ID
        country: Country name for folder organization
    
    Returns:
        MinIO object path or None
    """
    if not HAS_MINIO:
        return None
    
    try:
        # Generate thumbnail
        thumb = image.copy()
        thumb.thumbnail((200, 200), Image.Resampling.LANCZOS)
        
        # Convert RGBA to RGB (JPEG doesn't support transparency)
        if thumb.mode == 'RGBA':
            # Create white background
            background = Image.new('RGB', thumb.size, (255, 255, 255))
            background.paste(thumb, mask=thumb.split()[3])  # 3 is the alpha channel
            thumb = background
        elif thumb.mode != 'RGB':
            thumb = thumb.convert('RGB')
        
        # Upload to MinIO in intel_data_images/{country}/thumbnails/ folder
        object_name = f"intel_data_images/{country}/thumbnails/{image_id}_thumb.jpg"
        return upload_image_pil(thumb, object_name, format="JPEG", quality=85)
    except Exception as e:
        logger.error(f"Error uploading thumbnail to MinIO: {e}")
        return None


def upload_webp_to_minio(image: Image.Image, image_id: str, country: str = "pakistan") -> Optional[str]:
    """
    Convert to WebP and upload to MinIO
    
    Args:
        image: PIL Image
        image_id: Unique image ID
        country: Country name for folder organization
    
    Returns:
        MinIO object path or None
    """
    if not HAS_MINIO:
        return None
    
    try:
        # Upload as WebP in intel_data_images/{country}/webp/ folder
        object_name = f"intel_data_images/{country}/webp/{image_id}.webp"
        return upload_image_pil(image, object_name, format="WEBP", quality=90)
    except Exception as e:
        logger.error(f"Error uploading WebP to MinIO: {e}")
        return None


def upload_face_crop_to_minio(face_crop: np.ndarray, face_id: str, country: str = "pakistan") -> Optional[str]:
    """
    Upload face crop to MinIO
    
    Args:
        face_crop: BGR numpy array (OpenCV format)
        face_id: Unique face ID
        country: Country name for folder organization
    
    Returns:
        MinIO object path or None
    """
    if not HAS_MINIO:
        return None
    
    try:
        # Convert BGR to RGB
        face_rgb = cv2.cvtColor(face_crop, cv2.COLOR_BGR2RGB)
        face_pil = Image.fromarray(face_rgb)
        
        # Upload as WebP in intel_data_images/{country}/faces/ folder
        object_name = f"intel_data_images/{country}/faces/{face_id}.webp"
        return upload_image_pil(face_pil, object_name, format="WEBP", quality=90)
    except Exception as e:
        logger.error(f"Error uploading face crop to MinIO: {e}")
        return None

