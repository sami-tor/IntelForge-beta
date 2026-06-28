"""
Face search engine - uses FAISS for fast candidate search,
then compares against all embeddings for best accuracy
"""

import numpy as np
from PIL import Image
from typing import List, Dict, Optional
from loguru import logger

from app.gpu_face import gpu_face
from app.faiss_index import faiss_index
from app.database import db, ThreadsUser, ThreadsFace


class SearchEngine:
    """Search for faces in the database with high accuracy"""

    def __init__(self):
        self.min_similarity = 0.25  # Minimum similarity for results
        self.candidate_multiplier = 3  # Get 3x more candidates from FAISS for re-ranking

    def search_by_image(self, image: Image.Image, top_k: int = 5) -> List[Dict]:
        """
        Search for similar faces by image

        Args:
            image: PIL Image containing a face
            top_k: Number of results to return

        Returns:
            List of search results with user info and similarity scores
        """
        logger.info("Searching for face in image...")

        # Extract embedding from image
        embedding = gpu_face.process_image(image)

        if embedding is None:
            logger.warning("No face detected in query image")
            return []

        return self.search_by_embedding(embedding, top_k)

    def search_by_embedding(self, query_embedding, top_k: int = 5) -> List[Dict]:
        """
        Search for similar faces by embedding with high accuracy

        Strategy:
        1. Use FAISS to get candidate users (fast, ~95% accurate)
        2. Re-rank by comparing against ALL embeddings per user (slow but ~99% accurate)
        3. Return best match per user

        Args:
            query_embedding: Face embedding vector
            top_k: Number of results to return

        Returns:
            List of search results with user info and similarity scores
        """
        # Step 1: Get candidates from FAISS (search centroids)
        num_candidates = top_k * self.candidate_multiplier
        faiss_results = faiss_index.search(query_embedding, num_candidates)

        if not faiss_results:
            logger.warning("No results found in FAISS index")
            return []

        logger.info(f"FAISS returned {len(faiss_results)} candidates")

        # Normalize query embedding for cosine similarity
        query_norm = query_embedding / np.linalg.norm(query_embedding)

        # Step 2: Re-rank by comparing against ALL embeddings
        results = []

        with db.get_session() as session:
            for user_id, centroid_similarity in faiss_results:
                user = session.query(ThreadsUser).filter(ThreadsUser.id == user_id).first()
                if not user:
                    continue

                # Get all face embeddings for this user
                faces = session.query(ThreadsFace).filter(
                    ThreadsFace.user_id == user_id
                ).all()

                # Find BEST match across all embeddings
                best_similarity = centroid_similarity  # Default to centroid similarity

                if faces:
                    for face in faces:
                        face_embedding = face.get_embedding()
                        if face_embedding is not None:
                            # Calculate cosine similarity
                            face_norm = face_embedding / np.linalg.norm(face_embedding)
                            similarity = float(np.dot(query_norm, face_norm))
                            if similarity > best_similarity:
                                best_similarity = similarity

                # Filter by minimum similarity
                if best_similarity < self.min_similarity:
                    continue

                results.append({
                    'user_id': user.id,
                    'username': user.username,
                    'threads_id': user.threads_id,
                    'full_name': user.full_name,
                    'bio': user.bio,
                    'profile_photo': user.profile_photo,
                    'face_count': user.face_count,
                    'similarity': best_similarity,
                    'centroid_similarity': centroid_similarity,
                    'threads_url': f"https://www.threads.net/@{user.username}"
                })

        # Sort by best similarity (descending)
        results.sort(key=lambda x: x['similarity'], reverse=True)

        # Return top_k results
        results = results[:top_k]

        logger.info(f"Found {len(results)} matching users (re-ranked)")
        return results

    def format_result_text(self, result: Dict) -> str:
        """
        Format search result for display

        Args:
            result: Search result dictionary

        Returns:
            Formatted text string
        """
        text = f"Match found:\n"
        text += f"@{result['username']}\n"

        if result.get('full_name'):
            text += f"Name: {result['full_name']}\n"

        text += f"Similarity: {result['similarity']:.1%}\n"
        text += f"Face embeddings: {result['face_count']}\n"
        text += f"{result['threads_url']}"

        return text


# Global search engine instance
search_engine = SearchEngine()
