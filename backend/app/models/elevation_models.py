"""
SQLAlchemy models for managing dynamic terrain elevation layers.
"""

import uuid
from sqlalchemy import Column, String, Float, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.db.database import Base

class ElevationLayer(Base):
    """
    Represents a configured terrain provider source for a specific tenant.
    """
    __tablename__ = "elevation_layers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, index=True, nullable=False)
    
    # Layer details
    name = Column(String, nullable=False)
    url = Column(String, nullable=False)
    
    # Optional BBOX coordinates for automatic switching
    bbox_minx = Column(Float, nullable=True)
    bbox_miny = Column(Float, nullable=True)
    bbox_maxx = Column(Float, nullable=True)
    bbox_maxy = Column(Float, nullable=True)
    
    is_active = Column(Boolean, default=True)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
