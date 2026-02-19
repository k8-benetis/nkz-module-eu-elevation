import { useEffect, useRef } from 'react';
// The host env exposes Cesium globally
declare const Cesium: any;

/**
 * Minimal map-layer component to inject pre-processed Quantized Mesh from MinIO.
 * The core NKZ viewer will call this slot.
 */
export const ElevationLayer: React.FC<{ viewer?: any }> = ({ viewer }) => {
    const terrainProviderRef = useRef<any>(null);

    useEffect(() => {
        if (!viewer) return;

        // Ensure that this layer only applies when there isn't a custom terrain already overriding it
        try {
            // Note: In a full module implementation, the URL would be fetched via `/api/modules/me/config`
            // But for this elevation mesh factory, we point to the static MinIO backend bucket
            console.debug("[nkz-module-eu-elevation] Injecting Terrain Provider...");

            // Example statically pointing to where MinIO/Nginx exposes the processed layers
            // the pipeline uploads layer.json inside terrain/<country_code>
            const baseUrl = window.location.origin.includes('localhost')
                ? 'http://localhost:9000/nekazari-frontend/terrain/uk' // Local Dev MinIO fallback
                : 'https://terrain.robotika.cloud/uk';                 // Production static Nginx

            const terrainProvider = new Cesium.CesiumTerrainProvider({
                url: baseUrl,
                requestVertexNormals: true, // Needed for lighting
                requestWaterMask: false,
            });

            // Set the viewer's terrain provider
            // NOTE: the main host (`CesiumMap.tsx`) must expose a way to accept terrain providers,
            // or we override it directly here 
            terrainProviderRef.current = viewer.terrainProvider;
            viewer.terrainProvider = terrainProvider;

        } catch (error) {
            console.error("[nkz-module-eu-elevation] Failed to initialize terrain provider:", error);
        }

        // Cleanup on unmount
        return () => {
            if (viewer && !viewer.isDestroyed() && terrainProviderRef.current) {
                // Restore previous terrain provider (typically EllipsoidTerrainProvider)
                viewer.terrainProvider = terrainProviderRef.current;
            }
        };
    }, [viewer]);

    return null; // This is a logic-only component that interacts with the Cesium Viewer API
};
