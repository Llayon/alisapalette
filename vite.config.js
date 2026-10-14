import { defineConfig } from 'vite';

export default defineConfig({
  // Важно для GitHub Pages в подпапке репозитория: относительные пути.
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    target: 'es2020'
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js']
  }
});
