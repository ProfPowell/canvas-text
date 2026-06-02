const ANCHORS = {
  'top-left': [0, 0], 'top-center': [0.5, 0], 'top-right': [1, 0],
  'center-left': [0, 0.5], center: [0.5, 0.5], 'center-right': [1, 0.5],
  'bottom-left': [0, 1], 'bottom-center': [0.5, 1], 'bottom-right': [1, 1],
  top: [0.5, 0], bottom: [0.5, 1], left: [0, 0.5], right: [1, 0.5],
};

export function resolveAnchor(place) {
  const key = (place == null ? '' : String(place)).trim().toLowerCase();
  const a = ANCHORS[key] || ANCHORS.center;
  return { ax: a[0], ay: a[1] };
}

// "40" -> 40, "10%" -> basis*0.1, ""/null/garbage -> 0.
export function parseLength(value, basis) {
  if (value == null || value === '') return 0;
  const s = String(value).trim();
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return 0;
  return s.endsWith('%') ? (n / 100) * basis : n;
}
