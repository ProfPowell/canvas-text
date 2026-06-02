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
      inside: [...ctx.getImageData(10 * dpr, 10 * dpr, 1, 1).data],
      outside: [...ctx.getImageData(120 * dpr, 120 * dpr, 1, 1).data],
    };
  });
  expect(px.inside[0]).toBeGreaterThan(200);
  expect(px.outside[3]).toBe(0);
});

test('background fit=cover crops a non-square source to fill the square canvas', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const px = await page.evaluate(async () => {
    const el = document.createElement('canvas-text');
    el.setAttribute('width', '200');
    el.setAttribute('height', '100'); // 200x100 canvas, square source -> cover crops, fills fully
    el.innerHTML = `<img slot="background" src="/test/fixtures/red-square.png" crossorigin="anonymous">`;
    document.getElementById('harness').appendChild(el);
    await new Promise((res) => el.addEventListener('canvas-text:rendered', res, { once: true }));
    const c = el.getCanvas();
    const ctx = c.getContext('2d');
    const corners = [[2,2],[c.width-3,2],[2,c.height-3],[c.width-3,c.height-3],[c.width/2|0,c.height/2|0]];
    return corners.map(([x,y]) => [...ctx.getImageData(x,y,1,1).data]);
  });
  for (const p of px) {
    expect(p[3]).toBeGreaterThan(200);
    expect(p[0]).toBeGreaterThan(200);
  }
});
