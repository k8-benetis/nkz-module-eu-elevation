// =============================================================================
// LIDAR Module - NKZ Platform
// =============================================================================
// LiDAR Point Cloud Processing & Visualization Module
//
// This module provides:
// - PNOA LiDAR coverage checking and download
// - Custom .LAZ file upload from drone flights
// - 3D Tiles generation and CesiumJS visualization
// - Tree detection and analysis
//
// IMPORTANT: When loaded as a federated module, the Host provides:
// - NekazariI18nProvider (i18n context)
// - AuthProvider (authentication context)
// - Layout (navigation, sidebar)
// =============================================================================

import React from 'react';
import { Layers, Cpu, TreeDeciduous, Upload, Download, Eye } from 'lucide-react';
import './index.css';

// Export slots for Module Federation
export { lidarSlots, viewerSlots } from './slots';
export { LidarProvider, useLidarContext } from './services/lidarContext';
export { default as LidarLayerControl } from './components/slots/LidarLayerControl';
export { default as LidarLayer } from './components/slots/LidarLayer';
export { default as LidarConfig } from './components/slots/LidarConfig';

// Feature Card Component
const FeatureCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
}> = ({ icon, title, description, gradient }) => (
  <div className="lidar-card p-6 group hover:scale-[1.02] transition-transform duration-300">
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${gradient}`}>
      {icon}
    </div>
    <h3 className="font-semibold text-slate-800 mb-2">{title}</h3>
    <p className="text-sm text-slate-600">{description}</p>
  </div>
);

// Main App Component (Landing Page)
const LidarApp: React.FC = () => {
  return (
    // IMPORTANT: Do NOT use min-h-screen or full-page wrappers!
    // The host Layout already provides min-h-screen, sidebar, and navigation.
    // Using min-h-screen here will cause layout conflicts (sidebar disappears, page misaligns).
    <div className="lidar-module bg-gradient-to-br from-violet-50 via-white to-cyan-50 p-6 md:p-10">
      <div className="max-w-5xl mx-auto">

        {/* Hero Section */}
        <div className="text-center mb-12 lidar-slide-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-100 text-violet-700 text-sm font-medium mb-6">
            <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
            Módulo Premium
          </div>

          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="lidar-pointcloud-icon p-4 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 shadow-lg">
              <Layers className="w-10 h-10 text-white" />
            </div>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-cyan-600">
              LiDAR Point Cloud
            </span>
          </h1>

          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Visualiza y analiza nubes de puntos 3D con tecnología CesiumJS.
            Descarga datos PNOA o sube tus propios vuelos de dron.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <FeatureCard
            icon={<Download className="w-6 h-6 text-white" />}
            title="Descarga PNOA"
            description="Acceso automático a datos LiDAR del Plan Nacional de Ortofotografía Aérea para cualquier parcela de España."
            gradient="bg-gradient-to-br from-violet-500 to-violet-600"
          />
          <FeatureCard
            icon={<Upload className="w-6 h-6 text-white" />}
            title="Upload Personalizado"
            description="Sube archivos .LAZ de vuelos de dron propios. Compatible con cualquier sensor LiDAR georreferenciado."
            gradient="bg-gradient-to-br from-cyan-500 to-cyan-600"
          />
          <FeatureCard
            icon={<TreeDeciduous className="w-6 h-6 text-white" />}
            title="Detección de Árboles"
            description="Algoritmos avanzados de segmentación para identificar árboles individuales, altura y área de copa."
            gradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
          />
        </div>

        {/* Technical Specs */}
        <div className="lidar-card p-8 mb-12">
          <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-3">
            <Cpu className="w-6 h-6 text-violet-500" />
            Pipeline de Procesamiento
          </h2>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: '01', title: 'Ingesta', desc: 'Descarga y recorte al polígono' },
              { step: '02', title: 'Fusión Espectral', desc: 'Colorización NDVI opcional' },
              { step: '03', title: 'Segmentación', desc: 'Detección CHM + Watershed' },
              { step: '04', title: 'Tiling 3D', desc: 'Conversión a 3D Tiles (Cesium)' },
            ].map((item, i) => (
              <div key={i} className="relative">
                <div className="text-4xl font-bold text-violet-100 mb-2">{item.step}</div>
                <h3 className="font-semibold text-slate-800 mb-1">{item.title}</h3>
                <p className="text-sm text-slate-600">{item.desc}</p>
                {i < 3 && (
                  <div className="hidden md:block absolute top-4 -right-3 text-violet-300 text-2xl">→</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* How to Use */}
        <div className="lidar-card p-8">
          <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-3">
            <Eye className="w-6 h-6 text-cyan-500" />
            Cómo Usar
          </h2>

          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 hover:bg-violet-50 transition-colors">
              <div className="w-8 h-8 rounded-full bg-violet-500 text-white flex items-center justify-center flex-shrink-0 font-semibold">1</div>
              <div>
                <h3 className="font-semibold text-slate-800">Selecciona una Parcela</h3>
                <p className="text-sm text-slate-600">En el visor unificado, haz clic en cualquier parcela (AgriParcel) para activar el módulo LiDAR.</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 hover:bg-cyan-50 transition-colors">
              <div className="w-8 h-8 rounded-full bg-cyan-500 text-white flex items-center justify-center flex-shrink-0 font-semibold">2</div>
              <div>
                <h3 className="font-semibold text-slate-800">Elige la Fuente de Datos</h3>
                <p className="text-sm text-slate-600">Descarga automáticamente desde PNOA o sube tu propio archivo .LAZ de un vuelo de dron.</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 hover:bg-emerald-50 transition-colors">
              <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 font-semibold">3</div>
              <div>
                <h3 className="font-semibold text-slate-800">Visualiza en 3D</h3>
                <p className="text-sm text-slate-600">La nube de puntos se carga en CesiumJS con colorización dinámica (altura, NDVI, clasificación).</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-8 text-center">
          <p className="text-sm text-slate-500">
            Este módulo se integra automáticamente con el visor unificado mediante slots.
            <br />
            Navega al mapa y selecciona una parcela para comenzar.
          </p>
        </div>
      </div>
    </div>
  );
};

// CRITICAL: Export as default - required for Module Federation
export default LidarApp;
