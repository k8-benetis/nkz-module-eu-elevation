import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth, NKZClient, useTranslation, useViewerOptional } from '@nekazari/sdk';
import { createTerrainProvider, TerrainProviderConfig, TerrainProviderType } from '../../utils/terrainFactory';

declare const Cesium: any;

export interface ElevationLayerConfig {
    id: string;
    name: string;
    url: string;
    bbox_minx?: number;
    bbox_miny?: number;
    bbox_maxx?: number;
    bbox_maxy?: number;
    is_active: boolean;
}

export interface TerrainTokens {
    cesium_ion_token?: string;
    maptiler_api_key?: string;
    custom_terrain_url?: string;
    europe_copernicus_url?: string;
    lidar_mds_url?: string;
    provider_type: string;
}

// EEA ArcGIS REST endpoint is more robust than WMS for CORINE in Cesium 1.100+
const CLC_REST_URL = 'https://image.discomap.eea.europa.eu/arcgis/rest/services/Corine/CLC2018_WM/MapServer';

// =============================================================================
// Host region signal (Sub-feature B: smart region base layer)
// =============================================================================
// The host publishes { currentRegion, layerAutoMode } onto viewer.__nkzRegion.
// This module reads it to decide whether to inject EU elevation terrain.

export interface HostRegion {
  currentRegion: 'navarra' | 'spain' | 'eu' | 'world';
  layerAutoMode: boolean;
}

/**
 * Pure: should the module inject EU elevation terrain?
 * Only when camera is over EU/world AND auto-switching is active.
 * When false, the host manages terrain (IDENA/IGN).
 */
export function shouldInjectEuTerrain(region: HostRegion | null): boolean {
  if (!region) return false;
  if (!region.layerAutoMode) return false;
  return region.currentRegion === 'eu' || region.currentRegion === 'world';
}

function getDefaultCopernicusUrl(): string {
    const w = window as any;
    if (w.__ENV__?.EU_ELEVATION_COPERNICUS_URL) {
        return w.__ENV__.EU_ELEVATION_COPERNICUS_URL;
    }
    // Default: pre-ingested Copernicus GLO-30 tileset hosted on platform MinIO
    return '/api/elevation/terrain/EU/layer.json';
}

export const ElevationLayer: React.FC = () => {
    const { t } = useTranslation('eu-elevation');
    const { getToken, getTenantId } = useAuth();
    const viewerContext = useViewerOptional();
    const viewer = viewerContext?.cesiumViewer;

    useEffect(() => {
        console.warn('[ElevationLayer] 🟢 Component mounted - Version: 1.0.0-audit-FINAL');
    }, []);

    const apiClient = React.useMemo(() => new NKZClient({
        baseUrl: '/api/elevation',
        getToken,
        getTenantId
    }), [getToken, getTenantId]);

    const activeProviderRef = useRef<any>(null);
    const clcLayerRef = useRef<any>(null);
    const [isLoadingTiles, setIsLoadingTiles] = useState(false);
    const layersRef = useRef<ElevationLayerConfig[]>([]);
    const tokensRef = useRef<TerrainTokens | null>(null);
    const currentModeRef = useRef<TerrainProviderType>('off');

    // Fetch tokens + layers on mount (for reference, don't apply default provider)
    useEffect(() => {
        Promise.all([
            apiClient.get<TerrainTokens>('/preferences/tokens').catch(() => null),
            apiClient.get<ElevationLayerConfig[]>('/layers').catch(() => []),
        ]).then(([tok, layers]) => {
            tokensRef.current = tok;
            layersRef.current = layers || [];
            // Apply the terrain provider — including europe_copernicus (Copernicus GLO-30).
            if (viewer && tok) {
                applyPreference(tok, layers || []);
            }
        });
    }, [viewer]);

    const lastAppliedRef = useRef<string>('');

    const hasHostTerrain = useCallback((): boolean => {
        if (!viewer) return false;
        const tp = viewer.terrainProvider;
        // If the host already loaded a real terrain (IGN/IDENA, Cesium World, MapTiler, etc.),
        // don't replace it with a potentially lower-resolution provider.
        // EllipsoidTerrainProvider means flat/disabled — safe to override.
        if (!tp) return false;
        const name = tp.constructor?.name || '';
        return name !== 'EllipsoidTerrainProvider';
    }, [viewer]);

    const applyPreference = useCallback((tok: TerrainTokens, _layers: ElevationLayerConfig[]) => {
        if (!viewer) return;
        if (applyingRef.current) return; // Don't stack async terrain changes

        currentModeRef.current = tok.provider_type as TerrainProviderType;

        let config: TerrainProviderConfig;

        if (tok.provider_type === 'auto') {
            // Auto mode is now driven by the host region signal (Sub-feature B).
            // The moveEnd listener above handles EU terrain injection via
            // viewer.__nkzRegion. Here we just defer to the host.
            return;
        } else if (!tok.provider_type) {
            // Unset — host manages terrain (IGN/IDENA).
            return;
        } else if (tok.provider_type === 'europe_copernicus') {
            // Copernicus GLO-30 is a fallback — never replace better host terrain (IGN/IDENA).
            if (hasHostTerrain()) {
                console.log('[Elevation] Host terrain already active (IGN/IDENA) — keeping it instead of Copernicus 30m');
                return;
            }
            config = { type: 'europe_copernicus' as const, cesiumIonToken: tok.cesium_ion_token, europeCopernicusUrl: getDefaultCopernicusUrl() };
        } else if (tok.provider_type === 'custom' && tok.custom_terrain_url) {
            config = { type: 'custom', customUrl: tok.custom_terrain_url };
        } else if (tok.provider_type === 'maptiler') {
            config = { type: 'maptiler', maptilerApiKey: tok.maptiler_api_key };
        } else if (tok.provider_type === 'lidar_mds') {
            config = { type: 'lidar_mds', customUrl: tok.lidar_mds_url };
        } else if (tok.provider_type === 'cesium_world') {
            if (!tok.cesium_ion_token) {
                console.warn('[Elevation] Cesium World Terrain selected but no token configured — keeping current terrain');
                return;
            }
            // Cesium World Terrain (global 30m) — also never replace better host terrain.
            if (hasHostTerrain()) {
                console.log('[Elevation] Host terrain already active — keeping it instead of Cesium World');
                return;
            }
            config = { type: 'cesium_world', cesiumIonToken: tok.cesium_ion_token };
        } else {
            // Unknown provider — do nothing, let the host manage terrain.
            console.warn('[Elevation] Unknown terrain provider type:', tok.provider_type, '— keeping host terrain');
            return;
        }

        // Skip if same provider type already applied (prevents flicker loops)
        if (lastAppliedRef.current === tok.provider_type) return;
        lastAppliedRef.current = tok.provider_type;

        console.log('[Elevation] Applying terrain:', tok.provider_type);
        const provider = createTerrainProvider(config);
        setTerrainProvider(provider);
    }, [viewer]);


    const applyingRef = useRef(false);

    const setTerrainProvider = (provider: any) => {
        if (!viewer) return;
        // Don't stack multiple async terrain changes — cause of black flashes
        if (applyingRef.current) return;

        if (provider && typeof provider.then === 'function') {
            applyingRef.current = true;
            provider.then((resolved: any) => {
                applyingRef.current = false;
                if (!viewer.isDestroyed()) {
                    activeProviderRef.current = resolved;
                    viewer.terrainProvider = resolved;
                }
            }).catch((err: any) => {
                applyingRef.current = false;
                console.warn('[Elevation] Async terrain provider failed:', err);
            });
        } else {
            activeProviderRef.current = provider;
            try {
                viewer.terrainProvider = provider;
            } catch (error) {
                console.error('[Elevation] Failed to set terrain provider:', error);
            }
        }
    };

    const addCLCLayer = useCallback(async (opacity: number = 0.6) => {
        if (!viewer || clcLayerRef.current) return;
        
        try {
            console.log('[ElevationLayer] 🛰️ Injecting CORINE Land Cover (ArcGIS REST)...');
            
            // Explicitly use global window.Cesium to ensure we hit the host's version
            const C = (window as any).Cesium || Cesium;
            let clcProvider;

            if (C.ArcGisMapServerImageryProvider.fromUrl) {
                clcProvider = await C.ArcGisMapServerImageryProvider.fromUrl(CLC_REST_URL, {
                    enablePickFeatures: false,
                    credit: new Cesium.Credit('© EEA Copernicus Land Monitoring Service — CORINE Land Cover 2018'),
                });
            } else {
                clcProvider = new C.ArcGisMapServerImageryProvider({
                    url: CLC_REST_URL,
                    enablePickFeatures: false
                });
            }

            clcLayerRef.current = viewer.imageryLayers.addImageryProvider(clcProvider);
            clcLayerRef.current.alpha = opacity;
            viewer.imageryLayers.raiseToTop(clcLayerRef.current);
            
            console.log('[ElevationLayer] ✅ CLC Layer active');
        } catch (error) {
            console.error('[ElevationLayer] 💥 Fatal error adding CLC layer:', error);
        }
    }, [viewer]);

    const removeCLCLayer = useCallback(() => {
        if (!viewer || !clcLayerRef.current) return;
        try {
            viewer.imageryLayers.remove(clcLayerRef.current, true);
            clcLayerRef.current = null;
        } catch (error) {
            console.error('[Elevation] Failed to remove CLC layer:', error);
        }
    }, [viewer]);

    const updateCLCOpacity = useCallback((opacity: number) => {
        if (clcLayerRef.current) {
            clcLayerRef.current.alpha = opacity;
        }
    }, []);

    useEffect(() => {
        if (!viewer?.scene) return;

        const onTileLoadProgress = (queuedTiles: number) => {
            setIsLoadingTiles(queuedTiles > 0);
        };
        if (viewer.scene.globe.tileLoadProgressEvent) {
            viewer.scene.globe.tileLoadProgressEvent.addEventListener(onTileLoadProgress);
        }

        const onPrefChange = (e: any) => {
            const detail = e.detail;
            if (detail.mode === 'refresh') {
                Promise.all([
                    apiClient.get<TerrainTokens>('/preferences/tokens').catch(() => null),
                    apiClient.get<ElevationLayerConfig[]>('/layers').catch(() => []),
                ]).then(([tok, layers]) => {
                    if (!tok) return;
                    tokensRef.current = tok;
                    layersRef.current = layers || [];
                    if (!tok.provider_type || tok.provider_type === 'europe_copernicus') {
                        // User switched back to default — restore host terrain.
                        lastAppliedRef.current = '';
                        const cam = viewer.camera;
                        if (cam) viewer.camera.moveEnd.raiseEvent();
                        return;
                    }
                    applyPreference(tok, layers || []);
                });
            }
        };

        const onCLCToggle = (e: any) => {
            const { enabled, opacity } = e.detail;
            if (enabled) {
                if (!clcLayerRef.current) addCLCLayer(opacity);
                else updateCLCOpacity(opacity);
            } else {
                removeCLCLayer();
            }
        };

        window.addEventListener('nkz.elevation.change', onPrefChange);
        window.addEventListener('nkz.clc.toggle', onCLCToggle);

        const savedCLC = localStorage.getItem('nkz_clc_enabled') === 'true';
        const savedOpacity = parseFloat(localStorage.getItem('nkz_clc_opacity') || '0.6');
        if (savedCLC) addCLCLayer(savedOpacity);

        // Subscribe to host region signal (Sub-feature B).
        // Overrides the internal camera-match auto for 'auto' mode.
        // For non-auto modes (europe_copernicus, cesium_world, etc.),
        // the existing preference-driven applyPreference still applies.
        const tryInjectEuTerrain = () => {
            const nkzRegion = (viewer as any).__nkzRegion as HostRegion | undefined;
            if (!shouldInjectEuTerrain(nkzRegion ?? null)) return;
            if (lastAppliedRef.current === 'europe_copernicus') return; // already active
            lastAppliedRef.current = 'europe_copernicus';
            const config: TerrainProviderConfig = {
                type: 'europe_copernicus',
                europeCopernicusUrl: getDefaultCopernicusUrl(),
            };
            const provider = createTerrainProvider(config);
            setTerrainProvider(provider);
        };

        const clearEuTerrain = () => {
            // Region is Navarra/Spain or manual override → let host manage terrain.
            // NEVER reset to Ellipsoid here: the host's useTerrainProvider will set
            // IDENA/IGN for Spain or delegate back to us for EU. Resetting to
            // Ellipsoid causes a one-frame flat terrain flash and races with the
            // host's delayed React effect that updates __nkzRegion.
            activeProviderRef.current = null;
            lastAppliedRef.current = '';
        };

        viewer.camera.moveEnd.addEventListener(() => {
            const nkzRegion = (viewer as any).__nkzRegion as HostRegion | undefined;
            if (shouldInjectEuTerrain(nkzRegion ?? null)) {
                // Host says EU/world + auto — inject EU elevation terrain.
                // NOTE: No hasHostTerrain() guard here. The user may have moved from
                // Spain (IGN terrain active) to EU. IGN doesn't cover France, so we
                // MUST replace it with EU elevation. The guard only applies in manual
                // provider selection (applyPreference) where keeping high-res IGN/IDENA
                // over lower-res Copernicus 30m is intentional.
                tryInjectEuTerrain();
            } else {
                clearEuTerrain();
            }
        });

        // Initial evaluation — handles the case where camera is already over EU/world
        // terrain when this component mounts. The initial moveEnd may have fired before
        // our listener was registered, so we evaluate once immediately.
        tryInjectEuTerrain();

        return () => {
            window.removeEventListener('nkz.elevation.change', onPrefChange);
            window.removeEventListener('nkz.clc.toggle', onCLCToggle);
            removeCLCLayer();
            if (viewer && !viewer.isDestroyed()) {
                if (viewer.scene.globe.tileLoadProgressEvent) {
                    viewer.scene.globe.tileLoadProgressEvent.removeEventListener(onTileLoadProgress);
                }
                // Only reset terrain if WE set it (Copernicus/MapTiler/Custom).
                // If host terrain (IGN/IDENA) was active, leave it untouched.
                if (activeProviderRef.current) {
                    viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
                    activeProviderRef.current = null;
                }
            }
        };
    }, [viewer, addCLCLayer, removeCLCLayer, updateCLCOpacity]);

    return (
        <div className={`absolute top-6 left-1/2 transform -translate-x-1/2 bg-slate-900 text-slate-100 px-4 py-2 rounded-full border border-slate-700 shadow-lg text-sm flex items-center gap-2 z-50 pointer-events-none transition-opacity duration-500 ease-in-out ${isLoadingTiles ? 'opacity-100' : 'opacity-0'}`}>
            <svg className="animate-spin h-4 w-4 text-green-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="font-medium text-green-300">{t('updatingRelief', 'Updating 3D Relief...')}</span>
        </div>
    );
};

export default ElevationLayer;
