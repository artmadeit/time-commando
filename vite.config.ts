import { defineConfig } from 'vite';

// base relativa para poder publicarlo en GitHub Pages o cualquier subcarpeta
export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
});
