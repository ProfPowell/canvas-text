import { test, expect } from '@playwright/test';

test('text-only render produces a non-blank canvas and fires rendered event', async ({ page }) => {
  await page.goto('/test/test-page.html');

  const detail = await page.evaluate(async () => {
    const el = document.createElement('canvas-text');
    el.setAttribute('width', '400');
    el.setAttribute('compose', 'text-only');
    el.innerHTML = '<strong>Hello</strong> world';
    document.getElementById('harness').appendChild(el);

    const ev = await new Promise((res) =>
      el.addEventListener('canvas-text:rendered', (e) => res(e.detail), { once: true })
    );
    return ev;
  });

  expect(detail.width).toBe(400);
  expect(detail.height).toBeGreaterThan(0);
  expect(typeof detail.durationMs).toBe('number');

  const hasPixels = await page.evaluate(() => {
    const c = document.querySelector('canvas-text canvas');
    const ctx = c.getContext('2d');
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] !== 0) return true;
    }
    return false;
  });
  expect(hasPixels).toBe(true);
});

test('canvas-text:error fires when render-tag throws', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const detail = await page.evaluate(async () => {
    const el = document.createElement('canvas-text');
    el.setAttribute('compose', 'text-only');
    el.setAttribute('width', '-1');
    el.innerHTML = 'x';
    document.getElementById('harness').appendChild(el);
    return new Promise((res) => {
      el.addEventListener('canvas-text:error', (e) => res(e.detail), { once: true });
      el.addEventListener('canvas-text:rendered', () => res(null), { once: true });
    });
  });
  // render-tag throws on width=-1, so detail is always non-null and contains an error.
  expect(detail).not.toBeNull();
  expect(detail.error).toBeDefined();
});
