import type { AssistantLayout, ThemeMode } from '../types';

/**
 * Istiqamah milestone unlocks.
 *
 * These are deliberately separate from the badge tiers in `progression.ts`: a
 * tier is something the reader earns and is *shown*, whereas an unlock is a
 * capability in the UI that is locked until the streak reaches it.
 *
 * Both are derived from the same `currentStreak` field on `ProgressionState`,
 * so the header flame, the tracker modal and the Settings locks can never
 * disagree about whether a feature is available. Nothing else may hardcode a
 * day count for gating — this module is the only place that knows them.
 */

/** Reading themes (Sepia / Midnight Blue / Emerald) unlock here. */
export const READING_THEMES_UNLOCK_DAYS = 100;

/** Reader-facing appearance themes that the 100-day milestone grants. */
export interface ReadingThemeOption {
  /** The `ThemeMode` this option applies. */
  id: Extract<ThemeMode, 'sepia' | 'midnight' | 'emerald'>;
  label: string;
  description: string;
  /** Representative colour for the picker chip. */
  swatch: string;
}

export const CUSTOM_READING_THEMES: ReadingThemeOption[] = [
  {
    id: 'sepia',
    label: 'Sepia',
    description: 'Warm paper with low glare for long sittings',
    swatch: '#efe5d1',
  },
  {
    id: 'midnight',
    label: 'Midnight Blue',
    description: 'Deep navy page for reading in the dark',
    swatch: '#0e1a2e',
  },
  {
    id: 'emerald',
    label: 'Emerald',
    description: 'Soft green paper with a fresh accent',
    swatch: '#e3efe6',
  },
];

/** The Advanced UI features the 365-day milestone grants. */
export interface AiUiFeature {
  id: 'dynamicLayouts' | 'customThemes';
  label: string;
  description: string;
}

/** One milestone row in the tracker modal and the Settings locks. */

export const MILESTONE_UNLOCKS: MilestoneUnlock[] = [
  {
    id: 'reading-themes',
    days: READING_THEMES_UNLOCK_DAYS,
    title: 'Custom Reading Themes',
    summary: 'Sepia, Midnight Blue and Emerald reading themes.',
    features: CUSTOM_READING_THEMES.map((theme) => `${theme.label} reading theme`),
  },
  {
    id: 'ai-ui',
    days: AI_UI_UNLOCK_DAYS,
    title: 'Advanced AI UI Customization',
    summary: 'Dynamic Quran Assistant layouts and custom themes.',
    features: AI_UI_FEATURES.map((feature) => feature.label),
  },
];

/**
 * The exact lock copy shown on a gated feature. Kept as a function (and
 * exported as a constant for the 365-day case) so the wording can never drift
 * between the tracker modal, the theme picker and Settings.
 */
export function lockedText(days: number): string {
  return `Requires a ${days}-Day Istiqamah Streak to Unlock`;
}

/** The copy the 365-day AI UI features must show while locked. */
export const AI_UI_LOCKED_TEXT = lockedText(AI_UI_UNLOCK_DAYS);

export interface UnlockProgress {
  unlocked: boolean;
  /** 0..1 progress towards the milestone. */
  ratio: number;
  /** Days still to go; 0 once unlocked. */
  remaining: number;
}

function isLocalDevOverrideEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return import.meta.env.DEV || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

export function isReadingThemesUnlocked(streak: number): boolean {
  return isLocalDevOverrideEnabled() || streak >= READING_THEMES_UNLOCK_DAYS;
}

export function unlockProgress(streak: number, days: number): UnlockProgress {
  if (isLocalDevOverrideEnabled()) {
    return { unlocked: true, ratio: 1, remaining: 0 };
  }
  const ratio = days <= 0 ? 1 : Math.max(0, Math.min(1, streak / days));
  return { unlocked: streak >= days, ratio, remaining: Math.max(0, days - streak) };
}

/** True when a `ThemeMode` is one of the gated reading themes. */
export function isLockedReadingTheme(mode: ThemeMode): boolean {
  return CUSTOM_READING_THEMES.some((theme) => theme.id === mode);
}

/**
 * Whether the reader may *select* a theme. A theme the reader is already on
 * stays visible (and stays applied) even if the streak has since dropped, so a
 * broken streak never yanks the page out from under them.
 */
export function isThemeSelectable(mode: ThemeMode, streak: number, active: boolean): boolean {
  if (!isLockedReadingTheme(mode)) return true;
  return active || isReadingThemesUnlocked(streak);
}
