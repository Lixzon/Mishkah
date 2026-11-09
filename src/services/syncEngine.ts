import AsyncStorage from '@react-native-async-storage/async-storage';
import { computeUnlockedFeatures } from '../domain/streakRewards';
import {
  getSavedPairCode,
  isSupabaseSyncConfigured,
  upsertPairedRecords,
} from './cloudSync';

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
  provider: 'pair' | 'local';
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

const STORAGE_KEY = 'mishkah.sync.v1';
const QUEUE_KEY = 'mishkah.sync.queue.v1';
const DEVICE_ID = `mishkah-${Math.random().toString(36).slice(2, 10)}`;

export function isCrossDeviceSyncConfigured(): boolean {
  return isSupabaseSyncConfigured();
}

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
      provider: parsed.linkedAccount?.provider === 'pair' ? 'pair' : 'local',
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

export async function flushSyncQueue(): Promise<SyncState> {
  const queued = await readQueue();
  const pairCode = await getSavedPairCode();
  if (!queued.length) {
    return readSyncState();
  }

  if (!isSupabaseSyncConfigured()) {
    throw new Error('Cross-device sync is not configured for this build. Your updates remain queued on this device.');
  }
  if (!pairCode) {
    throw new Error('Pair Mishkah with Furqan before syncing your queued updates.');
  }

  await writeSyncState({ status: 'syncing', queuedCount: queued.length });

  if (isSupabaseSyncConfigured()) {
    try {
      const records = new Map<string, Record<string, unknown>>();
      for (const event of queued) {
        if (event.type !== 'streak-sync' && event.type !== 'account-snapshot') {
          throw new Error(`Unsupported queued sync event: ${event.type}`);
        }
        if (typeof event.payload !== 'object' || event.payload === null || Array.isArray(event.payload)) {
          throw new Error(`Invalid queued sync payload for ${event.type}.`);
        }
        const payload = event.payload as Record<string, unknown>;
        if (
          typeof payload.streak !== 'number' ||
          !Number.isInteger(payload.streak) ||
          payload.streak < 0
        ) {
          throw new Error(`Invalid streak value in queued ${event.type}.`);
        }
        records.set('mishkah.engagement', {
          currentStreak: payload.streak,
          featuresUnlocked: Array.isArray(payload.featuresUnlocked)
            ? payload.featuresUnlocked.filter((feature): feature is string => typeof feature === 'string')
            : computeUnlockedFeatures(payload.streak),
          source: 'mishkah',
        });
      }

      const batch = [...records].map(([record_key, payload]) => ({ record_key, payload }));
      await upsertPairedRecords(pairCode, batch);

      const queuedIds = new Set(queued.map((event) => event.id));
      const remaining = (await readQueue()).filter((event) => !queuedIds.has(event.id));
      const syncedAt = Date.now();
      const current = await readSyncState();
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
      await writeSyncState({
        status: remaining.length ? 'queued' : 'synced',
        queuedCount: remaining.length,
        lastSyncedAt: syncedAt,
        linkedAccount: { ...current.linkedAccount, lastSyncedAt: syncedAt },
      });
      return readSyncState();
    } catch (error) {
      await writeSyncState({ status: 'queued', queuedCount: (await readQueue()).length });
      throw error;
    }
  }

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

export async function linkPairedAccount(): Promise<SyncState> {
  const current = await readSyncState();
  await queueSyncEvent('account-snapshot', {
    streak: current.streak,
    featuresUnlocked: current.featuresUnlocked,
  });
  const queued = await readQueue();
  const linkedAccount = {
    provider: 'pair' as const,
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

export async function unlinkPairedAccount(): Promise<SyncState> {
  const current = await readSyncState();
  await writeSyncState({
    linkedAccount: { provider: 'local', linked: false },
    status: current.queuedCount > 0 ? 'queued' : 'idle',
  });
  return readSyncState();
}
