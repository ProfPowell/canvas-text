const ALLOWLIST = [
  'color',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  // line-height intentionally omitted: getComputedStyle resolves it to an
  // absolute px value (e.g. "25.6px" from line-height:1.6 on a 16px host),
  // which then inherits verbatim into auto-sized text layers and collapses
  // their baseline. Authors who want a specific leading should set it on
  // the layer itself.
  'letter-spacing',
  'text-align',
  'background-color',
];

export function serializeThemeStyle(host) {
  const cs = getComputedStyle(host);
  const decls = [];
  for (const prop of ALLOWLIST) {
    const val = cs.getPropertyValue(prop).trim();
    if (val) decls.push(`${prop}: ${val}`);
  }
  return decls.join('; ');
}

// If a slotted layer already declares any of these typographic properties
// inline, treat it as "self-styled" and skip the inherit wrapper. The
// wrapper is meant for plain prose that should pick up the host's tokens;
// once an author has taken responsibility for font/color/stroke, the wrapper
// just introduces a redundant CSS context that can fight render-tag's stroke
// rendering (visible as thin slashes through closed-bowl glyphs like P/B/M/X).
const SELF_STYLED_RE =
  /(?:^|;)\s*(?:font-(?:family|size|weight|style)|color|-webkit-text-stroke(?:-(?:width|color))?)\s*:/i;

export function isSelfStyled(node) {
  if (!node || typeof node.getAttribute !== 'function') return false;
  const s = node.getAttribute('style') || '';
  return SELF_STYLED_RE.test(s);
}

export function wrapWithTheme(html, host, mode, layerNode) {
  if (mode === 'none' || mode === 'inline') return html;
  if (isSelfStyled(layerNode)) return html;
  const style = serializeThemeStyle(host);
  if (!style) return html;
  return `<div style="${escapeAttr(style)}">${html}</div>`;
}

function escapeAttr(s) {
  return s.replace(/"/g, '&quot;');
}
