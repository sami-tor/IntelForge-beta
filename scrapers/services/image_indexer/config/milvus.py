#!/usr/bin/env python3
"""
Milvus Configuration and Collection Setup
Replaces Qdrant configuration
"""

import os
from typing import Optional, Dict, Any
from pymilvus import (
    connections,
    Collection,
    CollectionSchema,
    FieldSchema,
    DataType,
    utility
)

MILVUS_HOST = os.getenv("MILVUS_HOST", "localhost")
MILVUS_PORT = int(os.getenv("MILVUS_PORT", "19530"))
IMAGES_COLLECTION = os.getenv("MILVUS_IMAGES_COLLECTION", "images")
FACES_COLLECTION = os.getenv("MILVUS_FACES_COLLECTION", "faces")


def get_milvus_client():
    """Connect to Milvus and return connection status"""
    try:
        connections.connect(
            alias="default",
            host=MILVUS_HOST,
            port=MILVUS_PORT
        )
        return None  # Return None for compatibility (code expects None for global connection)
    except Exception as e:
        print(f"[ERROR] Failed to connect to Milvus: {e}")
        return None


def ensure_images_collection():
    """
    Create images collection with multi-vector setup:
    - siglip: 768-dim (cosine)
    - dino: 768-dim (cosine)
    """
    try:
        if utility.has_collection(IMAGES_COLLECTION):
            print(f"[OK] Images collection '{IMAGES_COLLECTION}' already exists")
            return True
        
        # Define schema
        fields = [
            FieldSchema(name="id", dtype=DataType.VARCHAR, is_primary=True, max_length=64),
            FieldSchema(name="siglip", dtype=DataType.FLOAT_VECTOR, dim=768),
            FieldSchema(name="dino", dtype=DataType.FLOAT_VECTOR, dim=768),
            FieldSchema(name="image_id", dtype=DataType.VARCHAR, max_length=64),
            FieldSchema(name="path", dtype=DataType.VARCHAR, max_length=512),
            FieldSchema(name="url", dtype=DataType.VARCHAR, max_length=512),
            FieldSchema(name="thumbnail_url", dtype=DataType.VARCHAR, max_length=512),
            FieldSchema(name="country", dtype=DataType.VARCHAR, max_length=50),
            FieldSchema(name="width", dtype=DataType.INT64),
            FieldSchema(name="height", dtype=DataType.INT64),
            FieldSchema(name="faces_count", dtype=DataType.INT64),
        ]
        
        schema = CollectionSchema(
            fields=fields,
            description="Image embeddings (SigLIP + DINOv2)"
        )
        
        collection = Collection(
            name=IMAGES_COLLECTION,
            schema=schema
        )
        
        # Create indexes for both vectors
        index_params = {
            "metric_type": "COSINE",
            "index_type": "HNSW",
            "params": {"M": 16, "efConstruction": 200}
        }
        
        collection.create_index(field_name="siglip", index_params=index_params)
        collection.create_index(field_name="dino", index_params=index_params)
        collection.load()
        
        print(f"[OK] Created images collection '{IMAGES_COLLECTION}' with multi-vector setup")
        return True
        
    except Exception as e:
        print(f"[ERROR] Error ensuring images collection: {e}")
        import traceback
        traceback.print_exc()
        return False


def ensure_faces_collection():
    """
    Create faces collection with single vector:
    - arcface: 512-dim (cosine)
    """
    try:
        if utility.has_collection(FACES_COLLECTION):
            print(f"[OK] Faces collection '{FACES_COLLECTION}' already exists")
            return True
        
        # Define schema - all fields are nullable to avoid insert errors
        fields = [
            FieldSchema(name="id", dtype=DataType.VARCHAR, is_primary=True, max_length=64),
            FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=512),
            FieldSchema(name="face_id", dtype=DataType.VARCHAR, max_length=64),
            FieldSchema(name="identity_id", dtype=DataType.VARCHAR, max_length=64),  # For centroids
            FieldSchema(name="image_id", dtype=DataType.VARCHAR, max_length=64),
            FieldSchema(name="path", dtype=DataType.VARCHAR, max_length=512),
            FieldSchema(name="url", dtype=DataType.VARCHAR, max_length=512),
            FieldSchema(name="confidence", dtype=DataType.FLOAT),
            FieldSchema(name="is_centroid", dtype=DataType.BOOL),  # True for centroid, False for individual
            FieldSchema(name="quality_score", dtype=DataType.FLOAT),
        ]
        
        schema = CollectionSchema(
            fields=fields,
            description="Face embeddings (ArcFace)"
        )
        
        collection = Collection(
            name=FACES_COLLECTION,
            schema=schema
        )
        
        # Create index with optimized HNSW parameters for high-quality search
        index_params = {
            "metric_type": "COSINE",
            "index_type": "HNSW",
            "params": {
                "M": 32,  # High connectivity for better recall
                "efConstruction": 500  # Higher construction for better quality
            }
        }
        
        collection.create_index(field_name="embedding", index_params=index_params)
        collection.load()
        
        print(f"[OK] Created faces collection '{FACES_COLLECTION}' with ArcFace vector")
        return True
        
    except Exception as e:
        print(f"[ERROR] Error ensuring faces collection: {e}")
        import traceback
        traceback.print_exc()
        return False


def ensure_collections(client=None):
    """Ensure both collections exist"""
    if client is None:
        get_milvus_client()
    
    images_ok = ensure_images_collection()
    faces_ok = ensure_faces_collection()
    
    return images_ok and faces_ok


def get_collection_info(collection_name: str) -> Dict[str, Any]:
    """Get collection information"""
    try:
        collection = Collection(collection_name)
        collection.load()
        
        stats = collection.num_entities
        
        return {
            "name": collection_name,
            "vectors_count": stats,
            "status": "ready"
        }
    except Exception as e:
        print(f"[ERROR] Error getting collection info: {e}")
        return {}


# Alias for compatibility
get_qdrant_client = get_milvus_client
