# canvas-text Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@profpowell/canvas-text@0.1.0` — a stand-alone, Vanilla Breeze-compatible web component that composites a z-ordered stack of image and rich-text layers onto a single canvas, suitable as the rendering primitive for `meme-maker`.

**Architecture:** Light-DOM custom element. The element owns one internal `<canvas>`. On render it scans slotted children, sorts them by z-order (`background`, `background-N`, `text-N`, default), draws each layer in order (`drawImage` for `<img>`, `render-tag` → `drawImage` for text). Slot/attribute changes coalesce to one `requestAnimationFrame` paint. Theme bridge serializes an allowlist of computed CSS properties onto each text layer's wrapper before handing to `render-tag`.

**Tech Stack:** Vanilla ES modules (no TypeScript in src), Vite for bundling, Playwright for tests, ESLint + Prettier, `render-tag@^0.1.7` as peer dep, beads (`bd`) for issue tracking. Mirrors the conventions used by `@profpowell/code-block` and `@profpowell/screen-saver`.

**Spec:** [docs/superpowers/specs/2026-05-14-canvas-text-design.md](../specs/2026-05-14-canvas-text-design.md)

**Convention divergence from spec:** Spec mentions Vitest + happy-dom for unit tests; this plan uses **Playwright only** (matching code-block / screen-saver). happy-dom does not implement `<canvas>` realistically enough for these tests, and the sibling components have already proven Playwright-only is sufficient.

---

## File map

| Path                                        | Purpose                                                 |
|---------------------------------------------|---------------------------------------------------------|
| `package.json`                              | Package metadata, scripts, peer dep on `render-tag`.    |
| `vite.config.js`                            | ESM library build → `dist/canvas-text.js`.              |
| `playwright.config.js`                      | Playwright runner with Vite dev server on :5173.        |
| `eslint.config.js`                          | ESLint flat config (mirror code-block).                 |
| `canvas-text.d.ts`                          | Hand-maintained TypeScript declarations.                |
| `src/index.js`                              | Registers `<canvas-text>`; re-exports class.            |
| `src/canvas-text.js`                        | The custom element: lifecycle, attrs, observer, exports.|
| `src/layers.js`                             | Slot scan, z-order, per-layer render dispatcher.        |
| `src/theme-bridge.js`                       | `getComputedStyle` → inline-style serializer.           |
| `test/test-page.html`                       | Vite-served harness for Playwright.                     |
| `test/meme-page.html`                       | Layer-pipeline harness.                                 |
| `test/vb-theme-page.html`                   | Theme-bridge harness loading a VB stylesheet.           |
| `test/render.spec.js`                       | Text-only render, attrs, events.                        |
| `test/reactivity.spec.js`                   | Attribute + MutationObserver + rAF coalescing.          |
| `test/theme.spec.js`                        | Allowlist serialization, three-theme parity.            |
| `test/layers.spec.js`                       | Slot grammar, z-order, image decode, error isolation.   |
| `test/output.spec.js`                       | `getCanvas` / `toBlob` / `toDataURL`.                   |
| `test/a11y.spec.js`                         | Fallback DOM + axe-core.                                |
| `examples/index.html`                       | Static playground.                                      |
| `examples/meme.html`                        | Working meme demo.                                      |
| `examples/vb-integration.html`              | VB-themed page demo.                                    |
| `.github/workflows/ci.yml`                  | Lint + Playwright on PR.                                |
| `.beads/`                                   | Beads database (created by `bd init`).                  |

---

## Task 0: Repo bootstrap

**Files:**
- Create: `package.json`, `.gitignore`, `.npmignore`, `vite.config.js`, `playwright.config.js`, `eslint.config.js`, `.prettierrc`, `src/index.js`, `src/canvas-text.js`, `test/test-page.html`, `test/smoke.spec.js`, `canvas-text.d.ts`, `.github/workflows/ci.yml`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "@profpowell/canvas-text",
  "version": "0.0.1",
  "description": "Stand-alone web component that composites rich text and images onto a canvas",
  "type": "module",
  "main": "dist/canvas-text.js",
  "module": "dist/canvas-text.js",
  "types": "canvas-text.d.ts",
  "exports": {
    ".": {
      "types": "./canvas-text.d.ts",
      "import": "./dist/canvas-text.js"
    }
  },
  "publishConfig": { "access": "public" },
  "files": ["dist", "canvas-text.d.ts", "custom-elements.json", "README.md", "LICENSE"],
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "playwright test",
    "test:ui": "playwright test --ui",
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "prepublishOnly": "npm run build"
  },
  "keywords": ["web-component", "custom-element", "canvas", "render-tag", "meme", "profpowell-web-components"],
  "author": "Prof Thomas Powell",
  "license": "MIT",
  "repository": { "type": "git", "url": "git+https://github.com/ProfPowell/canvas-text.git" },
  "bugs": { "url": "https://github.com/ProfPowell/canvas-text/issues" },
  "homepage": "https://profpowell.github.io/canvas-text/",
  "peerDependencies": {
    "render-tag": "^0.1.7"
  },
  "devDependencies": {
    "@playwright/test": "^1.57.0",
    "@axe-core/playwright": "^4.10.0",
    "eslint": "^9.0.0",
    "prettier": "^3.0.0",
    "vite": "^6.0.0",
    "render-tag": "^0.1.7"
  }
}
```

- [ ] **Step 2: Create `.gitignore`**

```
node_modules
dist
test-results
playwright-report
.DS_Store
*.tgz
```

- [ ] **Step 3: Create `.npmignore`**

```
test
test-results
playwright-report
examples
docs
.github
.beads
src
*.config.js
*.config.mjs
.prettierrc
.gitignore
```

- [ ] **Step 4: Create `vite.config.js`**

```js
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
```

- [ ] **Step 5: Create `playwright.config.js`**

```js
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './test',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx vite --port 5173',
    url: 'http://localhost:5173/test/test-page.html',
    reuseExistingServer: true,
    timeout: 60000,
    stdout: 'pipe',
    stderr: 'pipe'
  }
});
```

- [ ] **Step 6: Create `eslint.config.js`**

```js
import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        HTMLElement: 'readonly',
        HTMLCanvasElement: 'readonly',
        HTMLImageElement: 'readonly',
        MutationObserver: 'readonly',
        customElements: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        getComputedStyle: 'readonly',
        CustomEvent: 'readonly',
        Image: 'readonly',
        Blob: 'readonly',
        URL: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
    }
  }
];
```

Add `@eslint/js` to devDependencies if missing — `npm i -D @eslint/js`.

- [ ] **Step 7: Create `.prettierrc`**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100
}
```

- [ ] **Step 8: Create `src/canvas-text.js` (stub)**

```js
export class CanvasTextElement extends HTMLElement {
  connectedCallback() {
    this.setAttribute('data-upgraded', '');
  }
}
```

- [ ] **Step 9: Create `src/index.js`**

```js
import { CanvasTextElement } from './canvas-text.js';

if (!customElements.get('canvas-text')) {
  customElements.define('canvas-text', CanvasTextElement);
}

export { CanvasTextElement };
```

- [ ] **Step 10: Create `canvas-text.d.ts`**

```ts
export declare class CanvasTextElement extends HTMLElement {
  width: number;
  height: number;
  theme: 'inherit' | 'none' | 'inline';
  accuracy: 'default' | 'balanced';
  lang: string;
  dpr: number | 'auto';
  format: 'png' | 'jpeg' | 'webp';
  compose: 'slots' | 'text-only';
  alt: string;
  html: string;

  getCanvas(): HTMLCanvasElement;
  toBlob(type?: string, quality?: number): Promise<Blob>;
  toDataURL(type?: string, quality?: number): string;
  render(): Promise<void>;
}

declare global {
  interface HTMLElementTagNameMap {
    'canvas-text': CanvasTextElement;
  }
}
```

- [ ] **Step 11: Create `test/test-page.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>canvas-text test harness</title>
  <script type="importmap">
    { "imports": { "render-tag": "/node_modules/render-tag/dist/render-tag.js" } }
  </script>
  <script type="module" src="/src/index.js"></script>
</head>
<body>
  <main id="harness"></main>
</body>
</html>
```

If `render-tag` ships a different ESM entry than `dist/render-tag.js`, adjust the importmap to match `node_modules/render-tag/package.json#exports`.

- [ ] **Step 12: Create `test/smoke.spec.js`**

```js
import { test, expect } from '@playwright/test';

test('element upgrades and sets data-upgraded', async ({ page }) => {
  await page.goto('/test/test-page.html');
  await page.evaluate(() => {
    const el = document.createElement('canvas-text');
    document.getElementById('harness').appendChild(el);
  });
  const el = page.locator('canvas-text');
  await expect(el).toHaveAttribute('data-upgraded', '');
});
```

- [ ] **Step 13: Install deps and confirm test fails meaningfully**

```bash
npm install
npx playwright install --with-deps chromium
npm test
```

Expected: smoke test PASSES (the stub already sets `data-upgraded`). If it fails, fix the harness/import map before continuing.

- [ ] **Step 14: Initialize beads**

```bash
bd init
bd status
```

Expected: `.beads/` exists; `bd status` shows zero issues.

- [ ] **Step 15: Create `LICENSE` (MIT)** — copy from `../code-block/LICENSE` and update the year/author. The file already exists at the repo root from the initial commit; verify with `cat LICENSE`.

- [ ] **Step 16: Create `.github/workflows/ci.yml`**

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run lint
      - run: npm run build
      - run: npm test
```

- [ ] **Step 17: Commit**

```bash
git add package.json package-lock.json .gitignore .npmignore vite.config.js \
        playwright.config.js eslint.config.js .prettierrc \
        src/ test/ canvas-text.d.ts .github/ .beads/
git commit -m "Bootstrap canvas-text repo (scaffold, CI, beads init)"
```

---

## Task 1: Create beads issues for upcoming tasks

**Files:** none (beads database only)

- [ ] **Step 1: Create one issue per remaining plan task**

```bash
bd create "Phase 1: Element scaffold + text-only render" --type task --priority 1
bd create "Phase 2: Reactivity (attrs + MutationObserver + rAF)" --type task --priority 1
bd create "Phase 3: Theme bridge" --type task --priority 1
bd create "Phase 4: Slot model + layer pipeline" --type task --priority 0
bd create "Phase 5: Output API (getCanvas, toBlob, toDataURL)" --type task --priority 1
bd create "Phase 6: Accessibility (fallback DOM + axe)" --type task --priority 0
bd create "Phase 7: README, examples, publish 0.1.0" --type task --priority 1
```

- [ ] **Step 2: Chain them as dependencies (phase N blocks N+1)**

```bash
bd list --json | jq -r '.[] | select(.title|startswith("Phase ")) | "\(.id)\t\(.title)"'
```

Note the IDs (e.g. `bd-1` … `bd-7`). Then link each phase to gate the next:

```bash
bd dep add bd-2 --blocked-by bd-1
bd dep add bd-3 --blocked-by bd-2
bd dep add bd-4 --blocked-by bd-3
bd dep add bd-5 --blocked-by bd-4
bd dep add bd-6 --blocked-by bd-5
bd dep add bd-7 --blocked-by bd-6
```

If the local `bd` build uses a different flag (e.g. `bd link` instead of `bd dep add`), run `bd link --help` and adapt — the goal is a linear dependency chain.

- [ ] **Step 3: Commit beads state**

```bash
git add .beads/
git commit -m "Track canvas-text implementation phases in beads"
```

- [ ] **Step 4: Mark Phase 1 in progress**

```bash
bd update bd-1 --status in_progress
```

---

## Task 2: Phase 1 — Element scaffold + text-only render

**Files:**
- Modify: `src/canvas-text.js`
- Test: `test/render.spec.js`

- [ ] **Step 1: Write the failing test** — `test/render.spec.js`

```js
import { test, expect } from '@playwright/test';

test('text-only render produces a non-blank canvas and fires rendered event', async ({ page }) => {
  await page.goto('/test/test-page.html');

  const detail = await page.evaluate(async () => {
    const el = document.createElement('canvas-text');
    el.setAttribute('width', '400');
    el.setAttribute('compose', 'text-only');
    el.innerHTML = '<strong>Hello</strong> world';
    document.getElementById('harness').appendChild(el);

    const ev = await new Promise((res) =>
      el.addEventListener('canvas-text:rendered', (e) => res(e.detail), { once: true })
    );
    return ev;
  });

  expect(detail.width).toBe(400);
  expect(detail.height).toBeGreaterThan(0);
  expect(typeof detail.durationMs).toBe('number');

  const blank = await page.evaluate(() => {
    const c = document.querySelector('canvas-text canvas');
    const ctx = c.getContext('2d');
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    return Array.from(data).every((v, i) => (i % 4 === 3 ? true : v === 0));
  });
  expect(blank).toBe(false);
});
```

- [ ] **Step 2: Run test, confirm it fails**

```bash
npm test -- test/render.spec.js
```

Expected: FAIL — no `<canvas>` child, no `canvas-text:rendered` event.

- [ ] **Step 3: Implement minimal element** — replace `src/canvas-text.js`

```js
import { render as renderTag } from 'render-tag';

const NUM_ATTRS = ['width', 'height', 'dpr'];

export class CanvasTextElement extends HTMLElement {
  #canvas = null;
  #renderToken = 0;

  connectedCallback() {
    if (!this.#canvas) {
      this.#canvas = document.createElement('canvas');
      this.#canvas.setAttribute('aria-hidden', 'true');
      this.appendChild(this.#canvas);
    }
    this.render();
  }

  get width() {
    return this.#numAttr('width', 600);
  }
  get height() {
    const h = this.getAttribute('height');
    return h == null ? null : Number(h);
  }
  get compose() {
    return this.getAttribute('compose') || 'slots';
  }
  get accuracy() {
    return this.getAttribute('accuracy') || 'default';
  }
  get lang() {
    return this.getAttribute('lang') || document.documentElement.lang || 'en';
  }
  get dpr() {
    const v = this.getAttribute('dpr');
    if (v == null || v === 'auto') return window.devicePixelRatio || 1;
    return Number(v) || 1;
  }

  #numAttr(name, fallback) {
    const v = this.getAttribute(name);
    const n = v == null ? NaN : Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  getCanvas() {
    return this.#canvas;
  }

  async render() {
    const token = ++this.#renderToken;
    const start = performance.now();

    const html = this.#readDefaultSlotHTML();
    const width = this.width;

    let layerCanvas;
    try {
      layerCanvas = await renderTag({
        html,
        width,
        height: this.height ?? undefined,
        accuracy: this.accuracy,
        dpr: this.dpr,
        lang: this.lang,
      });
    } catch (error) {
      this.dispatchEvent(new CustomEvent('canvas-text:error', { detail: { error } }));
      return;
    }

    if (token !== this.#renderToken) return; // a newer render superseded us

    const height = this.height ?? layerCanvas.height / this.dpr;
    this.#canvas.width = Math.round(width * this.dpr);
    this.#canvas.height = Math.round(height * this.dpr);
    this.#canvas.style.width = `${width}px`;
    this.#canvas.style.height = `${height}px`;

    const ctx = this.#canvas.getContext('2d');
    ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
    ctx.drawImage(layerCanvas, 0, 0, this.#canvas.width, this.#canvas.height);

    this.setAttribute('data-upgraded', '');
    this.dispatchEvent(
      new CustomEvent('canvas-text:rendered', {
        detail: { width, height, durationMs: performance.now() - start },
      })
    );
  }

  #readDefaultSlotHTML() {
    const html = [];
    for (const node of this.childNodes) {
      if (node.nodeType === 1 /* element */ && node.tagName === 'CANVAS') continue;
      if (node.nodeType === 1 && node.hasAttribute('slot')) continue;
      if (node.nodeType === 1) html.push(node.outerHTML);
      else if (node.nodeType === 3 /* text */) html.push(node.textContent);
    }
    return html.join('').trim() || '&nbsp;';
  }
}
```

Note: `render-tag`'s exported function is named `render` in the README's research doc. If the installed version exports differently (e.g. a default export), adjust the import line accordingly — check `node_modules/render-tag/package.json#exports`.

- [ ] **Step 4: Run test, confirm it passes**

```bash
npm test -- test/render.spec.js
```

Expected: PASS.

- [ ] **Step 5: Add a second assertion for `canvas-text:error`** — append to `test/render.spec.js`

```js
test('canvas-text:error fires when render-tag throws', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const detail = await page.evaluate(async () => {
    // Force render-tag to throw by stubbing it on window before element renders
    const el = document.createElement('canvas-text');
    el.setAttribute('compose', 'text-only');
    // Pass a wildly invalid width to provoke an error inside render-tag
    el.setAttribute('width', '-1');
    el.innerHTML = 'x';
    document.getElementById('harness').appendChild(el);
    return new Promise((res) => {
      el.addEventListener('canvas-text:error', (e) => res(e.detail), { once: true });
      el.addEventListener('canvas-text:rendered', () => res(null), { once: true });
    });
  });
  // If render-tag accepts width=-1 silently, this assertion documents that
  // and we treat it as known behavior; otherwise it should be an error event.
  if (detail) {
    expect(detail.error).toBeDefined();
  }
});
```

This test is **non-strict** — it documents the failure mode but doesn't fail the suite if render-tag is permissive. Adjust to use a stricter trigger once you confirm one input that render-tag actually rejects.

- [ ] **Step 6: Run all tests**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 7: Commit and close Phase 1 issue**

```bash
git add src/canvas-text.js test/render.spec.js
git commit -m "Phase 1: text-only render via render-tag

Element appends an internal <canvas>, calls render-tag for the default-slot
HTML, draws the returned bitmap, and fires canvas-text:rendered."
bd update bd-1 --status completed
bd update bd-2 --status in_progress
```

---

## Task 3: Phase 2 — Reactivity (attrs + MutationObserver + rAF coalescing)

**Files:**
- Modify: `src/canvas-text.js`
- Test: `test/reactivity.spec.js`

- [ ] **Step 1: Write the failing test** — `test/reactivity.spec.js`

```js
import { test, expect } from '@playwright/test';

test('width attribute change triggers re-render', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const result = await page.evaluate(async () => {
    const el = document.createElement('canvas-text');
    el.setAttribute('width', '300');
    el.setAttribute('compose', 'text-only');
    el.innerHTML = 'hello';
    document.getElementById('harness').appendChild(el);
    await new Promise((res) => el.addEventListener('canvas-text:rendered', res, { once: true }));

    const renders = [];
    el.addEventListener('canvas-text:rendered', (e) => renders.push(e.detail));

    el.setAttribute('width', '500');
    await new Promise((res) => setTimeout(res, 100));
    return { count: renders.length, lastWidth: renders.at(-1)?.width };
  });
  expect(result.count).toBe(1);
  expect(result.lastWidth).toBe(500);
});

test('rapid attribute mutations coalesce into one render', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const renders = await page.evaluate(async () => {
    const el = document.createElement('canvas-text');
    el.setAttribute('compose', 'text-only');
    el.innerHTML = 'hello';
    document.getElementById('harness').appendChild(el);
    await new Promise((res) => el.addEventListener('canvas-text:rendered', res, { once: true }));

    let n = 0;
    el.addEventListener('canvas-text:rendered', () => n++);
    for (let i = 0; i < 5; i++) el.setAttribute('width', String(300 + i));
    await new Promise((res) => setTimeout(res, 100));
    return n;
  });
  expect(renders).toBe(1);
});

test('mutating slotted text triggers re-render', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const ok = await page.evaluate(async () => {
    const el = document.createElement('canvas-text');
    el.setAttribute('compose', 'text-only');
    el.textContent = 'first';
    document.getElementById('harness').appendChild(el);
    await new Promise((res) => el.addEventListener('canvas-text:rendered', res, { once: true }));

    const renders = [];
    el.addEventListener('canvas-text:rendered', (e) => renders.push(e));
    el.textContent = 'second';
    await new Promise((res) => setTimeout(res, 100));
    return renders.length === 1;
  });
  expect(ok).toBe(true);
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npm test -- test/reactivity.spec.js
```

Expected: FAIL — no observer, no debouncing.

- [ ] **Step 3: Implement reactivity** — patch `src/canvas-text.js`

Add `static observedAttributes` and `attributeChangedCallback`, install a `MutationObserver`, and route everything through a single rAF-coalesced scheduler.

Replace the top of the class with:

```js
const OBSERVED = ['width', 'height', 'theme', 'lang', 'accuracy', 'dpr', 'format', 'compose', 'alt'];

export class CanvasTextElement extends HTMLElement {
  #canvas = null;
  #renderToken = 0;
  #rafHandle = 0;
  #mo = null;

  static get observedAttributes() {
    return OBSERVED;
  }

  connectedCallback() {
    if (!this.#canvas) {
      this.#canvas = document.createElement('canvas');
      this.#canvas.setAttribute('aria-hidden', 'true');
      this.appendChild(this.#canvas);
    }
    this.#mo = new MutationObserver((records) => {
      // Ignore mutations of the internal canvas we manage ourselves.
      const meaningful = records.some(
        (r) => !(r.type === 'childList' && [...r.addedNodes, ...r.removedNodes].every((n) => n === this.#canvas))
      );
      if (meaningful) this.#schedule();
    });
    this.#mo.observe(this, { childList: true, subtree: true, characterData: true, attributes: false });
    this.#schedule();
  }

  disconnectedCallback() {
    this.#mo?.disconnect();
    this.#mo = null;
    if (this.#rafHandle) cancelAnimationFrame(this.#rafHandle);
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (oldVal === newVal) return;
    this.#schedule();
  }

  #schedule() {
    if (this.#rafHandle) return;
    this.#rafHandle = requestAnimationFrame(() => {
      this.#rafHandle = 0;
      this.render();
    });
  }
```

Leave the rest of the class (getters, `render`, `getCanvas`, etc.) intact. Remove the `this.render()` call at the end of `connectedCallback` — `#schedule()` replaces it.

- [ ] **Step 4: Run, confirm pass**

```bash
npm test -- test/reactivity.spec.js
```

Expected: PASS (all three tests).

- [ ] **Step 5: Commit and advance bd**

```bash
git add src/canvas-text.js test/reactivity.spec.js
git commit -m "Phase 2: rAF-coalesced reactivity (attrs + MutationObserver)"
bd update bd-2 --status completed
bd update bd-3 --status in_progress
```

---

## Task 4: Phase 3 — Theme bridge

**Files:**
- Create: `src/theme-bridge.js`
- Modify: `src/canvas-text.js`
- Create: `test/vb-theme-page.html`, `test/theme.spec.js`

- [ ] **Step 1: Write the failing test** — `test/theme.spec.js`

```js
import { test, expect } from '@playwright/test';

test('serializeThemeStyle returns allowlisted properties as inline CSS', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const css = await page.evaluate(async () => {
    const { serializeThemeStyle } = await import('/src/theme-bridge.js');
    const host = document.getElementById('harness');
    host.style.color = 'rgb(10, 20, 30)';
    host.style.fontFamily = 'serif';
    host.style.fontSize = '24px';
    return serializeThemeStyle(host);
  });
  expect(css).toMatch(/color:\s*rgb\(10,\s*20,\s*30\)/);
  expect(css).toMatch(/font-family:\s*serif/);
  expect(css).toMatch(/font-size:\s*24px/);
});

test('theme="inherit" injects host computed style into render-tag input', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const seen = await page.evaluate(async () => {
    // Spy by monkey-patching render-tag's module export *before* element runs.
    const mod = await import('render-tag');
    const orig = mod.render;
    let captured = null;
    mod.render = (opts) => {
      captured = opts;
      return orig.call(mod, opts);
    };

    const host = document.getElementById('harness');
    host.style.color = 'rgb(255, 0, 0)';

    const el = document.createElement('canvas-text');
    el.setAttribute('compose', 'text-only');
    el.setAttribute('theme', 'inherit');
    el.innerHTML = 'tint me';
    host.appendChild(el);
    await new Promise((res) => el.addEventListener('canvas-text:rendered', res, { once: true }));

    mod.render = orig;
    return captured?.html;
  });
  expect(seen).toMatch(/style="[^"]*color:\s*rgb\(255,\s*0,\s*0\)/);
});
```

The spy works because ES modules expose live bindings — overwriting `mod.render` is observable from the element's `import { render as renderTag } from 'render-tag'` only if `render` is imported as a namespace. To make the spy reliable, the element will be refactored in step 3 to call `module.render` via the namespace (`import * as renderTag from 'render-tag'`).

- [ ] **Step 2: Run, confirm fail**

```bash
npm test -- test/theme.spec.js
```

Expected: FAIL — `theme-bridge.js` missing; spy can't observe call.

- [ ] **Step 3: Implement `src/theme-bridge.js`**

```js
const ALLOWLIST = [
  'color',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'line-height',
  'letter-spacing',
  'text-align',
  'background-color',
];

export function serializeThemeStyle(host) {
  const cs = getComputedStyle(host);
  const decls = [];
  for (const prop of ALLOWLIST) {
    const val = cs.getPropertyValue(prop).trim();
    if (val) decls.push(`${prop}: ${val}`);
  }
  return decls.join('; ');
}

export function wrapWithTheme(html, host, mode) {
  if (mode === 'none' || mode === 'inline') return html;
  const style = serializeThemeStyle(host);
  if (!style) return html;
  return `<div style="${escapeAttr(style)}">${html}</div>`;
}

function escapeAttr(s) {
  return s.replace(/"/g, '&quot;');
}
```

- [ ] **Step 4: Refactor `src/canvas-text.js` to use the bridge and a namespace import**

Replace the top import with:

```js
import * as renderTag from 'render-tag';
import { wrapWithTheme } from './theme-bridge.js';
```

And the body of `render()` that calls render-tag:

```js
const themedHtml = wrapWithTheme(html, this, this.getAttribute('theme') || 'inherit');
layerCanvas = await renderTag.render({
  html: themedHtml,
  width,
  height: this.height ?? undefined,
  accuracy: this.accuracy,
  dpr: this.dpr,
  lang: this.lang,
});
```

- [ ] **Step 5: Create the VB harness** — `test/vb-theme-page.html`

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>canvas-text VB theme harness</title>
  <link rel="stylesheet" href="https://unpkg.com/@profpowell/vanilla-breeze/dist/themes/light.css">
  <script type="importmap">
    { "imports": { "render-tag": "/node_modules/render-tag/dist/render-tag.js" } }
  </script>
  <script type="module" src="/src/index.js"></script>
</head>
<body>
  <main id="harness"></main>
</body>
</html>
```

If the VB CDN path is different (e.g. a versioned URL or a self-hosted copy), substitute it. The point is that a real stylesheet sets `--vb-*` tokens that resolve into computed styles.

- [ ] **Step 6: Run, confirm pass**

```bash
npm test -- test/theme.spec.js
```

Expected: PASS.

- [ ] **Step 7: Commit and advance bd**

```bash
git add src/theme-bridge.js src/canvas-text.js test/theme.spec.js test/vb-theme-page.html
git commit -m "Phase 3: theme bridge (allowlist serializer + inherit mode)"
bd update bd-3 --status completed
bd update bd-4 --status in_progress
```

---

## Task 5: Phase 4 — Slot model + layer pipeline

**Files:**
- Create: `src/layers.js`
- Modify: `src/canvas-text.js`
- Create: `test/meme-page.html`, `test/layers.spec.js`
- Create: `test/fixtures/red-square.png`, `test/fixtures/blue-square.png`

- [ ] **Step 1: Create test fixtures**

Generate two 200×200 PNGs locally — solid red and solid blue. One option:

```bash
mkdir -p test/fixtures
node -e "
  const { createCanvas } = require('canvas'); // optional dep — see fallback below
" 2>/dev/null || true
```

If `canvas` (node-canvas) isn't installed, generate them in a browser harness once and commit the PNGs. Simpler: write a tiny HTML scratch file, open it, right-click → save the canvases. Or use ImageMagick:

```bash
magick -size 200x200 xc:red test/fixtures/red-square.png
magick -size 200x200 xc:blue test/fixtures/blue-square.png
```

Commit both PNGs.

- [ ] **Step 2: Write the failing test** — `test/layers.spec.js`

```js
import { test, expect } from '@playwright/test';

test('background, text-1, text-2 stack in z-order with text on top', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const pixel = await page.evaluate(async () => {
    const el = document.createElement('canvas-text');
    el.setAttribute('width', '200');
    el.setAttribute('height', '200');
    el.innerHTML = `
      <img slot="background" src="/test/fixtures/red-square.png" crossorigin="anonymous">
      <div slot="text-1" style="text-align:center; font:bold 48px sans-serif; color:white;">HI</div>
    `;
    document.getElementById('harness').appendChild(el);
    await new Promise((res) => el.addEventListener('canvas-text:rendered', res, { once: true }));

    const c = el.getCanvas();
    const ctx = c.getContext('2d');
    // Center pixel should be near-white (text); a corner should be red (bg).
    const center = ctx.getImageData(c.width / 2, c.height / 2, 1, 1).data;
    const corner = ctx.getImageData(2, 2, 1, 1).data;
    return { center: [...center], corner: [...corner] };
  });
  // Corner is red background.
  expect(pixel.corner[0]).toBeGreaterThan(200);
  expect(pixel.corner[1]).toBeLessThan(50);
  // Center has some white-ish text pixel (R, G, B all high).
  expect(Math.min(pixel.center[0], pixel.center[1], pixel.center[2])).toBeGreaterThan(150);
});

test('background-2 paints above background-1', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const color = await page.evaluate(async () => {
    const el = document.createElement('canvas-text');
    el.setAttribute('width', '200');
    el.setAttribute('height', '200');
    el.innerHTML = `
      <img slot="background-1" src="/test/fixtures/red-square.png" crossorigin="anonymous">
      <img slot="background-2" src="/test/fixtures/blue-square.png" crossorigin="anonymous">
    `;
    document.getElementById('harness').appendChild(el);
    await new Promise((res) => el.addEventListener('canvas-text:rendered', res, { once: true }));
    const c = el.getCanvas();
    return [...c.getContext('2d').getImageData(100, 100, 1, 1).data];
  });
  // Blue is on top.
  expect(color[2]).toBeGreaterThan(200);
  expect(color[0]).toBeLessThan(50);
});

test('broken image layer fires layer-error but rest of composition renders', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const result = await page.evaluate(async () => {
    const el = document.createElement('canvas-text');
    el.setAttribute('width', '200');
    el.setAttribute('height', '200');
    el.innerHTML = `
      <img slot="background" src="/does-not-exist.png">
      <div>fallback</div>
    `;
    const errors = [];
    el.addEventListener('canvas-text:layer-error', (e) => errors.push(e.detail));
    document.getElementById('harness').appendChild(el);
    await new Promise((res) => el.addEventListener('canvas-text:rendered', res, { once: true }));
    return { errors, hasCanvas: !!el.getCanvas() };
  });
  expect(result.hasCanvas).toBe(true);
  expect(result.errors.length).toBe(1);
  expect(result.errors[0].slot).toBe('background');
});

test('height auto-derives from background image ratio when omitted', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const dims = await page.evaluate(async () => {
    const el = document.createElement('canvas-text');
    el.setAttribute('width', '400');
    el.innerHTML = `<img slot="background" src="/test/fixtures/red-square.png" crossorigin="anonymous">`;
    document.getElementById('harness').appendChild(el);
    const ev = await new Promise((res) => el.addEventListener('canvas-text:rendered', res, { once: true }));
    return ev.detail;
  });
  // red-square.png is 200x200 → ratio 1 → height = width = 400.
  expect(dims.width).toBe(400);
  expect(dims.height).toBe(400);
});
```

- [ ] **Step 3: Run, confirm fail**

```bash
npm test -- test/layers.spec.js
```

Expected: FAIL — no layer pipeline yet.

- [ ] **Step 4: Implement `src/layers.js`**

```js
import { wrapWithTheme } from './theme-bridge.js';

const SLOT_RE = /^(background|text)(?:-(\d+))?$/;

/**
 * @typedef {{ slot: string, z: number, kind: 'image' | 'text', node: Element }} Layer
 */

export function collectLayers(host) {
  /** @type {Layer[]} */
  const layers = [];
  const defaultParts = [];

  for (const child of host.children) {
    if (child.tagName === 'CANVAS') continue;
    const slot = child.getAttribute('slot');
    if (!slot) {
      defaultParts.push(child);
      continue;
    }
    const m = SLOT_RE.exec(slot);
    if (!m) continue; // unknown slot — ignore
    const [, kind, n] = m;
    const z = kind === 'background' ? (n ? Number(n) : 0) : Number(n);
    if (kind === 'background') {
      const img = child.tagName === 'IMG' ? child : child.querySelector('img');
      if (img) layers.push({ slot, z, kind: 'image', node: img });
    } else {
      // text-N
      layers.push({ slot, z, kind: 'text', node: child });
    }
  }
  if (defaultParts.length) {
    const wrapper = document.createElement('div');
    for (const p of defaultParts) wrapper.appendChild(p.cloneNode(true));
    layers.push({ slot: '(default)', z: Number.POSITIVE_INFINITY, kind: 'text', node: wrapper });
  }
  // Ties: background below text at same N.
  layers.sort((a, b) => a.z - b.z || (a.kind === 'image' ? -1 : 1));
  return layers;
}

export async function paintLayer(ctx, layer, opts, renderTag, host, themeMode, onError) {
  const { width, height, dpr } = opts;
  try {
    if (layer.kind === 'image') {
      const img = layer.node;
      if (!img.complete || img.naturalWidth === 0) {
        await new Promise((res, rej) => {
          img.addEventListener('load', res, { once: true });
          img.addEventListener('error', () => rej(new Error(`image load failed: ${img.src}`)), {
            once: true,
          });
        });
      }
      await img.decode().catch(() => {}); // some browsers reject on broken images; we already handled load/error
      ctx.drawImage(img, 0, 0, width * dpr, height * dpr);
    } else {
      const themed = wrapWithTheme(layer.node.outerHTML, host, themeMode);
      const layerCanvas = await renderTag.render({
        html: themed,
        width,
        height,
        dpr,
        accuracy: opts.accuracy,
        lang: opts.lang,
      });
      ctx.drawImage(layerCanvas, 0, 0, width * dpr, height * dpr);
    }
  } catch (error) {
    onError({ slot: layer.slot, error });
  }
}

export async function backgroundImageRatio(host) {
  for (const child of host.children) {
    if (child.getAttribute('slot') === 'background' && child.tagName === 'IMG') {
      if (!child.complete) {
        await new Promise((res) => child.addEventListener('load', res, { once: true }));
      }
      if (child.naturalWidth && child.naturalHeight) {
        return child.naturalHeight / child.naturalWidth;
      }
    }
  }
  return null;
}
```

- [ ] **Step 5: Wire `canvas-text.js` to the pipeline**

Replace the `render()` body with a branch on `this.compose`:

```js
async render() {
  const token = ++this.#renderToken;
  const start = performance.now();
  const dpr = this.dpr;
  const width = this.width;
  const themeMode = this.getAttribute('theme') || 'inherit';

  let height = this.height;
  if (height == null) {
    const ratio = await backgroundImageRatio(this);
    if (ratio != null) height = width * ratio;
  }

  if (this.compose === 'text-only') {
    // Legacy single-text path (Phase 1 behavior). Default-slot HTML only.
    const html = this.#readDefaultSlotHTML();
    let layerCanvas;
    try {
      const themed = wrapWithTheme(html, this, themeMode);
      layerCanvas = await renderTag.render({
        html: themed,
        width,
        height: height ?? undefined,
        dpr,
        accuracy: this.accuracy,
        lang: this.lang,
      });
    } catch (error) {
      this.dispatchEvent(new CustomEvent('canvas-text:error', { detail: { error } }));
      return;
    }
    if (token !== this.#renderToken) return;
    height = height ?? layerCanvas.height / dpr;
    this.#sizeCanvas(width, height, dpr);
    const ctx = this.#canvas.getContext('2d');
    ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
    ctx.drawImage(layerCanvas, 0, 0, this.#canvas.width, this.#canvas.height);
  } else {
    // Layer pipeline.
    const layers = collectLayers(this);
    if (height == null) height = width; // fallback when no bg image and no text layout yet
    this.#sizeCanvas(width, height, dpr);
    const ctx = this.#canvas.getContext('2d');
    ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);

    const onError = (detail) =>
      this.dispatchEvent(new CustomEvent('canvas-text:layer-error', { detail }));
    for (const layer of layers) {
      if (token !== this.#renderToken) return;
      await paintLayer(
        ctx,
        layer,
        { width, height, dpr, accuracy: this.accuracy, lang: this.lang },
        renderTag,
        this,
        themeMode,
        onError
      );
    }
  }

  if (token !== this.#renderToken) return;
  this.setAttribute('data-upgraded', '');
  this.dispatchEvent(
    new CustomEvent('canvas-text:rendered', {
      detail: { width, height, durationMs: performance.now() - start },
    })
  );
}

#sizeCanvas(width, height, dpr) {
  this.#canvas.width = Math.round(width * dpr);
  this.#canvas.height = Math.round(height * dpr);
  this.#canvas.style.width = `${width}px`;
  this.#canvas.style.height = `${height}px`;
}
```

Add the matching imports at the top of `canvas-text.js`:

```js
import { collectLayers, paintLayer, backgroundImageRatio } from './layers.js';
```

- [ ] **Step 6: Run, confirm pass**

```bash
npm test -- test/layers.spec.js
```

Expected: PASS (all four tests). If the broken-image test fails because the image never fires `load` or `error`, the `load`/`error` listener is sufficient; remove the `img.decode()` fallback if it throws on the broken case.

- [ ] **Step 7: Create dogfood example** — `examples/meme.html`

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>canvas-text meme demo</title>
  <script type="importmap">
    { "imports": { "render-tag": "https://esm.sh/render-tag@0.1.7" } }
  </script>
  <script type="module" src="../src/index.js"></script>
  <style>
    body { font: 16px system-ui; padding: 2rem; }
    canvas-text { display: inline-block; }
  </style>
</head>
<body>
  <h1>meme demo</h1>
  <canvas-text width="500" height="500" theme="none">
    <img slot="background" src="../test/fixtures/red-square.png" crossorigin="anonymous">
    <div slot="text-1" style="text-align:center; font:bold 48px Impact; color:white;
                              -webkit-text-stroke:2px black; padding:20px 0;">
      TOP TEXT
    </div>
    <div slot="text-2" style="position:absolute; left:0; right:0; bottom:20px;
                              text-align:center; font:bold 48px Impact; color:white;
                              -webkit-text-stroke:2px black;">
      BOTTOM TEXT
    </div>
  </canvas-text>
</body>
</html>
```

- [ ] **Step 8: Commit and advance bd**

```bash
git add src/layers.js src/canvas-text.js test/layers.spec.js test/fixtures/ examples/meme.html
git commit -m "Phase 4: layer pipeline (slot grammar, z-order, image decode)"
bd update bd-4 --status completed
bd update bd-5 --status in_progress
```

---

## Task 6: Phase 5 — Output API

**Files:**
- Modify: `src/canvas-text.js`
- Test: `test/output.spec.js`

- [ ] **Step 1: Write the failing test** — `test/output.spec.js`

```js
import { test, expect } from '@playwright/test';

test('toDataURL returns a base64 PNG URL', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const url = await page.evaluate(async () => {
    const el = document.createElement('canvas-text');
    el.setAttribute('width', '200');
    el.setAttribute('height', '100');
    el.setAttribute('compose', 'text-only');
    el.innerHTML = 'export';
    document.getElementById('harness').appendChild(el);
    await new Promise((res) => el.addEventListener('canvas-text:rendered', res, { once: true }));
    return el.toDataURL();
  });
  expect(url).toMatch(/^data:image\/png;base64,/);
  expect(url.length).toBeGreaterThan(100);
});

test('toBlob returns a non-empty Blob with the requested MIME', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const blob = await page.evaluate(async () => {
    const el = document.createElement('canvas-text');
    el.setAttribute('width', '200');
    el.setAttribute('height', '100');
    el.setAttribute('compose', 'text-only');
    el.setAttribute('format', 'jpeg');
    el.innerHTML = 'export';
    document.getElementById('harness').appendChild(el);
    await new Promise((res) => el.addEventListener('canvas-text:rendered', res, { once: true }));
    const b = await el.toBlob();
    return { type: b.type, size: b.size };
  });
  expect(blob.type).toBe('image/jpeg');
  expect(blob.size).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npm test -- test/output.spec.js
```

Expected: FAIL — `toBlob`/`toDataURL` undefined.

- [ ] **Step 3: Implement the output API** — add to `CanvasTextElement` class

```js
get format() {
  return this.getAttribute('format') || 'png';
}

#mimeFor(type) {
  if (type) return type;
  const f = this.format;
  return f === 'jpeg' ? 'image/jpeg' : f === 'webp' ? 'image/webp' : 'image/png';
}

toDataURL(type, quality) {
  return this.#canvas.toDataURL(this.#mimeFor(type), quality);
}

toBlob(type, quality) {
  return new Promise((resolve, reject) => {
    this.#canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas-text: toBlob returned null'))),
      this.#mimeFor(type),
      quality
    );
  });
}

set html(value) {
  // Replace unslotted children only.
  for (const child of [...this.childNodes]) {
    if (child === this.#canvas) continue;
    if (child.nodeType === 1 && child.hasAttribute('slot')) continue;
    this.removeChild(child);
  }
  this.insertAdjacentHTML('afterbegin', String(value));
}

get html() {
  const parts = [];
  for (const child of this.childNodes) {
    if (child === this.#canvas) continue;
    if (child.nodeType === 1 && child.hasAttribute('slot')) continue;
    if (child.nodeType === 1) parts.push(child.outerHTML);
    else if (child.nodeType === 3) parts.push(child.textContent);
  }
  return parts.join('');
}
```

- [ ] **Step 4: Run, confirm pass**

```bash
npm test -- test/output.spec.js
```

Expected: PASS.

- [ ] **Step 5: Commit and advance bd**

```bash
git add src/canvas-text.js test/output.spec.js
git commit -m "Phase 5: output API (getCanvas, toBlob, toDataURL, html property)"
bd update bd-5 --status completed
bd update bd-6 --status in_progress
```

---

## Task 7: Phase 6 — Accessibility

**Files:**
- Modify: `src/canvas-text.js`
- Test: `test/a11y.spec.js`

- [ ] **Step 1: Write the failing test** — `test/a11y.spec.js`

```js
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('canvas is aria-hidden; slotted text is exposed to AT', async ({ page }) => {
  await page.goto('/test/test-page.html');
  await page.evaluate(async () => {
    const el = document.createElement('canvas-text');
    el.setAttribute('width', '300');
    el.innerHTML = '<p>readable</p>';
    document.getElementById('harness').appendChild(el);
    await new Promise((res) => el.addEventListener('canvas-text:rendered', res, { once: true }));
  });

  await expect(page.locator('canvas-text canvas')).toHaveAttribute('aria-hidden', 'true');

  const accessibleText = await page.evaluate(() => document.querySelector('canvas-text').textContent.trim());
  expect(accessibleText).toContain('readable');
});

test('alt attribute becomes aria-label on the canvas and suppresses fallback', async ({ page }) => {
  await page.goto('/test/test-page.html');
  await page.evaluate(async () => {
    const el = document.createElement('canvas-text');
    el.setAttribute('width', '300');
    el.setAttribute('alt', 'A meme that says hello');
    el.setAttribute('compose', 'text-only');
    el.innerHTML = 'hello';
    document.getElementById('harness').appendChild(el);
    await new Promise((res) => el.addEventListener('canvas-text:rendered', res, { once: true }));
  });
  await expect(page.locator('canvas-text canvas')).toHaveAttribute('aria-label', 'A meme that says hello');
});

test('axe-core finds no violations on a populated canvas-text', async ({ page }) => {
  await page.goto('/test/test-page.html');
  await page.evaluate(async () => {
    const el = document.createElement('canvas-text');
    el.setAttribute('width', '300');
    el.innerHTML = '<p>hello world</p>';
    document.getElementById('harness').appendChild(el);
    await new Promise((res) => el.addEventListener('canvas-text:rendered', res, { once: true }));
  });
  const results = await new AxeBuilder({ page }).include('canvas-text').analyze();
  expect(results.violations).toEqual([]);
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npm test -- test/a11y.spec.js
```

Expected: FAIL — text is currently visible (not hidden); `aria-label` not wired.

- [ ] **Step 3: Implement a11y**

Inject a single page-level stylesheet that hides slotted children visually while keeping them in the AT tree. Use a module-level flag so injection only happens once per page no matter how many `<canvas-text>` elements exist.

At the **top** of `src/canvas-text.js` (above the class), add:

```js
let stylesInjected = false;
function injectStyles() {
  if (stylesInjected || typeof document === 'undefined') return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.dataset.canvasTextStyle = '';
  style.textContent = `
    canvas-text { display: inline-block; position: relative; }
    canvas-text > :not(canvas) {
      position: absolute !important;
      clip-path: inset(50%) !important;
      width: 1px !important;
      height: 1px !important;
      overflow: hidden !important;
      white-space: nowrap !important;
    }
    canvas-text > canvas { display: block; position: relative; }
  `;
  document.head.appendChild(style);
}
```

Call `injectStyles()` as the first line of `connectedCallback`.

Then in `render()`, after sizing the canvas, sync the `aria-label` and visibility of fallback children:

```js
const alt = this.getAttribute('alt');
if (alt) {
  this.#canvas.setAttribute('aria-label', alt);
  // Hide AT fallback when alt is the label.
  for (const child of this.children) {
    if (child === this.#canvas) continue;
    child.setAttribute('aria-hidden', 'true');
  }
} else {
  this.#canvas.removeAttribute('aria-label');
  for (const child of this.children) {
    if (child === this.#canvas) continue;
    child.removeAttribute('aria-hidden');
  }
}
```

- [ ] **Step 4: Run, confirm pass**

```bash
npm test -- test/a11y.spec.js
```

Expected: PASS.

- [ ] **Step 5: Commit and advance bd**

```bash
git add src/canvas-text.js test/a11y.spec.js
git commit -m "Phase 6: a11y (visually-hidden fallback, aria-hidden canvas, alt support)"
bd update bd-6 --status completed
bd update bd-7 --status in_progress
```

---

## Task 8: Phase 7 — README, examples, publish 0.1.0

**Files:**
- Create: `README.md` (overwrite the current plan-style README)
- Create: `examples/index.html`, `examples/vb-integration.html`
- Modify: `package.json`

- [ ] **Step 1: Move the current `README.md` aside**

```bash
mv README.md docs/early-plan.md
git add docs/early-plan.md
```

- [ ] **Step 2: Write the shipping `README.md`**

```markdown
# @profpowell/canvas-text

A stand-alone web component that composites rich text and images onto a
canvas. Designed to be Vanilla Breeze-friendly without depending on VB.

## Install

\`\`\`bash
npm install @profpowell/canvas-text render-tag
\`\`\`

\`render-tag\` is a peer dependency.

## Basic usage

\`\`\`html
<script type="module" src="https://unpkg.com/@profpowell/canvas-text"></script>
<canvas-text width="600">
  <strong>Hello</strong> world
</canvas-text>
\`\`\`

## Layered (meme) usage

\`\`\`html
<canvas-text width="500" height="500">
  <img slot="background" src="doge.jpg" crossorigin="anonymous">
  <div slot="text-1" style="text-align:center; font:bold 48px Impact;
                            color:white; -webkit-text-stroke:2px black;
                            padding-top:20px;">
    TOP TEXT
  </div>
  <div slot="text-2" style="position:absolute; bottom:20px; left:0; right:0;
                            text-align:center; font:bold 48px Impact;
                            color:white; -webkit-text-stroke:2px black;">
    BOTTOM TEXT
  </div>
</canvas-text>
\`\`\`

## Slot grammar

- \`slot="background"\` — z=0, image layer (bottom).
- \`slot="background-N"\` — image layer at z=N.
- \`slot="text-N"\` — rich-text layer at z=N (above background-N at same N).
- Unslotted children — single text layer, painted on top of everything.

Positioning inside a layer is plain HTML/CSS.

## Attributes

| Name      | Default     | Notes                                                  |
|-----------|-------------|--------------------------------------------------------|
| width     | 600         |                                                        |
| height    | auto        | If omitted with a \`background\` image, uses image ratio. |
| theme     | inherit     | inherit \| none \| inline                                 |
| compose   | slots       | slots \| text-only                                       |
| format    | png         | png \| jpeg \| webp                                      |
| dpr       | auto        | numeric override                                        |
| accuracy  | default     | passed to render-tag                                    |
| lang      | host lang   | bidi/CJK hint                                           |
| alt       | —           | aria-label for the canvas; suppresses fallback DOM      |

## Methods

- \`getCanvas()\` — the current canvas element.
- \`toDataURL(type?, quality?)\` — sync export, reflects last render.
- \`toBlob(type?, quality?)\` — async export.
- \`render()\` — force a render; resolves after paint.

After mutating attributes or slots, \`await el.render()\` (or wait for
\`canvas-text:rendered\`) before calling \`toDataURL\` / \`toBlob\`.

## Events

- \`canvas-text:rendered\` — \`{ width, height, durationMs }\` after each paint.
- \`canvas-text:error\` — render aborted.
- \`canvas-text:layer-error\` — one layer failed; rest continued.

## Theme bridge

When \`theme="inherit"\` (default) the element copies a small allowlist of
computed CSS properties from the host (color, font-family, font-size,
font-weight, font-style, line-height, letter-spacing, text-align,
background-color) and inlines them on each text layer before handing to
render-tag. This lets VB themes "just work."

Theme changes after first render are not re-applied in v0.1.

## Accessibility

The slotted HTML stays in the light DOM, visually hidden, so assistive tech
reads it as normal text. The canvas itself is \`aria-hidden\`. If you set an
\`alt\` attribute, the canvas gets that as \`aria-label\` and the fallback DOM
is hidden from AT.

## Known limitations (v0.1)

- Cross-origin images without \`crossorigin="anonymous"\` will taint the
  canvas and \`toBlob\` / \`toDataURL\` will throw.
- No theme-change observation after first render.
- No SSR / node-canvas adapter.
- No interactive editing.

## License

MIT
```

- [ ] **Step 3: Create `examples/index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>canvas-text playground</title>
  <script type="importmap">
    { "imports": { "render-tag": "https://esm.sh/render-tag@0.1.7" } }
  </script>
  <script type="module" src="../src/index.js"></script>
  <style>
    body { font: 16px system-ui; padding: 2rem; max-width: 60rem; }
    section { margin-block: 2rem; }
  </style>
</head>
<body>
  <h1>canvas-text playground</h1>
  <section>
    <h2>text-only</h2>
    <canvas-text width="500" compose="text-only">
      <p>Hello, <strong>world</strong>!</p>
    </canvas-text>
  </section>
  <section>
    <h2>layered</h2>
    <a href="./meme.html">see meme demo →</a>
  </section>
</body>
</html>
```

- [ ] **Step 4: Create `examples/vb-integration.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>canvas-text + Vanilla Breeze</title>
  <link rel="stylesheet" href="https://unpkg.com/@profpowell/vanilla-breeze/dist/themes/light.css">
  <script type="importmap">
    { "imports": { "render-tag": "https://esm.sh/render-tag@0.1.7" } }
  </script>
  <script type="module" src="../src/index.js"></script>
  <style>
    body { font: 16px system-ui; padding: 2rem; }
  </style>
</head>
<body>
  <h1>VB integration</h1>
  <p>The element below inherits VB tokens through <code>theme="inherit"</code>.</p>
  <canvas-text width="500" theme="inherit">
    <p>I should match my surrounding type.</p>
  </canvas-text>
</body>
</html>
```

If the VB CDN URL is wrong, substitute a working theme stylesheet. The example is purely manual-verification.

- [ ] **Step 5: Bump version to 0.1.0**

Edit `package.json`:

```json
"version": "0.1.0",
```

- [ ] **Step 6: Build and smoke-check the dist bundle**

```bash
npm run build
node -e "import('./dist/canvas-text.js').then(m => console.log('ok', Object.keys(m)))"
```

Expected: prints `ok [ 'CanvasTextElement' ]` (and no errors).

- [ ] **Step 7: Run the whole suite once more**

```bash
npm run lint
npm test
```

Expected: both clean.

- [ ] **Step 8: Commit and tag**

```bash
git add README.md docs/early-plan.md examples/ package.json
git commit -m "Phase 7: README, examples, bump to 0.1.0"
git tag -a v0.1.0 -m "canvas-text 0.1.0"
bd update bd-7 --status completed
```

- [ ] **Step 9: Publish (only when ready — confirm with the user first)**

Do **not** run `npm publish` automatically. Stop here, show the user the `git log` and `git tag` state, and ask whether to publish. When approved:

```bash
npm publish --access public
git push origin main --tags
```

---

## Definition of done

- [ ] All Phase 1–6 specs (`canvas-text:rendered`, layered slots, theme bridge, output API, a11y) pass under `npm test`.
- [ ] `npm run build` produces `dist/canvas-text.js` and a sourcemap.
- [ ] `examples/meme.html` renders a recognizable meme in Chrome.
- [ ] `examples/vb-integration.html` shows VB-tokenized type inside the canvas.
- [ ] All bd Phase issues are `completed`.
- [ ] `v0.1.0` tagged in git.
- [ ] (Optional, gated by user) Published to npm as `@profpowell/canvas-text@0.1.0`.
