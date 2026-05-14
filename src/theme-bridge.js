const ALLOWLIST = [
  'color',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'line-height',
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

export function wrapWithTheme(html, host, mode) {
  if (mode === 'none' || mode === 'inline') return html;
  const style = serializeThemeStyle(host);
  if (!style) return html;
  return `<div style="${escapeAttr(style)}">${html}</div>`;
}

function escapeAttr(s) {
  return s.replace(/"/g, '&quot;');
}
