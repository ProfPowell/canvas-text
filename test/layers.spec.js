import { test, expect } from '@playwright/test';

test('background, text-1, text-2 stack in z-order with text on top', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const pixel = await page.evaluate(async () => {
    const el = document.createElement('canvas-text');
    el.setAttribute('width', '200');
    el.setAttribute('height', '200');
    el.innerHTML = `
      <img slot="background" src="/test/fixtures/red-square.png" crossorigin="anonymous">
      <div slot="text-1" style="text-align:center; font:bold 48px sans-serif; color:white;">HI</div>
    `;
    document.getElementById('harness').appendChild(el);
    await new Promise((res) => el.addEventListener('canvas-text:rendered', res, { once: true }));

    const c = el.getCanvas();
    const ctx = c.getContext('2d');
    const center = ctx.getImageData(c.width / 2, c.height / 2, 1, 1).data;
    const corner = ctx.getImageData(2, 2, 1, 1).data;
    return { center: [...center], corner: [...corner] };
  });
  expect(pixel.corner[0]).toBeGreaterThan(200);
  expect(pixel.corner[1]).toBeLessThan(50);
  expect(Math.min(pixel.center[0], pixel.center[1], pixel.center[2])).toBeGreaterThan(150);
});

test('background-2 paints above background-1', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const color = await page.evaluate(async () => {
    const el = document.createElement('canvas-text');
    el.setAttribute('width', '200');
    el.setAttribute('height', '200');
    el.innerHTML = `
      <img slot="background-1" src="/test/fixtures/red-square.png" crossorigin="anonymous">
      <img slot="background-2" src="/test/fixtures/blue-square.png" crossorigin="anonymous">
    `;
    document.getElementById('harness').appendChild(el);
    await new Promise((res) => el.addEventListener('canvas-text:rendered', res, { once: true }));
    const c = el.getCanvas();
    return [...c.getContext('2d').getImageData(100, 100, 1, 1).data];
  });
  expect(color[2]).toBeGreaterThan(200);
  expect(color[0]).toBeLessThan(50);
});

test('broken image layer fires layer-error but rest of composition renders', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const result = await page.evaluate(async () => {
    const el = document.createElement('canvas-text');
    el.setAttribute('width', '200');
    el.setAttribute('height', '200');
    el.innerHTML = `
      <img slot="background" src="/does-not-exist.png">
      <div>fallback</div>
    `;
    const errors = [];
    el.addEventListener('canvas-text:layer-error', (e) => errors.push(e.detail));
    document.getElementById('harness').appendChild(el);
    await new Promise((res) => el.addEventListener('canvas-text:rendered', res, { once: true }));
    return { errors, hasCanvas: !!el.getCanvas() };
  });
  expect(result.hasCanvas).toBe(true);
  expect(result.errors.length).toBe(1);
  expect(result.errors[0].slot).toBe('background');
});

test('height auto-derives from background image ratio when omitted', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const dims = await page.evaluate(async () => {
    const el = document.createElement('canvas-text');
    el.setAttribute('width', '400');
    el.innerHTML = `<img slot="background" src="/test/fixtures/red-square.png" crossorigin="anonymous">`;
    document.getElementById('harness').appendChild(el);
    const ev = await new Promise((res) => el.addEventListener('canvas-text:rendered', res, { once: true }));
    return ev.detail;
  });
  expect(dims.width).toBe(400);
  expect(dims.height).toBe(400);
});
