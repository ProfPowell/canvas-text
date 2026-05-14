export class CanvasTextElement extends HTMLElement {
  connectedCallback() {
    this.setAttribute('data-upgraded', '');
  }
}
