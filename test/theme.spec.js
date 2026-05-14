import { test, expect } from '@playwright/test';

test('serializeThemeStyle returns allowlisted properties as inline CSS', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const css = await page.evaluate(async () => {
    const { serializeThemeStyle } = await import('/src/theme-bridge.js');
    const host = document.getElementById('harness');
    host.style.color = 'rgb(10, 20, 30)';
    host.style.fontFamily = 'serif';
    host.style.fontSize = '24px';
    return serializeThemeStyle(host);
  });
  expect(css).toMatch(/color:\s*rgb\(10,\s*20,\s*30\)/);
  expect(css).toMatch(/font-family:\s*serif/);
  expect(css).toMatch(/font-size:\s*24px/);
});

test('theme="inherit" colors the rendered text with the host\'s color', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const found = await page.evaluate(async () => {
    const host = document.getElementById('harness');
    host.style.color = 'rgb(255, 0, 0)';
    host.style.fontSize = '48px';

    const el = document.createElement('canvas-text');
    el.setAttribute('compose', 'text-only');
    el.setAttribute('theme', 'inherit');
    el.setAttribute('width', '400');
    el.innerHTML = 'TINT ME';
    host.appendChild(el);
    await new Promise((res) => el.addEventListener('canvas-text:rendered', res, { once: true }));

    const c = el.getCanvas();
    const ctx = c.getContext('2d');
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    // Look for a pixel that is clearly red (R high, G+B low) — that's the rendered text.
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      if (a > 0 && r > 150 && g < 80 && b < 80) return true;
    }
    return false;
  });
  expect(found).toBe(true);
});

test('theme="none" does NOT inherit host color (control)', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const found = await page.evaluate(async () => {
    const host = document.getElementById('harness');
    // Reset host color from any previous test by removing inline style.
    host.removeAttribute('style');
    host.style.color = 'rgb(255, 0, 0)';
    host.style.fontSize = '48px';

    const el = document.createElement('canvas-text');
    el.setAttribute('compose', 'text-only');
    el.setAttribute('theme', 'none');
    el.setAttribute('width', '400');
    el.innerHTML = 'TINT ME';
    host.appendChild(el);
    await new Promise((res) => el.addEventListener('canvas-text:rendered', res, { once: true }));

    const c = el.getCanvas();
    const ctx = c.getContext('2d');
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      if (a > 0 && r > 150 && g < 80 && b < 80) return true;
    }
    return false;
  });
  // With theme="none" the host color should NOT be inherited; rendered text stays
  // render-tag's default (typically black). So we expect no red pixels.
  expect(found).toBe(false);
});
