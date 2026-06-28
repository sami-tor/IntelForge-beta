#!/usr/bin/env python3
"""
Face Detectors: SCRFD (fast) and RetinaFace (accurate)
"""

import numpy as np
import cv2
from typing import List, Dict, Optional
import logging

# Optional InsightFace import
try:
    import insightface
    HAS_INSIGHTFACE = True
except ImportError:
    HAS_INSIGHTFACE = False
    insightface = None

logger = logging.getLogger(__name__)


class SCRFDFaceDetector:
    """SCRFD - Fastest face detector"""
    
    def __init__(self):
        self.detector = None
        self._load_model()
    
    def _load_model(self):
        """Load SCRFD model via InsightFace"""
        if not HAS_INSIGHTFACE:
            logger.warning("[WARN] InsightFace not available - SCRFD detector disabled")
            self.detector = None
            return
        
        try:
            # SCRFD is part of InsightFace buffalo models
            self.detector = insightface.app.FaceAnalysis(
                name='buffalo_s',  # Smallest, fastest
                providers=['CPUExecutionProvider']
            )
            self.detector.prepare(ctx_id=0, det_size=(320, 320))  # Smaller for speed
            logger.info("[OK] SCRFD detector loaded")
        except Exception as e:
            logger.warning(f"[WARN] SCRFD not available: {e}")
            self.detector = None
    
    def detect(self, image: np.ndarray) -> List[Dict]:
        """
        Detect faces using SCRFD
        
        Args:
            image: BGR image array
        
        Returns:
            List of face dicts with bbox, confidence, keypoints
        """
        if self.detector is None:
            return []
        
        try:
            faces = self.detector.get(image)
            results = []
            
            for face in faces:
                bbox = face.bbox.astype(int).tolist()  # [x1, y1, x2, y2]
                confidence = float(face.det_score)
                keypoints = face.kps.astype(int).tolist() if face.kps is not None else None
                
                # Calculate face dimensions
                face_width = bbox[2] - bbox[0]
                face_height = bbox[3] - bbox[1]
                
                results.append({
                    "bbox": bbox,
                    "confidence": confidence,
                    "keypoints": keypoints,
                    "width": face_width,
                    "height": face_height,
                    "detector": "scrfd"
                })
            
            return results
            
        except Exception as e:
            logger.debug(f"SCRFD detection error: {e}")
            return []


class RetinaFaceDetector:
    """RetinaFace - More accurate for difficult faces"""
    
    def __init__(self):
        self.detector = None
        self._load_model()
    
    def _load_model(self):
        """Load RetinaFace model"""
        if not HAS_INSIGHTFACE:
            logger.warning("[WARN] InsightFace not available - RetinaFace detector disabled")
            self.detector = None
            return
        
        try:
            # Use buffalo_m for RetinaFace (more accurate)
            self.detector = insightface.app.FaceAnalysis(
                name='buffalo_m',  # Medium, balanced
                providers=['CPUExecutionProvider']
            )
            self.detector.prepare(ctx_id=0, det_size=(640, 640))
            logger.info("[OK] RetinaFace detector loaded")
        except Exception as e:
            logger.warning(f"[WARN] RetinaFace not available: {e}")
            self.detector = None
    
    def detect(self, image: np.ndarray) -> List[Dict]:
        """
        Detect faces using RetinaFace
        
        Args:
            image: BGR image array
        
        Returns:
            List of face dicts with bbox, confidence, keypoints
        """
        if self.detector is None:
            return []
        
        try:
            faces = self.detector.get(image)
            results = []
            
            for face in faces:
                bbox = face.bbox.astype(int).tolist()  # [x1, y1, x2, y2]
                confidence = float(face.det_score)
                keypoints = face.kps.astype(int).tolist() if face.kps is not None else None
                
                # Calculate face dimensions
                face_width = bbox[2] - bbox[0]
                face_height = bbox[3] - bbox[1]
                
                results.append({
                    "bbox": bbox,
                    "confidence": confidence,
                    "keypoints": keypoints,
                    "width": face_width,
                    "height": face_height,
                    "detector": "retinaface"
                })
            
            return results
            
        except Exception as e:
            logger.debug(f"RetinaFace detection error: {e}")
            return []

