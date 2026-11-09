import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react()],
  server: {
    // Явно IPv4: `localhost` может разрешиться только в ::1, а wrangler слушает 127.0.0.1.
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      // Локально API отдаёт `wrangler dev` из apps/api.
      '/api': 'http://127.0.0.1:8787',
    },
  },
});
