import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Пергамент светлой темы (globals.css, --background): фон заставки и цвет системной панели.
const PARCHMENT = '#f2ecdf';

export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    VitePWA({
      // Новый сервис-воркер берёт управление сразу, без кнопки «Обновить»; если открытая вкладка
      // не найдёт удалённый им старый чанк, main.tsx перезагрузит её (vite:preloadError).
      registerType: 'autoUpdate',
      // Иконки манифеста и так попадают в precache через globPatterns.
      includeManifestIcons: false,
      manifest: {
        // Без id Chrome берёт его из start_url: смена start_url сделала бы установленное приложение «другим».
        id: '/',
        name: 'LIFE RPG',
        short_name: 'LIFE RPG',
        description: 'Ежедневник, который превращает большую цель в квесты: главы, задания, этапы.',
        lang: 'ru',
        start_url: '/today',
        display: 'standalone',
        theme_color: PARCHMENT,
        background_color: PARCHMENT,
        // Иконки — из `pnpm icons` (pwa-assets.config.js).
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // tech-spec, «Интерфейс»: API сервис-воркер не трогает, его кеширует TanStack Query.
        // Главное — /api/auth/callback/google: отдай на него сервис-воркер index.html из кеша,
        // ответ Google не дошёл бы до сервера, и вход не завершился бы.
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
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
