import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

export interface DailyVerse {
  dateKey: string;
  globalAyah: number;
  surahNumber: number;
  surahName: string;
  ayahNumber: number;
  arabic: string;
  translation: string;
}

interface SurahMetadata {
  number: number;
  englishName: string;
  numberOfAyahs: number;
}

interface SurahPayload {
  ayahs: Array<{
    i: number;
    ar: string;
    tr: string;
  }>;
}

const STORAGE_PREFIX = 'mishkah.quran.daily-verse.v1';
const TOTAL_AYAH_COUNT = 6236;

function localDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function globalAyahForDate(date: Date): number {
  const dayOfYear = Math.floor(
    (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) -
      Date.UTC(date.getFullYear(), 0, 1)) /
      86_400_000,
  );
  return (dayOfYear % TOTAL_AYAH_COUNT) + 1;
}

function globalAyahForDateKey(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  return globalAyahForDate(new Date(year, month - 1, day, 12));
}

function isSurahMetadata(value: unknown): value is SurahMetadata {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return Number.isInteger(record.number) &&
    typeof record.englishName === 'string' &&
    Number.isInteger(record.numberOfAyahs) &&
    Number(record.numberOfAyahs) > 0;
}

function isSurahPayload(value: unknown): value is SurahPayload {
  if (typeof value !== 'object' || value === null || !('ayahs' in value)) return false;
  return Array.isArray(value.ayahs) && value.ayahs.every((ayah) =>
    typeof ayah === 'object' &&
    ayah !== null &&
    Number.isInteger(ayah.i) &&
    typeof ayah.ar === 'string' &&
    typeof ayah.tr === 'string',
  );
}

function cachedVerse(value: string | null, dateKey: string): DailyVerse | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'dateKey' in parsed &&
      parsed.dateKey === dateKey &&
      'surahNumber' in parsed &&
      Number.isInteger(parsed.surahNumber) &&
      'surahName' in parsed &&
      typeof parsed.surahName === 'string' &&
      'ayahNumber' in parsed &&
      Number.isInteger(parsed.ayahNumber) &&
      'arabic' in parsed &&
      typeof parsed.arabic === 'string' &&
      'translation' in parsed &&
      typeof parsed.translation === 'string'
    ) {
      return {
        dateKey,
        globalAyah: 'globalAyah' in parsed && Number.isInteger(parsed.globalAyah)
          ? Number(parsed.globalAyah)
          : globalAyahForDateKey(dateKey),
        surahNumber: parsed.surahNumber as number,
        surahName: parsed.surahName,
        ayahNumber: parsed.ayahNumber as number,
        arabic: parsed.arabic,
        translation: parsed.translation,
      };
    }
  } catch {
    return null;
  }
  return null;
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Furqan could not load its Quran data (HTTP ${response.status}).`);
  return response.json();
}

export async function getDailyVerse(
  date = new Date(),
  forceRefresh = false,
  pairedGlobalAyah: number | null = null,
): Promise<DailyVerse> {
  const dateKey = localDateKey(date);
  const storageKey = `${STORAGE_PREFIX}:${dateKey}`;
  const requestedAyah = pairedGlobalAyah !== null &&
    Number.isInteger(pairedGlobalAyah) &&
    pairedGlobalAyah >= 1 &&
    pairedGlobalAyah <= TOTAL_AYAH_COUNT
    ? pairedGlobalAyah
    : null;
  if (!forceRefresh) {
    const cached = cachedVerse(await AsyncStorage.getItem(storageKey), dateKey);
    if (cached && (requestedAyah === null || cached.globalAyah === requestedAyah)) return cached;
  }

  const baseUrl = String(Constants.expoConfig?.extra?.furqanBaseUrl ?? '').trim();
  if (!baseUrl) throw new Error('The Furqan Quran source is not configured for this build.');
  const root = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const metadataValue = await fetchJson(new URL('data/meta/surahs.json', root).toString());
  if (!Array.isArray(metadataValue) || !metadataValue.every(isSurahMetadata)) {
    throw new Error('Furqan returned invalid surah metadata.');
  }

  const globalAyah = requestedAyah ?? globalAyahForDate(date);
  let cumulativeAyahs = 0;
  const selectedSurah = metadataValue.find((surah) => {
    cumulativeAyahs += surah.numberOfAyahs;
    return cumulativeAyahs >= globalAyah;
  });
  if (!selectedSurah) throw new Error('Furqan could not match today’s verse to a surah.');
  const ayahNumber = selectedSurah.numberOfAyahs - (cumulativeAyahs - globalAyah);
  const payloadValue = await fetchJson(
    new URL(`data/surah/${selectedSurah.number}.json`, root).toString(),
  );
  if (!isSurahPayload(payloadValue)) throw new Error('Furqan returned invalid Quran text.');
  const ayah = payloadValue.ayahs[ayahNumber - 1];
  if (!ayah || ayah.i !== ayahNumber) throw new Error('Furqan did not return the selected verse.');

  const result: DailyVerse = {
    dateKey,
    globalAyah,
    surahNumber: selectedSurah.number,
    surahName: selectedSurah.englishName,
    ayahNumber,
    arabic: ayah.ar,
    translation: ayah.tr,
  };
  await AsyncStorage.setItem(storageKey, JSON.stringify(result));
  return result;
}
