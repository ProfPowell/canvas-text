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

test('isSelfStyled detects layers that declare their own typography', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const result = await page.evaluate(async () => {
    const { isSelfStyled } = await import('/src/theme-bridge.js');
    const styled = document.createElement('div');
    styled.setAttribute('style', 'font-size: 52px; color: white; -webkit-text-stroke: 2px black;');
    const plain = document.createElement('div');
    plain.setAttribute('style', 'padding-top: 20px;');
    const noStyle = document.createElement('div');
    return {
      styled: isSelfStyled(styled),
      plain: isSelfStyled(plain),
      noStyle: isSelfStyled(noStyle),
      nullArg: isSelfStyled(null),
    };
  });
  expect(result.styled).toBe(true);
  expect(result.plain).toBe(false);
  expect(result.noStyle).toBe(false);
  expect(result.nullArg).toBe(false);
});

test('theme="inherit" SKIPS the wrapper for self-styled layers', async ({ page }) => {
  // When a slotted text-N layer declares its own font/color/stroke, the bridge
  // should not wrap — otherwise the inherited font-family disrupts render-tag's
  // -webkit-text-stroke. The visible test: render the same self-styled layer
  // under theme="inherit" and theme="none" — the resulting canvases should match
  // (because the bridge skips wrapping in both cases for self-styled content).
  await page.goto('/test/test-page.html');
  const samePixels = await page.evaluate(async () => {
    const host = document.getElementById('harness');
    host.removeAttribute('style');
    host.style.color = 'rgb(36, 41, 47)';
    host.style.fontFamily = '-apple-system, sans-serif';
    host.style.fontSize = '16px';

    async function render(theme) {
      const el = document.createElement('canvas-text');
      el.setAttribute('width', '500');
      el.setAttribute('height', '120');
      el.setAttribute('theme', theme);
      el.innerHTML =
        '<div slot="text-1" style="text-align:center; font-size:52px; font-weight:bold; color:white; -webkit-text-stroke:2px black; padding-top:20px;">TOP PXMB</div>';
      host.appendChild(el);
      await new Promise((res) => el.addEventListener('canvas-text:rendered', res, { once: true }));
      const c = el.getCanvas();
      const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      host.removeChild(el);
      return data;
    }

    const a = await render('inherit');
    const b = await render('none');
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i += 4) {
      const dd = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) + Math.abs(a[i + 3] - b[i + 3]);
      if (dd > 16) diff++;
    }
    // Tolerate up to 16 stray pixels for AA noise; in practice we expect 0.
    return diff <= 16;
  });
  expect(samePixels).toBe(true);
});
