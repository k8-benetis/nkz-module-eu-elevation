"""
EU Elevation API endpoints.

Provides REST endpoints for:
- Initiating BBOX-based terrain ingestion
- Querying ingestion job status
"""

import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.middleware.auth import require_auth, get_tenant_id
from app.tasks.elevation_tasks import process_dem_to_quantized_mesh

logger = logging.getLogger(__name__)

router = APIRouter()

# ============================================================================
# Request/Response Models
# ============================================================================

class BboxIngestRequest(BaseModel):
    """Request to start Elevation processing for a specific BBOX."""
    country_code: str = Field(..., description="Country code or region identifier (e.g., 'uk', 'es')")
    bbox: tuple[float, float, float, float] = Field(
        ..., 
        description="Bounding Box (MinX, MinY, MaxX, MaxY) in EPSG:4326"
    )
    source_urls: List[str] = Field(..., description="List of WCS or GeoTIFF URLs to process")


class ProcessResponse(BaseModel):
    """Response from starting an ingestion job."""
    job_id: str
    status: str
    message: str


class JobStatusResponse(BaseModel):
    """Response for job status query."""
    job_id: str
    status: str
    result: Optional[dict] = None
    error: Optional[str] = None


# ============================================================================
# API Endpoints
# ============================================================================

@router.post("/ingest", response_model=ProcessResponse, status_code=status.HTTP_202_ACCEPTED)
async def start_ingestion(
    request: BboxIngestRequest,
    current_user: dict = Depends(require_auth),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Start Elevation (Quantized Mesh) processing for a BBOX.
    
    This endpoint:
    1. Validates the request
    2. Enqueues the job in Celery for worker processing
    
    Returns immediately with job ID for status polling.
    """
    logger.info(f"Ingestion request for {request.country_code} BBOX: {request.bbox} by tenant {tenant_id}")
    
    try:
        # Enqueue Celery task
        # process_dem_to_quantized_mesh(country_code, source_urls, bbox)
        task = process_dem_to_quantized_mesh.delay(
            request.country_code,
            request.source_urls,
            request.bbox
        )
        
        logger.info(f"Ingestion job enqueued (Celery Task ID: {task.id})")
        
        return ProcessResponse(
            job_id=task.id,
            status="queued",
            message="Ingestion job queued. Poll /api/elevation/status/{job_id} for updates."
        )
        
    except Exception as e:
        logger.error(f"Failed to enqueue ingestion job: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Processing queue unavailable. Please try again later."
        )


@router.get("/status/{job_id}", response_model=JobStatusResponse)
async def get_job_status(
    job_id: str,
    current_user: dict = Depends(require_auth)
):
    """
    Get status of a Celery processing job.
    """
    # Import AsyncResult here to avoid circular imports if worker isn't fully loaded
    from celery.result import AsyncResult
    from app.worker import celery_app
    
    task_result = AsyncResult(job_id, app=celery_app)
    
    response = JobStatusResponse(
        job_id=job_id,
        status=task_result.status
    )
    
    if task_result.successful():
        response.result = task_result.result
    elif task_result.failed():
        response.error = str(task_result.result)
        
    return response

