# `<canvas-text>`

> A tiny web component that rasterizes layered rich text and images onto a canvas — the rendering primitive behind memes, OG cards, banner generators, and sticker tools.

[![npm](https://img.shields.io/npm/v/@profpowell/canvas-text.svg)](https://www.npmjs.com/package/@profpowell/canvas-text) **·** MIT **·** [Docs & Demos](https://profpowell.github.io/canvas-text/) **·** [API](https://profpowell.github.io/canvas-text/api.html)

```html
<canvas-text width="500" height="500" theme="none">
  <img slot="background" src="doge.jpg" crossorigin="anonymous">
  <div slot="text-1" style="text-align:center; font-size:48px; font-weight:bold;
                            color:white; -webkit-text-stroke:2px black;
                            padding-top:20px;">
    TOP TEXT
  </div>
  <div slot="text-2" style="text-align:center; font-size:48px; font-weight:bold;
                            color:white; -webkit-text-stroke:2px black;
                            padding-top:380px;">
    BOTTOM TEXT
  </div>
</canvas-text>
```

That's it — drop the element in, it composites a real canvas you can export to PNG/JPEG/WebP. No build step, no framework, no shadow DOM, no canvas API to learn.

> **Why `theme="none"` for meme-style text?** When every text layer fully declares its own color/font/stroke, the default `theme="inherit"` wrapper can mis-align `-webkit-text-stroke` paths on glyphs with closed bowls or crossings (P, B, M, X). For tightly-styled overlays, opt out of inheritance. See [Gotchas](https://profpowell.github.io/canvas-text/api.html#gotchas).

## Why this component?

You _could_ wire `ctx.fillText` + `ctx.drawImage` by hand. But once you want bold spans, italic phrases, accent colors, multiple lines, RTL, auto line-wrap, and image layering in z-order — and you want it to play nicely with screen readers and your design tokens — you're building a layout engine. `<canvas-text>` is that layout engine wrapped in a 5-line HTML tag.

- **HTML in → pixels out.** Slot real markup; get a canvas.
- **Layered.** Compose background images and text in z-order via named slots.
- **Themed.** `theme="inherit"` copies your CSS tokens onto the rendered text — Vanilla Breeze themes just work.
- **Exportable.** `toBlob()` / `toDataURL()` for PNG/JPEG/WebP.
- **Accessible by default.** Slotted text stays in the light DOM for screen readers; the canvas is `aria-hidden`.
- **Standalone.** No framework. No bundler required. ESM-only, ~10 kB minified.

## Install

```bash
npm install @profpowell/canvas-text render-tag
```

`render-tag` is a peer dependency — your bundler picks the version.

Or load straight from a CDN, no install:

```html
<script type="importmap">
  { "imports": { "render-tag": "https://esm.sh/render-tag@0.1.7" } }
</script>
<script type="module" src="https://unpkg.com/@profpowell/canvas-text"></script>
```

## Quick examples

### Plain rich text on a canvas

```html
<canvas-text width="600" compose="text-only">
  <p>Hello, <strong>world</strong>!</p>
</canvas-text>
```

### Background + overlaid text

```html
<canvas-text width="500" height="500">
  <img slot="background" src="poster.jpg" crossorigin="anonymous">
  <div slot="text-1" style="text-align:center; font-size:64px;
                            font-weight:bold; color:white;
                            padding-top:200px;">
    OPENING NIGHT
  </div>
</canvas-text>
```

### Export the result

```js
const el = document.querySelector('canvas-text');
await el.render();                          // ensure latest paint
const blob = await el.toBlob('image/png');  // → Blob, ready to upload
const url  = el.toDataURL();                // → "data:image/png;base64,..."
```

### React to user input

```html
<input id="caption" value="When the build passes on Friday">
<canvas-text id="meme" width="500" height="500">
  <img slot="background" src="distracted.jpg" crossorigin="anonymous">
</canvas-text>

<script type="module">
  const meme = document.getElementById('meme');
  document.getElementById('caption').addEventListener('input', (e) => {
    meme.innerHTML += '';  // no-op; the MutationObserver re-renders automatically
    meme.querySelector('[slot="text-1"]')?.remove();
    const div = document.createElement('div');
    div.slot = 'text-1';
    div.style.cssText = 'text-align:center; font-size:48px; font-weight:bold; color:white; padding-top:20px;';
    div.textContent = e.target.value;
    meme.appendChild(div);
  });
</script>
```

Attribute, slot, and `src` changes are observed — the canvas re-renders on the next frame, coalescing rapid edits.

## Slot grammar

| Slot                 | Type      | z-order   | Notes                                          |
|----------------------|-----------|-----------|------------------------------------------------|
| `background`         | image     | `0`       | bottom of the stack                            |
| `background-<N>`     | image     | `N`       | integer suffix; higher N stacks above lower N  |
| `text-<N>`           | rich text | `N`       | painted above `background-N` at the same N    |
| _(no `slot`)_        | rich text | `∞`       | unslotted children paint last, always on top   |

Use this as a mental model:

```
              ┌───────────────────────────┐
   z = ∞      │ default-slot rich text    │ ← unslotted children
              ├───────────────────────────┤
   z = 2      │ <div slot="text-2">       │
              ├───────────────────────────┤
   z = 2      │ <img slot="background-2"> │
              ├───────────────────────────┤
   z = 1      │ <div slot="text-1">       │
              ├───────────────────────────┤
   z = 1      │ <img slot="background-1"> │
              ├───────────────────────────┤
   z = 0      │ <img slot="background">   │ ← bottom layer
              └───────────────────────────┘
```

## CSS support inside layers (read this if your layout looks wrong)

Layers are passed to [`render-tag`](https://www.npmjs.com/package/render-tag) for rasterization. `render-tag` is a layout/raster engine, **not** a full browser. Its CSS surface is intentionally small:

- ✅ **Honored:** `color`, `background-color`, `font-family`, `font-size`, `font-weight`, `font-style`, `line-height`, `letter-spacing`, `text-align`, `padding`, `margin`, `border`, basic block flow, `-webkit-text-stroke`.
- ❌ **Ignored:** `position`, `top` / `right` / `bottom` / `left`, `inset`, flexbox alignment (`align-items`, `justify-content`), grid, `transform`, CSS variables resolved _inside_ a layer.
- ⚠️ **`font:` shorthand is not parsed** — use `font-size`, `font-weight`, `font-family` separately.

For vertical placement inside a layer (e.g. "bottom text" in a meme), use **`padding-top`** against the full canvas height. The meme example at the top does exactly that.

## Attributes

| Name       | Default      | Notes                                                            |
|------------|--------------|------------------------------------------------------------------|
| `width`    | `600`        | Canvas width in CSS pixels.                                      |
| `height`   | _auto_       | Auto from background image ratio when present, else `width`.     |
| `theme`    | `inherit`    | `inherit` &#124; `none` &#124; `inline` — see Theme bridge below.|
| `compose`  | `slots`      | `slots` (layer pipeline) &#124; `text-only` (single text layer). |
| `format`   | `png`        | `png` &#124; `jpeg` &#124; `webp` — default MIME for exports.    |
| `dpr`      | `auto`       | Numeric override; `auto` reads `window.devicePixelRatio`.        |
| `accuracy` | `default`    | Passed through to render-tag.                                    |
| `lang`     | host `lang`  | Reserved for future bidi/CJK hints.                              |
| `alt`      | _none_       | `aria-label` for the canvas; hides the fallback DOM from AT.     |

Plus one property:

| Property | Type              | Notes                                                                          |
|----------|-------------------|--------------------------------------------------------------------------------|
| `html`   | `string`          | Setter replaces unslotted children only; slotted layers + canvas preserved.    |

## Methods

```ts
getCanvas(): HTMLCanvasElement | null;
toDataURL(type?: string, quality?: number): string;
toBlob(type?: string, quality?: number): Promise<Blob>;
render(): Promise<void>;
```

- `getCanvas()` returns the live canvas element (or `null` before first connect).
- `toDataURL` / `toBlob` reflect the **last completed render**. If you've just mutated attributes or slots, `await el.render()` (or wait for `canvas-text:rendered`) before exporting.
- `render()` forces a render and resolves after paint.

## Events

| Event                       | Detail                            | Fires when                                  |
|-----------------------------|-----------------------------------|---------------------------------------------|
| `canvas-text:rendered`      | `{ width, height, durationMs }`   | After each successful paint.                |
| `canvas-text:error`         | `{ error }`                       | render-tag threw; composition aborted.      |
| `canvas-text:layer-error`   | `{ slot, error }`                 | A single layer failed; the rest still rendered. |

## Theme bridge

`theme="inherit"` (the default) copies an allowlist of computed CSS properties from the host element onto each text layer before render. The allowlist:

```
color, font-family, font-size, font-weight, font-style,
line-height, letter-spacing, text-align, background-color
```

This means a `<canvas-text>` dropped into a [Vanilla Breeze](https://www.npmjs.com/package/@profpowell/vanilla-breeze) page (or any tokenized design system) inherits the surrounding type, color, and weight automatically. No props to wire, no token names to know.

Modes:

| Mode      | Behavior                                                                      |
|-----------|-------------------------------------------------------------------------------|
| `inherit` | Copy allowlist from `getComputedStyle(host)`.                                 |
| `inline`  | Trust the consumer; pass slotted HTML through unchanged.                      |
| `none`    | Render with `render-tag`'s defaults only — no inherited styles.               |

The bridge runs once per render. Theme changes after first render are not currently observed (v0.1 limitation).

## Accessibility

The slotted HTML stays in the light DOM, visually hidden via `clip-path`, so assistive tech reads it as normal text. The canvas itself is `aria-hidden="true"`. If you set an `alt` attribute on the host, the canvas gets that as `aria-label` and the slotted fallback is suppressed from AT — so a screen reader gets one clean description instead of both.

## Known limitations (v0.1)

- Cross-origin images without `crossorigin="anonymous"` will taint the canvas; `toBlob` / `toDataURL` will throw on export.
- Theme changes after first render are not observed.
- No SSR / node-canvas adapter.
- No interactive editing (caret, selection).
- Limited CSS surface inside layers (see above).

## Resources

- **Live demos:** [profpowell.github.io/canvas-text](https://profpowell.github.io/canvas-text/)
- **API reference:** [profpowell.github.io/canvas-text/api.html](https://profpowell.github.io/canvas-text/api.html)
- **Source:** [github.com/ProfPowell/canvas-text](https://github.com/ProfPowell/canvas-text)
- **`render-tag` (peer dep):** [npmjs.com/package/render-tag](https://www.npmjs.com/package/render-tag)

## Related components

Part of the [ProfPowell vanilla web components](https://github.com/ProfPowell?tab=repositories) suite:

- [`<code-block>`](https://github.com/ProfPowell/code-block) — syntax-highlighted code with copy/lines.
- [`<browser-window>`](https://github.com/ProfPowell/browser-window) — Safari-style chrome around a content area.
- [`<terminal-window>`](https://github.com/ProfPowell/terminal-window) — interactive terminal emulator.
- [`<screen-saver>`](https://github.com/ProfPowell/screen-saver) — retro screensaver effects after idle.

## License

MIT © [Thomas Powell](https://github.com/ProfPowell)
