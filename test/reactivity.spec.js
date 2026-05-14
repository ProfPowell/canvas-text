import { test, expect } from '@playwright/test';

test('width attribute change triggers re-render', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const result = await page.evaluate(async () => {
    const el = document.createElement('canvas-text');
    el.setAttribute('width', '300');
    el.setAttribute('compose', 'text-only');
    el.innerHTML = 'hello';
    document.getElementById('harness').appendChild(el);
    await new Promise((res) => el.addEventListener('canvas-text:rendered', res, { once: true }));

    const renders = [];
    el.addEventListener('canvas-text:rendered', (e) => renders.push(e.detail));

    el.setAttribute('width', '500');
    await new Promise((res) => setTimeout(res, 100));
    return { count: renders.length, lastWidth: renders.at(-1)?.width };
  });
  expect(result.count).toBe(1);
  expect(result.lastWidth).toBe(500);
});

test('rapid attribute mutations coalesce into one render', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const renders = await page.evaluate(async () => {
    const el = document.createElement('canvas-text');
    el.setAttribute('compose', 'text-only');
    el.innerHTML = 'hello';
    document.getElementById('harness').appendChild(el);
    await new Promise((res) => el.addEventListener('canvas-text:rendered', res, { once: true }));

    let n = 0;
    el.addEventListener('canvas-text:rendered', () => n++);
    for (let i = 0; i < 5; i++) el.setAttribute('width', String(300 + i));
    await new Promise((res) => setTimeout(res, 100));
    return n;
  });
  expect(renders).toBe(1);
});

test('mutating slotted text triggers re-render', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const result = await page.evaluate(async () => {
    const el = document.createElement('canvas-text');
    el.setAttribute('compose', 'text-only');
    el.textContent = 'first';
    document.getElementById('harness').appendChild(el);
    await new Promise((res) => el.addEventListener('canvas-text:rendered', res, { once: true }));

    const renders = [];
    el.addEventListener('canvas-text:rendered', (e) => renders.push(e));
    el.textContent = 'second';
    await new Promise((res) => el.addEventListener('canvas-text:rendered', res, { once: true }));
    return {
      rendered: renders.length,
      hasCanvas: !!el.querySelector(':scope > canvas'),
    };
  });
  expect(result.rendered).toBe(1);
  expect(result.hasCanvas).toBe(true);
});
