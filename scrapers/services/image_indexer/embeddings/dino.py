#!/usr/bin/env python3
"""
DINOv2 Embedding Generator (768-dim) with memory management
"""

import torch
from typing import Optional
from PIL import Image
from transformers import AutoImageProcessor, Dinov2Model
import logging
from ..utils.memory_manager import memory_manager
from ..utils.error_handler import with_error_handling, ErrorSeverity, ErrorCategory

logger = logging.getLogger(__name__)

class DINOv2Embedder:
    """DINOv2 model for fine-grained image embeddings with memory management"""
    
    def __init__(self):
        self.processor = None
        self.model = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model_key = "dinov2_embedder"
        self._load_model()
    
    def _load_model(self):
        """Load DINOv2 model with memory management"""
        try:
            # Check if model is already loaded in memory manager
            existing_model = memory_manager.get_model(self.model_key)
            if existing_model:
                logger.info("Using existing DINOv2 model from memory manager")
                self.processor = existing_model.processor
                self.model = existing_model.model
                self.device = existing_model.device
                return
            
            logger.info("[INFO] Loading DINOv2 model...")
            model_name = "facebook/dinov2-base"
            self.processor = AutoImageProcessor.from_pretrained(model_name)
            self.model = Dinov2Model.from_pretrained(model_name)
            self.model.to(self.device)
            self.model.eval()
            
            # Register with memory manager
            memory_manager.register_model(self.model_key, self, "dinov2")
            
            logger.info(f"[OK] DINOv2 model loaded on {self.device}")
        except Exception as e:
            logger.error(f"[WARN] Failed to load DINOv2: {e}")
            self.processor = None
            self.model = None
    
    def is_available(self) -> bool:
        """Check if model is loaded"""
        return self.processor is not None and self.model is not None
    
    @with_error_handling(
        severity=ErrorSeverity.MEDIUM,
        category=ErrorCategory.EMBEDDING_GENERATION,
        fallback_value=None,
        max_retries=2,
        retry_delay=1.0
    )
    def generate(self, image: Image.Image) -> Optional[torch.Tensor]:
        """
        Generate DINOv2 embedding (768-dim)
        Returns normalized embedding tensor
        """
        if not self.is_available():
            logger.warning("DINOv2 model not available")
            return None
        
        # Validate input
        if not isinstance(image, Image.Image):
            logger.error("Invalid image input type")
            return None
        
        try:
            # Process image
            inputs = self.processor(images=image, return_tensors="pt")
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            
            # Generate embedding
            with torch.no_grad():
                outputs = self.model(**inputs).last_hidden_state
                # Global average pooling
                outputs = outputs.mean(dim=1)
                # Normalize
                outputs = outputs / outputs.norm(dim=-1, keepdim=True)
            
            # Return CPU tensor
            result = outputs.cpu().squeeze(0)
            logger.debug(f"Generated DINOv2 embedding: {result.shape}")
            return result
            
        except Exception as e:
            logger.error(f"[ERROR] Error generating DINOv2 embedding: {e}")
            raise  # Let decorator handle retry and fallback
    
    @with_error_handling(
        severity=ErrorSeverity.MEDIUM,
        category=ErrorCategory.EMBEDDING_GENERATION,
        fallback_value=[],
        max_retries=1,
        retry_delay=0.5
    )
    def generate_batch(self, images: list) -> list:
        """Generate embeddings for multiple images"""
        if not self.is_available():
            logger.warning("DINOv2 model not available for batch processing")
            return []
        
        if not images:
            return []
        
        try:
            # Validate inputs
            valid_images = [img for img in images if isinstance(img, Image.Image)]
            if len(valid_images) != len(images):
                logger.warning(f"Filtered {len(images) - len(valid_images)} invalid images")
            
            if not valid_images:
                return []
            
            # Process all images
            inputs = self.processor(images=valid_images, return_tensors="pt", padding=True)
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            
            # Generate embeddings
            with torch.no_grad():
                outputs = self.model(**inputs).last_hidden_state
                # Global average pooling
                outputs = outputs.mean(dim=1)
                # Normalize
                outputs = outputs / outputs.norm(dim=-1, keepdim=True)
            
            # Return list of CPU tensors
            results = [outputs[i].cpu() for i in range(outputs.shape[0])]
            logger.debug(f"Generated {len(results)} DINOv2 embeddings from {len(valid_images)} images")
            return results
            
        except Exception as e:
            logger.error(f"[ERROR] Error generating DINOv2 batch embeddings: {e}")
            raise  # Let decorator handle retry and fallback
    
    def cleanup(self):
        """Clean up model resources"""
        try:
            if hasattr(self.model, 'cpu'):
                self.model.cpu()
            self.processor = None
            self.model = None
            logger.info("DINOv2 model cleaned up")
        except Exception as e:
            logger.error(f"Error cleaning up DINOv2 model: {e}")
    
    def __del__(self):
        """Destructor to ensure cleanup"""
        try:
            self.cleanup()
        except Exception:
            pass

