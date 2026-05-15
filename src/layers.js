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
    if (kind === 'text' && !n) {
      // `slot="text"` (without -N) is ambiguous. Skip with a warning.
      console.warn(`canvas-text: slot="text" requires a number suffix (text-1, text-2, ...). Got slot="${slot}"; layer ignored.`);
      continue;
    }
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
      if (!img.complete) {
        await new Promise((res, rej) => {
          img.addEventListener('load', res, { once: true });
          img.addEventListener(
            'error',
            () => rej(new Error(`image load failed: ${img.src}`)),
            { once: true }
          );
        });
      }
      if (img.naturalWidth === 0) {
        throw new Error(`image load failed: ${img.src}`);
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
      const themed = wrapWithTheme(layer.node.outerHTML, host, themeMode, layer.node);
      // Pass the full target height so CSS positioning inside the layer (e.g.
      // `position:absolute; bottom:20px`) resolves against the composed canvas
      // size. Draw at natural size — no stretching, which would distort text.
      const result = renderTag.render({
        html: themed,
        width,
        height,
        pixelRatio: dpr,
        accuracy: opts.accuracy,
      });
      ctx.drawImage(result.canvas, 0, 0);
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
