// Presets fill only the placement fields the author left null, and set
// `presetStyle` on text layers (CSS string) so paint skips the theme wrapper.
// Author-set attributes always win. Presets never mutate author DOM.

const MEME_TEXT_STYLE =
  "font-family:Impact,'Anton',Haettenschweiler,Arial Narrow,sans-serif;" +
  'font-weight:900;color:#fff;-webkit-text-stroke:2px #000;' +
  'text-transform:uppercase;line-height:1.05;';

function fill(layer, field, value) {
  if (layer[field] == null) layer[field] = value;
}

function texts(layers) {
  return layers.filter((l) => l.kind === 'text' && l.slot !== '(default)');
}
function images(layers) {
  return layers.filter((l) => l.kind === 'image' && !l.isBackground);
}
function background(layers) {
  return layers.find((l) => l.kind === 'image' && l.isBackground);
}
function bySlotIndex(list) {
  return [...list].sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
}

export function applyPresetToLayers(name, layers, dims) {
  if (name === 'meme') return applyMeme(layers, dims);
  if (name === 'badge') return applyBadge(layers, dims);
  if (name === 'banner') return applyBanner(layers, dims);
  if (name === 'caption') return applyCaption(layers);
  // unknown preset: no-op (forward compatible)
}

function applyMeme(layers, dims) {
  const bg = background(layers);
  if (bg) fill(bg, 'fit', 'cover');
  // Default to large meme-style text scaled to the canvas; an inline font-size
  // on the layer still wins (it sits on the inner node, not this wrapper).
  const fontSize = Math.round(dims.width * 0.1);
  const ts = bySlotIndex(texts(layers));
  ts.forEach((t, i) => {
    if (i === 0) { fill(t, 'place', 'top'); fill(t, 'offsetY', '16'); }
    else if (i === 1) { fill(t, 'place', 'bottom'); fill(t, 'offsetY', '-16'); }
    else { fill(t, 'place', 'center'); }
    t.presetStyle = (t.presetStyle || '') + MEME_TEXT_STYLE + `font-size:${fontSize}px;`;
  });
}

// Distribute items left-to-right, centered horizontally, anchored bottom-center.
export function autoRow(items, { itemW, gap, offsetY }) {
  const n = items.length;
  if (!n) return;
  const span = n * itemW + (n - 1) * gap;
  const start = -span / 2 + itemW / 2; // center x of first item, relative to canvas center
  items.forEach((it, i) => {
    fill(it, 'place', 'bottom-center');
    fill(it, 'offsetX', String(start + i * (itemW + gap)));
    fill(it, 'offsetY', String(offsetY));
    fill(it, 'fit', 'contain');
  });
}

function applyBadge(layers, dims) {
  const h = dims.height;
  const imgs = bySlotIndex(images(layers));
  const ts = bySlotIndex(texts(layers));
  const [avatar, ...badges] = imgs;
  if (avatar) {
    fill(avatar, 'place', 'top-center');
    fill(avatar, 'offsetY', String(Math.round(h * 0.12)));
  }
  if (ts[0]) { fill(ts[0], 'place', 'top-center'); fill(ts[0], 'offsetY', String(Math.round(h * 0.42))); }
  if (ts[1]) { fill(ts[1], 'place', 'top-center'); fill(ts[1], 'offsetY', String(Math.round(h * 0.54))); }
  autoRow(badges, { itemW: 44, gap: 16, offsetY: -Math.round(h * 0.08) });
}

function applyBanner(layers, dims) {
  const h = dims.height;
  const bg = background(layers);
  if (bg) fill(bg, 'fit', 'cover');
  const ts = bySlotIndex(texts(layers));
  if (ts[0]) { fill(ts[0], 'place', 'top'); fill(ts[0], 'offsetY', String(Math.round(h * 0.12))); }
  autoRow(bySlotIndex(images(layers)), { itemW: 56, gap: 18, offsetY: -Math.round(h * 0.1) });
}
function applyCaption() {}

// Synthesize layers for preset="caption" from a semantic <figure>.
// Returns null if no usable figure is found (caller falls back to normal collection).
export function captionLayers(host) {
  const figure = host.querySelector('figure');
  if (!figure) return null;
  const img = figure.querySelector('img');
  const cap = figure.querySelector('figcaption');
  const layers = [];
  if (img) {
    layers.push({ slot: 'background', z: 0, kind: 'image', isBackground: true, node: img, place: null, offsetX: null, offsetY: null, fit: 'cover' });
  }
  if (cap) {
    layers.push({ slot: 'text-1', z: 1, kind: 'text', node: cap, place: 'bottom', offsetX: null, offsetY: null, fit: null, presetStyle: 'display:block;width:100%;box-sizing:border-box;' });
  }
  return layers;
}
