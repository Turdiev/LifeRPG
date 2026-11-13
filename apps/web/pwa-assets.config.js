// Конфиг генератора иконок PWA (@vite-pwa/assets-generator), запуск — `pnpm icons` из apps/web.
// Генератор не в зависимостях: иконки меняются редко, PNG лежат в public/ и коммитятся.
// Без отступов: у исходного SVG фон уже во всю площадь, а рисунок — в безопасной зоне маски.
export default {
  headLinkOptions: { preset: '2023' },
  preset: {
    transparent: { sizes: [64, 192, 512], favicons: [[48, 'favicon.ico']], padding: 0 },
    maskable: { sizes: [512], padding: 0 },
    apple: { sizes: [180], padding: 0 },
  },
  images: ['public/pwa-icon.svg'],
};
