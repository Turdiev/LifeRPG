import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react()],
  server: {
    // Explicit IPv4: `localhost` may resolve to ::1 only, which wrangler (127.0.0.1) doesn't share.
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      // `wrangler dev` of apps/api serves the API in local development.
      '/api': 'http://127.0.0.1:8787',
    },
  },
});
