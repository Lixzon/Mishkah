import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AccentId, AssistantLayout, AudioQuality, DownloadQuality, QuranScriptType, ScriptStyle, SettingsState, ThemeMode } from '../../types';
import { loadState } from '../persist';
import { KEYS } from '../persist';
import { DEFAULT_ACCENT, DEFAULT_ARABIC_SCALE, DEFAULT_DOWNLOAD_QUALITY, DEFAULT_RECITER } from '../../lib/constants';

const QUALITY_TO_AUDIO: Record<DownloadQuality, AudioQuality> = {
  low: '32kbps',
  medium: '64kbps',
  high: '128kbps',
};
const AUDIO_TO_QUALITY: Record<AudioQuality, DownloadQuality> = {
  '32kbps': 'low',
  '64kbps': 'medium',
  '128kbps': 'high',
};

export const DEFAULT_SETTINGS: SettingsState = {
  arabicFontSize: 28,
  translationFontSize: 16,
  lineSpacing: 1.8,
  scriptType: 'uthmani',
  fontFamily: 'amiri',
  showArabic: true,
  showTransliteration: true,
  showTranslation: true,
  showVerseNumbers: true,
  showTajweedRules: true,
  arabicFontScale: DEFAULT_ARABIC_SCALE,
  script: 'uthmani',
  themeMode: 'system',
  accentColor: DEFAULT_ACCENT,
  enableFluidAnimations: true,
  reducedMotion: false,
  readingMode: false,
  defaultReciter: DEFAULT_RECITER,
  defaultReciterId: DEFAULT_RECITER,
  downloadQuality: DEFAULT_DOWNLOAD_QUALITY,
  audioQuality: QUALITY_TO_AUDIO[DEFAULT_DOWNLOAD_QUALITY],
  followAudio: true,
  autoScrollVerse: true,
  autoAdvanceSurah: false,
  autoScrollSpeed: 140,
  playbackSpeed: 1,
  voiceLanguage: 'ar-SA',
  autoClearCacheThreshold: 1000,
  audioSyncOffsetMs: 0,
  hasOfferedDefaultReciterDownload: false,
  wifiDownloadPending: false,
  assistantLayout: 'classic',
  notifications: {
    daily: false,
    fridayKahf: false,
    nightlyMulk: false,
    reminderTime: '20:00',
  },
  dailyReadingGoalMinutes: 5,
  profileAvatar: 'crescent',
  hifzRepetitionEnabled: false,
  wordByWordEnabled: false,
  ambientSoundsEnabled: false,
  ambientSoundVolume: 0.2,
  khatamPlannerEnabled: false,
  khatamTargetDays: 60,
  showImportedAttribution: true,
};

export function normalizeSettings(stored: Partial<SettingsState>): SettingsState {
  const initialTheme = loadState<{ mode: ThemeMode; accent: AccentId }>(KEYS.theme, {
    mode: 'system',
    accent: DEFAULT_ACCENT,
  });
  const defaultReciter = stored.defaultReciterId ?? stored.defaultReciter ?? DEFAULT_RECITER;
  const downloadQuality = stored.downloadQuality ?? DEFAULT_DOWNLOAD_QUALITY;
  const reducedMotion = stored.reducedMotion ?? (stored.enableFluidAnimations === false);
  const enableFluidAnimations = stored.enableFluidAnimations ?? !reducedMotion;
  const arabicFontSize = Math.min(50, Math.max(18,
    stored.arabicFontSize ?? (stored.arabicFontScale !== undefined
      ? Math.round(26 * stored.arabicFontScale)
      : DEFAULT_SETTINGS.arabicFontSize),
  ));

  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    arabicFontSize,
    arabicFontScale: arabicFontSize / 26,
    translationFontSize: Math.min(30, Math.max(12, stored.translationFontSize ?? DEFAULT_SETTINGS.translationFontSize)),
    lineSpacing: Math.min(2.6, Math.max(1.2, stored.lineSpacing ?? DEFAULT_SETTINGS.lineSpacing)),
    scriptType: stored.scriptType ?? 'uthmani',
    fontFamily: stored.fontFamily ?? 'amiri',
    showVerseNumbers: stored.showVerseNumbers ?? true,
    showTajweedRules: stored.showTajweedRules ?? true,
    themeMode: stored.themeMode ?? initialTheme.mode,
    accentColor: stored.accentColor ?? initialTheme.accent,
    enableFluidAnimations,
    reducedMotion,
    defaultReciter,
    defaultReciterId: defaultReciter,
    downloadQuality,
    audioQuality: stored.audioQuality ?? QUALITY_TO_AUDIO[downloadQuality],
    followAudio: stored.followAudio ?? stored.autoScrollVerse ?? true,
    autoScrollVerse: stored.autoScrollVerse ?? stored.followAudio ?? true,
    autoAdvanceSurah: stored.autoAdvanceSurah ?? false,
    autoScrollSpeed: Math.min(800, Math.max(0, stored.autoScrollSpeed ?? DEFAULT_SETTINGS.autoScrollSpeed)),
    playbackSpeed: Math.min(2, Math.max(0.5, stored.playbackSpeed ?? DEFAULT_SETTINGS.playbackSpeed)),
    voiceLanguage: stored.voiceLanguage ?? 'ar-SA',
    autoClearCacheThreshold: stored.autoClearCacheThreshold ?? 1000,
    notifications: { ...DEFAULT_SETTINGS.notifications, ...stored.notifications },
    dailyReadingGoalMinutes: Math.min(60, Math.max(5, Math.round(stored.dailyReadingGoalMinutes ?? 5))),
    profileAvatar: stored.profileAvatar ?? DEFAULT_SETTINGS.profileAvatar,
    hifzRepetitionEnabled: stored.hifzRepetitionEnabled ?? false,
    wordByWordEnabled: stored.wordByWordEnabled ?? false,
    ambientSoundsEnabled: stored.ambientSoundsEnabled ?? false,
    ambientSoundVolume: Math.min(1, Math.max(0, stored.ambientSoundVolume ?? 0.2)),
    khatamPlannerEnabled: stored.khatamPlannerEnabled ?? false,
    khatamTargetDays: Math.min(365, Math.max(7, Math.round(stored.khatamTargetDays ?? 60))),
    showImportedAttribution: stored.showImportedAttribution ?? true,
  };
}

export const initialState = normalizeSettings(loadState<Partial<SettingsState>>(KEYS.settings, {}));

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    restoreSettings(_state, action: PayloadAction<SettingsState>) {
      // Backups written before a field existed would otherwise restore undefined.
      return normalizeSettings(action.payload);
    },
    resetSettings() {
      return { ...DEFAULT_SETTINGS, notifications: { ...DEFAULT_SETTINGS.notifications } };
    },
    resetToDefaults() {
      return { ...DEFAULT_SETTINGS, notifications: { ...DEFAULT_SETTINGS.notifications } };
    },
    setArabicFontSize(state, action: PayloadAction<number>) {
      state.arabicFontSize = Math.min(50, Math.max(18, Math.round(action.payload)));
      state.arabicFontScale = state.arabicFontSize / 26;
    },
    setTranslationFontSize(state, action: PayloadAction<number>) {
      state.translationFontSize = Math.min(30, Math.max(12, Math.round(action.payload)));
    },
    setLineSpacing(state, action: PayloadAction<number>) {
      state.lineSpacing = Math.min(2.6, Math.max(1.2, action.payload));
    },
    setScriptType(state, action: PayloadAction<QuranScriptType>) {
      state.scriptType = action.payload;
    },
    setFontFamily(state, action: PayloadAction<SettingsState['fontFamily']>) {
      state.fontFamily = action.payload;
    },
    setShowVerseNumbers(state, action: PayloadAction<boolean>) {
      state.showVerseNumbers = action.payload;
    },
    setShowTajweedRules(state, action: PayloadAction<boolean>) {
      state.showTajweedRules = action.payload;
    },
    setReducedMotion(state, action: PayloadAction<boolean>) {
      state.reducedMotion = action.payload;
      state.enableFluidAnimations = !action.payload;
    },
    setEnableFluidAnimations(state, action: PayloadAction<boolean>) {
      state.enableFluidAnimations = action.payload;
      state.reducedMotion = !action.payload;
    },
    setThemeMode(state, action: PayloadAction<ThemeMode>) {
      state.themeMode = action.payload;
    },
    setAccentColor(state, action: PayloadAction<AccentId>) {
      state.accentColor = action.payload;
    },
    setDefaultReciterId(state, action: PayloadAction<string>) {
      state.defaultReciterId = action.payload;
      state.defaultReciter = action.payload;
    },
    setAudioQuality(state, action: PayloadAction<AudioQuality>) {
      state.audioQuality = action.payload;
      state.downloadQuality = AUDIO_TO_QUALITY[action.payload];
    },
    setAutoScrollVerse(state, action: PayloadAction<boolean>) {
      state.autoScrollVerse = action.payload;
      state.followAudio = action.payload;
    },
    setAutoAdvanceSurah(state, action: PayloadAction<boolean>) {
      state.autoAdvanceSurah = action.payload;
    },
    setAutoScrollSpeed(state, action: PayloadAction<number>) {
      state.autoScrollSpeed = Math.min(800, Math.max(0, Math.round(action.payload)));
    },
    setPlaybackSpeed(state, action: PayloadAction<number>) {
      state.playbackSpeed = Math.min(2, Math.max(0.5, Number(action.payload) || 1));
    },
    setVoiceLanguage(state, action: PayloadAction<SettingsState['voiceLanguage']>) {
      state.voiceLanguage = action.payload;
    },
    setAutoClearCacheThreshold(state, action: PayloadAction<number>) {
      state.autoClearCacheThreshold = Math.min(5000, Math.max(100, Math.round(action.payload)));
    },
    setShowArabic(state, action: PayloadAction<boolean>) {
      state.showArabic = action.payload;
    },
    setShowTransliteration(state, action: PayloadAction<boolean>) {
      state.showTransliteration = action.payload;
    },
    setShowTranslation(state, action: PayloadAction<boolean>) {
      state.showTranslation = action.payload;
    },
    setArabicFontScale(state, action: PayloadAction<number>) {
      state.arabicFontScale = Math.min(50, Math.max(18, Math.round(26 * action.payload))) / 26;
      state.arabicFontSize = Math.round(26 * state.arabicFontScale);
    },
    setScript(state, action: PayloadAction<ScriptStyle>) {
      state.script = action.payload;
    },
    setReadingMode(state, action: PayloadAction<boolean>) {
      state.readingMode = action.payload;
    },
    setDefaultReciter(state, action: PayloadAction<string>) {
      state.defaultReciter = action.payload;
      state.defaultReciterId = action.payload;
    },
    setDownloadQuality(state, action: PayloadAction<DownloadQuality>) {
      state.downloadQuality = action.payload;
      state.audioQuality = QUALITY_TO_AUDIO[action.payload];
    },
    setFollowAudio(state, action: PayloadAction<boolean>) {
      state.followAudio = action.payload;
      state.autoScrollVerse = action.payload;
    },
    setAudioSyncOffset(state, action: PayloadAction<number>) {
      const ms = Math.round(action.payload) || 0;
      state.audioSyncOffsetMs = Math.max(-5000, Math.min(5000, ms));
    },
    setDefaultReciterOfferSeen(state) {
      state.hasOfferedDefaultReciterDownload = true;
    },
    setWifiDownloadPending(state, action: PayloadAction<boolean>) {
      state.wifiDownloadPending = action.payload;
    },
    setAssistantLayout(state, action: PayloadAction<AssistantLayout>) {
      state.assistantLayout = action.payload;
    },
    setNotificationPreference(
      state,
      action: PayloadAction<{ key: 'daily' | 'fridayKahf' | 'nightlyMulk'; enabled: boolean }>,
    ) {
      state.notifications[action.payload.key] = action.payload.enabled;
    },
    setReminderTime(state, action: PayloadAction<string>) {
      state.notifications.reminderTime = action.payload;
    },
    setDailyReadingGoalMinutes(state, action: PayloadAction<number>) {
      state.dailyReadingGoalMinutes = Math.min(60, Math.max(5, Math.round(action.payload)));
    },
    setProfileAvatar(state, action: PayloadAction<SettingsState['profileAvatar']>) {
      state.profileAvatar = action.payload;
    },
    setHifzRepetitionEnabled(state, action: PayloadAction<boolean>) {
      state.hifzRepetitionEnabled = action.payload;
    },
    setWordByWordEnabled(state, action: PayloadAction<boolean>) {
      state.wordByWordEnabled = action.payload;
    },
    setAmbientSoundsEnabled(state, action: PayloadAction<boolean>) {
      state.ambientSoundsEnabled = action.payload;
    },
    setAmbientSoundVolume(state, action: PayloadAction<number>) {
      state.ambientSoundVolume = Math.min(1, Math.max(0, action.payload));
    },
    setKhatamPlannerEnabled(state, action: PayloadAction<boolean>) {
      state.khatamPlannerEnabled = action.payload;
    },
    setKhatamTargetDays(state, action: PayloadAction<number>) {
      state.khatamTargetDays = Math.min(365, Math.max(7, Math.round(action.payload)));
    },
    setShowImportedAttribution(state, action: PayloadAction<boolean>) {
      state.showImportedAttribution = action.payload;
    },
  },
});

export const {
  restoreSettings,
  resetSettings,
  resetToDefaults,
  setArabicFontSize,
  setTranslationFontSize,
  setLineSpacing,
  setScriptType,
  setFontFamily,
  setShowVerseNumbers,
  setShowTajweedRules,
  setReducedMotion,
  setEnableFluidAnimations,
  setThemeMode,
  setAccentColor,
  setDefaultReciterId,
  setAudioQuality,
  setAutoScrollVerse,
  setAutoAdvanceSurah,
  setAutoScrollSpeed,
  setPlaybackSpeed,
  setVoiceLanguage,
  setAutoClearCacheThreshold,
  setShowArabic,
  setShowTransliteration,
  setShowTranslation,
  setArabicFontScale,
  setScript,
  setReadingMode,
  setDefaultReciter,
  setDownloadQuality,
  setFollowAudio,
  setAudioSyncOffset,
  setDefaultReciterOfferSeen,
  setWifiDownloadPending,
  setAssistantLayout,
  setNotificationPreference,
  setReminderTime,
  setDailyReadingGoalMinutes,
  setProfileAvatar,
  setHifzRepetitionEnabled,
  setWordByWordEnabled,
  setAmbientSoundsEnabled,
  setAmbientSoundVolume,
  setKhatamPlannerEnabled,
  setKhatamTargetDays,
  setShowImportedAttribution,
} = settingsSlice.actions;
export default settingsSlice.reducer;
