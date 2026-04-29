# nkz-module-eu-elevation — Estado del Módulo

> Última actualización: 2026-04-30

## Estado: ✅ Desplegado en producción — Funcional

Sistema multi-tier de terrain providers integrado con el host NKZ (respeta IGN/IDENA del host).
Pipeline de ingesta funcionando con fallback a Copernicus GLO-30 vía S3.

---

## Arquitectura — Multi-Tier Terrain Providers

| Tier | Provider | Resolución | Setup | Cobertura |
|------|----------|-----------|-------|-----------|
| **Host** | IGN / IDENA | 5m–25m | Público, sin token | España / Navarra |
| **Tier 0** | Copernicus EU (Cesium World) | ~30m global | Token Ion (gratis) | Global |
| **Tier 0** | MapTiler Terrain | Hasta 50cm | API key (free 100k/mes) | EU + UK |
| **Tier 1** | Custom DEM Source | Variable | URL WCS/WMS + auth | BBOX definido |
| **Tier 2** | Ingested Layers | Variable | Pipeline ETL → MinIO | BBOX definido |
| **Tier 3** | Self-hosted | Cualquiera | Custom terrain URL | Infra del user |

### Comportamiento del provider por defecto

- **Default (`europe_copernicus`)**: El módulo no toca el terreno. El host gestiona IGN/IDENA automáticamente.
- **Selección explícita** (Cesium World/MapTiler/Custom): El módulo toma el control y aplica el provider elegido.
- **Volver a default**: El módulo libera el control y el host recupera IGN/IDENA.

### Integración con el host (Cesium 1.136)

- El módulo no modifica `Cesium.Ion.defaultAccessToken` permanentemente.
- Al aplicar Cesium World Terrain, intercambia temporalmente el token global y lo restaura tras la llamada asíncrona.
- `fromIonAssetId(1)` devuelve una Promise — el módulo la maneja correctamente.
- Las capas de imagery del host (ESRI, PNOA, etc.) no se ven afectadas.

---

## Pipeline de ingesta

La ingesta desde el catálogo regional funciona mediante fallback automático a Copernicus GLO-30:

1. Usuario selecciona país → WCS falla (gdalbuildvrt no soporta WCS)
2. Pipeline enumera tiles Copernicus S3 para el BBOX del país
3. GDAL construye VRT con `-input_file_list` + `AWS_NO_SIGN_REQUEST=YES`
4. rasterio + pydelatin + quantized-mesh-encoder v2 → tiles Quantized Mesh
5. Upload a MinIO `terrain/{country_code}/`

### Limitaciones

- **Ingesta pan-europea no viable**: ~600K tiles, ~3GB, ~2 semanas, OOM en worker de 1GB.
- **Solo viable por país/región pequeña**: Usar `scripts/ingest_copernicus_direct.py --bbox=...`
- **WCS del catálogo**: Solo como referencia; la ingesta siempre usa Copernicus S3.

---

## Deploy (2026-04-30)

- **Docker image**: `ghcr.io/nkz-os/nkz-module-eu-elevation/backend:latest` (GDAL 3.10.2)
- **IIFE bundle**: `nekazari-frontend/modules/nkz-module-eu-elevation/nkz-module.js`
- **Ingress**: `/api/elevation` en `nekazari-ingress` principal (NO ingress separado)
- **DB**: `marketplace_modules.remote_entry_url` con cache-bust param `?v=8`
- **CORS**: `ALLOWED_ORIGINS=https://nekazari.robotika.cloud` (requerido: frontend y API son dominios distintos)
- **MinIO buckets**: `terrain-tilesets` (tiles), `nekazari-frontend` (IIFE)
- **Worker**: `resources.limits.memory=1Gi` (suficiente para ingestas por país)

---

## Correcciones aplicadas (2026-04-29/30)

### Críticos
- **C2**: WebSocket `/ws/status/{job_id}` ahora valida JWT vía cookie `nkz_token`
- **C4**: Eliminado `<Link>` de react-router-dom (causa crash en IIFE)
- **C5**: `ALLOWED_ORIGINS` restaurado (CORS es obligatorio para este módulo)

### Pipeline
- Fallback Copernicus S3 funcional (enumeración de tiles + env vars en proceso)
- `quantized-mesh-encoder` API v2 (stream-based, no retorna bytes)
- GDAL Docker base image pineada a `ubuntu-small-3.10.2`

### Integración Cesium 1.136
- `Cesium.createWorldTerrain()` → `CesiumTerrainProvider.fromIonAssetId(1)`
- Token Ion pasado correctamente (swap temporal del global)
- Promise de `fromIonAssetId` manejada (no se asigna directamente al viewer)
- Provider por defecto no interfiere con el host

### UX
- Reset de formulario al cambiar tabs Remote/Local
- Evento `nkz.elevation.change` tras completar pipeline
- Badge de origen en textarea de URLs (catálogo/custom/manual)
- Validación de URL antes de crear layer manual
- i18n completo: 95 claves en `es` + `en`

### Infra
- Health endpoint en el router (`/api/elevation/health`) para el ingress
- Ingress unificado (ruta en `nekazari-ingress`, no ingress separado)
- Scripts de ingesta directa (`ingest_copernicus_direct.py`)
