import AsyncStorage from '@react-native-async-storage/async-storage';
import { computeUnlockedFeatures } from '../domain/streakRewards';
import { getSavedPairCode, isSupabaseSyncConfigured, readPairedRecords } from './cloudSync';
import { readSyncState, writeSyncState, type SyncState } from './syncEngine';

export interface PairedHighlight {
  date: string;
  globalAyah: number;
}

const HIGHLIGHT_KEY = 'mishkah.quran.paired-highlight.v1';
const TOTAL_AYAH_COUNT = 6236;

function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isGlobalAyah(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= TOTAL_AYAH_COUNT;
}

async function readCachedHighlight(dateKey: string): Promise<number | null> {
  const stored = await AsyncStorage.getItem(HIGHLIGHT_KEY);
  if (!stored) return null;
  try {
    const parsed: unknown = JSON.parse(stored);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'date' in parsed &&
      parsed.date === dateKey &&
      'globalAyah' in parsed &&
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
  return readCachedHighlight(utcDateKey(date));
}

/**
 * Pulls Furqan's shared records for this app pairing. The reading streak and
 * today's verse both come from the same record Furqan publishes, so both apps
 * always show the same numbers and the same ayah.
 */
export async function syncPairedData(
  date = new Date(),
): Promise<{ state: SyncState; globalAyah: number | null }> {
  const dateKey = utcDateKey(date);
  const current = await readSyncState();
  const pairCode = await getSavedPairCode();
  if (!pairCode || !isSupabaseSyncConfigured()) {
    return { state: current, globalAyah: await readCachedHighlight(dateKey) };
  }

  const records = await readPairedRecords(pairCode);
  let streak = current.streak;
  let globalAyah: number | null = null;

  for (const record of records) {
    if (record.record_key === 'furqan.progression') {
      const value = record.payload.currentStreak;
      if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 10_000) {
        streak = value;
      }
      continue;
    }
    if (record.record_key === `quran.daily-highlight:${dateKey}` && isGlobalAyah(record.payload.globalAyah)) {
      globalAyah = record.payload.globalAyah;
    }
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
    await AsyncStorage.setItem(HIGHLIGHT_KEY, JSON.stringify({ date: dateKey, globalAyah }));
  }

  return { state: await readSyncState(), globalAyah: globalAyah ?? (await readCachedHighlight(dateKey)) };
}
