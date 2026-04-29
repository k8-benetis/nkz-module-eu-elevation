import { moduleSlots } from './slots/index';
import MainView from './components/MainView';
import pkg from '../package.json';
import { i18n } from '@nekazari/sdk';
import enTranslations from './locales/en.json';
import esTranslations from './locales/es.json';

// Use strict module ID that matches database
// This should match the ID in manifest.json
const MODULE_ID = 'nkz-module-eu-elevation';
const BUNDLE_VERSION = '1.0.0-audit-' + Date.now();

console.warn(`[${MODULE_ID}] 🔥 BUNDLE STARTING - VERSION: ${BUNDLE_VERSION}`);

declare const Cesium: any;
if (typeof Cesium !== 'undefined') {
    console.warn(`[${MODULE_ID}] 🌎 CESIUM ENGINE DETECTED - VERSION: ${Cesium.VERSION}`);
} else {
    console.error(`[${MODULE_ID}] ❌ CESIUM ENGINE NOT FOUND IN GLOBAL SCOPE`);
}

declare global {
    interface Window {
        __NKZ__: any;
    }
}

// Self-register with the host runtime
try {
    if (window.__NKZ__) {
        console.log(`[${MODULE_ID}] 🚀 Found window.__NKZ__, registering components...`);
        
        // Register module translations using global i18n if possible
        const globalI18n = i18n || (window as any).__NKZ_SDK__?.i18n;
        if (globalI18n && globalI18n.addResourceBundle) {
            console.log(`[${MODULE_ID}] 🌐 Registering translations for 'eu-elevation' namespace`);
            globalI18n.addResourceBundle('en', 'eu-elevation', enTranslations, true, true);
            globalI18n.addResourceBundle('es', 'eu-elevation', esTranslations, true, true);
        } else {
            console.warn(`[${MODULE_ID}] ⚠️ i18n instance not found, translations may not work correctly`);
        }

        window.__NKZ__.register({
            id: MODULE_ID,
            viewerSlots: moduleSlots,
            main: MainView,
            version: pkg.version,
        });
        console.log(`[${MODULE_ID}] ✅ Registration call complete`);
    } else {
        console.error(`[${MODULE_ID}] ❌ window.__NKZ__ not found! Module registration failed.`);
    }
} catch (e) {
    console.error(`[${MODULE_ID}] 💥 Fatal error during registration:`, e);
}
