import React, { useState, useEffect } from 'react';
import { Layers, Globe } from 'lucide-react';

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

export const ElevationAdminControl: React.FC = () => {
    const [layers, setLayers] = useState<ElevationLayer[]>([]);
    const [selected, setSelected] = useState<string>('auto');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Load initial preference
        const savedPref = localStorage.getItem('nkz_elevation_pref');
        if (savedPref) {
            setSelected(savedPref);
        }

        const fetchLayers = async () => {
            try {
                const res = await fetch('/api/elevation/layers');
                if (res.ok) {
                    const data = await res.json();
                    setLayers(data);
                }
            } catch (err) {
                console.error("Failed to fetch terrain layers", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchLayers();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const mode = e.target.value;
        setSelected(mode);
        localStorage.setItem('nkz_elevation_pref', mode);

        let detail: any = { mode };
        if (mode !== 'auto' && mode !== 'off') {
            const layer = layers.find(l => l.id === mode);
            detail = { mode: 'layer', layer };
        }

        window.dispatchEvent(new CustomEvent('nkz.elevation.change', { detail }));
    };

    return (
        <div className="bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-700/50 shadow-xl p-5 flex flex-col space-y-3 relative overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 mb-1">
                <Globe className="w-5 h-5 text-emerald-400" />
                <h3 className="text-white font-semibold flex-1">3D Terrain</h3>
            </div>

            <p className="text-xs text-slate-400 mb-2">
                Select the active elevation provider for the 3D globe.
            </p>

            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Layers className="h-4 w-4 text-emerald-500" />
                </div>
                <select
                    value={selected}
                    onChange={handleChange}
                    disabled={isLoading}
                    className="w-full pl-10 pr-8 py-2.5 bg-slate-800/80 border border-slate-700 text-white text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 appearance-none shadow-inner"
                >
                    <option value="auto">Automatic (By Region)</option>
                    <option value="off">Off (Flat Map)</option>
                    {layers.length > 0 && <optgroup label="Custom Topography">
                        {layers.map(layer => (
                            <option key={layer.id} value={layer.id}>
                                {layer.name}
                            </option>
                        ))}
                    </optgroup>}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
            </div>
        </div>
    );
};

export default ElevationAdminControl;
