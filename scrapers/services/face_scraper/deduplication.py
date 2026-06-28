#!/usr/bin/env python3
"""
Thumbnail Deduplication
Uses shallow embeddings (112x112) to detect duplicates (similarity > 0.95)
"""

import numpy as np
from typing import List
from PIL import Image
import logging
from face_scraper.thumbnail_scraper import ThumbnailCandidate

logger = logging.getLogger(__name__)


class ThumbnailDeduplicator:
    """Deduplicate thumbnails using shallow embeddings"""
    
    def __init__(self):
        self.embedding_model = None
        self._load_model()
    
    def _load_model(self):
        """Load a lightweight embedding model for deduplication"""
        try:
            # Use a simple CNN or pre-trained model for shallow embeddings
            # For now, we'll use a simple feature extractor
            # In production, use MobileNet or similar lightweight model
            logger.info("[OK] Thumbnail deduplicator initialized")
        except Exception as e:
            logger.warning(f"[WARN] Deduplicator model not available: {e}")
    
    def generate_embedding(self, image: Image.Image) -> np.ndarray:
        """
        Generate shallow embedding from 112x112 thumbnail
        
        Args:
            image: PIL Image (already resized to 112x112)
        
        Returns:
            Embedding vector
        """
        try:
            # Convert to numpy array
            img_array = np.array(image).astype(np.float32) / 255.0
            
            # Simple feature extraction: histogram + texture
            # In production, use a lightweight CNN
            features = []
            
            # Color histogram (3 channels)
            for channel in range(3):
                hist = np.histogram(img_array[:, :, channel], bins=16, range=(0, 1))[0]
                features.extend(hist / np.sum(hist))  # Normalize
            
            # Texture features (gradient magnitude)
            gray = np.mean(img_array, axis=2)
            grad_x = np.gradient(gray, axis=1)
            grad_y = np.gradient(gray, axis=0)
            grad_mag = np.sqrt(grad_x**2 + grad_y**2)
            features.extend([
                np.mean(grad_mag),
                np.std(grad_mag),
                np.percentile(grad_mag, 25),
                np.percentile(grad_mag, 75)
            ])
            
            # Flatten and normalize
            embedding = np.array(features, dtype=np.float32)
            norm = np.linalg.norm(embedding)
            if norm > 0:
                embedding = embedding / norm
            
            return embedding
            
        except Exception as e:
            logger.debug(f"Error generating shallow embedding: {e}")
            return np.zeros(64, dtype=np.float32)  # Default empty embedding
    
    def remove_duplicates(
        self,
        candidates: List[ThumbnailCandidate],
        threshold: float = 0.95
    ) -> List[ThumbnailCandidate]:
        """
        Remove duplicate thumbnails based on cosine similarity
        
        Args:
            candidates: List of candidates with shallow embeddings
            threshold: Similarity threshold (above = duplicate)
        
        Returns:
            List of unique candidates
        """
        if len(candidates) == 0:
            return []
        
        unique_candidates = []
        seen_embeddings = []
        
        # Sort by quality score (best first)
        sorted_candidates = sorted(
            candidates,
            key=lambda c: c.face_quality_score,
            reverse=True
        )
        
        for candidate in sorted_candidates:
            if candidate.shallow_embedding is None:
                continue
            
            is_duplicate = False
            
            # Check similarity with all seen embeddings
            for seen_emb in seen_embeddings:
                similarity = np.dot(candidate.shallow_embedding, seen_emb)
                
                if similarity > threshold:
                    is_duplicate = True
                    break
            
            if not is_duplicate:
                unique_candidates.append(candidate)
                seen_embeddings.append(candidate.shallow_embedding)
        
        return unique_candidates

