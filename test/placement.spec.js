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
      cl: resolveAnchor('center-left'),
    };
  });
  expect(r.center).toEqual({ ax: 0.5, ay: 0.5 });
  expect(r.tc).toEqual({ ax: 0.5, ay: 0 });
  expect(r.br).toEqual({ ax: 1, ay: 1 });
  expect(r.topAlias).toEqual({ ax: 0.5, ay: 0 });
  expect(r.rightAlias).toEqual({ ax: 1, ay: 0.5 });
  expect(r.missing).toEqual({ ax: 0.5, ay: 0.5 });
  expect(r.junk).toEqual({ ax: 0.5, ay: 0.5 });
  expect(r.cl).toEqual({ ax: 0, ay: 0.5 });
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

test('resolveImageBoxCss derives box from attrs or natural size', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const r = await page.evaluate(async () => {
    const { resolveImageBoxCss } = await import('/src/placement.js');
    return {
      natural: resolveImageBoxCss({ natW: 200, natH: 100, attrW: null, attrH: null }),
      both: resolveImageBoxCss({ natW: 200, natH: 100, attrW: 80, attrH: 40 }),
      wOnly: resolveImageBoxCss({ natW: 200, natH: 100, attrW: 50, attrH: null }),
      hOnly: resolveImageBoxCss({ natW: 200, natH: 100, attrW: null, attrH: 50 }),
    };
  });
  expect(r.natural).toEqual({ w: 200, h: 100 });
  expect(r.both).toEqual({ w: 80, h: 40 });
  expect(r.wOnly).toEqual({ w: 50, h: 25 });
  expect(r.hOnly).toEqual({ w: 100, h: 50 });
});

test('imageDrawArgs: fill stretches box, anchored top-left', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const a = await page.evaluate(async () => {
    const { imageDrawArgs } = await import('/src/placement.js');
    return imageDrawArgs({
      natW: 50, natH: 50, boxW: 100, boxH: 100, fit: 'fill',
      ax: 0, ay: 0, offsetX: 0, offsetY: 0, canvasW: 400, canvasH: 400,
    });
  });
  expect(a).toEqual({ sx: 0, sy: 0, sw: 50, sh: 50, dx: 0, dy: 0, dw: 100, dh: 100 });
});

test('imageDrawArgs: cover crops source, fills box; bottom-center anchor + offset', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const a = await page.evaluate(async () => {
    const { imageDrawArgs } = await import('/src/placement.js');
    return imageDrawArgs({
      natW: 200, natH: 100, boxW: 100, boxH: 100, fit: 'cover',
      ax: 0.5, ay: 1, offsetX: 0, offsetY: -40, canvasW: 400, canvasH: 400,
    });
  });
  expect(a.sx).toBeCloseTo(50);
  expect(a.sy).toBeCloseTo(0);
  expect(a.sw).toBeCloseTo(100);
  expect(a.sh).toBeCloseTo(100);
  expect(a.dx).toBeCloseTo(150);
  expect(a.dy).toBeCloseTo(260);
  expect(a.dw).toBeCloseTo(100);
  expect(a.dh).toBeCloseTo(100);
});

test('imageDrawArgs: contain letterboxes inside box', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const a = await page.evaluate(async () => {
    const { imageDrawArgs } = await import('/src/placement.js');
    return imageDrawArgs({
      natW: 200, natH: 100, boxW: 100, boxH: 100, fit: 'contain',
      ax: 0, ay: 0, offsetX: 0, offsetY: 0, canvasW: 400, canvasH: 400,
    });
  });
  expect(a.dw).toBeCloseTo(100);
  expect(a.dh).toBeCloseTo(50);
  expect(a.dx).toBeCloseTo(0);
  expect(a.dy).toBeCloseTo(25);
  expect(a.sw).toBeCloseTo(200);
  expect(a.sh).toBeCloseTo(100);
});

test('textWrapperStyle: top-center', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const css = await page.evaluate(async () => {
    const { textWrapperStyle } = await import('/src/placement.js');
    return textWrapperStyle({ ax: 0.5, ay: 0, offsetX: 0, offsetY: 16 });
  });
  expect(css).toContain('position:absolute');
  expect(css).toContain('left:0');
  expect(css).toContain('right:0');
  expect(css).toContain('text-align:center');
  expect(css).toContain('top:16px');
  expect(css).not.toContain('bottom:');
});

test('textWrapperStyle: bottom-right with negative y becomes bottom offset', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const css = await page.evaluate(async () => {
    const { textWrapperStyle } = await import('/src/placement.js');
    return textWrapperStyle({ ax: 1, ay: 1, offsetX: 0, offsetY: -16 });
  });
  expect(css).toContain('text-align:right');
  expect(css).toContain('bottom:16px');
  expect(css).not.toMatch(/(^|\s)top:/);
});

test('textWrapperStyle: vertical center uses translateY', async ({ page }) => {
  await page.goto('/test/test-page.html');
  const css = await page.evaluate(async () => {
    const { textWrapperStyle } = await import('/src/placement.js');
    return textWrapperStyle({ ax: 0, ay: 0.5, offsetX: 0, offsetY: 0 });
  });
  expect(css).toContain('text-align:left');
  expect(css).toContain('top:50%');
  expect(css).toContain('translateY(');
});
