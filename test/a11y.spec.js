import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('canvas is aria-hidden; slotted text is exposed to AT', async ({ page }) => {
  await page.goto('/test/test-page.html');
  await page.evaluate(async () => {
    const el = document.createElement('canvas-text');
    el.setAttribute('width', '300');
    el.innerHTML = '<p>readable</p>';
    document.getElementById('harness').appendChild(el);
    await new Promise((res) => el.addEventListener('canvas-text:rendered', res, { once: true }));
  });

  await expect(page.locator('canvas-text canvas')).toHaveAttribute('aria-hidden', 'true');

  const accessibleText = await page.evaluate(() =>
    document.querySelector('canvas-text').textContent.trim()
  );
  expect(accessibleText).toContain('readable');
});

test('alt attribute becomes aria-label on the canvas and suppresses fallback', async ({ page }) => {
  await page.goto('/test/test-page.html');
  await page.evaluate(async () => {
    const el = document.createElement('canvas-text');
    el.setAttribute('width', '300');
    el.setAttribute('alt', 'A meme that says hello');
    el.setAttribute('compose', 'text-only');
    el.innerHTML = 'hello';
    document.getElementById('harness').appendChild(el);
    await new Promise((res) => el.addEventListener('canvas-text:rendered', res, { once: true }));
  });
  await expect(page.locator('canvas-text canvas')).toHaveAttribute('aria-label', 'A meme that says hello');
});

test('axe-core finds no violations on a populated canvas-text', async ({ page }) => {
  await page.goto('/test/test-page.html');
  await page.evaluate(async () => {
    const el = document.createElement('canvas-text');
    el.setAttribute('width', '300');
    el.innerHTML = '<p>hello world</p>';
    document.getElementById('harness').appendChild(el);
    await new Promise((res) => el.addEventListener('canvas-text:rendered', res, { once: true }));
  });
  const results = await new AxeBuilder({ page }).include('canvas-text').analyze();
  expect(results.violations).toEqual([]);
});
