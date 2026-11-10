import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { computeUnlockedFeatures } from '../domain/streakRewards';
import { getSavedPairCode, isSupabaseSyncConfigured, readPairedRecords } from './cloudSync';
import { readSyncState, writeSyncState, type SyncState } from './syncEngine';

export interface PairedHighlight {
  date: string;
  globalAyah: number;
}

export interface PairedAyahReference {
  surah: number;
  ayah: number;
  name?: string;
}

export interface PairedMemorizedAyah extends PairedAyahReference {
  id: string;
  surahName: string;
  arabic: string;
  translation: string;
  repetitions: number;
  playCount: number;
  memorized: boolean;
  updatedAt: number;
}

export interface PairedQuranProgress {
  lastPosition: PairedAyahReference | null;
  bookmarks: PairedAyahReference[];
  memorizedAyahs: PairedMemorizedAyah[];
}

const HIGHLIGHT_KEY = 'mishkah.quran.paired-highlight.v1';
const QURAN_PROGRESS_KEY = 'mishkah.quran.paired-progress.v1';
const TOTAL_AYAH_COUNT = 6236;

function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isGlobalAyah(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= TOTAL_AYAH_COUNT;
}

function parseAyahReference(value: unknown): PairedAyahReference | null {
  if (
    !isRecord(value) ||
    typeof value.surah !== 'number' ||
    !Number.isInteger(value.surah) ||
    value.surah < 1 ||
    value.surah > 114 ||
    typeof value.ayah !== 'number' ||
    !Number.isInteger(value.ayah) ||
    value.ayah < 1 ||
    value.ayah > 286 ||
    (value.name !== undefined && (typeof value.name !== 'string' || value.name.length > 100))
  ) {
    return null;
  }
  return {
    surah: value.surah,
    ayah: value.ayah,
    ...(typeof value.name === 'string' ? { name: value.name } : {}),
  };
}

function parseBookmarks(value: unknown): PairedAyahReference[] | null {
  if (!Array.isArray(value) || value.length > TOTAL_AYAH_COUNT) return null;
  const parsed = value.map(parseAyahReference);
  if (parsed.some((bookmark) => bookmark === null)) return null;
  const validBookmarks = parsed.filter((bookmark): bookmark is PairedAyahReference => bookmark !== null);
  const unique = new Map(validBookmarks.map((bookmark) => [
    `${bookmark.surah}:${bookmark.ayah}`,
    bookmark,
  ]));
  return [...unique.values()];
}

function parseMemorizedAyah(value: unknown, expectedId?: string): PairedMemorizedAyah | null {
  if (!isRecord(value)) return null;
  const location = parseAyahReference(value);
  if (
    !location ||
    typeof value.id !== 'string' ||
    value.id !== `${location.surah}:${location.ayah}` ||
    (expectedId !== undefined && value.id !== expectedId) ||
    typeof value.surahName !== 'string' ||
    value.surahName.length > 100 ||
    typeof value.arabic !== 'string' ||
    value.arabic.length > 10_000 ||
    typeof value.translation !== 'string' ||
    value.translation.length > 10_000 ||
    typeof value.repetitions !== 'number' ||
    !Number.isInteger(value.repetitions) ||
    value.repetitions < 0 ||
    typeof value.playCount !== 'number' ||
    !Number.isInteger(value.playCount) ||
    value.playCount < 0 ||
    typeof value.memorized !== 'boolean' ||
    typeof value.updatedAt !== 'number' ||
    !Number.isFinite(value.updatedAt)
  ) {
    return null;
  }
  return {
    id: value.id,
    ...location,
    surahName: value.surahName,
    arabic: value.arabic,
    translation: value.translation,
    repetitions: value.repetitions,
    playCount: value.playCount,
    memorized: value.memorized,
    updatedAt: value.updatedAt,
  };
}

async function pairCodeFingerprint(pairCode: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pairCode);
}

async function readCachedQuranProgress(pairCode: string | null): Promise<PairedQuranProgress> {
  if (!pairCode) return { lastPosition: null, bookmarks: [], memorizedAyahs: [] };
  const stored = await AsyncStorage.getItem(QURAN_PROGRESS_KEY);
  if (!stored) return { lastPosition: null, bookmarks: [], memorizedAyahs: [] };
  try {
    const parsed: unknown = JSON.parse(stored);
    if (
      !isRecord(parsed) ||
      parsed.pairCodeFingerprint !== await pairCodeFingerprint(pairCode)
    ) {
      return { lastPosition: null, bookmarks: [], memorizedAyahs: [] };
    }
    const lastPosition = parsed.lastPosition === null ? null : parseAyahReference(parsed.lastPosition);
    const bookmarks = parseBookmarks(parsed.bookmarks);
    if (!bookmarks || (parsed.lastPosition !== null && !lastPosition) || !Array.isArray(parsed.memorizedAyahs)) {
      throw new Error('Cached paired Qur’an progress is malformed.');
    }
    const memorizedAyahs = parsed.memorizedAyahs.map((item) => parseMemorizedAyah(item));
    if (memorizedAyahs.some((item) => item === null)) {
      throw new Error('Cached paired memorization data is malformed.');
    }
    return {
      lastPosition,
      bookmarks,
      memorizedAyahs: memorizedAyahs.filter(
        (item): item is PairedMemorizedAyah => item !== null,
      ),
    };
  } catch (error) {
    console.warn('Mishkah could not read its cached paired Qur’an progress.', error);
    return { lastPosition: null, bookmarks: [], memorizedAyahs: [] };
  }
}

async function writeCachedQuranProgress(pairCode: string, progress: PairedQuranProgress): Promise<void> {
  await AsyncStorage.setItem(QURAN_PROGRESS_KEY, JSON.stringify({
    pairCodeFingerprint: await pairCodeFingerprint(pairCode),
    ...progress,
  }));
}

async function readCachedHighlight(dateKey: string, pairCode: string | null): Promise<number | null> {
  if (!pairCode) return null;
  const stored = await AsyncStorage.getItem(HIGHLIGHT_KEY);
  if (!stored) return null;
  try {
    const parsed: unknown = JSON.parse(stored);
    if (
      isRecord(parsed) &&
      parsed.date === dateKey &&
      parsed.pairCodeFingerprint === await pairCodeFingerprint(pairCode) &&
      isGlobalAyah(parsed.globalAyah)
    ) {
      return parsed.globalAyah;
    }
  } catch {
    return null;
  }
  return null;
}

export async function readPairedHighlight(date = new Date()): Promise<number | null> {
  return readCachedHighlight(utcDateKey(date), await getSavedPairCode());
}

/**
 * Pulls Furqan's streak, Quran library progress, and today's shared verse.
 */
export async function syncPairedData(
  date = new Date(),
): Promise<{ state: SyncState; globalAyah: number | null; quranProgress: PairedQuranProgress }> {
  const dateKey = utcDateKey(date);
  const current = await readSyncState();
  const pairCode = await getSavedPairCode();
  const cachedHighlight = await readCachedHighlight(dateKey, pairCode);
  const cachedQuranProgress = await readCachedQuranProgress(pairCode);
  if (!pairCode || !isSupabaseSyncConfigured()) {
    return {
      state: current,
      globalAyah: cachedHighlight,
      quranProgress: cachedQuranProgress,
    };
  }

  const records = await readPairedRecords(pairCode);
  let streak = current.streak;
  let globalAyah: number | null = null;
  let hasFurqanProgression = false;
  const quranProgress = cachedQuranProgress;
  const memorizedAyahs = new Map<string, PairedMemorizedAyah>();

  for (const record of records) {
    if (record.record_key === 'furqan.progression') {
      hasFurqanProgression = true;
      const value = record.payload.currentStreak;
      if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 10_000) {
        streak = value;
      } else {
        console.warn('Ignored invalid Furqan reading-streak data received from paired sync.');
      }
      if ('lastPosition' in record.payload) {
        quranProgress.lastPosition = record.payload.lastPosition === null
          ? null
          : parseAyahReference(record.payload.lastPosition);
        if (record.payload.lastPosition !== null && !quranProgress.lastPosition) {
          console.warn('Ignored invalid Furqan reading position received from paired sync.');
        }
      }
      if ('bookmarks' in record.payload) {
        const bookmarks = parseBookmarks(record.payload.bookmarks);
        if (bookmarks) quranProgress.bookmarks = bookmarks;
        else console.warn('Ignored invalid Furqan bookmarks received from paired sync.');
      }
      continue;
    }
    if (record.record_key === `quran.daily-highlight:${dateKey}` && isGlobalAyah(record.payload.globalAyah)) {
      globalAyah = record.payload.globalAyah;
      continue;
    }
    const memorizedMatch = /^furqan\.memorized:(\d{1,3}):(\d{1,3})$/.exec(record.record_key);
    if (memorizedMatch) {
      const expectedId = `${Number(memorizedMatch[1])}:${Number(memorizedMatch[2])}`;
      const item = parseMemorizedAyah(record.payload, expectedId);
      if (item) memorizedAyahs.set(item.id, item);
      else console.warn('Ignored invalid Furqan memorization data received from paired sync.');
    }
  }

  if (hasFurqanProgression) {
    quranProgress.memorizedAyahs = [...memorizedAyahs.values()]
      .sort((left, right) => right.updatedAt - left.updatedAt);
    await writeCachedQuranProgress(pairCode, quranProgress);
  }

  const syncedAt = Date.now();
  await writeSyncState({
    streak,
    featuresUnlocked: computeUnlockedFeatures(streak),
    status: 'synced',
    lastSyncedAt: syncedAt,
    linkedAccount: { provider: 'pair', linked: true, lastSyncedAt: syncedAt },
  });

  if (globalAyah !== null) {
    await AsyncStorage.setItem(HIGHLIGHT_KEY, JSON.stringify({
      date: dateKey,
      globalAyah,
      pairCodeFingerprint: await pairCodeFingerprint(pairCode),
    }));
  }

  return {
    state: await readSyncState(),
    globalAyah: globalAyah ?? cachedHighlight,
    quranProgress,
  };
}
