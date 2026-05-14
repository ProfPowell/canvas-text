import { wrapWithTheme } from './theme-bridge.js';

const SLOT_RE = /^(background|text)(?:-(\d+))?$/;

export function collectLayers(host, internalCanvas) {
  const layers = [];
  const defaultParts = [];

  for (const child of host.children) {
    if (child === internalCanvas) continue;
    if (child.tagName === 'CANVAS') continue;
    const slot = child.getAttribute('slot');
    if (!slot) {
      defaultParts.push(child);
      continue;
    }
    const m = SLOT_RE.exec(slot);
    if (!m) continue;
    const [, kind, n] = m;
    const z = kind === 'background' ? (n ? Number(n) : 0) : Number(n);
    if (kind === 'background') {
      const img = child.tagName === 'IMG' ? child : child.querySelector('img');
      if (img) layers.push({ slot, z, kind: 'image', node: img });
    } else {
      layers.push({ slot, z, kind: 'text', node: child });
    }
  }
  if (defaultParts.length) {
    const wrapper = document.createElement('div');
    for (const p of defaultParts) wrapper.appendChild(p.cloneNode(true));
    layers.push({
      slot: '(default)',
      z: Number.POSITIVE_INFINITY,
      kind: 'text',
      node: wrapper,
    });
  }
  layers.sort((a, b) => a.z - b.z || (a.kind === 'image' ? -1 : 1));
  return layers;
}

export async function paintLayer(ctx, layer, opts, renderTag, host, themeMode, onError) {
  const { width, height, dpr } = opts;
  try {
    if (layer.kind === 'image') {
      const img = layer.node;
      if (!img.complete || img.naturalWidth === 0) {
        await new Promise((res, rej) => {
          img.addEventListener('load', res, { once: true });
          img.addEventListener(
            'error',
            () => rej(new Error(`image load failed: ${img.src}`)),
            { once: true }
          );
        });
      }
      // img.decode() may reject on already-broken images; the load/error guard above
      // covers the broken case, so a rejection here is safe to swallow.
      try {
        await img.decode();
      } catch {
        /* tolerated — load/error above is the source of truth */
      }
      ctx.drawImage(img, 0, 0, width * dpr, height * dpr);
    } else {
      const themed = wrapWithTheme(layer.node.outerHTML, host, themeMode);
      // Do not pass height to render-tag for text layers: let it compute natural
      // content height. The result canvas is then stretched to fill the full
      // destination area so the text scales to the composed canvas dimensions.
      const result = renderTag.render({
        html: themed,
        width,
        pixelRatio: dpr,
        accuracy: opts.accuracy,
      });
      ctx.drawImage(result.canvas, 0, 0, width * dpr, height * dpr);
    }
  } catch (error) {
    onError({ slot: layer.slot, error });
  }
}

export async function backgroundImageRatio(host) {
  for (const child of host.children) {
    if (child.getAttribute('slot') === 'background' && child.tagName === 'IMG') {
      if (!child.complete) {
        await new Promise((res) => {
          child.addEventListener('load', res, { once: true });
          child.addEventListener('error', res, { once: true });
        });
      }
      if (child.naturalWidth && child.naturalHeight) {
        return child.naturalHeight / child.naturalWidth;
      }
    }
  }
  return null;
}
