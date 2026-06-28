#!/usr/bin/env python3
"""
Configuration management for image indexer
"""

import os
from typing import Dict, Any, Optional
from dataclasses import dataclass
from pathlib import Path

@dataclass
class ModelConfig:
    """Model configuration settings"""
    device: str = "cuda" if os.getenv("CUDA_VISIBLE_DEVICES") else "cpu"
    batch_size: int = 8
    max_image_size: int = 4096
    max_concurrent_processes: int = 4
    memory_limit_gb: float = 8.0
    
@dataclass
class ProcessingConfig:
    """Image processing configuration"""
    thumbnail_size: tuple = (200, 200)
    webp_quality: int = 90
    jpeg_quality: int = 85
    max_file_size_mb: int = 100
    supported_formats: tuple = ("jpg", "jpeg", "png", "gif", "bmp", "tiff", "webp")
    
@dataclass
class SearchConfig:
    """Search configuration"""
    max_results: int = 100
    similarity_threshold: float = 0.7
    timeout_seconds: int = 300
    retry_attempts: int = 3
    
@dataclass
class StorageConfig:
    """Storage configuration"""
    thumbnails_dir: str = "/data/thumbnails"
    webp_dir: str = "/data/webp"
    temp_dir: str = "/tmp/image_processing"
    cleanup_interval_hours: int = 24
    max_temp_files: int = 1000

class ConfigManager:
    """Centralized configuration manager"""
    
    def __init__(self):
        self.model = ModelConfig()
        self.processing = ProcessingConfig()
        self.search = SearchConfig()
        self.storage = StorageConfig()
        self._load_from_env()
        self._ensure_directories()
    
    def _load_from_env(self):
        """Load configuration from environment variables"""
        # Model settings
        self.model.device = os.getenv("MODEL_DEVICE", self.model.device)
        self.model.batch_size = int(os.getenv("BATCH_SIZE", self.model.batch_size))
        self.model.max_image_size = int(os.getenv("MAX_IMAGE_SIZE", self.model.max_image_size))
        self.model.max_concurrent_processes = int(os.getenv("MAX_CONCURRENT_PROCESSES", self.model.max_concurrent_processes))
        self.model.memory_limit_gb = float(os.getenv("MEMORY_LIMIT_GB", self.model.memory_limit_gb))
        
        # Processing settings
        self.processing.max_file_size_mb = int(os.getenv("MAX_FILE_SIZE_MB", self.processing.max_file_size_mb))
        self.processing.webp_quality = int(os.getenv("WEBP_QUALITY", self.processing.webp_quality))
        self.processing.jpeg_quality = int(os.getenv("JPEG_QUALITY", self.processing.jpeg_quality))
        
        # Search settings
        self.search.max_results = int(os.getenv("MAX_SEARCH_RESULTS", self.search.max_results))
        self.search.similarity_threshold = float(os.getenv("SIMILARITY_THRESHOLD", self.search.similarity_threshold))
        self.search.timeout_seconds = int(os.getenv("SEARCH_TIMEOUT_SECONDS", self.search.timeout_seconds))
        
        # Storage settings
        self.storage.thumbnails_dir = os.getenv("THUMBNAILS_DIR", self.storage.thumbnails_dir)
        self.storage.webp_dir = os.getenv("WEBP_DIR", self.storage.webp_dir)
        self.storage.temp_dir = os.getenv("TEMP_DIR", self.storage.temp_dir)
        self.storage.cleanup_interval_hours = int(os.getenv("CLEANUP_INTERVAL_HOURS", self.storage.cleanup_interval_hours))
    
    def _ensure_directories(self):
        """Ensure required directories exist"""
        directories = [
            self.storage.thumbnails_dir,
            self.storage.webp_dir,
            self.storage.temp_dir
        ]
        
        for directory in directories:
            Path(directory).mkdir(parents=True, exist_ok=True)
    
    def get(self, section: str, key: str, default: Any = None) -> Any:
        """Get configuration value"""
        section_obj = getattr(self, section, None)
        if section_obj:
            return getattr(section_obj, key, default)
        return default
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert configuration to dictionary"""
        return {
            "model": self.model.__dict__,
            "processing": self.processing.__dict__,
            "search": self.search.__dict__,
            "storage": self.storage.__dict__
        }

# Global configuration instance
config = ConfigManager()