import { HADITH_COLLECTIONS } from './hadith';
import { HISN_AL_MUSLIM_DUAS } from './adhkar';

export interface DailyQhdTheme {
  id: string;
  title: string;
  globalAyah: number;
  surah: number;
  ayah: number;
  hadithId: string;
  duaId: string;
}

export const DAILY_QHD_THEMES: readonly DailyQhdTheme[] = [
  { id: 'remembrance', title: 'Remembering Allah', globalAyah: 193, surah: 2, ayah: 186, hadithId: 'nawawi-19', duaId: 'dua-morning' },
  { id: 'mercy', title: 'Allah’s mercy', globalAyah: 843, surah: 6, ayah: 54, hadithId: 'bukhari-mercy', duaId: 'dua-mercy' },
  { id: 'prayer', title: 'The care of prayer', globalAyah: 3385, surah: 29, ayah: 45, hadithId: 'nawawi-3', duaId: 'dua-salah' },
  { id: 'forgiveness', title: 'Returning for forgiveness', globalAyah: 4111, surah: 39, ayah: 53, hadithId: 'bukhari-repentance', duaId: 'dua-forgiveness' },
  { id: 'charity', title: 'Giving good generously', globalAyah: 268, surah: 2, ayah: 261, hadithId: 'nawawi-25', duaId: 'dua-charity' },
  { id: 'character', title: 'Good character', globalAyah: 1991, surah: 16, ayah: 90, hadithId: 'nawawi-15', duaId: 'dua-character' },
  { id: 'gratitude', title: 'Gratitude and provision', globalAyah: 1757, surah: 14, ayah: 7, hadithId: 'nawawi-10', duaId: 'dua-provision' },
];

export function dailyQhdIndex(date = new Date()): number {
  const year = date.getUTCFullYear();
  const startOfYear = Date.UTC(year, 0, 1);
  const dayOfYear = Math.floor(
    (Date.UTC(year, date.getUTCMonth(), date.getUTCDate()) - startOfYear) / 86_400_000,
  );
  return ((dayOfYear % DAILY_QHD_THEMES.length) + DAILY_QHD_THEMES.length) % DAILY_QHD_THEMES.length;
}

export function getDailyQhdTheme(date = new Date()): DailyQhdTheme {
  return DAILY_QHD_THEMES[dailyQhdIndex(date)];
}

export function getDailyQhdReminder(date = new Date()) {
  const theme = getDailyQhdTheme(date);
  const hadith = HADITH_COLLECTIONS.find((entry) => entry.id === theme.hadithId);
  const dua = HISN_AL_MUSLIM_DUAS.find((entry) => entry.id === theme.duaId);
  if (!hadith || !dua) throw new Error(`The daily QHD reminder "${theme.id}" is missing content.`);
  return { theme, hadith, dua };
}
