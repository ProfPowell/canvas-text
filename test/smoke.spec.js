import { test, expect } from '@playwright/test';

test('element upgrades and sets data-upgraded', async ({ page }) => {
  await page.goto('/test/test-page.html');
  await page.evaluate(() => {
    const el = document.createElement('canvas-text');
    document.getElementById('harness').appendChild(el);
  });
  const el = page.locator('canvas-text');
  await expect(el).toHaveAttribute('data-upgraded', '');
});
