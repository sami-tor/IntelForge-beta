#!/usr/bin/env python3
"""
Simple API wrapper for image_indexer pipeline
Can be used by auto-indexer or other services
"""

import sys
from pathlib import Path

# Add services directory to path
current_dir = Path(__file__).parent
services_dir = current_dir.parent
sys.path.insert(0, str(services_dir))

from image_indexer.pipelines.index_images import process_image, index_to_qdrant, index_to_quickwit
from image_indexer.config.milvus import get_milvus_client as get_qdrant_client, ensure_collections
from image_indexer.config.quickwit import ensure_quickwit_index


def index_single_image(image_path: str) -> dict:
    """
    Process and index a single image
    
    Returns:
        dict with success status and data
    """
    # Ensure collections exist
    client = get_qdrant_client()
    ensure_collections(client)
    ensure_quickwit_index()
    
    # Process image
    image_data = process_image(image_path)
    if image_data is None:
        return {
            "success": False,
            "error": "Failed to process image"
        }
    
    # Index to Qdrant
    qdrant_ok = index_to_qdrant(client, image_data)
    
    # Index to Quickwit
    quickwit_ok = index_to_quickwit(image_data)
    
    return {
        "success": qdrant_ok,
        "image_id": image_data["image_id"],
        "embedding_id": image_data["image_id"],  # Same as image_id
        "metadata": image_data["metadata"],
        "thumbnail_path": image_data.get("thumbnail_path"),  # MinIO path
        "thumbnail_url": image_data.get("thumbnail_url"),  # MinIO URL
        "webp_path": image_data.get("webp_path"),  # MinIO path
        "webp_url": image_data.get("webp_url"),  # MinIO URL
        "original_path": image_data.get("original_path"),  # MinIO path
        "original_url": image_data.get("original_url"),  # MinIO URL
        "faces": image_data.get("faces", []),
        "ocr_text": image_data.get("ocr_text", ""),
        "objects": image_data.get("objects", []),
        "perceptual_hash": image_data.get("phash", ""),
        "faces_count": len(image_data.get("faces", []))
    }

