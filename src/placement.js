const ANCHORS = {
  'top-left': [0, 0], 'top-center': [0.5, 0], 'top-right': [1, 0],
  'center-left': [0, 0.5], center: [0.5, 0.5], 'center-right': [1, 0.5],
  'bottom-left': [0, 1], 'bottom-center': [0.5, 1], 'bottom-right': [1, 1],
  top: [0.5, 0], bottom: [0.5, 1], left: [0, 0.5], right: [1, 0.5],
};

// Resolve a `place` keyword to anchor fractions {ax, ay}, each in {0, 0.5, 1}.
// Unknown/null input defaults to center. ax is horizontal (0=left), ay vertical (0=top).
export function resolveAnchor(place) {
  const key = (place == null ? '' : String(place)).trim().toLowerCase();
  const a = ANCHORS[key] || ANCHORS.center;
  return { ax: a[0], ay: a[1] };
}

// Parse a length attribute against a basis dimension.
// `value`: a px number string ("40"), a percent string ("10%"), or null/empty.
// `basis`: the reference dimension (same unit as the return value) for percents.
// Returns a finite number; ""/null/garbage/non-finite-basis-percent -> 0.
export function parseLength(value, basis) {
  if (value == null || value === '') return 0;
  const s = String(value).trim();
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return 0;
  if (s.endsWith('%')) return Number.isFinite(basis) ? (n / 100) * basis : 0;
  return n;
}

// Box (CSS px) for a placed image: explicit attrs win; a single attr
// preserves aspect ratio; otherwise natural size.
export function resolveImageBoxCss({ natW, natH, attrW, attrH }) {
  const haveW = Number.isFinite(attrW) && attrW > 0;
  const haveH = Number.isFinite(attrH) && attrH > 0;
  if (haveW && haveH) return { w: attrW, h: attrH };
  if (haveW) return { w: attrW, h: natW ? (attrW * natH) / natW : attrW };
  if (haveH) return { w: natH ? (attrH * natW) / natH : attrH, h: attrH };
  return { w: natW, h: natH };
}

// Always returns the 9-arg drawImage form. All inputs/outputs in one space
// (caller picks device or CSS px and stays consistent).
export function imageDrawArgs({
  natW, natH, boxW, boxH, fit, ax, ay, offsetX, offsetY, canvasW, canvasH,
}) {
  const boxX = ax * (canvasW - boxW) + offsetX;
  const boxY = ay * (canvasH - boxH) + offsetY;

  if (fit === 'fill') {
    return { sx: 0, sy: 0, sw: natW, sh: natH, dx: boxX, dy: boxY, dw: boxW, dh: boxH };
  }
  if (fit === 'contain') {
    const scale = Math.min(boxW / natW, boxH / natH);
    const dw = natW * scale, dh = natH * scale;
    return {
      sx: 0, sy: 0, sw: natW, sh: natH,
      dx: boxX + (boxW - dw) / 2, dy: boxY + (boxH - dh) / 2, dw, dh,
    };
  }
  // cover: scale so box is fully covered, crop source rect centered.
  const scale = Math.max(boxW / natW, boxH / natH);
  const sw = boxW / scale, sh = boxH / scale;
  return {
    sx: (natW - sw) / 2, sy: (natH - sh) / 2, sw, sh,
    dx: boxX, dy: boxY, dw: boxW, dh: boxH,
  };
}
