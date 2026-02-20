# Nekazari EU Elevation Module (`nkz-module-eu-elevation`)

# Nekazari EU Elevation Module (`nkz-module-eu-elevation`)

An **essential, premium micro-module** for the Nekazari Platform ecosystem, engineered to deliver unparalleled 3D topographical intelligence. This module empowers the core Nexazari Digital Twin with high-fidelity, on-demand terrain models across **all of the European Union and the United Kingdom**.

By bridging the gap between flat cartography and immersive 3D agriculture, this module provides the critical infrastructure required for advanced hydrology analysis, precision spraying, and slope-aware autonomous routing.

## 🌍 Premium Ecosystem Standard

As a fully integrated component of the **Nekazari Standard Architecture**, this module is designed to feel native to the platform. It provides a full ETL (Extract, Transform, Load) pipeline that seamlessly converts raw geospatial data (via WCS or GeoTIFF) into the web-optimized **Quantized Mesh** format required by CesiumJS, allowing fluid 3D visualization right inside the agricultural dashboard.

## ✨ Elite Features

- **Pan-European Coverage:** Unrestricted access to harmonized Digital Elevation Models (DEM) spanning the ENTIRE European Union and the UK, eliminating the need to search for local, fragmented datasets.
- **Selective BBOX Ingestion:** Define a specific geographic area (Bounding Box) to process on-the-fly, avoiding the massive computational overhead of processing entire continents.
- **Asynchronous ETL Pipeline:** Powered by Python 3.12, Celery, and GDAL 3.x, enabling robust, scalable parallel processing of heavy geospatial workloads.
- **Hyper-Optimized Mesh Decimation:** Integrates `pydelatin` to intelligently simplify 3D geometry (TinMesh) while preserving crucial topographical features, reducing bandwidth by up to 90%.
- **Quantized Mesh Encoding:** Transcodes elevation matrices into the Cesium `.terrain` standard using lightning-fast C++ bindings (`quantized-mesh-encoder`).
- **High-Performance Static CDN:** Ships with an aggressively tuned NGINX distribution (`gzip_static on`, `open_file_cache`) to serve millions of pre-compressed terrain tiles with zero latency to global end-users.
- **Real-Time WebSockets Progress:** Streams live ingestion progress metrics directly from the FastAPI backend to the React frontend.
- **Plug-and-Play Integration:** Automatically registers the `ElevationAdminControl` dashboard widget and interceptors directly into the core Nekazari application via the advanced Host Runtime IIFE API.

## 🏗️ Architecture

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
