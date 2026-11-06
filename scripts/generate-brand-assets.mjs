import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = path.join(root, 'assets');
const background = '#145B50';
const source = await readFile(path.join(assets, 'brand-mark.svg'));
const monochrome = Buffer.from(
  source.toString().replace(/#(?:E8C77A|F6EEDC|D9A850|145B50)/g, '#FFFFFF'),
);

await mkdir(assets, { recursive: true });

async function renderMark(input, size, output) {
  await sharp(input).resize(size, size).png().toFile(path.join(assets, output));
}

async function renderIcon(size, output) {
  const mark = await sharp(source).resize(size, size).png().toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background },
  })
    .composite([{ input: mark }])
    .png()
    .toFile(path.join(assets, output));
}

await Promise.all([
  renderMark(source, 512, 'brand-mark.png'),
  renderMark(source, 512, 'splash-icon.png'),
  renderMark(source, 1024, 'android-icon-foreground.png'),
  renderMark(monochrome, 1024, 'android-icon-monochrome.png'),
  renderIcon(1024, 'icon.png'),
  renderIcon(64, 'favicon.png'),
  sharp({ create: { width: 1024, height: 1024, channels: 4, background } })
    .png()
    .toFile(path.join(assets, 'android-icon-background.png')),
]);

console.log('Generated Mishkah icon, splash, favicon, and Android adaptive icon assets.');