#!/usr/bin/env python3
"""
ArcFace Embedding Generator (512-dim) via InsightFace with memory management
"""

import numpy as np
from typing import Optional, List, Tuple
import cv2
import logging
from ..utils.memory_manager import memory_manager
from ..utils.error_handler import with_error_handling, ErrorSeverity, ErrorCategory

# Try to import insightface (optional - requires C++ build tools)
try:
    import insightface
    HAS_INSIGHTFACE = True
except ImportError:
    HAS_INSIGHTFACE = False
    insightface = None

logger = logging.getLogger(__name__)

class ArcFaceEmbedder:
    """ArcFace model for face recognition embeddings with memory management"""
    
    def __init__(self, model_name: str = "buffalo_l"):
        """
        Initialize InsightFace with ArcFace
        model_name: 'buffalo_l' (best), 'buffalo_m' (balanced), 'buffalo_s' (fast)
        """
        self.face_analyzer = None
        self.model_name = model_name
        self.model_key = f"arcface_{model_name}"
        self._load_model()
    
    def _load_model(self):
        """Load InsightFace model with memory management"""
        if not HAS_INSIGHTFACE:
            logger.warning("[WARN] InsightFace not available. Face detection/recognition will be disabled.")
            logger.warning("   Install with: pip install insightface (requires C++ build tools)")
            self.face_analyzer = None
            return
        
        try:
            # Check if model is already loaded in memory manager
            existing_model = memory_manager.get_model(self.model_key)
            if existing_model:
                logger.info(f"Using existing ArcFace model from memory manager: {self.model_name}")
                self.face_analyzer = existing_model.face_analyzer
                self.model_name = existing_model.model_name
                return
            
            logger.info(f"[INFO] Loading InsightFace + ArcFace model ({self.model_name})...")
            self.face_analyzer = insightface.app.FaceAnalysis(
                name=self.model_name,
                providers=['CPUExecutionProvider']  # Use CPU, or ['CUDAExecutionProvider'] for GPU
            )
            self.face_analyzer.prepare(ctx_id=0, det_size=(640, 640))
            
            # Register with memory manager
            memory_manager.register_model(self.model_key, self, "arcface")
            
            logger.info("[OK] InsightFace + ArcFace model loaded")
        except Exception as e:
            logger.error(f"[WARN] Failed to load InsightFace: {e}")
            import traceback
            traceback.print_exc()
            self.face_analyzer = None
    
    def is_available(self) -> bool:
        """Check if model is loaded"""
        return self.face_analyzer is not None
    
    @with_error_handling(
        severity=ErrorSeverity.MEDIUM,
        category=ErrorCategory.EMBEDDING_GENERATION,
        fallback_value=[],
        max_retries=2,
        retry_delay=1.0
    )
    def detect_and_embed(self, image: np.ndarray) -> List[Tuple[np.ndarray, dict]]:
        """
        Detect faces and generate ArcFace embeddings
        
        Args:
            image: BGR image array (OpenCV format)
        
        Returns:
            List of (embedding, metadata) tuples where:
            - embedding: 512-dim normalized numpy array
            - metadata: dict with bbox, confidence, keypoints
        """
        if not self.is_available():
            logger.warning("ArcFace model not available")
            return []
        
        # Validate input
        if not isinstance(image, np.ndarray):
            logger.error("Invalid image input type")
            return []
        
        if image.size == 0:
            logger.error("Empty image array")
            return []
        
        try:
            # Detect faces
            faces = self.face_analyzer.get(image)
            
            results = []
            for face in faces:
                # Get ArcFace embedding (already normalized)
                embedding = face.normed_embedding  # 512-dim
                
                # Extract metadata
                bbox = face.bbox.astype(int).tolist()  # [x1, y1, x2, y2]
                confidence = float(face.det_score)
                keypoints = face.kps.astype(int).tolist() if face.kps is not None else None
                
                metadata = {
                    "bbox": bbox,
                    "confidence": confidence,
                    "keypoints": keypoints,
                    "age": int(face.age) if hasattr(face, "age") and face.age is not None else None,
                    "gender": int(face.gender) if hasattr(face, "gender") and face.gender is not None else None,
                }
                
                results.append((embedding, metadata))
            
            logger.debug(f"Detected {len(results)} faces with ArcFace")
            return results
            
        except Exception as e:
            logger.error(f"[ERROR] Error detecting/embedding faces: {e}")
            raise  # Let decorator handle retry and fallback
    
    @with_error_handling(
        severity=ErrorSeverity.MEDIUM,
        category=ErrorCategory.EMBEDDING_GENERATION,
        fallback_value=None,
        max_retries=1,
        retry_delay=0.5
    )
    def generate_from_face_crop(self, face_crop: np.ndarray) -> Optional[np.ndarray]:
        """
        Generate embedding from a pre-cropped face image
        
        Args:
            face_crop: BGR face crop (OpenCV format)
        
        Returns:
            512-dim normalized embedding or None
        """
        if not self.is_available():
            logger.warning("ArcFace model not available for face crop")
            return None
        
        # Validate input
        if not isinstance(face_crop, np.ndarray):
            logger.error("Invalid face crop input type")
            return None
        
        if face_crop.size == 0:
            logger.error("Empty face crop array")
            return None
        
        try:
            # Detect faces in crop (should be 1)
            faces = self.face_analyzer.get(face_crop)
            
            if len(faces) == 0:
                logger.debug("No faces detected in crop")
                return None
            
            # Use the first (and likely only) face
            face = faces[0]
            embedding = face.normed_embedding  # Already normalized
            logger.debug(f"Generated embedding from face crop: {embedding.shape}")
            return embedding
            
        except Exception as e:
            logger.error(f"[ERROR] Error generating embedding from face crop: {e}")
            raise  # Let decorator handle retry and fallback
    
    def cleanup(self):
        """Clean up model resources"""
        try:
            if self.face_analyzer:
                # InsightFace doesn't have explicit cleanup, but we can clear references
                self.face_analyzer = None
            logger.info("ArcFace model cleaned up")
        except Exception as e:
            logger.error(f"Error cleaning up ArcFace model: {e}")
    
    def __del__(self):
        """Destructor to ensure cleanup"""
        try:
            self.cleanup()
        except Exception:
            pass

