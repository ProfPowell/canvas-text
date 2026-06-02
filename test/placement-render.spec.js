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
