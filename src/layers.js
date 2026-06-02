import { wrapWithTheme } from './theme-bridge.js';
import { resolveAnchor, parseLength, resolveImageBoxCss, imageDrawArgs } from './placement.js';

const SLOT_RE = /^(background|image|text)(?:-(\d+))?$/;

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
      console.warn(`canvas-text: slot="text" requires a number suffix (text-1, text-2, ...). Got slot="${slot}"; layer ignored.`);
      continue;
    }
    const place = child.getAttribute('place');
    const offsetX = child.getAttribute('offset-x');
    const offsetY = child.getAttribute('offset-y');
    const fit = child.getAttribute('fit');
    if (kind === 'background') {
      const img = child.tagName === 'IMG' ? child : child.querySelector('img');
      if (img) {
        layers.push({ slot, z: n ? Number(n) : 0, kind: 'image', isBackground: true, node: img, place, offsetX, offsetY, fit });
      }
    } else if (kind === 'image') {
      const img = child.tagName === 'IMG' ? child : child.querySelector('img');
      if (img) {
        layers.push({ slot, z: Number(n), kind: 'image', isBackground: false, node: img, place, offsetX, offsetY, fit });
      }
    } else {
      layers.push({ slot, z: Number(n), kind: 'text', node: child, place, offsetX, offsetY, fit });
    }
  }
  if (defaultParts.length) {
    const wrapper = document.createElement('div');
    for (const p of defaultParts) wrapper.appendChild(p.cloneNode(true));
    layers.push({ slot: '(default)', z: Number.POSITIVE_INFINITY, kind: 'text', node: wrapper, place: null, offsetX: null, offsetY: null, fit: null });
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
          img.addEventListener('error', () => rej(new Error(`image load failed: ${img.src}`)), { once: true });
        });
      }
      if (img.naturalWidth === 0) {
        throw new Error(`image load failed: ${img.src}`);
      }
      try {
        await img.decode();
      } catch {
        /* tolerated — load/error above is the source of truth */
      }

      const canvasW = width * dpr;
      const canvasH = height * dpr;
      const fit = layer.fit || (layer.isBackground ? 'cover' : 'contain');

      let boxW, boxH;
      if (layer.isBackground) {
        boxW = canvasW;
        boxH = canvasH;
      } else {
        const attrW = numAttr(img, 'width');
        const attrH = numAttr(img, 'height');
        const box = resolveImageBoxCss({ natW: img.naturalWidth, natH: img.naturalHeight, attrW, attrH });
        boxW = box.w * dpr;
        boxH = box.h * dpr;
      }

      const { ax, ay } = resolveAnchor(layer.place);
      const offX = parseLength(layer.offsetX, width) * dpr;
      const offY = parseLength(layer.offsetY, height) * dpr;
      const a = imageDrawArgs({
        natW: img.naturalWidth, natH: img.naturalHeight,
        boxW, boxH, fit, ax, ay, offsetX: offX, offsetY: offY, canvasW, canvasH,
      });
      ctx.drawImage(img, a.sx, a.sy, a.sw, a.sh, a.dx, a.dy, a.dw, a.dh);
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

function numAttr(node, name) {
  const v = node.getAttribute(name);
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
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
