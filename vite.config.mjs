import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { previewPlugin } from './scripts/preview-plugin.mjs';
export default defineConfig({ base: './', plugins: [react(), previewPlugin()], server: { host: '127.0.0.1', port: 5173, strictPort: true } });
