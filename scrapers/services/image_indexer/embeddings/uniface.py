#!/usr/bin/env python3
"""
UniFace Embedding Generator (512-dim) with memory management
UniFace provides high-performance face detection and recognition
Based on: https://github.com/yakhyo/uniface
"""

import numpy as np
from typing import Optional, List, Tuple
import cv2
import logging
from ..utils.memory_manager import memory_manager
from ..utils.error_handler import with_error_handling, ErrorSeverity, ErrorCategory

# Try to import uniface (latest API)
try:
    from uniface import RetinaFace, ArcFace as UniFaceArcFace
    from uniface import compute_similarity
    HAS_UNIFACE = True
except ImportError:
    HAS_UNIFACE = False
    RetinaFace = None
    UniFaceArcFace = None
    compute_similarity = None

logger = logging.getLogger(__name__)

class UniFaceEmbedder:
    """UniFace model for face recognition embeddings with memory management"""
    
    def __init__(self, model_name: str = "retinaface_mnet_v2"):
        """
        Initialize UniFace with RetinaFace detector and ArcFace recognizer
        
        Args:
            model_name: RetinaFace model name (default: retinaface_mnet_v2 - balanced)
        """
        self.detector = None
        self.recognizer = None
        self.model_name = model_name
        self.model_key = f"uniface_{model_name}"
        self._load_model()
    
    def _load_model(self):
        """Load UniFace models with memory management"""
        if not HAS_UNIFACE:
            logger.warning("[WARN] UniFace not available. Install with: pip install uniface")
            self.detector = None
            self.recognizer = None
            return
        
        try:
            # Check if model is already loaded in memory manager
            existing_model = memory_manager.get_model(self.model_key)
            if existing_model:
                logger.info("Using existing UniFace model from memory manager")
                self.detector = existing_model.detector
                self.recognizer = existing_model.recognizer
                return
            
            logger.info(f"[INFO] Loading UniFace (RetinaFace + ArcFace) - model: {self.model_name}...")
            
            # Initialize RetinaFace detector with default settings (recommended: retinaface_mnet_v2)
            # API: RetinaFace() or RetinaFace(model_name=RetinaFaceWeights.MNET_V2)
            self.detector = RetinaFace()  # Uses default retinaface_mnet_v2 (balanced, recommended)
            
            # Initialize ArcFace recognizer (face recognition)
            # API: ArcFace() - uses default weights
            self.recognizer = UniFaceArcFace()
            
            # Register with memory manager
            memory_manager.register_model(self.model_key, self, "uniface")
            
            logger.info("[OK] UniFace (RetinaFace + ArcFace) loaded")
        except Exception as e:
            logger.error(f"[WARN] Failed to load UniFace: {e}")
            import traceback
            traceback.print_exc()
            self.detector = None
            self.recognizer = None
    
    def is_available(self) -> bool:
        """Check if models are loaded"""
        return self.detector is not None and self.recognizer is not None
    
    @with_error_handling(
        severity=ErrorSeverity.MEDIUM,
        category=ErrorCategory.EMBEDDING_GENERATION,
        fallback_value=[],
        max_retries=2,
        retry_delay=1.0
    )
    def detect_and_embed(self, image: np.ndarray) -> List[Tuple[np.ndarray, dict]]:
        """
        Detect faces and generate UniFace ArcFace embeddings
        
        Args:
            image: BGR image array (OpenCV format)
        
        Returns:
            List of (embedding, metadata) tuples where:
            - embedding: 512-dim normalized numpy array
            - metadata: dict with bbox, confidence, keypoints (landmarks)
        """
        if not self.is_available():
            logger.warning("UniFace model not available")
            return []
        
        # Validate input
        if not isinstance(image, np.ndarray):
            logger.error("Invalid image input type")
            return []
        
        if image.size == 0:
            logger.error("Empty image array")
            return []
        
        try:
            # Detect faces using RetinaFace
            # API: detector.detect(image) returns list of dicts with 'bbox', 'confidence', 'landmarks'
            faces = self.detector.detect(image)
            
            if not faces:
                logger.debug("No faces detected by UniFace")
                return []
            
            results = []
            for face in faces:
                # Extract data from UniFace detection result
                # Format: {'bbox': [x1, y1, x2, y2], 'confidence': float, 'landmarks': np.array}
                bbox = face['bbox']  # [x1, y1, x2, y2]
                confidence = float(face.get('confidence', 0.0))
                landmarks = face.get('landmarks', None)  # 5-point landmarks (default) or can be extended
                
                # Get normalized embedding using ArcFace recognizer
                # API: recognizer.get_normalized_embedding(image, landmarks)
                # Note: UniFace ArcFace requires landmarks, not bbox
                if landmarks is not None:
                    try:
                        # Convert landmarks to numpy array if needed
                        if not isinstance(landmarks, np.ndarray):
                            landmarks = np.array(landmarks)
                        
                        # Get normalized embedding (already normalized by UniFace)
                        embedding = self.recognizer.get_normalized_embedding(image, landmarks)
                    except Exception as e:
                        logger.warning(f"Failed to get embedding with landmarks, trying bbox fallback: {e}")
                        # Fallback: detect again in crop to get landmarks
                        x1, y1, x2, y2 = [int(x) for x in bbox]
                        # Add padding
                        h, w = image.shape[:2]
                        padding = 20
                        x1_pad = max(0, x1 - padding)
                        y1_pad = max(0, y1 - padding)
                        x2_pad = min(w, x2 + padding)
                        y2_pad = min(h, y2 + padding)
                        face_crop = image[y1_pad:y2_pad, x1_pad:x2_pad]
                        
                        if face_crop.size > 0:
                            crop_faces = self.detector.detect(face_crop)
                            if crop_faces and crop_faces[0].get('landmarks') is not None:
                                # Adjust landmarks to full image coordinates
                                crop_landmarks = np.array(crop_faces[0]['landmarks'])
                                adjusted_landmarks = crop_landmarks + np.array([x1_pad, y1_pad])
                                embedding = self.recognizer.get_normalized_embedding(image, adjusted_landmarks)
                            else:
                                logger.warning("No landmarks in crop, skipping face")
                                continue
                        else:
                            logger.warning("Empty face crop, skipping")
                            continue
                else:
                    logger.warning("No landmarks detected, skipping face")
                    continue
                
                # Ensure embedding is numpy array
                if not isinstance(embedding, np.ndarray):
                    embedding = np.array(embedding)
                
                # UniFace ArcFace already returns normalized embeddings, but ensure it
                norm = np.linalg.norm(embedding)
                if norm > 0:
                    embedding = embedding / norm
                else:
                    logger.warning("Zero norm embedding, skipping")
                    continue
                
                # Convert landmarks to list format for metadata
                if landmarks is not None:
                    if isinstance(landmarks, np.ndarray):
                        keypoints = landmarks.tolist()
                    else:
                        keypoints = list(landmarks)
                else:
                    keypoints = None
                
                metadata = {
                    "bbox": [int(x) for x in bbox],
                    "confidence": confidence,
                    "keypoints": keypoints
                }
                
                results.append((embedding, metadata))
            
            logger.debug(f"Detected {len(results)} faces with UniFace")
            return results
            
        except Exception as e:
            logger.error(f"[ERROR] Error detecting/embedding faces with UniFace: {e}")
            import traceback
            traceback.print_exc()
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
            logger.warning("UniFace model not available for face crop")
            return None
        
        # Validate input
        if not isinstance(face_crop, np.ndarray):
            logger.error("Invalid face crop input type")
            return None
        
        if face_crop.size == 0:
            logger.error("Empty face crop array")
            return None
        
        try:
            # Detect face in crop (should be 1)
            faces = self.detector.detect(face_crop)
            
            if len(faces) == 0:
                logger.debug("No faces detected in crop by UniFace")
                return None
            
            # Use the first (and likely only) face
            face = faces[0]
            landmarks = face.get('landmarks', None)
            
            # UniFace ArcFace requires landmarks, not bbox
            if landmarks is not None:
                # Convert to numpy array if needed
                if not isinstance(landmarks, np.ndarray):
                    landmarks = np.array(landmarks)
                
                embedding = self.recognizer.get_normalized_embedding(face_crop, landmarks)
            else:
                logger.warning("No landmarks in face crop, cannot generate embedding")
                return None
            
            # Ensure embedding is numpy array and normalized
            if not isinstance(embedding, np.ndarray):
                embedding = np.array(embedding)
            
            # UniFace already returns normalized embeddings, but ensure it
            norm = np.linalg.norm(embedding)
            if norm > 0:
                embedding = embedding / norm
            else:
                logger.warning("Zero norm embedding from crop")
                return None
            
            logger.debug(f"Generated embedding from face crop with UniFace: {embedding.shape}")
            return embedding
            
        except Exception as e:
            logger.error(f"[ERROR] Error generating embedding from face crop with UniFace: {e}")
            import traceback
            traceback.print_exc()
            raise  # Let decorator handle retry and fallback
    
    def cleanup(self):
        """Clean up model resources"""
        try:
            self.detector = None
            self.recognizer = None
            logger.info("UniFace model cleaned up")
        except Exception as e:
            logger.error(f"Error cleaning up UniFace model: {e}")
    
    def __del__(self):
        """Destructor to ensure cleanup"""
        try:
            self.cleanup()
        except Exception:
            pass

