import { test, expect } from '@playwright/test';

test('render blocks until document.fonts.ready resolves', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const result = await page.evaluate(async () => {
    const realFonts = document.fonts;
    let resolveReady;
    const deferred = new Promise((r) => { resolveReady = r; });
    // Stub document.fonts.ready with a promise we control.
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { ready: deferred, add: realFonts.add.bind(realFonts) },
    });
    try {
      let rendered = false;
      const el = document.createElement('canvas-text');
      el.setAttribute('width', '200');
      el.setAttribute('height', '100');
      el.innerHTML = `<div slot="text-1" place="center" style="color:black;font-size:24px">HI</div>`;
      el.addEventListener('canvas-text:rendered', () => { rendered = true; });
      document.getElementById('harness').appendChild(el);

      // Give render() time to reach the fonts.ready await. It must NOT have rendered yet.
      await new Promise((r) => setTimeout(r, 60));
      const renderedBeforeResolve = rendered;

      // Now release fonts.ready and wait for the render to complete.
      resolveReady();
      await new Promise((res) => {
        if (rendered) return res();
        el.addEventListener('canvas-text:rendered', res, { once: true });
      });
      const renderedAfterResolve = rendered;

      document.getElementById('harness').removeChild(el);
      return { renderedBeforeResolve, renderedAfterResolve };
    } finally {
      Object.defineProperty(document, 'fonts', { configurable: true, value: realFonts });
    }
  });
  expect(result.renderedBeforeResolve).toBe(false); // blocked while fonts.ready pending
  expect(result.renderedAfterResolve).toBe(true);    // proceeds once fonts.ready resolves
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
