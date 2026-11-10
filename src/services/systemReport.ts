import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSavedPairCode } from './cloudSync';
import { readPairedHighlight } from './pairSync';
import { checkPreferencesStorage } from './preferences';

export interface SystemReportItem {
  label: string;
  ok: boolean;
  detail: string;
}

export interface SystemReport {
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  items: SystemReportItem[];
}

const LEGACY_REPORT_KEY = 'mishkah.system-report.v1';
const PROBE_KEY = 'mishkah.system-report.probe';

export async function discardStoredSystemReport(): Promise<void> {
  await AsyncStorage.removeItem(LEGACY_REPORT_KEY);
}

export async function createSystemReport(): Promise<SystemReport> {
  const startedAt = Date.now();
  const items: SystemReportItem[] = [];

  let storageOk = false;
  try {
    await AsyncStorage.setItem(PROBE_KEY, 'ok');
    storageOk = (await AsyncStorage.getItem(PROBE_KEY)) === 'ok';
    await AsyncStorage.removeItem(PROBE_KEY);
  } catch {
    storageOk = false;
  }
  items.push({
    label: 'Device storage',
    ok: storageOk,
    detail: storageOk
      ? 'Settings and counters can be saved and read back.'
      : 'Device storage is unavailable, so settings will not persist.',
  });

  let preferencesOk = false;
  try {
    preferencesOk = await checkPreferencesStorage();
  } catch {
    preferencesOk = false;
  }
  items.push({
    label: 'Your preferences',
    ok: preferencesOk,
    detail: preferencesOk
      ? 'Prayer, theme, and reminder settings load correctly.'
      : 'Saved preferences could not be read.',
  });

  const pairCode = await getSavedPairCode();
  items.push({
    label: 'Furqan pairing',
    ok: Boolean(pairCode),
    detail: pairCode
      ? 'Streak and verse of the day sync with Furqan is active.'
      : 'Not paired yet. Mishkah still works offline on this device.',
  });

  const highlight = await readPairedHighlight(new Date());
  items.push({
    label: 'Verse of the day',
    ok: highlight !== null,
    detail: highlight !== null
      ? 'Today’s verse is the one Furqan published.'
      : 'Waiting for Furqan’s daily verse record for today.',
  });

  const finishedAt = Date.now();
  return {
    startedAt,
    finishedAt,
    durationMs: finishedAt - startedAt,
    items,
  };
}
