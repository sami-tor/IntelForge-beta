#!/usr/bin/env python3
"""
Centroid Calculation per Identity
Averages 10-20 embeddings to create stable centroid
"""

import numpy as np
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)


class CentroidCalculator:
    """Calculate centroid (average embedding) per identity"""
    
    def __init__(self):
        pass
    
    def calculate_centroid(
        self,
        embeddings: List[np.ndarray],
        weights: Optional[List[float]] = None
    ) -> Optional[np.ndarray]:
        """
        Calculate centroid from multiple embeddings
        
        Args:
            embeddings: List of 512-dim normalized embeddings (10-20 per identity)
            weights: Optional weights for weighted average (by quality score)
        
        Returns:
            Centroid embedding (512-dim, normalized) or None
        """
        if len(embeddings) == 0:
            return None
        
        try:
            # Filter out None embeddings
            valid_embeddings = [emb for emb in embeddings if emb is not None]
            
            if len(valid_embeddings) == 0:
                return None
            
            # Convert to numpy array
            emb_array = np.array(valid_embeddings, dtype=np.float32)
            
            # Weighted average if weights provided
            if weights is not None and len(weights) == len(embeddings):
                valid_weights = [w for i, w in enumerate(weights) if embeddings[i] is not None]
                if len(valid_weights) == len(valid_embeddings):
                    # Normalize weights
                    weights_array = np.array(valid_weights, dtype=np.float32)
                    weights_array = weights_array / np.sum(weights_array)
                    
                    # Weighted average
                    centroid = np.average(emb_array, axis=0, weights=weights_array)
                else:
                    # Simple average
                    centroid = np.mean(emb_array, axis=0)
            else:
                # Simple average
                centroid = np.mean(emb_array, axis=0)
            
            # Normalize centroid
            norm = np.linalg.norm(centroid)
            if norm > 0:
                centroid = centroid / norm
            
            return centroid.astype(np.float32)
            
        except Exception as e:
            logger.error(f"Error calculating centroid: {e}")
            return None
    
    def calculate_centroid_with_quality(
        self,
        embeddings: List[np.ndarray],
        quality_scores: List[float]
    ) -> Optional[np.ndarray]:
        """
        Calculate weighted centroid using quality scores
        
        Args:
            embeddings: List of embeddings
            quality_scores: List of quality scores (0.0-1.0)
        
        Returns:
            Centroid embedding or None
        """
        return self.calculate_centroid(embeddings, weights=quality_scores)
    
    def calculate_centroid_stats(
        self,
        embeddings: List[np.ndarray]
    ) -> dict:
        """
        Calculate centroid and statistics
        
        Returns:
            Dict with centroid, std_dev, min_distance, max_distance
        """
        centroid = self.calculate_centroid(embeddings)
        
        if centroid is None:
            return {
                "centroid": None,
                "std_dev": None,
                "min_distance": None,
                "max_distance": None,
                "mean_distance": None
            }
        
        # Calculate distances from centroid
        valid_embeddings = [emb for emb in embeddings if emb is not None]
        distances = []
        
        for emb in valid_embeddings:
            dist = np.linalg.norm(emb - centroid)
            distances.append(dist)
        
        distances = np.array(distances)
        
        return {
            "centroid": centroid,
            "std_dev": float(np.std(distances)),
            "min_distance": float(np.min(distances)),
            "max_distance": float(np.max(distances)),
            "mean_distance": float(np.mean(distances)),
            "count": len(valid_embeddings)
        }

