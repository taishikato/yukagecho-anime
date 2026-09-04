import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import stylex from '@stylexjs/unplugin';

export default defineConfig({
  plugins: [stylex.vite(), react()],
  server: { host: '127.0.0.1' },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: { manualChunks: (id) => (id.includes('node_modules/three/') ? 'three' : undefined) },
    },
  },
});
