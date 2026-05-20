/**
 * Terrain Provider Factory — SOTA multi-tier elevation for EU/UK.
 *
 * Tiers:
 *   - Europe Copernicus: GLO-30 ~30m, free, self-hosted on platform MinIO (no token)
 *   - Cesium World Terrain: Global ~30m (requires Cesium Ion token)
 *   - MapTiler: High-res EU/UK up to 50cm (requires API key)
 *   - Custom: User-provided quantized mesh URL (self-hosted or ingested)
 *
 * Usage:
 *   const provider = createTerrainProvider({ type: 'maptiler', apiKey: '...' });
 *   viewer.terrainProvider = provider;
 */

declare const Cesium: any;

export type TerrainProviderType = 'off' | 'europe_copernicus' | 'cesium_world' | 'maptiler' | 'custom' | 'auto';

export interface TerrainProviderConfig {
    type: TerrainProviderType;
    cesiumIonToken?: string;
    maptilerApiKey?: string;
    customUrl?: string;
    europeCopernicusUrl?: string;
}

/**
 * Create a Cesium terrain provider from configuration.
 * Returns EllipsoidTerrainProvider for 'off', or the appropriate provider.
 */
export function createTerrainProvider(config: TerrainProviderConfig): any {
    switch (config.type) {
        case 'europe_copernicus':
            return createEuropeCopernicusTerrain(config);
        case 'cesium_world':
            return createCesiumWorldTerrain(config.cesiumIonToken);
        case 'maptiler':
            return createMapTilerTerrain(config.maptilerApiKey);
        case 'custom':
            return createCustomTerrain(config.customUrl);
        case 'off':
        default:
            return new Cesium.EllipsoidTerrainProvider();
    }
}

function createCesiumWorldTerrain(token?: string): any {
    // Cesium 1.136 reads Cesium.Ion.defaultAccessToken for all Ion requests.
    // When the user explicitly chooses Cesium World Terrain with their own token,
    // we set it globally and DON'T restore the old one — restoring triggers
    // Cesium to re-validate sessions, causing black flashes on terrain reload.
    if (token) {
        Cesium.Ion.defaultAccessToken = token;
    }

    try {
        if (typeof Cesium.CesiumTerrainProvider?.fromIonAssetId === 'function') {
            return Cesium.CesiumTerrainProvider.fromIonAssetId(1, {
                requestVertexNormals: true,
                requestWaterMask: false,
            });
        }
        if (typeof Cesium.createWorldTerrain === 'function') {
            return Cesium.createWorldTerrain({
                requestVertexNormals: true,
                requestWaterMask: false,
            });
        }
        throw new Error('No compatible Cesium World Terrain API found (Cesium ' + (Cesium.VERSION || 'unknown') + ')');
    } catch (error) {
        console.warn('[Elevation] Cesium World Terrain failed, falling back to ellipsoid:', error);
        return new Cesium.EllipsoidTerrainProvider();
    }
}

function createMapTilerTerrain(apiKey?: string): any {
    if (!apiKey) {
        console.warn('[Elevation] MapTiler API key missing, falling back to ellipsoid');
        return new Cesium.EllipsoidTerrainProvider();
    }
    try {
        const url = `https://api.maptiler.com/tiles/terrain-quantized-mesh-v2/?key=${apiKey}`;
        return new Cesium.CesiumTerrainProvider({
            url,
            requestVertexNormals: true,
            requestWaterMask: false,
        });
    } catch (error) {
        console.warn('[Elevation] MapTiler terrain failed, falling back to ellipsoid:', error);
        return new Cesium.EllipsoidTerrainProvider();
    }
}

function createCustomTerrain(url?: string): any {
    if (!url) {
        console.warn('[Elevation] Custom terrain URL missing, falling back to ellipsoid');
        return new Cesium.EllipsoidTerrainProvider();
    }
    try {
        return new Cesium.CesiumTerrainProvider({
            url,
            requestVertexNormals: true,
            requestWaterMask: false,
        });
    } catch (error) {
        console.warn('[Elevation] Custom terrain failed, falling back to ellipsoid:', error);
        return new Cesium.EllipsoidTerrainProvider();
    }
}

function createEuropeCopernicusTerrain(config: TerrainProviderConfig): any {
    // Copernicus GLO-30 tiles — self-hosted on platform MinIO (no Cesium Ion token needed).
    // Falls through to ellipsoid if URL is not configured.
    const url = config.europeCopernicusUrl;
    if (!url) {
        console.warn('[Elevation] Europe Copernicus URL missing, falling back to ellipsoid');
        return new Cesium.EllipsoidTerrainProvider();
    }
    try {
        return new Cesium.CesiumTerrainProvider({
            url,
            requestVertexNormals: true,
            requestWaterMask: false,
        });
    } catch (error) {
        console.warn('[Elevation] Copernicus terrain failed, falling back to ellipsoid:', error);
        return new Cesium.EllipsoidTerrainProvider();
    }
}
