import { test, expect } from '@playwright/test';

test('render waits for a deferred webfont so text uses it, not the fallback', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const differs = await page.evaluate(async () => {
    async function renderWith(useFont) {
      const el = document.createElement('canvas-text');
      el.setAttribute('width', '300');
      el.setAttribute('height', '120');
      const fam = useFont ? 'CTWide, monospace' : 'monospace';
      el.innerHTML = `<div slot="text-1" place="center" style="font-size:40px;color:black;font-family:${fam}">WIDETEXT</div>`;
      document.getElementById('harness').appendChild(el);
      await new Promise((res) => el.addEventListener('canvas-text:rendered', res, { once: true }));
      const c = el.getCanvas();
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let ink = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) ink++;
      document.getElementById('harness').removeChild(el);
      return ink;
    }
    const ff = new FontFace('CTWide', 'local("Arial Black"), local("Impact"), local("Georgia")');
    document.fonts.add(ff);
    await ff.load().catch(() => {});
    const withFont = await renderWith(true);
    const baseline = await renderWith(false);
    return Math.abs(withFont - baseline);
  });
  expect(differs).toBeGreaterThan(0);
});

test('render still completes when document.fonts is unavailable (guard)', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const ok = await page.evaluate(async () => {
    const saved = document.fonts;
    try {
      Object.defineProperty(document, 'fonts', { value: undefined, configurable: true });
      const el = document.createElement('canvas-text');
      el.setAttribute('width', '200');
      el.innerHTML = `<div slot="text-1" place="center" style="color:black;font-size:24px">OK</div>`;
      document.getElementById('harness').appendChild(el);
      await new Promise((res) => el.addEventListener('canvas-text:rendered', res, { once: true }));
      return true;
    } finally {
      Object.defineProperty(document, 'fonts', { value: saved, configurable: true });
    }
  });
  expect(ok).toBe(true);
});
