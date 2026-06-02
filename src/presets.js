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
function background(layers) {
  return layers.find((l) => l.kind === 'image' && l.isBackground);
}
function bySlotIndex(list) {
  return [...list].sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
}

export function applyPresetToLayers(name, layers, ctx) {
  if (name === 'meme') return applyMeme(layers);
  if (name === 'badge') return applyBadge(layers, ctx);
  if (name === 'banner') return applyBanner(layers, ctx);
  if (name === 'caption') return applyCaption(layers);
  // unknown preset: no-op (forward compatible)
}

function applyMeme(layers) {
  const bg = background(layers);
  if (bg) fill(bg, 'fit', 'cover');
  const ts = bySlotIndex(texts(layers));
  ts.forEach((t, i) => {
    if (i === 0) { fill(t, 'place', 'top'); fill(t, 'offsetY', '16'); }
    else if (i === 1) { fill(t, 'place', 'bottom'); fill(t, 'offsetY', '-16'); }
    else { fill(t, 'place', 'center'); }
    t.presetStyle = (t.presetStyle || '') + MEME_TEXT_STYLE;
  });
}

// applyBadge, applyBanner, applyCaption are added in later tasks.
function applyBadge() {}
function applyBanner() {}
function applyCaption() {}
