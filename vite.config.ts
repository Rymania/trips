/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**', 'src/account/**'],
      // Spec 005 T055: at least 85% for the domain and account layers, enforced in CI.
      thresholds: {
        'src/domain/**': { lines: 85, statements: 85, functions: 85, branches: 85 },
        'src/account/**': { lines: 85, statements: 85, functions: 85, branches: 85 },
      },
    },
  },
});
