import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = join(__dirname, '../build/logo.svg');
const outPath = join(__dirname, '../build/logo.png');

const svg = readFileSync(svgPath);

await sharp(svg)
  .png()
  .toFile(outPath);

console.log('Logo saved to build/logo.png');
