import { CanvasTextElement } from './canvas-text.js';

if (!customElements.get('canvas-text')) {
  customElements.define('canvas-text', CanvasTextElement);
}

export { CanvasTextElement };
