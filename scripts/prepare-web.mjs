import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { generateSW } from 'workbox-build';

const distDirectory = resolve('dist');
const basePath = process.env.GITHUB_PAGES === 'true' ? '/Mishkah/' : '/';
const indexPath = resolve(distDirectory, 'index.html');
const html = await readFile(indexPath, 'utf8');
const sourceIcon = resolve('assets/icon.png');

for (const size of [192, 512]) {
  await sharp(sourceIcon)
    .resize(size, size)
    .png()
    .toFile(resolve(distDirectory, `pwa-${size}.png`));
}

if (!html.includes('</head>')) {
  throw new Error('Expo web export is missing the document head.');
}

const headMarkup = [
  `<link rel="manifest" href="${basePath}manifest.webmanifest" />`,
  `<link rel="apple-touch-icon" href="${basePath}pwa-512.png" />`,
  '<meta name="mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default" />',
  '<meta name="theme-color" content="#145B50" />',
  `<script>if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('${basePath}sw.js',{scope:'${basePath}'}).catch(function(error){console.error('Mishkah offline support could not start.',error);});});}</script>`,
].join('\n    ');

await writeFile(indexPath, html.replace('</head>', `    ${headMarkup}\n  </head>`));

const { count, size, warnings } = await generateSW({
  cacheId: 'mishkah',
  cleanupOutdatedCaches: true,
  globDirectory: distDirectory,
  globPatterns: ['**/*.{html,js,css,json,png,jpg,jpeg,webp,ico,webmanifest,woff,woff2,mp3}'],
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
  modifyURLPrefix: { '': basePath },
  navigateFallback: `${basePath}index.html`,
  swDest: resolve(distDirectory, 'sw.js'),
});

console.log(`Generated Mishkah PWA service worker (${count} files, ${size} bytes).`);
for (const warning of warnings) console.warn(warning);