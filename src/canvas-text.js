import { render as renderTag } from 'render-tag';

const OBSERVED = ['width', 'height', 'theme', 'lang', 'accuracy', 'dpr', 'format', 'compose', 'alt'];

export class CanvasTextElement extends HTMLElement {
  #canvas = null;
  #renderToken = 0;
  #rafHandle = 0;
  #mo = null;

  static get observedAttributes() {
    return OBSERVED;
  }

  connectedCallback() {
    if (!this.#canvas) {
      this.#canvas = document.createElement('canvas');
      this.#canvas.setAttribute('aria-hidden', 'true');
      this.appendChild(this.#canvas);
    }
    this.#mo = new MutationObserver((records) => {
      const meaningful = records.some(
        (r) =>
          !(
            r.type === 'childList' &&
            [...r.addedNodes, ...r.removedNodes].every((n) => n === this.#canvas)
          )
      );
      if (meaningful) this.#schedule();
    });
    this.#mo.observe(this, { childList: true, subtree: true, characterData: true, attributes: false });
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

  async render() {
    const token = ++this.#renderToken;
    if (!this.#canvas) return;
    if (!this.contains(this.#canvas)) this.appendChild(this.#canvas);
    const start = performance.now();

    const html = this.#readDefaultSlotHTML();
    const width = this.width;

    // Yield to the microtask queue so callers can attach event listeners
    // before canvas-text:rendered fires (render-tag's render() is synchronous).
    await Promise.resolve();
    if (token !== this.#renderToken) return;

    let result;
    try {
      // render-tag's render() is synchronous and returns { canvas, height, layoutRoot, lines }
      result = renderTag({
        html,
        width,
        height: this.height ?? undefined,
        accuracy: this.accuracy,
        pixelRatio: this.dpr,
      });
    } catch (error) {
      this.dispatchEvent(new CustomEvent('canvas-text:error', { detail: { error } }));
      return;
    }

    if (token !== this.#renderToken) return;

    const layerCanvas = result.canvas;
    const height = this.height ?? result.height;
    this.#canvas.width = Math.round(width * this.dpr);
    this.#canvas.height = Math.round(height * this.dpr);
    this.#canvas.style.width = `${width}px`;
    this.#canvas.style.height = `${height}px`;

    const ctx = this.#canvas.getContext('2d');
    ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
    ctx.drawImage(layerCanvas, 0, 0, this.#canvas.width, this.#canvas.height);

    this.setAttribute('data-upgraded', '');
    this.dispatchEvent(
      new CustomEvent('canvas-text:rendered', {
        detail: { width, height, durationMs: performance.now() - start },
      })
    );
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
