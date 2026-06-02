import { test, expect } from '@playwright/test';

const PAGES = ['meme', 'badge', 'banner', 'og-card', 'caption'];

for (const name of PAGES) {
  test(`${name} demo renders a non-blank canvas`, async ({ page }) => {
    await page.goto(`/docs/${name}.html`, { waitUntil: 'domcontentloaded' });
    const ink = await page.evaluate(async () => {
      const el = document.querySelector('canvas-text');
      if (!el) return -1;
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
