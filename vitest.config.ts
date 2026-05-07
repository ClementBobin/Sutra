import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['/home/runner/work/Sutra/Sutra/tests/setup.ts'],
    globals: true
  }
});
