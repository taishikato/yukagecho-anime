import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import stylex from '@stylexjs/unplugin';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (key && !key.startsWith('sb_publishable_'))
    throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY must be a publishable key. Build stopped.');
  if (key) {
    try {
      const url = new URL(env.VITE_SUPABASE_URL);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    } catch {
      throw new Error('VITE_SUPABASE_URL must be a valid HTTP(S) URL. Build stopped.');
    }
  }
  return {
    plugins: [stylex.vite(), react()],
    server: { host: '127.0.0.1' },
    build: {
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes('node_modules/three/')) return 'three';
            if (id.includes('node_modules/posthog-js/') || id.includes('node_modules/@posthog/'))
              return 'posthog';
          },
        },
      },
    },
  };
});
