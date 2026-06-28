#!/usr/bin/env python3
"""
Input validation and sanitization utilities for image processing
"""

import os
import re
import magic
import hashlib
from pathlib import Path
from typing import Dict, Any, Optional, Tuple
from PIL import Image
import logging

logger = logging.getLogger(__name__)

class ValidationError(Exception):
    """Raised when input validation fails"""
    pass

class ImageValidator:
    """Comprehensive image validation"""
    
    def __init__(self, max_file_size_mb: int = 100, max_dimensions: Tuple[int, int] = (4096, 4096)):
        self.max_file_size_mb = max_file_size_mb
        self.max_dimensions = max_dimensions
        self.supported_formats = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'}
        
    def validate_image_file(self, file_path: str) -> Dict[str, Any]:
        """
        Comprehensive validation of image file
        
        Returns:
            Dict with validation results and metadata
        """
        try:
            # Basic file existence check
            if not os.path.exists(file_path):
                raise ValidationError(f"File does not exist: {file_path}")
            
            # File size check
            file_size = os.path.getsize(file_path)
            max_size_bytes = self.max_file_size_mb * 1024 * 1024
            if file_size > max_size_bytes:
                raise ValidationError(f"File size {file_size / (1024*1024):.2f}MB exceeds maximum {self.max_file_size_mb}MB")
            
            # Path traversal protection
            file_path = os.path.abspath(file_path)
            if not self._is_safe_path(file_path):
                raise ValidationError(f"Unsafe file path: {file_path}")
            
            # File extension check
            file_ext = Path(file_path).suffix.lower()
            if file_ext not in self.supported_formats:
                raise ValidationError(f"Unsupported file format: {file_ext}")
            
            # MIME type verification
            mime_type = self._get_mime_type(file_path)
            if not self._is_supported_mime_type(mime_type):
                raise ValidationError(f"Unsupported MIME type: {mime_type}")
            
            # Image format verification with PIL
            try:
                with Image.open(file_path) as img:
                    # Check dimensions
                    width, height = img.size
                    if width > self.max_dimensions[0] or height > self.max_dimensions[1]:
                        raise ValidationError(f"Image dimensions {width}x{height} exceed maximum {self.max_dimensions}")
                    
                    # Check image mode
                    if img.mode not in ['RGB', 'RGBA', 'L', 'LA', 'P']:
                        raise ValidationError(f"Unsupported image mode: {img.mode}")
                    
                    # Verify image integrity
                    img.verify()
                    
                    # Re-open after verify (verify closes the file)
                    with Image.open(file_path) as img2:
                        format_type = img2.format
                        
            except Exception as e:
                raise ValidationError(f"Invalid image file: {str(e)}")
            
            # Generate file hash for deduplication
            file_hash = self._generate_file_hash(file_path)
            
            return {
                "valid": True,
                "file_path": file_path,
                "file_size": file_size,
                "dimensions": (width, height),
                "format": format_type,
                "mode": img.mode,
                "mime_type": mime_type,
                "file_hash": file_hash,
                "warnings": []
            }
            
        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Unexpected error during image validation: {e}")
            raise ValidationError(f"Image validation failed: {str(e)}")
    
    def _is_safe_path(self, file_path: str) -> bool:
        """Check if file path is safe (no path traversal)"""
        try:
            # Resolve to absolute path
            abs_path = os.path.abspath(file_path)
            
            # Check for path traversal patterns
            if ".." in file_path or file_path.startswith("/"):
                return False
            
            # Ensure path doesn't contain null bytes or other dangerous characters
            if "\x00" in file_path or any(ord(c) < 32 for c in file_path):
                return False
            
            return True
        except Exception:
            return False
    
    def _get_mime_type(self, file_path: str) -> str:
        """Get MIME type of file"""
        try:
            with open(file_path, 'rb') as f:
                file_magic = magic.from_buffer(f.read(2048), mime=True)
                return file_magic
        except Exception:
            return "application/octet-stream"
    
    def _is_supported_mime_type(self, mime_type: str) -> bool:
        """Check if MIME type is supported"""
        supported_mimes = {
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 
            'image/bmp', 'image/tiff', 'image/webp'
        }
        return mime_type in supported_mimes
    
    def _generate_file_hash(self, file_path: str) -> str:
        """Generate SHA256 hash of file"""
        try:
            hash_sha256 = hashlib.sha256()
            with open(file_path, 'rb') as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    hash_sha256.update(chunk)
            return hash_sha256.hexdigest()
        except Exception:
            return ""

class InputSanitizer:
    """Input sanitization utilities"""
    
    @staticmethod
    def sanitize_filename(filename: str) -> str:
        """Sanitize filename to prevent injection attacks"""
        # Remove path separators
        filename = filename.replace('/', '').replace('\\', '')
        
        # Remove null bytes
        filename = filename.replace('\x00', '')
        
        # Limit length
        if len(filename) > 255:
            filename = filename[:255]
        
        # Remove leading/trailing whitespace and dots
        filename = filename.strip(' .')
        
        # Ensure filename is not empty
        if not filename:
            filename = "unnamed_file"
        
        return filename
    
    @staticmethod
    def sanitize_path(path_str: str, base_directory: str) -> str:
        """Sanitize path to prevent directory traversal"""
        try:
            # Resolve to absolute path
            abs_base = os.path.abspath(base_directory)
            abs_path = os.path.abspath(os.path.join(abs_base, path_str))
            
            # Ensure path is within base directory
            if not abs_path.startswith(abs_base):
                raise ValidationError("Path traversal detected")
            
            return abs_path
        except Exception as e:
            raise ValidationError(f"Invalid path: {str(e)}")
    
    @staticmethod
    def sanitize_metadata(metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Sanitize metadata to prevent injection"""
        sanitized = {}
        
        for key, value in metadata.items():
            # Sanitize key
            clean_key = re.sub(r'[^a-zA-Z0-9_]', '', str(key))[:50]
            
            # Sanitize value based on type
            if isinstance(value, str):
                # Remove potential SQL injection patterns
                clean_value = re.sub(r'[\'";\\]', '', value)
                clean_value = clean_value[:1000]  # Limit length
                sanitized[clean_key] = clean_value
            elif isinstance(value, (int, float, bool)):
                sanitized[clean_key] = value
            elif isinstance(value, (list, tuple)):
                sanitized[clean_key] = [str(v)[:100] for v in value[:100]]  # Limit items and length
            else:
                sanitized[clean_key] = str(value)[:100]
        
        return sanitized

class RateLimiter:
    """Simple rate limiting for API calls"""
    
    def __init__(self, max_requests: int = 100, window_seconds: int = 3600):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: Dict[str, list] = {}
        self._lock = threading.Lock()
    
    def is_allowed(self, identifier: str) -> bool:
        """Check if request is allowed under rate limit"""
        with self._lock:
            now = time.time()
            
            # Clean old requests
            if identifier in self.requests:
                self.requests[identifier] = [
                    req_time for req_time in self.requests[identifier]
                    if now - req_time < self.window_seconds
                ]
            else:
                self.requests[identifier] = []
            
            # Check if under limit
            if len(self.requests[identifier]) >= self.max_requests:
                return False
            
            # Record request
            self.requests[identifier].append(now)
            return True
    
    def get_remaining_requests(self, identifier: str) -> int:
        """Get remaining requests for identifier"""
        with self._lock:
            if identifier not in self.requests:
                return self.max_requests
            
            now = time.time()
            recent_requests = [
                req_time for req_time in self.requests[identifier]
                if now - req_time < self.window_seconds
            ]
            
            return max(0, self.max_requests - len(recent_requests))

# Global validators
image_validator = ImageValidator()
input_sanitizer = InputSanitizer()
rate_limiter = RateLimiter()

def validate_and_sanitize_image(file_path: str) -> Dict[str, Any]:
    """
    Complete validation and sanitization pipeline for images
    
    Returns:
        Validated and sanitized image information
    """
    try:
        # Validate image
        validation_result = image_validator.validate_image_file(file_path)
        
        if not validation_result["valid"]:
            raise ValidationError("Image validation failed")
        
        # Sanitize metadata
        if "metadata" in validation_result:
            validation_result["metadata"] = input_sanitizer.sanitize_metadata(
                validation_result["metadata"]
            )
        
        logger.info(f"Image validation successful: {file_path}")
        return validation_result
        
    except ValidationError:
        raise
    except Exception as e:
        logger.error(f"Validation pipeline error: {e}")
        raise ValidationError(f"Validation pipeline failed: {str(e)}")