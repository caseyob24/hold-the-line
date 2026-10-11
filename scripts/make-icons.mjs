// Renders public/icon.svg to the PNG sizes the manifest and iOS need.
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

const svg = await readFile(new URL('../public/icon.svg', import.meta.url));
for (const size of [180, 192, 512]) {
  await sharp(svg).resize(size, size).png().toFile(new URL(`../public/icon-${size}.png`, import.meta.url).pathname);
}
console.log('icons written');
