"""
Centroid builder for user face embeddings
"""

import numpy as np
from typing import List
from loguru import logger


class CentroidBuilder:
    """Build centroid from accepted face embeddings"""

    def build_centroid(self, embeddings: List[np.ndarray]) -> np.ndarray:
        """
        Build centroid from list of embeddings
        Centroid = mean of all embeddings, then normalized

        Args:
            embeddings: List of face embeddings

        Returns:
            centroid: Normalized centroid embedding
        """
        if not embeddings or len(embeddings) == 0:
            logger.error("Cannot build centroid from empty embeddings")
            return None

        # Stack embeddings into matrix
        embeddings_matrix = np.vstack(embeddings)

        # Calculate mean
        centroid = np.mean(embeddings_matrix, axis=0)

        # Normalize centroid
        centroid_norm = np.linalg.norm(centroid)
        if centroid_norm > 0:
            centroid = centroid / centroid_norm

        logger.info(f"Built centroid from {len(embeddings)} embeddings")

        return centroid.astype(np.float32)

    def update_centroid(self, existing_centroid: np.ndarray, new_embeddings: List[np.ndarray],
                       existing_count: int) -> np.ndarray:
        """
        Update existing centroid with new embeddings

        Args:
            existing_centroid: Current centroid
            new_embeddings: New embeddings to include
            existing_count: Number of embeddings used to build existing centroid

        Returns:
            updated_centroid: New centroid including new embeddings
        """
        if existing_centroid is None or len(new_embeddings) == 0:
            return existing_centroid

        # Convert centroid back to sum
        existing_sum = existing_centroid * existing_count

        # Add new embeddings
        new_sum = existing_sum + np.sum(new_embeddings, axis=0)
        new_count = existing_count + len(new_embeddings)

        # Calculate new mean
        new_centroid = new_sum / new_count

        # Normalize
        centroid_norm = np.linalg.norm(new_centroid)
        if centroid_norm > 0:
            new_centroid = new_centroid / centroid_norm

        logger.info(f"Updated centroid with {len(new_embeddings)} new embeddings (total: {new_count})")

        return new_centroid.astype(np.float32)


# Global centroid builder instance
centroid_builder = CentroidBuilder()
