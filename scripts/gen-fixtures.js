import { PNG } from 'pngjs';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

function solidPng(width, height, [r, g, b]) {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (width * y + x) << 2;
      png.data[i] = r;
      png.data[i + 1] = g;
      png.data[i + 2] = b;
      png.data[i + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

const out = resolve(process.cwd(), 'test/fixtures');
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/red-square.png`, solidPng(200, 200, [255, 0, 0]));
writeFileSync(`${out}/blue-square.png`, solidPng(200, 200, [0, 0, 255]));
console.log('fixtures written to', out);
