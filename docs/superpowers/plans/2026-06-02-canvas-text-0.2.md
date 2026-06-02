# canvas-text v0.2 — Placement, Presets & Fonts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-layer placement (anchor + offset + fit), four presets (meme/badge/banner/caption), and a font-readiness fix to `<canvas-text>`, plus five interactive demos.

**Architecture:** A new pure module `src/placement.js` does all geometry (anchor resolution, image `drawImage` rect math, text-wrapper CSS). `src/layers.js` reads the new attributes and calls placement during paint. A new `src/presets.js` produces *layer-descriptor defaults* (never mutating author DOM) consumed by the element before paint. The compositing canvas works in **device pixels** (no `ctx.scale`), so image math is done in device space; text math stays in CSS space because `render-tag` applies `pixelRatio` itself.

**Tech Stack:** Vanilla JS ES modules, Vite, Playwright (browser-context unit + pixel tests), render-tag (peer dep).

**Spec:** `docs/superpowers/specs/2026-06-02-canvas-text-0.2-design.md`

---

## File Structure

- `src/placement.js` — **new.** Pure geometry: `resolveAnchor`, `parseLength`, `resolveImageBoxCss`, `imageDrawArgs`, `textWrapperStyle`. No DOM.
- `src/presets.js` — **new.** `applyPresetToLayers(name, layers, ctx)` fills missing placement defaults + `presetStyle` on layer descriptors; `captionLayers(host)` synthesizes layers from a `<figure>`. No author-DOM mutation.
- `src/layers.js` — **modify.** Widen slot regex to add `image-N`; read `place`/`offset-x`/`offset-y`/`fit` into the layer descriptor; rewrite `paintLayer` image + text branches to use placement.
- `src/canvas-text.js` — **modify.** Add `preset` to `observedAttributes`; add new per-layer attrs to the MutationObserver filter; route collection through presets; `await document.fonts.ready`.
- `test/placement.spec.js` — **new.** Unit tests for the pure module.
- `test/placement-render.spec.js` — **new.** Pixel tests for image/text placement.
- `test/presets.spec.js` — **new.** Preset behavior + pixel tests.
- `test/fonts.spec.js` — **new.** Font-readiness test.
- `docs/meme.html`, `docs/badge.html`, `docs/banner.html`, `docs/og-card.html`, `docs/caption.html` — **new** demo pages.
- `test/demos.spec.js` — **new.** Smoke test: each demo renders a non-blank canvas.
- `docs/index.html`, `docs/api.html`, `README.md`, `package.json` — **modify** for nav, docs, version.

Coordinate conventions used throughout:
- **CSS px** = layout pixels (what `width`/`height` attributes mean).
- **Device px** = `cssPx * dpr` (the backing-store size; what the compositing `ctx` draws in).
- Image placement runs in **device px**. Text placement runs in **CSS px** (render-tag scales by `pixelRatio` internally).

---

## Phase 1 — Placement primitive

### Task 1: Anchor resolution + length parsing

**Files:**
- Create: `src/placement.js`
- Test: `test/placement.spec.js`

- [ ] **Step 1: Write the failing test**

```js
// test/placement.spec.js
import { test, expect } from '@playwright/test';

test('resolveAnchor maps names and aliases to fractions', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const r = await page.evaluate(async () => {
    const { resolveAnchor } = await import('/src/placement.js');
    return {
      center: resolveAnchor('center'),
      tc: resolveAnchor('top-center'),
      br: resolveAnchor('bottom-right'),
      topAlias: resolveAnchor('top'),
      rightAlias: resolveAnchor('right'),
      missing: resolveAnchor(null),
      junk: resolveAnchor('nonsense'),
    };
  });
  expect(r.center).toEqual({ ax: 0.5, ay: 0.5 });
  expect(r.tc).toEqual({ ax: 0.5, ay: 0 });
  expect(r.br).toEqual({ ax: 1, ay: 1 });
  expect(r.topAlias).toEqual({ ax: 0.5, ay: 0 });
  expect(r.rightAlias).toEqual({ ax: 1, ay: 0.5 });
  expect(r.missing).toEqual({ ax: 0.5, ay: 0.5 });
  expect(r.junk).toEqual({ ax: 0.5, ay: 0.5 });
});

test('parseLength handles px, percent, and empty', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const r = await page.evaluate(async () => {
    const { parseLength } = await import('/src/placement.js');
    return {
      px: parseLength('40', 600),
      pct: parseLength('10%', 600),
      empty: parseLength('', 600),
      nul: parseLength(null, 600),
      neg: parseLength('-16', 600),
    };
  });
  expect(r.px).toBe(40);
  expect(r.pct).toBeCloseTo(60);
  expect(r.empty).toBe(0);
  expect(r.nul).toBe(0);
  expect(r.neg).toBe(-16);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/placement.spec.js`
Expected: FAIL — `Failed to resolve module specifier '/src/placement.js'` / 404.

- [ ] **Step 3: Write minimal implementation**

```js
// src/placement.js
const ANCHORS = {
  'top-left': [0, 0], 'top-center': [0.5, 0], 'top-right': [1, 0],
  'center-left': [0, 0.5], center: [0.5, 0.5], 'center-right': [1, 0.5],
  'bottom-left': [0, 1], 'bottom-center': [0.5, 1], 'bottom-right': [1, 1],
  top: [0.5, 0], bottom: [0.5, 1], left: [0, 0.5], right: [1, 0.5],
};

export function resolveAnchor(place) {
  const key = (place == null ? '' : String(place)).trim().toLowerCase();
  const a = ANCHORS[key] || ANCHORS.center;
  return { ax: a[0], ay: a[1] };
}

// "40" -> 40, "10%" -> basis*0.1, ""/null/garbage -> 0.
export function parseLength(value, basis) {
  if (value == null || value === '') return 0;
  const s = String(value).trim();
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return 0;
  return s.endsWith('%') ? (n / 100) * basis : n;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/placement.spec.js`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add src/placement.js test/placement.spec.js
git commit -m "feat(placement): anchor resolution and length parsing"
```

---

### Task 2: Image box sizing + drawImage rect math

**Files:**
- Modify: `src/placement.js`
- Test: `test/placement.spec.js`

- [ ] **Step 1: Write the failing test**

```js
// append to test/placement.spec.js
test('resolveImageBoxCss derives box from attrs or natural size', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const r = await page.evaluate(async () => {
    const { resolveImageBoxCss } = await import('/src/placement.js');
    return {
      natural: resolveImageBoxCss({ natW: 200, natH: 100, attrW: null, attrH: null }),
      both: resolveImageBoxCss({ natW: 200, natH: 100, attrW: 80, attrH: 40 }),
      wOnly: resolveImageBoxCss({ natW: 200, natH: 100, attrW: 50, attrH: null }),
      hOnly: resolveImageBoxCss({ natW: 200, natH: 100, attrW: null, attrH: 50 }),
    };
  });
  expect(r.natural).toEqual({ w: 200, h: 100 });
  expect(r.both).toEqual({ w: 80, h: 40 });
  expect(r.wOnly).toEqual({ w: 50, h: 25 });   // aspect-preserved
  expect(r.hOnly).toEqual({ w: 100, h: 50 });
});

test('imageDrawArgs: fill stretches box, anchored top-left', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const a = await page.evaluate(async () => {
    const { imageDrawArgs } = await import('/src/placement.js');
    return imageDrawArgs({
      natW: 50, natH: 50, boxW: 100, boxH: 100, fit: 'fill',
      ax: 0, ay: 0, offsetX: 0, offsetY: 0, canvasW: 400, canvasH: 400,
    });
  });
  expect(a).toEqual({ sx: 0, sy: 0, sw: 50, sh: 50, dx: 0, dy: 0, dw: 100, dh: 100 });
});

test('imageDrawArgs: cover crops source, fills box; bottom-center anchor + offset', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const a = await page.evaluate(async () => {
    const { imageDrawArgs } = await import('/src/placement.js');
    // 200x100 source into a 100x100 box -> cover scale = max(0.5,1)=1; sw=100, sh=100
    return imageDrawArgs({
      natW: 200, natH: 100, boxW: 100, boxH: 100, fit: 'cover',
      ax: 0.5, ay: 1, offsetX: 0, offsetY: -40, canvasW: 400, canvasH: 400,
    });
  });
  // source crop is horizontally centered: sw=100 -> sx=(200-100)/2=50
  expect(a.sx).toBeCloseTo(50);
  expect(a.sy).toBeCloseTo(0);
  expect(a.sw).toBeCloseTo(100);
  expect(a.sh).toBeCloseTo(100);
  // box: bottom-center -> dx = 0.5*(400-100)=150 ; dy = 1*(400-100)+(-40)=260
  expect(a.dx).toBeCloseTo(150);
  expect(a.dy).toBeCloseTo(260);
  expect(a.dw).toBeCloseTo(100);
  expect(a.dh).toBeCloseTo(100);
});

test('imageDrawArgs: contain letterboxes inside box', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const a = await page.evaluate(async () => {
    const { imageDrawArgs } = await import('/src/placement.js');
    // 200x100 into 100x100 -> contain scale=min(0.5,1)=0.5 -> dw=100,dh=50
    return imageDrawArgs({
      natW: 200, natH: 100, boxW: 100, boxH: 100, fit: 'contain',
      ax: 0, ay: 0, offsetX: 0, offsetY: 0, canvasW: 400, canvasH: 400,
    });
  });
  expect(a.dw).toBeCloseTo(100);
  expect(a.dh).toBeCloseTo(50);
  expect(a.dx).toBeCloseTo(0);     // boxX 0 + (100-100)/2
  expect(a.dy).toBeCloseTo(25);    // boxY 0 + (100-50)/2
  expect(a.sw).toBeCloseTo(200);
  expect(a.sh).toBeCloseTo(100);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/placement.spec.js`
Expected: FAIL — `resolveImageBoxCss is not a function` / `imageDrawArgs is not a function`.

- [ ] **Step 3: Write minimal implementation**

```js
// append to src/placement.js

// Box (CSS px) for a placed image: explicit attrs win; a single attr
// preserves aspect ratio; otherwise natural size.
export function resolveImageBoxCss({ natW, natH, attrW, attrH }) {
  const haveW = Number.isFinite(attrW) && attrW > 0;
  const haveH = Number.isFinite(attrH) && attrH > 0;
  if (haveW && haveH) return { w: attrW, h: attrH };
  if (haveW) return { w: attrW, h: natW ? (attrW * natH) / natW : attrW };
  if (haveH) return { w: natH ? (attrH * natW) / natH : attrH, h: attrH };
  return { w: natW, h: natH };
}

// Always returns the 9-arg drawImage form. All inputs/outputs in one space
// (caller picks device or CSS px and stays consistent).
export function imageDrawArgs({
  natW, natH, boxW, boxH, fit, ax, ay, offsetX, offsetY, canvasW, canvasH,
}) {
  const boxX = ax * (canvasW - boxW) + offsetX;
  const boxY = ay * (canvasH - boxH) + offsetY;

  if (fit === 'fill') {
    return { sx: 0, sy: 0, sw: natW, sh: natH, dx: boxX, dy: boxY, dw: boxW, dh: boxH };
  }
  if (fit === 'contain') {
    const scale = Math.min(boxW / natW, boxH / natH);
    const dw = natW * scale, dh = natH * scale;
    return {
      sx: 0, sy: 0, sw: natW, sh: natH,
      dx: boxX + (boxW - dw) / 2, dy: boxY + (boxH - dh) / 2, dw, dh,
    };
  }
  // cover: scale so box is fully covered, crop source rect centered.
  const scale = Math.max(boxW / natW, boxH / natH);
  const sw = boxW / scale, sh = boxH / scale;
  return {
    sx: (natW - sw) / 2, sy: (natH - sh) / 2, sw, sh,
    dx: boxX, dy: boxY, dw: boxW, dh: boxH,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/placement.spec.js`
Expected: PASS (6 passed).

- [ ] **Step 5: Commit**

```bash
git add src/placement.js test/placement.spec.js
git commit -m "feat(placement): image box sizing and drawImage rect math"
```

---

### Task 3: Text wrapper CSS

**Files:**
- Modify: `src/placement.js`
- Test: `test/placement.spec.js`

Text layers are positioned by wrapping their HTML in a full-width absolutely-positioned `<div>`; horizontal placement is `text-align` (so a `background-color` on the layer becomes a full-width band — used by the caption preset), vertical placement is `top`/`bottom`.

- [ ] **Step 1: Write the failing test**

```js
// append to test/placement.spec.js
test('textWrapperStyle: top-center', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const css = await page.evaluate(async () => {
    const { textWrapperStyle } = await import('/src/placement.js');
    return textWrapperStyle({ ax: 0.5, ay: 0, offsetX: 0, offsetY: 16 });
  });
  expect(css).toContain('position:absolute');
  expect(css).toContain('left:0');
  expect(css).toContain('right:0');
  expect(css).toContain('text-align:center');
  expect(css).toContain('top:16px');
  expect(css).not.toContain('bottom:');
});

test('textWrapperStyle: bottom-right with negative y becomes bottom offset', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const css = await page.evaluate(async () => {
    const { textWrapperStyle } = await import('/src/placement.js');
    return textWrapperStyle({ ax: 1, ay: 1, offsetX: 0, offsetY: -16 });
  });
  expect(css).toContain('text-align:right');
  expect(css).toContain('bottom:16px');
  expect(css).not.toMatch(/(^|\s)top:/);
});

test('textWrapperStyle: vertical center uses translateY', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const css = await page.evaluate(async () => {
    const { textWrapperStyle } = await import('/src/placement.js');
    return textWrapperStyle({ ax: 0, ay: 0.5, offsetX: 0, offsetY: 0 });
  });
  expect(css).toContain('text-align:left');
  expect(css).toContain('top:50%');
  expect(css).toContain('translateY(');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/placement.spec.js`
Expected: FAIL — `textWrapperStyle is not a function`.

- [ ] **Step 3: Write minimal implementation**

```js
// append to src/placement.js

// CSS for a full-width positioned wrapper around a text layer.
// Horizontal placement = text-align (ax); vertical placement = top/bottom (ay).
export function textWrapperStyle({ ax, ay, offsetX, offsetY }) {
  const align = ax === 0 ? 'left' : ax === 1 ? 'right' : 'center';
  const decls = ['position:absolute', 'left:0', 'right:0', `text-align:${align}`];
  if (ay === 0) {
    decls.push(`top:${offsetY}px`);
  } else if (ay === 1) {
    decls.push(`bottom:${-offsetY}px`);
  } else {
    decls.push('top:50%', `transform:translateY(calc(-50% + ${offsetY}px))`);
  }
  if (offsetX) {
    decls.push(`padding-${ax === 1 ? 'right' : 'left'}:${Math.abs(offsetX)}px`);
  }
  return decls.join('; ') + ';';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/placement.spec.js`
Expected: PASS (9 passed).

- [ ] **Step 5: Commit**

```bash
git add src/placement.js test/placement.spec.js
git commit -m "feat(placement): full-width text wrapper CSS"
```

---

### Task 4: Slot grammar — add `image-N`, read placement attrs

**Files:**
- Modify: `src/layers.js:3` (regex), `src/layers.js:5-45` (`collectLayers`)
- Test: `test/placement-render.spec.js`

- [ ] **Step 1: Write the failing test**

```js
// test/placement-render.spec.js
import { test, expect } from '@playwright/test';

test('image-N is a placed (non-background) image layer drawn at its box, not full-bleed', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const px = await page.evaluate(async () => {
    const el = document.createElement('canvas-text');
    el.setAttribute('width', '200');
    el.setAttribute('height', '200');
    el.innerHTML = `
      <img slot="image-1" src="/test/fixtures/red-square.png" crossorigin="anonymous"
           width="40" height="40" place="top-left">
    `;
    document.getElementById('harness').appendChild(el);
    await new Promise((res) => el.addEventListener('canvas-text:rendered', res, { once: true }));
    const c = el.getCanvas();
    const ctx = c.getContext('2d');
    const dpr = c.width / 200;
    return {
      inside: [...ctx.getImageData(10 * dpr, 10 * dpr, 1, 1).data], // within the 40x40 box
      outside: [...ctx.getImageData(120 * dpr, 120 * dpr, 1, 1).data], // far from box
    };
  });
  expect(px.inside[0]).toBeGreaterThan(200); // red present in box
  expect(px.outside[3]).toBe(0);             // transparent outside the placed image
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/placement-render.spec.js`
Expected: FAIL — `image-1` is not matched by `SLOT_RE`, so the layer is ignored; `px.inside[0]` is 0.

- [ ] **Step 3: Write minimal implementation**

Replace the regex at `src/layers.js:3`:

```js
const SLOT_RE = /^(background|image|text)(?:-(\d+))?$/;
```

Replace the body of `collectLayers` (`src/layers.js:5-45`) with:

```js
export function collectLayers(host, internalCanvas) {
  const layers = [];
  const defaultParts = [];

  for (const child of host.children) {
    if (child === internalCanvas) continue;
    if (child.tagName === 'CANVAS') continue;
    const slot = child.getAttribute('slot');
    if (!slot) {
      defaultParts.push(child);
      continue;
    }
    const m = SLOT_RE.exec(slot);
    if (!m) continue;
    const [, kind, n] = m;
    if (kind === 'text' && !n) {
      console.warn(`canvas-text: slot="text" requires a number suffix (text-1, text-2, ...). Got slot="${slot}"; layer ignored.`);
      continue;
    }
    const place = child.getAttribute('place');
    const offsetX = child.getAttribute('offset-x');
    const offsetY = child.getAttribute('offset-y');
    const fit = child.getAttribute('fit');
    if (kind === 'background') {
      const img = child.tagName === 'IMG' ? child : child.querySelector('img');
      if (img) {
        layers.push({ slot, z: n ? Number(n) : 0, kind: 'image', isBackground: true, node: img, place, offsetX, offsetY, fit });
      }
    } else if (kind === 'image') {
      const img = child.tagName === 'IMG' ? child : child.querySelector('img');
      if (img) {
        layers.push({ slot, z: Number(n), kind: 'image', isBackground: false, node: img, place, offsetX, offsetY, fit });
      }
    } else {
      layers.push({ slot, z: Number(n), kind: 'text', node: child, place, offsetX, offsetY, fit });
    }
  }
  if (defaultParts.length) {
    const wrapper = document.createElement('div');
    for (const p of defaultParts) wrapper.appendChild(p.cloneNode(true));
    layers.push({ slot: '(default)', z: Number.POSITIVE_INFINITY, kind: 'text', node: wrapper, place: null, offsetX: null, offsetY: null, fit: null });
  }
  layers.sort((a, b) => a.z - b.z || (a.kind === 'image' ? -1 : 1));
  return layers;
}
```

Note: this keeps the existing `console.warn` (allowed by eslint config since Task in v0.1 hygiene) and the existing z/sort behavior; it only adds the `image` branch and the placement fields.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/placement-render.spec.js`
Expected: This test still FAILS at the pixel assertion because `paintLayer` hasn't been updated yet (it still draws full-bleed). That is expected — Task 5 makes it pass. Run the existing suite to confirm no regression in collection:

Run: `npm test -- test/layers.spec.js`
Expected: PASS (4 passed) — existing background/text behavior unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/layers.js test/placement-render.spec.js
git commit -m "feat(layers): add image-N slot and read placement attributes"
```

---

### Task 5: Paint image layers with placement + fit

**Files:**
- Modify: `src/layers.js:1` (imports), `src/layers.js:47-90` (`paintLayer` image branch)
- Test: `test/placement-render.spec.js` (Task 4 test now passes) + new `fit` test

- [ ] **Step 1: Write the failing test (add a fit=cover background test)**

```js
// append to test/placement-render.spec.js
test('background fit=cover crops a non-square source to fill the square canvas', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const px = await page.evaluate(async () => {
    const el = document.createElement('canvas-text');
    el.setAttribute('width', '200');
    el.setAttribute('height', '200');
    // red-square is square; to prove cover, stretch a square into a wide canvas instead:
    el.setAttribute('height', '100'); // 200x100 canvas, square source -> cover crops vertically, fills fully
    el.innerHTML = `<img slot="background" src="/test/fixtures/red-square.png" crossorigin="anonymous">`;
    document.getElementById('harness').appendChild(el);
    await new Promise((res) => el.addEventListener('canvas-text:rendered', res, { once: true }));
    const c = el.getCanvas();
    const ctx = c.getContext('2d');
    // every sampled pixel should be opaque red (cover leaves no gaps)
    const corners = [[2,2],[c.width-3,2],[2,c.height-3],[c.width-3,c.height-3],[c.width/2|0,c.height/2|0]];
    return corners.map(([x,y]) => [...ctx.getImageData(x,y,1,1).data]);
  });
  for (const p of px) {
    expect(p[3]).toBeGreaterThan(200); // opaque everywhere — fully covered
    expect(p[0]).toBeGreaterThan(200); // red
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/placement-render.spec.js`
Expected: The Task-4 `image-1` test and this cover test FAIL — `paintLayer` still stretches with `drawImage(img, 0, 0, w*dpr, h*dpr)`.

- [ ] **Step 3: Write minimal implementation**

Update imports at `src/layers.js:1-3`:

```js
import { wrapWithTheme } from './theme-bridge.js';
import { resolveAnchor, parseLength, resolveImageBoxCss, imageDrawArgs, textWrapperStyle } from './placement.js';
```

Replace the **image branch** inside `paintLayer` (the `if (layer.kind === 'image') { ... }` block, currently ending with `ctx.drawImage(img, 0, 0, width * dpr, height * dpr);`) with:

```js
    if (layer.kind === 'image') {
      const img = layer.node;
      if (!img.complete) {
        await new Promise((res, rej) => {
          img.addEventListener('load', res, { once: true });
          img.addEventListener('error', () => rej(new Error(`image load failed: ${img.src}`)), { once: true });
        });
      }
      if (img.naturalWidth === 0) {
        throw new Error(`image load failed: ${img.src}`);
      }
      try {
        await img.decode();
      } catch {
        /* tolerated — load/error above is the source of truth */
      }

      const canvasW = width * dpr;
      const canvasH = height * dpr;
      const fit = layer.fit || (layer.isBackground ? 'cover' : 'contain');

      let boxW, boxH;
      if (layer.isBackground) {
        boxW = canvasW;
        boxH = canvasH;
      } else {
        const attrW = numAttr(img, 'width');
        const attrH = numAttr(img, 'height');
        const box = resolveImageBoxCss({ natW: img.naturalWidth, natH: img.naturalHeight, attrW, attrH });
        boxW = box.w * dpr;
        boxH = box.h * dpr;
      }

      const { ax, ay } = resolveAnchor(layer.place);
      const offX = parseLength(layer.offsetX, width) * dpr;
      const offY = parseLength(layer.offsetY, height) * dpr;
      const a = imageDrawArgs({
        natW: img.naturalWidth, natH: img.naturalHeight,
        boxW, boxH, fit, ax, ay, offsetX: offX, offsetY: offY, canvasW, canvasH,
      });
      ctx.drawImage(img, a.sx, a.sy, a.sw, a.sh, a.dx, a.dy, a.dw, a.dh);
    } else {
```

Add this helper at the bottom of `src/layers.js` (module scope):

```js
function numAttr(node, name) {
  const v = node.getAttribute(name);
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/placement-render.spec.js test/layers.spec.js`
Expected: PASS — the `image-1`, `cover`, and all existing layer tests pass. (Existing `layers.spec.js` background tests use a square fixture in a square canvas, so cover == identity; they still pass.)

- [ ] **Step 5: Commit**

```bash
git add src/layers.js test/placement-render.spec.js
git commit -m "feat(layers): place image layers with anchor/offset/fit"
```

---

### Task 6: Paint text layers with placement wrapper

**Files:**
- Modify: `src/layers.js:73-86` (`paintLayer` text branch)
- Test: `test/placement-render.spec.js`

- [ ] **Step 1: Write the failing test**

```js
// append to test/placement-render.spec.js
test('text place=bottom puts ink near the bottom, not the top', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const r = await page.evaluate(async () => {
    const el = document.createElement('canvas-text');
    el.setAttribute('width', '300');
    el.setAttribute('height', '300');
    el.innerHTML = `<div slot="text-1" place="bottom" style="font-size:48px;font-weight:bold;color:black">FOOT</div>`;
    document.getElementById('harness').appendChild(el);
    await new Promise((res) => el.addEventListener('canvas-text:rendered', res, { once: true }));
    const c = el.getCanvas();
    const ctx = c.getContext('2d');
    const countInk = (y0, y1) => {
      const d = ctx.getImageData(0, y0, c.width, y1 - y0).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
      return n;
    };
    return { top: countInk(0, c.height * 0.4 | 0), bottom: countInk(c.height * 0.6 | 0, c.height) };
  });
  expect(r.bottom).toBeGreaterThan(r.top * 3); // ink concentrated at the bottom
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/placement-render.spec.js`
Expected: FAIL — text renders in normal flow (top), so `r.top` ≈ `r.bottom` or top dominates.

- [ ] **Step 3: Write minimal implementation**

Replace the **text branch** (`else { ... }`) inside `paintLayer` with:

```js
    } else {
      let themed = wrapWithTheme(layer.node.outerHTML, host, themeMode, layer.node);
      if (layer.presetStyle) {
        // Preset owns typography; skip the theme wrapper to avoid fighting stroke.
        themed = `<div style="${layer.presetStyle}">${layer.node.outerHTML}</div>`;
      }
      const placed = layer.place != null || layer.offsetX != null || layer.offsetY != null || layer.presetStyle;
      let html = themed;
      if (placed) {
        const { ax, ay } = resolveAnchor(layer.place);
        const ox = parseLength(layer.offsetX, width);
        const oy = parseLength(layer.offsetY, height);
        html = `<div style="${textWrapperStyle({ ax, ay, offsetX: ox, offsetY: oy })}">${themed}</div>`;
      }
      const result = renderTag.render({ html, width, height, pixelRatio: dpr, accuracy: opts.accuracy });
      ctx.drawImage(result.canvas, 0, 0);
    }
```

Note: `layer.presetStyle` is `undefined` until Task 8 sets it; the `placed` guard treats `undefined` as falsy, so this is forward-compatible.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/placement-render.spec.js test/layers.spec.js test/render.spec.js test/theme.spec.js`
Expected: PASS — placement works; existing text/theme tests (which set no `place`) are unaffected because the `placed` guard leaves their path identical to v0.1.

- [ ] **Step 5: Commit**

```bash
git add src/layers.js test/placement-render.spec.js
git commit -m "feat(layers): place text layers via full-width wrapper"
```

---

### Task 7: Observe new attributes for reactivity

**Files:**
- Modify: `src/canvas-text.js:5` (`OBSERVED`), `src/canvas-text.js:61` (MutationObserver `attributeFilter`)
- Test: `test/placement-render.spec.js`

- [ ] **Step 1: Write the failing test**

```js
// append to test/placement-render.spec.js
test('mutating a layer place attribute re-renders', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const r = await page.evaluate(async () => {
    const el = document.createElement('canvas-text');
    el.setAttribute('width', '300');
    el.setAttribute('height', '300');
    el.innerHTML = `<div slot="text-1" place="top" style="font-size:48px;font-weight:bold;color:black">X</div>`;
    document.getElementById('harness').appendChild(el);
    await new Promise((res) => el.addEventListener('canvas-text:rendered', res, { once: true }));

    const layer = el.querySelector('[slot="text-1"]');
    layer.setAttribute('place', 'bottom');
    await new Promise((res) => el.addEventListener('canvas-text:rendered', res, { once: true }));

    const c = el.getCanvas();
    const ctx = c.getContext('2d');
    const countInk = (y0, y1) => {
      const d = ctx.getImageData(0, y0, c.width, y1 - y0).data;
      let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n;
    };
    return { top: countInk(0, c.height * 0.4 | 0), bottom: countInk(c.height * 0.6 | 0, c.height) };
  });
  expect(r.bottom).toBeGreaterThan(r.top * 3); // re-rendered at the new (bottom) position
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/placement-render.spec.js`
Expected: FAIL — `place`/`offset-*`/`fit` are not in the MutationObserver `attributeFilter`, so changing `place` does not trigger a re-render and the second `rendered` event never fires (test times out / asserts wrong position).

- [ ] **Step 3: Write minimal implementation**

At `src/canvas-text.js:5` add `preset` to host observed attributes:

```js
const OBSERVED = ['width', 'height', 'theme', 'lang', 'accuracy', 'dpr', 'format', 'compose', 'alt', 'preset'];
```

At `src/canvas-text.js:61` extend the child attribute filter:

```js
      attributeFilter: ['src', 'slot', 'style', 'class', 'srcset', 'crossorigin', 'place', 'offset-x', 'offset-y', 'fit', 'width', 'height'],
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/placement-render.spec.js test/reactivity.spec.js`
Expected: PASS — placement mutations re-render; existing reactivity tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/canvas-text.js test/placement-render.spec.js
git commit -m "feat(canvas-text): observe preset and per-layer placement attributes"
```

---

## Phase 2 — Presets

### Task 8: Presets module + `meme` preset + element integration

**Files:**
- Create: `src/presets.js`
- Modify: `src/canvas-text.js:210-212` (layer-collection call site in `render`)
- Test: `test/presets.spec.js`

`applyPresetToLayers` fills only the placement fields the author left `null`/absent, and sets `presetStyle` (a CSS string) on text layers so paint skips the theme wrapper. It never mutates author DOM.

- [ ] **Step 1: Write the failing test**

```js
// test/presets.spec.js
import { test, expect } from '@playwright/test';

test('applyPresetToLayers(meme) fills text placement and stroke, respects author overrides', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const r = await page.evaluate(async () => {
    const { applyPresetToLayers } = await import('/src/presets.js');
    const layers = [
      { slot: 'background', kind: 'image', isBackground: true, place: null, offsetX: null, offsetY: null, fit: null },
      { slot: 'text-1', kind: 'text', place: null, offsetX: null, offsetY: null, fit: null },
      { slot: 'text-2', kind: 'text', place: 'center', offsetX: null, offsetY: null, fit: null }, // author override
    ];
    applyPresetToLayers('meme', layers, { width: 500, height: 500 });
    return layers;
  });
  expect(r[0].fit).toBe('cover');               // background default
  expect(r[1].place).toBe('top');               // text-1 -> top
  expect(r[1].presetStyle).toContain('-webkit-text-stroke');
  expect(r[1].presetStyle).toContain('text-transform:uppercase');
  expect(r[2].place).toBe('center');            // author override preserved
  expect(r[2].presetStyle).toContain('-webkit-text-stroke'); // typography still applied
});

test('meme preset renders white-on-stroke text top and bottom', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const r = await page.evaluate(async () => {
    const el = document.createElement('canvas-text');
    el.setAttribute('preset', 'meme');
    el.setAttribute('width', '300');
    el.setAttribute('height', '300');
    el.innerHTML = `
      <img slot="background" src="/test/fixtures/blue-square.png" crossorigin="anonymous">
      <span slot="text-1">TOP</span>
      <span slot="text-2">BOTTOM</span>`;
    document.getElementById('harness').appendChild(el);
    await new Promise((res) => el.addEventListener('canvas-text:rendered', res, { once: true }));
    const c = el.getCanvas();
    const ctx = c.getContext('2d');
    const hasWhite = (y0, y1) => {
      const d = ctx.getImageData(0, y0, c.width, y1 - y0).data;
      for (let i = 0; i < d.length; i += 4) if (d[i] > 230 && d[i+1] > 230 && d[i+2] > 230 && d[i+3] > 0) return true;
      return false;
    };
    return { top: hasWhite(0, c.height * 0.35 | 0), bottom: hasWhite(c.height * 0.65 | 0, c.height) };
  });
  expect(r.top).toBe(true);
  expect(r.bottom).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/presets.spec.js`
Expected: FAIL — `applyPresetToLayers is not a function`; second test renders default black text in normal flow (no white at top+bottom).

- [ ] **Step 3: Write minimal implementation**

```js
// src/presets.js

// Presets fill only the placement fields the author left null, and set
// `presetStyle` on text layers (CSS string) so paint skips the theme wrapper.
// Author-set attributes always win.

const MEME_TEXT_STYLE =
  "font-family:Impact,'Anton',Haettenschweiler,Arial Narrow,sans-serif;" +
  'font-weight:900;color:#fff;-webkit-text-stroke:2px #000;' +
  'text-transform:uppercase;line-height:1.05;';

function fill(layer, field, value) {
  if (layer[field] == null) layer[field] = value;
}

function texts(layers) {
  return layers.filter((l) => l.kind === 'text' && l.slot !== '(default)');
}
function images(layers) {
  return layers.filter((l) => l.kind === 'image' && !l.isBackground);
}
function background(layers) {
  return layers.find((l) => l.kind === 'image' && l.isBackground);
}
function bySlotIndex(list) {
  return [...list].sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
}

export function applyPresetToLayers(name, layers, ctx) {
  if (name === 'meme') return applyMeme(layers);
  if (name === 'badge') return applyBadge(layers, ctx);
  if (name === 'banner') return applyBanner(layers, ctx);
  if (name === 'caption') return applyCaption(layers);
  // unknown preset: no-op (forward compatible)
}

function applyMeme(layers) {
  const bg = background(layers);
  if (bg) fill(bg, 'fit', 'cover');
  const ts = bySlotIndex(texts(layers));
  ts.forEach((t, i) => {
    if (i === 0) { fill(t, 'place', 'top'); fill(t, 'offsetY', '16'); }
    else if (i === 1) { fill(t, 'place', 'bottom'); fill(t, 'offsetY', '-16'); }
    else { fill(t, 'place', 'center'); }
    t.presetStyle = (t.presetStyle || '') + MEME_TEXT_STYLE;
  });
}

// applyBadge, applyBanner, applyCaption are added in later tasks.
function applyBadge() {}
function applyBanner() {}
function applyCaption() {}
```

In `src/canvas-text.js`, import presets at the top (after the existing imports near line 3):

```js
import { applyPresetToLayers } from './presets.js';
```

In `render()`, replace the layer-pipeline collection line (`const layers = collectLayers(this, this.#canvas);` ≈ `src/canvas-text.js:212`) with:

```js
      const layers = collectLayers(this, this.#canvas);
      const preset = this.getAttribute('preset');
      if (preset) applyPresetToLayers(preset, layers, { width, height });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/presets.spec.js`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add src/presets.js src/canvas-text.js test/presets.spec.js
git commit -m "feat(presets): presets module and meme preset"
```

---

### Task 9: Auto-row layout + `badge` preset

**Files:**
- Modify: `src/presets.js`
- Test: `test/presets.spec.js`

- [ ] **Step 1: Write the failing test**

```js
// append to test/presets.spec.js
test('autoRow centers N items with gap and assigns place=bottom-center + offsets', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const r = await page.evaluate(async () => {
    const { autoRow } = await import('/src/presets.js');
    const items = [{}, {}, {}];
    autoRow(items, { itemW: 72, gap: 16, offsetY: -40 });
    return items.map((it) => ({ place: it.place, ox: Number(it.offsetX), oy: Number(it.offsetY), w: it.fit }));
  });
  // 3 items, span = 3*72 + 2*16 = 248; centers at -88, 0, +88
  expect(r[0].place).toBe('bottom-center');
  expect(r[0].ox).toBeCloseTo(-88);
  expect(r[1].ox).toBeCloseTo(0);
  expect(r[2].ox).toBeCloseTo(88);
  expect(r.every((it) => it.oy === -40)).toBe(true);
});

test('badge preset: avatar centered top, name+title stacked, badges row at bottom', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const r = await page.evaluate(async () => {
    const el = document.createElement('canvas-text');
    el.setAttribute('preset', 'badge');
    el.setAttribute('width', '300');
    el.setAttribute('height', '300');
    el.innerHTML = `
      <img slot="image-1" src="/test/fixtures/red-square.png" crossorigin="anonymous" width="64" height="64">
      <span slot="text-1" style="color:black;font-size:24px;font-weight:bold">Prof</span>
      <img slot="image-2" src="/test/fixtures/blue-square.png" crossorigin="anonymous" width="40" height="40">
      <img slot="image-3" src="/test/fixtures/blue-square.png" crossorigin="anonymous" width="40" height="40">
      <img slot="image-4" src="/test/fixtures/blue-square.png" crossorigin="anonymous" width="40" height="40">`;
    document.getElementById('harness').appendChild(el);
    await new Promise((res) => el.addEventListener('canvas-text:rendered', res, { once: true }));
    const c = el.getCanvas();
    const ctx = c.getContext('2d');
    const dpr = c.width / 300;
    // three blue clusters along the bottom band => sample three x positions near the bottom
    const sampleBlue = (xFrac) => {
      const d = ctx.getImageData((c.width * xFrac) | 0, (c.height * 0.82) | 0, 1, 1).data;
      return d[2] > 150 && d[0] < 100;
    };
    const avatarRed = () => {
      const d = ctx.getImageData((c.width * 0.5) | 0, (c.height * 0.18) | 0, 1, 1).data;
      return d[0] > 150 && d[2] < 100;
    };
    return { left: sampleBlue(0.28), mid: sampleBlue(0.5), right: sampleBlue(0.72), avatar: avatarRed() };
  });
  expect(r.avatar).toBe(true);
  expect(r.left).toBe(true);
  expect(r.mid).toBe(true);
  expect(r.right).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/presets.spec.js`
Expected: FAIL — `autoRow is not a function`; `applyBadge` is a no-op so nothing is placed.

- [ ] **Step 3: Write minimal implementation**

Replace the placeholder `applyBadge` and add `autoRow` in `src/presets.js`:

```js
// Distribute items left-to-right, centered horizontally, anchored bottom-center.
export function autoRow(items, { itemW, gap, offsetY }) {
  const n = items.length;
  if (!n) return;
  const span = n * itemW + (n - 1) * gap;
  const start = -span / 2 + itemW / 2; // center x of first item, relative to canvas center
  items.forEach((it, i) => {
    fill(it, 'place', 'bottom-center');
    fill(it, 'offsetX', String(start + i * (itemW + gap)));
    fill(it, 'offsetY', String(offsetY));
    fill(it, 'fit', 'contain');
  });
}

function applyBadge(layers, ctx) {
  const h = ctx.height;
  const imgs = bySlotIndex(images(layers));
  const ts = bySlotIndex(texts(layers));
  const [avatar, ...badges] = imgs;
  if (avatar) {
    fill(avatar, 'place', 'top-center');
    fill(avatar, 'offsetY', String(Math.round(h * 0.12)));
  }
  // name then title stacked below the avatar
  if (ts[0]) { fill(ts[0], 'place', 'top-center'); fill(ts[0], 'offsetY', String(Math.round(h * 0.42))); }
  if (ts[1]) { fill(ts[1], 'place', 'top-center'); fill(ts[1], 'offsetY', String(Math.round(h * 0.54))); }
  autoRow(badges, { itemW: 44, gap: 16, offsetY: -Math.round(h * 0.08) });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/presets.spec.js`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add src/presets.js test/presets.spec.js
git commit -m "feat(presets): auto-row layout and badge preset"
```

---

### Task 10: `banner` preset

**Files:**
- Modify: `src/presets.js`
- Test: `test/presets.spec.js`

- [ ] **Step 1: Write the failing test**

```js
// append to test/presets.spec.js
test('banner preset: name at top, badge row along the bottom, background covered', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const r = await page.evaluate(async () => {
    const el = document.createElement('canvas-text');
    el.setAttribute('preset', 'banner');
    el.setAttribute('width', '300');
    el.setAttribute('height', '300');
    el.innerHTML = `
      <img slot="background" src="/test/fixtures/red-square.png" crossorigin="anonymous">
      <span slot="text-1" style="color:white;font-size:28px;font-weight:bold">ProfPowell</span>
      <img slot="image-1" src="/test/fixtures/blue-square.png" crossorigin="anonymous" width="48" height="48">
      <img slot="image-2" src="/test/fixtures/blue-square.png" crossorigin="anonymous" width="48" height="48">
      <img slot="image-3" src="/test/fixtures/blue-square.png" crossorigin="anonymous" width="48" height="48">`;
    document.getElementById('harness').appendChild(el);
    await new Promise((res) => el.addEventListener('canvas-text:rendered', res, { once: true }));
    const c = el.getCanvas();
    const ctx = c.getContext('2d');
    const sampleBlue = (xFrac) => {
      const d = ctx.getImageData((c.width * xFrac) | 0, (c.height * 0.85) | 0, 1, 1).data;
      return d[2] > 150 && d[0] < 100;
    };
    const nameWhite = () => {
      const d = ctx.getImageData(0, 0, c.width, (c.height * 0.3) | 0).data;
      for (let i = 0; i < d.length; i += 4) if (d[i] > 230 && d[i+1] > 230 && d[i+2] > 230 && d[i+3] > 0) return true;
      return false;
    };
    return { left: sampleBlue(0.28), mid: sampleBlue(0.5), right: sampleBlue(0.72), name: nameWhite() };
  });
  expect(r.name).toBe(true);
  expect(r.left).toBe(true);
  expect(r.mid).toBe(true);
  expect(r.right).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/presets.spec.js`
Expected: FAIL — `applyBanner` is a no-op; name renders top-left in normal flow and badges are unplaced (default center, overlapping).

- [ ] **Step 3: Write minimal implementation**

Replace the placeholder `applyBanner` in `src/presets.js`:

```js
function applyBanner(layers, ctx) {
  const h = ctx.height;
  const bg = background(layers);
  if (bg) fill(bg, 'fit', 'cover');
  const ts = bySlotIndex(texts(layers));
  if (ts[0]) { fill(ts[0], 'place', 'top'); fill(ts[0], 'offsetY', String(Math.round(h * 0.12))); }
  autoRow(bySlotIndex(images(layers)), { itemW: 56, gap: 18, offsetY: -Math.round(h * 0.1) });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/presets.spec.js`
Expected: PASS (5 passed).

- [ ] **Step 5: Commit**

```bash
git add src/presets.js test/presets.spec.js
git commit -m "feat(presets): banner preset"
```

---

### Task 11: `caption` preset + `<figure>` collection

**Files:**
- Modify: `src/presets.js` (`applyCaption` + `captionLayers`), `src/canvas-text.js` (route caption collection)
- Test: `test/presets.spec.js`

The caption preset reads a semantic `<figure><img><figcaption>…</figcaption></figure>` and synthesizes: a `background` image layer (the `<img>`) + a bottom full-width text band (the `<figcaption>`). The band's background is the `<figcaption>`'s own `background-color`.

- [ ] **Step 1: Write the failing test**

```js
// append to test/presets.spec.js
test('caption preset flattens figure: image fills, figcaption is a bottom band', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const r = await page.evaluate(async () => {
    const el = document.createElement('canvas-text');
    el.setAttribute('preset', 'caption');
    el.setAttribute('width', '300');
    el.setAttribute('height', '300');
    el.innerHTML = `
      <figure>
        <img src="/test/fixtures/red-square.png" crossorigin="anonymous">
        <figcaption style="background:rgba(0,0,0,0.6);color:white;font-size:24px;padding:8px">Hello</figcaption>
      </figure>`;
    document.getElementById('harness').appendChild(el);
    await new Promise((res) => el.addEventListener('canvas-text:rendered', res, { once: true }));
    const c = el.getCanvas();
    const ctx = c.getContext('2d');
    // top half = red background visible
    const top = ctx.getImageData((c.width*0.5)|0, (c.height*0.2)|0, 1, 1).data;
    // bottom band = dark strip (caption background over red) spanning full width
    const bandLeft = ctx.getImageData(4, (c.height*0.92)|0, 1, 1).data;
    const bandRight = ctx.getImageData(c.width-5, (c.height*0.92)|0, 1, 1).data;
    return {
      topRed: top[0] > 150 && top[2] < 100,
      bandDarkLeft: bandLeft[0] < 160 && bandLeft[3] > 200,
      bandDarkRight: bandRight[0] < 160 && bandRight[3] > 200,
    };
  });
  expect(r.topRed).toBe(true);
  expect(r.bandDarkLeft).toBe(true);   // band spans full width
  expect(r.bandDarkRight).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/presets.spec.js`
Expected: FAIL — the `<figure>` is unslotted, so v0.1 collection renders it as one top-anchored text layer (image not used as background, no bottom band).

- [ ] **Step 3: Write minimal implementation**

Add to `src/presets.js`:

```js
// Synthesize layers for preset="caption" from a semantic <figure>.
// Returns null if no usable figure is found (caller falls back to normal collection).
export function captionLayers(host, internalCanvas) {
  const figure = host.querySelector('figure');
  if (!figure) return null;
  const img = figure.querySelector('img');
  const cap = figure.querySelector('figcaption');
  const layers = [];
  if (img) {
    layers.push({ slot: 'background', z: 0, kind: 'image', isBackground: true, node: img, place: null, offsetX: null, offsetY: null, fit: 'cover' });
  }
  if (cap) {
    layers.push({ slot: 'text-1', z: 1, kind: 'text', node: cap, place: 'bottom', offsetX: null, offsetY: null, fit: null, presetStyle: 'display:block;' });
  }
  return layers;
}
```

Replace the placeholder `applyCaption` (kept as a no-op; caption uses `captionLayers` instead, so defaulting is already done there):

```js
function applyCaption() { /* handled by captionLayers synthesis */ }
```

In `src/canvas-text.js` `render()`, update the collection block so caption routes through synthesis. Replace the lines added in Task 8 with:

```js
      const preset = this.getAttribute('preset');
      let layers;
      if (preset === 'caption') {
        layers = (await import('./presets.js')).captionLayers(this, this.#canvas)
          || collectLayers(this, this.#canvas);
      } else {
        layers = collectLayers(this, this.#canvas);
        if (preset) applyPresetToLayers(preset, layers, { width, height });
      }
```

(The `applyPresetToLayers` import added in Task 8 stays; `captionLayers` is loaded via the existing dynamic-friendly path. If you prefer a static import, add `captionLayers` to the Task-8 import line instead: `import { applyPresetToLayers, captionLayers } from './presets.js';` and use it directly.)

For clarity and to avoid an async import inside render, use the **static import** form. Update the Task-8 import line in `src/canvas-text.js` to:

```js
import { applyPresetToLayers, captionLayers } from './presets.js';
```

and the collection block to:

```js
      const preset = this.getAttribute('preset');
      let layers;
      if (preset === 'caption') {
        layers = captionLayers(this, this.#canvas) || collectLayers(this, this.#canvas);
      } else {
        layers = collectLayers(this, this.#canvas);
        if (preset) applyPresetToLayers(preset, layers, { width, height });
      }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/presets.spec.js test/layers.spec.js`
Expected: PASS — caption flattens; other presets and v0.1 collection unaffected.

- [ ] **Step 5: Commit**

```bash
git add src/presets.js src/canvas-text.js test/presets.spec.js
git commit -m "feat(presets): caption preset flattens semantic figure into a band"
```

---

## Phase 3 — Fonts

### Task 12: Await `document.fonts.ready` before drawing

**Files:**
- Modify: `src/canvas-text.js:173-175` (after the existing microtask yield in `render`)
- Test: `test/fonts.spec.js`

- [ ] **Step 1: Write the failing test**

```js
// test/fonts.spec.js
import { test, expect } from '@playwright/test';

test('render waits for a deferred webfont so text uses it, not the fallback', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const differs = await page.evaluate(async () => {
    // A wide custom font loaded from a data URL, registered but intentionally
    // added just before render so the fallback race would otherwise trigger.
    async function renderWith(useFont) {
      const el = document.createElement('canvas-text');
      el.setAttribute('width', '300');
      el.setAttribute('height', '120');
      const fam = useFont ? 'CTWide, monospace' : 'monospace';
      el.innerHTML = `<div slot="text-1" place="center" style="font-size:40px;color:black;font-family:${fam}">WIDETEXT</div>`;
      document.getElementById('harness').appendChild(el);
      await new Promise((res) => el.addEventListener('canvas-text:rendered', res, { once: true }));
      const c = el.getCanvas();
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let ink = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) ink++;
      document.getElementById('harness').removeChild(el);
      return ink;
    }
    // Register a custom font that is clearly different in coverage from monospace.
    const ff = new FontFace('CTWide', 'local("Arial Black"), local("Impact"), local("Georgia")');
    document.fonts.add(ff);
    await ff.load().catch(() => {});
    const withFont = await renderWith(true);
    const baseline = await renderWith(false);
    // The two renders should differ in ink coverage if the custom font was applied
    // (i.e. fonts were ready at draw time). Allow equality to fail the test.
    return Math.abs(withFont - baseline);
  });
  expect(differs).toBeGreaterThan(0);
});

test('render still completes when document.fonts is unavailable (guard)', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const ok = await page.evaluate(async () => {
    const saved = document.fonts;
    try {
      Object.defineProperty(document, 'fonts', { value: undefined, configurable: true });
      const el = document.createElement('canvas-text');
      el.setAttribute('width', '200');
      el.innerHTML = `<div slot="text-1" place="center" style="color:black;font-size:24px">OK</div>`;
      document.getElementById('harness').appendChild(el);
      await new Promise((res) => el.addEventListener('canvas-text:rendered', res, { once: true }));
      return true;
    } finally {
      Object.defineProperty(document, 'fonts', { value: saved, configurable: true });
    }
  });
  expect(ok).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/fonts.spec.js`
Expected: The guard test may already pass; the first test is the meaningful one. Before the change, font readiness is not awaited — run to establish current behavior. If the first test passes by luck (font already cached), proceed; the implementation makes it deterministic.

- [ ] **Step 3: Write minimal implementation**

In `src/canvas-text.js` `render()`, immediately after the existing microtask yield and token check (`await Promise.resolve(); if (token !== this.#renderToken) return;` near line 173-174), add:

```js
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
      await document.fonts.ready;
      if (token !== this.#renderToken) return;
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/fonts.spec.js`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add src/canvas-text.js test/fonts.spec.js
git commit -m "fix(canvas-text): await document.fonts.ready before drawing"
```

---

## Phase 4 — Demos, docs, release

### Task 13: Demo pages + smoke tests

**Files:**
- Create: `docs/meme.html`, `docs/badge.html`, `docs/banner.html`, `docs/og-card.html`, `docs/caption.html`
- Test: `test/demos.spec.js`

Each demo imports the built component from the existing `docs/dist` symlink (so the docs site and tests share one path) and exposes a Download button via `toBlob`. Keep each page focused.

- [ ] **Step 1: Write the failing smoke test**

```js
// test/demos.spec.js
import { test, expect } from '@playwright/test';

const PAGES = ['meme', 'badge', 'banner', 'og-card', 'caption'];

for (const name of PAGES) {
  test(`${name} demo renders a non-blank canvas`, async ({ page }) => {
    await page.goto(`/docs/${name}.html`);
    const ink = await page.evaluate(async () => {
      const el = document.querySelector('canvas-text');
      if (!el) return -1;
      // wait for first render
      await new Promise((res) => {
        if (el.hasAttribute('data-upgraded')) return res();
        el.addEventListener('canvas-text:rendered', res, { once: true });
      });
      const c = el.getCanvas();
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
      return n;
    });
    expect(ink).toBeGreaterThan(0);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/demos.spec.js`
Expected: FAIL — demo pages 404 / `el` is null.

- [ ] **Step 3: Build the library and write the demo pages**

First ensure the component is built (the demos load `./dist/canvas-text.js` via the `docs/dist` symlink):

```bash
npm run build
```

Create `docs/meme.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>canvas-text — Meme generator</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&display=swap">
  <script type="importmap">
    { "imports": { "render-tag": "../node_modules/render-tag/lib/index.js" } }
  </script>
  <script type="module" src="./dist/canvas-text.js"></script>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 640px; margin: 2rem auto; padding: 0 1rem; }
    canvas-text { border: 1px solid #ccc; }
    label { display:block; margin:.5rem 0; }
    input[type=text] { width:100%; padding:.4rem; }
  </style>
</head>
<body>
  <h1>Meme generator</h1>
  <canvas-text preset="meme" width="500" height="500" style="font-family:Anton">
    <img slot="background" src="https://picsum.photos/seed/canvastext/500/500" crossorigin="anonymous" fit="cover">
    <span slot="text-1" id="top">WHEN THE CODE</span>
    <span slot="text-2" id="bot">COMPILES FIRST TRY</span>
  </canvas-text>
  <label>Top text <input type="text" id="topInput" value="WHEN THE CODE"></label>
  <label>Bottom text <input type="text" id="botInput" value="COMPILES FIRST TRY"></label>
  <button id="dl">Download PNG</button>
  <script type="module">
    const el = document.querySelector('canvas-text');
    document.getElementById('topInput').addEventListener('input', (e) => { document.getElementById('top').textContent = e.target.value; });
    document.getElementById('botInput').addEventListener('input', (e) => { document.getElementById('bot').textContent = e.target.value; });
    document.getElementById('dl').addEventListener('click', async () => {
      const blob = await el.toBlob('image/png');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'meme.png'; a.click();
      URL.revokeObjectURL(a.href);
    });
  </script>
</body>
</html>
```

Create `docs/badge.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>canvas-text — User badge</title>
  <script type="importmap">
    { "imports": { "render-tag": "../node_modules/render-tag/lib/index.js" } }
  </script>
  <script type="module" src="./dist/canvas-text.js"></script>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 640px; margin: 2rem auto; padding: 0 1rem; }
    canvas-text { border: 1px solid #ccc; }
  </style>
</head>
<body>
  <h1>User badge / profile card</h1>
  <canvas-text preset="badge" width="320" height="320">
    <img slot="background" src="https://picsum.photos/seed/badgebg/320/320" crossorigin="anonymous" fit="cover">
    <img slot="image-1" src="https://i.pravatar.cc/128?img=12" crossorigin="anonymous" width="96" height="96">
    <span slot="text-1" style="color:#fff;font-size:26px;font-weight:800;-webkit-text-stroke:1px #000">Prof Powell</span>
    <span slot="text-2" style="color:#fde68a;font-size:14px;font-weight:600">LEVEL 42 · WEB WIZARD</span>
    <img slot="image-2" src="https://picsum.photos/seed/b1/64/64" crossorigin="anonymous" width="44" height="44">
    <img slot="image-3" src="https://picsum.photos/seed/b2/64/64" crossorigin="anonymous" width="44" height="44">
    <img slot="image-4" src="https://picsum.photos/seed/b3/64/64" crossorigin="anonymous" width="44" height="44">
  </canvas-text>
  <button id="dl">Download PNG</button>
  <script type="module">
    const el = document.querySelector('canvas-text');
    document.getElementById('dl').addEventListener('click', async () => {
      const blob = await el.toBlob('image/png');
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'badge.png'; a.click(); URL.revokeObjectURL(a.href);
    });
  </script>
</body>
</html>
```

Create `docs/banner.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>canvas-text — Game banner</title>
  <script type="importmap">
    { "imports": { "render-tag": "../node_modules/render-tag/lib/index.js" } }
  </script>
  <script type="module" src="./dist/canvas-text.js"></script>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; }
    canvas-text { border: 1px solid #ccc; }
    .tray img { width:48px; height:48px; margin:4px; cursor:pointer; border:2px solid transparent; }
    .tray img.sel { border-color:#7c3aed; }
  </style>
</head>
<body>
  <h1>Game banner builder</h1>
  <canvas-text preset="banner" width="480" height="270">
    <img slot="background" src="https://picsum.photos/seed/bannerbg/480/270" crossorigin="anonymous" fit="cover">
    <span slot="text-1" style="color:#fde68a;font-size:30px;font-weight:800;-webkit-text-stroke:1px #000">ProfPowell</span>
    <img slot="image-1" id="s1" src="https://picsum.photos/seed/x1/64/64" crossorigin="anonymous" width="56" height="56">
    <img slot="image-2" id="s2" src="https://picsum.photos/seed/x2/64/64" crossorigin="anonymous" width="56" height="56">
    <img slot="image-3" id="s3" src="https://picsum.photos/seed/x3/64/64" crossorigin="anonymous" width="56" height="56">
  </canvas-text>
  <p>Pick badges (updates the three slots):</p>
  <div class="tray" id="tray">
    <img data-seed="a1" src="https://picsum.photos/seed/a1/64/64" crossorigin="anonymous">
    <img data-seed="a2" src="https://picsum.photos/seed/a2/64/64" crossorigin="anonymous">
    <img data-seed="a3" src="https://picsum.photos/seed/a3/64/64" crossorigin="anonymous">
    <img data-seed="a4" src="https://picsum.photos/seed/a4/64/64" crossorigin="anonymous">
    <img data-seed="a5" src="https://picsum.photos/seed/a5/64/64" crossorigin="anonymous">
  </div>
  <button id="dl">Download PNG</button>
  <script type="module">
    const el = document.querySelector('canvas-text');
    const slots = ['s1','s2','s3'].map((id) => document.getElementById(id));
    let picks = [];
    document.getElementById('tray').addEventListener('click', (e) => {
      const img = e.target.closest('img'); if (!img) return;
      const seed = img.dataset.seed;
      const i = picks.indexOf(seed);
      if (i >= 0) picks.splice(i, 1); else if (picks.length < 3) picks.push(seed);
      [...document.querySelectorAll('.tray img')].forEach((t) => t.classList.toggle('sel', picks.includes(t.dataset.seed)));
      slots.forEach((s, idx) => { if (picks[idx]) s.src = `https://picsum.photos/seed/${picks[idx]}/64/64`; });
    });
    document.getElementById('dl').addEventListener('click', async () => {
      const blob = await el.toBlob('image/png');
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'banner.png'; a.click(); URL.revokeObjectURL(a.href);
    });
  </script>
</body>
</html>
```

Create `docs/og-card.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>canvas-text — OG / share card</title>
  <script type="importmap">
    { "imports": { "render-tag": "../node_modules/render-tag/lib/index.js" } }
  </script>
  <script type="module" src="./dist/canvas-text.js"></script>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; }
    canvas-text { border: 1px solid #ccc; max-width:100%; }
    label { display:block; margin:.5rem 0; } input { width:100%; padding:.4rem; }
  </style>
</head>
<body>
  <h1>OG / social share card</h1>
  <canvas-text width="600" height="315">
    <img slot="background" src="https://picsum.photos/seed/ogbg/600/315" crossorigin="anonymous" fit="cover">
    <div slot="text-1" place="center-left" offset-x="40" offset-y="-20" id="title"
         style="color:#fff;font-size:40px;font-weight:800;-webkit-text-stroke:1px #000;text-align:left">Shipping canvas-text 0.2</div>
    <div slot="text-2" place="center-left" offset-x="40" offset-y="40" id="sub"
         style="color:#e5e7eb;font-size:20px;text-align:left">Placement, presets &amp; fonts</div>
  </canvas-text>
  <label>Title <input type="text" id="titleInput" value="Shipping canvas-text 0.2"></label>
  <label>Subtitle <input type="text" id="subInput" value="Placement, presets & fonts"></label>
  <button id="dl">Download PNG</button>
  <script type="module">
    const el = document.querySelector('canvas-text');
    document.getElementById('titleInput').addEventListener('input', (e) => { document.getElementById('title').textContent = e.target.value; });
    document.getElementById('subInput').addEventListener('input', (e) => { document.getElementById('sub').textContent = e.target.value; });
    document.getElementById('dl').addEventListener('click', async () => {
      const blob = await el.toBlob('image/png');
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'og-card.png'; a.click(); URL.revokeObjectURL(a.href);
    });
  </script>
</body>
</html>
```

Create `docs/caption.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>canvas-text — Caption / figure flattener</title>
  <script type="importmap">
    { "imports": { "render-tag": "../node_modules/render-tag/lib/index.js" } }
  </script>
  <script type="module" src="./dist/canvas-text.js"></script>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 640px; margin: 2rem auto; padding: 0 1rem; }
    canvas-text { border: 1px solid #ccc; }
    label { display:block; margin:.5rem 0; } input { width:100%; padding:.4rem; }
  </style>
</head>
<body>
  <h1>Caption / figure flattener</h1>
  <canvas-text preset="caption" width="500" height="333">
    <figure>
      <img src="https://picsum.photos/seed/capbg/500/333" crossorigin="anonymous">
      <figcaption id="cap" style="background:rgba(0,0,0,0.55);color:#fff;font-size:22px;padding:10px;text-align:center">A captioned figure, flattened to one image</figcaption>
    </figure>
  </canvas-text>
  <label>Caption <input type="text" id="capInput" value="A captioned figure, flattened to one image"></label>
  <label><input type="checkbox" id="band" checked> Band background</label>
  <button id="dl">Download PNG</button>
  <script type="module">
    const el = document.querySelector('canvas-text');
    const cap = document.getElementById('cap');
    document.getElementById('capInput').addEventListener('input', (e) => { cap.textContent = e.target.value; });
    document.getElementById('band').addEventListener('change', (e) => {
      cap.style.background = e.target.checked ? 'rgba(0,0,0,0.55)' : 'transparent';
    });
    document.getElementById('dl').addEventListener('click', async () => {
      const blob = await el.toBlob('image/png');
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'caption.png'; a.click(); URL.revokeObjectURL(a.href);
    });
  </script>
</body>
</html>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/demos.spec.js`
Expected: PASS (5 passed). Note: demos use remote images (picsum/pravatar); if the CI environment is offline, mark this spec to skip with `test.skip(!process.env.ONLINE)` — but locally with network it passes.

- [ ] **Step 5: Commit**

```bash
git add docs/meme.html docs/badge.html docs/banner.html docs/og-card.html docs/caption.html test/demos.spec.js
git commit -m "feat(docs): five interactive demos with download"
```

---

### Task 14: Docs nav, README + api.html, version bump, final gate

**Files:**
- Modify: `docs/index.html` (link the demos), `docs/api.html` (document new attributes/presets), `README.md`, `package.json`
- Test: full suite

- [ ] **Step 1: Add demo links to `docs/index.html`**

Open `docs/index.html`, find the existing demos/navigation section, and add a list linking the five pages. Insert this block inside the main content (adapt to existing markup):

```html
<section>
  <h2>Live demos</h2>
  <ul>
    <li><a href="./meme.html">Meme generator</a></li>
    <li><a href="./badge.html">User badge / profile card</a></li>
    <li><a href="./banner.html">Game banner builder</a></li>
    <li><a href="./og-card.html">OG / social share card</a></li>
    <li><a href="./caption.html">Caption / figure flattener</a></li>
  </ul>
</section>
```

- [ ] **Step 2: Document the new API in `docs/api.html` and `README.md`**

Add a "Placement" section (attributes table) and a "Presets" section to both `docs/api.html` and `README.md`. Use this Markdown for the README (place after the existing slot/attribute docs):

````markdown
## Placement (v0.2)

Any layer accepts placement attributes:

| Attribute | Values | Default |
|---|---|---|
| `place` | `top-left`…`bottom-right`, `center`, plus aliases `top`/`bottom`/`left`/`right` | `center` |
| `offset-x` / `offset-y` | px (`40`) or % (`10%`); +x→right, +y→down | `0` |
| `fit` | `cover` \| `contain` \| `fill` (images) | `cover` for `background`, `contain` for `image-N` |

New slot: `image-N` is a **placed** image (sized to itself), distinct from
`background` (full-bleed). `background` now defaults to `fit="cover"` (was an
unconditional stretch); pass `fit="fill"` for the old behavior.

```html
<canvas-text width="600" height="600">
  <img slot="background" src="banner.png" fit="cover">
  <h2 slot="text-1" place="top-center" offset-y="40">ProfPowell</h2>
  <img slot="image-1" src="a.png" place="bottom-center" offset-x="-80" offset-y="-40">
  <img slot="image-2" src="b.png" place="bottom-center"               offset-y="-40">
  <img slot="image-3" src="c.png" place="bottom-center" offset-x="80"  offset-y="-40">
</canvas-text>
```

## Presets (v0.2)

`preset="meme|badge|banner|caption"` applies sensible placement and typography
defaults. Explicit per-layer attributes always win.

- **meme** — Impact/Anton, white fill + black stroke, uppercase; `text-1`→top,
  `text-2`→bottom.
- **badge** — `image-1` avatar centered up top; `text-1`/`text-2` name/title;
  extra `image-N` auto-arranged in a centered row.
- **banner** — `text-1` name up top; all `image-N` in a centered bottom row.
- **caption** — flattens a semantic `<figure><img><figcaption></figcaption></figure>`
  into a full-width bottom caption band (the band background is the figcaption's
  own `background-color`).

Fonts: `<canvas-text>` waits for `document.fonts.ready` before drawing, so
webfonts never render as fallback. Load OFL faces (e.g. Anton) yourself via
`@font-face` / Google Fonts.
````

Mirror the same two sections as HTML in `docs/api.html` (match its existing heading/structure).

- [ ] **Step 3: Bump version**

In `package.json`, change `"version": "0.1.1"` to `"version": "0.2.0"`.

- [ ] **Step 4: Run all quality gates**

```bash
npm run lint
npm run build
npm test
```

Expected: lint clean (0 errors/warnings), build succeeds, all specs pass
(`placement`, `placement-render`, `presets`, `fonts`, `demos`, plus all v0.1
specs: `smoke`, `render`, `reactivity`, `layers`, `output`, `theme`, `a11y`).

- [ ] **Step 5: Commit**

```bash
git add docs/index.html docs/api.html README.md package.json
git commit -m "docs: document v0.2 placement/presets; bump to 0.2.0"
```

---

## Self-Review notes (verification of this plan against the spec)

- **Placement attributes** (spec §"Placement attributes") → Tasks 1–7. `place`/`offset-x`/`offset-y`/`fit`, anchor model, text vs image resolution, dpr handling, reactivity.
- **Slot grammar `image-N`** (spec §"Slot grammar extension") → Task 4.
- **`background` fit=cover back-compat change** (spec §"Backward compatibility") → Task 5 + documented in Task 14.
- **Presets meme/badge/banner/caption** (spec §"Presets") → Tasks 8–11; auto-row → Task 9; caption semantic figure → Task 11.
- **Fonts `document.fonts.ready`** (spec §"Fonts") → Task 12 (incl. guard for missing `document.fonts`).
- **Five demos** (spec §"Demos") → Task 13.
- **Testing** (spec §"Testing") → unit (Tasks 1–3), pixel placement (5–6), presets (8–11), fonts (12), back-compat (existing specs re-run in 6, 11, 14), demos smoke (13).
- **Non-goals** — no rotation/opacity/blend/editor/CSS-passthrough/bundled-fonts/sub-elements introduced anywhere.

Type/name consistency: `resolveAnchor`, `parseLength`, `resolveImageBoxCss`, `imageDrawArgs`, `textWrapperStyle` (placement.js); `applyPresetToLayers`, `autoRow`, `captionLayers` (presets.js); layer descriptor fields `{slot,z,kind,isBackground,node,place,offsetX,offsetY,fit,presetStyle}` used identically across layers.js, presets.js, and canvas-text.js.
