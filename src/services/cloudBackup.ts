import AsyncStorage from '@react-native-async-storage/async-storage';
import { computeUnlockedFeatures } from '../domain/streakRewards';
import { loadPreferences, normalizeAppPreferences, savePreferences, type AppPreferences } from './preferences';
import { readSyncState, writeSyncState } from './syncEngine';

const ENABLED_KEY_PREFIX = 'mishkah.cloud-backup.enabled:';

export interface MishkahCloudBackup extends Record<string, unknown> {
  format: 'lixzon-cloud-backup';
  appId: 'mishkah';
  version: 1;
  exportedAt: string;
  data: {
    preferences: AppPreferences;
    streak: number;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function createMishkahCloudBackup(): Promise<MishkahCloudBackup> {
  const [preferences, syncState] = await Promise.all([loadPreferences(), readSyncState()]);
  return {
    format: 'lixzon-cloud-backup',
    appId: 'mishkah',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      preferences,
      streak: syncState.streak,
    },
  };
}

export function parseMishkahCloudBackup(value: unknown): MishkahCloudBackup {
  if (
    !isRecord(value) ||
    value.format !== 'lixzon-cloud-backup' ||
    value.appId !== 'mishkah' ||
    value.version !== 1 ||
    typeof value.exportedAt !== 'string' ||
    !isRecord(value.data) ||
    typeof value.data.streak !== 'number' ||
    !Number.isInteger(value.data.streak) ||
    value.data.streak < 0 ||
    value.data.streak > 10_000
  ) {
    throw new Error('The cloud backup is invalid or belongs to a different app.');
  }
  return {
    format: 'lixzon-cloud-backup',
    appId: 'mishkah',
    version: 1,
    exportedAt: value.exportedAt,
    data: {
      preferences: normalizeAppPreferences(value.data.preferences),
      streak: value.data.streak,
    },
  };
}

export async function restoreMishkahCloudBackup(value: unknown): Promise<AppPreferences> {
  const backup = parseMishkahCloudBackup(value);
  const preferences = backup.data.preferences;
  await savePreferences(preferences);
  await writeSyncState({
    streak: backup.data.streak,
    featuresUnlocked: computeUnlockedFeatures(backup.data.streak),
  });
  return preferences;
}

export async function isAutomaticCloudBackupEnabled(email: string): Promise<boolean> {
  return (await AsyncStorage.getItem(`${ENABLED_KEY_PREFIX}${email.toLowerCase()}`)) === 'true';
}

export async function enableAutomaticCloudBackup(email: string): Promise<void> {
  await AsyncStorage.setItem(`${ENABLED_KEY_PREFIX}${email.toLowerCase()}`, 'true');
}
