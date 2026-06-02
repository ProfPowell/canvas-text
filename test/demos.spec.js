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

test('demos.html embeds all five standalone demos in browser-window frames', async ({ page }) => {
  await page.goto('/docs/demos.html', { waitUntil: 'domcontentloaded' });
  const srcs = await page.$$eval('.browser-window iframe', (els) => els.map((e) => e.getAttribute('src')));
  for (const name of ['./meme.html', './badge.html', './banner.html', './og-card.html', './caption.html']) {
    expect(srcs).toContain(name);
  }
});

test('demos.html uses <code-block> for source (no raw pre/code)', async ({ page }) => {
  await page.goto('/docs/demos.html', { waitUntil: 'domcontentloaded' });
  const counts = await page.evaluate(() => ({
    codeBlocks: document.querySelectorAll('code-block').length,
    rawPre: document.querySelectorAll('pre').length,
    hasImport: !!document.querySelector('script[src*="@profpowell/code-block"]'),
  }));
  expect(counts.codeBlocks).toBeGreaterThanOrEqual(12);
  expect(counts.rawPre).toBe(0);
  expect(counts.hasImport).toBe(true);
});

test('index.html uses <code-block> for source (no raw pre/code)', async ({ page }) => {
  await page.goto('/docs/index.html', { waitUntil: 'domcontentloaded' });
  const c = await page.evaluate(() => ({
    codeBlocks: document.querySelectorAll('code-block').length,
    rawPre: document.querySelectorAll('pre').length,
    hasImport: !!document.querySelector('script[src*="@profpowell/code-block"]'),
  }));
  expect(c.codeBlocks).toBeGreaterThanOrEqual(3);
  expect(c.rawPre).toBe(0);
  expect(c.hasImport).toBe(true);
});
