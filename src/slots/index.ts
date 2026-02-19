import type { ModuleViewerSlots } from '@nekazari/sdk';
import App from '../App';

// Define slots for the module
export const moduleSlots: ModuleViewerSlots = {
    // Example: Add a button to the map layer toolbar being loaded
    'map-layer': [],

    // Example: Add a context panel widget
    'context-panel': [
        {
            id: 'template-context-panel',
            moduleId: 'my-module',
            component: 'App',
            localComponent: App,
            priority: 100,
        }
    ]
};
