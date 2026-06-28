#!/usr/bin/env python3
"""
Visual Search Service (FastAPI)
Handles image processing, embedding generation, and visual similarity search
"""

import os
import base64
import io
import hashlib
import logging
import time
from pathlib import Path
from typing import Optional, List, Dict
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image, ImageOps
import sys
import json
import numpy as np
import cv2
import secrets

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Add lib directory to path (mounted at /app/lib in container, or relative path for local)
lib_dir = Path("/app/lib")  # Docker path
if not lib_dir.exists():
    lib_dir = Path(__file__).parent.parent.parent / "lib"  # Relative path
if not lib_dir.exists():
    lib_dir = Path.cwd() / "lib"  # Current working directory
if lib_dir.exists():
    sys.path.insert(0, str(lib_dir))
    print(f"[OK] Added lib directory to path: {lib_dir}")

# Add services directory to path for new image_indexer
# Try multiple paths: /app/services (Docker), or relative path (local)
services_dir = Path("/app/services")
if not services_dir.exists():
    # Try relative path (local execution)
    services_dir = Path(__file__).parent.parent.parent / "services"
if not services_dir.exists():
    # Try absolute path from current working directory
    services_dir = Path.cwd() / "services"
if services_dir.exists():
    sys.path.insert(0, str(services_dir))
    print(f"[OK] Added services directory to path: {services_dir}")
else:
    print(f"[WARN] Services directory not found. Tried: /app/services, {Path(__file__).parent.parent.parent / 'services'}, {Path.cwd() / 'services'}")

# Use new image_indexer (required)
try:
    from image_indexer.api import index_single_image
    from image_indexer.pipelines.search import search_images_by_image, search_faces_by_image, search_images_by_text
    from image_indexer.config.milvus import ensure_collections
    from image_indexer.config.quickwit import ensure_quickwit_index
    HAS_NEW_INDEXER = True
    print("[OK] Using new Image Indexer (2025 stack: SigLIP, DINOv2, ArcFace, YOLOv8, EasyOCR)")
except ImportError as e:
    HAS_NEW_INDEXER = False
    print(f"[ERROR] New image_indexer not available: {e}")
    import traceback
    traceback.print_exc()

app = FastAPI(title="IntelForge Visual Search Service")


def get_allowed_origins() -> List[str]:
    origins = os.getenv("VISUAL_SEARCH_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
    return [origin.strip() for origin in origins.split(",") if origin.strip()]


# CORS middleware: direct service access is restricted to configured frontends/proxies.
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Internal-API-Key"],
)


@app.middleware("http")
async def require_internal_api_key(request: Request, call_next):
    expected_key = os.getenv("VISUAL_SEARCH_API_KEY")
    if expected_key and request.url.path != "/health":
        provided_key = request.headers.get("X-Internal-API-Key")
        auth_header = request.headers.get("Authorization", "")
        bearer_key = auth_header.removeprefix("Bearer ").strip() if auth_header.startswith("Bearer ") else ""

        if not (
            secrets.compare_digest(provided_key or "", expected_key)
            or secrets.compare_digest(bearer_key, expected_key)
        ):
            return JSONResponse({"detail": "Unauthorized"}, status_code=401)

    return await call_next(request)


def validate_service_file_path(file_path: Optional[str]) -> Optional[str]:
    if not file_path:
        return None

    allowed_root = Path(os.getenv("VISUAL_SEARCH_ALLOWED_PATH_ROOT", "/data")).resolve()
    candidate = Path(file_path).expanduser().resolve()

    try:
        candidate.relative_to(allowed_root)
    except ValueError:
        raise HTTPException(status_code=400, detail="file_path is outside the allowed root")

    return str(candidate)

@app.on_event("startup")
async def startup_event():
    """Initialize image indexer on startup"""
    if not HAS_NEW_INDEXER:
        logger.error("[ERROR] New image_indexer is required but not available")
        return
    
    try:
        # Ensure collections/indexes exist
        from image_indexer.config.milvus import get_milvus_client
        client = get_milvus_client()
        ensure_collections(client)
        logger.info("[OK] Milvus collections ready")
        
        # Try to ensure Quickwit index (non-blocking - service can work without it)
        try:
            ensure_quickwit_index()
            logger.info("[OK] Quickwit index ready")
        except Exception as qw_error:
            logger.warning(f"[WARN] Quickwit not available (service will still work for search): {qw_error}")
        
        logger.info("[OK] New Image Indexer initialized")
        logger.info("[INFO] Models will be loaded on first request (lazy loading)")
        
    except Exception as e:
        logger.error(f"[ERROR] Failed to initialize image indexer: {e}")
        import traceback
        traceback.print_exc()


@app.get("/health")
async def health():
    """Health check endpoint - returns quickly without loading models"""
    if HAS_NEW_INDEXER:
        return {
            "status": "healthy",
            "indexer": "new_image_indexer",
            "milvus_host": os.getenv("MILVUS_HOST", "localhost"),
            "models": "lazy_loading"
        }
    else:
        return {
            "status": "degraded",
            "indexer": "none",
            "error": "New image_indexer not available"
        }


@app.post("/process-image")
async def process_image(
    request: Request,
    file: Optional[UploadFile] = File(None),
    file_path: Optional[str] = Form(None)
):
    """
    Process an image file and generate embeddings
    Accepts either JSON (with image_base64) or form data (file upload)
    """
    if HAS_NEW_INDEXER:
        try:
            content_type = request.headers.get("content-type", "")
            image_path_to_process = validate_service_file_path(file_path)
            
            # Check if JSON request (from auto-indexer)
            if "application/json" in content_type:
                try:
                    body = await request.json()
                    image_base64 = body.get("image_base64")
                    image_path_to_process = validate_service_file_path(body.get("file_path")) or image_path_to_process
                    
                    if image_base64:
                        # Decode base64 image
                        image_data = base64.b64decode(image_base64)
                        image = Image.open(io.BytesIO(image_data))
                        
                        # Convert RGBA to RGB (JPEG doesn't support transparency)
                        if image.mode == 'RGBA':
                            background = Image.new('RGB', image.size, (255, 255, 255))
                            background.paste(image, mask=image.split()[3])
                            image = background
                        elif image.mode != 'RGB':
                            image = image.convert('RGB')
                        
                        # Save temporarily for processing
                        temp_path = f"/tmp/{hashlib.md5(image_base64.encode()).hexdigest()}.jpg"
                        os.makedirs("/tmp", exist_ok=True)
                        image.save(temp_path)
                        image_path_to_process = temp_path
                    elif not image_path_to_process:
                        raise HTTPException(status_code=400, detail="No image_base64 or file_path in JSON body")
                except json.JSONDecodeError:
                    raise HTTPException(status_code=400, detail="Invalid JSON in request body")
            elif file:
                # Form data with file upload
                image_data = await file.read()
                image = Image.open(io.BytesIO(image_data))
                
                # Save temporarily if file_path not provided
                if not image_path_to_process:
                    temp_path = f"/tmp/upload_{hashlib.md5(image_data).hexdigest()}.jpg"
                    os.makedirs("/tmp", exist_ok=True)
                    image.save(temp_path)
                    image_path_to_process = temp_path
            else:
                raise HTTPException(status_code=400, detail="No image provided (use image_base64 in JSON or file upload)")
            
            # Process using new indexer (image will be uploaded to MinIO)
            result = index_single_image(image_path_to_process)
            
            if result["success"]:
                return JSONResponse({
                    "success": True,
                    "embedding_id": result.get("embedding_id"),
                    "image_id": result.get("image_id"),
                    "metadata": result.get("metadata"),
                    "thumbnail_path": result.get("thumbnail_path"),  # MinIO path
                    "thumbnail_url": result.get("thumbnail_url"),  # MinIO URL
                    "webp_path": result.get("webp_path"),  # MinIO path
                    "webp_url": result.get("webp_url"),  # MinIO URL
                    "original_path": result.get("original_path"),  # MinIO path
                    "original_url": result.get("original_url"),  # MinIO URL
                    "faces": result.get("faces", []),
                    "ocr_text": result.get("ocr_text", "")[:500],
                    "objects": result.get("objects", []),
                    "perceptual_hash": result.get("perceptual_hash"),
                    "faces_count": result.get("faces_count", 0)
                })
            else:
                raise HTTPException(status_code=500, detail=result.get("error", "Processing failed"))
                
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")
    else:
        raise HTTPException(status_code=503, detail="New image_indexer is required but not available")


@app.post("/search-similar")
async def search_similar(
    request: Request,
    image_base64: Optional[str] = Form(None),
    image_file: Optional[UploadFile] = File(None),
    limit: int = Query(20, ge=1, le=100),
    model: str = Query("siglip", regex="^(siglip|dinov2)$")
):
    """
    Search for similar images using visual similarity
    """
    if not HAS_NEW_INDEXER:
        raise HTTPException(status_code=503, detail="New image_indexer is required but not available")
    
    if HAS_NEW_INDEXER:
        try:
            # Handle file upload or JSON
            content_type = request.headers.get("content-type", "")
            image_path = None
            
            if image_file:
                image_data = await image_file.read()
                image = Image.open(io.BytesIO(image_data))
                temp_path = f"/tmp/search_{hashlib.md5(image_data).hexdigest()}.jpg"
                os.makedirs("/tmp", exist_ok=True)
                image.save(temp_path)
                image_path = temp_path
            elif "application/json" in content_type:
                body = await request.json()
                image_base64_data = body.get("image_base64") or image_base64
                if image_base64_data:
                    image_data = base64.b64decode(image_base64_data)
                    image = Image.open(io.BytesIO(image_data))
                    temp_path = f"/tmp/search_{hashlib.md5(image_base64_data.encode()).hexdigest()}.jpg"
                    os.makedirs("/tmp", exist_ok=True)
                    image.save(temp_path)
                    image_path = temp_path
                    limit = body.get("limit", limit)
                else:
                    raise HTTPException(status_code=400, detail="No image provided")
            elif image_base64:
                image_data = base64.b64decode(image_base64)
                image = Image.open(io.BytesIO(image_data))
                temp_path = f"/tmp/search_{hashlib.md5(image_base64.encode()).hexdigest()}.jpg"
                os.makedirs("/tmp", exist_ok=True)
                image.save(temp_path)
                image_path = temp_path
            else:
                raise HTTPException(status_code=400, detail="No image provided")
            
            # Search using new indexer (fusion uses both SigLIP and DINOv2)
            results = search_images_by_image(image_path, limit=limit, fusion="rrf")
            
            return JSONResponse({
                "success": True,
                "results": results,
                "total": len(results)
            })
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error searching: {str(e)}")
    else:
        raise HTTPException(status_code=503, detail="New image_indexer is required but not available")


@app.post("/search-faces")
async def search_faces(request: Request):
    """Search for similar faces"""
    if HAS_NEW_INDEXER:
        try:
            body = await request.json()
            face_embedding = body.get("face_embedding")
            image_path = body.get("image_path")
            limit = body.get("limit", 10)
            
            if image_path:
                # Search by image (detects face and searches)
                results, facial_attrs = search_faces_by_image(image_path, limit=limit)
            elif face_embedding:
                # Search by embedding
                from image_indexer.pipelines.search import search_faces_by_embedding
                results = search_faces_by_embedding(face_embedding, limit=limit)
                facial_attrs = None
            else:
                raise HTTPException(status_code=400, detail="face_embedding or image_path required")

            return JSONResponse({
                "success": True,
                "results": results,
                "total": len(results),
                "query_facial_attributes": facial_attrs,
            })
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error searching faces: {str(e)}")
    else:
        raise HTTPException(status_code=503, detail="New image_indexer is required but not available")


@app.post("/api/search/image")
async def search_image_endpoint(file: UploadFile = File(...), limit: int = Query(10, ge=1, le=100)):
    """
    Full-image search endpoint
    POST /api/search/image
    """
    # Read file once (file stream can only be read once)
    image_data = await file.read()
    
    if not image_data or len(image_data) == 0:
        raise HTTPException(status_code=400, detail="Empty image file")
    
    # Try new indexer first, fallback to utilities
    if HAS_NEW_INDEXER:
        temp_path = None
        try:
            # Detect image format from bytes
            ext = "jpg"  # Default
            try:
                image_bytes_io = io.BytesIO(image_data)
                image_bytes_io.seek(0)
                test_image = Image.open(image_bytes_io)
                image_format = test_image.format or "JPEG"
                # Map PIL format to file extension
                format_ext_map = {
                    "JPEG": "jpg",
                    "PNG": "png",
                    "WEBP": "webp",
                    "GIF": "gif",
                    "BMP": "bmp",
                    "TIFF": "tiff"
                }
                ext = format_ext_map.get(image_format, "jpg")
                test_image.close()
                image_bytes_io.close()
            except Exception as e:
                logger.warning(f"Could not detect image format: {e}, defaulting to jpg")
                ext = "jpg"
            
            # Save uploaded file temporarily with correct extension
            file_hash = hashlib.md5(image_data).hexdigest()
            temp_path = f"/tmp/search_{file_hash}.{ext}"
            os.makedirs("/tmp", exist_ok=True)
            with open(temp_path, "wb") as f:
                f.write(image_data)
            
            # Verify file was saved correctly
            if not os.path.exists(temp_path) or os.path.getsize(temp_path) == 0:
                raise HTTPException(status_code=400, detail="Failed to save image file")
            
            # Use new indexer search
            logger.info(f"[IMAGE_SEARCH] Searching with new indexer, temp file: {temp_path}")
            results = search_images_by_image(temp_path, limit=limit, fusion="rrf")
            logger.info(f"[IMAGE_SEARCH] Found {len(results)} results")
            
            # Clean up temp file
            if temp_path and os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except Exception as cleanup_err:
                    logger.warning(f"Failed to cleanup temp file {temp_path}: {cleanup_err}")
            
            return JSONResponse({
                "results": results,
                "total": len(results)
            })
        except HTTPException:
            # Clean up temp file on HTTP exception
            if temp_path and os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except:
                    pass
            raise
        except Exception as e:
            # Clean up temp file on error
            if temp_path and os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except:
                    pass
            logger.error(f"[IMAGE_SEARCH] New indexer failed: {e}", exc_info=True)
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")
    
    start_time = time.time()
    logger.info(f"[IMAGE_SEARCH] Incoming request, limit={limit}")
    
    try:
        # Reuse image_data (already read above) - reset BytesIO position
        image_bytes = io.BytesIO(image_data)
        image_bytes.seek(0)  # Reset to beginning
        image = Image.open(image_bytes)
        
        # Convert to RGB if necessary
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Generate embeddings
        logger.info("[IMAGE_SEARCH] Generating embeddings...")
        siglip_emb = embed_image_siglip(image)
        dino_emb = embed_image_dino(image)
        
        if siglip_emb is None or dino_emb is None:
            raise HTTPException(
                status_code=500,
                detail="Failed to generate embeddings. Check if models are loaded."
            )
        
        # Convert to lists
        siglip_vec = siglip_emb.tolist()
        dino_vec = dino_emb.tolist()
        
        # Search Qdrant
        logger.info("[IMAGE_SEARCH] Searching Qdrant...")
        search_start = time.time()
        results = search_images_by_embedding(siglip_vec, dino_vec, limit=limit)
        search_time = time.time() - search_start
        
        logger.info(f"[IMAGE_SEARCH] Found {len(results)} results in {search_time:.2f}s")
        
        # Format response with MinIO URLs
        formatted_results = []
        for result in results:
            formatted_results.append({
                "image_id": result.get("image_id"),
                "score": result.get("score", 0.0),
                "path": result.get("path", ""),  # MinIO path
                "url": result.get("url", ""),  # MinIO public URL
                "thumbnail_url": result.get("thumbnail_url", ""),  # MinIO thumbnail URL
                "webp_url": result.get("webp_url", ""),  # MinIO WebP URL
                "file_path": result.get("path", ""),  # For backward compatibility
                "faces_count": result.get("faces_count", 0),
                "width": result.get("width"),
                "height": result.get("height"),
                "format": result.get("format"),
                "metadata": result.get("metadata", {})
            })
        
        total_time = time.time() - start_time
        logger.info(f"[IMAGE_SEARCH] Total time: {total_time:.2f}s")
        
        return JSONResponse({
            "results": formatted_results,
            "total": len(formatted_results),
            "query_time": search_time
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[IMAGE_SEARCH] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@app.post("/api/search/face")
async def search_face_endpoint(file: UploadFile = File(...), limit: int = Query(10, ge=1, le=100)):
    """Face recognition endpoint
    POST /api/search/face

    Notes:
    - Normalizes EXIF rotation (common cause of "no face detected" on phone photos).
    - Returns HTTP 400 with "No face detected" if the query image has no detectable face.
    """
    if not HAS_NEW_INDEXER:
        raise HTTPException(status_code=503, detail="New image_indexer is required but not available")

    logger.info(f"[FACE_SEARCH] Incoming request, limit={limit}")

    temp_path = None
    try:
        image_data = await file.read()
        if not image_data or len(image_data) == 0:
            raise HTTPException(status_code=400, detail="Empty image file")

        os.makedirs("/tmp", exist_ok=True)
        file_hash = hashlib.md5(image_data).hexdigest()
        temp_path = f"/tmp/face_search_{file_hash}.jpg"

        # Normalize orientation + color to improve detection reliability
        try:
            img = Image.open(io.BytesIO(image_data))
            img = ImageOps.exif_transpose(img)
            if img.mode != "RGB":
                img = img.convert("RGB")
            img.save(temp_path, format="JPEG", quality=95)
        except Exception as e:
            # Fallback: save raw bytes (may still work for many images)
            logger.warning(f"[FACE_SEARCH] Could not normalize image via PIL ({e}); saving raw bytes")
            with open(temp_path, "wb") as f:
                f.write(image_data)

        try:
            results, facial_attrs = search_faces_by_image(temp_path, limit=limit)
        except ValueError as ve:
            # Search pipeline uses ValueError("No face detected") to distinguish query-image failures.
            if "no face" in str(ve).lower():
                raise HTTPException(status_code=400, detail="No face detected")
            raise

        return JSONResponse({
            "faces": results,
            "total_faces": len(results),
            "query_facial_attributes": facial_attrs,
        })

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[FACE_SEARCH] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Face search failed: {str(e)}")
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


@app.get("/collections")
async def list_collections():
    """List available Milvus collections"""
    if not HAS_NEW_INDEXER:
        raise HTTPException(status_code=503, detail="New image_indexer is required but not available")
    
    try:
        from image_indexer.config.milvus import IMAGES_COLLECTION, FACES_COLLECTION
        from pymilvus import utility
        
        collections = []
        if utility.has_collection(IMAGES_COLLECTION):
            collections.append(IMAGES_COLLECTION)
        if utility.has_collection(FACES_COLLECTION):
            collections.append(FACES_COLLECTION)
        
        return JSONResponse({
            "collections": collections
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing collections: {str(e)}")


@app.post("/threads/scrape")
async def scrape_threads_profile(request: Request):
    """
    Scrape Threads profile and index to system
    POST /threads/scrape
    Body: {"username": "example"}
    """
    try:
        body = await request.json()
        username = body.get("username")
        
        if not username:
            raise HTTPException(status_code=400, detail="Username is required")
        
        logger.info(f"[THREADS] Scraping profile: @{username}")
        
        # Import scraper
        import sys
        sys.path.insert(0, '/app/services')
        from threads_scraper.scraper import threads_scraper
        from threads_scraper.indexer import threads_indexer
        
        # Scrape profile
        profile_data = threads_scraper.scrape_profile(username)
        
        if not profile_data:
            raise HTTPException(status_code=404, detail=f"Profile @{username} not found or private")
        
        logger.info(f"[THREADS] Scraped @{username}: {len(profile_data.get('profile_images', []))} images")
        
        # Index to system
        results = threads_indexer.index_profile(profile_data)
        
        logger.info(f"[THREADS] Indexed @{username}: {results['indexed_faces']} faces, {results['uploaded_images']} images")
        
        return {
            "success": True,
            "username": username,
            "profile": {
                "full_name": profile_data.get('full_name'),
                "bio": profile_data.get('bio'),
                "follower_count": profile_data.get('follower_count'),
                "is_verified": profile_data.get('is_verified'),
                "threads_url": profile_data.get('threads_url')
            },
            "indexed_faces": results['indexed_faces'],
            "uploaded_images": results['uploaded_images'],
            "quickwit_indexed": results['quickwit_indexed'],
            "errors": results.get('errors', [])
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[THREADS] Error scraping profile: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error scraping profile: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)

