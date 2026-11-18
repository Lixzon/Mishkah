/** Shared domain types for Furqan. */

export interface AyahData {
  /** global ayah number across the whole Quran */
  g: number;
  /** number within the surah (1-based) */
  i: number;
  /** Arabic text (Uthmani script) */
  ar: string;
  /** English translation (Sahih International) */
  tr: string;
  /** English transliteration */
  tl: string;
}

export interface SurahMeta {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  revelationType: 'Meccan' | 'Medinan';
  numberOfAyahs: number;
}

export interface SurahFull extends SurahMeta {
  hasBasmalaPrefix: boolean;
  ayahs: AyahData[];
}

export interface JuzBoundary {
  juz: number;
  startSurah: number;
  startAyah: number;
  endSurah: number;
  endAyah: number;
}

/* ---------------- playlists ---------------- */

export interface PlaylistItem {
  id: string;
  /** surah number 1..114 */
  surah: number;
  /** how many times this surah repeats before the queue moves on */
  repeat: number;
  /** Optional Hifz loop applied whenever this slot plays (0-based, inclusive). */
  loop?: { start: number; end: number };
}

export interface Playlist {
  id: string;
  name: string;
  reciter: string; // reciter edition id
  createdAt: number;
  items: PlaylistItem[];
  /** Present when this playlist arrived through an import code. */
  credit?: {
    author: string | null;
    importedAt: number;
  };
}

/** Player repeat semantics layered on top of per-item repeat counts. */
export type PlayerRepeatMode = 'off' | 'one' | 'all';

/* ---------------- progress ---------------- */

export interface ReaderPosition {
  /** numberInSurah last read */
  ayah: number;
  at: number;
}

export type ActivityKind = 'read' | 'listen';

export interface ActivityEntry {
  surah: number;
  ayah: number;
  name: string;
  at: number;
  kind: ActivityKind;
}

export interface QuoteHistoryEntry {
  id: string;
  at: number;
}

export interface ProgressState {
  /** per surah: last read ayah position (numberInSurah) */
  lastRead: Record<number, ReaderPosition>;
  /** per surah: timestamp of last full listen */
  lastListened: Record<number, number>;
  /** per surah: read to the end (auto-marked) */
  surahCompleted: Record<number, boolean>;
  /** 30 juz, whether marked complete */
  juzCompleted: Record<number, boolean>;
  /** Latest position across reading and listening sessions. */
  lastPosition: ActivityEntry | null;
  /** Small chronological activity log used by history and recent-item views. */
  activity: ActivityEntry[];
  /** Local date keys for days that met the reading or recitation activity criteria. */
  dailyActivity: Record<string, boolean>;
  /** Count of ayahs reached at least once per surah. */
  ayahsReached: Record<number, number>;
  /** Milestone thresholds already earned, keyed by day count. */
  milestones: Record<number, number>;
  /** Quote views/favorites, newest first. */
  quoteHistory: QuoteHistoryEntry[];
  /** Istiqamah (consistency) progression: streaks, freeze and tier unlocks. */
  progression: ProgressionState;
}

/**
 * Istiqamah (consistency) progression. Derived from reading/listening activity —
 * no currencies and nothing purchasable. The XP shown in the app is a read-out
 * of this same activity (`lib/xp.ts`), never a balance to spend.
 */
export interface ProgressionState {
  /** Consecutive days on which the daily reading/listening goal was met. */
  currentStreak: number;
  /** Best streak ever recorded. */
  highestStreak: number;
  /** ISO date the goal was last met. */
  lastActiveDate: string | null;
  /** Ruksah (streak freezes) available, capped at 2. */
  streakFreezes: number;
  /** Days a freeze was spent on, for transparency. */
  freezeUsedDates: string[];
  /** Tier thresholds already unlocked. */
  unlockedTiers: number[];
  /** The reader's chosen next Istiqamah goal in days. */
  istiqamahGoal: number;
  /** Milestone thresholds already offered. */
  celebratedMilestones: number[];
  /**
   * Date a Ruksah was spent on, awaiting the "your streak was protected"
   * notice. Cleared once the notice has been shown.
   */
  freezeNoticeFor: string | null;
  /** Daily completion popup already shown for this date. */
  dailyGoalCelebratedDate: string | null;
  /** Minutes of recitation listened per ISO date. */
  dailyListenMinutes: Record<string, number>;
  /** Foreground reading minutes per local date. */
  dailyReadMinutes: Record<string, number>;
  /**
   * Which day-key rule wrote this state. 1 = UTC days (legacy), 2 = local days.
   * Used to run the UTC -> local repair exactly once per install.
   */
  dayKeyVersion: number;
  /**
   * Monotonic counts of the two actions that leave no trace anywhere else —
   * sharing and copying — so the XP they earn survives a reload. Nothing is
   * ever spent, and no balance is derived from them beyond that read-out.
   */
  counters: XpCounters;
}

/** See {@link ProgressionState.counters}. */
export interface XpCounters {
  shares: number;
  copies: number;
}

/* ---------------- quotes ---------------- */

export type QuoteTheme =
  | 'patience'
  | 'gratitude'
  | 'hope'
  | 'hardship'
  | 'mercy'
  | 'kindness'
  | 'knowledge'
  | 'trust'
  | 'repentance'
  | 'humility'
  | 'justice'
  | 'charity'
  | 'sincerity'
  | 'forgiveness'
  | 'brotherhood';

export interface QuoteEntry {
  id: string;
  text: string;
  /** who said it */
  by: string;
  /** e.g. "Sahih al-Bukhari" */
  source: string;
  /** chapter/reference inside the source */
  reference?: string;
  themes: QuoteTheme[];
}

/* ---------------- downloads / reciters ---------------- */

export type DownloadQuality = 'low' | 'medium' | 'high';

export interface Reciter {
  id: string;
  label: string;
  arabicName: string;
  /** islamic.network audio edition key */
  edition: string;
  bitrate: 64 | 128 | 192;
  availableBitrates?: number[];
}

export interface DownloadRecord {
  key: string; // `${reciter}|${surah}`
  reciter: string;
  surah: number;
  size: number;
  at: number;
}

/* ---------------- settings / theme ---------------- */

export type ThemeMode =
  | 'light'
  | 'dark'
  | 'system'
  | 'oled'
  /** Gated reading themes (100-day Istiqamah milestone, see `lib/unlocks.ts`). */
  | 'sepia'
  | 'midnight'
  | 'emerald'
  /** Progression themes granted by the badge tiers. */
  | 'velvet'
  | 'golden';
export type ScriptStyle = 'uthmani' | 'naskh' | 'clear';
export type AccentId = 'teal' | 'emerald' | 'green' | 'gold' | 'amber' | 'slate' | 'blue' | 'rose' | 'purple' | 'sapphire';
export type QuranScriptType = 'uthmani' | 'indopak' | 'tajweed';
export type ArabicFontFamily = 'kfgqpc' | 'scheherazade' | 'amiri';
export type AudioQuality = '32kbps' | '64kbps' | '128kbps';

/**
 * Reader layout presets. `classic` is the default behaviour; the other two are
 * granted by the 365-day Istiqamah milestone.
 */
export type AssistantLayout = 'classic' | 'guided' | 'immersive';
export type ProfileAvatarId =
  | 'crescent'
  | 'sunrise'
  | 'ocean'
  | 'mountain'
  | 'qarawiyyin'
  | 'arch'
  | 'dome'
  | 'quran'
  | 'kaaba'
  | 'nabawi'
  | 'domeRock'
  | 'alAqsa'
  | 'madinah'
  | 'minaret'
  | 'desert'
  | 'palm'
  | 'stars'
  | 'galaxy'
  | 'geometric'
  | 'lantern';

export interface SettingsState {
  arabicFontSize: number;
  translationFontSize: number;
  lineSpacing: number;
  scriptType: QuranScriptType;
  fontFamily: ArabicFontFamily;
  showArabic: boolean;
  showTransliteration: boolean;
  showTranslation: boolean;
  showVerseNumbers: boolean;
  showTajweedRules: boolean;
  arabicFontScale: number; // multiplier, e.g. 1.6
  script: ScriptStyle;
  themeMode: ThemeMode;
  accentColor: AccentId;
  enableFluidAnimations: boolean;
  reducedMotion: boolean;
  readingMode: boolean; // distraction free
  defaultReciter: string;
  defaultReciterId: string;
  downloadQuality: DownloadQuality;
  audioQuality: AudioQuality;
  followAudio: boolean; // auto-scroll/highlight reader to the playing ayah
  autoScrollVerse: boolean;
  autoAdvanceSurah: boolean;
  autoScrollSpeed: number;
  playbackSpeed: number;
  voiceLanguage: 'ar-SA' | 'en-US';
  autoClearCacheThreshold: number;
  /**
   * Milliseconds added to the audio clock before the highlighted ayah (and the
   * auto-scroll that follows it) is resolved. Negative values delay the
   * highlight — the fix when a verse lights up before you hear it.
   */
  audioSyncOffsetMs: number;
  hasOfferedDefaultReciterDownload: boolean;
  wifiDownloadPending: boolean;
  /** Dynamic reader layout, gated behind the 365-day milestone. */
  assistantLayout: AssistantLayout;
  notifications: {
    daily: boolean;
    fridayKahf: boolean;
    nightlyMulk: boolean;
    reminderTime: string;
  };
  dailyReadingGoalMinutes: number;
  profileAvatar: ProfileAvatarId;
  hifzRepetitionEnabled: boolean;
  wordByWordEnabled: boolean;
  ambientSoundsEnabled: boolean;
  ambientSoundVolume: number;
  khatamPlannerEnabled: boolean;
  khatamTargetDays: number;
  /** Show “Originally created by …” on playlists imported from a code. */
  showImportedAttribution: boolean;
}

export interface ThemeState {
  mode: ThemeMode;
  accent: AccentId;
  /**
   * A reader-built accent, `#rrggbb`, or null for the stock palette. Gated
   * behind the 365-day milestone; applied by `ThemeManager`.
   */
  customAccent: string | null;
}
