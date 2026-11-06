import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { computeUnlockedFeatures } from '../domain/streakRewards';

export { computeUnlockedFeatures } from '../domain/streakRewards';

export type SyncStatus = 'idle' | 'queued' | 'syncing' | 'synced';

export interface SyncEnvelope<T> {
  id: string;
  type: string;
  payload: T;
  updatedAt: number;
  deviceId: string;
}

export interface LinkedAccountState {
  provider: 'google' | 'local';
  email?: string;
  name?: string;
  linked: boolean;
  lastSyncedAt?: number;
}

export interface SyncState {
  status: SyncStatus;
  lastSyncedAt?: number;
  queuedCount: number;
  linkedAccount: LinkedAccountState;
  streak: number;
  featuresUnlocked: string[];
}

export interface FurqanProgressSnapshot {
  currentStreak: number;
  highestStreak?: number;
  lastActiveDate?: string | null;
}

const STORAGE_KEY = 'mishkah.sync.v1';
const QUEUE_KEY = 'mishkah.sync.queue.v1';
const DEVICE_ID = `mishkah-${Math.random().toString(36).slice(2, 10)}`;
const SYNC_API_URL = String(Constants.expoConfig?.extra?.syncApiUrl ?? '').trim();

export function getDeviceId(): string {
  return DEVICE_ID;
}

export async function readSyncState(): Promise<SyncState> {
  const saved = await AsyncStorage.getItem(STORAGE_KEY);
  const parsed = saved ? JSON.parse(saved) : {};
  return {
    status: parsed.status ?? 'idle',
    lastSyncedAt: parsed.lastSyncedAt,
    queuedCount: parsed.queuedCount ?? 0,
    linkedAccount: {
      provider: parsed.linkedAccount?.provider ?? 'local',
      email: parsed.linkedAccount?.email,
      name: parsed.linkedAccount?.name,
      linked: Boolean(parsed.linkedAccount?.linked),
      lastSyncedAt: parsed.linkedAccount?.lastSyncedAt,
    },
    streak: Number(parsed.streak ?? 0),
    featuresUnlocked: Array.isArray(parsed.featuresUnlocked) ? parsed.featuresUnlocked : [],
  };
}

export async function writeSyncState(next: Partial<SyncState>): Promise<void> {
  const current = await readSyncState();
  const merged: SyncState = {
    ...current,
    ...next,
    linkedAccount: {
      ...current.linkedAccount,
      ...next.linkedAccount,
    },
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
}

export async function queueSyncEvent<T>(type: string, payload: T): Promise<void> {
  const queue = await readQueue();
  const entry: SyncEnvelope<T> = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    payload,
    updatedAt: Date.now(),
    deviceId: getDeviceId(),
  };
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([...queue, entry]));
  await writeSyncState({ status: 'queued', queuedCount: (await readQueue()).length });
}

export async function readQueue(): Promise<SyncEnvelope<unknown>[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function flushSyncQueue(idToken: string): Promise<SyncState> {
  const queued = await readQueue();
  if (!queued.length) {
    return readSyncState();
  }

  if (!SYNC_API_URL) {
    throw new Error('Cross-device sync is not configured for this build. Your updates remain queued on this device.');
  }
  if (!idToken) {
    throw new Error('Sign in again before syncing your queued updates.');
  }

  await writeSyncState({ status: 'syncing', queuedCount: queued.length });

  let response: Response;
  try {
    response = await fetch(SYNC_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ deviceId: getDeviceId(), events: queued }),
    });
  } catch {
    await writeSyncState({ status: 'queued', queuedCount: (await readQueue()).length });
    throw new Error('The sync service could not be reached. Your updates remain queued on this device.');
  }

  if (!response.ok) {
    await writeSyncState({ status: 'queued', queuedCount: (await readQueue()).length });
    throw new Error(`The sync service rejected the update (HTTP ${response.status}). Your updates remain queued.`);
  }

  let acceptedIds: string[];
  try {
    const acknowledgement: unknown = await response.json();
    if (
      typeof acknowledgement !== 'object' ||
      acknowledgement === null ||
      !('acceptedIds' in acknowledgement) ||
      !Array.isArray(acknowledgement.acceptedIds) ||
      !acknowledgement.acceptedIds.every((id) => typeof id === 'string')
    ) {
      throw new Error('Invalid sync acknowledgement');
    }
    acceptedIds = acknowledgement.acceptedIds;
  } catch {
    await writeSyncState({ status: 'queued', queuedCount: (await readQueue()).length });
    throw new Error('The sync service returned an invalid acknowledgement. Your updates remain queued.');
  }

  const acceptedIdSet = new Set(acceptedIds);
  const remaining = (await readQueue()).filter((event) => !acceptedIdSet.has(event.id));
  const syncedAt = acceptedIds.length > 0 ? Date.now() : undefined;
  const current = await readSyncState();
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  await writeSyncState({
    status: remaining.length ? 'queued' : 'synced',
    queuedCount: remaining.length,
    ...(syncedAt ? { lastSyncedAt: syncedAt } : {}),
    linkedAccount: syncedAt
      ? { ...current.linkedAccount, lastSyncedAt: syncedAt }
      : current.linkedAccount,
  });

  return readSyncState();
}

function parseFurqanProgress(value: unknown): FurqanProgressSnapshot | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const progress = (record.furqanProgress ?? record.progression ?? record) as Record<string, unknown>;
  const currentStreak = progress.currentStreak;
  if (typeof currentStreak !== 'number' || !Number.isInteger(currentStreak) || currentStreak < 0 || currentStreak > 10_000) {
    return null;
  }
  return {
    currentStreak,
    highestStreak:
      typeof progress.highestStreak === 'number' && Number.isInteger(progress.highestStreak)
        ? Math.max(currentStreak, progress.highestStreak)
        : currentStreak,
    lastActiveDate: typeof progress.lastActiveDate === 'string' ? progress.lastActiveDate : null,
  };
}

export async function refreshFurqanProgress(idToken: string): Promise<SyncState | null> {
  if (!SYNC_API_URL || !idToken) return null;

  const separator = SYNC_API_URL.includes('?') ? '&' : '?';
  const response = await fetch(`${SYNC_API_URL}${separator}resource=furqan-progress`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${idToken}`, Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Furqan progress could not be refreshed (HTTP ${response.status}).`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error('The sync service returned invalid Furqan progress data.');
  }
  const snapshot = parseFurqanProgress(payload);
  if (!snapshot) throw new Error('The sync service returned an invalid streak value.');

  const featuresUnlocked = computeUnlockedFeatures(snapshot.currentStreak);
  const current = await readSyncState();
  await writeSyncState({
    streak: snapshot.currentStreak,
    featuresUnlocked,
    status: current.queuedCount > 0 ? 'queued' : current.status,
  });
  return readSyncState();
}

export async function syncEngagement(streak: number): Promise<SyncState> {
  const nextFeatures = computeUnlockedFeatures(streak);
  const current = await readSyncState();

  if (current.linkedAccount.linked) {
    await queueSyncEvent('streak-sync', { streak, featuresUnlocked: nextFeatures });
    await writeSyncState({
      streak,
      featuresUnlocked: nextFeatures,
      status: 'queued',
      queuedCount: (await readQueue()).length,
    });
    return readSyncState();
  }

  await writeSyncState({
    streak,
    featuresUnlocked: nextFeatures,
    status: 'idle',
    queuedCount: 0,
  });

  return readSyncState();
}

export async function connectGoogleAccount(account: { email?: string; name?: string }): Promise<SyncState> {
  const current = await readSyncState();
  await queueSyncEvent('account-snapshot', {
    streak: current.streak,
    featuresUnlocked: current.featuresUnlocked,
  });
  const queued = await readQueue();
  const linkedAccount = {
    provider: 'google' as const,
    email: account.email,
    name: account.name,
    linked: true,
    lastSyncedAt: current.linkedAccount.lastSyncedAt,
  };

  await writeSyncState({
    linkedAccount,
    status: queued.length ? 'queued' : 'idle',
    queuedCount: queued.length,
  });

  return readSyncState();
}

export async function disconnectGoogleAccount(): Promise<SyncState> {
  const current = await readSyncState();
  await writeSyncState({
    linkedAccount: { provider: 'local', linked: false },
    status: current.queuedCount > 0 ? 'queued' : 'idle',
  });
  return readSyncState();
}
