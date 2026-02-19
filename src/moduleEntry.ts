import { moduleSlots } from './slots';
import pkg from '../package.json';

// Use strict module ID that matches database
// This should match the ID in manifest.json
const MODULE_ID = 'nkz-module-eu-elevation';

if (typeof console !== 'undefined' && console.debug) {
    console.debug(`[${MODULE_ID}] init v${pkg.version}`);
}

// Self-register with the host runtime
if (window.__NKZ__) {
    window.__NKZ__.register({
        id: MODULE_ID,
        viewerSlots: moduleSlots,
        version: pkg.version,
    });
} else {
    console.error(`[${MODULE_ID}] window.__NKZ__ not found! Module registration failed.`);
}
