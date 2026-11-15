import { getDailyQuranSchedule } from './quranSchedule';

export interface DailyQhdTheme {
  id: string;
  title: string;
  globalAyah: number;
  surah: number;
  ayah: number;
}

export const DAILY_QHD_THEMES: readonly DailyQhdTheme[] = [
  { id: 'remembrance', title: 'Remembering Allah', globalAyah: 193, surah: 2, ayah: 186 },
  { id: 'mercy', title: 'Allah’s mercy', globalAyah: 843, surah: 6, ayah: 54 },
  { id: 'prayer', title: 'The care of prayer', globalAyah: 3385, surah: 29, ayah: 45 },
  { id: 'forgiveness', title: 'Returning for forgiveness', globalAyah: 4111, surah: 39, ayah: 53 },
  { id: 'charity', title: 'Giving good generously', globalAyah: 268, surah: 2, ayah: 261 },
  { id: 'character', title: 'Good character', globalAyah: 1991, surah: 16, ayah: 90 },
  { id: 'gratitude', title: 'Gratitude and provision', globalAyah: 1757, surah: 14, ayah: 7 },
];

export function dailyQhdTheme(date = new Date()): DailyQhdTheme {
  const year = date.getUTCFullYear();
  const startOfYear = Date.UTC(year, 0, 1);
  const dayOfYear = Math.floor(
    (Date.UTC(year, date.getUTCMonth(), date.getUTCDate()) - startOfYear) / 86_400_000,
  );
  const index = ((dayOfYear % DAILY_QHD_THEMES.length) + DAILY_QHD_THEMES.length) % DAILY_QHD_THEMES.length;
  const schedule = getDailyQuranSchedule(date);
  return {
    ...DAILY_QHD_THEMES[index],
    globalAyah: schedule.globalAyah,
    surah: schedule.surah,
    ayah: schedule.ayah,
  };
}
