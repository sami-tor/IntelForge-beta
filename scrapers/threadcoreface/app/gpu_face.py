"""
GPU-accelerated face detection and recognition using InsightFace
"""

import numpy as np
import cv2
from PIL import Image
from typing import Optional, List, Tuple
from loguru import logger
import insightface
from insightface.app import FaceAnalysis

from app.config import Config


class GPUFacePipeline:
    """Face detection and embedding extraction using GPU"""

    def __init__(self):
        self.use_gpu = Config.USE_GPU
        self.gpu_id = Config.GPU_ID
        self.app = None
        self.model = None
        self._initialize()

    def _initialize(self):
        """Initialize InsightFace models on GPU"""
        try:
            logger.info("Initializing InsightFace on GPU...")

            # Initialize FaceAnalysis app
            ctx_id = self.gpu_id if self.use_gpu else -1

            self.app = FaceAnalysis(
                name='buffalo_l',
                providers=['CUDAExecutionProvider', 'CPUExecutionProvider'] if self.use_gpu else ['CPUExecutionProvider']
            )

            self.app.prepare(ctx_id=ctx_id, det_size=(640, 640))

            logger.info(f"InsightFace initialized successfully (GPU: {self.use_gpu})")

        except Exception as e:
            logger.error(f"Failed to initialize InsightFace: {e}")
            raise

    def detect_faces(self, image: Image.Image) -> List:
        """
        Detect faces in image
        Returns list of face objects
        """
        try:
            # Convert PIL to numpy array (RGB -> BGR for cv2)
            img_array = np.array(image)
            img_bgr = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)

            # Detect faces
            faces = self.app.get(img_bgr)

            logger.debug(f"Detected {len(faces)} faces")
            return faces

        except Exception as e:
            logger.error(f"Face detection failed: {e}")
            return []

    def extract_embedding(self, face) -> Optional[np.ndarray]:
        """
        Extract embedding from face object
        Returns normalized embedding vector (512-dim for buffalo_l)
        """
        try:
            embedding = face.normed_embedding
            return embedding.astype(np.float32)

        except Exception as e:
            logger.error(f"Embedding extraction failed: {e}")
            return None

    def detect_and_embed(self, image: Image.Image) -> Optional[Tuple[List, List[np.ndarray]]]:
        """
        Detect faces and extract embeddings
        Returns (faces, embeddings) or None
        """
        faces = self.detect_faces(image)

        if not faces:
            return None

        embeddings = []
        for face in faces:
            emb = self.extract_embedding(face)
            if emb is not None:
                embeddings.append(emb)

        if not embeddings:
            return None

        return faces, embeddings

    def process_image(self, image: Image.Image) -> Optional[np.ndarray]:
        """
        Process single image and return first face embedding
        Returns embedding or None
        """
        result = self.detect_and_embed(image)

        if result is None:
            return None

        faces, embeddings = result

        if len(embeddings) == 0:
            return None

        # Return first face embedding
        return embeddings[0]

    def cosine_similarity(self, emb1: np.ndarray, emb2: np.ndarray) -> float:
        """
        Calculate cosine similarity between two embeddings
        Returns similarity score (0-1)
        """
        try:
            # Embeddings from InsightFace are already normalized
            similarity = np.dot(emb1, emb2)
            return float(similarity)

        except Exception as e:
            logger.error(f"Similarity calculation failed: {e}")
            return 0.0


# Global GPU face pipeline instance
gpu_face = GPUFacePipeline()
