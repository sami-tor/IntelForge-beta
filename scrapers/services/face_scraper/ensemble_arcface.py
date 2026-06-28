#!/usr/bin/env python3
"""
Ensemble ArcFace
Uses 2 models: ArcFace iresnet100 + ArcFace glint360k r100
embedding = normalize((emb1 + emb2) / 2)
"""

import numpy as np
from typing import Optional, List
import logging
import cv2

# Optional InsightFace import
try:
    import insightface
    HAS_INSIGHTFACE = True
except ImportError:
    HAS_INSIGHTFACE = False
    insightface = None

logger = logging.getLogger(__name__)


class EnsembleArcFace:
    """Ensemble ArcFace using 2 models for better stability"""
    
    def __init__(self):
        self.model1 = None  # ArcFace iresnet100
        self.model2 = None  # ArcFace glint360k r100
        self._load_models()
    
    def _load_models(self):
        """Load both ArcFace models"""
        if not HAS_INSIGHTFACE:
            logger.warning("[WARN] InsightFace not available - Ensemble ArcFace disabled")
            return
        
        try:
            # Model 1: iresnet100 (standard ArcFace)
            try:
                # Try to load iresnet100 model
                # Note: InsightFace buffalo models use different architectures
                # We'll use buffalo_l (best) as model1
                self.model1 = insightface.app.FaceAnalysis(
                    name='buffalo_l',  # Best quality
                    providers=['CPUExecutionProvider']
                )
                self.model1.prepare(ctx_id=0, det_size=(640, 640))
                logger.info("[OK] ArcFace Model 1 (buffalo_l) loaded")
            except Exception as e:
                logger.warning(f"[WARN] Model 1 not available: {e}")
            
            # Model 2: glint360k r100 (alternative)
            # Note: InsightFace doesn't have glint360k by default
            # We'll use buffalo_m as model2 for ensemble
            try:
                self.model2 = insightface.app.FaceAnalysis(
                    name='buffalo_m',  # Alternative model
                    providers=['CPUExecutionProvider']
                )
                self.model2.prepare(ctx_id=0, det_size=(640, 640))
                logger.info("[OK] ArcFace Model 2 (buffalo_m) loaded")
            except Exception as e:
                logger.warning(f"[WARN] Model 2 not available: {e}")
            
            if self.model1 is None and self.model2 is None:
                logger.error("[ERROR] No ArcFace models available")
            elif self.model1 is None or self.model2 is None:
                logger.warning("[WARN] Only one model available, ensemble disabled")
        
        except Exception as e:
            logger.error(f"[ERROR] Error loading ensemble models: {e}")
            import traceback
            traceback.print_exc()
    
    def is_available(self) -> bool:
        """Check if at least one model is available"""
        return self.model1 is not None or self.model2 is not None
    
    def generate_embedding(
        self,
        aligned_face: np.ndarray
    ) -> Optional[np.ndarray]:
        """
        Generate ensemble embedding from aligned face
        
        Args:
            aligned_face: Aligned face (112x112, RGB, normalized 0-1)
        
        Returns:
            512-dim normalized embedding or None
        """
        if not self.is_available():
            return None
        
        try:
            # Convert normalized RGB to BGR uint8 for InsightFace
            face_bgr = (aligned_face * 255.0).astype(np.uint8)
            face_bgr = cv2.cvtColor(face_bgr, cv2.COLOR_RGB2BGR)
            
            embeddings = []
            
            # Get embedding from model 1
            if self.model1 is not None:
                try:
                    faces1 = self.model1.get(face_bgr)
                    if len(faces1) > 0:
                        emb1 = faces1[0].normed_embedding  # Already normalized
                        embeddings.append(emb1)
                except Exception as e:
                    logger.debug(f"Model 1 embedding failed: {e}")
            
            # Get embedding from model 2
            if self.model2 is not None:
                try:
                    faces2 = self.model2.get(face_bgr)
                    if len(faces2) > 0:
                        emb2 = faces2[0].normed_embedding  # Already normalized
                        embeddings.append(emb2)
                except Exception as e:
                    logger.debug(f"Model 2 embedding failed: {e}")
            
            if len(embeddings) == 0:
                return None
            
            # Ensemble: average and normalize
            if len(embeddings) == 1:
                return embeddings[0]
            else:
                # Average embeddings
                ensemble_emb = np.mean(embeddings, axis=0)
                # Normalize
                norm = np.linalg.norm(ensemble_emb)
                if norm > 0:
                    ensemble_emb = ensemble_emb / norm
                return ensemble_emb
            
        except Exception as e:
            logger.error(f"Error generating ensemble embedding: {e}")
            return None
    
    def generate_embeddings_batch(
        self,
        aligned_faces: List[np.ndarray]
    ) -> List[Optional[np.ndarray]]:
        """
        Generate embeddings for multiple faces
        
        Args:
            aligned_faces: List of aligned faces
        
        Returns:
            List of embeddings (or None for failed)
        """
        return [self.generate_embedding(face) for face in aligned_faces]

