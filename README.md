# @profpowell/canvas-text

A stand-alone web component that composites rich text and images onto a
canvas. Designed to be Vanilla Breeze-friendly without depending on VB.
Built on top of [`render-tag`](https://www.npmjs.com/package/render-tag).

## Install

```bash
npm install @profpowell/canvas-text render-tag
```

`render-tag` is a peer dependency.

## Basic usage

```html
<script type="importmap">
  { "imports": { "render-tag": "https://esm.sh/render-tag" } }
</script>
<script type="module" src="https://unpkg.com/@profpowell/canvas-text"></script>

<canvas-text width="600" compose="text-only">
  <strong>Hello</strong> world
</canvas-text>
```

## Layered (meme) usage

```html
<canvas-text width="500" height="500">
  <img slot="background" src="doge.jpg" crossorigin="anonymous">
  <div slot="text-1" style="text-align:center; font-size:48px;
                            font-weight:bold; color:white;
                            -webkit-text-stroke:2px black;
                            padding-top:20px;">
    TOP TEXT
  </div>
  <div slot="text-2" style="text-align:center; font-size:48px;
                            font-weight:bold; color:white;
                            -webkit-text-stroke:2px black;
                            padding-top:360px;">
    BOTTOM TEXT
  </div>
</canvas-text>
```

## Slot grammar

- `slot="background"` — z=0, image layer (bottom).
- `slot="background-N"` — image layer at z=N.
- `slot="text-N"` — rich-text layer at z=N (above `background-N` at same N).
- Unslotted children — single text layer painted on top of everything (z = ∞).

Background images stack from low N to high N. Text layers stack the same way and interleave with background layers by N. At the same N, the image paints below the text.

## CSS support inside layers (read this)

Layers are passed to `render-tag` for rasterization. `render-tag` has a **limited CSS surface**:

- ✅ Supported: `color`, `background-color`, `font-family`, `font-size`, `font-weight`, `font-style`, `line-height`, `letter-spacing`, `text-align`, `padding`/`margin`, `border`, basic block flow, `-webkit-text-stroke`.
- ❌ Not supported: `position`, `top`/`right`/`bottom`/`left`, `inset`, flexbox alignment (`align-items`, `justify-content`), grid, transforms, CSS variables resolved inside the layer.
- ⚠️ The `font:` shorthand is **not** parsed; use `font-size` / `font-weight` / `font-family` separately.

For vertical positioning, use `padding-top` against the full canvas height (see the meme example above).

## Attributes

| Name      | Default     | Notes                                                          |
|-----------|-------------|----------------------------------------------------------------|
| width     | 600         | Canvas width in CSS pixels.                                    |
| height    | auto        | Auto from background image ratio (if present) or canvas width. |
| theme     | inherit     | `inherit` \| `none` \| `inline`                                |
| compose   | slots       | `slots` (default, layer pipeline) \| `text-only` (single layer)|
| format    | png         | `png` \| `jpeg` \| `webp` — used by `toBlob` / `toDataURL`.    |
| dpr       | auto        | Numeric override; `auto` reads `window.devicePixelRatio`.      |
| accuracy  | default     | Passed through to render-tag.                                  |
| lang      | host lang   | Reserved for future bidi/CJK hints (ignored by render-tag).    |
| alt       | —           | `aria-label` for the canvas; hides fallback DOM from AT.       |

## Methods

- `getCanvas()` — the current canvas element. Returns `null` before first connect.
- `toDataURL(type?, quality?)` — synchronous export, reflects the last completed render.
- `toBlob(type?, quality?)` — async export, reflects the last completed render.
- `render()` — force a render; resolves after paint.

After mutating attributes or slots, `await el.render()` (or wait for the next `canvas-text:rendered` event) before reading pixels with `toDataURL` / `toBlob`.

## Events

- `canvas-text:rendered` — `{ width, height, durationMs }` after each successful paint.
- `canvas-text:error` — `{ error }` when render-tag throws (composition aborted).
- `canvas-text:layer-error` — `{ slot, error }` when a single layer fails (e.g. a broken image). The rest of the composition still renders.

## Theme bridge

When `theme="inherit"` (default) the element copies a small allowlist of computed CSS properties from the host (color, font-family, font-size, font-weight, font-style, line-height, letter-spacing, text-align, background-color) and inlines them on each text layer before handing to render-tag. This lets Vanilla Breeze themes (or any tokenized design system) "just work" — the rasterized text picks up the surrounding type/color tokens automatically.

Modes:

- `theme="inherit"` (default) — copy allowlist from `getComputedStyle(host)`.
- `theme="inline"` — assume the consumer already inlined styles; pass through unchanged.
- `theme="none"` — render with render-tag's defaults only.

The bridge runs once per render. Theme changes after first render are not re-applied in v0.1.

## Accessibility

The slotted HTML stays in the light DOM, visually hidden via clip-path, so screen readers consume it as normal text. The canvas element gets `aria-hidden="true"`. If you set an `alt` attribute on the host, the canvas gets that as `aria-label` and the slotted fallback is also `aria-hidden` so AT doesn't read both.

## Known limitations (v0.1)

- Cross-origin images without `crossorigin="anonymous"` will taint the canvas; `toBlob` / `toDataURL` will throw.
- Theme changes after first render are not observed.
- No SSR / node-canvas adapter.
- No interactive editing (caret, selection).
- See "CSS support inside layers" above — render-tag is a layout/raster engine, not a full browser.

## License

MIT
