"""
Tile Cache Service for PNOA LAZ files.

Manages downloading and caching of source LAZ tiles in MinIO to avoid
re-downloading large files for overlapping parcels.

The cache is shared across all tenants since PNOA data is public.
"""

import logging
import os
import tempfile
from datetime import datetime
from typing import Optional, Tuple
from pathlib import Path
from urllib.parse import urlparse

import requests

from app.config import settings
from app.db import SessionLocal
from app.models import LidarTileCache
from app.services.storage import storage_service

logger = logging.getLogger(__name__)

# Separate bucket for source tiles (raw LAZ files from PNOA)
SOURCE_TILES_BUCKET = "lidar-source-tiles"


class TileCacheService:
    """
    Service for caching downloaded PNOA LAZ tiles.
    
    Tiles are stored in MinIO and tracked in the database.
    When a tile is requested:
    1. Check if it exists in cache (database + MinIO)
    2. If yes, return the MinIO path
    3. If no, download from source, upload to MinIO, record in database
    """
    
    def __init__(self):
        self.bucket = SOURCE_TILES_BUCKET
        self._ensure_bucket_exists()
    
    def _ensure_bucket_exists(self):
        """Create the source tiles bucket if it doesn't exist."""
        try:
            storage_service.ensure_bucket(self.bucket)
            logger.info(f"Source tiles bucket '{self.bucket}' ready")
        except Exception as e:
            logger.warning(f"Could not create bucket '{self.bucket}': {e}")
    
    def _extract_tile_name(self, url: str) -> str:
        """
        Extract a unique tile name from the URL.
        
        For PNOA URLs like:
        https://centrodedescargas.cnig.es/...../PNOA_2023_NAV_0001.laz
        
        Returns: PNOA_2023_NAV_0001
        """
        parsed = urlparse(url)
        filename = os.path.basename(parsed.path)
        # Remove extension
        tile_name = Path(filename).stem
        return tile_name
    
    def get_cached_tile(self, tile_name: str) -> Optional[LidarTileCache]:
        """
        Check if a tile is already cached.
        
        Returns the cache record if found and complete, None otherwise.
        """
        db = SessionLocal()
        try:
            cache_entry = db.query(LidarTileCache).filter(
                LidarTileCache.tile_name == tile_name,
                LidarTileCache.is_complete == "complete"
            ).first()
            
            if cache_entry:
                # Update access stats
                cache_entry.last_accessed = datetime.utcnow()
                cache_entry.access_count += 1
                db.commit()
                logger.info(f"Cache HIT for tile: {tile_name} (access #{cache_entry.access_count})")
                return cache_entry
            
            return None
        finally:
            db.close()
    
    def get_tile_local_path(self, cache_entry: LidarTileCache, work_dir: str) -> str:
        """
        Download a cached tile from MinIO to a local path.
        
        Args:
            cache_entry: The cache database record
            work_dir: Local working directory
            
        Returns:
            Local file path to the LAZ file
        """
        local_path = os.path.join(work_dir, f"{cache_entry.tile_name}.laz")
        
        # Download from MinIO
        storage_service.download_file(
            bucket=cache_entry.minio_bucket,
            key=cache_entry.minio_key,
            local_path=local_path
        )
        
        logger.info(f"Downloaded cached tile to: {local_path}")
        return local_path
    
    def download_and_cache_tile(
        self,
        source_url: str,
        work_dir: str
    ) -> Tuple[str, LidarTileCache]:
        """
        Download a tile from source and cache it in MinIO.
        
        Args:
            source_url: URL to download from (PNOA/CNIG)
            work_dir: Local working directory
            
        Returns:
            Tuple of (local_file_path, cache_entry)
        """
        tile_name = self._extract_tile_name(source_url)
        local_path = os.path.join(work_dir, f"{tile_name}.laz")
        minio_key = f"{tile_name}.laz"
        
        db = SessionLocal()
        try:
            # Create cache entry as "downloading"
            cache_entry = LidarTileCache(
                tile_name=tile_name,
                source_url=source_url,
                minio_bucket=self.bucket,
                minio_key=minio_key,
                is_complete="downloading"
            )
            db.add(cache_entry)
            db.commit()
            
            # Download from source
            logger.info(f"Downloading tile from: {source_url}")
            response = requests.get(source_url, stream=True, timeout=600)
            response.raise_for_status()
            
            file_size = 0
            with open(local_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
                    file_size += len(chunk)
            
            logger.info(f"Downloaded {file_size / 1024 / 1024:.1f} MB to {local_path}")
            
            # Upload to MinIO for future use
            logger.info(f"Uploading to MinIO cache: {self.bucket}/{minio_key}")
            storage_service.upload_file(
                bucket=self.bucket,
                key=minio_key,
                file_path=local_path,
                content_type="application/octet-stream"
            )
            
            # Update cache entry as complete
            cache_entry.file_size_bytes = file_size
            cache_entry.is_complete = "complete"
            cache_entry.download_date = datetime.utcnow()
            db.commit()
            
            logger.info(f"Tile cached successfully: {tile_name}")
            return local_path, cache_entry
            
        except Exception as e:
            # Mark as failed if something went wrong
            db.rollback()
            try:
                failed_entry = db.query(LidarTileCache).filter(
                    LidarTileCache.tile_name == tile_name
                ).first()
                if failed_entry:
                    failed_entry.is_complete = "failed"
                    db.commit()
            except:
                pass
            raise e
        finally:
            db.close()
    
    def get_or_download_tile(
        self,
        source_url: str,
        work_dir: str
    ) -> str:
        """
        Main entry point: Get a tile from cache or download it.
        
        This is the method that should be called from the pipeline.
        
        Args:
            source_url: URL to the LAZ file
            work_dir: Local working directory
            
        Returns:
            Local file path to the LAZ file (either from cache or freshly downloaded)
        """
        tile_name = self._extract_tile_name(source_url)
        
        # Check cache first
        cache_entry = self.get_cached_tile(tile_name)
        
        if cache_entry:
            # Cache hit - download from MinIO (faster than PNOA)
            return self.get_tile_local_path(cache_entry, work_dir)
        else:
            # Cache miss - download from source and cache
            local_path, _ = self.download_and_cache_tile(source_url, work_dir)
            return local_path
    
    def get_cache_stats(self) -> dict:
        """Get statistics about the tile cache."""
        db = SessionLocal()
        try:
            total_tiles = db.query(LidarTileCache).filter(
                LidarTileCache.is_complete == "complete"
            ).count()
            
            total_size = db.query(LidarTileCache).filter(
                LidarTileCache.is_complete == "complete"
            ).with_entities(
                db.func.sum(LidarTileCache.file_size_bytes)
            ).scalar() or 0
            
            total_accesses = db.query(LidarTileCache).filter(
                LidarTileCache.is_complete == "complete"
            ).with_entities(
                db.func.sum(LidarTileCache.access_count)
            ).scalar() or 0
            
            return {
                "total_cached_tiles": total_tiles,
                "total_size_mb": round(total_size / 1024 / 1024, 2),
                "total_accesses": total_accesses,
                "cache_hits_saved_downloads": total_accesses - total_tiles if total_accesses > total_tiles else 0
            }
        finally:
            db.close()


# Singleton instance
tile_cache = TileCacheService()
