"""
RQ Worker for LIDAR Processing.

This module runs as a separate process to handle heavy LiDAR processing jobs.
It connects to Redis and processes jobs from the 'lidar-processing' queue.

Usage:
    # Run worker
    python -m app.worker
    
    # Or via rq command
    rq worker lidar-processing --url redis://redis:6379/0
"""

import logging
import sys
from redis import Redis
from rq import Worker, Queue, Connection

from app.config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)


def create_redis_connection() -> Redis:
    """Create Redis connection from settings."""
    return Redis.from_url(settings.REDIS_URL)


def run_worker():
    """Start the RQ worker."""
    logger.info("Starting LIDAR processing worker...")
    logger.info(f"Redis URL: {settings.REDIS_URL}")
    logger.info(f"Queue: {settings.WORKER_QUEUE_NAME}")
    
    redis_conn = create_redis_connection()
    
    with Connection(redis_conn):
        queues = [Queue(settings.WORKER_QUEUE_NAME)]
        
        worker = Worker(
            queues,
            name=f"lidar-worker-{settings.WORKER_QUEUE_NAME}",
            default_worker_ttl=settings.WORKER_TIMEOUT
        )
        
        logger.info("Worker ready. Waiting for jobs...")
        worker.work(with_scheduler=True)


if __name__ == "__main__":
    run_worker()
