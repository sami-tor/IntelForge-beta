#!/usr/bin/env python3
"""
Hybrid Face Embedding Generator
Combines ArcFace and UniFace for maximum accuracy
Uses ensemble approach: average of both embeddings
"""

import numpy as np
from typing import Optional, List, Tuple
import cv2
import logging
from .arcface import ArcFaceEmbedder
from .uniface import UniFaceEmbedder
from ..utils.error_handler import with_error_handling, ErrorSeverity, ErrorCategory

logger = logging.getLogger(__name__)

class HybridFaceEmbedder:
    """
    Hybrid face embedder that combines ArcFace and UniFace
    Uses ensemble approach for better accuracy
    """
    
    def __init__(self, use_ensemble: bool = True, arcface_weight: float = 0.5):
        """
        Initialize hybrid face embedder
        
        Args:
            use_ensemble: If True, average both embeddings. If False, prefer ArcFace.
            arcface_weight: Weight for ArcFace (0.0-1.0). UniFace weight = 1.0 - arcface_weight
        """
        self.arcface = ArcFaceEmbedder()
        self.uniface = UniFaceEmbedder()
        self.use_ensemble = use_ensemble
        self.arcface_weight = arcface_weight
        self.uniface_weight = 1.0 - arcface_weight
        
        # Check availability
        self.arcface_available = self.arcface.is_available()
        self.uniface_available = self.uniface.is_available()
        
        if not self.arcface_available and not self.uniface_available:
            logger.warning("[WARN] Neither ArcFace nor UniFace available!")
        elif not self.arcface_available:
            logger.warning("[WARN] ArcFace not available, using UniFace only")
            self.use_ensemble = False
        elif not self.uniface_available:
            logger.warning("[WARN] UniFace not available, using ArcFace only")
            self.use_ensemble = False
        else:
            logger.info(f"[OK] Hybrid Face Embedder initialized (ensemble={use_ensemble}, arcface_weight={arcface_weight})")
    
    def is_available(self) -> bool:
        """Check if at least one model is available"""
        return self.arcface_available or self.uniface_available
    
    def _normalize_embedding(self, embedding: np.ndarray) -> np.ndarray:
        """Normalize embedding to unit length"""
        if not isinstance(embedding, np.ndarray):
            embedding = np.array(embedding)
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm
        return embedding
    
    def _ensemble_embeddings(self, emb1: np.ndarray, emb2: np.ndarray, 
                            weight1: float, weight2: float) -> np.ndarray:
        """
        Combine two embeddings using weighted average
        
        Args:
            emb1: First embedding (ArcFace)
            emb2: Second embedding (UniFace)
            weight1: Weight for first embedding
            weight2: Weight for second embedding
        
        Returns:
            Combined normalized embedding
        """
        # Normalize both embeddings
        emb1 = self._normalize_embedding(emb1)
        emb2 = self._normalize_embedding(emb2)
        
        # Weighted average
        combined = (weight1 * emb1 + weight2 * emb2) / (weight1 + weight2)
        
        # Normalize result
        return self._normalize_embedding(combined)
    
    @with_error_handling(
        severity=ErrorSeverity.MEDIUM,
        category=ErrorCategory.EMBEDDING_GENERATION,
        fallback_value=[],
        max_retries=2,
        retry_delay=1.0
    )
    def detect_and_embed(self, image: np.ndarray) -> List[Tuple[np.ndarray, dict]]:
        """
        Detect faces and generate hybrid embeddings
        
        Args:
            image: BGR image array (OpenCV format)
        
        Returns:
            List of (embedding, metadata) tuples
        """
        if not self.is_available():
            logger.warning("Hybrid face embedder not available")
            return []
        
        # Get results from both models
        arcface_results = []
        uniface_results = []
        
        if self.arcface_available:
            try:
                arcface_results = self.arcface.detect_and_embed(image)
            except Exception as e:
                logger.warning(f"ArcFace detection failed: {e}")
        
        if self.uniface_available:
            try:
                uniface_results = self.uniface.detect_and_embed(image)
            except Exception as e:
                logger.warning(f"UniFace detection failed: {e}")
        
        # If only one model available, use it directly
        if not self.use_ensemble:
            if self.arcface_available and arcface_results:
                return arcface_results
            elif self.uniface_available and uniface_results:
                return uniface_results
            return []
        
        # Ensemble approach: match faces and combine embeddings
        if not arcface_results and not uniface_results:
            return []
        
        if not arcface_results:
            return uniface_results
        if not uniface_results:
            return arcface_results
        
        # Match faces by bbox overlap (IoU)
        results = []
        used_uniface_indices = set()
        
        for arc_emb, arc_meta in arcface_results:
            arc_bbox = arc_meta['bbox']
            best_match_idx = None
            best_iou = 0.0
            
            # Find best matching UniFace detection
            for idx, (uni_emb, uni_meta) in enumerate(uniface_results):
                if idx in used_uniface_indices:
                    continue
                
                uni_bbox = uni_meta['bbox']
                iou = self._calculate_iou(arc_bbox, uni_bbox)
                
                if iou > best_iou and iou > 0.3:  # Minimum 30% overlap
                    best_iou = iou
                    best_match_idx = idx
            
            if best_match_idx is not None:
                # Combine embeddings
                uni_emb, uni_meta = uniface_results[best_match_idx]
                combined_emb = self._ensemble_embeddings(
                    arc_emb, uni_emb, 
                    self.arcface_weight, self.uniface_weight
                )
                
                # Merge metadata (prefer higher confidence)
                combined_meta = {
                    "bbox": arc_bbox if arc_meta['confidence'] >= uni_meta['confidence'] else uni_meta['bbox'],
                    "confidence": max(arc_meta['confidence'], uni_meta['confidence']),
                    "keypoints": arc_meta.get('keypoints') or uni_meta.get('keypoints'),
                    "source": "hybrid"
                }
                
                results.append((combined_emb, combined_meta))
                used_uniface_indices.add(best_match_idx)
            else:
                # No match found, use ArcFace only
                results.append((arc_emb, arc_meta))
        
        # Add remaining UniFace detections
        for idx, (uni_emb, uni_meta) in enumerate(uniface_results):
            if idx not in used_uniface_indices:
                results.append((uni_emb, uni_meta))
        
        logger.debug(f"Hybrid detection: {len(results)} faces (ArcFace: {len(arcface_results)}, UniFace: {len(uniface_results)})")
        return results
    
    def _calculate_iou(self, bbox1: List[int], bbox2: List[int]) -> float:
        """Calculate Intersection over Union (IoU) of two bounding boxes"""
        x1_1, y1_1, x2_1, y2_1 = bbox1
        x1_2, y1_2, x2_2, y2_2 = bbox2
        
        # Calculate intersection
        x1_i = max(x1_1, x1_2)
        y1_i = max(y1_1, y1_2)
        x2_i = min(x2_1, x2_2)
        y2_i = min(y2_1, y2_2)
        
        if x2_i <= x1_i or y2_i <= y1_i:
            return 0.0
        
        intersection = (x2_i - x1_i) * (y2_i - y1_i)
        area1 = (x2_1 - x1_1) * (y2_1 - y1_1)
        area2 = (x2_2 - x1_2) * (y2_2 - y1_2)
        union = area1 + area2 - intersection
        
        if union == 0:
            return 0.0
        
        return intersection / union
    
    @with_error_handling(
        severity=ErrorSeverity.MEDIUM,
        category=ErrorCategory.EMBEDDING_GENERATION,
        fallback_value=None,
        max_retries=1,
        retry_delay=0.5
    )
    def generate_from_face_crop(self, face_crop: np.ndarray) -> Optional[np.ndarray]:
        """Generate embedding from face crop using hybrid approach"""
        if not self.is_available():
            return None
        
        arcface_emb = None
        uniface_emb = None
        
        if self.arcface_available:
            try:
                arcface_emb = self.arcface.generate_from_face_crop(face_crop)
            except Exception as e:
                logger.debug(f"ArcFace crop embedding failed: {e}")
        
        if self.uniface_available:
            try:
                uniface_emb = self.uniface.generate_from_face_crop(face_crop)
            except Exception as e:
                logger.debug(f"UniFace crop embedding failed: {e}")
        
        if not self.use_ensemble:
            return arcface_emb if arcface_emb is not None else uniface_emb
        
        if arcface_emb is not None and uniface_emb is not None:
            return self._ensemble_embeddings(
                arcface_emb, uniface_emb,
                self.arcface_weight, self.uniface_weight
            )
        
        return arcface_emb if arcface_emb is not None else uniface_emb
    
    def cleanup(self):
        """Clean up resources"""
        try:
            if self.arcface:
                self.arcface.cleanup()
            if self.uniface:
                self.uniface.cleanup()
        except Exception as e:
            logger.error(f"Error cleaning up hybrid embedder: {e}")


