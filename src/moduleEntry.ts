import { defineModule } from '@nekazari/module-kit';
import { moduleSlots } from './slots/index';
import MainView from './components/MainView';
import pkg from '../package.json';
import { i18n } from '@nekazari/sdk';
import enTranslations from './locales/en.json';
import esTranslations from './locales/es.json';

const MODULE_ID = 'nkz-module-eu-elevation';

const moduleConfig = defineModule({
  id: MODULE_ID,
  displayName: 'EU Elevation',
  accent: { base: '#3B82F6', soft: '#DBEAFE', strong: '#1D4ED8' },
  hostApiVersion: '^2.0.0',
  api: { basePath: '/api/eu-elevation' },
});

declare global {
    interface Window {
        __NKZ__: any;
    }
}

try {
    if (window.__NKZ__) {
        const globalI18n = i18n || (window as any).__NKZ_SDK__?.i18n;
        if (globalI18n && globalI18n.addResourceBundle) {
            globalI18n.addResourceBundle('en', 'eu-elevation', enTranslations, true, true);
            globalI18n.addResourceBundle('es', 'eu-elevation', esTranslations, true, true);
        }

        window.__NKZ__.register({
            id: MODULE_ID,
            viewerSlots: moduleSlots,
            main: MainView,
            version: pkg.version,
        });
    } else {
        console.error(`[${MODULE_ID}] window.__NKZ__ not found! Module registration failed.`);
    }
} catch (e) {
    console.error(`[${MODULE_ID}] Fatal error during registration:`, e);
}

export default moduleConfig;
