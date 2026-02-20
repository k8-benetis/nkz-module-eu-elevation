# Nekazari EU Elevation Module (`nkz-module-eu-elevation`)

An advanced, independent micro-module for the Nekazari Monorepo designed to ingest, process, and serve highly-detailed 3D elevation data (DEM/DTM) across Europe.

This module provides a full ETL (Extract, Transform, Load) pipeline that seamlessly converts raw geospatial data (via WCS or GeoTIFF) into the web-optimized **Quantized Mesh** format required by CesiumJS.

## Features

- **Selective BBOX Ingestion:** Define a specific geographic area (Bounding Box) to process, avoiding the massive computational overhead of processing entire countries at once.
- **Asynchronous ETL Pipeline:** Powered by Python 3.12, Celery, and GDAL 3.x, enabling robust parallel processing of heavy geospatial workloads.
- **Mesh Decimation:** Integrates `pydelatin` to intelligently simplify 3D geometry (TinMesh) while preserving topological features, significantly reducing bandwidth.
- **Quantized Mesh Encoding:** Transcodes elevation matrices into the Cesium `.terrain` standard using C++ bindings (`quantized-mesh-encoder`).
- **High-Performance Static CDN:** Ships with an aggressively tuned NGINX configuration (`gzip_static on`, `open_file_cache`) to serve millions of pre-compressed terrain tiles with zero latency.
- **Real-Time Progress:** Employs WebSockets across the FastAPI backend and React frontend to stream live progress bars during the intensive ETL pipeline.
- **Plug-and-Play Frontend:** Automatically registers the `ElevationAdminControl` dashboard widget and the `ElevationLayer` map slot into the core Nekazari application via the Host Runtime API.

## Architecture

1. **Backend API (FastAPI):** Exposes authenticated endpoints (`/api/elevation/ingest`) and WebSockets (`/ws/status`) to trigger and monitor ingestion jobs.
2. **Worker Node (Celery/GDAL):** Executes the heavy lifting. Translates WCS/GeoTIFF datasets into Virtual Rasters (VRT), reprojects them to EPSG:4326, generates the mesh grids, and pre-gzips the chunks.
3. **Cache & Queue (Redis):** Orchestrates the asynchronous messaging and state updates between FastAPI and the GDAL Worker.
4. **Storage CDN (NGINX/MinIO):** A highly concurrent static web server acting as a dummy Edge CDN to feed CesiumJS `.terrain` requests securely using CORS.
5. **Frontend UI (React/Vite):** Admin tools for defining the BBOX and a background Cesium terrain provider injector, compiled as an IIFE (Immediately Invoked Function Expression) for dynamic runtime loading.

## Quick Start (Development)

This module is designed to run in isolation via Docker Compose for easy development and testing before mounting to a Kubernetes cluster.

### 1. Start the Infrastructure
```bash
docker-compose up -d --build
```
This will spin up the `elevation-api`, `elevation-worker`, `redis`, and the `terrain-cdn`.

### 2. Build the Frontend Plugin
You must have the core Nekazari dependencies mapped or installed locally.
```bash
pnpm install
pnpm run build
```
Once built, the `dist/moduleEntry.js` script must be pushed to your MinIO deployment bucket to let the Nekazari Core load it dynamically.

## License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0-or-later)**. 
See the accompanying `LICENSE` file for full details.
