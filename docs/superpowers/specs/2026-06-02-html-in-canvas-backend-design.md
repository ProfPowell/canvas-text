---
title: HTML-in-Canvas rendering backend (progressive enhancement)
description: An opt-in, capability-detected rendering backend for <canvas-text> that rasterizes slotted layers with the native HTML-in-Canvas API, falling back to render-tag.
author: handoff for a later session (evaluated in bg-wc, relocated here)
date: 2026-06-02
status: draft — needs an origin-trial spike before implementation
tags:
  - canvas-text
  - html-in-canvas
  - rendering
  - progressive-enhancement
---

# HTML-in-Canvas rendering backend

## Summary

Add a second rendering backend to `<canvas-text>` that uses the native
**HTML-in-Canvas (HiC)** API to rasterize slotted text layers, selected by
capability detection at runtime. `render-tag` stays the default and the
universal fallback; HiC is a high-fidelity fast path on browsers that have it.
The public API (`width`/`height`, named slots, `theme`, `toBlob()`/`toDataURL()`,
events) does **not** change — only the engine under the hood.

This is **progressive enhancement**, not a rewrite. On any browser without HiC
(Safari, Firefox, Chrome without the origin-trial token / flag) the component
behaves exactly as it does today.

## Background & motivation

### What `<canvas-text>` does now

Per text layer, `src/layers.js#paintLayer` builds a themed HTML **string** from
the slotted node's `outerHTML` (`wrapWithTheme`), then calls
`renderTag.render({ html, width, height, pixelRatio, accuracy })` and
`ctx.drawImage(result.canvas, 0, dy)` onto the composite 2D canvas. Image layers
are drawn directly with `ctx.drawImage`. Export is `canvas.toBlob()`.

`render-tag` is a string→canvas rasterizer. Its known limitations show up
directly in our code:

- **It ignores `position`/`transform`.** `paintLayer` works around vertical
  placement by *measuring* the rendered height and offsetting the `drawImage`
  call (see `layers.js:114-122`). That's a hack we maintain because the layout
  engine isn't the real one.
- **String round-trip, not the live element.** We serialize `outerHTML` and
  re-parse it; the actual laid-out DOM subtree (with its resolved CSS, fonts,
  inherited tokens) is not what gets rasterized.
- **Fidelity gaps** typical of non-native HTML rasterization: web-font timing,
  whitespace/line-breaking edge cases, RTL/bidi, and i18n shaping.

### What HiC fixes

The HiC explainer opens by citing exactly these problems — canvas styled text and
layout being weak on "accessibility, internationalization, performance, and
quality." HiC draws a **real, browser-laid-out element** into the canvas:

- 2D: `ctx.drawElementImage(element[, width, height])` — draws a canvas child and
  returns a transform to keep the element's DOM box aligned with its drawn box.
- snapshot: `captureElementImage(element)` → an `ElementImage` (transferable to a
  worker / `OffscreenCanvas`).
- opt-in: the `layoutsubtree` attribute on the `<canvas>` lays out its child
  elements (invisible until drawn) and includes them in hit-testing/accessibility.
- updates: a `paint` event + `requestPaint()` for animated cases (we don't need
  this — see "Non-goals").

For `<canvas-text>` this means real CSS positioning (delete the measure-and-offset
hack), real layout/fonts/i18n, and a snapshot of the *actual* slotted content.

### Status (June 2026) — why it must be opt-in

HiC is in a Chromium **origin trial** (M148–M151, started 2026-05-19); it is
**not** shipping by default and is absent in Firefox/Safari. Flag for local dev:
`chrome://flags/#canvas-draw-element`. Therefore HiC can only ever be a
*progressively-enhanced fast path*; `render-tag` remains the default backend and
the guaranteed fallback. See:
- explainer: https://github.com/WICG/html-in-canvas
- origin trial: https://developer.chrome.com/blog/html-in-canvas-origin-trial
- chromestatus: https://chromestatus.com/feature/5172548013916160

## ⚠️ Spike first (blocks the design)

Before committing to implementation, run a throwaway origin-trial spike to answer
the two questions that decide whether this is worth doing:

1. **Exportability / taint.** `<canvas-text>`'s entire purpose is `toBlob()`. HiC
   deliberately excludes cross-origin content, system colors, visited-link state,
   and subpixel-AA from the draw — which strongly implies *same-origin* draws stay
   untainted and exportable. **Confirm** that a canvas drawn via `drawElementImage`
   from same-origin styled text exports with `toBlob()` and is not tainted.
2. **Output parity & sizing.** Does `drawElementImage` of a laid-out text block
   produce pixels comparable to the `render-tag` path (auto-height text, wrapping,
   stroke via `-webkit-text-stroke`, DPR scaling)? Capture the natural height the
   way we currently measure it.

If (1) fails, stop — a non-exportable backend is useless here. Record findings in
this spec before building.

## Architecture

### Backend selection

A single capability check, computed once:

```js
// src/backends/detect.js
export const HIC_SUPPORTED =
  typeof CanvasRenderingContext2D !== 'undefined' &&
  'drawElementImage' in CanvasRenderingContext2D.prototype;
```

An attribute lets authors force/disable it for testing and safety:
`backend="auto" | "render-tag" | "hic"` (default `auto` = HiC if `HIC_SUPPORTED`
else render-tag). `auto` never silently degrades output an author didn't choose;
if `hic` is requested but unsupported, fall back and emit a `canvas-text:warning`.

### Backend interface

Factor the per-layer rasterization behind a small interface so both engines are
interchangeable and testable in isolation. Today's logic in
`layers.js#paintLayer` becomes the `render-tag` implementation; HiC is a sibling.

```js
// Each backend composites one text layer onto the 2D context.
// (image layers stay in the shared path — see Scope.)
//   paintTextLayer(ctx, layer, opts, ctxOf): Promise<void>
// opts: { width, height, dpr, accuracy }
```

- `backends/render-tag.js` — the current path, lifted verbatim (string → render →
  drawImage, including the vertical-offset measurement).
- `backends/hic.js` — the new path (below).

`canvas-text.js` picks the backend once per render and threads it through the
layer loop. `paintLayer`'s image branch is shared; only the text branch differs.

### The HiC text path

HiC draws elements that are **children of the `<canvas>`**. So, per render:

1. Ensure the component's own `<canvas>` carries `layoutsubtree` (set once).
2. For each text layer, mount the layer's themed node as a positioned child of the
   canvas (absolutely positioned per the layer's anchor/offset — using **real
   CSS**, replacing the measure-and-offset workaround). Keep it visually inert
   (it's only there to be laid out + drawn).
3. Wait for layout (one rendering update / `requestAnimationFrame`), then
   `ctx.drawElementImage(node, …)` honoring DPR.
4. Remove the temporary children after drawing (or keep a hidden mount the layer
   nodes live in). Do **not** leave duplicated content in the a11y tree — the
   real slotted content already lives in the host's light DOM and is the
   accessible copy; the HiC mount must be `aria-hidden`/inert.

Notes:
- This makes the render **async** (needs a layout pass before draw). The component
  already has an async render flow and `paintLayer` is `async`, so this fits, but
  the timing differs from render-tag's synchronous `render()`. Keep the
  `canvas-text:rendered` event firing after the final composite either way.
- Placement becomes real CSS (`position:absolute; inset/transform`), so the
  `ay`-based height measurement in `layers.js:110-123` is **not needed** on the
  HiC path. Simpler and more correct.

## Scope

**In scope (HiC path):**
- Text layers (slotted `text-*` / default markup) rasterized via
  `drawElementImage`, same-origin.
- `backend` attribute + capability detection + fallback + warning event.
- Backend interface refactor (render-tag lifted into a backend, no behavior change).

**Out of scope / unchanged:**
- **Image layers** stay on the existing `ctx.drawImage` path. HiC excludes
  cross-origin embedded content from painting, and our `<img slot="background"
  crossorigin>` use is exactly that case; native `drawImage` already handles
  images well. (A render may therefore be *hybrid*: HiC for text, drawImage for
  images, composited on one 2D context.)
- The `paint`/`requestPaint` animation loop — `<canvas-text>` rasterizes once on
  demand; we never need per-frame canvas children.
- WebGL/WebGPU HiC (`texElementImage2D`, `copyElementImageToTexture`) — not
  relevant to a 2D compositor.
- Any public API change.

## Feature detection & graceful failure

- `auto` default resolves to render-tag everywhere HiC is absent — zero behavior
  change for the 99% of today's users.
- If a HiC draw throws at runtime (OT revoked mid-session, taint, etc.), catch,
  emit `canvas-text:warning`, and **re-render that layer via render-tag** so a
  partial failure never produces a blank/half canvas.
- Expose the resolved backend for debugging: a read-only `renderedBackend`
  property and/or include it in the `canvas-text:rendered` event detail.

## Testing

- Unit (Playwright, like bg-wc/canvas-text today): backend selection honors the
  `backend` attribute and `HIC_SUPPORTED`; `hic` requested on an unsupported
  engine falls back + warns.
- The HiC path itself can only be exercised where the API exists. Gate those
  tests behind `HIC_SUPPORTED` (skip otherwise) so CI stays green on non-Chrome.
  Where possible, run a Chrome project with the flag enabled
  (`--enable-features=CanvasDrawElement` / the OT token) for the HiC assertions.
- Golden test: same input rendered by both backends should `toBlob()` to visually
  comparable output (allow a tolerance; they will not be pixel-identical).
- Export test: HiC-drawn canvas `toBlob()` returns a non-null, untainted blob.

## Acceptance criteria

- [ ] Spike confirms HiC same-origin draws are exportable via `toBlob()` (or this
      spec is closed as not-viable with findings recorded).
- [ ] `render-tag` behavior is byte-for-byte unchanged when HiC is absent or
      `backend="render-tag"`.
- [ ] With HiC available and `backend="auto"`, text layers render via
      `drawElementImage`, place correctly via CSS, and export to PNG/JPEG/WebP.
- [ ] Image layers and all public API/events are unchanged.
- [ ] A runtime HiC failure degrades to render-tag for that layer, with a warning.
- [ ] Tests pass on non-Chrome (HiC tests skipped) and on flagged Chrome (HiC
      tests run).

## Risks & clangs

- **OT-only lifetime.** The origin trial ends at M151; the API may change before
  it ships. Keep the HiC backend isolated so it can be updated or removed without
  touching the render-tag path. Don't let any HiC assumption leak into the core.
- **Async vs sync render.** render-tag is synchronous; HiC needs a layout pass.
  Ensure `toBlob()`/`canvas-text:rendered` still resolve *after* the final
  composite on both paths. Don't regress the "render is done when the event fires"
  contract.
- **Accessibility double-content.** The slotted light-DOM content is the
  accessible copy. The temporary HiC canvas-children must be inert/`aria-hidden`
  so we don't duplicate content into the a11y tree (the inverse of HiC's usual
  selling point, which we don't need here since our content already lives in the
  light DOM).
- **Taint surprises.** A single cross-origin resource in a text layer
  (e.g. a `background-image: url(other-origin)`) could taint the whole canvas
  under HiC. Detect-and-fallback per layer rather than failing the export.
- **Sizing/auto-height.** render-tag returns the measured text height we rely on
  for vertical anchoring; the HiC path must derive equivalent geometry from the
  laid-out element (`getBoundingClientRect`) — verify DPR handling matches.

## Open questions

- Does `drawElementImage` require the child to be *visibly* laid out (in the
  viewport) or does `layoutsubtree` lay out off-screen children fine? (Spike.)
- Worker/`OffscreenCanvas` path via `captureElementImage` → `ElementImage` — worth
  it for batch/OG-card generation, or out of scope for v1? (Default: out of scope.)
- Should `backend` be reflected/observed for live switching, or read once at
  render time? (Default: read at render time; cheap to re-render.)
```
