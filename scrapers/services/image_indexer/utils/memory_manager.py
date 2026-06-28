#!/usr/bin/env python3
"""
Memory management and model pooling for efficient resource usage
"""

import gc
import psutil
import torch
import logging
from typing import Dict, Any, Optional, Type
from contextlib import contextmanager
import threading
import time
from dataclasses import dataclass
import weakref

logger = logging.getLogger(__name__)

@dataclass
class ModelInfo:
    """Information about a loaded model"""
    model: Any
    memory_usage_mb: float
    last_accessed: float
    access_count: int
    model_type: str

class MemoryManager:
    """Centralized memory management for ML models"""
    
    def __init__(self, max_memory_gb: float = 8.0):
        self.max_memory_gb = max_memory_gb
        self.models: Dict[str, ModelInfo] = {}
        self.model_pool: Dict[str, Any] = {}
        self._lock = threading.Lock()
        self._cleanup_thread = None
        self._stop_cleanup = threading.Event()
        self.start_cleanup_thread()
    
    def start_cleanup_thread(self):
        """Start background cleanup thread"""
        if self._cleanup_thread is None:
            self._cleanup_thread = threading.Thread(target=self._cleanup_loop, daemon=True)
            self._cleanup_thread.start()
    
    def stop_cleanup_thread(self):
        """Stop background cleanup thread"""
        self._stop_cleanup.set()
        if self._cleanup_thread:
            self._cleanup_thread.join()
    
    def _cleanup_loop(self):
        """Background cleanup loop"""
        while not self._stop_cleanup.is_set():
            try:
                current_memory = self.get_current_memory_usage_gb()
                if current_memory > self.max_memory_gb * 0.9:  # 90% threshold
                    self._cleanup_least_used_models()
                time.sleep(60)  # Check every minute
            except Exception as e:
                logger.error(f"Error in cleanup loop: {e}")
                time.sleep(60)
    
    def get_current_memory_usage_gb(self) -> float:
        """Get current memory usage in GB"""
        process = psutil.Process()
        return process.memory_info().rss / (1024 ** 3)
    
    def _cleanup_least_used_models(self):
        """Cleanup least recently used models"""
        with self._lock:
            # Sort by last accessed time
            sorted_models = sorted(self.models.items(), key=lambda x: x[1].last_accessed)
            
            current_memory = self.get_current_memory_usage_gb()
            removed_count = 0
            
            for model_key, model_info in sorted_models:
                if current_memory < self.max_memory_gb * 0.8:  # Target 80%
                    break
                
                # Remove model
                del self.models[model_key]
                if model_key in self.model_pool:
                    del self.model_pool[model_key]
                
                # Force garbage collection
                if hasattr(model_info.model, 'cpu'):
                    model_info.model.cpu()
                elif hasattr(model_info.model, 'clear'):
                    model_info.model.clear()
                
                del model_info.model
                gc.collect()
                
                current_memory = self.get_current_memory_usage_gb()
                removed_count += 1
                logger.info(f"Removed model {model_key} to free memory")
            
            if removed_count > 0:
                torch.cuda.empty_cache() if torch.cuda.is_available() else None
                logger.info(f"Cleaned up {removed_count} models, memory: {current_memory:.2f}GB")
    
    def register_model(self, model_key: str, model: Any, model_type: str = "unknown"):
        """Register a model with the manager"""
        with self._lock:
            memory_usage = self._estimate_model_memory(model)
            
            self.models[model_key] = ModelInfo(
                model=model,
                memory_usage_mb=memory_usage,
                last_accessed=time.time(),
                access_count=0,
                model_type=model_type
            )
            self.model_pool[model_key] = model
            
            logger.info(f"Registered model {model_key} ({model_type}), estimated memory: {memory_usage:.2f}MB")
    
    def get_model(self, model_key: str) -> Optional[Any]:
        """Get a model from the pool"""
        with self._lock:
            if model_key in self.models:
                self.models[model_key].last_accessed = time.time()
                self.models[model_key].access_count += 1
                return self.models[model_key].model
            return None
    
    def _estimate_model_memory(self, model: Any) -> float:
        """Estimate model memory usage in MB"""
        try:
            if hasattr(model, 'parameters'):
                # PyTorch model
                param_count = sum(p.numel() for p in model.parameters())
                return param_count * 4 / (1024 ** 2)  # Assume float32
            elif hasattr(model, 'get_memory_usage'):
                # Custom model with memory reporting
                return model.get_memory_usage() / (1024 ** 2)
            else:
                # Fallback: estimate based on object size
                return 500.0  # Default 500MB estimate
        except Exception:
            return 500.0  # Default estimate
    
    def force_cleanup(self):
        """Force immediate cleanup of all models"""
        with self._lock:
            for model_key in list(self.models.keys()):
                model_info = self.models[model_key]
                
                # Try to move to CPU/clear memory
                if hasattr(model_info.model, 'cpu'):
                    model_info.model.cpu()
                elif hasattr(model_info.model, 'clear'):
                    model_info.model.clear()
                
                del model_info.model
            
            self.models.clear()
            self.model_pool.clear()
            gc.collect()
            torch.cuda.empty_cache() if torch.cuda.is_available() else None
            
            logger.info("Forced cleanup of all models")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get memory manager statistics"""
        with self._lock:
            total_memory_mb = sum(info.memory_usage_mb for info in self.models.values())
            return {
                "loaded_models": len(self.models),
                "total_model_memory_mb": total_memory_memory_mb,
                "current_memory_gb": self.get_current_memory_usage_gb(),
                "max_memory_gb": self.max_memory_gb,
                "models": {
                    key: {
                        "type": info.model_type,
                        "memory_mb": info.memory_usage_mb,
                        "last_accessed": info.last_accessed,
                        "access_count": info.access_count
                    }
                    for key, info in self.models.items()
                }
            }

# Global memory manager instance
memory_manager = MemoryManager()

@contextmanager
def model_context(model_key: str, model_type: str = "unknown"):
    """Context manager for safe model usage"""
    model = memory_manager.get_model(model_key)
    if model is None:
        raise RuntimeError(f"Model {model_key} not found in memory manager")
    
    try:
        yield model
    finally:
        # Model remains in memory for reuse
        pass

def cleanup_on_shutdown():
    """Cleanup function to call on application shutdown"""
    memory_manager.stop_cleanup_thread()
    memory_manager.force_cleanup()
    logger.info("Memory manager shutdown complete")