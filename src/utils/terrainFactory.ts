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
    // Cesium 1.116+ uses fromIonAssetId which always reads Cesium.Ion.defaultAccessToken
    // (the accessToken option is ignored in 1.136). We must temporarily swap the global
    // token and restore it after the async call completes.
    const savedToken = Cesium.Ion.defaultAccessToken;

    if (token) {
        Cesium.Ion.defaultAccessToken = token;
    }

    try {
        if (typeof Cesium.CesiumTerrainProvider?.fromIonAssetId === 'function') {
            const promise = Cesium.CesiumTerrainProvider.fromIonAssetId(1, {
                requestVertexNormals: true,
                requestWaterMask: false,
            });
            // fromIonAssetId returns a Promise — restore token after it settles
            if (promise && typeof promise.then === 'function') {
                promise.then(() => {
                    Cesium.Ion.defaultAccessToken = savedToken;
                }).catch(() => {
                    Cesium.Ion.defaultAccessToken = savedToken;
                });
            }
            return promise;
        }
        // Fallback for older Cesium versions
        if (typeof Cesium.createWorldTerrain === 'function') {
            const provider = Cesium.createWorldTerrain({
                requestVertexNormals: true,
                requestWaterMask: false,
            });
            Cesium.Ion.defaultAccessToken = savedToken;
            return provider;
        }
        Cesium.Ion.defaultAccessToken = savedToken;
        throw new Error('No compatible Cesium World Terrain API found (Cesium ' + (Cesium.VERSION || 'unknown') + ')');
    } catch (error) {
        Cesium.Ion.defaultAccessToken = savedToken;
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
    // Cesium World Terrain — free, global ~30m, uses host Cesium Ion token.
    // Self-hosted tiles only for small regions via custom/auto modes.
    return createCesiumWorldTerrain(config.cesiumIonToken);
}
