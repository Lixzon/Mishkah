import { getDailyQuranSchedule } from './quranSchedule';

export interface DailyQhdTheme {
  id: string;
  title: string;
  globalAyah: number;
  surah: number;
  ayah: number;
  explanation?: string;
  learnMoreUrl?: string;
}

const BASE_THEMES: readonly DailyQhdTheme[] = [
  { id: 'remembrance', title: 'Remembering Allah', globalAyah: 193, surah: 2, ayah: 186 },
  { id: 'mercy', title: 'Allah’s mercy', globalAyah: 843, surah: 6, ayah: 54 },
  { id: 'prayer', title: 'The care of prayer', globalAyah: 3385, surah: 29, ayah: 45 },
  { id: 'forgiveness', title: 'Returning for forgiveness', globalAyah: 4111, surah: 39, ayah: 53 },
  { id: 'charity', title: 'Giving good generously', globalAyah: 268, surah: 2, ayah: 261 },
  { id: 'character', title: 'Good character', globalAyah: 1991, surah: 16, ayah: 90 },
  { id: 'gratitude', title: 'Gratitude and provision', globalAyah: 1757, surah: 14, ayah: 7 },
];

// 30-day rotation themes (cycle through based on day of month)
// Each day gets a theme, repeating every 30 days
export const DAILY_QHD_THEMES: readonly DailyQhdTheme[] = [
  // Day 1-5: Base themes
  { id: 'remembrance', title: 'Remembering Allah', globalAyah: 193, surah: 2, ayah: 186,
    explanation: "This verse reminds us of Allah's command to remember Him consistently, establishing the connection between the believer and their Creator.",
    learnMoreUrl: 'https://quran.com/2' },
  { id: 'mercy', title: 'Allah\'s mercy', globalAyah: 843, surah: 6, ayah: 54,
    explanation: 'This verse speaks to the vastness of Allah’s mercy, encompassing all things and encouraging believers to seek His forgiveness and grace.',
    learnMoreUrl: 'https://quran.com/6' },
  { id: 'prayer', title: 'The care of prayer', globalAyah: 3385, surah: 29, ayah: 45,
    explanation: 'This verse emphasizes the importance of establishing prayer as a pillar of faith, connecting the believer to Allah five times daily.',
    learnMoreUrl: 'https://quran.com/29' },
  { id: 'forgiveness', title: 'Returning for forgiveness', globalAyah: 4111, surah: 39, ayah: 53,
    explanation: 'This verse offers hope to those who have strayed, reminding them that Allah’s doors of forgiveness are always open to those who sincerely repent.',
    learnMoreUrl: 'https://quran.com/39' },
  { id: 'charity', title: 'Giving good generously', globalAyah: 268, surah: 2, ayah: 261,
    explanation: 'This verse encourages believers to give generously in the way of Allah, highlighting that true wealth is measured by one’s contribution to society.',
    learnMoreUrl: 'https://quran.com/2' },
  // Days 6-10: Expanded themes
  { id: 'character', title: 'Good character', globalAyah: 1991, surah: 16, ayah: 90,
    explanation: 'This verse outlines the beautiful character traits that Allah loves, encouraging believers to emulate these qualities in their daily interactions.',
    learnMoreUrl: 'https://quran.com/16' },
  { id: 'gratitude', title: 'Gratitude and provision', globalAyah: 1757, surah: 14, ayah: 7,
    explanation: 'This verse reflects on Allah’s countless blessings, asking believers to recognize and be thankful for the provision they receive each day.',
    learnMoreUrl: 'https://quran.com/14' },
  // Days 11-15: Additional themes
  { id: 'family', title: 'Family bonds', globalAyah: 208, surah: 17, ayah: 24,
    explanation: 'This verse emphasizes the importance of maintaining strong family ties and treating relatives with kindness and respect.',
    learnMoreUrl: 'https://quran.com/17' },
  { id: 'patience', title: 'Patience in adversity', globalAyah: 153, surah: 13, ayah: 24,
    explanation: 'This verse speaks to the virtue of patience (sabr), promising that those who remain patient will find ease and relief from hardship.',
    learnMoreUrl: 'https://quran.com/13' },
  { id: 'sabr', title: 'Steadfastness', globalAyah: 215, surah: 2, ayah: 153,
    explanation: 'This verse reassures believers that perseverance through difficulty is met with Allah’s support and ultimate success.',
    learnMoreUrl: 'https://quran.com/2' },
  // Days 16-20: More themes
  { id: 'knowledge', title: 'Seeking knowledge', globalAyah: 122, surah: 39, ayah: 9,
    explanation: 'This verse highlights the status of those who truly fear Allah, placing knowledge and understanding above all else.',
    learnMoreUrl: 'https://quran.com/39' },
  { id: 'trust', title: 'Trust in Allah', globalAyah: 261, surah: 65, ayah: 3,
    explanation: 'This verse is a profound reminder that those who trust in Allah will find Him providing a way out and sustenance from unexpected sources.',
    learnMoreUrl: 'https://quran.com/65' },
  { id: 'repentance', title: 'The path of repentance', globalAyah: 538, surah: 2, ayah: 58,
    explanation: 'This verse is a direct call from Allah to turn back to Him, promising that He is Accepting of repentance and Merciful to those who return to Him.',
    learnMoreUrl: 'https://quran.com/2' },
  // Days 21-25: Continuing themes
  { id: 'peace', title: 'Source of peace', globalAyah: 289, surah: 59, ayah: 23,
    explanation: 'This verse defines true peace (sakinah) as coming from faith and firm connection with Allah, reminding believers that tranquility is found in remembrance of Him.',
    learnMoreUrl: 'https://quran.com/59' },
  { id: 'forgiveness', title: 'Allah is Forgiving', globalAyah: 74, surah: 39, ayah: 53,
    explanation: 'This repeated affirmation of Allah’s forgiveness serves as a merciful reminder that no sin is too great to be forgiven with sincere repentance.',
    learnMoreUrl: 'https://quran.com/39' },
  { id: 'guidance', title: 'Guidance to the straight path', globalAyah: 558, surah: 1, ayah: 6,
    explanation: 'The opening verse of the Quran, Al-Fatiha, seeks Allah’s guidance toward the straight path, serving as the daily foundation for a believer’s intentions and actions.',
    learnMoreUrl: 'https://quran.com/1' },
  // Days 26-30: Final themes
  { id: 'sovereignty', title: 'Sovereignty of Allah', globalAyah: 5930, surah: 59, ayah: 24,
    explanation: 'This verse declares Allah’s absolute ownership and control over the heavens and earth, reminding believers that everything belongs to Him.',
    learnMoreUrl: 'https://quran.com/59' },
  { id: 'light', title: 'Allah is the Light', globalAyah: 24, surah: 24, ayah: 35,
    explanation: 'This beautiful verse describes Allah as the Light of the heavens and the earth, symbolizing guidance, clarity, and spiritual illumination for those who believe.',
    learnMoreUrl: 'https://quran.com/24' },
  { id: 'source', title: 'The Self-Subsisting', globalAyah: 2449, surah: 2, ayah: 255,
    explanation: 'Known as Ayat al-Kursi, this is considered one of the most powerful verses in the Quran, affirming Allah’s eternal nature and complete knowledge of all things.',
    learnMoreUrl: 'https://quran.com/2' },
  { id: 'dawn', title: 'Beginning with remembrance', globalAyah: 113, surah: 17, ayah: 78,
    explanation: 'This verse encourages starting the day with the remembrance of Allah, setting a spiritual tone for the hours ahead.',
    learnMoreUrl: 'https://quran.com/17' },
  { id: 'night', title: 'Night prayer and reflection', globalAyah: 643, surah: 17, ayah: 79,
    explanation: 'This verse speaks to the special status of those who pray during the night, rising from their beds to stand in prayer and seek Allah’s forgiveness.',
    learnMoreUrl: 'https://quran.com/17' },
];

// Friday override: if it's Friday, show the Friday theme regardless of day number
// Friday theme focuses on special blessings and preparation for weekend
const FRIDAY_THEME: DailyQhdTheme = {
  id: 'jumuah',
  title: 'Friday Blessings',
  globalAyah: 182, surah: 18, ayah: 1,
  title: 'Friday Blessings',
  explanation: 'A special theme for Friday, the best day of the week, focusing on blessings and preparation for the weekend.',
  learnMoreUrl: 'https://quran.com/18',
};

export function dailyQhdTheme(date = new Date()): DailyQhdTheme {
  const dayOfMonth = date.getUTCDate();
  const isFriday = date.getUTCDay() === 5;

  let themeIndex: number;
  if (isFriday) {
    // Friday override: always show Friday theme
    themeIndex = DAILY_QHD_THEMES.length; // Will use FRIDAY_THEME below
  } else {
    // 30-day rotation based on day of month
    themeIndex = ((dayOfMonth - 1) % DAILY_QHD_THEMES.length);
  }

  const schedule = getDailyQuranSchedule(date);
  const baseTheme = isFriday ? FRIDAY_THEME : DAILY_QHD_THEMES[themeIndex];

  return {
    ...baseTheme,
    globalAyah: schedule.globalAyah,
    surah: schedule.surah,
    ayah: schedule.ayah,
  };
}
