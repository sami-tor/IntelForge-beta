#!/usr/bin/env python3
"""
Robust error handling and fallback mechanisms
"""

import logging
import traceback
import time
from typing import Any, Callable, Optional, Dict, List
from functools import wraps
from enum import Enum
import threading
from dataclasses import dataclass
from datetime import datetime

logger = logging.getLogger(__name__)

class ErrorSeverity(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class ErrorCategory(Enum):
    MODEL_LOADING = "model_loading"
    IMAGE_PROCESSING = "image_processing"
    EMBEDDING_GENERATION = "embedding_generation"
    STORAGE = "storage"
    NETWORK = "network"
    VALIDATION = "validation"
    UNKNOWN = "unknown"

@dataclass
class ErrorInfo:
    """Structured error information"""
    error_type: str
    message: str
    severity: ErrorSeverity
    category: ErrorCategory
    timestamp: datetime
    context: Dict[str, Any]
    traceback: str
    recovery_action: Optional[str] = None

class ErrorHandler:
    """Centralized error handling with recovery mechanisms"""
    
    def __init__(self):
        self.error_log: List[ErrorInfo] = []
        self.error_counts: Dict[str, int] = {}
        self.circuit_breakers: Dict[str, 'CircuitBreaker'] = {}
        self._lock = threading.Lock()
    
    def log_error(self, error: Exception, context: Dict[str, Any] = None, 
                  severity: ErrorSeverity = ErrorSeverity.MEDIUM,
                  category: ErrorCategory = ErrorCategory.UNKNOWN) -> ErrorInfo:
        """Log error with structured information"""
        
        error_info = ErrorInfo(
            error_type=type(error).__name__,
            message=str(error),
            severity=severity,
            category=category,
            timestamp=datetime.now(),
            context=context or {},
            traceback=traceback.format_exc()
        )
        
        with self._lock:
            self.error_log.append(error_info)
            error_key = f"{category.value}:{type(error).__name__}"
            self.error_counts[error_key] = self.error_counts.get(error_key, 0) + 1
        
        # Log to standard logger
        log_message = f"[{category.value.upper()}] {type(error).__name__}: {error}"
        if context:
            log_message += f" | Context: {context}"
        
        if severity == ErrorSeverity.CRITICAL:
            logger.critical(log_message, exc_info=True)
        elif severity == ErrorSeverity.HIGH:
            logger.error(log_message, exc_info=True)
        else:
            logger.warning(log_message, exc_info=True)
        
        return error_info
    
    def get_error_stats(self) -> Dict[str, Any]:
        """Get error statistics"""
        with self._lock:
            return {
                "total_errors": len(self.error_log),
                "error_counts": self.error_counts.copy(),
                "recent_errors": [err.__dict__ for err in self.error_log[-10:]],
                "circuit_breaker_status": {
                    name: cb.is_open() for name, cb in self.circuit_breakers.items()
                }
            }
    
    def create_circuit_breaker(self, name: str, failure_threshold: int = 5, 
                              timeout_seconds: int = 60) -> 'CircuitBreaker':
        """Create a circuit breaker for error-prone operations"""
        with self._lock:
            if name not in self.circuit_breakers:
                self.circuit_breakers[name] = CircuitBreaker(name, failure_threshold, timeout_seconds)
            return self.circuit_breakers[name]

class CircuitBreaker:
    """Circuit breaker pattern for handling cascading failures"""
    
    def __init__(self, name: str, failure_threshold: int = 5, timeout_seconds: int = 60):
        self.name = name
        self.failure_threshold = failure_threshold
        self.timeout_seconds = timeout_seconds
        self.failure_count = 0
        self.last_failure_time = 0
        self.state = "closed"  # closed, open, half-open
        self._lock = threading.Lock()
    
    def is_open(self) -> bool:
        """Check if circuit breaker is open"""
        with self._lock:
            if self.state == "open":
                if time.time() - self.last_failure_time > self.timeout_seconds:
                    self.state = "half-open"
                    return False
                return True
            return False
    
    def record_success(self):
        """Record successful operation"""
        with self._lock:
            self.failure_count = 0
            self.state = "closed"
    
    def record_failure(self):
        """Record failed operation"""
        with self._lock:
            self.failure_count += 1
            self.last_failure_time = time.time()
            
            if self.failure_count >= self.failure_threshold:
                self.state = "open"
                logger.warning(f"Circuit breaker '{self.name}' opened after {self.failure_count} failures")
    
    def __call__(self, func: Callable) -> Callable:
        """Decorator for circuit breaker pattern"""
        @wraps(func)
        def wrapper(*args, **kwargs):
            if self.is_open():
                raise Exception(f"Circuit breaker '{self.name}' is open")
            
            try:
                result = func(*args, **kwargs)
                self.record_success()
                return result
            except Exception as e:
                self.record_failure()
                raise
        
        return wrapper

def with_error_handling(severity: ErrorSeverity = ErrorSeverity.MEDIUM,
                       category: ErrorCategory = ErrorCategory.UNKNOWN,
                       fallback_value: Any = None,
                       max_retries: int = 0,
                       retry_delay: float = 1.0):
    """
    Decorator for robust error handling with retries and fallbacks
    
    Args:
        severity: Error severity level
        category: Error category for grouping
        fallback_value: Value to return on failure
        max_retries: Maximum number of retry attempts
        retry_delay: Delay between retries in seconds
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            error_handler = get_error_handler()
            
            for attempt in range(max_retries + 1):
                try:
                    result = func(*args, **kwargs)
                    return result
                    
                except Exception as e:
                    context = {
                        "function": func.__name__,
                        "args": str(args),
                        "kwargs": str(kwargs),
                        "attempt": attempt + 1,
                        "max_retries": max_retries
                    }
                    
                    error_info = error_handler.log_error(e, context, severity, category)
                    
                    # If this is the last attempt, handle fallback
                    if attempt == max_retries:
                        if fallback_value is not None:
                            logger.info(f"Using fallback value for {func.__name__} after {max_retries} retries")
                            return fallback_value
                        else:
                            # Re-raise the original exception
                            raise
                    
                    # Wait before retry
                    if retry_delay > 0:
                        time.sleep(retry_delay * (2 ** attempt))  # Exponential backoff
            
            # This should never be reached, but just in case
            return fallback_value
        
        return wrapper
    return decorator

class FallbackChain:
    """Chain of fallback strategies for critical operations"""
    
    def __init__(self, strategies: List[Callable], strategy_names: List[str] = None):
        self.strategies = strategies
        self.strategy_names = strategy_names or [f"strategy_{i}" for i in range(len(strategies))]
    
    def execute(self, *args, **kwargs):
        """Execute strategies in order until one succeeds"""
        error_handler = get_error_handler()
        
        for i, (strategy, name) in enumerate(zip(self.strategies, self.strategy_names)):
            try:
                result = strategy(*args, **kwargs)
                if i > 0:
                    logger.info(f"Fallback strategy '{name}' succeeded after {i} failures")
                return result
            except Exception as e:
                context = {
                    "strategy": name,
                    "strategy_index": i,
                    "total_strategies": len(self.strategies)
                }
                
                # Only log as error if this is the last strategy
                severity = ErrorSeverity.HIGH if i == len(self.strategies) - 1 else ErrorSeverity.MEDIUM
                error_handler.log_error(e, context, severity, ErrorCategory.UNKNOWN)
        
        # All strategies failed
        raise Exception(f"All fallback strategies failed: {self.strategy_names}")

# Global error handler instance
_error_handler = None
_error_handler_lock = threading.Lock()

def get_error_handler() -> ErrorHandler:
    """Get global error handler instance"""
    global _error_handler
    
    if _error_handler is None:
        with _error_handler_lock:
            if _error_handler is None:
                _error_handler = ErrorHandler()
    
    return _error_handler

# Specific error handling functions for common scenarios

@with_error_handling(
    severity=ErrorSeverity.MEDIUM,
    category=ErrorCategory.MODEL_LOADING,
    fallback_value=None,
    max_retries=2,
    retry_delay=5.0
)
def safe_model_load(load_func: Callable, *args, **kwargs):
    """Safely load a model with retries"""
    return load_func(*args, **kwargs)

@with_error_handling(
    severity=ErrorSeverity.LOW,
    category=ErrorCategory.IMAGE_PROCESSING,
    fallback_value="",
    max_retries=1,
    retry_delay=1.0
)
def safe_image_text_extraction(image_path: str):
    """Safely extract text from image with fallback"""
    # Try multiple OCR methods
    strategies = [
        lambda: extract_text_easyocr(image_path),
        lambda: extract_text_tesseract(image_path),
        lambda: ""  # Final fallback - empty string
    ]
    
    fallback_chain = FallbackChain(strategies, ["easyocr", "tesseract", "empty"])
    return fallback_chain.execute()

@with_error_handling(
    severity=ErrorSeverity.MEDIUM,
    category=ErrorCategory.EMBEDDING_GENERATION,
    fallback_value=None,
    max_retries=3,
    retry_delay=2.0
)
def safe_embedding_generation(model, image, embedding_type: str):
    """Safely generate embeddings with fallback strategies"""
    try:
        return model.generate(image)
    except Exception as e:
        logger.warning(f"Primary embedding generation failed for {embedding_type}: {e}")
        
        # Try batch generation if available
        if hasattr(model, 'generate_batch'):
            try:
                results = model.generate_batch([image])
                return results[0] if results else None
            except Exception as batch_error:
                logger.warning(f"Batch embedding generation also failed: {batch_error}")
        
        # Re-raise original exception to trigger retry mechanism
        raise