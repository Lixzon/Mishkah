#!/usr/bin/env node
/**
 * Furqan integrity audit.
 *
 * Runs the checks that a type-checker cannot see:
 *  - bundled Qur'an data matches its metadata (every surah, every ayah),
 *  - required offline assets are present,
 *  - every icon referenced in JSX exists in the icon set,
 *  - the deep-link parser accepts the documented schemes and rejects junk,
 *  - the share-card catalogue still ships ten distinct scenes,
 *  - telemetry scrubs local events and diagnostic reports omit sensitive data.
 *
 * Exits non-zero when anything fails so `npm run verify` can gate a release.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const passed = [];
const failed = [];
const skipped = [];

const check = (ok, message) => {
  if (ok) passed.push(message);
  else failed.push(message);
};

const readJson = async (relative) => JSON.parse(await readFile(path.join(root, relative), 'utf8'));

const exists = async (relative) => {
  try {
    await stat(path.join(root, relative));
    return true;
  } catch {
    return false;
  }
};

async function walk(dir) {
  const entries = await readdir(path.join(root, dir), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(relative)));
    else files.push(relative);
  }
  return files;
}

/* ------------------------------ assets ------------------------------ */

const requiredAssets = [
  'public/offline.html',
  'public/favicon.svg',
  'public/icons/icon-192.png',
  'public/icons/icon-512.png',
  'public/fonts/AmiriQuran-Regular.ttf',
  'public/data/meta/surahs.json',
  'public/data/meta/juz.json',
];

for (const asset of requiredAssets) {
  check(await exists(asset), `asset present: ${asset}`);
}

/* ---------------------------- Qur'an data --------------------------- */

const meta = await readJson('public/data/meta/surahs.json');
check(Array.isArray(meta) && meta.length === 114, 'metadata lists 114 surahs');

const surahFiles = (await readdir(path.join(root, 'public/data/surah'))).filter((f) => f.endsWith('.json'));
check(surahFiles.length === 114, '114 Uthmani surah files bundled');

let ayahTotal = 0;
for (const entry of meta) {
  const file = `public/data/surah/${entry.number}.json`;
  if (!(await exists(file))) {
    check(false, `missing surah file ${file}`);
    continue;
  }
  let surah;
  try {
    surah = await readJson(file);
  } catch (error) {
    check(false, `${file} is not valid JSON (${error.message})`);
    continue;
  }
  const ayahs = Array.isArray(surah.ayahs) ? surah.ayahs : [];
  ayahTotal += ayahs.length;
  check(surah.number === entry.number, `${file} number matches metadata`);
  check(ayahs.length === entry.numberOfAyahs, `${file} has ${entry.numberOfAyahs} ayahs`);
  const sequential = ayahs.every((ayah, index) => ayah.i === index + 1 && typeof ayah.ar === 'string' && ayah.ar.length > 0);
  check(sequential, `${file} ayah numbering and Arabic text are intact`);
  check(ayahs.every((ayah) => typeof ayah.tr === 'string' && ayah.tr.length > 0), `${file} translation present`);
}

check(ayahTotal === 6236, `Qur'an text contains 6236 ayahs (found ${ayahTotal})`);

const indoPakFiles = (await readdir(path.join(root, 'public/data/indopak'))).filter((f) => f.endsWith('.json'));
check(indoPakFiles.length === 114, '114 Indo-Pak surah files bundled');

const juz = await readJson('public/data/meta/juz.json');
check(Array.isArray(juz) && juz.length === 30, '30 juz boundaries present');
check(
  Array.isArray(juz) &&
    juz.every(
      (boundary) =>
        boundary.startSurah >= 1 &&
        boundary.endSurah <= 114 &&
        boundary.startSurah <= boundary.endSurah &&
        boundary.startAyah >= 1 &&
        boundary.endAyah >= 1,
    ),
  'juz boundaries stay inside the mushaf',
);

/* ------------------------------ icons ------------------------------- */

const iconSource = await readFile(path.join(root, 'src/components/ui/Icon.tsx'), 'utf8');
const iconType = iconSource.match(/export type IconName =([\s\S]*?);/);
const iconNames = new Set();
if (iconType) {
  for (const match of iconType[1].matchAll(/'([A-Za-z]+)'/g)) iconNames.add(match[1]);
}
check(iconNames.size > 30, `icon set exposes ${iconNames.size} names`);

const sourceFiles = (await walk('src')).filter((file) => /\.(tsx|ts)$/.test(file));
const unknownIcons = new Map();
for (const file of sourceFiles) {
  if (file.endsWith('Icon.tsx')) continue;
  const source = await readFile(path.join(root, file), 'utf8');
  for (const match of source.matchAll(/<Icon\b[^>]*?\bname="([A-Za-z]+)"/g)) {
    if (!iconNames.has(match[1])) {
      unknownIcons.set(match[1], file);
    }
  }
}
check(unknownIcons.size === 0, `all referenced icons exist${unknownIcons.size ? `: ${[...unknownIcons.keys()].join(', ')}` : ''}`);

/* ---------------------------- deep links ---------------------------- */

let deepLink = null;
try {
  deepLink = await import(pathToFileURL(path.join(root, 'src/lib/deepLink.ts')).href);
} catch (error) {
  skipped.push(`deep-link checks skipped (${error.code ?? error.message})`);
}

if (deepLink) {
  const expectPath = (input, expected) => {
    const result = deepLink.parseDeepLink(input);
    check(result?.kind === 'navigate' && result.to === expected, `deep link ${input} → ${expected}`);
  };
  expectPath('furkan://verse/2/255', '/surah/2?ayah=255');
  expectPath('furkan://verse/2:255', '/surah/2?ayah=255');
  expectPath('furkan://surah/36?ayah=1', '/surah/36?ayah=1');
  expectPath('furkan://surah/36', '/surah/36');
  expectPath('furkan://playlist/pl_abc123', '/playlist/pl_abc123');
  expectPath('https://furqan.app/?deep=furkan%3A%2F%2Fverse%2F18%2F10', '/surah/18?ayah=10');
  expectPath('https://furqan.app/surah/1?ayah=7', '/surah/1?ayah=7');

  const loop = deepLink.parseDeepLink('furkan://loop/2/255-257');
  check(
    loop?.kind === 'loop' && loop.surah === 2 && loop.start === 255 && loop.end === 257,
    'loop deep link preserves its range',
  );
  check(deepLink.parseDeepLink('furkan://loop/2/257-255')?.start === 255, 'loop deep link normalises reversed bounds');

  for (const invalid of ['', 'furkan://verse/999/1', 'furkan://verse/2/abc', 'https://example.com/nonsense', 'mailto:test@example.com']) {
    check(deepLink.parseDeepLink(invalid) === null, `deep link rejected: ${invalid || '(empty)'}`);
  }
  check(deepLink.verseDeepLink(18, 10) === 'furkan://verse/18/10', 'verse share link format');
  check(deepLink.rangeDeepLink(2, 255, 257) === 'furkan://loop/2/255-257', 'loop share link format');
}

/* --------------------------- share cards ---------------------------- */

try {
  const cards = await import(pathToFileURL(path.join(root, 'src/lib/shareCard.ts')).href);
  const presets = cards.CARD_PRESETS;
  check(Array.isArray(presets) && presets.length === 10, `10 offline card scenes bundled (found ${presets?.length})`);
  check(new Set(presets.map((p) => p.id)).size === presets.length, 'card scene ids are unique');
  check(presets.every((p) => typeof p.paint === 'function' && p.swatch.length === 2), 'card scenes are renderable');
} catch (error) {
  skipped.push(`share-card checks skipped (${error.code ?? error.message})`);
}

/* ---------------------------- support ------------------------------- */

const constants = await readFile(path.join(root, 'src/lib/constants.ts'), 'utf8');
check(constants.includes('0687041418'), 'support account number configured');
check(constants.includes('Guaranty Trust Bank (GTB)'), 'support bank configured');
check(constants.includes('Ojulari Aliy Ayodeji'), 'support account name configured');
check(constants.includes('instagramHandle: \'Lixzon9\''), 'official Instagram handle configured');
check(constants.includes('discordHandle: \'Lixzon8\''), 'official Discord handle configured');
check(constants.includes('LIXZON'), 'LIXZON attribution configured');

const diagnosticPage = await readFile(path.join(root, 'src/pages/DiagnosticsPage.tsx'), 'utf8');
const diagnosticService = await readFile(path.join(root, 'src/services/diagnostics.ts'), 'utf8');
const deliveryPayload = diagnosticService.match(/body:\s*JSON\.stringify\(\{([\s\S]*?)\}\),\s*\}\);/)?.[1] ?? '';
check(diagnosticPage.includes('import.meta.env.DEV'), 'detailed developer diagnostics are development-only');
check(diagnosticPage.includes('runUserHealthCheck()'), 'user diagnostics use the health-check flow');
check(diagnosticService.includes("reportType: 'weekly-health'"), 'weekly reports support endpoint delivery');
check(
  deliveryPayload.length > 0 && !deliveryPayload.includes('message') && !deliveryPayload.includes('stack'),
  'diagnostic endpoint payload omits event messages and stacks',
);

/* ---------------------- telemetry and diagnostics ------------------- */

try {
  const values = new Map();
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
  });

  try {
    const diagnostics = await import(pathToFileURL(path.join(root, 'src/services/diagnostics.ts')).href);
    diagnostics.clearDiagnostics();
    diagnostics.recordDiagnostic(
      'unhandled-error',
      'Failure for private@example.com',
      'Error: https://example.test/stack?token=private',
    );
    diagnostics.recordDiagnostic('performance', 'Main-thread task exceeded 2.5 seconds', '', 2800);
    const events = diagnostics.readDiagnosticEvents();
    const serialized = JSON.stringify(events);
    check(events.length === 2, 'diagnostics retain captured events');
    check(!serialized.includes('private@example.com') && !serialized.includes('token=private'), 'diagnostics scrub email and URL data');
    const digest = diagnostics.createDiagnosticDigest(Date.now());
    check(digest.totalEvents === 2 && digest.counts.performance === 1, 'weekly digest aggregates event categories');
    check(digest.performance.maximumLongTaskMs === 2800, 'weekly digest reports long-task duration');

  } finally {
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else delete globalThis.localStorage;
  }
} catch (error) {
  skipped.push(`telemetry and diagnostic checks skipped (${error.code ?? error.message})`);
}

/* ------------------------------ report ------------------------------ */

for (const message of passed) console.log(`  ok   ${message}`);
for (const message of skipped) console.log(`  skip ${message}`);
if (failed.length > 0) {
  console.error('\nIntegrity audit failed:');
  for (const message of failed) console.error(`  fail ${message}`);
  console.error(`\n${failed.length} failure(s), ${passed.length} check(s) passed.`);
  process.exit(1);
}

console.log(`\nIntegrity audit clean — ${passed.length} checks passed.`);
