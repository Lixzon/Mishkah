import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_CITY_IDS, MAX_PINNED_CITIES, getCity } from '../domain/cities';
import { isValidJumuahTime, type CalculationMethod } from '../domain/prayer';
import type { CustomDhikr } from '../domain/tasbeeh';

const PREFERENCES_KEY = 'mishkah.preferences.v1';

export type AppPreferences = {
  pinnedCityIds: string[];
  selectedCityId: string;
  jumuahTimesByCity: Record<string, string>;
  theme: 'light' | 'dark' | 'midnight';
  calculationMethod: CalculationMethod;
  fajrAlarm: boolean;
  iftarAlarm: boolean;
  alarmLeadMinutes: 45 | 50 | 60;
  checklistDate: string;
  completedChecklistItems: string[];
  customDhikr: CustomDhikr[];
  tasbeehDate: string;
  tasbeehCounts: Record<string, number>;
  adhkarDate: string;
  adhkarCounts: Record<string, number>;
};

export const DEFAULT_PREFERENCES: AppPreferences = {
  pinnedCityIds: [...DEFAULT_CITY_IDS],
  selectedCityId: DEFAULT_CITY_IDS[0],
  jumuahTimesByCity: {},
  theme: 'light',
  calculationMethod: 'MWL',
  fajrAlarm: false,
  iftarAlarm: false,
  alarmLeadMinutes: 45,
  checklistDate: '',
  completedChecklistItems: [],
  customDhikr: [],
  tasbeehDate: '',
  tasbeehCounts: {},
  adhkarDate: '',
  adhkarCounts: {},
};

function isCalculationMethod(value: unknown): value is CalculationMethod {
  return value === 'MWL' || value === 'ISNA' || value === 'Egyptian' || value === 'Umm al-Qura';
}

function normalizeCounts(value: unknown): Record<string, number> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]))
      .map(([id, count]) => [id, Math.max(0, Math.min(1000, Math.floor(count)))]),
  );
}

function normalizeJumuahTimesByCity(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => Boolean(getCity(entry[0])) &&
        typeof entry[1] === 'string' && isValidJumuahTime(entry[1]),
    ),
  );
}

function normalizeCustomDhikr(value: unknown): CustomDhikr[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is CustomDhikr =>
      typeof item === 'object' && item !== null &&
      typeof item.id === 'string' && typeof item.label === 'string' &&
      (item.target === 33 || item.target === 100) &&
      typeof item.createdAt === 'number' && Number.isFinite(item.createdAt),
    )
    .slice(0, 30)
    .map((item) => ({
      id: item.id,
      label: item.label.trim().slice(0, 60),
      ...(typeof item.arabic === 'string' ? { arabic: item.arabic.slice(0, 180) } : {}),
      target: item.target,
      createdAt: item.createdAt,
    }))
    .filter((item) => item.label.length > 0);
}

function normalizePreferences(value: unknown): AppPreferences {
  if (typeof value !== 'object' || value === null) {
    return { ...DEFAULT_PREFERENCES, pinnedCityIds: [...DEFAULT_PREFERENCES.pinnedCityIds] };
  }

  const input = value as Partial<AppPreferences>;
  const pinnedCityIds = Array.isArray(input.pinnedCityIds)
    ? [...new Set(input.pinnedCityIds.filter((id): id is string => typeof id === 'string'))].slice(
        0,
        MAX_PINNED_CITIES,
      )
    : [...DEFAULT_PREFERENCES.pinnedCityIds];
  const selectedCityId =
    typeof input.selectedCityId === 'string' && pinnedCityIds.includes(input.selectedCityId)
      ? input.selectedCityId
      : (pinnedCityIds[0] ?? DEFAULT_PREFERENCES.selectedCityId);

  return {
    pinnedCityIds,
    selectedCityId,
    jumuahTimesByCity: normalizeJumuahTimesByCity(input.jumuahTimesByCity),
    theme: input.theme === 'midnight' ? 'midnight' : input.theme === 'dark' ? 'dark' : 'light',
    calculationMethod: isCalculationMethod(input.calculationMethod)
      ? input.calculationMethod
      : DEFAULT_PREFERENCES.calculationMethod,
    fajrAlarm: input.fajrAlarm === true,
    iftarAlarm: input.iftarAlarm === true,
    alarmLeadMinutes:
      input.alarmLeadMinutes === 50 || input.alarmLeadMinutes === 60
        ? input.alarmLeadMinutes
        : DEFAULT_PREFERENCES.alarmLeadMinutes,
    checklistDate: typeof input.checklistDate === 'string' ? input.checklistDate : '',
    completedChecklistItems: Array.isArray(input.completedChecklistItems)
      ? input.completedChecklistItems.filter((item): item is string => typeof item === 'string')
      : [],
    customDhikr: normalizeCustomDhikr(input.customDhikr),
    tasbeehDate: typeof input.tasbeehDate === 'string' ? input.tasbeehDate : '',
    tasbeehCounts: normalizeCounts(input.tasbeehCounts),
    adhkarDate: typeof input.adhkarDate === 'string' ? input.adhkarDate : '',
    adhkarCounts: normalizeCounts(input.adhkarCounts),
  };
}

export async function loadPreferences(): Promise<AppPreferences> {
  const stored = await AsyncStorage.getItem(PREFERENCES_KEY);
  return stored === null
    ? { ...DEFAULT_PREFERENCES, pinnedCityIds: [...DEFAULT_PREFERENCES.pinnedCityIds] }
    : normalizePreferences(JSON.parse(stored));
}

let preferenceWriteQueue: Promise<void> = Promise.resolve();

export function savePreferences(preferences: AppPreferences): Promise<void> {
  const serialized = JSON.stringify(preferences);
  const operation = preferenceWriteQueue.then(() => AsyncStorage.setItem(PREFERENCES_KEY, serialized));
  preferenceWriteQueue = operation.catch(() => undefined);
  return operation;
}

export async function checkPreferencesStorage(): Promise<boolean> {
  const value = await AsyncStorage.getItem(PREFERENCES_KEY);
  return value !== null;
}
