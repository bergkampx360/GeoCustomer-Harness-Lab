import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['apps/**/src/**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.nx/**'],
  },
});
