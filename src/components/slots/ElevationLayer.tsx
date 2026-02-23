import React, { useEffect, useRef, useState } from 'react';
// The host env exposes Cesium globally
declare const Cesium: any;

/**
 * Minimal map-layer component to inject pre-processed Quantized Mesh from MinIO.
 * The core NKZ viewer will call this slot and pass the Cesium viewer instance.
 */
export const ElevationLayer: React.FC<{ viewer?: any }> = ({ viewer }) => {
    const terrainProviderRef = useRef<any>(null);
    const [isLoadingTiles, setIsLoadingTiles] = useState(false);

    useEffect(() => {
        if (!viewer || !viewer.scene) return;

        // Listener for visual feedback (Point 3: Loader/Transitions for Terrain)
        const onTileLoadProgress = (queuedTiles: number) => {
            setIsLoadingTiles(queuedTiles > 0);
        };

        try {
            console.debug("[nkz-module-eu-elevation] Injecting Terrain Provider...");

            // External static MinIO backend bucket or CDN serving Quantized Mesh
            // TERRAIN_URL must be configured via window.__ENV__.TERRAIN_URL or fall back to MinIO path
            const baseUrl = (window as any).__ENV__?.TERRAIN_URL
                || (window.location.origin.includes('localhost')
                    ? 'http://localhost:9000/nekazari-frontend/terrain/uk'
                    : `${window.location.origin}/terrain/uk`);

            const terrainProvider = new Cesium.CesiumTerrainProvider({
                url: baseUrl,
                requestVertexNormals: true,
                requestWaterMask: false,
            });

            terrainProviderRef.current = viewer.terrainProvider;
            viewer.terrainProvider = terrainProvider;

            // Subscribe to globe tile loading events
            if (viewer.scene.globe.tileLoadProgressEvent) {
                viewer.scene.globe.tileLoadProgressEvent.addEventListener(onTileLoadProgress);
            }

        } catch (error) {
            console.error("[nkz-module-eu-elevation] Failed to initialize terrain provider:", error);
        }

        // Cleanup on unmount
        return () => {
            if (viewer && !viewer.isDestroyed()) {
                if (viewer.scene.globe.tileLoadProgressEvent) {
                    viewer.scene.globe.tileLoadProgressEvent.removeEventListener(onTileLoadProgress);
                }
                if (terrainProviderRef.current) {
                    // Restore previous terrain provider 
                    viewer.terrainProvider = terrainProviderRef.current;
                }
            }
        };
    }, [viewer]);

    return (
        <div className={`absolute top-6 left-1/2 transform -translate-x-1/2 bg-slate-900/90 text-slate-200 px-4 py-2 rounded-full border border-slate-700 shadow-xl text-sm flex items-center gap-2 z-50 backdrop-blur-md pointer-events-none transition-opacity duration-500 ease-in-out ${isLoadingTiles ? 'opacity-100' : 'opacity-0'}`}>
            <svg className="animate-spin h-4 w-4 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="font-medium">Ajustando relieve 3D...</span>
        </div>
    );
};

