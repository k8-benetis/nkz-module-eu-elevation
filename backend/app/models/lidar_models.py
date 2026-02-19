"""
Database models for LIDAR module.
Includes PNOA coverage index and processing job tracking.
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Float, Integer, Text, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from geoalchemy2 import Geometry
import enum

from app.db.database import Base


class JobStatus(str, enum.Enum):
    """Processing job status enumeration."""
    PENDING = "pending"
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class LidarCoverageIndex(Base):
    """
    PNOA LiDAR coverage index table.
    Stores the spatial index of available LiDAR tiles from CNIG/PNOA.
    """
    __tablename__ = "lidar_coverage_index"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Tile identification
    tile_name = Column(String(100), nullable=False, index=True)
    sheet_code = Column(String(50), nullable=True)  # MTN50 sheet code
    
    # Data source info
    source = Column(String(50), default="PNOA")  # PNOA, IDENA, etc.
    flight_year = Column(Integer, nullable=True)
    point_density = Column(Float, nullable=True)  # points per m²
    
    # Download URL for the .LAZ file
    laz_url = Column(Text, nullable=False)
    
    # Spatial coverage (polygon geometry)
    geometry = Column(Geometry("POLYGON", srid=4326), nullable=False, index=True)
    
    # Additional metadata (avoid 'metadata' - reserved by SQLAlchemy)
    extra_metadata = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f"<LidarCoverageIndex(tile_name={self.tile_name}, source={self.source})>"


class LidarProcessingJob(Base):
    """
    Tracking table for LiDAR processing jobs.
    Each job represents a user request to process a parcel's point cloud.
    """
    __tablename__ = "lidar_processing_jobs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Job identification
    rq_job_id = Column(String(100), nullable=True, index=True)  # Redis Queue job ID
    tenant_id = Column(String(100), nullable=False, index=True)
    user_id = Column(String(100), nullable=False)
    
    # Target parcel
    parcel_id = Column(String(255), nullable=False, index=True)  # Orion-LD entity ID
    parcel_geometry_wkt = Column(Text, nullable=True)  # Cached WKT for processing
    
    # Processing configuration
    config = Column(JSONB, default=dict)
    # Example config:
    # {
    #   "colorize_by": "ndvi",  // "ndvi", "rgb", "height", "classification"
    #   "detect_trees": true,
    #   "tree_min_height": 2.0,
    #   "tree_search_radius": 3.0,
    #   "ndvi_source_url": "https://..."  // Optional NDVI GeoTIFF
    # }
    
    # Status tracking
    status = Column(SQLEnum(JobStatus), default=JobStatus.PENDING, index=True)
    progress = Column(Integer, default=0)  # 0-100 percentage
    status_message = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    
    # Results
    tileset_url = Column(Text, nullable=True)  # Final 3D Tiles URL
    tree_count = Column(Integer, nullable=True)
    point_count = Column(Integer, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    def __repr__(self):
        return f"<LidarProcessingJob(id={self.id}, status={self.status})>"


class PointCloudLayer(Base):
    """
    Represents a processed point cloud layer for visualization.
    Links to the Orion-LD PointCloudLayer entity.
    """
    __tablename__ = "point_cloud_layers"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Orion-LD entity reference
    orion_entity_id = Column(String(255), nullable=False, unique=True, index=True)
    
    # Ownership
    tenant_id = Column(String(100), nullable=False, index=True)
    parcel_id = Column(String(255), nullable=False, index=True)
    
    # Layer data
    tileset_url = Column(Text, nullable=False)
    source = Column(String(50), default="PNOA")
    date_observed = Column(DateTime, nullable=True)
    
    # Statistics
    point_count = Column(Integer, nullable=True)
    bounds_min_x = Column(Float, nullable=True)
    bounds_min_y = Column(Float, nullable=True)
    bounds_min_z = Column(Float, nullable=True)
    bounds_max_x = Column(Float, nullable=True)
    bounds_max_y = Column(Float, nullable=True)
    bounds_max_z = Column(Float, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<PointCloudLayer(orion_entity_id={self.orion_entity_id})>"


class LidarTileCache(Base):
    """
    Cache table for downloaded PNOA/source LAZ tiles.
    
    Tiles are shared across tenants since they're public data.
    This avoids re-downloading large LAZ files for overlapping parcels.
    """
    __tablename__ = "lidar_tile_cache"
    
    # Primary key is the tile name (unique identifier from source)
    tile_name = Column(String(255), primary_key=True)
    
    # Original source URL
    source_url = Column(Text, nullable=False)
    
    # MinIO storage path (e.g., "lidar-source-tiles/PNOA-2023-0001.laz")
    minio_bucket = Column(String(100), nullable=False, default="lidar-source-tiles")
    minio_key = Column(String(500), nullable=False)
    
    # File metadata
    file_size_bytes = Column(Integer, nullable=True)
    point_count = Column(Integer, nullable=True)
    
    # Usage tracking
    download_date = Column(DateTime, default=datetime.utcnow)
    last_accessed = Column(DateTime, default=datetime.utcnow)
    access_count = Column(Integer, default=1)
    
    # Status (in case download was interrupted)
    is_complete = Column(String(20), default="complete")  # complete, downloading, failed
    
    def __repr__(self):
        return f"<LidarTileCache(tile_name={self.tile_name}, access_count={self.access_count})>"

