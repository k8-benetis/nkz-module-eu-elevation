import React, { useState, useEffect } from 'react';
import { TerrainIngestionForm } from './TerrainIngestionForm';
import { Trash2, Plus, RefreshCw, Layers } from 'lucide-react';

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
            const res = await fetch('/api/elevation/layers');
            if (res.ok) {
                const data = await res.json();
                setLayers(data);
            }
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
        if (!window.confirm("Delete this terrain layer?")) return;
        try {
            const res = await fetch(`/api/elevation/layers/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setLayers(layers.filter(l => l.id !== id));
            }
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
            const res = await fetch('/api/elevation/layers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newName,
                    url: newUrl,
                    is_active: true,
                    ...bboxArgs
                })
            });
            if (res.ok) {
                setNewName('');
                setNewUrl('');
                setNewBbox('');
                setIsCreating(false);
                fetchLayers();
            }
        } catch (err) {
            console.error("Failed to create custom terrain layer", err);
        }
    };

    return (
        <div className="w-full h-full p-6 lg:p-10 bg-slate-900 border-l border-slate-700 overflow-y-auto">
            <div className="max-w-5xl mx-auto space-y-10">
                {/* Header */}
                <div className="pb-6 border-b border-slate-800">
                    <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">EU Elevation Module</h1>
                    <p className="text-slate-400 max-w-2xl leading-relaxed">
                        Administrate dynamic 3D Terrain Providers for your digital twin.
                        Generate new quantized meshes from raw data or register existing external services to visualize them instantly in the Unified Viewer.
                    </p>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* Left Column: Management */}
                    <div className="lg:col-span-7 space-y-6">
                        <section className="bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-700/50 shadow-xl overflow-hidden">
                            <div className="p-5 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/20">
                                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                                    <Layers className="w-5 h-5 text-emerald-400" />
                                    Configured Terrain Sources
                                </h2>
                                <button onClick={fetchLayers} className="p-2 text-slate-400 hover:text-white transition-colors rounded-full hover:bg-slate-800">
                                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                                </button>
                            </div>

                            <div className="p-0">
                                {layers.length === 0 && !isLoading ? (
                                    <div className="p-8 text-center text-slate-500">
                                        <p>No custom terrain layers configured.</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-800/50">
                                        {layers.map(layer => (
                                            <div key={layer.id} className="p-5 flex items-start justify-between group hover:bg-slate-800/30 transition-colors">
                                                <div className="space-y-1">
                                                    <h3 className="font-medium text-slate-200">{layer.name}</h3>
                                                    <a href={layer.url} target="_blank" rel="noreferrer" className="text-sm text-blue-400 hover:underline break-all block">
                                                        {layer.url}
                                                    </a>
                                                    {(layer.bbox_minx !== undefined && layer.bbox_minx !== null) && (
                                                        <p className="text-xs text-slate-500 mt-2 font-mono bg-slate-900/50 inline-block px-2 py-1 rounded">
                                                            BBOX: [{layer.bbox_minx}, {layer.bbox_miny}, {layer.bbox_maxx}, {layer.bbox_maxy}]
                                                        </p>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => handleDelete(layer.id)}
                                                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded opacity-0 group-hover:opacity-100 transition-all"
                                                    title="Delete Source"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Add New Layer Form */}
                            <div className="p-5 bg-slate-800/30 border-t border-slate-700/50">
                                {!isCreating ? (
                                    <button
                                        onClick={() => setIsCreating(true)}
                                        className="w-full py-3 flex items-center justify-center gap-2 text-emerald-400 border border-dashed border-emerald-900/50 rounded-xl hover:bg-emerald-900/10 transition-colors"
                                    >
                                        <Plus className="w-4 h-4" /> Add Terrain Source
                                    </button>
                                ) : (
                                    <form onSubmit={handleCreate} className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400">Layer Name <span className="text-red-400">*</span></label>
                                                <input
                                                    type="text" required value={newName} onChange={e => setNewName(e.target.value)}
                                                    placeholder="UK Environment Agency 1m"
                                                    className="w-full bg-slate-900/80 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500 focus:outline-none"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400">Bounding Box (Optional EPSG:4326)</label>
                                                <input
                                                    type="text" value={newBbox} onChange={e => setNewBbox(e.target.value)}
                                                    placeholder="minX, minY, maxX, maxY"
                                                    className="w-full bg-slate-900/80 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500 focus:outline-none"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs text-slate-400">Cesium Terrain Provider URL <span className="text-red-400">*</span></label>
                                            <input
                                                type="url" required value={newUrl} onChange={e => setNewUrl(e.target.value)}
                                                placeholder="https://terrain.robotika.cloud/uk"
                                                className="w-full bg-slate-900/80 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500 focus:outline-none font-mono"
                                            />
                                        </div>
                                        <div className="flex justify-end gap-3 pt-2">
                                            <button
                                                type="button"
                                                onClick={() => setIsCreating(false)}
                                                className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors shadow-lg shadow-emerald-900/20"
                                            >
                                                Register Layer
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
                            {/* Re-use the existing admin control panel as the creation engine view UI */}
                            {/* But override the native styles with our new glassmorphism theme via global CSS injection or refactoring */}
                            <TerrainIngestionForm />
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default MainView;
