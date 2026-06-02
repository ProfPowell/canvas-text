# Spec: `@profpowell/canvas-text` v0.2 — Placement, Presets & Fonts

> Date: 2026-06-02
> Status: design approved, ready for implementation plan
> Builds on: `2026-05-14-canvas-text-design.md` (v0.1 layer/compositing model)

## Summary

v0.1 ships a compositing primitive: layers stack full-canvas in z-order. v0.2
adds the one capability every real-world use case needs — **placing a layer at
a coordinate** — plus opinionated **presets** that turn the common cases (meme,
badge, banner, caption) into near one-liners, and a **font-readiness fix** so
webfonts never render as fallback. Five interactive demos ship alongside as
living documentation.

This is a **capability + demos** release. The placement attributes are the pure
primitive; presets are thin default-resolvers layered on top; explicit
attributes always win.

## Goals

- **Placement primitive.** Any layer (text or image) can be anchored to one of
  nine positions and nudged by an offset; images gain a `fit` mode.
- **Presets.** `preset="meme|badge|banner|caption"` apply sensible
  placement/typography defaults by layer kind and count, fully overridable.
- **Auto-row layout.** N image layers distribute in a centered band — the
  enabler for "three badges of their choice."
- **Font correctness.** `render()` waits for `document.fonts.ready` before
  drawing.
- **Demos.** Five interactive, downloadable demos on the docs site.

## Non-goals (v0.2)

- Rotation, per-layer opacity, blend modes (beyond what CSS gives text layers).
- A drag-to-position visual editor.
- Animation / video frames.
- CSS-style passthrough (reading computed `top/left/transform` off layers and
  replicating it). Placement is expressed by explicit attributes, not inferred.
- Bundled font files. Demos and docs load OFL faces themselves.
- Helper sub-elements (`<ct-row>`, `<ct-stack>`). Row layout is a preset
  behavior, not a new element.

## Placement attributes (the primitive)

New per-layer attributes, valid on **any** slotted layer:

| Attribute | Values | Default |
|---|---|---|
| `place` | `top-left` `top-center` `top-right` `center-left` `center` `center-right` `bottom-left` `bottom-center` `bottom-right`; aliases `top`→`top-center`, `bottom`→`bottom-center`, `left`→`center-left`, `right`→`center-right` | `center` |
| `offset-x` | px (`40`) or % of canvas width (`10%`); positive → right | `0` |
| `offset-y` | px (`40`) or % of canvas height (`10%`); positive → down | `0` |
| `fit` | `cover` \| `contain` \| `fill` (image layers only) | `cover` for `background`, `contain` for `image` |

**Anchor semantics.** `place` selects an anchor point on the canvas; the layer's
*matching* point snaps to it. `place="bottom-center"` aligns the layer's
bottom-center to the canvas bottom-center. `offset-x/offset-y` then nudge from
there. This mirrors `background-position` / CSS anchor intuition.

**Resolution — two implementations, one syntax:**

- **Text layers** — generate a positioned wrapper (`position:absolute` + computed
  `top/left/transform`) from `place`+`offset`, then hand to `render-tag`, which
  already performs full-canvas CSS layout (v0.1 passes the full target height
  precisely so inner positioning resolves). No new layout engine.
- **Image layers** — compute a `drawImage` destination rect from
  `place`+`offset`+`fit` and natural/attribute size. This replaces v0.1's
  unconditional `drawImage(img, 0, 0, w, h)` stretch.

Offsets and percentages resolve against the **composed canvas** size (CSS px,
pre-DPR; the existing DPR scaling in `#sizeCanvas` is unchanged).

## Slot grammar extension

v0.1 grammar (`layers.js` `SLOT_RE`): `^(background|text)(?:-(\d+))?$`.

v0.2 grammar: `^(background|image|text)(?:-(\d+))?$`.

| Slot | Kind | Default placement | Default fit |
|---|---|---|---|
| `background`, `background-N` | image (full-bleed) | `center` | `cover` |
| `image-N` | image (placed) | `center` | `contain` |
| `text-N` | text | `center` | — |

`background` keeps its v0.1 meaning (fills the canvas) so existing pages are
unaffected; `image-N` is the new *placed* image. Both honor `place`/`offset`/
`fit`. An `image-N` layer's size comes from the element's `width`/`height`
attributes if present, else its natural size, scaled per `fit` if a box is
implied.

Layer collection and z-ordering are unchanged except for the widened regex and
the new kind: `image-N` sorts by `N` like other numbered slots.

## Presets

`preset="<name>"` on the host. A preset is a **default-resolver**: a pure
function `(layers, canvasSize) → per-layer defaults` for `place`, `offset`,
`fit`, and typography. It only fills attributes the author did **not** set —
explicit per-layer attributes always win. Presets add no new rendering path;
they compute the same attributes an author could type by hand.

Starting defaults (pixel values are implementation tuning, not contract):

- **`meme`** — typography: `font-family: Impact, 'Anton', sans-serif`,
  weight 900, `color:#fff`, `-webkit-text-stroke: 2px #000`, uppercase.
  `text-1` → `place=top offset-y=16`; `text-2` → `place=bottom offset-y=-16`;
  `background` → `fit=cover`.
- **`badge`** — `image-1` (avatar) centered in the upper third;
  `text-1` (name) below it; `text-2` (title/subtitle) below that; remaining
  `image-N` (N≥2) distributed by **auto-row** in a centered band near the
  bottom.
- **`banner`** — `text-1` (name) `place=top`; all `image-N` distributed by
  **auto-row** along the bottom; `background` → `fit=cover`.
- **`caption`** — semantic figure model. The figure's image becomes the
  `background` (`fit=cover`); a `<figcaption>` (or `text-1`) becomes a
  **full-width, bottom-anchored band**. The band's background is simply the
  caption element's own `background-color` — set it (e.g. a translucent strip)
  for a band, omit it for plain overlaid text. Flattens
  `<figure><img><figcaption></figcaption></figure>` into one canvas image.

### Auto-row layout

Shared by `badge` and `banner`. Given N image layers assigned to a row, a target
band (y-position + height) and a `gap`: lay items left-to-right, total row width
= `N*itemW + (N-1)*gap`, centered horizontally; each item placed by its computed
`place`/`offset`. Deterministic; no author markup beyond providing the images.
`gap` default is a preset constant (tunable); items size to the band height with
`fit=contain`.

### Caption / semantic input

The `caption` preset reads the **semantic** structure the author already writes —
a `<figure>` with an `<img>` and a `<figcaption>` — and maps it onto the layer
model (image→background, figcaption→bottom band). This keeps the authored markup
semantic and accessible (the visually-hidden fallback DOM continues to expose the
real `<figure>`/`<figcaption>` to assistive tech, per v0.1's a11y model), while
the canvas is the flattened decorative output.

## Fonts

`render()` awaits `document.fonts.ready` before drawing, guarded for
environments without `document.fonts` (`if (document.fonts?.ready) await
document.fonts.ready`). This fixes the current race where a layer drawn before
its webfont loads rasterizes with a fallback face. The await is placed after the
existing microtask yield and respects the existing `#renderToken` cancellation
check (a newer render still wins). No fonts are bundled; demos and docs load OFL
faces (e.g. **Anton** for memes, a display face for banners) via `@font-face` /
Google Fonts.

## Demos

Five interactive pages on the existing docs site (`docs/`). Each renders live,
exposes the relevant attributes/preset, and offers a **Download** button wired to
`toBlob`. Each doubles as copy-paste documentation.

1. **Meme generator** — pick/upload image, type top + bottom text, live preview,
   download. Exercises `preset="meme"`, `fit=cover`, font readiness, `toBlob`.
2. **User badge / profile card** — avatar + name + title + a row of stat badges,
   data-driven from a JS object. Exercises `preset="badge"`, auto-row, placement.
3. **Game banner builder** — banner background + player name + pick 3 badges from
   a tray; recomposes on selection. Exercises placement, the badge row,
   reactive recomposition.
4. **OG / social share card** — title + subtitle + logo over a gradient or photo.
   Exercises placement + `fit` for the broad og:image use case.
5. **Caption / figure flattener** — drop an image, type a caption, toggle the
   band background on/off, download the flattened captioned figure. Exercises
   `preset="caption"`, the semantic `<figure>`/`<figcaption>` input, full-width
   bottom band.

## Testing

Playwright, matching v0.1's pixel-assertion style (`test/*.spec.js`):

- **Placement** — `place` anchors land ink/opaque pixels in the expected canvas
  region (e.g. `top-center` → top band non-blank, bottom band blank); `offset`
  shifts it measurably.
- **fit** — `cover` fills with cropping, `contain` letterboxes (transparent
  margins present), `fill` matches v0.1 stretch.
- **Auto-row** — three image layers produce three horizontally-separated opaque
  clusters, centered.
- **Presets** — `meme` applies stroke (edge pixels around glyphs); `caption`
  maps `<figure>`/`<figcaption>` to background + bottom band; explicit attributes
  override preset defaults.
- **Fonts** — render awaits `document.fonts.ready` (a layer using a deferred
  `FontFace` renders in that face, asserted via a glyph-metric or pixel diff
  against the fallback).
- **Back-compat** — existing v0.1 specs still pass unchanged.

## Backward compatibility

- `background`/`background-N`/`text-N` retain v0.1 behavior with no attributes.
- The only behavioral change to existing markup: image layers gain a real `fit`
  default. `background` defaults to `fit=cover` (was an unconditional stretch =
  `fill`). Documented as a v0.2 change; `fit=fill` restores the old look.
- All new attributes (`place`, `offset-x`, `offset-y`, `fit`, `preset`) are
  added to `observedAttributes` so changes trigger re-render via the existing rAF
  coalescing path.

## Open implementation notes (not contract)

- Exact preset pixel constants (offsets, gaps, band height, stroke width) are
  tuned during implementation against the demos.
- `image-N` sizing precedence (attribute width/height vs natural vs band fit)
  finalized when the auto-row math lands.
