#!/usr/bin/env python3
"""
Face Quality Checker
Checks: height ≥ 70-90px, angle < 30°, blur, lighting
"""

import numpy as np
import cv2
from typing import Dict
import logging
from PIL import Image
import io

logger = logging.getLogger(__name__)


class FaceQualityChecker:
    """Check face quality metrics"""
    
    def __init__(
        self,
        min_face_height: int = 70,
        max_face_angle: float = 30.0,
        min_confidence: float = 0.5
    ):
        self.min_face_height = min_face_height
        self.max_face_angle = max_face_angle
        self.min_confidence = min_confidence
    
    def check_quality(self, face_metadata: Dict, thumbnail_data: bytes) -> float:
        """
        Check face quality and return score (0.0 - 1.0)
        
        Args:
            face_metadata: Face detection metadata
            thumbnail_data: Thumbnail image bytes
        
        Returns:
            Quality score (0.0 = bad, 1.0 = excellent)
        """
        score = 0.0
        
        # 1. Face height check (≥ 70-90px)
        face_height = face_metadata.get("height", 0)
        if face_height >= self.min_face_height:
            height_score = min(1.0, face_height / 90.0)  # Normalize to 90px
            score += height_score * 0.3
        else:
            return 0.0  # Too small, reject
        
        # 2. Confidence check
        confidence = face_metadata.get("confidence", 0.0)
        if confidence >= self.min_confidence:
            score += confidence * 0.2
        else:
            return 0.0  # Low confidence, reject
        
        # 3. Angle check (< 30°)
        angle = self._calculate_face_angle(face_metadata)
        if angle < self.max_face_angle:
            angle_score = 1.0 - (angle / self.max_face_angle)
            score += angle_score * 0.2
        else:
            return 0.0  # Too much rotation, reject
        
        # 4. Blur check
        blur_score = self._check_blur(thumbnail_data, face_metadata)
        score += blur_score * 0.15
        
        # 5. Lighting check
        lighting_score = self._check_lighting(thumbnail_data, face_metadata)
        score += lighting_score * 0.15
        
        return min(1.0, score)
    
    def _calculate_face_angle(self, face_metadata: Dict) -> float:
        """Calculate face rotation angle from keypoints"""
        keypoints = face_metadata.get("keypoints")
        if keypoints is None or len(keypoints) < 5:
            return 0.0
        
        try:
            # Keypoints: [left_eye, right_eye, nose, left_mouth, right_mouth]
            left_eye = np.array(keypoints[0])
            right_eye = np.array(keypoints[1])
            
            # Calculate angle between eyes
            eye_vector = right_eye - left_eye
            angle_rad = np.arctan2(eye_vector[1], eye_vector[0])
            angle_deg = np.abs(np.degrees(angle_rad))
            
            return angle_deg
            
        except Exception as e:
            logger.debug(f"Error calculating face angle: {e}")
            return 0.0
    
    def _check_blur(self, thumbnail_data: bytes, face_metadata: Dict) -> float:
        """Check blur using Laplacian variance"""
        try:
            img = Image.open(io.BytesIO(thumbnail_data))
            img_array = np.array(img)
            
            # Convert to grayscale
            if len(img_array.shape) == 3:
                gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
            else:
                gray = img_array
            
            # Extract face region
            bbox = face_metadata.get("bbox")
            if bbox:
                x1, y1, x2, y2 = bbox
                face_region = gray[y1:y2, x1:x2]
                
                if face_region.size > 0:
                    # Laplacian variance (higher = sharper)
                    laplacian_var = cv2.Laplacian(face_region, cv2.CV_64F).var()
                    
                    # Normalize (good images have > 100)
                    blur_score = min(1.0, laplacian_var / 200.0)
                    return blur_score
            
            return 0.5  # Default if can't check
            
        except Exception as e:
            logger.debug(f"Error checking blur: {e}")
            return 0.5
    
    def _check_lighting(self, thumbnail_data: bytes, face_metadata: Dict) -> float:
        """Check lighting quality (brightness, contrast)"""
        try:
            img = Image.open(io.BytesIO(thumbnail_data))
            img_array = np.array(img)
            
            # Convert to grayscale
            if len(img_array.shape) == 3:
                gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
            else:
                gray = img_array
            
            # Extract face region
            bbox = face_metadata.get("bbox")
            if bbox:
                x1, y1, x2, y2 = bbox
                face_region = gray[y1:y2, x1:x2]
                
                if face_region.size > 0:
                    # Mean brightness (should be 100-200)
                    mean_brightness = np.mean(face_region)
                    brightness_score = 1.0 - abs(mean_brightness - 150) / 150.0
                    brightness_score = max(0.0, min(1.0, brightness_score))
                    
                    # Contrast (std dev, should be > 30)
                    contrast = np.std(face_region)
                    contrast_score = min(1.0, contrast / 50.0)
                    
                    return (brightness_score + contrast_score) / 2.0
            
            return 0.5  # Default
            
        except Exception as e:
            logger.debug(f"Error checking lighting: {e}")
            return 0.5

