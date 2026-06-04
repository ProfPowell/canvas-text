import { test, expect } from '@playwright/test';

// VB is bundled via docs-entry.js — no CDN <link> or <script[src]> for it.
// After docs-entry.js runs, VB applies the "classic" theme (seeded in localStorage
// by the inline <script> in each page's <head>), so the body gets Classic serif fonts.
async function audit(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  // Give VB a moment to initialise and apply the classic theme CSS.
  await page.waitForFunction(
    () => {
      const ff = getComputedStyle(document.body).fontFamily.toLowerCase();
      return ff.includes('charter') || ff.includes('georgia');
    },
    { timeout: 5000 }
  ).catch(() => {
    // If the font hasn't changed it will be caught by the assertion below.
  });

  return page.evaluate(() => ({
    dataTheme: document.documentElement.getAttribute('data-theme'),
    themePicker: !!document.querySelector('theme-picker'),
    oldStyles: !!document.querySelector('link[href="./styles.css"]'),
    removedClasses: ['demo-section', 'site-header', 'nav-links', 'canvas-text-frame', 'api-table', 'theme-toggle']
      .filter((c) => document.querySelector('.' + c)),
    fontFamily: getComputedStyle(document.body).fontFamily.toLowerCase(),
  }));
}

for (const path of ['/docs/index.html', '/docs/demos.html', '/docs/api.html']) {
  test(`${path} — data-theme="classic", theme-picker present, no old classes/styles`, async ({ page }) => {
    const a = await audit(page, path);
    expect(a.dataTheme).toBe('classic');
    expect(a.themePicker).toBe(true);
    expect(a.oldStyles).toBe(false);
    expect(a.removedClasses).toEqual([]);
  });

  test(`${path} — styled by VB classic (charter or georgia font)`, async ({ page }) => {
    const a = await audit(page, path);
    const styledByVb = a.fontFamily.includes('charter') || a.fontFamily.includes('georgia');
    expect(styledByVb).toBe(true);
  });
}

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
