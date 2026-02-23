import React, { useState, useEffect, useMemo } from 'react';
import { TerrainIngestionForm } from './TerrainIngestionForm';
import { Trash2, Plus, RefreshCw, Layers, Info } from 'lucide-react';
import { useAuth, NKZClient, useTranslation } from '@nekazari/sdk';

export interface ElevationLayer {
    id: string;
    name: string;
    url: string;
    bbox_minx?: number;
    bbox_miny?: number;
    bbox_maxx?: number;
    bbox_maxy?: number;
    is_active: boolean;
}

export const MainView: React.FC = () => {
    const { t } = useTranslation('eu-elevation');
    const { getToken, getTenantId } = useAuth();

    const apiClient = useMemo(() => new NKZClient({
        baseUrl: '/api/elevation',
        getToken,
        getTenantId
    }), [getToken, getTenantId]);

    const [layers, setLayers] = useState<ElevationLayer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);

    // New layer form state
    const [newName, setNewName] = useState('');
    const [newUrl, setNewUrl] = useState('');
    const [newBbox, setNewBbox] = useState('');

    const fetchLayers = async () => {
        setIsLoading(true);
        try {
            const data = await apiClient.get<ElevationLayer[]>('/layers');
            setLayers(data);
        } catch (err) {
            console.error("Failed to fetch custom terrain layers", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLayers();
    }, []);

    const handleDelete = async (id: string) => {
        if (!window.confirm(t('confirmDelete', 'Delete this terrain layer?'))) return;
        try {
            await apiClient.delete(`/layers/${id}`);
            setLayers(layers.filter(l => l.id !== id));
        } catch (err) {
            console.error("Failed to delete layer", err);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();

        // Parse BBOX if exists
        let bboxArgs = {};
        if (newBbox.trim()) {
            const parts = newBbox.split(',').map(s => parseFloat(s.trim()));
            if (parts.length === 4 && !parts.some(isNaN)) {
                bboxArgs = {
                    bbox_minx: parts[0],
                    bbox_miny: parts[1],
                    bbox_maxx: parts[2],
                    bbox_maxy: parts[3]
                };
            }
        }

        try {
            await apiClient.post('/layers', {
                name: newName,
                url: newUrl,
                is_active: true,
                ...bboxArgs
            });

            setNewName('');
            setNewUrl('');
            setNewBbox('');
            setIsCreating(false);
            fetchLayers();
        } catch (err) {
            console.error("Failed to create custom terrain layer", err);
        }
    };

    return (
        <div className="w-full h-full p-6 lg:p-10 bg-gray-50 border-l border-gray-200 overflow-y-auto">
            <div className="max-w-6xl mx-auto space-y-8">
                {/* Header */}
                <div className="pb-6 border-b border-gray-200">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">{t('title', 'EU Elevation Module')}</h1>
                    <p className="text-gray-600 max-w-3xl leading-relaxed text-base">
                        {t('description', 'Administrate dynamic 3D Terrain Providers for your digital twin. Generate new quantized meshes from raw data or register existing external services to visualize them instantly in the Unified Viewer.')}
                    </p>
                </div>

                {/* Documentation Section */}
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-8 flex gap-4 text-blue-800">
                    <Info className="min-w-[24px] mt-0.5 text-blue-500" />
                    <div className="space-y-2 text-sm">
                        <h3 className="font-semibold text-base text-blue-900">{t('howToUseTitle', 'How to use this module')}</h3>
                        <p>{t('howToUse1', '1. This module globally registers a new layer type in the Unified Viewer. Once activated, a new "3D Terrain" selector will appear in the right contextual panel of the map.')}</p>
                        <p>{t('howToUse2', '2. By default, the map runs in "Auto" mode. As you navigate the map, the module dynamically searches the list below for a terrain source whose "Bounding Box" contains the camera position.')}</p>
                        <p>{t('howToUse3', '3. You can manually forcefully enable/disable terrain or pick a specific data source from the selector regardless of location.')}</p>
                        <p>{t('howToUse4', '4. Use the "Add Terrain Source" button to register URLs pointing to your own pre-generated Cesium Terrain Providers globally.')}</p>
                        <p>{t('howToUse5', '5. To automatically generate and ingest fresh quantized mesh terrain from any WCS endpoint (like IGN-Spain) or local GeoTIFF file, use the "Run Ingestion Pipeline" dashboard on the right.')}</p>
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* Left Column: Management */}
                    <div className="lg:col-span-7 space-y-6">
                        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                                    <Layers className="w-5 h-5 text-green-600" />
                                    {t('configuredSources', 'Configured Terrain Sources')}
                                </h2>
                                <button onClick={fetchLayers} className="p-2 text-gray-400 hover:text-gray-700 transition-colors rounded-full hover:bg-gray-100">
                                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                                </button>
                            </div>

                            <div className="p-0">
                                {layers.length === 0 && !isLoading ? (
                                    <div className="p-8 text-center text-gray-500 bg-white">
                                        <p>{t('noSources', 'No custom terrain layers configured.')}</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-100 bg-white">
                                        {layers.map(layer => (
                                            <div key={layer.id} className="p-5 flex items-start justify-between group hover:bg-gray-50 transition-colors">
                                                <div className="space-y-1">
                                                    <h3 className="font-medium text-gray-800">{layer.name}</h3>
                                                    <a href={layer.url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:text-blue-800 hover:underline break-all block">
                                                        {layer.url}
                                                    </a>
                                                    {(layer.bbox_minx !== undefined && layer.bbox_minx !== null) && (
                                                        <p className="text-xs text-gray-500 mt-2 font-mono bg-gray-100 inline-block px-2 py-1 rounded">
                                                            {t('bboxLabel', 'BBOX')}: [{layer.bbox_minx}, {layer.bbox_miny}, {layer.bbox_maxx}, {layer.bbox_maxy}]
                                                        </p>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => handleDelete(layer.id)}
                                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all font-medium"
                                                    title={t('deleteSource', 'Delete Source')}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Add New Layer Form */}
                            <div className="p-5 bg-gray-50 border-t border-gray-200">
                                {!isCreating ? (
                                    <button
                                        onClick={() => setIsCreating(true)}
                                        className="w-full py-3 flex items-center justify-center gap-2 text-green-700 font-medium border border-dashed border-green-300 bg-green-50/50 rounded-xl hover:bg-green-100/50 transition-colors"
                                    >
                                        <Plus className="w-4 h-4" /> {t('addSourceBtn', 'Add Terrain Source')}
                                    </button>
                                ) : (
                                    <form onSubmit={handleCreate} className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-gray-600">{t('layerName', 'Layer Name')} <span className="text-red-500">*</span></label>
                                                <input
                                                    type="text" required value={newName} onChange={e => setNewName(e.target.value)}
                                                    placeholder="UK Environment Agency 1m"
                                                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-800 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition-shadow"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-gray-600">{t('bboxOptional', 'Bounding Box (Optional EPSG:4326)')}</label>
                                                <input
                                                    type="text" value={newBbox} onChange={e => setNewBbox(e.target.value)}
                                                    placeholder="minX, minY, maxX, maxY"
                                                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-800 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition-shadow"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-gray-600">{t('cesiumUrl', 'Cesium Terrain Provider URL')} <span className="text-red-500">*</span></label>
                                            <input
                                                type="url" required value={newUrl} onChange={e => setNewUrl(e.target.value)}
                                                placeholder="https://terrain.robotika.cloud/uk"
                                                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-800 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition-shadow font-mono"
                                            />
                                        </div>
                                        <div className="flex justify-end gap-3 pt-2">
                                            <button
                                                type="button"
                                                onClick={() => setIsCreating(false)}
                                                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors rounded-lg hover:bg-gray-100"
                                            >
                                                {t('cancel', 'Cancel')}
                                            </button>
                                            <button
                                                type="submit"
                                                className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors shadow-sm"
                                            >
                                                {t('registerLayer', 'Register Layer')}
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        </section>
                    </div>

                    {/* Right Column: Ingestion Tools */}
                    <div className="lg:col-span-5">
                        <div className="sticky top-10">
                            <TerrainIngestionForm />
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default MainView;
