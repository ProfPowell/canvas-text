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

test('theme="inherit" injects host computed style into render-tag input', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const seen = await page.evaluate(async () => {
    const mod = await import('render-tag');
    const orig = mod.render;
    let captured = null;
    mod.render = (opts) => {
      captured = opts;
      return orig.call(mod, opts);
    };

    const host = document.getElementById('harness');
    host.style.color = 'rgb(255, 0, 0)';

    const el = document.createElement('canvas-text');
    el.setAttribute('compose', 'text-only');
    el.setAttribute('theme', 'inherit');
    el.innerHTML = 'tint me';
    host.appendChild(el);
    await new Promise((res) => el.addEventListener('canvas-text:rendered', res, { once: true }));

    mod.render = orig;
    return captured?.html;
  });
  expect(seen).toMatch(/style="[^"]*color:\s*rgb\(255,\s*0,\s*0\)/);
});
