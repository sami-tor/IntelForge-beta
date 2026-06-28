#!/usr/bin/env python3
"""
Batch processing system with configurable limits and monitoring
"""

import time
import threading
import logging
from typing import List, Dict, Any, Callable, Optional
from dataclasses import dataclass, field
from concurrent.futures import ThreadPoolExecutor, as_completed
from queue import Queue
import psutil
from datetime import datetime

logger = logging.getLogger(__name__)

@dataclass
class BatchJob:
    """Represents a single batch processing job"""
    job_id: str
    items: List[Any]
    processing_func: Callable
    priority: int = 1
    created_at: datetime = field(default_factory=datetime.now)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    status: str = "pending"  # pending, processing, completed, failed
    result: Any = None
    error: Optional[str] = None

@dataclass
class BatchStats:
    """Statistics for batch processing"""
    total_jobs: int = 0
    completed_jobs: int = 0
    failed_jobs: int = 0
    total_items: int = 0
    processed_items: int = 0
    average_processing_time: float = 0.0
    current_queue_size: int = 0
    memory_usage_mb: float = 0.0
    active_threads: int = 0

class BatchProcessor:
    """Configurable batch processing system with monitoring"""
    
    def __init__(self, 
                 max_batch_size: int = 32,
                 max_workers: int = 4,
                 max_memory_usage_mb: int = 4096,
                 processing_timeout_seconds: int = 300,
                 retry_failed_items: bool = True,
                 max_retries: int = 3):
        
        self.max_batch_size = max_batch_size
        self.max_workers = max_workers
        self.max_memory_usage_mb = max_memory_usage_mb
        self.processing_timeout_seconds = processing_timeout_seconds
        self.retry_failed_items = retry_failed_items
        self.max_retries = max_retries
        
        self.job_queue = Queue()
        self.active_jobs: Dict[str, BatchJob] = {}
        self.completed_jobs: Dict[str, BatchJob] = {}
        self._lock = threading.Lock()
        self._stop_event = threading.Event()
        self._worker_thread = None
        self._stats = BatchStats()
        
        self.start_worker()
    
    def start_worker(self):
        """Start the background worker thread"""
        if self._worker_thread is None or not self._worker_thread.is_alive():
            self._worker_thread = threading.Thread(target=self._worker_loop, daemon=True)
            self._worker_thread.start()
            logger.info(f"Batch processor started with {self.max_workers} workers")
    
    def stop_worker(self):
        """Stop the background worker thread"""
        self._stop_event.set()
        if self._worker_thread:
            self._worker_thread.join(timeout=10)
            logger.info("Batch processor stopped")
    
    def _worker_loop(self):
        """Main worker loop for processing jobs"""
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            while not self._stop_event.is_set():
                try:
                    # Get next job from queue
                    job = self.job_queue.get(timeout=1)
                    if job is None:  # Poison pill
                        break
                    
                    # Check memory usage before processing
                    if self._should_throttle():
                        logger.warning("Memory usage high, throttling batch processing")
                        time.sleep(5)
                        self.job_queue.put(job)  # Re-queue job
                        continue
                    
                    # Process job
                    future = executor.submit(self._process_job, job)
                    
                except Exception as e:
                    logger.error(f"Error in batch processor worker loop: {e}")
                    time.sleep(1)
    
    def _should_throttle(self) -> bool:
        """Check if processing should be throttled due to resource constraints"""
        memory_usage = psutil.virtual_memory().used / (1024 ** 2)  # MB
        return memory_usage > self.max_memory_usage_mb
    
    def _process_job(self, job: BatchJob):
        """Process a single batch job"""
        try:
            job.status = "processing"
            job.started_at = datetime.now()
            
            logger.info(f"Processing batch job {job.job_id} with {len(job.items)} items")
            
            # Split items into smaller batches if necessary
            batches = self._create_batches(job.items)
            all_results = []
            failed_items = []
            
            for batch_idx, batch in enumerate(batches):
                try:
                    # Process batch with timeout
                    batch_result = self._process_batch_with_timeout(
                        job.processing_func, batch, job.job_id, batch_idx
                    )
                    all_results.extend(batch_result)
                    
                except Exception as e:
                    logger.error(f"Batch {batch_idx} failed in job {job.job_id}: {e}")
                    
                    if self.retry_failed_items:
                        failed_items.extend(batch)
                    else:
                        # Mark individual items as failed
                        for item in batch:
                            all_results.append({
                                "item": item,
                                "success": False,
                                "error": str(e)
                            })
            
            # Retry failed items if enabled
            if failed_items and self.retry_failed_items:
                retry_results = self._retry_failed_items(job.processing_func, failed_items, job.job_id)
                all_results.extend(retry_results)
            
            job.result = all_results
            job.status = "completed"
            job.completed_at = datetime.now()
            
            processing_time = (job.completed_at - job.started_at).total_seconds()
            logger.info(f"Batch job {job.job_id} completed in {processing_time:.2f}s")
            
            # Update statistics
            self._update_stats(job)
            
        except Exception as e:
            job.error = str(e)
            job.status = "failed"
            job.completed_at = datetime.now()
            logger.error(f"Batch job {job.job_id} failed: {e}")
            
        finally:
            with self._lock:
                self.completed_jobs[job.job_id] = job
                if job.job_id in self.active_jobs:
                    del self.active_jobs[job.job_id]
    
    def _create_batches(self, items: List[Any]) -> List[List[Any]]:
        """Split items into batches of max_batch_size"""
        batches = []
        for i in range(0, len(items), self.max_batch_size):
            batch = items[i:i + self.max_batch_size]
            batches.append(batch)
        return batches
    
    def _process_batch_with_timeout(self, func: Callable, batch: List[Any], 
                                   job_id: str, batch_idx: int) -> List[Any]:
        """Process a batch with timeout protection"""
        import concurrent.futures
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(func, batch)
            try:
                result = future.result(timeout=self.processing_timeout_seconds)
                return result
            except concurrent.futures.TimeoutError:
                logger.error(f"Batch {batch_idx} in job {job_id} timed out")
                raise TimeoutError(f"Batch processing timed out after {self.processing_timeout_seconds}s")
    
    def _retry_failed_items(self, func: Callable, failed_items: List[Any], job_id: str) -> List[Any]:
        """Retry failed items with exponential backoff"""
        retry_results = []
        
        for attempt in range(self.max_retries):
            if not failed_items:
                break
            
            retry_delay = 2 ** attempt  # Exponential backoff
            logger.info(f"Retry attempt {attempt + 1} for {len(failed_items)} items in job {job_id}")
            
            time.sleep(retry_delay)
            
            still_failed = []
            for item in failed_items:
                try:
                    result = func([item])
                    retry_results.extend(result)
                except Exception as e:
                    logger.warning(f"Item retry failed: {e}")
                    still_failed.append(item)
            
            failed_items = still_failed
        
        # Mark remaining failed items
        for item in failed_items:
            retry_results.append({
                "item": item,
                "success": False,
                "error": "Max retries exceeded"
            })
        
        return retry_results
    
    def _update_stats(self, job: BatchJob):
        """Update processing statistics"""
        with self._lock:
            self._stats.total_jobs += 1
            if job.status == "completed":
                self._stats.completed_jobs += 1
            elif job.status == "failed":
                self._stats.failed_jobs += 1
            
            self._stats.total_items += len(job.items)
            if job.result:
                successful_items = sum(1 for r in job.result if isinstance(r, dict) and r.get("success", True))
                self._stats.processed_items += successful_items
            
            # Update average processing time
            if job.started_at and job.completed_at:
                processing_time = (job.completed_at - job.started_at).total_seconds()
                if self._stats.average_processing_time == 0:
                    self._stats.average_processing_time = processing_time
                else:
                    self._stats.average_processing_time = (
                        (self._stats.average_processing_time * (self._stats.completed_jobs - 1) + processing_time) 
                        / self._stats.completed_jobs
                    )
    
    def submit_job(self, job_id: str, items: List[Any], processing_func: Callable, 
                   priority: int = 1) -> str:
        """Submit a new batch job"""
        job = BatchJob(
            job_id=job_id,
            items=items,
            processing_func=processing_func,
            priority=priority
        )
        
        with self._lock:
            self.active_jobs[job_id] = job
        
        self.job_queue.put(job)
        logger.info(f"Submitted batch job {job_id} with {len(items)} items")
        
        return job_id
    
    def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a specific job"""
        with self._lock:
            job = self.active_jobs.get(job_id) or self.completed_jobs.get(job_id)
            
            if job:
                return {
                    "job_id": job.job_id,
                    "status": job.status,
                    "created_at": job.created_at.isoformat(),
                    "started_at": job.started_at.isoformat() if job.started_at else None,
                    "completed_at": job.completed_at.isoformat() if job.completed_at else None,
                    "items_count": len(job.items),
                    "result_preview": str(job.result)[:200] if job.result else None,
                    "error": job.error
                }
            
            return None
    
    def get_stats(self) -> BatchStats:
        """Get current processing statistics"""
        with self._lock:
            stats = BatchStats(**self._stats.__dict__)
            stats.current_queue_size = self.job_queue.qsize()
            stats.memory_usage_mb = psutil.virtual_memory().used / (1024 ** 2)
            stats.active_threads = threading.active_count()
            return stats
    
    def wait_for_job(self, job_id: str, timeout: Optional[float] = None) -> Optional[BatchJob]:
        """Wait for job completion"""
        start_time = time.time()
        
        while True:
            with self._lock:
                if job_id in self.completed_jobs:
                    return self.completed_jobs[job_id]
                
                if job_id not in self.active_jobs:
                    return None  # Job not found
            
            if timeout and (time.time() - start_time) > timeout:
                raise TimeoutError(f"Timeout waiting for job {job_id}")
            
            time.sleep(0.1)

# Global batch processor instance
batch_processor = BatchProcessor()

def process_images_batch(image_paths: List[str], processing_func: Callable, 
                        batch_size: int = 16, max_workers: int = 4) -> List[Dict[str, Any]]:
    """
    Process images in batches with monitoring and error handling
    
    Args:
        image_paths: List of image file paths
        processing_func: Function to process each batch
        batch_size: Number of images per batch
        max_workers: Maximum parallel workers
    
    Returns:
        List of processing results
    """
    job_id = f"batch_image_process_{int(time.time())}"
    
    # Submit batch job
    batch_processor.max_batch_size = batch_size
    batch_processor.max_workers = max_workers
    
    job_id = batch_processor.submit_job(job_id, image_paths, processing_func)
    
    # Wait for completion
    job = batch_processor.wait_for_job(job_id, timeout=3600)  # 1 hour timeout
    
    if job and job.status == "completed":
        return job.result or []
    elif job and job.status == "failed":
        raise Exception(f"Batch processing failed: {job.error}")
    else:
        raise Exception("Batch processing did not complete")