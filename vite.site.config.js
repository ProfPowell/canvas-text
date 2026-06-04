import { defineConfig } from 'vite';
import { existsSync } from 'node:fs';
import { pagefindStub, vbAssets } from './vite-vb-plugins.js';

// Product-site multi-page build for canvas-text docs.
// Mirrors border-wc's vite.site.config.js pattern. All site pages live under
// docs/ — there is no demos/ dir in this repo.

const input = Object.fromEntries(
  [
    'docs/index.html',
    'docs/api.html',
    'docs/demos.html',
    'docs/meme.html',
    'docs/badge.html',
    'docs/banner.html',
    'docs/og-card.html',
    'docs/caption.html',
  ]
    .filter((f) => existsSync(f))
    .map((f) => [f.replace(/[/.]/g, '_'), f])
);

export default defineConfig({
  root: '.',
  base: './',
  plugins: [pagefindStub, vbAssets],
  build: {
    outDir: 'dist-site',
    emptyOutDir: true,
    // vanilla-breeze uses top-level await; target must support it (ES2022+).
    target: 'es2022',
    rollupOptions: { input },
  },
  server: { open: '/docs/index.html' },
});
