// Docs entry. Loads the site infrastructure (vanilla-breeze theme system,
// theme-picker), the canvas-text element so any <canvas-text> on the page
// upgrades, and code-block / browser-window for snippet display.
// render-tag stays a runtime importmap dep — do NOT import it here.
import 'vanilla-breeze';
import 'vanilla-breeze/css';
import '@profpowell/code-block';
import '@profpowell/browser-window';
import '../dist/canvas-text.js';
