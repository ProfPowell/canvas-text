import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      name: 'CanvasText',
      fileName: 'canvas-text',
      formats: ['es']
    },
    outDir: 'dist',
    minify: true,
    sourcemap: true,
    rollupOptions: {
      external: ['render-tag']
    }
  },
  server: { port: 5173, open: false }
});
