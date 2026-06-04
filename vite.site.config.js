import { defineConfig } from 'vite';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pagefindStub, vbAssets } from './vite-vb-plugins.js';

// Product-site multi-page build for canvas-text docs.
// root: 'docs' means pages are served/output at the site root (no /docs/ prefix).

const input = Object.fromEntries(
  [
    'index.html',
    'api.html',
    'demos.html',
    'meme.html',
    'badge.html',
    'banner.html',
    'og-card.html',
    'caption.html',
  ]
    .filter((f) => existsSync(join('docs', f)))
    .map((f) => [f.replace(/[/.]/g, '_'), resolve('docs', f)])
);

export default defineConfig({
  root: 'docs',
  base: './',
  plugins: [pagefindStub, vbAssets],
  build: {
    outDir: '../dist-site',
    emptyOutDir: true,
    // vanilla-breeze uses top-level await; target must support it (ES2022+).
    target: 'es2022',
    rollupOptions: { input },
  },
  server: {
    fs: { allow: ['..'] },
    open: '/index.html',
  },
});
