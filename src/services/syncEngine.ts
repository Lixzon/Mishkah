import AsyncStorage from '@react-native-async-storage/async-storage';
import { computeUnlockedFeatures } from '../domain/streakRewards';

export { computeUnlockedFeatures } from '../domain/streakRewards';

export type SyncStatus = 'idle' | 'synced';

export interface LinkedAccountState {
  provider: 'local';
  linked: false;
  lastSyncedAt?: number;
}

export interface SyncState {
  status: SyncStatus;
  lastSyncedAt?: number;
  queuedCount: 0;
  linkedAccount: LinkedAccountState;
  streak: number;
  featuresUnlocked: string[];
}

const STORAGE_KEY = 'manara.guidance.progress.v1';

export async function readSyncState(): Promise<SyncState> {
  const saved = await AsyncStorage.getItem(STORAGE_KEY);
  const parsed: unknown = saved ? JSON.parse(saved) : {};
  const value = typeof parsed === 'object' && parsed !== null
    ? parsed as Record<string, unknown>
    : {};
  const streak = typeof value.streak === 'number' && Number.isInteger(value.streak) && value.streak >= 0
    ? value.streak
    : 0;
  return {
    status: 'idle',
    queuedCount: 0,
    linkedAccount: { provider: 'local', linked: false },
    streak,
    featuresUnlocked: Array.isArray(value.featuresUnlocked)
      ? value.featuresUnlocked.filter((feature): feature is string => typeof feature === 'string')
      : computeUnlockedFeatures(streak),
  };
}

export async function writeSyncState(next: Partial<SyncState>): Promise<void> {
  const current = await readSyncState();
  const streak = next.streak ?? current.streak;
  const merged: SyncState = {
    status: 'idle',
    queuedCount: 0,
    linkedAccount: { provider: 'local', linked: false },
    streak,
    featuresUnlocked: next.featuresUnlocked ?? computeUnlockedFeatures(streak),
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
}

export async function syncEngagement(streak: number): Promise<SyncState> {
  if (!Number.isInteger(streak) || streak < 0) throw new Error('Streak must be a non-negative integer.');
  await writeSyncState({ streak, featuresUnlocked: computeUnlockedFeatures(streak) });
  return readSyncState();
}
