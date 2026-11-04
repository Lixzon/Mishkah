import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_CITY_IDS, MAX_PINNED_CITIES } from '../domain/cities';
import type { CalculationMethod } from '../domain/prayer';

const PREFERENCES_KEY = 'mishkah.preferences.v1';

export type AppPreferences = {
  pinnedCityIds: string[];
  selectedCityId: string;
  theme: 'light' | 'dark';
  calculationMethod: CalculationMethod;
  fajrAlarm: boolean;
  iftarAlarm: boolean;
  alarmLeadMinutes: 45 | 50 | 60;
  checklistDate: string;
  completedChecklistItems: string[];
};

export const DEFAULT_PREFERENCES: AppPreferences = {
  pinnedCityIds: [...DEFAULT_CITY_IDS],
  selectedCityId: DEFAULT_CITY_IDS[0],
  theme: 'light',
  calculationMethod: 'MWL',
  fajrAlarm: false,
  iftarAlarm: false,
  alarmLeadMinutes: 45,
  checklistDate: '',
  completedChecklistItems: [],
};

function isCalculationMethod(value: unknown): value is CalculationMethod {
  return value === 'MWL' || value === 'ISNA' || value === 'Egyptian' || value === 'Umm al-Qura';
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
    theme: input.theme === 'dark' ? 'dark' : 'light',
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
