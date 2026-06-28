#!/usr/bin/env python3
"""
Index all images from the /data directory
Usage: python scripts/index_data_images.py [data_directory]
"""

import os
import sys
from pathlib import Path

# Add services directory to path
script_dir = Path(__file__).parent
project_dir = script_dir.parent
services_dir = project_dir / "services"
sys.path.insert(0, str(services_dir))

# Supported image extensions
IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif'}

def find_images(directory: str) -> list:
    """Find all images in a directory (recursively)"""
    images = []
    for root, dirs, files in os.walk(directory):
        for file in files:
            ext = Path(file).suffix.lower()
            if ext in IMAGE_EXTENSIONS:
                images.append(os.path.join(root, file))
    return images

def main():
    # Default data directory
    default_data_dir = project_dir / "data"
    
    # Use command line argument if provided
    if len(sys.argv) > 1:
        data_dir = Path(sys.argv[1])
    else:
        data_dir = default_data_dir
    
    if not data_dir.exists():
        print(f"[ERROR] Data directory not found: {data_dir}")
        sys.exit(1)
    
    print(f"[INFO] Scanning for images in: {data_dir}")
    
    # Find all images
    image_paths = find_images(str(data_dir))
    
    if not image_paths:
        print("[WARN] No images found in data directory")
        print(f"  Supported formats: {', '.join(IMAGE_EXTENSIONS)}")
        sys.exit(0)
    
    print(f"[OK] Found {len(image_paths)} images")
    for path in image_paths[:10]:  # Show first 10
        print(f"  - {path}")
    if len(image_paths) > 10:
        print(f"  ... and {len(image_paths) - 10} more")
    
    # Import indexer
    try:
        from image_indexer.pipelines.index_images import index_images, initialize_models
        from image_indexer.config.milvus import get_milvus_client, ensure_collections
        print("[OK] Image indexer loaded")
    except ImportError as e:
        print(f"[ERROR] Failed to import image_indexer: {e}")
        print("  Make sure all dependencies are installed:")
        print("  pip install -r services/image_indexer/requirements.txt")
        sys.exit(1)
    
    # Connect to Milvus
    print("[INFO] Connecting to Milvus...")
    try:
        client = get_milvus_client()
        if client is None:
            print("[ERROR] Failed to connect to Milvus")
            print("  Make sure Milvus is running:")
            print("  docker-compose up -d milvus")
            sys.exit(1)
        ensure_collections(client)
        print("[OK] Connected to Milvus")
    except Exception as e:
        print(f"[ERROR] Milvus connection failed: {e}")
        sys.exit(1)
    
    # Initialize models
    print("[INFO] Loading ML models (this may take a minute on first run)...")
    initialize_models()
    print("[OK] Models loaded")
    
    # Index images
    print(f"\n[INFO] Starting indexing of {len(image_paths)} images...")
    print("=" * 50)
    
    stats = index_images(image_paths)
    
    print("\n" + "=" * 50)
    print("[COMPLETE] Indexing Results:")
    print(f"  Total:   {stats['total']}")
    print(f"  Success: {stats['success']}")
    print(f"  Failed:  {stats['failed']}")
    print(f"  Skipped: {stats['skipped']}")
    
    if stats['success'] > 0:
        print("\n[INFO] Images are now searchable via:")
        print("  - Visual Search (image similarity)")
        print("  - Face Search (face recognition)")
        print("  - Text Search (OCR + metadata)")

if __name__ == "__main__":
    main()

