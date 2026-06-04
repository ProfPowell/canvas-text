/**
 * Shared Vite plugins for vanilla-breeze integration.
 *
 * Used by both vite.config.js (dev/test server) and vite.site.config.js
 * (docs site build) so the test server and the production build behave
 * identically with respect to /vb/ asset serving and pagefind stubbing.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// vanilla-breeze lazily imports its optional Pagefind search bundle from an
// absolute path that doesn't exist here. Stub it so dev + build don't 404.
const PAGEFIND_ID = '/pagefind/pagefind.js';

/** Vite plugin: stub /pagefind/pagefind.js so VB's search import never 404s. */
export const pagefindStub = {
  name: 'canvas-text:pagefind-stub',
  resolveId(id) {
    if (id === PAGEFIND_ID) return '\0pagefind-stub';
    return null;
  },
  load(id) {
    if (id === '\0pagefind-stub')
      return 'export default {}; export const search = () => ({ results: [] });';
    return null;
  },
};

// vanilla-breeze fetches its theme CSS and lucide icon SVGs from a runtime
// base path. Serve them from node_modules in dev and emit them as assets at
// build time so they land at vb/themes/*.css and vb/icons/lucide/*.svg.
const VB_DIR = 'node_modules/vanilla-breeze/dist/cdn';
const VB_BUILD_ICONS = [
  'palette',
  'sun',
  'moon',
  'monitor',
  'contrast',
  'sliders',
  'type',
  'check',
  'chevron-down',
  'chevron-up',
  'x',
  'circle',
];

/**
 * Vite plugin: serve VB theme CSS and lucide SVG assets.
 *
 * - In dev/test: middleware serves GET /vb/themes/*.css and
 *   /vb/icons/lucide/*.svg directly from node_modules.
 * - In site build (non-library mode): emits them as static assets under vb/
 *   so the production bundle includes them.
 * - In library build: generateBundle is skipped — VB assets don't belong in
 *   the published npm library dist/.
 *
 * Uses a factory function so `isLibBuild` state is captured in a closure,
 * which is the correct Vite plugin pattern for mutable config-phase state.
 */
function makeVbAssetsPlugin() {
  let isLibBuild = false;
  return {
    name: 'canvas-text:vb-assets',
    configResolved(config) {
      isLibBuild = !!config.build?.lib;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const t = req.url && req.url.match(/\/vb\/themes\/([\w-]+\.css)(?:\?.*)?$/);
        const i = req.url && req.url.match(/\/vb\/icons\/([\w-]+)\/([\w-]+\.svg)(?:\?.*)?$/);
        try {
          if (t) {
            res.setHeader('Content-Type', 'text/css');
            return res.end(readFileSync(join(VB_DIR, 'themes', t[1])));
          }
          if (i) {
            res.setHeader('Content-Type', 'image/svg+xml');
            return res.end(readFileSync(join(VB_DIR, 'icons', i[1], i[2])));
          }
        } catch {
          /* fall through to 404 */
        }
        next();
      });
    },
    generateBundle() {
      // Skip asset emission during library builds — VB files don't belong in dist/.
      if (isLibBuild) return;

      const themes = join(VB_DIR, 'themes');
      if (existsSync(themes)) {
        for (const f of readdirSync(themes)) {
          if (f.endsWith('.css')) {
            this.emitFile({
              type: 'asset',
              fileName: `vb/themes/${f}`,
              source: readFileSync(join(themes, f)),
            });
          }
        }
      }
      const lucide = join(VB_DIR, 'icons', 'lucide');
      if (existsSync(lucide)) {
        for (const name of VB_BUILD_ICONS) {
          const file = join(lucide, `${name}.svg`);
          if (existsSync(file)) {
            this.emitFile({
              type: 'asset',
              fileName: `vb/icons/lucide/${name}.svg`,
              source: readFileSync(file),
            });
          }
        }
      }
    },
  };
}

/** Call this factory in each Vite config to get an independent plugin instance. */
export const vbAssets = makeVbAssetsPlugin();
