import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = join(__dirname, '../build/gumroad-cover.svg');
const outPath = join(__dirname, '../build/gumroad-cover.png');

const svg = readFileSync(svgPath);

await sharp(svg)
  .png({ quality: 100 })
  .withMetadata({ density: 72 })
  .toFile(outPath);

console.log('Cover saved to build/gumroad-cover.png (1280x720, 72 DPI)');
