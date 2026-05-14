import { test, expect } from '@playwright/test';

test('toDataURL returns a base64 PNG URL', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const url = await page.evaluate(async () => {
    const el = document.createElement('canvas-text');
    el.setAttribute('width', '200');
    el.setAttribute('height', '100');
    el.setAttribute('compose', 'text-only');
    el.innerHTML = 'export';
    document.getElementById('harness').appendChild(el);
    await new Promise((res) => el.addEventListener('canvas-text:rendered', res, { once: true }));
    return el.toDataURL();
  });
  expect(url).toMatch(/^data:image\/png;base64,/);
  expect(url.length).toBeGreaterThan(100);
});

test('toBlob returns a non-empty Blob with the requested MIME', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const blob = await page.evaluate(async () => {
    const el = document.createElement('canvas-text');
    el.setAttribute('width', '200');
    el.setAttribute('height', '100');
    el.setAttribute('compose', 'text-only');
    el.setAttribute('format', 'jpeg');
    el.innerHTML = 'export';
    document.getElementById('harness').appendChild(el);
    await new Promise((res) => el.addEventListener('canvas-text:rendered', res, { once: true }));
    const b = await el.toBlob();
    return { type: b.type, size: b.size };
  });
  expect(blob.type).toBe('image/jpeg');
  expect(blob.size).toBeGreaterThan(0);
});
