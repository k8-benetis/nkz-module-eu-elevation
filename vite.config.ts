import { defineConfig } from 'vite';
import { nkzModulePreset } from '@nekazari/module-builder';
import path from 'path';

// Change this to your module ID
const MODULE_ID = 'nkz-module-eu-elevation';

export default defineConfig(nkzModulePreset({
  moduleId: MODULE_ID,
  entry: 'src/moduleEntry.ts',
  additionalExternals: {
    '@nekazari/design-tokens': '__NKZ_DESIGN_TOKENS__',
    '@nekazari/viewer-kit': '__NKZ_VIEWER_KIT__',
  },

  // Additional config for local development
  viteConfig: {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5003,
      proxy: {
        '/api': {
          target: process.env.VITE_DEV_API_TARGET || 'http://localhost:8000',
          changeOrigin: true,
          secure: true,
        },
      },
    }
  }
}));
