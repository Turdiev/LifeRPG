import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    // Интеграционные тесты API ходят в настоящий PostgreSQL: база life_rpg_test в Docker.
    globalSetup: './src/test/global-setup.ts',
  },
});
