import React from 'react';
import { ElevationAdminControl } from '../components/slots/ElevationAdminControl';
import { ElevationLayer } from '../components/slots/ElevationLayer';

const MODULE_ID = 'nkz-module-eu-elevation';

export type SlotType = 'layer-toggle' | 'context-panel' | 'bottom-panel' | 'entity-tree' | 'map-layer' | 'dashboard-widget';

export interface SlotWidgetDefinition {
  id: string;
  moduleId: string;
  component: string;
  priority: number;
  localComponent: React.ComponentType<any>;
  defaultProps?: Record<string, any>;
  showWhen?: {
    entityType?: string[];
    layerActive?: string[];
  };
}

export type ModuleViewerSlots = Record<SlotType, SlotWidgetDefinition[]> & {
  moduleProvider?: React.ComponentType<{ children: React.ReactNode }>;
};

/**
 * Elevation Module Slots Configuration
 */
export const moduleSlots: ModuleViewerSlots = {
  // 1. Inject the Terrain Provider directly into the Cesium map
  'map-layer': [
    {
      id: 'elevation-cesium-layer',
      moduleId: MODULE_ID,
      component: 'ElevationLayer',
      priority: 10,
      localComponent: ElevationLayer
    }
  ],

  // 2. Add the Admin Panel to the dashboard 
  // (In a real scenario, we might restrict this via showWhen or a dedicated admin route)
  'dashboard-widget': [
    {
      id: 'elevation-admin-control',
      moduleId: MODULE_ID,
      component: 'ElevationAdminControl',
      priority: 50,
      localComponent: ElevationAdminControl
    }
  ],

  // Unused slots for this module
  'layer-toggle': [],
  'context-panel': [],
  'bottom-panel': [],
  'entity-tree': []
};

// Export as default for convenience
export default moduleSlots;
