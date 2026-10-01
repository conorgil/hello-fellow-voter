import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/',
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
});
