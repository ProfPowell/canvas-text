# Vanilla Breeze Docs Site — Implementation Plan (REVISED: bundled site build)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`).
>
> **REVISED 2026-06-03:** Full VB needs its theme/icon assets at a base it can
> fetch at runtime. On a GitHub Pages *project subpath*, VB's default `/cdn/`
> base 404s. The proven fix (used by sibling repo **ProfPowell/border-wc**,
> same project template) is a **Vite site build** that bundles VB and emits its
> theme CSS + lucide icons to a relative `./vb` path, with each page setting
> `window.__VB_THEME_BASE` / `window.__VB_CATALOG_BASE` / `data-icon-path` to
> that relative base. This supersedes the earlier "CDN stylesheet swap" plan.

**Goal:** Re-base the docs site on full vanilla-breeze@0.1.4 (CSS + JS + `<theme-picker>`), bundled via a dedicated Vite site build that works on the `/canvas-text/` subpath, deployed via an updated Pages workflow. Keep `<canvas-text>`, `<code-block>`, `<browser-window>`.

**Architecture:** Mirror border-wc. `vanilla-breeze`, `@profpowell/code-block`, `@profpowell/browser-window` become devDependencies. A `docs/docs-entry.js` imports them (+ the component). `vite.site.config.js` does a multi-page build (`root:'.'`, `base:'./'`, input = root redirect + `docs/*.html`), with a **pagefind stub** and a **`/vb` assets plugin** that serves (dev) / emits (build) VB theme CSS + lucide icons to `dist-site/vb/`. Each page runs a tiny base-config script and references `./docs-entry.js`. Output `dist-site/`; the Pages workflow runs `npm run site:build` and deploys `dist-site/`.

**Tech Stack:** vanilla-breeze@0.1.4, @profpowell/code-block@2.9.0, @profpowell/browser-window@1.4.7, Vite 6, Playwright.

**Reference:** `ProfPowell/border-wc` — `vite.site.config.js`, `docs/docs-entry.js`, the per-page base-config `<script>`, `.github/workflows/pages.yml`.

**Spec:** `docs/superpowers/specs/2026-06-02-vanilla-breeze-docs-site-design.md` (amend: bundled build, not CDN links; `<theme-picker>`, not a hand-rolled toggle).

---

## Key shared snippets

### Per-page base-config `<script>` (first thing in `<head>`, before any module script)
```html
<script>
  (() => {
    const vb = new URL('./vb', document.baseURI).href.replace(/\/$/, '');
    window.__VB_THEME_BASE = vb;
    window.__VB_CATALOG_BASE = vb;
    document.documentElement.dataset.iconPath = vb + '/icons';
  })();
</script>
```
(Pages live at `dist-site/docs/*.html`; assets at `dist-site/vb/…`; from a docs page `./vb` is wrong — use `../vb`. Decide the exact relative prefix per output location during Task 2 and verify against the built tree.)

### `docs/docs-entry.js`
```js
import 'vanilla-breeze';
import 'vanilla-breeze/css';
import '@profpowell/code-block';
import '@profpowell/browser-window';
import '../dist/canvas-text.js';
```

### `<theme-picker compact></theme-picker>` replaces the old toggle in each nav.

---

## Task 1: Dependencies + site build config (prove it on index.html)
**Files:** `package.json`, `vite.site.config.js` (new), `docs/docs-entry.js` (new), `docs/index.html`.
- [ ] Add devDeps + scripts (`site:dev`/`site:build`/`site:preview` = `vite … --config vite.site.config.js`); `npm install`.
- [ ] Create `vite.site.config.js` ported from border-wc (input globs `docs/*.html` + a root `index.html` redirect; pagefind stub; `/vb` assets plugin emitting `node_modules/vanilla-breeze/dist/cdn/themes/*.css` + lucide icons `palette,sun,moon,monitor,contrast,sliders,type,check,chevron-down,chevron-up,x,circle`; `outDir:'dist-site'`, `base:'./'`).
- [ ] Create `docs/docs-entry.js` (above).
- [ ] index.html: add base-config script; remove the CDN VB links + canvas-text/code-block CDN scripts (now bundled via entry) — keep the render-tag importmap (canvas-text imports it); replace the `<button id=mode-toggle>` already done → ensure `<theme-picker compact>`; reference `<script type="module" src="./docs-entry.js"></script>`.
- [ ] **Verify:** `npm run site:build`; inspect `dist-site/` — confirm `dist-site/vb/themes/classic.css`, `dist-site/vb/icons/lucide/*.svg`, hashed `assets/*`, and `dist-site/docs/index.html`. Then `npm run site:preview` (or a Playwright check against the built tree) and confirm: no `/cdn/` 404s, Classic applies, `<theme-picker>` upgrades with icons, hero canvas renders. Commit.

## Task 2: Convert demos.html + api.html + standalone demos to the entry/base pattern
- [ ] Each page: base-config script, `<theme-picker compact>` in nav, `<script type="module" src="./docs-entry.js">`, drop CDN VB/component links, keep render-tag importmap, keep zero-class body + canvas-text/code-block/browser-window markup. Verify built output per page.

## Task 3: Pages workflow → site build
**Files:** `.github/workflows/pages.yml`.
- [ ] Replace the `mkdir _site; cp -rL docs/* _site` assemble step with `npm run build` (library) + `npm run site:build`; upload `dist-site/` as the Pages artifact. Verify the deploy URLs (note: pages move under `/canvas-text/docs/…`; add a root `index.html` redirect to `docs/index.html` like border-wc).

## Task 4: Tests + cleanup
- [ ] Update `test/site.spec.js` to the built-site reality (assert `<theme-picker>`, VB applied, no `/cdn/` 404s, canvas renders) — run against `npm run site:preview` or the built tree. Delete `docs/styles.css`. Full gate: `npm run lint && npm run build && npm test`. Verify live after deploy (screenshots, light/dark).

---

## Notes
- The earlier CDN-based VB index.html (currently live, broken) is replaced by Task 1.
- `render-tag` stays a runtime importmap dep of `canvas-text.js`; the entry bundles the rest.
- Exact relative `./vb` vs `../vb` prefix and the input/URL structure are finalized empirically against the built `dist-site/` tree in Task 1–3.
