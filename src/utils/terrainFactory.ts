/**
 * Terrain Provider Factory — SOTA multi-tier elevation for EU/UK.
 *
 * Tiers:
 *   - Cesium World Terrain: Global ~30m (free, no token needed)
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
    try {
        if (token) {
            Cesium.Ion.defaultAccessToken = token;
        }
        return Cesium.createWorldTerrain({
            requestVertexNormals: true,
            requestWaterMask: false,
        });
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
    const url = config.europeCopernicusUrl || config.customUrl;
    if (url) {
        try {
            return new Cesium.CesiumTerrainProvider({
                url,
                requestVertexNormals: true,
                requestWaterMask: false,
            });
        } catch (error) {
            console.warn('[Elevation] Copernicus EU terrain failed, falling back to Cesium World:', error);
        }
    }
    // Fallback: Cesium World Terrain (free, global ~30m, uses host Ion token if available)
    console.warn('[Elevation] No pre-ingested Copernicus tiles found — using Cesium World Terrain as fallback');
    return createCesiumWorldTerrain(config.cesiumIonToken);
}
