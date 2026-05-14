# Spec: `@profpowell/canvas-text`

> Date: 2026-05-14
> Status: design approved, ready for implementation plan
> Supersedes: parts of `README.md` (clarifies the "image compositing" question
> left open there and resolves the In/Maybe contradiction)

## Summary

A stand-alone, Vanilla Breeze-compatible web component `<canvas-text>` that
composites a z-ordered stack of **image** and **rich-text** layers onto an
internal `<canvas>`. The element owns the canvas; `render-tag` is used per
text-layer to rasterize HTML to pixels. The component is the foundation
for the upcoming `meme-maker` app.

## Goals

- Render rich text to canvas via `render-tag`.
- Composite multiple image and text layers in a deterministic z-order so a
  single `<canvas-text>` element can produce a meme, banner, or OG card.
- Export the result imperatively (`getCanvas`, `toBlob`, `toDataURL`).
- Feel native inside Vanilla Breeze pages (theme bridge) without depending on
  VB at runtime.
- Be accessible: the slotted HTML is what AT consumes; the canvas is decorative.

## Non-goals (v0.1.0)

- Interactive editing (selection, caret).
- Server-side rendering. (Pluggable canvas factory pattern keeps the door
  open for v2; no v1 commitment.)
- Re-rendering on theme change after first paint. Documented limitation.
- Filters, blend modes, transforms beyond what HTML/CSS provides on text
  layers and `drawImage` provides on image layers.

## Architecture

The element owns one internal `<canvas>`. On render:

```
1. read attributes (width, height, theme, format, dpr, compose, lang, accuracy)
2. scan light-DOM children, build layer list keyed by z-order
3. for each layer in ascending z:
     if <img>     : await img.decode(); ctx.drawImage(img, 0, 0, w, h)
     else (text)  : layerCanvas = renderTag.render({ html, width, height, ... })
                    ctx.drawImage(layerCanvas, 0, 0)
4. set data-upgraded; emit canvas-text:rendered { width, height, durationMs }
```

`render-tag` is used **only** to rasterize individual text layers. The
element handles image decode, layer ordering, and final compositing. This
keeps async image-loading concerns in one place and avoids depending on any
image-rendering surface in `render-tag` (which the README flags as
unsupported).

Light DOM only (no shadow DOM) — the slotted HTML must remain visible to
assistive tech.

## Slot model

Layers are slotted children of the host element. Slot names follow a fixed
grammar:

| Slot name             | Type        | z-order key  |
|-----------------------|-------------|--------------|
| `background`          | image       | 0            |
| `background-<N>`      | image       | N (integer)  |
| `text-<N>`            | rich text   | N (integer)  |
| *(default, no slot=)* | rich text   | `Infinity` (paints last, on top) |

**Z-stack algorithm:**

1. Collect all children with a recognized slot name plus any unslotted children
   (treated as the default layer at z = ∞).
2. Sort ascending by z-order key. Ties: image (`background-N`) below text
   (`text-N`) at the same N.
3. Render in that order. The default layer always paints last.

**Type detection per layer:**

- If the slotted element is `<img>` (or `<picture>` resolving to `<img>`),
  it is an image layer. The element calls `img.decode()` before drawing.
- Anything else is a text layer. The element passes its `outerHTML` to
  `render-tag` after the theme bridge runs.

**Positioning is CSS-only.** Authors set `text-align`, `padding`,
`position:absolute`, `inset`, etc. on the slotted elements. The element does
not introduce positioning attributes. Each text layer is rendered at the full
canvas width and height; CSS inside that snippet places the visible text
within that box.

**Meme example:**

```html
<canvas-text width="600" height="600">
  <img slot="background" src="doge.jpg">
  <div slot="text-1"
       style="text-align:center;
              font:bold 48px Impact;
              color:white;
              -webkit-text-stroke:2px black;
              padding-top:20px;">
    TOP TEXT
  </div>
  <div slot="text-2"
       style="position:absolute;
              bottom:20px;
              text-align:center;
              font:bold 48px Impact;
              color:white;
              -webkit-text-stroke:2px black;">
    BOTTOM TEXT
  </div>
</canvas-text>
```

## Element API

### Attributes

| Attribute      | Type                                      | Default        | Description |
|----------------|-------------------------------------------|----------------|-------------|
| `width`        | number                                    | `600`          | Canvas width in CSS pixels. |
| `height`       | number                                    | *(see below)*  | Canvas height. If omitted and a `background` image is present, height is the image's intrinsic ratio × width. Otherwise auto from text layout. |
| `theme`        | `inherit` \| `none` \| `inline`           | `inherit`      | Theme bridge mode. |
| `accuracy`     | `default` \| `balanced`                   | `default`      | Passed through to `render-tag`. |
| `lang`         | string                                    | host `lang`    | Hint for bidi / CJK. |
| `dpr`          | number \| `auto`                          | `auto`         | Device pixel ratio override. |
| `format`       | `png` \| `jpeg` \| `webp`                 | `png`          | Default MIME for `toBlob` / `toDataURL`. |
| `compose`      | `slots` \| `text-only`                    | `slots`        | `slots` runs the layer pipeline. `text-only` skips slot scanning and renders the default-slot HTML as a single text layer (compatibility / simpler perf path). |
| `alt`          | string                                    | —              | Plain-text fallback. Used as `aria-label` on the canvas; overrides the auto fallback when set. |
| `data-upgraded`| *(set by element)*                        | —              | Reflects "first render complete". |

The `html` attribute originally proposed in the README is **dropped** in
favor of slotted content. Authors who want to set HTML imperatively use the
`html` property setter (see below); the attribute is gone (resolves README
open question #1).

### Properties

```ts
html: string;           // setter: replaces the host's unslotted (default-slot)
                        //         children. Slotted layers (background, text-N)
                        //         are untouched. Triggers a render.
                        // getter: serialized HTML of current unslotted children.
```

### Methods

```ts
getCanvas(): HTMLCanvasElement;
toBlob(type?: string, quality?: number): Promise<Blob>;
toDataURL(type?: string, quality?: number): string;
render(): Promise<void>;  // async because image layers must decode first
```

`getCanvas` and `toDataURL` reflect the canvas as of the last completed
render. If the consumer has just mutated attributes or slots and needs the
new pixels, they must `await el.render()` (or wait for `canvas-text:rendered`)
before reading.

### Events

| Event                       | Detail                                    | When |
|-----------------------------|-------------------------------------------|------|
| `canvas-text:rendered`      | `{ width, height, durationMs }`           | After each successful render. |
| `canvas-text:error`         | `{ error }`                               | Render aborted (e.g., `render-tag` throws on every text layer). |
| `canvas-text:layer-error`   | `{ slot, error }`                         | One layer failed (e.g., broken image). Composition continues with the remaining layers. |

## Theme bridge

Unchanged from README §"Theme bridge", with one clarification: the bridge
runs **per text layer**, not once on the host. For each text layer, the
allowlisted computed properties are read from the host element and prepended
as inline `style=` on a wrapper around that layer's HTML before it goes to
`render-tag`.

Allowlist v1:

```
color
font-family
font-size
font-weight
font-style
line-height
letter-spacing
text-align
background-color
```

Modes:

- `theme="inherit"` (default) — copy allowlist from `getComputedStyle(host)`.
- `theme="inline"` — pass slotted HTML through unchanged.
- `theme="none"` — pass to render-tag with its defaults.

One-shot at render time. Re-render on theme change deferred to v0.2.

## Accessibility

- Slotted content stays in the light DOM, visually hidden via
  `clip-path: inset(50%)` (or equivalent), so screen readers consume it as
  normal HTML.
- Canvas element gets `aria-hidden="true"`.
- If the host has an `alt` attribute, the canvas additionally gets
  `aria-label="<alt>"` and the visually-hidden fallback is omitted (the
  `alt` is the AT label).
- `slot="background-N"` `<img>` layers honor their own `alt` attributes in
  the visually-hidden fallback.
- Axe-core must pass clean against the examples page.

The visually-hidden fallback is **non-negotiable**. Shipping without it is
not shipping.

## Reactivity

`observedAttributes`: `width`, `height`, `theme`, `lang`, `accuracy`, `dpr`,
`format`, `compose`, `alt`.

A `MutationObserver` on the host watches `childList`, `subtree`,
`attributes`, and `characterData` so changes to slotted layers (new image,
edited text, swapped `data-*`) trigger re-render.

All triggers funnel into one debounced render scheduled via
`requestAnimationFrame`. Rapid back-to-back changes coalesce to one paint.
`render()` returns a promise that resolves after the next paint completes
(useful for tests).

## Repo & package shape

Unchanged from README §"Repo / package shape". JS-first (per code-block /
screen-saver convention — neither uses TypeScript in `src/`). Types live in
a hand-maintained `canvas-text.d.ts` at the package root.

```
canvas-text/
  README.md
  LICENSE                  # MIT
  package.json             # name: "@profpowell/canvas-text"
  canvas-text.d.ts
  src/
    canvas-text.js         # the element
    layers.js              # slot scan, z-order, layer rendering
    theme-bridge.js        # getComputedStyle → inline-style serializer
    index.js               # registers <canvas-text>, re-exports class
  test/
    unit/                  # vitest + happy-dom
    visual/                # playwright snapshot baselines
    examples-axe.spec.js   # axe-core a11y
  examples/
    index.html             # text-only + theme-inherit playground
    meme.html              # full meme composition demo
    vb-integration.html    # VB-themed page demo
  vite.config.js
  custom-elements-manifest.config.mjs
  .github/workflows/
    ci.yml                 # test + build on PR
    release.yml            # tag → npm publish on main
```

Package metadata mirrors `code-block`:

```json
{
  "name": "@profpowell/canvas-text",
  "version": "0.1.0",
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
  "peerDependencies": {
    "render-tag": "^0.1.7"
  },
  "files": ["dist", "canvas-text.d.ts", "custom-elements.json", "README.md", "LICENSE"]
}
```

`render-tag` is a peer dep so consumers control the version.

## Implementation phases

Each phase becomes one `bd` issue linked with `bd dep` so phase N blocks
phase N+1.

### Phase 0 — Repo bootstrap
- `bd init` in `canvas-text/`.
- Scaffold matching `code-block` / `screen-saver` conventions: ESM JS,
  Vite for build, Vitest + happy-dom for unit, Playwright for visual,
  ESLint, Prettier, CEM analyzer.
- Add MIT `LICENSE`, GitHub Actions CI (test + build on PR).
- Install `render-tag@0.1.7` as a peer dep; add a thin dev dep on it too
  so local tests can import it directly.

### Phase 1 — Text-only render (compose="text-only")
- `<canvas-text>` class extending `HTMLElement`.
- `connectedCallback` reads default-slot HTML, calls `render-tag.render`,
  draws to internal canvas.
- Set `data-upgraded`; emit `canvas-text:rendered`.
- Tests: renders simple HTML, sets width, dispatches event, `render()`
  promise resolves after paint.

### Phase 2 — Reactivity
- `observedAttributes` + `MutationObserver` per the spec.
- `requestAnimationFrame` debounce; rapid mutations coalesce to one render.
- Tests: attribute mutation triggers re-render; rapid mutations coalesce.

### Phase 3 — Theme bridge
- `theme-bridge.js`: allowlist serializer.
- Wire `theme="inherit"` to wrap each text layer with inline-style root.
- Example page loads VB theme stylesheet from CDN and shows the same
  snippet rendered under three themes.

### Phase 4 — Layer pipeline (the new feature)
- `layers.js`: slot scan, z-order, type detection (`<img>` vs text).
- Async render loop with `img.decode()` and per-layer `render-tag` calls.
- `compose="slots"` becomes the default.
- `height` auto-derives from `background` image ratio when omitted.
- `canvas-text:layer-error` event on per-layer failure.
- Tests: layer order, image decode, error isolation, missing-image
  fallback. Visual snapshot of a stub meme.

### Phase 5 — Output API
- `getCanvas`, `toBlob`, `toDataURL` — typed in `canvas-text.d.ts`.
- `format` attribute determines default MIME.
- Tests: `toBlob('image/png')` returns non-empty PNG; `toDataURL` returns a
  base64 data URL.

### Phase 6 — Accessibility
- Visually-hidden fallback container; `aria-hidden="true"` on canvas.
- `alt` attribute → `aria-label`, suppresses fallback.
- Axe-core clean against `examples/*.html`.
- Tests: AT-visible text matches slot; axe baseline.

### Phase 7 — Polish & ship 0.1.0
- README rewritten to match shipped API (this spec is the source of truth).
- Examples deployed (GitHub Pages).
- `npm publish` as `@profpowell/canvas-text@0.1.0`.

### Phase 8 (deferred / wishlist)
- `re-render-on-theme-change` attribute.
- Pluggable canvas factory for node-canvas / skia-canvas.
- Two-phase `layout` + `drawLayout` pool for repeat renders.
- Decision on rename to `<image-text>` vs `<rich-canvas>` before publish.

## Testing strategy

- **Unit (Vitest + happy-dom):** API contract, attribute reactivity, slot
  scan + z-order, theme bridge serialization, event dispatch.
- **Visual (Playwright):** matrix of (html × theme × width × layer-config)
  on Chromium. Baselines under `test/visual/baselines/`.
- **A11y (axe-core in Playwright):** fallback is AT-visible; canvas is
  `aria-hidden`.
- **Manual:** `examples/meme.html` is the dogfood gate for the layer
  pipeline; `examples/vb-integration.html` is the dogfood gate for theme
  bridge.

## VB compatibility checklist

- `customElements.define('canvas-text', …)`, not VB's `registerComponent`.
- Light DOM only.
- `data-upgraded` after first render.
- Kebab-case string attributes.
- Events namespaced `canvas-text:*`.
- Theme bridge reads CSS custom properties through computed style; no
  hardcoded VB token names.
- No dependency on `VBElement`, `bundle-registry`, or `vb-element`.

## Open questions (deferred, not blocking 0.1.0)

1. **Naming.** `<canvas-text>` vs `<image-text>` vs `<rich-canvas>`.
   Revisit before publish (Phase 7).
2. **Slot grammar.** `background-N` and `text-N` versus a single
   `layer-N` namespace with type inferred from content. Spec uses the
   explicit names because they read better in markup; revisit if authors
   complain.
3. **Image loading policy.** Cross-origin tainting will silently break
   `toBlob` / `toDataURL`. Spec assumes consumers pass `crossorigin="anonymous"`
   on `<img>` and serve CORS-friendly origins. Document this loudly in the
   README.

## Risks

- `render-tag` is pre-1.0 (~6 weeks old). Pin exact version; fork-mirror
  if it stales.
- Cross-origin canvas tainting will produce confusing errors. Mitigation:
  document in README; surface a clear `canvas-text:error` when the canvas
  is tainted on export.
- Visual baselines are font-dependent. Mitigation: pin a webfont in test
  examples so Chromium renders consistently across runners.
- Bundle size: `render-tag` is ~553 KB unpacked. Mitigation: peer dep.

## Definition of done (v0.1.0)

- [ ] `<canvas-text>` composites z-ordered image + text layers.
- [ ] Default slot, `background[-N]`, `text-N` slot grammar honored.
- [ ] Attribute and slot changes trigger coalesced re-render.
- [ ] `theme="inherit"` picks up VB tokens.
- [ ] `getCanvas`, `toBlob`, `toDataURL` work and are typed.
- [ ] Fallback DOM is AT-visible; axe-core clean.
- [ ] README documents install, slot model, theme bridge, a11y, limitations.
- [ ] Examples page deployed; `examples/meme.html` shows a working meme.
- [ ] Published to npm as `@profpowell/canvas-text@0.1.0`.
