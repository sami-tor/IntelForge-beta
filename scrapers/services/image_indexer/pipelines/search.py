#!/usr/bin/env python3
"""
Unified Search API for Images and Faces
"""

import os
import sys
import logging
from pathlib import Path
from typing import List, Dict, Optional, Any
import numpy as np

# Add services directory to path
current_dir = Path(__file__).parent
services_dir = current_dir.parent.parent
sys.path.insert(0, str(services_dir))

from image_indexer.config.milvus import get_milvus_client as get_qdrant_client, IMAGES_COLLECTION, FACES_COLLECTION
from image_indexer.config.quickwit import search_quickwit
from image_indexer.embeddings.siglip import SigLIPEmbedder
from image_indexer.embeddings.dino import DINOv2Embedder
from image_indexer.embeddings.arcface import ArcFaceEmbedder
from image_indexer.embeddings.uniface import UniFaceEmbedder
from image_indexer.embeddings.hybrid_face import HybridFaceEmbedder
from image_indexer.utils.image_tools import load_image, load_image_cv2

from pymilvus import Collection

# Setup logging
logger = logging.getLogger(__name__)

# Initialize models (lazy loading)
siglip_embedder = None
dino_embedder = None
arcface_embedder = None
uniface_embedder = None
hybrid_face_embedder = None  # Hybrid: ArcFace + UniFace

# Cache Milvus collections (avoid reloading on every request)
_faces_collection = None
_images_collection = None


def initialize_models():
    """Initialize embedding models"""
    global siglip_embedder, dino_embedder, arcface_embedder, uniface_embedder, hybrid_face_embedder

    if siglip_embedder is None:
        siglip_embedder = SigLIPEmbedder()

    if dino_embedder is None:
        dino_embedder = DINOv2Embedder()

    # Prefer ArcFace when available (commonly via InsightFace)
    if arcface_embedder is None:
        arcface_embedder = ArcFaceEmbedder()

    # If ArcFace is NOT available (common on some Windows setups), automatically try UniFace
    # This makes face detection/embedding work even when InsightFace is missing.
    if (arcface_embedder is None or not arcface_embedder.is_available()) and uniface_embedder is None:
        try:
            uniface_embedder = UniFaceEmbedder()
            if uniface_embedder.is_available():
                logger.info("[OK] UniFace embedder initialized (ArcFace fallback)")
        except Exception as e:
            logger.warning(f"[WARN] UniFace embedder failed to initialize: {e}")
            uniface_embedder = None

    # Hybrid embedder is OPTIONAL (loads both ArcFace and UniFace)
    use_hybrid = os.getenv("USE_HYBRID_FACE", "false").lower() == "true"
    if use_hybrid and hybrid_face_embedder is None:
        try:
            hybrid_face_embedder = HybridFaceEmbedder(use_ensemble=True, arcface_weight=0.6)
            logger.info("[OK] Hybrid Face Embedder (ArcFace + UniFace) initialized for search")
        except Exception as e:
            logger.warning(f"[WARN] Hybrid embedder failed to initialize: {e}")
            hybrid_face_embedder = None


def _select_face_embedder():
    """Select best available face embedder with safe fallbacks."""
    initialize_models()

    use_hybrid = os.getenv("USE_HYBRID_FACE", "false").lower() == "true"
    if use_hybrid and hybrid_face_embedder and hybrid_face_embedder.is_available():
        return hybrid_face_embedder

    if arcface_embedder and arcface_embedder.is_available():
        return arcface_embedder

    if uniface_embedder and uniface_embedder.is_available():
        return uniface_embedder

    return None


def _milvus_cosine_to_similarity(raw_score: float) -> float:
    """Convert Milvus COSINE score into a similarity in range [0..1].

    Milvus SDKs often return a *distance* for COSINE (best match ~0.0).
    This project historically treated it as a *similarity* (best match ~1.0).

    Control behavior via env var:
    - MILVUS_COSINE_SCORE_MODE=distance (default)
    - MILVUS_COSINE_SCORE_MODE=similarity
    """
    mode = os.getenv("MILVUS_COSINE_SCORE_MODE", "distance").lower().strip()

    if mode == "similarity":
        similarity = raw_score
    else:
        # Default: treat as cosine distance and convert.
        similarity = 1.0 - raw_score

    if similarity < 0.0:
        similarity = 0.0
    if similarity > 1.0:
        similarity = 1.0
    return similarity


def search_images_by_image(
    query_image_path: str,
    limit: int = 10,
    fusion: str = "rrf",  # "rrf" (reciprocal rank fusion) or "average"
    filters: Optional[Dict[str, Any]] = None
) -> List[Dict[str, Any]]:
    """
    Search for similar images using image query
    
    Args:
        query_image_path: Path to query image
        limit: Number of results
        fusion: How to fuse SigLIP and DINO scores ("rrf" or "average")
        filters: Optional metadata filters
    
    Returns:
        List of similar images with scores
    """
    try:
        logger.info(f"Starting image search for: {query_image_path}")
        initialize_models()
        client = get_qdrant_client()  # Returns None for Milvus (global connection)
        
        # Load query image
        query_img = load_image(query_image_path)
        if query_img is None:
            logger.warning(f"Failed to load query image: {query_image_path}")
            return []
        
        logger.info(f"Image loaded successfully: {query_img.size}")
        
        # Generate embeddings
        siglip_emb = None
        dino_emb = None
        
        if siglip_embedder and siglip_embedder.is_available():
            logger.info("Generating SigLIP embedding...")
            siglip_tensor = siglip_embedder.generate(query_img)
            if siglip_tensor is not None:
                siglip_emb = siglip_tensor.tolist()
                logger.info(f"SigLIP embedding generated: {len(siglip_emb)} dims")
        
        if dino_embedder and dino_embedder.is_available():
            logger.info("Generating DINOv2 embedding...")
            dino_tensor = dino_embedder.generate(query_img)
            if dino_tensor is not None:
                dino_emb = dino_tensor.tolist()
                logger.info(f"DINOv2 embedding generated: {len(dino_emb)} dims")
        
        if not siglip_emb and not dino_emb:
            logger.warning("No embeddings generated, returning empty results")
            return []
        
        # Load Milvus collection (cached)
        collection = _get_images_collection()
        
        # Build filter expression for Milvus
        expr = None
        if filters:
            filter_parts = []
            for key, value in filters.items():
                if isinstance(value, list):
                    # IN operator for lists
                    value_str = ", ".join([f'"{v}"' if isinstance(v, str) else str(v) for v in value])
                    filter_parts.append(f'{key} in [{value_str}]')
                else:
                    # Equality for single values
                    value_str = f'"{value}"' if isinstance(value, str) else str(value)
                    filter_parts.append(f'{key} == {value_str}')
            if filter_parts:
                expr = " && ".join(filter_parts)
        
        # Search with both embeddings using Milvus
        results_siglip = []
        results_dino = []
        
        if siglip_emb:
            logger.info("Searching with SigLIP embedding...")
            # Enhanced search with high efSearch for better recall
            search_params = {"metric_type": "COSINE", "params": {"ef": 1500}}  # efSearch=1500-2000 for high quality
            search_result = collection.search(
                data=[siglip_emb],
                anns_field="siglip",
                param=search_params,
                limit=limit * 2,
                expr=expr,
                output_fields=["image_id", "path", "url", "thumbnail_url", "country", "width", "height", "faces_count"]
            )
            # Convert Milvus results to compatible format
            if search_result and len(search_result) > 0:
                for hit in search_result[0]:
                    # In Milvus, entity fields are accessed directly from hit
                    entity = hit.entity if hasattr(hit, 'entity') else {}
                    results_siglip.append({
                        "id": str(hit.id),
                        "score": float(hit.score),
                        "payload": {
                            "image_id": entity.get("image_id") if isinstance(entity, dict) else getattr(entity, "image_id", ""),
                            "path": entity.get("path") if isinstance(entity, dict) else getattr(entity, "path", ""),
                            "url": entity.get("url") if isinstance(entity, dict) else getattr(entity, "url", ""),
                            "thumbnail_url": entity.get("thumbnail_url") if isinstance(entity, dict) else getattr(entity, "thumbnail_url", ""),
                            "country": entity.get("country") if isinstance(entity, dict) else getattr(entity, "country", ""),
                            "width": entity.get("width") if isinstance(entity, dict) else getattr(entity, "width", 0),
                            "height": entity.get("height") if isinstance(entity, dict) else getattr(entity, "height", 0),
                            "faces_count": entity.get("faces_count") if isinstance(entity, dict) else getattr(entity, "faces_count", 0)
                        }
                    })
            logger.info(f"SigLIP search found {len(results_siglip)} results")
        
        if dino_emb:
            logger.info("Searching with DINOv2 embedding...")
            # Enhanced search with high efSearch for better recall
            search_params = {"metric_type": "COSINE", "params": {"ef": 1500}}  # efSearch=1500-2000 for high quality
            search_result = collection.search(
                data=[dino_emb],
                anns_field="dino",
                param=search_params,
                limit=limit * 2,
                expr=expr,
                output_fields=["image_id", "path", "url", "thumbnail_url", "country", "width", "height", "faces_count"]
            )
            # Convert Milvus results to compatible format
            if search_result and len(search_result) > 0:
                for hit in search_result[0]:
                    # In Milvus, entity fields are accessed directly from hit
                    entity = hit.entity if hasattr(hit, 'entity') else {}
                    results_dino.append({
                        "id": str(hit.id),
                        "score": float(hit.score),
                        "payload": {
                            "image_id": entity.get("image_id") if isinstance(entity, dict) else getattr(entity, "image_id", ""),
                            "path": entity.get("path") if isinstance(entity, dict) else getattr(entity, "path", ""),
                            "url": entity.get("url") if isinstance(entity, dict) else getattr(entity, "url", ""),
                            "thumbnail_url": entity.get("thumbnail_url") if isinstance(entity, dict) else getattr(entity, "thumbnail_url", ""),
                            "country": entity.get("country") if isinstance(entity, dict) else getattr(entity, "country", ""),
                            "width": entity.get("width") if isinstance(entity, dict) else getattr(entity, "width", 0),
                            "height": entity.get("height") if isinstance(entity, dict) else getattr(entity, "height", 0),
                            "faces_count": entity.get("faces_count") if isinstance(entity, dict) else getattr(entity, "faces_count", 0)
                        }
                    })
            logger.info(f"DINOv2 search found {len(results_dino)} results")
        
        # Fuse results
        logger.info(f"Fusing results: {len(results_siglip)} SigLIP, {len(results_dino)} DINOv2")
        if fusion == "rrf":
            final_results = _fuse_rrf(results_siglip, results_dino, limit)
        else:
            final_results = _fuse_average(results_siglip, results_dino, limit)
        
        logger.info(f"Search completed: {len(final_results)} results")
        return final_results
        
    except Exception as e:
        logger.error(f"Error in search_images_by_image: {e}", exc_info=True)
        import traceback
        traceback.print_exc()
        return []


def _fuse_rrf(results1: List, results2: List, limit: int) -> List[Dict[str, Any]]:
    """Reciprocal Rank Fusion"""
    scores = {}
    
    # Add results from first list
    for rank, point in enumerate(results1, 1):
        point_id = str(point.get("id", ""))
        score = point.get("score", 0.0)
        rrf_score = 1.0 / (60 + rank)  # RRF formula
        if point_id not in scores:
            scores[point_id] = {
                "id": point_id,
                "score": rrf_score,
                "siglip_score": score,
                "payload": point.get("payload", {})
            }
        else:
            scores[point_id]["score"] += rrf_score
            scores[point_id]["siglip_score"] = score
    
    # Add results from second list
    for rank, point in enumerate(results2, 1):
        point_id = str(point.get("id", ""))
        score = point.get("score", 0.0)
        rrf_score = 1.0 / (60 + rank)
        if point_id not in scores:
            scores[point_id] = {
                "id": point_id,
                "score": rrf_score,
                "dino_score": score,
                "payload": point.get("payload", {})
            }
        else:
            scores[point_id]["score"] += rrf_score
            scores[point_id]["dino_score"] = score
    
    # Sort by fused score
    sorted_results = sorted(scores.values(), key=lambda x: x["score"], reverse=True)
    
    # Flatten payload into result for easier access
    flattened = []
    for r in sorted_results[:limit]:
        flat = {"id": r["id"], "score": r["score"]}
        flat.update(r.get("payload", {}))
        if "siglip_score" in r:
            flat["siglip_score"] = r["siglip_score"]
        if "dino_score" in r:
            flat["dino_score"] = r["dino_score"]
        flattened.append(flat)
    return flattened


def _fuse_average(results1: List, results2: List, limit: int) -> List[Dict[str, Any]]:
    """Average score fusion"""
    scores = {}
    
    # Add results from first list
    for point in results1:
        point_id = str(point.get("id", ""))
        score = point.get("score", 0.0)
        if point_id not in scores:
            scores[point_id] = {
                "id": point_id,
                "scores": [score],
                "payload": point.get("payload", {})
            }
        else:
            scores[point_id]["scores"].append(score)
    
    # Add results from second list
    for point in results2:
        point_id = str(point.get("id", ""))
        score = point.get("score", 0.0)
        if point_id not in scores:
            scores[point_id] = {
                "id": point_id,
                "scores": [score],
                "payload": point.get("payload", {})
            }
        else:
            scores[point_id]["scores"].append(score)
    
    # Average scores
    for point_id, data in scores.items():
        data["score"] = sum(data["scores"]) / len(data["scores"])
        del data["scores"]
    
    # Sort by average score
    sorted_results = sorted(scores.values(), key=lambda x: x["score"], reverse=True)
    
    # Flatten payload into result for easier access
    flattened = []
    for r in sorted_results[:limit]:
        flat = {"id": r["id"], "score": r["score"]}
        flat.update(r.get("payload", {}))
        flattened.append(flat)
    return flattened


def _ensure_milvus_connection():
    # get_qdrant_client is an alias for get_milvus_client (global connection via pymilvus)
    try:
        get_qdrant_client()
    except Exception:
        # Best-effort; downstream calls will raise if still unavailable.
        pass


def _get_faces_collection():
    global _faces_collection
    _ensure_milvus_connection()

    if _faces_collection is None:
        _faces_collection = Collection(FACES_COLLECTION, using="default")
        _faces_collection.load()

    return _faces_collection


def _get_images_collection():
    global _images_collection
    _ensure_milvus_connection()

    if _images_collection is None:
        _images_collection = Collection(IMAGES_COLLECTION, using="default")
        _images_collection.load()

    return _images_collection


def search_faces_by_image(
    query_image_path: str,
    limit: int = 10
):
    """Search for similar faces using an image query.

    Returns:
        Tuple of (results: List[Dict], query_facial_attributes: Optional[Dict])

    Notes:
    - Face detection/embedding will fall back to UniFace if InsightFace/ArcFace is not available.
    - Milvus COSINE score can be distance or similarity depending on SDK/config;
      we convert it into a similarity score in [0..1].

    Env vars:
    - FACE_MIN_SIMILARITY (default: 0.75)
    - MILVUS_COSINE_SCORE_MODE=distance|similarity (default: distance)
    """
    face_embedder = _select_face_embedder()
    if not face_embedder or not face_embedder.is_available():
        logger.warning("No face embedder available (ArcFace/UniFace not loaded)")
        return [], None

    # Load query image
    query_img_cv2 = load_image_cv2(query_image_path)
    if query_img_cv2 is None:
        return [], None

    # Detect faces and get embeddings
    face_results = face_embedder.detect_and_embed(query_img_cv2)
    if not face_results:
        # Distinguish between "no face" and "no matches".
        raise ValueError("No face detected")

    # Choose best face by detector confidence
    query_embedding, best_meta = max(face_results, key=lambda x: x[1].get("confidence", 0.0))
    query_vector = query_embedding.tolist() if hasattr(query_embedding, "tolist") else list(query_embedding)

    # Extract facial attributes from query face detection
    query_facial_attributes = {
        "age": best_meta.get("age"),
        "gender": best_meta.get("gender"),
    } if best_meta else None

    # Load Milvus faces collection (cached)
    collection = _get_faces_collection()

    # Search in faces collection
    search_limit = min(limit * 5, 200)  # more candidates -> better recall before thresholding
    search_params = {"metric_type": "COSINE", "params": {"ef": 1500}}

    search_result = collection.search(
        data=[query_vector],
        anns_field="embedding",
        param=search_params,
        limit=search_limit,
        output_fields=["face_id", "identity_id", "image_id", "path", "url", "confidence", "is_centroid", "quality_score"],
    )

    min_similarity = float(os.getenv("FACE_MIN_SIMILARITY", "0.75"))

    results: List[Dict[str, Any]] = []
    if search_result and len(search_result) > 0:
        for hit in search_result[0]:
            raw_score = float(hit.score)
            similarity = _milvus_cosine_to_similarity(raw_score)

            if similarity < min_similarity:
                continue
            if len(results) >= limit:
                break

            entity = hit.entity if hasattr(hit, "entity") else {}
            face_id = entity.get("face_id") if isinstance(entity, dict) else getattr(entity, "face_id", "")
            face_url = (entity.get("url") if isinstance(entity, dict) else getattr(entity, "url", "")) or ""
            face_path = (entity.get("path") if isinstance(entity, dict) else getattr(entity, "path", "")) or ""

            if not face_url or (not str(face_url).startswith("http") and not face_path):
                logger.warning(f"Face {face_id} has incomplete URL/path: url='{face_url}', path='{face_path}'")

            results.append({
                "face_id": face_id,
                "image_id": entity.get("image_id") if isinstance(entity, dict) else getattr(entity, "image_id", ""),
                "score": similarity,          # normalized similarity [0..1]
                "raw_score": raw_score,       # raw Milvus score
                "bbox": None,                 # bbox not stored in faces collection
                "confidence": entity.get("confidence") if isinstance(entity, dict) else getattr(entity, "confidence", None),
                "path": face_path,
                "url": face_url,
                "thumbnail_url": face_url,
                "identity_id": entity.get("identity_id") if isinstance(entity, dict) else getattr(entity, "identity_id", ""),
                "is_centroid": entity.get("is_centroid") if isinstance(entity, dict) else getattr(entity, "is_centroid", False),
                "quality_score": entity.get("quality_score") if isinstance(entity, dict) else getattr(entity, "quality_score", None),
            })

    return results, query_facial_attributes


def search_images_by_text(
    query_text: str,
    limit: int = 10,
    filters: Optional[Dict[str, Any]] = None
) -> List[Dict[str, Any]]:
    """
    Search images by text query (uses Quickwit + Qdrant)
    
    Args:
        query_text: Text query
        limit: Number of results
        filters: Optional metadata filters
    
    Returns:
        List of matching images
    """
    client = get_qdrant_client()  # Returns None for Milvus (global connection)
    
    # Search Quickwit to get image_ids
    image_ids = search_quickwit(query_text, filters, limit=limit * 2)
    
    if not image_ids:
        return []
    
    # Load Milvus collection (cached)
    collection = _get_images_collection()
    
    # Fetch images from Milvus by ID
    image_ids_list = image_ids[:limit]
    if not image_ids_list:
        return []
    
    # Build expression for Milvus query
    image_ids_str = ", ".join([f'"{img_id}"' for img_id in image_ids_list])
    expr = f'image_id in [{image_ids_str}]'
    
    results = collection.query(
        expr=expr,
        output_fields=["image_id", "path", "url", "thumbnail_url", "country", "width", "height", "faces_count"]
    )
    
    formatted_results = []
    for entity in results:
        formatted_results.append({
            "image_id": entity.get("image_id"),
            "score": 1.0,  # Text match doesn't have vector score
            "payload": {
                "image_id": entity.get("image_id"),
                "path": entity.get("path"),
                "url": entity.get("url"),
                "thumbnail_url": entity.get("thumbnail_url"),
                "country": entity.get("country"),
                "width": entity.get("width"),
                "height": entity.get("height"),
                "faces_count": entity.get("faces_count")
            }
        })
    
    return formatted_results


def search_faces_by_embedding(
    query_embedding: List[float],
    limit: int = 10
) -> List[Dict[str, Any]]:
    """Search faces by a 512-dim face embedding.

    Env vars:
    - FACE_MIN_SIMILARITY (default: 0.75)
    - MILVUS_COSINE_SCORE_MODE=distance|similarity (default: distance)
    """
    # Ensure embedding is a list (Milvus expects list[float])
    query_vector = query_embedding.tolist() if hasattr(query_embedding, "tolist") else list(query_embedding)

    # Load Milvus faces collection (cached)
    collection = _get_faces_collection()

    search_limit = min(limit * 5, 200)
    search_params = {"metric_type": "COSINE", "params": {"ef": 1500}}

    search_result = collection.search(
        data=[query_vector],
        anns_field="embedding",
        param=search_params,
        limit=search_limit,
        output_fields=["face_id", "identity_id", "image_id", "path", "url", "confidence", "is_centroid", "quality_score"],
    )

    min_similarity = float(os.getenv("FACE_MIN_SIMILARITY", "0.75"))

    results: List[Dict[str, Any]] = []
    if search_result and len(search_result) > 0:
        for hit in search_result[0]:
            raw_score = float(hit.score)
            similarity = _milvus_cosine_to_similarity(raw_score)

            if similarity < min_similarity:
                continue
            if len(results) >= limit:
                break

            entity = hit.entity if hasattr(hit, "entity") else {}

            results.append({
                "face_id": entity.get("face_id") if isinstance(entity, dict) else getattr(entity, "face_id", ""),
                "image_id": entity.get("image_id") if isinstance(entity, dict) else getattr(entity, "image_id", ""),
                "score": similarity,
                "raw_score": raw_score,
                "bbox": None,
                "confidence": entity.get("confidence") if isinstance(entity, dict) else getattr(entity, "confidence", None),
                "path": entity.get("path") if isinstance(entity, dict) else getattr(entity, "path", ""),
                "url": entity.get("url") if isinstance(entity, dict) else getattr(entity, "url", ""),
                "thumbnail_url": entity.get("url") if isinstance(entity, dict) else getattr(entity, "url", ""),
                "identity_id": entity.get("identity_id") if isinstance(entity, dict) else getattr(entity, "identity_id", ""),
                "is_centroid": entity.get("is_centroid") if isinstance(entity, dict) else getattr(entity, "is_centroid", False),
                "quality_score": entity.get("quality_score") if isinstance(entity, dict) else getattr(entity, "quality_score", None),
            })

    return results

