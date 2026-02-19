import { defineConfig } from 'vite';
import { nkzModulePreset } from '@nekazari/module-builder';
import path from 'path';

// Change this to your module ID
const MODULE_ID = 'my-module';

export default defineConfig(nkzModulePreset({
  moduleId: MODULE_ID,
  entry: 'src/moduleEntry.ts',

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
          target: 'https://nkz.robotika.cloud',
          changeOrigin: true,
          secure: true,
        },
      },
    }
  }
}));
