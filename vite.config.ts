import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => ({
  base: process.env.VITE_BASE_PATH ?? (mode === 'production' ? './' : '/'),
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/tests/**/*.test.ts'],
  },
}));
