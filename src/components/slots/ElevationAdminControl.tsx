import React, { useState } from 'react';

/**
 * Admin Panel for triggering EU Elevation Ingestion process via BBOX.
 * Renders in a dashboard-widget or context-panel.
 */
export const ElevationAdminControl: React.FC = () => {
    const [countryCode, setCountryCode] = useState('uk');
    const [bbox, setBbox] = useState('');
    const [urls, setUrls] = useState('');
    const [status, setStatus] = useState<{ message: string; isError: boolean } | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setStatus(null);

        try {
            // Parse BBOX (minX, minY, maxX, maxY)
            const parsedBbox = bbox.split(',').map(s => parseFloat(s.trim()));
            if (parsedBbox.length !== 4 || parsedBbox.some(isNaN)) {
                throw new Error("Invalid BBOX format. Use 'minX,minY,maxX,maxY'");
            }

            // Parse URLs
            const parsedUrls = urls.split('\n').map(s => s.trim()).filter(s => s.length > 0);
            if (parsedUrls.length === 0) {
                throw new Error("Provide at least one source URL");
            }

            // Make API request (using Nekazari proxy routing)
            const response = await fetch('/api/elevation/ingest', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Note: Auth token should be injected by the SDK or handled via interceptors
                },
                body: JSON.stringify({
                    country_code: countryCode,
                    bbox: parsedBbox as [number, number, number, number],
                    source_urls: parsedUrls
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Ingestion request failed');
            }

            const data = await response.json();
            setStatus({ message: `Success! Job ID: ${data.job_id}`, isError: false });
        } catch (error: any) {
            setStatus({ message: error.message, isError: true });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 p-4 w-full flex flex-col space-y-4">
            <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                <h2 className="text-white font-semibold flex items-center gap-2">
                    🌍 EU Elevation Processing
                </h2>
                <span className="bg-blue-900 text-blue-300 text-xs px-2 py-1 rounded">Admin Only</span>
            </div>

            <p className="text-slate-400 text-sm">
                Enqueue Quantized Mesh processing for a specific region. The system will download WCS/GeoTIFF endpoints for the BBOX, reproject to EPSG:4326, decimate the mesh, and upload it as .terrain to MinIO.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col space-y-3">
                <div>
                    <label className="block text-slate-300 text-sm mb-1">Country/Region Code</label>
                    <input
                        type="text"
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        placeholder="e.g. uk, es, nl"
                        className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none"
                    />
                </div>

                <div>
                    <label className="block text-slate-300 text-sm mb-1">Bounding Box (EPSG:4326)</label>
                    <input
                        type="text"
                        value={bbox}
                        onChange={(e) => setBbox(e.target.value)}
                        placeholder="minX, minY, maxX, maxY"
                        className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <p className="text-xs text-slate-500 mt-1">Example: -2.5,42.0,-1.0,43.5</p>
                </div>

                <div>
                    <label className="block text-slate-300 text-sm mb-1">Source URLs (One per line)</label>
                    <textarea
                        value={urls}
                        onChange={(e) => setUrls(e.target.value)}
                        placeholder="https://server/wcs?request=GetCoverage..."
                        rows={4}
                        className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none font-mono"
                    />
                </div>

                <div className="pt-2">
                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-2 px-4 rounded font-medium transition-colors ${loading ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white'
                            }`}
                    >
                        {loading ? 'Submitting to Celery...' : 'Start Ingestion Pipeline'}
                    </button>
                </div>
            </form>

            {status && (
                <div className={`p-3 rounded text-sm ${status.isError ? 'bg-red-900/30 text-red-400 border border-red-800' : 'bg-green-900/30 text-green-400 border border-green-800'}`}>
                    {status.message}
                </div>
            )}
        </div>
    );
};
