# Spec: Vanilla Breeze docs site

> Date: 2026-06-02
> Status: design approved, ready for implementation plan
> Scope: the documentation/demo site under `docs/` only. The `canvas-text`
> library is unchanged (it is already Vanilla Breeze–compatible by design).

## Summary

Re-base the canvas-text documentation site on **vanilla-breeze@0.1.4** (VB), a
zero-class, cascade-layer CSS + progressive-enhancement framework. Delete the
hand-rolled `docs/styles.css` and rewrite every docs page as plain semantic HTML
styled by VB, using `data-layout` attributes instead of wrapper-div soup. Keep
the `@profpowell` component family already in use — `<canvas-text>`,
`<code-block>`, `<browser-window>` — which coexist with VB. Convert the whole
site in one pass and use VB's Classic theme with its light/dark mechanism.

## Goals

- The site depends on vanilla-breeze and follows its "simple HTML" approach:
  semantic elements + `data-layout`, no bespoke utility/structure classes.
- One stylesheet system (VB), no custom `styles.css`.
- Consistent look across all pages and the embedded standalone demos.
- Light/dark via VB's mechanism, not a bespoke token sheet.

## Non-goals

- No VB widget-ification (no tabs/accordion/command-palette restructuring).
- No theme other than Classic (themes are swappable via one `<link>` + the
  `data-theme` value later).
- No changes to the `canvas-text` library (`src/`, tests of the component).
- No build step — VB is loaded from CDN like `render-tag`/`code-block`.

## Includes (every docs page)

Replace the current `<link rel="stylesheet" href="./styles.css">` with VB from a
pinned CDN. In each page `<head>`:

```html
<link rel="stylesheet" href="https://unpkg.com/vanilla-breeze@0.1.4/dist/cdn/vanilla-breeze.css">
<link rel="stylesheet" href="https://unpkg.com/vanilla-breeze@0.1.4/dist/cdn/themes/classic.css">
<script type="module" src="https://unpkg.com/vanilla-breeze@0.1.4/dist/cdn/vanilla-breeze.js"></script>
```

The existing per-page imports are retained verbatim:
- the `render-tag` importmap,
- `<script type="module" src="./dist/canvas-text.js">`,
- `<script type="module" src="https://esm.sh/@profpowell/code-block@2.9.0">`,
- `<script type="module" src="https://esm.sh/@profpowell/browser-window@1.4.7">`
  (demos page only).

## Theme + light/dark

- The root element opts into the Classic theme: `<html lang="en" data-theme="classic">`.
- Light is the default (and follows `prefers-color-scheme` per VB's tokens).
- Dark is applied by adding `data-mode="dark"` on `<html>` (VB targets
  `[data-theme~=classic][data-mode=dark]`).
- The existing custom `toggleTheme()` and the `:root` / `[data-theme="dark"]`
  variable blocks (all in `styles.css`) are removed. A minimal toggle replaces
  them: a `<button>` in the header `<nav>` that flips `document.documentElement`
  `data-mode` between absent and `"dark"`, persisting the choice in
  `localStorage` and restoring it on load. Concretely (inlined once per page or
  shared):

```html
<button type="button" id="mode-toggle" aria-label="Toggle dark mode">🌓</button>
<script>
  const root = document.documentElement;
  if (localStorage.getItem('mode') === 'dark') root.dataset.mode = 'dark';
  document.getElementById('mode-toggle').addEventListener('click', () => {
    const dark = root.dataset.mode === 'dark';
    if (dark) { delete root.dataset.mode; localStorage.removeItem('mode'); }
    else { root.dataset.mode = 'dark'; localStorage.setItem('mode', 'dark'); }
  });
</script>
```

## Zero-class HTML mapping

Delete every bespoke class. The current structure maps to VB as follows (applies
across `index.html`, `demos.html`, `api.html`):

| Current | Vanilla Breeze |
|---|---|
| `<header class="site-header"><nav>` | `<header><nav>` — VB styles native nav |
| `<div class="nav-links">…links…</div>` | links directly in `<nav>`; active link gets `aria-current="page"` (drops the `.active` class) |
| `<main>` | `<main data-layout="stack">` for vertical rhythm |
| `<section class="demo-section" id="…">` | `<section id="…">` (id kept for anchors) |
| `<p class="demo-description">` | `<p>` |
| `<div class="canvas-text-frame">…canvas-text…</div>` | `<figure>…canvas-text…</figure>` (semantic: rendered output) |
| `<div class="side-by-side">` (theme demo) | `<div data-layout="cluster">` (or `grid`) |
| `<div class="export-buttons">` / `<div class="dynamic-form">` | `<div data-layout="cluster">` |
| `<section class="hero">` / hero blocks (index) | `<section data-layout="stack">` + semantic `<h1>`/`<p>` |
| `<a class="related-card">` grid (index) | `<a>` items inside a `<nav data-layout="grid">` (or `cluster`) |
| `<a class="nav-brand">` | `<a>` (brand link); styled by VB, no class |

Rules:
- No `class` attributes remain on docs pages except where a third-party
  component documents one (none currently do).
- Structure/grouping is expressed with semantic elements first, `data-layout`
  attributes second. No layout-only `<div>`s without a `data-layout`.
- All existing section `id`s are preserved so in-page anchors keep working.

## Components retained

- `<canvas-text>` live demos: unchanged markup (slots/attributes), now inside
  `<figure>` instead of `.canvas-text-frame`.
- `<code-block>` source blocks: unchanged (already migrated).
- `<browser-window>` demo frames (demos page): unchanged.
- API attribute/return tables: plain `<table><thead>…<tbody>…` — VB styles native
  tables; no `<data-table>` wrapper (that would be widget-ification, a non-goal).

## Standalone demo pages

`docs/{meme,badge,banner,og-card,caption}.html` each get the same VB CSS link
(and `data-theme="classic"` on `<html>`) so they look consistent inside the
`<browser-window>` frames. Their existing minimal inline `<style>` is reduced to
only what VB does not cover and the demo genuinely needs (the `canvas-text`
preview border, input widths). Their interactive scripts and `canvas-text`
markup are unchanged. They do not need the VB `<script>` (no VB JS components
used there), but including it is harmless; for consistency add it.

## Removal

- Delete `docs/styles.css`.
- Remove every `<link rel="stylesheet" href="./styles.css">` and the
  `toggleTheme()` function/`onclick` from all pages.
- The Pages workflow (`cp -rL docs/* _site/`) needs no change; a now-absent
  `styles.css` simply isn't copied.

## Testing

- **Existing component tests are unaffected** (they test `canvas-text` behavior,
  not page chrome) and must still pass.
- **demos smoke tests** (`test/demos.spec.js`): the five standalone demos and the
  demos page still render a non-blank `canvas-text` and embed the
  `browser-window`/`code-block` elements. Update any selector that referenced a
  removed class.
- **New structural assertions** (added to `test/demos.spec.js`): for
  `index.html`, `demos.html`, `api.html` — assert the VB stylesheet link is
  present (`link[href*="vanilla-breeze"]`), `<html>` carries `data-theme="classic"`,
  and there is no `link[href="./styles.css"]`.
- Tests load pages from the local Vite server; VB loads from CDN (network
  available in CI). Assertions check DOM/attribute presence, not VB upgrade, so
  they do not depend on the CDN being reachable at test time.

## Verification

After deploy, screenshot each page (`index`, `demos`, `api`) live in both light
and dark mode and confirm: readable typography, working nav, demos render,
`code-block`/`browser-window` intact, dark toggle flips the whole page.

## Risks & mitigations

- **VB global styles may restyle the embedded standalone demos unexpectedly.**
  Mitigation: the demos are simple; verify each inside its `browser-window`
  frame and keep the minimal inline overrides they need.
- **CDN dependency at runtime.** Accepted — consistent with the existing
  `render-tag`/`code-block`/`browser-window` CDN loads; pinned to `@0.1.4`.
- **Classic dark mode token coverage.** Mitigation: verify dark mode visually on
  each page; Classic ships a `[data-mode=dark]` variant.

## Open implementation notes (not contract)

- Exact `data-layout` value per spot (`cluster` vs `grid`) is tuned during
  implementation against the live result; the rule (semantic + `data-layout`,
  no bare layout divs) is the contract.
