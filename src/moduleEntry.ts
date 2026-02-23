import { moduleSlots } from './slots/index';
import MainView from './components/MainView';
import pkg from '../package.json';
import { i18n } from '@nekazari/sdk';
import enTranslations from './locales/en.json';
import esTranslations from './locales/es.json';

// Use strict module ID that matches database
// This should match the ID in manifest.json
const MODULE_ID = 'nkz-module-eu-elevation';

declare global {
    interface Window {
        __NKZ__: any;
    }
}

if (typeof console !== 'undefined' && console.debug) {
    console.debug(`[${MODULE_ID}] init v${pkg.version}`);
}

// Self-register with the host runtime
if (window.__NKZ__) {
    // Register module translations
    if (i18n && i18n.addResourceBundle) {
        i18n.addResourceBundle('en', 'eu-elevation', enTranslations, true, true);
        i18n.addResourceBundle('es', 'eu-elevation', esTranslations, true, true);
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
