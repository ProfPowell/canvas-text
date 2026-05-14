export declare class CanvasTextElement extends HTMLElement {
  width: number;
  height: number;
  theme: 'inherit' | 'none' | 'inline';
  accuracy: 'default' | 'balanced';
  lang: string;
  dpr: number | 'auto';
  format: 'png' | 'jpeg' | 'webp';
  compose: 'slots' | 'text-only';
  alt: string;
  html: string;

  getCanvas(): HTMLCanvasElement;
  toBlob(type?: string, quality?: number): Promise<Blob>;
  toDataURL(type?: string, quality?: number): string;
  render(): Promise<void>;
}

declare global {
  interface HTMLElementTagNameMap {
    'canvas-text': CanvasTextElement;
  }
}
