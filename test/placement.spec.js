import { test, expect } from '@playwright/test';

test('resolveAnchor maps names and aliases to fractions', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const r = await page.evaluate(async () => {
    const { resolveAnchor } = await import('/src/placement.js');
    return {
      center: resolveAnchor('center'),
      tc: resolveAnchor('top-center'),
      br: resolveAnchor('bottom-right'),
      topAlias: resolveAnchor('top'),
      rightAlias: resolveAnchor('right'),
      missing: resolveAnchor(null),
      junk: resolveAnchor('nonsense'),
    };
  });
  expect(r.center).toEqual({ ax: 0.5, ay: 0.5 });
  expect(r.tc).toEqual({ ax: 0.5, ay: 0 });
  expect(r.br).toEqual({ ax: 1, ay: 1 });
  expect(r.topAlias).toEqual({ ax: 0.5, ay: 0 });
  expect(r.rightAlias).toEqual({ ax: 1, ay: 0.5 });
  expect(r.missing).toEqual({ ax: 0.5, ay: 0.5 });
  expect(r.junk).toEqual({ ax: 0.5, ay: 0.5 });
});

test('parseLength handles px, percent, and empty', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const r = await page.evaluate(async () => {
    const { parseLength } = await import('/src/placement.js');
    return {
      px: parseLength('40', 600),
      pct: parseLength('10%', 600),
      empty: parseLength('', 600),
      nul: parseLength(null, 600),
      neg: parseLength('-16', 600),
    };
  });
  expect(r.px).toBe(40);
  expect(r.pct).toBeCloseTo(60);
  expect(r.empty).toBe(0);
  expect(r.nul).toBe(0);
  expect(r.neg).toBe(-16);
});
