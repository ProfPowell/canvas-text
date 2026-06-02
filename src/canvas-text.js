import * as renderTag from 'render-tag';
import { wrapWithTheme } from './theme-bridge.js';
import { collectLayers, paintLayer, backgroundImageRatio } from './layers.js';
import { applyPresetToLayers, captionLayers } from './presets.js';

const OBSERVED = ['width', 'height', 'theme', 'lang', 'accuracy', 'dpr', 'format', 'compose', 'alt', 'preset'];

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected || typeof document === 'undefined') return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.dataset.canvasTextStyle = '';
  style.textContent = `
    canvas-text { display: inline-block; position: relative; }
    canvas-text > :not(canvas) {
      position: absolute !important;
      clip-path: inset(50%) !important;
      width: 1px !important;
      height: 1px !important;
      overflow: hidden !important;
      white-space: nowrap !important;
    }
    canvas-text > canvas { display: block; position: relative; }
  `;
  document.head.appendChild(style);
}

export class CanvasTextElement extends HTMLElement {
  #canvas = null;
  #renderToken = 0;
  #rafHandle = 0;
  #mo = null;

  static get observedAttributes() {
    return OBSERVED;
  }

  connectedCallback() {
    injectStyles();
    if (!this.#canvas) {
      this.#canvas = document.createElement('canvas');
      this.#canvas.setAttribute('aria-hidden', 'true');
      this.appendChild(this.#canvas);
    }
    this.#mo = new MutationObserver((records) => {
      const meaningful = records.some(
        (r) =>
          !(
            (r.type === 'childList' &&
              [...r.addedNodes, ...r.removedNodes].every((n) => n === this.#canvas)) ||
            (r.type === 'attributes' && r.target === this.#canvas)
          )
      );
      if (meaningful) this.#schedule();
    });
    this.#mo.observe(this, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['src', 'slot', 'style', 'class', 'srcset', 'crossorigin', 'place', 'offset-x', 'offset-y', 'fit', 'width', 'height'],
    });
    this.#schedule();
  }

  disconnectedCallback() {
    this.#mo?.disconnect();
    this.#mo = null;
    if (this.#rafHandle) {
      cancelAnimationFrame(this.#rafHandle);
      this.#rafHandle = 0;
    }
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (oldVal === newVal) return;
    this.#schedule();
  }

  #schedule() {
    if (this.#rafHandle) return;
    this.#rafHandle = requestAnimationFrame(() => {
      this.#rafHandle = 0;
      this.render();
    });
  }

  get width() {
    return this.#numAttr('width', 600);
  }
  get height() {
    return this.#numAttr('height', null);
  }
  get compose() {
    return this.getAttribute('compose') || 'slots';
  }
  get accuracy() {
    return this.getAttribute('accuracy') || 'default';
  }
  get lang() {
    return this.getAttribute('lang') || document.documentElement.lang || 'en';
  }
  get dpr() {
    const v = this.getAttribute('dpr');
    if (v == null || v === 'auto') return window.devicePixelRatio || 1;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }

  #numAttr(name, fallback) {
    const v = this.getAttribute(name);
    const n = v == null ? NaN : Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  getCanvas() {
    return this.#canvas;
  }

  get format() {
    return this.getAttribute('format') || 'png';
  }

  #mimeFor(type) {
    if (type) return type;
    const f = this.format;
    return f === 'jpeg' ? 'image/jpeg' : f === 'webp' ? 'image/webp' : 'image/png';
  }

  toDataURL(type, quality) {
    return this.#canvas.toDataURL(this.#mimeFor(type), quality);
  }

  toBlob(type, quality) {
    return new Promise((resolve, reject) => {
      this.#canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('canvas-text: toBlob returned null'))),
        this.#mimeFor(type),
        quality
      );
    });
  }

  set html(value) {
    // Replace unslotted children only; preserve slotted layers and the internal canvas.
    for (const child of [...this.childNodes]) {
      if (child === this.#canvas) continue;
      if (child.nodeType === 1 && child.hasAttribute('slot')) continue;
      this.removeChild(child);
    }
    this.insertAdjacentHTML('afterbegin', String(value));
  }

  get html() {
    const parts = [];
    for (const child of this.childNodes) {
      if (child === this.#canvas) continue;
      if (child.nodeType === 1 && child.hasAttribute('slot')) continue;
      if (child.nodeType === 1) parts.push(child.outerHTML);
      else if (child.nodeType === 3) parts.push(child.textContent);
    }
    return parts.join('');
  }

  async render() {
    const token = ++this.#renderToken;
    if (!this.#canvas) return;
    if (!this.contains(this.#canvas)) this.appendChild(this.#canvas);
    const start = performance.now();

    // Yield to the microtask queue so callers can attach event listeners
    // before canvas-text:rendered fires (render-tag's render() is synchronous).
    await Promise.resolve();
    if (token !== this.#renderToken) return;

    const dpr = this.dpr;
    const width = this.width;
    const themeMode = this.getAttribute('theme') || 'inherit';

    let height = this.height;
    if (height == null) {
      const ratio = await backgroundImageRatio(this);
      if (token !== this.#renderToken) return;
      if (ratio != null) height = width * ratio;
    }

    if (this.compose === 'text-only') {
      const html = this.#readDefaultSlotHTML();
      let result;
      try {
        // render-tag's render() is synchronous and returns { canvas, height, layoutRoot, lines }
        const themed = wrapWithTheme(html, this, themeMode);
        result = renderTag.render({
          html: themed,
          width,
          height: height ?? undefined,
          pixelRatio: dpr,
          accuracy: this.accuracy,
        });
      } catch (error) {
        this.dispatchEvent(new CustomEvent('canvas-text:error', { detail: { error } }));
        return;
      }
      if (token !== this.#renderToken) return;
      height = height ?? result.height / dpr;
      this.#sizeCanvas(width, height, dpr);
      const ctx = this.#canvas.getContext('2d');
      ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
      ctx.drawImage(result.canvas, 0, 0, this.#canvas.width, this.#canvas.height);
    } else {
      // Layer pipeline (compose='slots' or any unrecognized value).
      const preset = this.getAttribute('preset');
      let layers;
      if (preset === 'caption') {
        layers = captionLayers(this) || collectLayers(this, this.#canvas);
      } else {
        layers = collectLayers(this, this.#canvas);
        if (preset) applyPresetToLayers(preset, layers, { width, height });
      }
      if (height == null) height = width;
      this.#sizeCanvas(width, height, dpr);
      const ctx = this.#canvas.getContext('2d');
      ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);

      const onError = (detail) =>
        this.dispatchEvent(new CustomEvent('canvas-text:layer-error', { detail }));
      for (const layer of layers) {
        if (token !== this.#renderToken) return;
        await paintLayer(
          ctx,
          layer,
          { width, height, dpr, accuracy: this.accuracy },
          renderTag,
          this,
          themeMode,
          onError
        );
      }
    }

    if (token !== this.#renderToken) return;

    // Sync alt → aria-label on canvas, and toggle aria-hidden on fallback children.
    const alt = this.getAttribute('alt');
    if (alt) {
      this.#canvas.setAttribute('aria-label', alt);
      for (const child of this.children) {
        if (child === this.#canvas) continue;
        child.setAttribute('aria-hidden', 'true');
      }
    } else {
      this.#canvas.removeAttribute('aria-label');
      for (const child of this.children) {
        if (child === this.#canvas) continue;
        child.removeAttribute('aria-hidden');
      }
    }

    this.setAttribute('data-upgraded', '');
    this.dispatchEvent(
      new CustomEvent('canvas-text:rendered', {
        detail: { width, height, durationMs: performance.now() - start },
      })
    );
  }

  #sizeCanvas(width, height, dpr) {
    this.#canvas.width = Math.round(width * dpr);
    this.#canvas.height = Math.round(height * dpr);
    this.#canvas.style.width = `${width}px`;
    this.#canvas.style.height = `${height}px`;
  }

  #readDefaultSlotHTML() {
    const html = [];
    for (const node of this.childNodes) {
      if (node.nodeType === 1 && node.tagName === 'CANVAS') continue;
      if (node.nodeType === 1 && node.hasAttribute('slot')) continue;
      if (node.nodeType === 1) html.push(node.outerHTML);
      else if (node.nodeType === 3) html.push(node.textContent);
    }
    return html.join('').trim() || '&nbsp;';
  }
}
