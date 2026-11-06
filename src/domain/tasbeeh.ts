export interface TasbeehPreset {
  id: string;
  category: 'post-salah' | 'morning' | 'evening' | 'forgiveness' | 'custom';
  label: string;
  arabic: string;
  transliteration: string;
  meaning: string;
  target: number;
  reference: string;
}

export const TASBEEH_PRESETS: readonly TasbeehPreset[] = [
  {
    id: 'post-salah-subhanallah',
    category: 'post-salah',
    label: 'Glory be to Allah',
    arabic: 'سُبْحَانَ اللَّهِ',
    transliteration: 'SubhanAllah',
    meaning: 'Glory be to Allah.',
    target: 33,
    reference: 'Sahih Muslim 597',
  },
  {
    id: 'post-salah-alhamdulillah',
    category: 'post-salah',
    label: 'Praise be to Allah',
    arabic: 'الْحَمْدُ لِلَّهِ',
    transliteration: 'Alhamdulillah',
    meaning: 'All praise belongs to Allah.',
    target: 33,
    reference: 'Sahih Muslim 597',
  },
  {
    id: 'post-salah-allahu-akbar',
    category: 'post-salah',
    label: 'Allah is greatest',
    arabic: 'اللَّهُ أَكْبَرُ',
    transliteration: 'Allahu Akbar',
    meaning: 'Allah is greater than all things.',
    target: 33,
    reference: 'Sahih Muslim 597',
  },
  {
    id: 'morning-praise',
    category: 'morning',
    label: 'Morning remembrance',
    arabic: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ',
    transliteration: 'SubhanAllahi wa bihamdihi',
    meaning: 'Glory and praise be to Allah.',
    target: 100,
    reference: 'Sahih al-Bukhari 6405; Sahih Muslim 2692',
  },
  {
    id: 'evening-praise',
    category: 'evening',
    label: 'Evening remembrance',
    arabic: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ',
    transliteration: 'SubhanAllahi wa bihamdihi',
    meaning: 'Glory and praise be to Allah.',
    target: 100,
    reference: 'Sahih al-Bukhari 6405; Sahih Muslim 2692',
  },
  {
    id: 'seeking-forgiveness',
    category: 'forgiveness',
    label: 'Seeking forgiveness',
    arabic: 'أَسْتَغْفِرُ اللَّهَ',
    transliteration: 'Astaghfirullah',
    meaning: 'I seek Allah’s forgiveness.',
    target: 100,
    reference: 'Sahih al-Bukhari 6307 (frequent seeking of forgiveness)',
  },
];

export const CUSTOM_DHIKR_TARGETS = [33, 100] as const;

export interface CustomDhikr {
  id: string;
  label: string;
  arabic?: string;
  target: number;
  createdAt: number;
}

export function makeCustomDhikr(label: string, target: number, now = Date.now()): CustomDhikr | null {
  const cleanLabel = label.trim().replace(/\s+/g, ' ');
  if (!cleanLabel || !CUSTOM_DHIKR_TARGETS.includes(target as (typeof CUSTOM_DHIKR_TARGETS)[number])) {
    return null;
  }
  return {
    id: `custom-${now.toString(36)}`,
    label: cleanLabel.slice(0, 60),
    target,
    createdAt: now,
  };
}

export function nextTasbeehCount(count: number, target: number): number {
  return Math.min(Math.max(0, Math.floor(count)) + 1, Math.max(1, Math.floor(target)));
}