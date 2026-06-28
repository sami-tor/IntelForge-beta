#!/usr/bin/env python3
"""
Monitoring and metrics system for image processing
"""

import time
import threading
import logging
import psutil
import json
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from collections import defaultdict, deque
import os

logger = logging.getLogger(__name__)

@dataclass
class ProcessingMetrics:
    """Metrics for image processing operations"""
    operation_type: str
    start_time: datetime
    end_time: Optional[datetime] = None
    success: bool = False
    error_message: Optional[str] = None
    processing_time_seconds: float = 0.0
    memory_usage_mb: float = 0.0
    image_count: int = 0
    file_size_mb: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class SystemMetrics:
    """System-level metrics"""
    timestamp: datetime
    cpu_percent: float
    memory_percent: float
    memory_available_mb: float
    disk_usage_percent: float
    gpu_memory_used_mb: Optional[float] = None
    gpu_memory_total_mb: Optional[float] = None

class MetricsCollector:
    """Collects and manages processing metrics"""
    
    def __init__(self, max_history_days: int = 7):
        self.max_history_days = max_history_days
        self.processing_metrics: deque = deque()
        self.system_metrics: deque = deque()
        self.operation_counters: Dict[str, int] = defaultdict(int)
        self.error_counters: Dict[str, int] = defaultdict(int)
        self._lock = threading.Lock()
        self._system_monitor_thread = None
        self._stop_monitoring = threading.Event()
        
        # Start system monitoring
        self.start_system_monitoring()
    
    def start_system_monitoring(self):
        """Start background system monitoring"""
        if self._system_monitor_thread is None or not self._system_monitor_thread.is_alive():
            self._system_monitor_thread = threading.Thread(target=self._system_monitor_loop, daemon=True)
            self._system_monitor_thread.start()
            logger.info("System monitoring started")
    
    def stop_system_monitoring(self):
        """Stop system monitoring"""
        self._stop_monitoring.set()
        if self._system_monitor_thread:
            self._system_monitor_thread.join(timeout=5)
            logger.info("System monitoring stopped")
    
    def _system_monitor_loop(self):
        """Background system monitoring loop"""
        while not self._stop_monitoring.is_set():
            try:
                self.collect_system_metrics()
                time.sleep(60)  # Collect every minute
            except Exception as e:
                logger.error(f"Error in system monitoring loop: {e}")
                time.sleep(60)
    
    def collect_system_metrics(self):
        """Collect current system metrics"""
        try:
            # CPU and memory
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            
            # Disk usage (for data directory)
            try:
                disk_usage = psutil.disk_usage('/data') if os.path.exists('/data') else psutil.disk_usage('/')
                disk_percent = disk_usage.percent
            except Exception:
                disk_percent = 0
            
            # GPU memory (if available)
            gpu_memory_used = None
            gpu_memory_total = None
            try:
                import torch
                if torch.cuda.is_available():
                    gpu_memory_used = torch.cuda.memory_allocated() / (1024 ** 2)  # MB
                    gpu_memory_total = torch.cuda.get_device_properties(0).total_memory / (1024 ** 2)  # MB
            except Exception:
                pass
            
            system_metric = SystemMetrics(
                timestamp=datetime.now(),
                cpu_percent=cpu_percent,
                memory_percent=memory.percent,
                memory_available_mb=memory.available / (1024 ** 2),
                disk_usage_percent=disk_percent,
                gpu_memory_used_mb=gpu_memory_used,
                gpu_memory_total_mb=gpu_memory_total
            )
            
            with self._lock:
                self.system_metrics.append(system_metric)
                self._cleanup_old_metrics()
            
        except Exception as e:
            logger.error(f"Error collecting system metrics: {e}")
    
    def record_processing_operation(self, operation_type: str, success: bool,
                                  processing_time: float, image_count: int = 1,
                                  file_size_mb: float = 0.0, error_message: Optional[str] = None,
                                  metadata: Dict[str, Any] = None):
        """Record a processing operation"""
        
        # Get current memory usage
        try:
            memory_usage = psutil.Process().memory_info().rss / (1024 ** 2)  # MB
        except Exception:
            memory_usage = 0
        
        metric = ProcessingMetrics(
            operation_type=operation_type,
            start_time=datetime.now() - timedelta(seconds=processing_time),
            end_time=datetime.now(),
            success=success,
            error_message=error_message,
            processing_time_seconds=processing_time,
            memory_usage_mb=memory_usage,
            image_count=image_count,
            file_size_mb=file_size_mb,
            metadata=metadata or {}
        )
        
        with self._lock:
            self.processing_metrics.append(metric)
            self.operation_counters[operation_type] += 1
            if not success and error_message:
                self.error_counters[error_message] += 1
            self._cleanup_old_metrics()
    
    def _cleanup_old_metrics(self):
        """Remove metrics older than max_history_days"""
        cutoff_time = datetime.now() - timedelta(days=self.max_history_days)
        
        # Clean processing metrics
        while (self.processing_metrics and 
               self.processing_metrics[0].start_time < cutoff_time):
            self.processing_metrics.popleft()
        
        # Clean system metrics
        while (self.system_metrics and 
               self.system_metrics[0].timestamp < cutoff_time):
            self.system_metrics.popleft()
    
    def get_processing_stats(self, hours: int = 24) -> Dict[str, Any]:
        """Get processing statistics for the last N hours"""
        
        cutoff_time = datetime.now() - timedelta(hours=hours)
        
        with self._lock:
            recent_metrics = [
                m for m in self.processing_metrics 
                if m.start_time >= cutoff_time
            ]
        
        if not recent_metrics:
            return {
                "period_hours": hours,
                "total_operations": 0,
                "successful_operations": 0,
                "failed_operations": 0,
                "success_rate": 0.0,
                "average_processing_time": 0.0,
                "total_images_processed": 0,
                "total_data_processed_mb": 0.0,
                "operations_by_type": {},
                "top_errors": {}
            }
        
        total_operations = len(recent_metrics)
        successful_operations = sum(1 for m in recent_metrics if m.success)
        failed_operations = total_operations - successful_operations
        success_rate = successful_operations / total_operations if total_operations > 0 else 0.0
        
        # Calculate averages
        avg_processing_time = sum(m.processing_time_seconds for m in recent_metrics) / total_operations
        total_images = sum(m.image_count for m in recent_metrics)
        total_data_mb = sum(m.file_size_mb for m in recent_metrics)
        
        # Group by operation type
        operations_by_type = {}
        for metric in recent_metrics:
            if metric.operation_type not in operations_by_type:
                operations_by_type[metric.operation_type] = {
                    "count": 0,
                    "success_count": 0,
                    "avg_time": 0.0
                }
            operations_by_type[metric.operation_type]["count"] += 1
            if metric.success:
                operations_by_type[metric.operation_type]["success_count"] += 1
        
        # Calculate success rates by type
        for op_type, stats in operations_by_type.items():
            stats["success_rate"] = stats["success_count"] / stats["count"]
            stats["avg_time"] = sum(
                m.processing_time_seconds for m in recent_metrics 
                if m.operation_type == op_type
            ) / stats["count"]
        
        # Top errors
        error_counts = defaultdict(int)
        for metric in recent_metrics:
            if not metric.success and metric.error_message:
                error_counts[metric.error_message] += 1
        
        top_errors = dict(sorted(error_counts.items(), key=lambda x: x[1], reverse=True)[:5])
        
        return {
            "period_hours": hours,
            "total_operations": total_operations,
            "successful_operations": successful_operations,
            "failed_operations": failed_operations,
            "success_rate": success_rate,
            "average_processing_time": avg_processing_time,
            "total_images_processed": total_images,
            "total_data_processed_mb": total_data_mb,
            "operations_by_type": operations_by_type,
            "top_errors": top_errors
        }
    
    def get_system_stats(self, hours: int = 1) -> Dict[str, Any]:
        """Get system statistics for the last N hours"""
        
        cutoff_time = datetime.now() - timedelta(hours=hours)
        
        with self._lock:
            recent_metrics = [
                m for m in self.system_metrics 
                if m.timestamp >= cutoff_time
            ]
        
        if not recent_metrics:
            return {
                "period_hours": hours,
                "avg_cpu_percent": 0.0,
                "avg_memory_percent": 0.0,
                "avg_disk_usage_percent": 0.0,
                "memory_available_mb": 0.0,
                "gpu_memory_used_mb": None,
                "sample_count": 0
            }
        
        return {
            "period_hours": hours,
            "avg_cpu_percent": sum(m.cpu_percent for m in recent_metrics) / len(recent_metrics),
            "avg_memory_percent": sum(m.memory_percent for m in recent_metrics) / len(recent_metrics),
            "avg_disk_usage_percent": sum(m.disk_usage_percent for m in recent_metrics) / len(recent_metrics),
            "memory_available_mb": sum(m.memory_available_mb for m in recent_metrics) / len(recent_metrics),
            "gpu_memory_used_mb": recent_metrics[-1].gpu_memory_used_mb,
            "gpu_memory_total_mb": recent_metrics[-1].gpu_memory_total_mb,
            "sample_count": len(recent_metrics)
        }
    
    def get_health_status(self) -> Dict[str, str]:
        """Get overall health status"""
        
        processing_stats = self.get_processing_stats(1)  # Last hour
        system_stats = self.get_system_stats(1)  # Last hour
        
        # Determine health status
        health_status = "healthy"
        issues = []
        
        # Check processing health
        if processing_stats["success_rate"] < 0.9:
            health_status = "degraded"
            issues.append(f"Low processing success rate: {processing_stats['success_rate']:.1%}")
        
        # Check system health
        if system_stats["avg_cpu_percent"] > 90:
            health_status = "degraded"
            issues.append(f"High CPU usage: {system_stats['avg_cpu_percent']:.1f}%")
        
        if system_stats["avg_memory_percent"] > 90:
            health_status = "degraded"
            issues.append(f"High memory usage: {system_stats['avg_memory_percent']:.1f}%")
        
        if system_stats["avg_disk_usage_percent"] > 95:
            health_status = "critical"
            issues.append(f"Critical disk usage: {system_stats['avg_disk_usage_percent']:.1f}%")
        
        return {
            "status": health_status,
            "issues": issues,
            "last_check": datetime.now().isoformat()
        }
    
    def export_metrics(self, filepath: str):
        """Export metrics to JSON file"""
        
        data = {
            "export_time": datetime.now().isoformat(),
            "processing_stats": self.get_processing_stats(24),  # Last 24 hours
            "system_stats": self.get_system_stats(24),  # Last 24 hours
            "health_status": self.get_health_status(),
            "raw_metrics": {
                "processing_metrics": [m.__dict__ for m in self.processing_metrics],
                "system_metrics": [m.__dict__ for m in self.system_metrics]
            }
        }
        
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2, default=str)
        
        logger.info(f"Metrics exported to {filepath}")

# Global metrics collector instance
metrics_collector = MetricsCollector()

def track_operation(operation_type: str):
    """Decorator to track function execution metrics"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            start_time = time.time()
            success = False
            error_message = None
            
            try:
                result = func(*args, **kwargs)
                success = True
                return result
            except Exception as e:
                error_message = str(e)
                raise
            finally:
                processing_time = time.time() - start_time
                
                # Extract file size from arguments if available
                file_size_mb = 0.0
                if args and hasattr(args[0], '__len__'):
                    file_size_mb = len(args[0]) / (1024 * 1024)  # Rough estimate
                
                metrics_collector.record_processing_operation(
                    operation_type=operation_type,
                    success=success,
                    processing_time=processing_time,
                    error_message=error_message,
                    file_size_mb=file_size_mb
                )
        
        return wrapper
    return decorator