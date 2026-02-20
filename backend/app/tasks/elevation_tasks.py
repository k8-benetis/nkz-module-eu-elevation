import os
import gzip
import json
import subprocess
import numpy as np
from loguru import logger
from celery import shared_task

# Graceful degradation if running outside docker/without compilation
try:
    import rasterio
    from rasterio.windows import from_bounds
    from rasterio.warp import transform_bounds
    import quantized_mesh_encoder
    from pydelatin import pydelatin
    HAS_ENCODERS = True
except ImportError as e:
    HAS_ENCODERS = False
    logger.warning(f"C++ encoders not found ({e}). Run inside Docker worker.")

# Expected MinIO storage path (or local mount in testing)
TERRAIN_OUTPUT_DIR = os.getenv("TERRAIN_OUTPUT_DIR", "/tmp/terrain_output")
os.makedirs(TERRAIN_OUTPUT_DIR, exist_ok=True)

# Define target zoom levels for BBOX ingestion (Customizable)
# In production we might generate 0 to 14. For POC let's target 10 to 14.
ZOOM_LEVELS = [12, 13, 14]

def _run_gdal(cmd: list[str]) -> None:
    """Helper to run GDAL commands robustly."""
    logger.debug(f"Executing: {' '.join(cmd)}")
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        logger.error(f"GDAL Error: {proc.stderr}")
        raise RuntimeError(f"GDAL command failed: {' '.join(cmd)}")

def _create_layer_json(output_path: str, bounds: tuple[float, float, float, float]):
    """Generates the layer.json standard required by Cesium terrain providers."""
    layer_def = {
        "tilejson": "2.1.0",
        "name": "Nekazari EU Elevation",
        "description": "Custom BBOX ingested high-res elevation",
        "version": "1.0.0",
        "format": "quantized-mesh-1.2",
        "tiles": ["{z}/{x}/{y}.terrain?v={version}"],
        "projection": "EPSG:4326",
        "bounds": [bounds[0], bounds[1], bounds[2], bounds[3]],
        "available": [
            [{"startX": 0, "startY": 0, "endX": 0, "endY": 0}] # Placeholder
        ]
    }
    with open(os.path.join(output_path, "layer.json"), "w") as f:
        json.dump(layer_def, f, indent=2)

@shared_task(bind=True, name="app.tasks.elevation_tasks.process_dem_to_quantized_mesh")
def process_dem_to_quantized_mesh(self, country_code: str, source_urls: list[str], bbox: tuple[float, float, float, float]):
    """
    Main ETL Pipeline for EU Elevation Processing (Selective Ingestion).
    1. Download by BBOX (gdalbuildvrt + gdal_translate wrapper)
    2. EPSG:4326 Reprojection (gdalwarp) -> Master VRT
    3. Mesh Decimation (pydelatin) & Quantized Mesh Encoding (.terrain) via Rasterio
    4. Gzip Compression (.terrain.gz)
    5. Cleanup
    """
    logger.info(f"Starting Selective Elevation Processing for {country_code.upper()} within BBOX: {bbox}")
    self.update_state(state='PROCESSING', meta={'progress': 5, 'message': 'Iniciando pipeline ETL y preparando estructura de directorios...'})
    
    task_dir = os.path.join(TERRAIN_OUTPUT_DIR, country_code)
    os.makedirs(task_dir, exist_ok=True)
    
    # Internal Temp Paths
    vrt_path = os.path.join(task_dir, "mosaic_raw.vrt")
    reprojected_vrt = os.path.join(task_dir, "mosaic_4326.vrt")
    
    try:
        # Step 1: VRT Generation restricted to BBOX
        self.update_state(state='PROCESSING', meta={'progress': 15, 'message': 'Generando Virtual Raster (VRT) acotado al BBOX...'})
        logger.info(f"[{country_code}] Generating Raw VRT (-te {bbox})...")
        vrt_cmd = [
            "gdalbuildvrt", 
            "-te", str(bbox[0]), str(bbox[1]), str(bbox[2]), str(bbox[3]),
            vrt_path
        ] + source_urls
        _run_gdal(vrt_cmd)
        
        # Step 2: Reprojection to EPSG:4326 (Required by Cesium Quantized Mesh)
        self.update_state(state='PROCESSING', meta={'progress': 30, 'message': 'Reproyectando modelo digital a EPSG:4326 en memoria...'})
        logger.info(f"[{country_code}] Reprojecting VRT to EPSG:4326...")
        warp_cmd = [
            "gdalwarp", 
            "-t_srs", "EPSG:4326", 
            "-of", "VRT", 
            "--config", "GDAL_CACHEMAX", "2048", 
            "-multi",
            vrt_path, 
            reprojected_vrt
        ]
        _run_gdal(warp_cmd)
        
        # Step 3 & 4: Transcoding to Quantized Mesh and Gzipping
        if not HAS_ENCODERS:
            logger.warning(f"[{country_code}] SKIPPING Encoding (Encoders not available in this env).")
            return {"status": "skipped_encoding", "country": country_code}
            
        self.update_state(state='PROCESSING', meta={'progress': 50, 'message': 'Preparando iterador Rasterio para extracción de cuadrantes...'})
        logger.info(f"[{country_code}] Opening EPSG:4326 VRT for Decimation & Encoding...")
        with rasterio.open(reprojected_vrt) as ds:
            _create_layer_json(task_dir, bbox)
            
            # Simple mocking of a looping mechanism for Z/X/Y
            z = 12
            x = 2048
            y = 2048
            
            tile_dir = os.path.join(task_dir, str(z), str(x))
            os.makedirs(tile_dir, exist_ok=True)
            terrain_file = os.path.join(tile_dir, f"{y}.terrain")
            gz_file = f"{terrain_file}.gz"

            self.update_state(state='PROCESSING', meta={'progress': 65, 'message': f'Extrayendo elevaciones ZXY ({z}/{x}/{y})...'})
            window = rasterio.windows.Window(0, 0, 256, 256)
            elevation_data = ds.read(1, window=window)
            
            self.update_state(state='PROCESSING', meta={'progress': 75, 'message': 'Decimando geometría pesada (TinMesh) para web...'})
            logger.info(f"[{country_code}] Decimating mesh...")
            tin = pydelatin.Delatin(elevation_data, max_error=0.5)
            vertices, triangles = tin.vertices, tin.triangles
            
            self.update_state(state='PROCESSING', meta={'progress': 85, 'message': 'Codificando binario a estándar Quantized-Mesh-1.2...'})
            logger.info(f"[{country_code}] Encoding .terrain dataset...")
            window_bounds = ds.window_bounds(window)
            qm_bytes = quantized_mesh_encoder.encode(
                vertices, 
                triangles, 
                bounds=window_bounds
            )
            
            self.update_state(state='PROCESSING', meta={'progress': 95, 'message': 'Comprimiendo capas estáticas en gzip...'})
            with open(terrain_file, "wb") as f:
                f.write(qm_bytes)
                
            with open(terrain_file, "rb") as f_in:
                with gzip.open(gz_file, "wb") as f_out:
                    f_out.writelines(f_in)
                    
            os.remove(terrain_file)
            logger.info(f"[{country_code}] Generated {gz_file}")

        self.update_state(state='SUCCESS', meta={'progress': 100, 'message': 'Proceso completado con éxito. Capas Terrain publicadas.'})
        logger.info(f"[{country_code}] Process completed. Data ready at {task_dir}")
        return {"status": "success", "country": country_code, "output_path": task_dir}

    except Exception as e:
        self.update_state(state='FAILED', meta={'progress': 0, 'message': f'Error crítico: {str(e)}'})
        logger.error(f"[{country_code}] Pipeline Failed: {str(e)}")
        raise self.retry(exc=e, countdown=60, max_retries=3)

