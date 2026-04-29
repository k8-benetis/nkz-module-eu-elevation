# EU Elevation Module — Production Setup

## Architecture

- **Backend API**: FastAPI → `elevation-api-service:80` → container port 8000
- **Worker**: Celery (GDAL + rasterio + pydelatin + quantized-mesh-encoder)
- **Storage**: MinIO (`terrain-tilesets` bucket for terrain tiles, `nekazari-frontend` for IIFE bundles)
- **Ingress**: Path `/api/elevation` MUST be in the main `nekazari-ingress` (NOT a separate ingress — multiple ingresses on same host+path cause non-deterministic routing in Traefik)

## Required K8s Resources

### Secrets
- `elevation-db-secret` — must contain `DATABASE_URL`
- `minio-secret` — must contain `root-user` and `root-password`

### Ingress Route (in `nkz` repo main ingress)
```yaml
- backend:
    service:
      name: elevation-api-service
      port:
        number: 80
  path: /api/elevation
  pathType: Prefix
```
Must be placed BEFORE the `/api` catch-all route on both `nkz.robotika.cloud` and `nekazari.robotika.cloud` hosts.

## Default Terrain Provider

The built-in `europe_copernicus` provider serves Copernicus GLO-30 (30m) terrain for
EU+UK. It requires pre-ingested tiles in MinIO under `terrain/EU/`. To bootstrap:

```bash
kubectl exec -n nekazari deploy/elevation-worker -- \
  python3 /app/scripts/ingest_copernicus_eu.py
```

Until ingestion completes, the provider gracefully falls back to Cesium World Terrain
(uses the host's default Cesium Ion token — no per-tenant API key needed).

## Env Vars

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `DATABASE_URL` | Yes | — | From `elevation-db-secret` |
| `CELERY_BROKER_URL` | Yes | `redis://redis-service:6379/10` | |
| `CELERY_RESULT_BACKEND` | Yes | `redis://redis-service:6379/11` | |
| `ALLOWED_ORIGINS` | Production | `""` (CORS disabled) | Set via GitOps overlay |
| `JWT_ISSUER` | Yes | — | Keycloak issuer URL |
| `JWKS_URL` | Yes | — | Keycloak JWKS endpoint |
| `MINIO_ENDPOINT` | Yes | `minio-service:9000` | |
| `MINIO_BUCKET` | Yes | `terrain-tilesets` | |
| `EU_COPERNICUS_TERRAIN_URL` | No | `/api/elevation/terrain/EU/layer.json` | Default terrain tileset URL |
| `MINIO_ACCESS_KEY` | Yes | — | From `minio-secret` |
| `MINIO_SECRET_KEY` | Yes | — | From `minio-secret` |
