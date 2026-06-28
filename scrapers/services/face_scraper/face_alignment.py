#!/usr/bin/env python3
"""
Face Alignment
5 landmarks, similarity transform, rotation fix, crop 112×112, RGB normalization
"""

import numpy as np
import cv2
from typing import Tuple, Optional, Dict
import logging

logger = logging.getLogger(__name__)


class FaceAligner:
    """Align faces using 5 landmarks and similarity transform"""
    
    # Standard face template (112x112) - 5 landmarks
    # Based on ArcFace standard alignment
    TEMPLATE = np.array([
        [38.2946, 51.6963],  # Left eye
        [73.5318, 51.5014],  # Right eye
        [56.0252, 71.7366],  # Nose tip
        [41.5493, 92.3655],  # Left mouth corner
        [70.7299, 92.2041]   # Right mouth corner
    ], dtype=np.float32)
    
    def __init__(self, output_size: Tuple[int, int] = (112, 112)):
        self.output_size = output_size
        self.template = self.TEMPLATE * (output_size[0] / 112.0)  # Scale template
    
    def align_face(
        self,
        image: np.ndarray,
        landmarks: np.ndarray,
        bbox: Optional[np.ndarray] = None
    ) -> Optional[np.ndarray]:
        """
        Align face using 5 landmarks and similarity transform
        
        Args:
            image: BGR image array
            landmarks: 5 landmarks [[x1,y1], [x2,y2], ...] in image coordinates
            bbox: Optional bounding box [x1, y1, x2, y2]
        
        Returns:
            Aligned face crop (112x112, RGB, normalized) or None
        """
        try:
            # Ensure landmarks are in correct format
            if landmarks.shape[0] != 5:
                logger.warning(f"Expected 5 landmarks, got {landmarks.shape[0]}")
                return None
            
            # Convert landmarks to float32
            src_landmarks = landmarks.astype(np.float32)
            
            # Calculate similarity transform matrix
            transform_matrix = self._get_similarity_transform(src_landmarks, self.template)
            
            if transform_matrix is None:
                return None
            
            # Apply similarity transform
            aligned_face = cv2.warpAffine(
                image,
                transform_matrix,
                self.output_size,
                flags=cv2.WARP_INVERSE_MAP | cv2.INTER_LINEAR,
                borderMode=cv2.BORDER_CONSTANT,
                borderValue=0
            )
            
            # Convert BGR to RGB
            aligned_face_rgb = cv2.cvtColor(aligned_face, cv2.COLOR_BGR2RGB)
            
            # RGB normalization (0-1 range)
            aligned_face_normalized = aligned_face_rgb.astype(np.float32) / 255.0
            
            return aligned_face_normalized
            
        except Exception as e:
            logger.error(f"Error aligning face: {e}")
            return None
    
    def _get_similarity_transform(
        self,
        src_landmarks: np.ndarray,
        dst_landmarks: np.ndarray
    ) -> Optional[np.ndarray]:
        """
        Calculate similarity transform matrix (rotation, scale, translation)
        
        Args:
            src_landmarks: Source landmarks (5x2)
            dst_landmarks: Destination landmarks (5x2)
        
        Returns:
            2x3 transformation matrix or None
        """
        try:
            # Center landmarks
            src_center = np.mean(src_landmarks, axis=0)
            dst_center = np.mean(dst_landmarks, axis=0)
            
            src_centered = src_landmarks - src_center
            dst_centered = dst_landmarks - dst_center
            
            # Calculate scale
            src_scale = np.sqrt(np.sum(src_centered ** 2))
            dst_scale = np.sqrt(np.sum(dst_centered ** 2))
            
            if src_scale < 1e-6 or dst_scale < 1e-6:
                return None
            
            scale = dst_scale / src_scale
            
            # Calculate rotation using SVD
            H = np.dot(src_centered.T, dst_centered)
            U, S, Vt = np.linalg.svd(H)
            R = np.dot(Vt.T, U.T)
            
            # Ensure proper rotation (det(R) = 1)
            if np.linalg.det(R) < 0:
                Vt[-1, :] *= -1
                R = np.dot(Vt.T, U.T)
            
            # Build transformation matrix
            # T = scale * R * (x - src_center) + dst_center
            # T = scale * R * x - scale * R * src_center + dst_center
            transform_matrix = np.zeros((2, 3), dtype=np.float32)
            transform_matrix[0:2, 0:2] = scale * R
            transform_matrix[0:2, 2] = dst_center - scale * R @ src_center
            
            return transform_matrix
            
        except Exception as e:
            logger.error(f"Error calculating similarity transform: {e}")
            return None
    
    def align_from_metadata(
        self,
        image: np.ndarray,
        face_metadata: Dict
    ) -> Optional[np.ndarray]:
        """
        Align face from face detection metadata
        
        Args:
            image: BGR image array
            face_metadata: Face metadata with keypoints and bbox
        
        Returns:
            Aligned face crop (112x112, RGB, normalized) or None
        """
        keypoints = face_metadata.get("keypoints")
        if keypoints is None or len(keypoints) < 5:
            return None
        
        # Convert keypoints to numpy array
        landmarks = np.array(keypoints[:5], dtype=np.float32)  # Take first 5
        
        return self.align_face(image, landmarks, face_metadata.get("bbox"))

