export interface StreakReward {
  id: string;
  days: number;
  title: string;
}

export const STREAK_REWARDS: readonly StreakReward[] = [
  { id: 'audio-reminders', days: 3, title: 'Audio reminders' },
  { id: 'extended-hadith', days: 7, title: 'Bukhari and Muslim selections' },
  { id: 'premium-theme-collection', days: 14, title: 'Midnight theme' },
  { id: 'reciter-library', days: 21, title: 'Qur’an reciter library' },
];

export function computeUnlockedFeatures(streak: number): string[] {
  const safeStreak = Number.isFinite(streak) ? Math.max(0, Math.floor(streak)) : 0;
  return [
    'basic-guidance',
    ...STREAK_REWARDS.filter((reward) => safeStreak >= reward.days).map((reward) => reward.id),
    ...(safeStreak >= 7 ? ['advanced-guidance'] : []),
    ...(safeStreak >= 14 ? ['dark-theme-pro'] : []),
  ];
}