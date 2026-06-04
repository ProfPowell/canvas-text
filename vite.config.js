import { defineConfig } from 'vite';
import { resolve } from 'path';
import { pagefindStub, vbAssets } from './vite-vb-plugins.js';

export default defineConfig({
  root: '.',
  plugins: [pagefindStub, vbAssets],
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
  // vanilla-breeze uses top-level await; the dev/test server must target ES2022+.
  optimizeDeps: { esbuildOptions: { target: 'es2022' } },
  server: { port: 5173, open: false }
});
