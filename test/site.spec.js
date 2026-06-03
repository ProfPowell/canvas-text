import { test, expect } from '@playwright/test';

async function audit(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  return page.evaluate(() => ({
    vbLinked: !!document.querySelector('link[href*="vanilla-breeze"]'),
    theme: document.documentElement.getAttribute('data-theme'),
    oldStyles: !!document.querySelector('link[href="./styles.css"]'),
    removedClasses: ['demo-section', 'site-header', 'nav-links', 'canvas-text-frame', 'api-table', 'theme-toggle']
      .filter((c) => document.querySelector('.' + c)),
    siteJs: !!document.querySelector('script[src="./site.js"]'),
  }));
}

test('index.html is on vanilla-breeze (classic, no styles.css, no bespoke classes)', async ({ page }) => {
  const a = await audit(page, '/docs/index.html');
  expect(a.vbLinked).toBe(true);
  expect(a.theme).toBe('classic');
  expect(a.oldStyles).toBe(false);
  expect(a.removedClasses).toEqual([]);
  expect(a.siteJs).toBe(true);
});

test('dark-mode toggle flips data-mode on <html>', async ({ page }) => {
  await page.goto('/docs/index.html', { waitUntil: 'domcontentloaded' });
  const before = await page.evaluate(() => document.documentElement.dataset.mode || '');
  await page.click('#mode-toggle');
  const after = await page.evaluate(() => document.documentElement.dataset.mode || '');
  expect(before).toBe('');
  expect(after).toBe('dark');
});

test('index hero canvas-text still renders', async ({ page }) => {
  await page.goto('/docs/index.html', { waitUntil: 'domcontentloaded' });
  const ink = await page.evaluate(async () => {
    const el = document.querySelector('canvas-text');
    await new Promise((res) => {
      if (el.hasAttribute('data-upgraded')) return res();
      el.addEventListener('canvas-text:rendered', res, { once: true });
    });
    const c = el.getCanvas();
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n;
  });
  expect(ink).toBeGreaterThan(0);
});
