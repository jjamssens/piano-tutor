// Converts build/icon.svg → build/icon.png (512×512)
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath  = resolve(__dirname, '../build/icon.svg');
const pngPath  = resolve(__dirname, '../build/icon.png');

const svg = readFileSync(svgPath);
await sharp(svg).resize(512, 512).png().toFile(pngPath);
console.log('✓ build/icon.png written (512×512)');
