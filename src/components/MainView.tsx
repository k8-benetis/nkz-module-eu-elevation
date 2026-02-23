import React from 'react';
import { ElevationAdminControl } from './slots/ElevationAdminControl';

export const MainView: React.FC = () => {
    return (
        <div className="w-full h-full p-6 bg-slate-900 border-l border-slate-700 overflow-y-auto">
            <div className="max-w-4xl mx-auto space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-2">EU Elevation Module</h1>
                    <p className="text-slate-400">
                        This module manages the European Digital Twin elevation transcoding operations.
                        Use the tool below to trigger BBOX processing or upload a local DEM.
                    </p>
                </div>

                {/* Re-use the existing admin control panel as the main view's UI */}
                <ElevationAdminControl />
            </div>
        </div>
    );
};

export default MainView;
