"""
EU Elevation API endpoints.

Provides REST endpoints for:
- Initiating BBOX-based terrain ingestion
- Querying ingestion job status
"""

import logging
import asyncio
import shutil
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, UploadFile, File, Form
from pydantic import BaseModel, Field

from app.middleware.auth import require_auth, get_tenant_id
from app.tasks.elevation_tasks import process_dem_to_quantized_mesh, process_local_dem_to_quantized_mesh
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.elevation_models import ElevationLayer
import uuid

logger = logging.getLogger(__name__)

router = APIRouter()

# ============================================================================
# Request/Response Models
# ============================================================================

class ElevationLayerCreate(BaseModel):
    """Schema for creating a new custom elevation layer."""
    name: str = Field(..., description="Display name for the terrain provider")
    url: str = Field(..., description="Base URL of the Cesium Terrain Provider")
    bbox_minx: Optional[float] = None
    bbox_miny: Optional[float] = None
    bbox_maxx: Optional[float] = None
    bbox_maxy: Optional[float] = None
    is_active: bool = True

class ElevationLayerResponse(ElevationLayerCreate):
    """Schema for returning an elevation layer."""
    id: uuid.UUID
    tenant_id: str
    
    class Config:
        from_attributes = True

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
        task = process_dem_to_quantized_mesh.delay(
            request.country_code,
            request.source_urls,
            request.bbox
        )
        
        logger.info(f"Ingestion job enqueued (Celery Task ID: {task.id})")
        
        return ProcessResponse(
            job_id=task.id,
            status="queued",
            message="Ingestion job queued. Connect to WS /api/elevation/ws/status/{job_id} for live updates."
        )
        
    except Exception as e:
        logger.error(f"Failed to enqueue ingestion job: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Processing queue unavailable. Please try again later."
        )


@router.post("/upload", response_model=ProcessResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_dem(
    file: UploadFile = File(...),
    country_code: str = Form(...),
    bbox: Optional[str] = Form(None, description="Comma-separated optional bbox: minX,minY,maxX,maxY"),
    current_user: dict = Depends(require_auth),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Upload a local DEM (GeoTIFF, ASC) for immediate Quantized Mesh conversion.
    Saves file to shared volume and triggers local pipeline worker.
    """
    logger.info(f"Local file upload: {file.filename} (Tenant: {tenant_id})")
    
    if not file.filename.lower().endswith(('.tif', '.tiff', '.asc')):
        raise HTTPException(status_code=400, detail="Only .tif or .asc files are currently supported")
    
    import os
    from app.tasks.elevation_tasks import TERRAIN_OUTPUT_DIR
    
    # Create upload dir
    upload_dir = os.path.join(TERRAIN_OUTPUT_DIR, "uploads", country_code)
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, file.filename)
    
    # Save file
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        logger.error(f"Failed to save uploaded file: {e}")
        raise HTTPException(status_code=500, detail="Could not save file")
    
    # Parse BBOX if exists
    parsed_bbox = None
    if bbox:
        try:
            parsed_bbox = tuple(map(float, bbox.split(',')))
        except:
            pass
            
    try:
        task = process_local_dem_to_quantized_mesh.delay(
            country_code,
            file_path,
            parsed_bbox
        )
        return ProcessResponse(
            job_id=task.id,
            status="queued",
            message="Upload job queued. Process will begin shortly."
        )
    except Exception as e:
        logger.error(f"Failed to enqueue upload job: {e}")
        raise HTTPException(status_code=503, detail="Processing queue unavailable.")


@router.get("/status/{job_id}", response_model=JobStatusResponse)
async def get_job_status(
    job_id: str,
    current_user: dict = Depends(require_auth)
):
    """
    Get status of a Celery processing job (Legacy Polling).
    """
    from celery.result import AsyncResult
    from app.worker import celery_app
    
    task_result = AsyncResult(job_id, app=celery_app)
    
    response = JobStatusResponse(
        job_id=job_id,
        status=task_result.status,
        result=task_result.info if isinstance(task_result.info, dict) else None
    )
    
    if task_result.successful():
        response.result = task_result.result
    elif task_result.failed():
        response.error = str(task_result.result)
        
    return response


@router.websocket("/ws/status/{job_id}")
async def websocket_job_status(websocket: WebSocket, job_id: str):
    """
    Real-time WebSocket stream for Celery job status and progress.
    """
    await websocket.accept()
    from celery.result import AsyncResult
    from app.worker import celery_app
    
    task_result = AsyncResult(job_id, app=celery_app)
    
    try:
        while True:
            state = task_result.state
            info = task_result.info
            
            payload = {
                "job_id": job_id,
                "status": state,
                "progress": 0,
                "message": ""
            }
            
            if isinstance(info, dict):
                payload["progress"] = info.get("progress", 0)
                payload["message"] = info.get("message", "")
                if state == "SUCCESS":
                    payload["result"] = info
            elif isinstance(info, Exception):
                payload["message"] = str(info)
                payload["error"] = True

            # Emit current state
            await websocket.send_json(payload)
            
            # Close connection if task is finalized
            if state in ["SUCCESS", "FAILURE", "REVOKED"]:
                break
                
            await asyncio.sleep(1)
            
    except WebSocketDisconnect:
        logger.info(f"WebSocket client disconnected from job {job_id}")
    except Exception as e:
        logger.error(f"WebSocket error for job {job_id}: {e}")
        # Try graceful close
        try:
            await websocket.close()
        except:
            pass

# ============================================================================
# Dynamic Multi-Tenant Terrain Layers
# ============================================================================

@router.get("/layers", response_model=List[ElevationLayerResponse])
async def get_elevation_layers(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
    current_user: dict = Depends(require_auth)
):
    """Get all configured elevation layers for the current tenant."""
    return db.query(ElevationLayer).filter(ElevationLayer.tenant_id == tenant_id).all()


@router.post("/layers", response_model=ElevationLayerResponse, status_code=status.HTTP_201_CREATED)
async def create_elevation_layer(
    layer_in: ElevationLayerCreate,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
    current_user: dict = Depends(require_auth)
):
    """Create a new custom elevation layer for the current tenant."""
    new_layer = ElevationLayer(
        tenant_id=tenant_id,
        name=layer_in.name,
        url=layer_in.url,
        bbox_minx=layer_in.bbox_minx,
        bbox_miny=layer_in.bbox_miny,
        bbox_maxx=layer_in.bbox_maxx,
        bbox_maxy=layer_in.bbox_maxy,
        is_active=layer_in.is_active
    )
    db.add(new_layer)
    db.commit()
    db.refresh(new_layer)
    return new_layer


@router.delete("/layers/{layer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_elevation_layer(
    layer_id: uuid.UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
    current_user: dict = Depends(require_auth)
):
    """Delete a custom elevation layer."""
    layer = db.query(ElevationLayer).filter(
        ElevationLayer.id == layer_id, 
        ElevationLayer.tenant_id == tenant_id
    ).first()
    
    if not layer:
        raise HTTPException(status_code=404, detail="Elevation layer not found")
        
    db.delete(layer)
    db.commit()
    return None
