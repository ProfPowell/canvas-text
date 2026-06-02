import { test, expect } from '@playwright/test';

test('applyPresetToLayers(meme) fills text placement and stroke, respects author overrides', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const r = await page.evaluate(async () => {
    const { applyPresetToLayers } = await import('/src/presets.js');
    const layers = [
      { slot: 'background', kind: 'image', isBackground: true, place: null, offsetX: null, offsetY: null, fit: null },
      { slot: 'text-1', kind: 'text', z: 1, place: null, offsetX: null, offsetY: null, fit: null },
      { slot: 'text-2', kind: 'text', z: 2, place: 'center', offsetX: null, offsetY: null, fit: null },
    ];
    applyPresetToLayers('meme', layers, { width: 500, height: 500 });
    return layers;
  });
  expect(r[0].fit).toBe('cover');
  expect(r[1].place).toBe('top');
  expect(r[1].presetStyle).toContain('-webkit-text-stroke');
  expect(r[1].presetStyle).toContain('text-transform:uppercase');
  expect(r[2].place).toBe('center');
  expect(r[2].presetStyle).toContain('-webkit-text-stroke');
});

test('meme preset sets a large default font-size scaled to canvas width', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const r = await page.evaluate(async () => {
    const { applyPresetToLayers } = await import('/src/presets.js');
    const layers = [{ slot: 'text-1', kind: 'text', z: 1, place: null, offsetX: null, offsetY: null, fit: null }];
    applyPresetToLayers('meme', layers, { width: 500, height: 500 });
    return layers[0].presetStyle;
  });
  expect(r).toMatch(/font-size:\s*50px/); // 10% of 500
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

test('autoRow centers N items with gap and assigns place=bottom-center + offsets', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const r = await page.evaluate(async () => {
    const { autoRow } = await import('/src/presets.js');
    const items = [{}, {}, {}];
    autoRow(items, { itemW: 72, gap: 16, offsetY: -40 });
    return items.map((it) => ({ place: it.place, ox: Number(it.offsetX), oy: Number(it.offsetY), fit: it.fit }));
  });
  expect(r[0].place).toBe('bottom-center');
  expect(r[0].ox).toBeCloseTo(-88);
  expect(r[1].ox).toBeCloseTo(0);
  expect(r[2].ox).toBeCloseTo(88);
  expect(r.every((it) => it.oy === -40)).toBe(true);
  expect(r.every((it) => it.fit === 'contain')).toBe(true);
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
    const top = ctx.getImageData((c.width*0.5)|0, (c.height*0.2)|0, 1, 1).data;
    const bandLeft = ctx.getImageData(4, (c.height*0.92)|0, 1, 1).data;
    const bandRight = ctx.getImageData(c.width-5, (c.height*0.92)|0, 1, 1).data;
    return {
      topRed: top[0] > 150 && top[2] < 100,
      bandDarkLeft: bandLeft[0] < 160 && bandLeft[3] > 200,
      bandDarkRight: bandRight[0] < 160 && bandRight[3] > 200,
    };
  });
  expect(r.topRed).toBe(true);
  expect(r.bandDarkLeft).toBe(true);
  expect(r.bandDarkRight).toBe(true);
});
