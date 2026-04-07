import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['tests/helpers/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/core/workers/*.worklet.ts',
        'src/core/workers/*.worker.ts',
        'src/entrypoints/**',
        'src/env.d.ts',
        'src/vinsium/types.ts',
        'src/vinsium/bridge.ts',
      ],
      thresholds: {
        'src/core/scoring/**': {
          lines: 80,
          branches: 80,
          functions: 80,
          statements: 80,
        },
        'src/vinsium/**': {
          lines: 70,
          branches: 45,
          functions: 70,
          statements: 70,
        },
      },
    },
  },
});
