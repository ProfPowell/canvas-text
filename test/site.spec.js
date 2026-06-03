import { test, expect } from '@playwright/test';

// Pages should use full vanilla-breeze (CSS + JS), a <theme-picker> for theme/
// dark switching, zero bespoke classes, and no hand-rolled styles.css.
async function audit(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  return page.evaluate(() => ({
    vbCss: !!document.querySelector('link[href*="vanilla-breeze.css"]'),
    vbJs: !!document.querySelector('script[src*="vanilla-breeze.js"]'),
    themePicker: !!document.querySelector('theme-picker'),
    oldStyles: !!document.querySelector('link[href="./styles.css"]'),
    removedClasses: ['demo-section', 'site-header', 'nav-links', 'canvas-text-frame', 'api-table', 'theme-toggle']
      .filter((c) => document.querySelector('.' + c)),
  }));
}

test('index.html uses full vanilla-breeze (css+js, theme-picker, no styles.css/classes)', async ({ page }) => {
  const a = await audit(page, '/docs/index.html');
  expect(a.vbCss).toBe(true);
  expect(a.vbJs).toBe(true);
  expect(a.themePicker).toBe(true);
  expect(a.oldStyles).toBe(false);
  expect(a.removedClasses).toEqual([]);
});

test('index.html is actually styled by vanilla-breeze (not bare UA defaults)', async ({ page }) => {
  await page.goto('/docs/index.html', { waitUntil: 'domcontentloaded' });
  const styled = await page.evaluate(() => {
    const ff = getComputedStyle(document.body).fontFamily.toLowerCase();
    return ff.length > 0 && ff !== 'serif' && ff !== 'times new roman' && ff !== 'times';
  });
  expect(styled).toBe(true);
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
