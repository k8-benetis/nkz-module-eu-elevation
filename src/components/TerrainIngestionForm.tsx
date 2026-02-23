import React, { useState, useRef, useEffect } from 'react';

/**
 * Admin Panel for triggering EU Elevation Ingestion process via BBOX.
 * Renders in a dashboard-widget or context-panel.
 */
export const TerrainIngestionForm: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'remote' | 'local'>('remote');
    const [countryCode, setCountryCode] = useState('uk');
    const [bbox, setBbox] = useState('');
    const [urls, setUrls] = useState('');
    const [localFile, setLocalFile] = useState<File | null>(null);
    const [status, setStatus] = useState<{ message: string; isError: boolean } | null>(null);
    const [loading, setLoading] = useState(false);

    // WebSocket Progress State
    const [progress, setProgress] = useState<{ percent: number, message: string } | null>(null);
    const wsRef = useRef<WebSocket | null>(null);

    // Cleanup websocket on unmount
    useEffect(() => {
        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, []);

    const connectWebSocket = (jobId: string) => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/elevation/ws/status/${jobId}`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);

                setProgress({
                    percent: payload.progress || 0,
                    message: payload.message || `Status: ${payload.status}`
                });

                if (payload.status === 'SUCCESS') {
                    setStatus({ message: `Pipeline Completed! Data is ready in MinIO.`, isError: false });
                    setLoading(false);
                    ws.close();
                } else if (payload.status === 'FAILURE' || payload.error) {
                    setStatus({ message: `Pipeline Failed: ${payload.message}`, isError: true });
                    setLoading(false);
                    ws.close();
                }
            } catch (e) {
                console.error("Failed to parse WS message", e);
            }
        };

        ws.onerror = (error) => {
            console.error("WebSocket error:", error);
            setStatus({ message: "WebSocket connection error", isError: true });
            setLoading(false);
            ws.close();
        };

        ws.onclose = () => {
            wsRef.current = null;
        };
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setStatus(null);
        setProgress(null);

        if (wsRef.current) {
            wsRef.current.close();
        }

        try {
            // Parse BBOX (minX, minY, maxX, maxY)
            let parsedBbox: number[] | null = null;
            if (bbox.trim()) {
                parsedBbox = bbox.split(',').map(s => parseFloat(s.trim()));
                if (parsedBbox.length !== 4 || parsedBbox.some(isNaN)) {
                    throw new Error("Invalid BBOX format. Use 'minX,minY,maxX,maxY'");
                }
            } else if (activeTab === 'remote') {
                throw new Error("BBOX is required for remote URLs");
            }

            let response;
            if (activeTab === 'remote') {
                const parsedUrls = urls.split('\n').map(s => s.trim()).filter(s => s.length > 0);
                if (parsedUrls.length === 0) {
                    throw new Error("Provide at least one source URL");
                }

                response = await fetch('/api/elevation/ingest', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        country_code: countryCode,
                        bbox: parsedBbox as [number, number, number, number],
                        source_urls: parsedUrls
                    })
                });
            } else {
                if (!localFile) throw new Error("Please select a file to upload");

                const formData = new FormData();
                formData.append('file', localFile);
                formData.append('country_code', countryCode);
                if (bbox.trim()) formData.append('bbox', bbox.trim());

                response = await fetch('/api/elevation/upload', {
                    method: 'POST',
                    body: formData
                });
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Ingestion request failed');
            }

            const data = await response.json();
            setStatus({ message: `Job Queued: ${data.job_id}. Connecting to worker...`, isError: false });
            connectWebSocket(data.job_id);

        } catch (error: any) {
            setStatus({ message: error.message, isError: true });
            setLoading(false);
        }
    };

    return (
        <div className="bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-700/50 shadow-xl overflow-hidden p-6 w-full flex flex-col space-y-6">
            <div className="flex justify-between items-center border-b border-slate-700/50 pb-4">
                <h2 className="text-white font-semibold flex items-center gap-2">
                    🌍 Run Ingestion Pipeline
                </h2>
                <span className="bg-emerald-900/30 text-emerald-400 border border-emerald-800/50 text-xs px-2 py-1 rounded-md">BBOX Task</span>
            </div>

            <p className="text-slate-400 text-sm">
                Enqueue Quantized Mesh processing for a specific region.
            </p>

            <div className="flex space-x-2 border-b border-slate-700 pb-2">
                <button
                    onClick={() => setActiveTab('remote')}
                    className={`px-3 py-1 text-sm rounded transition-colors ${activeTab === 'remote' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}
                >
                    Remote URLs
                </button>
                <button
                    onClick={() => setActiveTab('local')}
                    className={`px-3 py-1 text-sm rounded transition-colors ${activeTab === 'local' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}
                >
                    Local File Upload
                </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-slate-300 text-sm mb-1">Country/Region Code</label>
                        <input
                            type="text"
                            value={countryCode}
                            onChange={(e) => setCountryCode(e.target.value)}
                            placeholder="e.g. uk, es, nl"
                            className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none"
                            disabled={loading && progress !== null}
                        />
                    </div>

                    <div>
                        <label className="block text-slate-300 text-sm mb-1">
                            Bounding Box (EPSG:4326) {activeTab === 'local' && <span className="text-xs text-slate-500">(Optional)</span>}
                        </label>
                        <input
                            type="text"
                            value={bbox}
                            onChange={(e) => setBbox(e.target.value)}
                            placeholder="minX, minY, maxX, maxY"
                            className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            disabled={loading && progress !== null}
                        />
                    </div>
                </div>

                {activeTab === 'remote' ? (
                    <div>
                        <label className="block text-slate-300 text-sm mb-1">Source URLs (One per line)</label>
                        <textarea
                            value={urls}
                            onChange={(e) => setUrls(e.target.value)}
                            placeholder="https://server/wcs?request=GetCoverage..."
                            rows={3}
                            className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none font-mono"
                            disabled={loading && progress !== null}
                        />
                    </div>
                ) : (
                    <div>
                        <label className="block text-slate-300 text-sm mb-1">Local DEM File (.tif, .asc)</label>
                        <input
                            type="file"
                            accept=".tif,.tiff,.asc"
                            onChange={(e) => setLocalFile(e.target.files?.[0] || null)}
                            className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-blue-900 file:text-blue-300"
                            disabled={loading && progress !== null}
                        />
                    </div>
                )}

                <div className="pt-2">
                    <button
                        type="submit"
                        disabled={loading && progress !== null}
                        className={`w-full py-2 px-4 rounded font-medium transition-colors ${(loading && progress !== null) ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white'
                            }`}
                    >
                        {(loading && progress !== null) ? 'Processing...' : 'Start Ingestion Pipeline'}
                    </button>
                </div>
            </form>

            {/* Status & Real-time Progress Bar */}
            {(status || progress) && (
                <div className="mt-4 flex flex-col space-y-2">
                    {status && (
                        <div className={`p-3 rounded text-sm ${status.isError ? 'bg-red-900/30 text-red-400 border border-red-800' : 'bg-green-900/30 text-green-400 border border-green-800'}`}>
                            {status.message}
                        </div>
                    )}

                    {progress && !status?.isError && (
                        <div className="bg-slate-900 rounded p-3 border border-slate-700">
                            <div className="flex justify-between text-xs text-slate-300 mb-2">
                                <span>{progress.message}</span>
                                <span>{progress.percent}%</span>
                            </div>
                            <div className="w-full bg-slate-700 rounded-full h-2">
                                <div
                                    className="bg-blue-500 h-2 rounded-full transition-all duration-500 ease-out"
                                    style={{ width: `${Math.max(0, Math.min(100, progress.percent))}%` }}
                                ></div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

