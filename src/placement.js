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
