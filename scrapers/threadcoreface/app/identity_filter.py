"""
Identity filter using cosine similarity
"""

import numpy as np
from typing import List, Optional, Tuple
from loguru import logger

from app.config import Config
from app.gpu_face import gpu_face


class IdentityFilter:
    """Filter faces by identity using root embedding"""

    def __init__(self):
        self.threshold = Config.FACE_SIMILARITY_THRESHOLD

    def filter_faces(self, embeddings: List[np.ndarray]) -> Tuple[List[int], np.ndarray, List[float]]:
        """
        Filter embeddings by identity

        Phase 1: First embedding is root
        Phase 2: Compare all others to root, accept if similarity >= threshold
        Phase 3: Return accepted indices and similarities

        Returns:
            accepted_indices: list of indices that passed the filter
            root_embedding: the root embedding used for comparison
            similarities: similarity scores for accepted embeddings
        """
        if not embeddings or len(embeddings) == 0:
            logger.warning("No embeddings to filter")
            return [], None, []

        # Phase 1: First embedding is root
        root_embedding = embeddings[0]
        accepted_indices = [0]  # Root is always accepted
        similarities = [1.0]  # Root has perfect similarity to itself

        logger.info(f"Root embedding set (index 0)")

        # Phase 2: Compare remaining embeddings to root
        for i in range(1, len(embeddings)):
            embedding = embeddings[i]
            similarity = gpu_face.cosine_similarity(root_embedding, embedding)

            logger.debug(f"Embedding {i}: similarity = {similarity:.3f}")

            if similarity >= self.threshold:
                accepted_indices.append(i)
                similarities.append(similarity)
                logger.info(f"Accepted embedding {i} (similarity: {similarity:.3f})")
            else:
                logger.info(f"Rejected embedding {i} (similarity: {similarity:.3f} < {self.threshold})")

        logger.info(f"Identity filter: {len(accepted_indices)}/{len(embeddings)} faces accepted")

        return accepted_indices, root_embedding, similarities

    def filter_by_root(self, embedding: np.ndarray, root_embedding: np.ndarray) -> Tuple[bool, float]:
        """
        Check if embedding matches root identity

        Returns:
            accepted: True if similarity >= threshold
            similarity: similarity score
        """
        if root_embedding is None:
            return False, 0.0

        similarity = gpu_face.cosine_similarity(root_embedding, embedding)

        accepted = similarity >= self.threshold

        return accepted, similarity


# Global identity filter instance
identity_filter = IdentityFilter()
