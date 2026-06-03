# Vanilla Breeze Docs Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-base the canvas-text docs site (`docs/`) on vanilla-breeze@0.1.4 — zero-class semantic HTML + `data-layout`, Classic theme, VB light/dark — deleting the hand-rolled `styles.css`, while keeping `<canvas-text>`, `<code-block>`, `<browser-window>`.

**Architecture:** Each docs page loads VB CSS + theme CSS + JS from CDN and sets `<html data-theme="classic">`. Page bodies become plain semantic HTML; grouping uses `data-layout` attributes (often on the semantic element itself, e.g. `<figure data-layout="cluster">`) instead of wrapper divs. A shared `docs/site.js` provides the dark-mode toggle (flips `data-mode="dark"`, persisted in localStorage). `styles.css` is deleted.

**Tech Stack:** vanilla-breeze@0.1.4 (CDN), the existing `@profpowell` web components (canvas-text/code-block/browser-window), Vite, Playwright.

**Spec:** `docs/superpowers/specs/2026-06-02-vanilla-breeze-docs-site-design.md`

---

## File Structure

- `docs/site.js` — **new.** The dark-mode toggle (restore on load + click handler). Shared by all pages. One responsibility.
- `docs/index.html` — **rewrite body to zero-class**; new head includes; `data-theme="classic"`.
- `docs/demos.html` — same; preserves `<canvas-text>`/`<code-block>`/`<browser-window>` markup and section ids verbatim.
- `docs/api.html` — same; `.api-table` → plain `<table>`.
- `docs/{meme,badge,banner,og-card,caption}.html` — add VB CSS link + `data-theme="classic"`; trim inline `<style>` to essentials.
- `docs/styles.css` — **deleted** (last task).
- `test/site.spec.js` — **new.** Per-page structural assertions (VB linked, theme set, styles.css gone, removed classes absent).

### The canonical head block (used on index/demos/api)

Every main docs page `<head>` keeps its existing `<title>`/`<meta>`, its `render-tag` importmap, and its component scripts, and swaps the stylesheet line. The VB block to insert (immediately after the existing `<meta name="description">`):

```html
  <link rel="stylesheet" href="https://unpkg.com/vanilla-breeze@0.1.4/dist/cdn/vanilla-breeze.css">
  <link rel="stylesheet" href="https://unpkg.com/vanilla-breeze@0.1.4/dist/cdn/themes/classic.css">
  <script type="module" src="https://unpkg.com/vanilla-breeze@0.1.4/dist/cdn/vanilla-breeze.js"></script>
```

The `<link rel="stylesheet" href="./styles.css">` line is **removed**. The root element becomes `<html lang="en" data-theme="classic">`. `docs/site.js` is loaded right before `</body>`: `<script src="./site.js"></script>`.

### The zero-class mapping (applies to all three main pages)

| Remove (class) | Replace with |
|---|---|
| `header.site-header` | `<header>` |
| `div.nav-links` | links placed directly in `<nav>` |
| `a.nav-brand` | `<a>` (first link in nav) |
| `a.active` | `<a … aria-current="page">` |
| `button.theme-toggle` (+ `onclick="toggleTheme()"`) | `<button type="button" id="mode-toggle" aria-label="Toggle dark mode">🌓</button>` |
| `footer.site-footer` | `<footer>` |
| `section.demo-section` | `<section>` (keep `id`) |
| `p.demo-description` / `p.tagline` | `<p>` |
| `div.canvas-text-frame` | `<figure>` (wrap the `<canvas-text>`) |
| `div.side-by-side` | `<div data-layout="cluster">` |
| `div.export-buttons` / `div.dynamic-form` | `<div data-layout="cluster">` |
| `section.hero` / `div.hero-demo` | `<section data-layout="stack">` / `<figure>` |
| `div.hero-actions` | `<div data-layout="cluster">` |
| `a.btn.primary` / `a.btn.secondary` | `<a>` (drop btn classes; VB styles links/buttons) |
| `section.features` / `div.feature-grid` / `div.feature-card` | `<section>` / `<ul data-layout="grid">` / `<li>` |
| `section.quick-start` | `<section>` |
| `section.live-demos` | `<section>` |
| `section.related` / `div.related-grid` / `a.related-card` | `<section>` / `<nav data-layout="grid">` / `<a>` |
| `table.api-table` | `<table>` (VB styles native tables) |

**Rules:** preserve all section `id`s (in-page anchors), preserve all `<canvas-text>`/`<code-block>`/`<browser-window>` markup verbatim, and leave **no** layout-only `<div>` without a `data-layout`. Remove the per-page `function toggleTheme(){…}` and its `<style>`/inline theme code (all of that lived in `styles.css`).

---

## Task 1: Shared dark-mode toggle + convert index.html

**Files:**
- Create: `docs/site.js`
- Modify: `docs/index.html`
- Create test: `test/site.spec.js`

- [ ] **Step 1: Write the failing test**

```js
// test/site.spec.js
import { test, expect } from '@playwright/test';

async function audit(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  return page.evaluate(() => ({
    vbLinked: !!document.querySelector('link[href*="vanilla-breeze"]'),
    theme: document.documentElement.getAttribute('data-theme'),
    oldStyles: !!document.querySelector('link[href="./styles.css"]'),
    removedClasses: ['demo-section', 'site-header', 'nav-links', 'canvas-text-frame', 'api-table', 'theme-toggle']
      .filter((c) => document.querySelector('.' + c)),
    siteJs: !!document.querySelector('script[src="./site.js"]'),
  }));
}

test('index.html is on vanilla-breeze (classic, no styles.css, no bespoke classes)', async ({ page }) => {
  const a = await audit(page, '/docs/index.html');
  expect(a.vbLinked).toBe(true);
  expect(a.theme).toBe('classic');
  expect(a.oldStyles).toBe(false);
  expect(a.removedClasses).toEqual([]);
  expect(a.siteJs).toBe(true);
});

test('dark-mode toggle flips data-mode on <html>', async ({ page }) => {
  await page.goto('/docs/index.html', { waitUntil: 'domcontentloaded' });
  const before = await page.evaluate(() => document.documentElement.dataset.mode || '');
  await page.click('#mode-toggle');
  const after = await page.evaluate(() => document.documentElement.dataset.mode || '');
  expect(before).toBe('');
  expect(after).toBe('dark');
});

test('index hero canvas-text still renders', async ({ page }) => {
  await page.goto('/docs/index.html', { waitUntil: 'domcontentloaded' });
  const ink = await page.evaluate(async () => {
    const el = document.querySelector('canvas-text');
    await new Promise((res) => {
      if (el.hasAttribute('data-upgraded')) return res();
      el.addEventListener('canvas-text:rendered', res, { once: true });
    });
    const c = el.getCanvas();
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n;
  });
  expect(ink).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/site.spec.js`
Expected: FAIL — `data-theme` is null, `styles.css` still linked, bespoke classes present, no `#mode-toggle`/`site.js`.

- [ ] **Step 3: Create `docs/site.js`**

```js
// Dark-mode toggle for the docs site. Flips data-mode="dark" on <html>,
// persisted in localStorage; vanilla-breeze styles [data-theme~=classic][data-mode=dark].
(() => {
  const root = document.documentElement;
  if (localStorage.getItem('mode') === 'dark') root.dataset.mode = 'dark';
  const btn = document.getElementById('mode-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (root.dataset.mode === 'dark') {
      delete root.dataset.mode;
      localStorage.removeItem('mode');
    } else {
      root.dataset.mode = 'dark';
      localStorage.setItem('mode', 'dark');
    }
  });
})();
```

- [ ] **Step 4: Rewrite `docs/index.html`**

Apply to the existing file:
1. `<html lang="en">` → `<html lang="en" data-theme="classic">`.
2. In `<head>`: remove `<link rel="stylesheet" href="./styles.css">`; insert the three VB lines (see "canonical head block") after the `<meta name="description">`. Keep the `render-tag` importmap and `./dist/canvas-text.js` script.
3. Header/nav: replace `<header class="site-header"><nav>…<div class="nav-links">…</div></nav></header>` with:

```html
  <header>
    <nav>
      <a href="index.html">&lt;canvas-text&gt;</a>
      <a href="index.html" aria-current="page">Home</a>
      <a href="demos.html">Demos</a>
      <a href="api.html">API</a>
      <a href="https://github.com/ProfPowell/canvas-text">GitHub</a>
      <button type="button" id="mode-toggle" aria-label="Toggle dark mode">🌓</button>
    </nav>
  </header>
```

4. `<main>` → `<main data-layout="stack">`.
5. Apply the zero-class mapping table to the body: hero → `<section data-layout="stack">` with `<h1>`/`<p>` (drop `.tagline`); hero demo box → `<figure>` wrapping the existing `<canvas-text>` (markup unchanged); `.features`/`.feature-grid`/`.feature-card` → `<section>`/`<ul data-layout="grid">`/`<li>`; `.quick-start`/`.live-demos` → `<section>` (keep ids/links); `.hero-actions` → `<div data-layout="cluster">` with plain `<a>` links (drop `.btn.primary/.secondary`); `.related`/`.related-grid`/`.related-card` → `<section>`/`<nav data-layout="grid">`/`<a>`; `<footer class="site-footer">` → `<footer>`.
6. Delete the `<script>function toggleTheme(){…}</script>` block. Before `</body>` add `<script src="./site.js"></script>`.
7. Confirm no `class="…"` attributes remain in the file (component-provided classes excepted; none exist here).

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- test/site.spec.js`
Expected: PASS (3 tests). Then `npm test -- test/demos.spec.js` to confirm the existing `index.html uses <code-block>` test still passes (the `<code-block>` blocks are untouched).

- [ ] **Step 6: Commit**

```bash
git add docs/site.js docs/index.html test/site.spec.js
git commit -m "docs(vb): convert index.html to vanilla-breeze zero-class + dark toggle"
```

---

## Task 2: Convert demos.html

**Files:**
- Modify: `docs/demos.html`
- Test: `test/site.spec.js` (add a case), existing `test/demos.spec.js` must still pass

- [ ] **Step 1: Add the failing test**

```js
// append to test/site.spec.js
test('demos.html is on vanilla-breeze (classic, no styles.css, no bespoke classes)', async ({ page }) => {
  const a = await audit(page, '/docs/demos.html');
  expect(a.vbLinked).toBe(true);
  expect(a.theme).toBe('classic');
  expect(a.oldStyles).toBe(false);
  expect(a.removedClasses).toEqual([]);
  expect(a.siteJs).toBe(true);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- test/site.spec.js`
Expected: the new demos case FAILS (styles.css linked, classes present, no theme).

- [ ] **Step 3: Rewrite `docs/demos.html`**

Apply the same transforms as Task 1 step 4 (items 1–2 head, 3 header/nav with `Demos` getting `aria-current="page"`, 4 `<main data-layout="stack">`, 6 remove `toggleTheme`/add `site.js`). Then apply the mapping to the body:
- Every `<section class="demo-section" id="X">` → `<section id="X">` (ids preserved).
- Every `<p class="demo-description">` → `<p>`.
- Every `<div class="canvas-text-frame">…</div>` → `<figure>…</figure>` (the inner `<canvas-text>` markup is unchanged).
- The theme demo `<div class="side-by-side">` → `<div data-layout="cluster">`.
- `<div class="export-buttons">` and `<div class="dynamic-form">` → `<div data-layout="cluster">`.
- **Do not touch** the `<browser-window …>` elements or the `<code-block …>` elements — leave them exactly as-is.
- Remove the per-page `function toggleTheme(){…}`.

- [ ] **Step 4: Run tests**

Run: `npm test -- test/site.spec.js test/demos.spec.js`
Expected: ALL pass — demos structural case passes; the existing demos.spec checks (5 standalone smoke, demos.html embeds 5 `browser-window`, demos.html + api.html + index.html use `code-block`) still pass (those elements are untouched).

- [ ] **Step 5: Commit**

```bash
git add docs/demos.html test/site.spec.js
git commit -m "docs(vb): convert demos.html to vanilla-breeze zero-class"
```

---

## Task 3: Convert api.html

**Files:**
- Modify: `docs/api.html`
- Test: `test/site.spec.js` (add a case)

- [ ] **Step 1: Add the failing test**

```js
// append to test/site.spec.js
test('api.html is on vanilla-breeze (classic, no styles.css, no bespoke classes)', async ({ page }) => {
  const a = await audit(page, '/docs/api.html');
  expect(a.vbLinked).toBe(true);
  expect(a.theme).toBe('classic');
  expect(a.oldStyles).toBe(false);
  expect(a.removedClasses).toEqual([]);
  expect(a.siteJs).toBe(true);
});

test('api.html attribute tables are plain native tables', async ({ page }) => {
  await page.goto('/docs/api.html', { waitUntil: 'domcontentloaded' });
  const r = await page.evaluate(() => ({
    tables: document.querySelectorAll('table').length,
    apiTableClass: document.querySelectorAll('table.api-table').length,
  }));
  expect(r.tables).toBeGreaterThan(0);
  expect(r.apiTableClass).toBe(0);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- test/site.spec.js`
Expected: the api cases FAIL (`api-table` class still present, no theme, styles.css linked).

- [ ] **Step 3: Rewrite `docs/api.html`**

Apply the head/nav/main/footer/toggle transforms (Task 1 step 4 items 1–4, 6) with `API` getting `aria-current="page"`. Then:
- Every `<table class="api-table">` → `<table>` (keep the `<thead>`/`<tbody>` rows verbatim).
- `<section class="…">`/`<p class="demo-description">` → strip classes (keep ids).
- Leave the `<code-block …>` elements exactly as-is.
- Remove the per-page `function toggleTheme(){…}`.

- [ ] **Step 4: Run tests**

Run: `npm test -- test/site.spec.js test/demos.spec.js`
Expected: ALL pass (api structural + table cases pass; existing `api.html uses <code-block>` still passes).

- [ ] **Step 5: Commit**

```bash
git add docs/api.html test/site.spec.js
git commit -m "docs(vb): convert api.html to vanilla-breeze zero-class"
```

---

## Task 4: Bring vanilla-breeze to the standalone demos

**Files:**
- Modify: `docs/meme.html`, `docs/badge.html`, `docs/banner.html`, `docs/og-card.html`, `docs/caption.html`
- Test: `test/site.spec.js` (add a case)

- [ ] **Step 1: Add the failing test**

```js
// append to test/site.spec.js
const STANDALONE = ['meme', 'badge', 'banner', 'og-card', 'caption'];
for (const name of STANDALONE) {
  test(`${name}.html standalone demo is on vanilla-breeze (classic)`, async ({ page }) => {
    await page.goto(`/docs/${name}.html`, { waitUntil: 'domcontentloaded' });
    const r = await page.evaluate(() => ({
      vbLinked: !!document.querySelector('link[href*="vanilla-breeze"]'),
      theme: document.documentElement.getAttribute('data-theme'),
    }));
    expect(r.vbLinked).toBe(true);
    expect(r.theme).toBe('classic');
  });
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- test/site.spec.js`
Expected: the 5 standalone cases FAIL (no VB link, no theme).

- [ ] **Step 3: Edit each standalone demo**

For each of the five files:
1. `<html lang="en">` → `<html lang="en" data-theme="classic">`.
2. In `<head>`, add the VB stylesheet link (just the CSS — no theme JS needed there, but adding the theme CSS keeps tokens consistent):

```html
  <link rel="stylesheet" href="https://unpkg.com/vanilla-breeze@0.1.4/dist/cdn/vanilla-breeze.css">
  <link rel="stylesheet" href="https://unpkg.com/vanilla-breeze@0.1.4/dist/cdn/themes/classic.css">
```

3. Reduce the existing inline `<style>` to only what VB does not provide and the demo needs. Replace the whole `<style>…</style>` with this minimal version (keeps the canvas border and full-width inputs; drops the body/font/margin rules VB now owns):

```html
  <style>
    body { max-width: 640px; margin: 2rem auto; padding: 0 1rem; }
    canvas-text { border: 1px solid var(--color-border, #ccc); }
    input[type=text] { width: 100%; }
  </style>
```

(For `banner.html` keep its `.tray img` rules too; for `og-card.html` keep `canvas-text { max-width: 100%; }`.) Leave the `<canvas-text>` markup and the demo `<script>` untouched.

- [ ] **Step 4: Run tests**

Run: `npm test -- test/site.spec.js test/demos.spec.js`
Expected: ALL pass — the 5 standalone VB cases pass, and the existing demo smoke tests (canvas renders) still pass.

- [ ] **Step 5: Commit**

```bash
git add docs/meme.html docs/badge.html docs/banner.html docs/og-card.html docs/caption.html test/site.spec.js
git commit -m "docs(vb): bring vanilla-breeze to the standalone demos"
```

---

## Task 5: Delete styles.css and finalize

**Files:**
- Delete: `docs/styles.css`
- Test: full suite

- [ ] **Step 1: Verify nothing references styles.css**

Run: `grep -rn "styles.css" docs/ || echo "no references"`
Expected: `no references` (all pages were converted in Tasks 1–3; standalone demos never linked it).

- [ ] **Step 2: Delete the file**

```bash
git rm docs/styles.css
```

- [ ] **Step 3: Run the full gate**

Run: `npm run lint && npm run build && npm test`
Expected: lint clean, build succeeds, ALL specs pass — `site` (index/demos/api/standalone structural + dark toggle + hero render), `demos` (smoke + code-block + browser-window), and all `canvas-text` library specs (placement, presets, fonts, layers, render, reactivity, output, theme, a11y, smoke).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs(vb): delete hand-rolled styles.css"
```

---

## Self-Review (plan vs spec)

- **Includes (spec §Includes)** → canonical head block, applied in Tasks 1–4.
- **Theme + light/dark (spec §Theme)** → `data-theme="classic"` (all tasks) + `docs/site.js` toggle (Task 1) + the dark-toggle test.
- **Zero-class mapping (spec §Zero-class HTML mapping)** → the mapping table + per-page application (Tasks 1–3); `removedClasses` test enforces no bespoke classes remain.
- **Components retained (spec §Components retained)** → explicit "leave `code-block`/`browser-window`/`canvas-text` untouched" in Tasks 2–3; existing demos.spec checks still asserted.
- **Standalone demos (spec §Standalone demo pages)** → Task 4.
- **Removal (spec §Removal)** → Task 5 (grep-guarded delete).
- **Testing (spec §Testing)** → `test/site.spec.js` (structural + toggle + hero render) and the retained `test/demos.spec.js`.
- **Verification (spec §Verification)** → live screenshots after deploy (controller does this post-merge; noted, not a code task).
- **`<figure data-layout="cluster">`** (user note) → permitted by the mapping (data-layout may sit on the semantic element; no wrapper divs).

Type/name consistency: `#mode-toggle` button id and `data-mode="dark"` are used identically in `site.js`, the head/nav markup, and the toggle test; `data-theme="classic"` consistent across all pages and the `audit()` helper.
