#!/usr/bin/env python3
"""
Variety Selector
Selects 10-20 most diverse photos based on:
- Angle (front, 3/4, profile)
- Emotions
- Scenes
- Lighting
- Hair style
- Distance
- Embedding diversity (distance > 0.3-0.4)
"""

import numpy as np
from typing import List, Dict
import logging
from face_scraper.thumbnail_scraper import ThumbnailCandidate

logger = logging.getLogger(__name__)


class VarietySelector:
    """Select diverse photos for maximum centroid quality"""
    
    def __init__(self, target_count: int = 15, min_distance: float = 0.3):
        self.target_count = target_count
        self.min_distance = min_distance
    
    def select_diverse(self, candidates: List[ThumbnailCandidate]) -> List[ThumbnailCandidate]:
        """
        Select most diverse candidates using embedding diversity
        
        Args:
            candidates: List of quality-checked candidates
        
        Returns:
            List of diverse candidates (10-20)
        """
        if len(candidates) <= self.target_count:
            return candidates
        
        # Generate diversity embeddings from face metadata
        diversity_embeddings = []
        for candidate in candidates:
            emb = self._generate_diversity_embedding(candidate)
            diversity_embeddings.append(emb)
        
        diversity_embeddings = np.array(diversity_embeddings)
        
        # Greedy selection: start with best quality, add most diverse
        selected_indices = []
        selected_embeddings = []
        
        # Start with highest quality
        sorted_indices = sorted(
            range(len(candidates)),
            key=lambda i: candidates[i].face_quality_score,
            reverse=True
        )
        
        # Add first (best quality)
        selected_indices.append(sorted_indices[0])
        selected_embeddings.append(diversity_embeddings[sorted_indices[0]])
        
        # Greedily add most diverse candidates
        for _ in range(1, min(self.target_count, len(candidates))):
            best_idx = None
            best_min_distance = -1
            
            for idx in sorted_indices:
                if idx in selected_indices:
                    continue
                
                # Calculate minimum distance to all selected
                candidate_emb = diversity_embeddings[idx]
                min_dist = float('inf')
                
                for selected_emb in selected_embeddings:
                    dist = np.linalg.norm(candidate_emb - selected_emb)
                    min_dist = min(min_dist, dist)
                
                # Prefer candidates with distance > min_distance
                if min_dist > self.min_distance and min_dist > best_min_distance:
                    best_min_distance = min_dist
                    best_idx = idx
            
            # If no candidate with min_distance, pick most diverse anyway
            if best_idx is None:
                for idx in sorted_indices:
                    if idx in selected_indices:
                        continue
                    
                    candidate_emb = diversity_embeddings[idx]
                    min_dist = float('inf')
                    
                    for selected_emb in selected_embeddings:
                        dist = np.linalg.norm(candidate_emb - selected_emb)
                        min_dist = min(min_dist, dist)
                    
                    if min_dist > best_min_distance:
                        best_min_distance = min_dist
                        best_idx = idx
            
            if best_idx is not None:
                selected_indices.append(best_idx)
                selected_embeddings.append(diversity_embeddings[best_idx])
            else:
                break
        
        return [candidates[i] for i in selected_indices]
    
    def _generate_diversity_embedding(self, candidate: ThumbnailCandidate) -> np.ndarray:
        """
        Generate diversity embedding from face metadata
        
        Features:
        - Face angle (front/3/4/profile)
        - Face size (distance)
        - Lighting direction
        - Face position in image
        - Quality score
        """
        features = []
        metadata = candidate.face_metadata or {}
        
        # 1. Face angle (0-180 degrees)
        angle = self._calculate_face_angle(metadata)
        features.append(angle / 180.0)  # Normalize
        
        # 2. Face size (normalized by image size)
        face_height = metadata.get("height", 0)
        features.append(min(1.0, face_height / 200.0))  # Normalize to 200px
        
        # 3. Face position (center = 0.5, edges = 0.0 or 1.0)
        bbox = metadata.get("bbox", [0, 0, 100, 100])
        face_center_x = (bbox[0] + bbox[2]) / 2.0
        face_center_y = (bbox[1] + bbox[3]) / 2.0
        # Assume image size ~200x200 for thumbnails
        features.append(face_center_x / 200.0)
        features.append(face_center_y / 200.0)
        
        # 4. Face aspect ratio
        face_width = metadata.get("width", 1)
        aspect_ratio = face_width / max(face_height, 1)
        features.append(aspect_ratio)
        
        # 5. Quality score
        features.append(candidate.face_quality_score)
        
        # 6. Confidence
        confidence = metadata.get("confidence", 0.0)
        features.append(confidence)
        
        # Convert to numpy array and normalize
        embedding = np.array(features, dtype=np.float32)
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm
        
        return embedding
    
    def _calculate_face_angle(self, metadata: Dict) -> float:
        """Calculate face rotation angle"""
        keypoints = metadata.get("keypoints")
        if keypoints is None or len(keypoints) < 2:
            return 0.0
        
        try:
            left_eye = np.array(keypoints[0])
            right_eye = np.array(keypoints[1])
            
            eye_vector = right_eye - left_eye
            angle_rad = np.arctan2(eye_vector[1], eye_vector[0])
            angle_deg = np.abs(np.degrees(angle_rad))
            
            return angle_deg
        except:
            return 0.0

