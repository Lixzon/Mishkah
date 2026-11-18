import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store';
import { push } from '../store/slices/toastSlice';
import { setCustomAccent } from '../store/slices/themeSlice';
import {
  resetSettings,
  setAccentColor,
  setArabicFontSize,
  setAudioQuality,
  setAutoClearCacheThreshold,
  setAutoAdvanceSurah,
  setAutoScrollVerse,
  setAutoScrollSpeed,
  setDefaultReciterId,
  setEnableFluidAnimations,
  setFontFamily,
  setLineSpacing,
  setPlaybackSpeed,
  setScriptType,
  setShowArabic,
  setShowTajweedRules,
  setShowTransliteration,
  setShowTranslation,
  setShowVerseNumbers,
  setThemeMode,
  setTranslationFontSize,
  setVoiceLanguage,
  setReadingMode,
  setAudioSyncOffset,
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
} from '../store/slices/settingsSlice';
import { clearAllProgress, devAddStreakDays, devResetStreak, devSetStreak, setIstiqamahGoal } from '../store/slices/progressSlice';
import { BADGE_TONES, ISTIQAMAH_MILESTONES, TIERS, TOTAL_QURAN_AYAHS, isTierUnlocked, tierProgress } from '../lib/progression';
import {
  AI_UI_FEATURES,
  AI_UI_LOCKED_TEXT,
  AI_UI_UNLOCK_DAYS,
  ASSISTANT_LAYOUTS,
  CUSTOM_READING_THEMES,
  READING_THEMES_UNLOCK_DAYS,
  isAiUiUnlocked,
  isReadingThemesUnlocked,
  isThemeSelectable,
  lockedText,
  unlockProgress,
} from '../lib/unlocks';
import { normalizeHex } from '../lib/customTheme';
import { db } from '../db/database';
import { useStorageStats } from '../services/useDownloads';
import { ACCENTS, APP_ATTRIBUTION, APP_NAME, APP_TAGLINE, DOWNLOAD_QUALITY_OPTIONS, RECITERS } from '../lib/constants';
import { formatBytes } from '../lib/utils';
import { PageHeader } from '../components/ui/common';
import { Icon, type IconName } from '../components/ui/Icon';
import { Segmented, Slider, Toggle } from '../components/ui/controls';
import { Modal } from '../components/ui/Modal';
import { MihrabLogo } from '../components/ui/MihrabLogo';
import { PROFILE_AVATARS, ProfileAvatar } from '../components/ui/ProfileAvatar';
import { createBackupJson, parseBackupJson, restoreBackup, type FurqanBackup } from '../lib/backup';
import { totalLikedItems } from '../store/slices/likesSlice';
import type { ThemeMode } from '../types';
import { CloudSyncPanel } from '../components/CloudSync';

/* beforeinstallprompt is a Chromium-only event */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function SettingsPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const theme = useAppSelector((s) => s.theme);
  const settings = useAppSelector((s) => s.settings);
  const progress = useAppSelector((s) => s.progress);
  const playlists = useAppSelector((s) => s.playlists);
  const likedCount = useAppSelector((s) => totalLikedItems(s.likes));
  const bookmarks = useAppSelector((s) => s.bookmarks.items);
  const storage = useStorageStats();
  const backupInputRef = useRef<HTMLInputElement>(null);

  const [confirmClearAudio, setConfirmClearAudio] = useState(false);
  const [confirmResetProgress, setConfirmResetProgress] = useState(false);
  const [confirmResetSettings, setConfirmResetSettings] = useState(false);
  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  );
  const [pendingBackup, setPendingBackup] = useState<FurqanBackup | null>(null);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const mishkahUrl = (import.meta.env.VITE_MISHKAH_URL?.trim() || 'https://lixzon.github.io/Mishkah').replace(/\/+$/, '');

  const streak = progress.progression.currentStreak;
  const readingThemesUnlocked = isReadingThemesUnlocked(streak);
  const aiUiUnlocked = isAiUiUnlocked(streak);

  // Sepia is one of the gated reading themes, so it only joins the free picker
  // once the milestone is reached — or while it is the theme in use, so the
  // chip stays honest for a reader whose streak has since dropped.
  const themeOptions: Array<{ value: ThemeMode; label: string; swatch: string }> = [
    { value: 'dark', label: 'Dark', swatch: '#101d19' },
    { value: 'oled', label: 'OLED Black', swatch: '#050505' },
    { value: 'sepia', label: 'Warm Parchment', swatch: '#f8f0df' },
    { value: 'emerald', label: 'Emerald Midnight', swatch: '#0d1e15' },
    { value: 'light', label: 'Light', swatch: '#ffffff' },
  ];

  const exportBackup = () => {
    try {
      const blob = new Blob([createBackupJson()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `furqan-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      dispatch(push('Your Furqan backup is ready.', 'success'));
    } catch {
      dispatch(push('Could not create a backup file.', 'error'));
    }
  };

  const importBackup = async (file?: File) => {
    if (!file) return;
    try {
      const backup = parseBackupJson(await file.text());
      const progressMaps = [progress.lastRead, progress.lastListened, progress.surahCompleted,
        progress.juzCompleted, progress.dailyActivity, progress.ayahsReached, progress.milestones];
      const hasUserData = progress.lastPosition !== null || progress.activity.length > 0 ||
        progress.quoteHistory.length > 0 || progressMaps.some((records) => Object.keys(records).length > 0) ||
        likedCount > 0 || bookmarks.length > 0 || playlists.playlists.some((playlist) =>
          playlist.createdAt > 0 || playlist.name !== 'My Playlist' || playlist.items.length > 0);
      if (hasUserData) {
        setPendingBackup(backup);
        return;
      }
      restoreBackup(backup);
      dispatch(push('Your data has been restored.', 'success'));
    } catch (error) {
      dispatch(push(error instanceof Error ? error.message : 'Could not read this backup file.', 'error'));
    }
  };

  const toggleNotification = async (key: 'daily' | 'fridayKahf' | 'nightlyMulk', enabled: boolean) => {
    if (!enabled) {
      dispatch(setNotificationPreference({ key, enabled: false }));
      return;
    }
    if (typeof Notification === 'undefined') {
      dispatch(push('Notifications are not supported in this browser.', 'error'));
      return;
    }
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === 'granted') {
      dispatch(setNotificationPreference({ key, enabled: true }));
    } else {
      dispatch(push('Allow notifications in your browser to enable reminders.', 'info'));
    }
  };

  useEffect(() => {
    const onPrompt = (e: Event) => setInstallEvt(e as BeforeInstallPromptEvent);
    const onInstalled = () => setInstallEvt(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const openMishkah = () => {
    if (!window.confirm('Open Mishkah for prayer, fasting, and daily worship?')) return;
    window.location.assign(`${mishkahUrl}/`);
  };

  return (
    <div className="page-enter">
      <PageHeader
        title="Settings"
        subtitle="Theme, reading & playback preferences."
        right={
          <button
            type="button"
            onClick={() => navigate('/profile')}
            aria-label="Open profile"
            className="pressable inline-flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface2 text-muted hover:text-ink"
          >
            <ProfileAvatar id={settings.profileAvatar} size={26} />
          </button>
        }
      />

      <Section title="Profile avatar" icon="user" />
      <Card>
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-surface2">
            <ProfileAvatar id={settings.profileAvatar} size={36} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-ink">Choose a calm motif</div>
            <div className="text-xs text-mut">Nature and Islamic heritage, with no living figures.</div>
          </div>
          <button type="button" onClick={() => setAvatarPickerOpen(true)} className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-onaccent">
            Choose
          </button>
        </div>
      </Card>
      <Section title="Cloud sync" icon="cloud" />
      <CloudSyncPanel />
      <Modal open={avatarPickerOpen} onClose={() => setAvatarPickerOpen(false)} title="Choose your avatar" size="md">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PROFILE_AVATARS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              aria-pressed={settings.profileAvatar === id}
              onClick={() => {
                dispatch(setProfileAvatar(id));
                setAvatarPickerOpen(false);
              }}
              className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border p-3 transition ${settings.profileAvatar === id ? 'border-accent bg-accent/10 ring-1 ring-accent/40' : 'border-line bg-surface2'}`}
            >
              <ProfileAvatar id={id} size={38} />
              <span className="text-center text-xs font-medium text-ink">{label}</span>
            </button>
          ))}
        </div>
      </Modal>

      {/* ---- Appearance ---- */}
      <Section title="Appearance" icon="sun" />
      <Card>
        <div className="mb-2 text-xs font-medium text-mut">Theme</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {themeOptions.map((option) => {
            const active = theme.mode === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => dispatch(setThemeMode(option.value))}
                className={`flex items-center gap-2 rounded-xl border p-2 text-left text-xs font-medium ${active ? 'border-accent ring-1 ring-accent/40' : 'border-line'}`}
              >
                <span className="h-8 w-8 shrink-0 rounded-lg border border-line" style={{ backgroundColor: option.swatch }} />
                <span className="min-w-0 text-ink">{option.label}</span>
              </button>
            );
          })}
        </div>
        <div className="mb-1 mt-4 text-xs font-medium text-mut">Accent colour</div>
        <div className="flex flex-wrap gap-2.5">
          {ACCENTS.map((a) => {
            const active = a.id === theme.accent;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => dispatch(setAccentColor(a.id))}
                className="flex flex-col items-center gap-1"
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full transition-transform pressable ${
                    active ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface' : ''
                  }`}
                  style={{ backgroundColor: a.swatch }}
                >
                  {active && <Icon name="check" size={16} className="text-white" />}
                </span>
                <span className={`text-[10px] ${active ? 'font-semibold text-ink' : 'text-mut'}`}>
                  {a.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 border-t border-line pt-2">
          <Row
            label="Fluid animations"
            hint="Reduce motion across transitions and page effects"
            control={<Toggle checked={settings.enableFluidAnimations} onChange={(enabled) => dispatch(setEnableFluidAnimations(enabled))} label="Fluid animations" />}
          />
        </div>

        {/* Reading themes unlocked by the 100-day milestone. */}
        <div className="mt-4 border-t border-line pt-3">
          <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-mut">
            <span className="inline-flex items-center gap-1.5">
              <Icon
                name={readingThemesUnlocked ? 'unlock' : 'lock'}
                size={13}
                className={readingThemesUnlocked ? 'text-accent' : undefined}
              />
              Custom reading themes
            </span>
            <span className="tabular-nums">
              {Math.min(streak, READING_THEMES_UNLOCK_DAYS)}/{READING_THEMES_UNLOCK_DAYS} days
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {CUSTOM_READING_THEMES.map((option) => {
              const active = theme.mode === option.id;
              const selectable = isThemeSelectable(option.id, streak, active);
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={!selectable}
                  aria-pressed={active}
                  onClick={() => dispatch(setThemeMode(option.id))}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 text-[11px] font-medium pressable ${
                    active ? 'border-accent bg-accent/8' : 'border-line bg-surface2'
                  } ${selectable ? '' : 'opacity-70'}`}
                >
                  <span
                    className={`h-8 w-8 rounded-full border border-line ${
                      active ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface' : ''
                    }`}
                    style={{ backgroundColor: option.swatch }}
                  />
                  <span className="inline-flex items-center gap-1 text-ink">
                    {!selectable && <Icon name="lock" size={11} />}
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>
          {!readingThemesUnlocked && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-mut">
              <Icon name="lock" size={13} />
              {lockedText(READING_THEMES_UNLOCK_DAYS)}
            </p>
          )}
          <p className="mt-1.5 text-[11px] leading-relaxed text-mut">
            {CUSTOM_READING_THEMES.map((option) => option.description).join(' · ')}
          </p>
        </div>
      </Card>

      {/* ---- AI UI customization (365-day milestone) ---- */}
      <Section title="AI UI Customization" icon="sparkle" />
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 text-sm font-medium text-ink">
              <Icon
                name={aiUiUnlocked ? 'unlock' : 'lock'}
                size={15}
                className={aiUiUnlocked ? 'text-accent' : 'text-mut'}
              />
              {aiUiUnlocked ? 'Unlocked' : 'Locked'}
            </div>
            <div className="mt-0.5 text-xs text-mut">
              {aiUiUnlocked
                ? 'Dynamic Quran Assistant layouts and custom themes are available.'
                : AI_UI_FEATURES.map((feature) => feature.label).join(' · ')}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-2xl font-bold tabular-nums text-ink">
              {Math.min(streak, AI_UI_UNLOCK_DAYS)}
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-mut">
              / {AI_UI_UNLOCK_DAYS} days
            </div>
          </div>
        </div>

        {!aiUiUnlocked && (
          <>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface2">
              <div
                className="h-full rounded-full bg-accent/70"
                style={{ width: `${unlockProgress(streak, AI_UI_UNLOCK_DAYS).ratio * 100}%` }}
              />
            </div>
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-surface2 px-2.5 py-1.5 text-[11px] font-medium text-mut">
              <Icon name="lock" size={13} />
              {AI_UI_LOCKED_TEXT}
            </p>
            <ul className="mt-3 space-y-2">
              {AI_UI_FEATURES.map((feature) => (
                <li key={feature.id} className="flex items-start gap-2">
                  <Icon name="lock" size={13} className="mt-0.5 shrink-0 text-mut" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">{feature.label}</span>
                    <span className="block text-xs text-mut">{feature.description}</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        {aiUiUnlocked && (
          <>
            <div className="mt-4">
              <div className="mb-1 text-xs font-medium text-mut">Dynamic Quran Assistant layouts</div>
              <Segmented
                value={settings.assistantLayout}
                onChange={(value) => dispatch(setAssistantLayout(value))}
                options={ASSISTANT_LAYOUTS.map((layout) => ({ value: layout.id, label: layout.label }))}
                size="sm"
              />
              <p className="mt-1.5 text-[11px] leading-relaxed text-mut">
                {ASSISTANT_LAYOUTS.find((layout) => layout.id === settings.assistantLayout)?.description}
              </p>
            </div>
            <div className="mt-4 border-t border-line pt-3">
              <div className="mb-1 text-xs font-medium text-mut">Custom accent colour</div>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  aria-label="Custom accent colour"
                  value={theme.customAccent ?? '#0d9488'}
                  onChange={(event) => {
                    const hex = normalizeHex(event.target.value);
                    if (hex) dispatch(setCustomAccent(hex));
                  }}
                  className="h-10 w-14 shrink-0 cursor-pointer rounded-lg border border-line bg-surface2 p-1"
                />
                <span className="min-w-0 flex-1 text-xs text-mut">
                  {theme.customAccent ? (
                    <>
                      Your accent:{' '}
                      <span className="font-medium tabular-nums text-ink">{theme.customAccent}</span>
                    </>
                  ) : (
                    'Pick a colour to build your own accent.'
                  )}
                </span>
                {theme.customAccent && (
                  <button
                    type="button"
                    onClick={() => dispatch(setCustomAccent(null))}
                    className="shrink-0 rounded-full bg-surface2 px-3 py-1.5 text-xs font-semibold text-mut pressable"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </Card>

      {/* ---- Reading ---- */}
      <Section title="Reading" icon="book" />
      <Card>
        <Row
          label="Arabic text"
          control={<Toggle checked={settings.showArabic} onChange={(v) => dispatch(setShowArabic(v))} label="Arabic text" />}
        />
        <Row
          label="Transliteration"
          control={<Toggle checked={settings.showTransliteration} onChange={(v) => dispatch(setShowTransliteration(v))} label="Transliteration" />}
        />
        <Row
          label="English translation"
          control={<Toggle checked={settings.showTranslation} onChange={(v) => dispatch(setShowTranslation(v))} label="English translation" />}
        />
        <Row
          label="Auto-scroll with recitation"
          hint="Follow the ayah currently being recited"
          control={<Toggle checked={settings.autoScrollVerse} onChange={(v) => dispatch(setAutoScrollVerse(v))} label="Auto-scroll with recitation" />}
        />
        <Row
          label="Auto-advance to next surah"
          hint="Continue automatically when the current surah ends"
          control={<Toggle checked={settings.autoAdvanceSurah} onChange={(v) => dispatch(setAutoAdvanceSurah(v))} label="Auto-advance to next surah" />}
        />
        <Row
          label="Verse numbers"
          control={<Toggle checked={settings.showVerseNumbers} onChange={(v) => dispatch(setShowVerseNumbers(v))} label="Verse numbers" />}
        />
        <Row
          label="Tajweed rules"
          control={<Toggle checked={settings.showTajweedRules} onChange={(v) => dispatch(setShowTajweedRules(v))} label="Tajweed rules" />}
        />
        <Row
          label="Focus mode"
          hint="Hide navigation while reading"
          control={<Toggle checked={settings.readingMode} onChange={(v) => dispatch(setReadingMode(v))} label="Focus mode" />}
        />
        <div className="mt-3">
          <div className="mb-1 text-xs font-medium text-mut">Mushaf script</div>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface2 p-1">
            {([
              { id: 'uthmani', label: 'Uthmani' },
              { id: 'indopak', label: 'IndoPak' },
              { id: 'tajweed', label: 'Tajweed' },
            ] as const).map((option) => {
              const unavailable = option.id === 'tajweed';
              const active = settings.scriptType === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={unavailable}
                  aria-pressed={active}
                  title={unavailable ? 'Colorized Tajweed data is not bundled yet.' : undefined}
                  onClick={() => dispatch(setScriptType(option.id))}
                  className={`rounded-lg px-2 py-2 text-xs font-semibold ${active ? 'bg-accent text-onaccent' : 'text-mut'} ${unavailable ? 'cursor-not-allowed opacity-45' : ''}`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-[11px] text-mut">IndoPak text is available offline. Tajweed color annotations are not part of the local text dataset.</p>
        </div>
        <div className="mt-3">
          <div className="mb-1 text-xs font-medium text-mut">Arabic font family</div>
          <Segmented
            value={settings.fontFamily}
            onChange={(value) => dispatch(setFontFamily(value))}
            options={[
              { value: 'kfgqpc', label: 'KFGQPC' },
              { value: 'scheherazade', label: 'Scheherazade' },
              { value: 'amiri', label: 'Amiri' },
            ]}
            size="sm"
          />
        </div>
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs font-medium text-mut">
            <span>Arabic font size</span>
            <span className="tabular-nums">{settings.arabicFontSize}px</span>
          </div>
          <Slider
            min={18}
            max={50}
            step={1}
            value={settings.arabicFontSize}
            onChange={(v) => dispatch(setArabicFontSize(v))}
            ariaLabel="Arabic font size"
          />
          <div className="mt-2 rounded-xl bg-surface2 px-3 py-2 text-center text-ink" dir="rtl">
            <span className="ar-uthmani" style={{ fontSize: settings.arabicFontSize, lineHeight: settings.lineSpacing }}>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</span>
          </div>
        </div>
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs font-medium text-mut">
            <span>Translation font size</span>
            <span className="tabular-nums">{settings.translationFontSize}px</span>
          </div>
          <Slider min={12} max={30} step={1} value={settings.translationFontSize} onChange={(v) => dispatch(setTranslationFontSize(v))} ariaLabel="Translation font size" />
          <p className="mt-2 text-ink2" style={{ fontSize: settings.translationFontSize, lineHeight: settings.lineSpacing }}>
            In the name of Allah, the Entirely Merciful, the Especially Merciful.
          </p>
        </div>
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs font-medium text-mut">
            <span>Line spacing</span>
            <span className="tabular-nums">{settings.lineSpacing.toFixed(1)}</span>
          </div>
          <Slider min={1.2} max={2.6} step={0.1} value={settings.lineSpacing} onChange={(v) => dispatch(setLineSpacing(v))} ariaLabel="Reader line spacing" />
        </div>
      </Card>

      {/* ---- Daily goal & study tools ---- */}
      <Section title="Daily reading & study tools" icon="sparkle" />
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-ink">Daily reading goal</div>
            <div className="text-xs text-mut">Reading streak unlocks at this target; reading can continue beyond it.</div>
          </div>
          <span className="shrink-0 text-sm font-semibold tabular-nums text-accent">{settings.dailyReadingGoalMinutes} min</span>
        </div>
        <Slider
          min={5}
          max={60}
          step={1}
          value={settings.dailyReadingGoalMinutes}
          onChange={(value) => dispatch(setDailyReadingGoalMinutes(value))}
          ariaLabel="Daily reading goal in minutes"
        />
        <div className="mt-3 border-t border-line pt-2">
          <Row label="Hifz verse repetition" hint="Show a finite repeat control in the verse focus view" control={<Toggle checked={settings.hifzRepetitionEnabled} onChange={(value) => dispatch(setHifzRepetitionEnabled(value))} label="Hifz verse repetition" />} />
          <Row label="Word-by-word glosses" hint="Show available word glosses in verse focus" control={<Toggle checked={settings.wordByWordEnabled} onChange={(value) => dispatch(setWordByWordEnabled(value))} label="Word-by-word glosses" />} />
          <Row label="Ambient sound" hint="Soft generated ambience while reading" control={<Toggle checked={settings.ambientSoundsEnabled} onChange={(value) => dispatch(setAmbientSoundsEnabled(value))} label="Ambient sound" />} />
          {settings.ambientSoundsEnabled && (
            <div className="flex items-center gap-3 py-2">
              <Icon name="volume" size={16} className="text-mut" />
              <Slider min={0} max={0.5} step={0.01} value={settings.ambientSoundVolume} onChange={(value) => dispatch(setAmbientSoundVolume(value))} ariaLabel="Ambient sound volume" />
              <span className="w-9 text-right text-xs tabular-nums text-mut">{Math.round(settings.ambientSoundVolume * 100)}%</span>
            </div>
          )}
          <Row label="Khatam planner" hint="Set a target to pace the full Qur’an" control={<Toggle checked={settings.khatamPlannerEnabled} onChange={(value) => dispatch(setKhatamPlannerEnabled(value))} label="Khatam planner" />} />
          {settings.khatamPlannerEnabled && (
            <div className="pt-2">
              <div className="mb-1 flex justify-between text-xs text-mut">
                <span>Finish in</span>
                <span className="font-semibold tabular-nums text-ink">{settings.khatamTargetDays} days · {Math.ceil(TOTAL_QURAN_AYAHS / settings.khatamTargetDays)} ayahs/day</span>
              </div>
              <Slider min={7} max={365} step={1} value={settings.khatamTargetDays} onChange={(value) => dispatch(setKhatamTargetDays(value))} ariaLabel="Khatam target days" />
            </div>
          )}
        </div>
      </Card>

      {/* ---- Audio ---- */}
      <Section title="Audio" icon="music" />
      <Card>
        <div className="mb-1 text-xs font-medium text-mut">Default reciter</div>
        <select
          value={settings.defaultReciterId}
          onChange={(e) => dispatch(setDefaultReciterId(e.target.value))}
          className="w-full rounded-xl border border-line bg-surface2 px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
        >
          {RECITERS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label} · {r.arabicName}
            </option>
          ))}
        </select>

        <div className="mt-4 border-t border-line pt-3">
          <div className="mb-1 text-xs font-medium text-mut">Download quality</div>
          <div className="grid grid-cols-3 gap-2">
            {DOWNLOAD_QUALITY_OPTIONS.map((option) => {
              const audioQuality = option.bitrate === 32 ? '32kbps' : option.bitrate === 64 ? '64kbps' : '128kbps';
              const active = settings.audioQuality === audioQuality;
              const sizeMb = ((1.42 * option.bitrate) / 128).toFixed(2);
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => dispatch(setAudioQuality(audioQuality))}
                  className={`rounded-xl border px-2 py-2 text-left ${active ? 'border-accent bg-accent/8 text-ink' : 'border-line bg-surface2 text-mut'}`}
                >
                  <div className="text-sm font-semibold">{option.label}</div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-widest">{option.bitrate} kbps</div>
                  <div className="mt-1 text-[11px]">~{sizeMb} MB / surah</div>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-mut">
            Existing downloads stay untouched. The configured reciter CDN currently serves 128 kbps; lower tiers may fall back to its available bitrate.
          </p>
        </div>

        <div className="mt-4 border-t border-line pt-3">
          <div className="mb-1 text-xs font-medium text-mut">Recite &amp; Find voice language</div>
          <Segmented
            value={settings.voiceLanguage}
            onChange={(value) => dispatch(setVoiceLanguage(value))}
            options={[{ value: 'ar-SA', label: 'Arabic' }, { value: 'en-US', label: 'English' }]}
            size="sm"
          />
        </div>

        <div className="mt-4 border-t border-line pt-3">
          <div className="mb-1 flex items-center justify-between text-xs font-medium text-mut">
            <span>Playback speed</span>
            <span className="tabular-nums">{settings.playbackSpeed.toFixed(1)}x</span>
          </div>
          <Slider min={0.5} max={2} step={0.1} value={settings.playbackSpeed} onChange={(v) => dispatch(setPlaybackSpeed(v))} ariaLabel="Playback speed" />
        </div>

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-xs font-medium text-mut">
            <span>Auto-scroll timing offset</span>
            <span className="tabular-nums">
              {settings.audioSyncOffsetMs === 0 ? 'Off' : `${(settings.audioSyncOffsetMs / 1000).toFixed(2)}s`}
            </span>
          </div>
          <Slider
            min={-5000}
            max={5000}
            step={250}
            value={settings.audioSyncOffsetMs}
            onChange={(v) => dispatch(setAudioSyncOffset(v))}
            ariaLabel="Auto-scroll timing offset"
          />
          <p className="mt-1 text-[11px] leading-relaxed text-mut">
            Nudges the verse highlight and auto-scroll against the recitation. Move it negative
            (e.g. −2.50s) when a verse lights up before you hear it; move it positive when the
            highlight trails behind the reciter. Start at 0 — reciters and renditions differ.
          </p>
          {settings.audioSyncOffsetMs !== 0 && (
            <button
              type="button"
              onClick={() => dispatch(setAudioSyncOffset(0))}
              className="mt-2 rounded-full border border-line bg-surface2 px-3 py-1.5 text-xs font-semibold text-mut pressable hover:text-ink"
            >
              Reset offset
            </button>
          )}
        </div>

        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs text-mut">
            <span>Audio cache</span>
            <span className="tabular-nums">{formatBytes(storage.bytes)} / {settings.autoClearCacheThreshold} MB</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-surface2"
            role="progressbar"
            aria-label="Audio cache usage"
            aria-valuemin={0}
            aria-valuemax={settings.autoClearCacheThreshold}
            aria-valuenow={Math.min(settings.autoClearCacheThreshold, storage.bytes / (1024 * 1024))}
          >
            <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${Math.min(100, (storage.bytes / (settings.autoClearCacheThreshold * 1024 * 1024)) * 100)}%` }} />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs font-medium text-mut">
            <span>Cache warning threshold</span>
            <span className="tabular-nums">{settings.autoClearCacheThreshold} MB</span>
          </div>
          <Slider min={100} max={5000} step={100} value={settings.autoClearCacheThreshold} onChange={(v) => dispatch(setAutoClearCacheThreshold(v))} ariaLabel="Audio cache warning threshold" />
        </div>
      </Card>

      {/* ---- Storage & downloads ---- */}
      <Section title="Storage & Downloads" icon="download" />
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-ink">Downloaded recitations</div>
            <div className="mt-0.5 text-xs text-mut">
              {storage.count === 0
                ? 'Nothing downloaded yet'
                : `${storage.count} surah${storage.count === 1 ? '' : 's'} stored on this device`}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-2xl font-bold tabular-nums text-ink">{formatBytes(storage.bytes)}</div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-mut">used</div>
          </div>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-mut">
          {storage.count === 0
            ? 'No recitations are stored yet. '
            : `${formatBytes(storage.bytes)} used of downloaded recitations. `}
          Qur’an text is cached as you read, so surahs you have already opened stay readable without a
          connection. Audio is only stored when you download it, so it never fills your device on its
          own.
        </p>

        <button
          type="button"
          onClick={() => navigate('/downloads')}
          className="mt-3 flex w-full items-center justify-between rounded-xl bg-surface2 px-3.5 py-3 text-sm pressable"
        >
          <span className="inline-flex items-center gap-2 font-medium text-ink">
            <Icon name="download" size={16} className="text-accent" />
            Manage downloads
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-mut">
            {storage.count === 0 ? 'Add surahs' : 'Add or remove surahs'}
            <Icon name="forward" size={14} />
          </span>
        </button>

        {storage.count > 0 && (
          <button
            type="button"
            onClick={() => setConfirmClearAudio(true)}
            className="mt-2 flex w-full items-center justify-between rounded-xl px-2 py-2 text-sm pressable"
          >
            <span className="inline-flex items-center gap-2 font-medium text-danger">
              <Icon name="trash" size={16} />
              Clear all downloaded audio
            </span>
            <span className="text-xs text-mut">{formatBytes(storage.bytes)}</span>
          </button>
        )}
      </Card>

      {/* ---- Reminders ---- */}
      <Section title="Reminders" icon="clock" />
      <Card>
        <p className="mb-3 text-xs leading-relaxed text-mut">
          Reminders are optional. Enabling one asks your browser for permission and shows the reminder while Furqan is available. The in-app check-in remains available when background notifications are limited.
        </p>
        <Row label="Daily Qur’an check-in" control={<Toggle checked={settings.notifications.daily} onChange={(v) => void toggleNotification('daily', v)} label="Daily Qur’an check-in" />} />
        <Row label="Friday · Surah Al-Kahf" control={<Toggle checked={settings.notifications.fridayKahf} onChange={(v) => void toggleNotification('fridayKahf', v)} label="Friday Surah Al-Kahf reminder" />} />
        <Row label="Nightly · Surah Al-Mulk" control={<Toggle checked={settings.notifications.nightlyMulk} onChange={(v) => void toggleNotification('nightlyMulk', v)} label="Nightly Surah Al-Mulk reminder" />} />
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
          <label htmlFor="reminder-time" className="text-sm font-medium text-ink">Reminder time</label>
          <input id="reminder-time" type="time" value={settings.notifications.reminderTime} disabled={notificationPermission !== 'granted'} onChange={(event) => dispatch(setReminderTime(event.target.value))} className="rounded-xl border border-line bg-surface2 px-3 py-2 text-sm text-ink disabled:opacity-50" />
        </div>
      </Card>

      {/* ---- Istiqamah progression ---- */}
      <Section title="Istiqamah progression" icon="sparkle" />
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-ink">Current streak</div>
            <div className="mt-0.5 text-xs text-mut">
              Longest {progress.progression.highestStreak} days
              {progress.progression.streakFreezes > 0 ? ` · ${progress.progression.streakFreezes} streak freeze${progress.progression.streakFreezes === 1 ? '' : 's'}` : ''}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-2xl font-bold tabular-nums text-ink">{progress.progression.currentStreak}</div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-mut">days</div>
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs font-medium text-mut">
            <span>Your Istiqamah goal</span>
            <span className="tabular-nums">
              {Math.min(progress.progression.currentStreak, progress.progression.istiqamahGoal)}/{progress.progression.istiqamahGoal} days
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface2">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${Math.min(100, (progress.progression.currentStreak / Math.max(1, progress.progression.istiqamahGoal)) * 100)}%` }}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {ISTIQAMAH_MILESTONES.map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => dispatch(setIstiqamahGoal({ days }))}
                className={`rounded-full px-3 py-1.5 text-xs font-medium pressable ${
                  progress.progression.istiqamahGoal === days ? 'bg-accent text-onaccent' : 'bg-surface2 text-mut hover:text-ink'
                }`}
              >
                {days} days
              </button>
            ))}
          </div>
          <div className="mt-4 border-t border-line pt-3">
            <div className="mb-1 flex items-center justify-between text-xs font-medium text-mut">
              <span>Auto-scroll speed</span>
              <span className="tabular-nums">{settings.autoScrollSpeed === 0 ? 'Immediate' : `${settings.autoScrollSpeed} ms delay`}</span>
            </div>
            <Slider min={0} max={800} step={20} value={settings.autoScrollSpeed} onChange={(v) => dispatch(setAutoScrollSpeed(v))} ariaLabel="Auto-scroll speed" />
          </div>
        </div>

        <div className="mt-4 text-xs font-medium text-mut">Themes and badges</div>
        <div className="mt-2 space-y-2">
          {TIERS.map((tier) => {
            const unlocked = isTierUnlocked(progress.progression.currentStreak, tier);
            const { ratio, remaining } = tierProgress(progress.progression.currentStreak, tier);
            const applied =
              Boolean(tier.theme) &&
              (!tier.theme?.mode || theme.mode === tier.theme.mode) &&
              (!tier.theme?.accent || theme.accent === tier.theme.accent);
            return (
              <div
                key={tier.tier}
                className={`rounded-xl border p-3 ${unlocked ? 'border-accent/40 bg-accent/8' : 'border-line bg-surface2'}`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base"
                    style={{ backgroundColor: `${BADGE_TONES[tier.badge]}22`, color: BADGE_TONES[tier.badge] }}
                  >
                    {unlocked ? <Icon name="sparkle" size={18} /> : <span aria-hidden="true">🔒</span>}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-ink">
                      {tier.name} <span className="text-xs font-normal text-mut">· {tier.days} days</span>
                    </div>
                    <div className="text-xs text-mut">{tier.unlocks}</div>
                  </div>
                  {unlocked && tier.theme && (
                    <button
                      type="button"
                      onClick={() => {
                        if (tier.theme?.mode) dispatch(setThemeMode(tier.theme.mode));
                        if (tier.theme?.accent) dispatch(setAccentColor(tier.theme.accent));
                      }}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold pressable ${
                        applied ? 'bg-surface2 text-mut' : 'bg-accent text-onaccent'
                      }`}
                    >
                      {applied ? 'Applied' : 'Apply'}
                    </button>
                  )}
                  {unlocked && !tier.theme && (
                    <span className="shrink-0 rounded-full bg-surface2 px-3 py-1.5 text-xs font-semibold text-accent">Unlocked</span>
                  )}
                </div>

                {!unlocked && (
                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-[11px] text-mut">
                      <span>Locked: reach {tier.days} days to unlock</span>
                      <span className="tabular-nums">Current: {progress.progression.currentStreak}/{tier.days}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface3">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${ratio * 100}%` }} />
                    </div>
                    <div className="mt-1 text-[11px] text-mut">
                      {remaining} day{remaining === 1 ? '' : 's'} to go
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 rounded-xl border border-line2 p-3">
          <div className="text-xs font-medium text-mut">Developer test controls</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => dispatch(devAddStreakDays({ days: 7 }))}
              className="rounded-full bg-surface2 px-3 py-1.5 text-xs font-medium text-ink pressable"
            >
              Add +7 Days
            </button>
            <button
              type="button"
              onClick={() => dispatch(devSetStreak({ days: 364 }))}
              className="rounded-full bg-surface2 px-3 py-1.5 text-xs font-medium text-ink pressable"
            >
              Set Streak to 364
            </button>
            <button
              type="button"
              onClick={() => dispatch(devResetStreak())}
              className="rounded-full bg-surface2 px-3 py-1.5 text-xs font-medium text-ink pressable"
            >
              Reset Streak
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-mut">
            These simulate streak days so the tier locks and unlock celebrations can be tested without waiting.
          </p>
        </div>
      </Card>

      {/* ---- Privacy ---- */}
      <Section title="Privacy" icon="lock" />
      <Card>
        <Row
          label="Show attribution on imported playlists"
          hint="Displays “Originally created by …” on playlists added from a shared code."
          control={
            <Toggle
              checked={settings.showImportedAttribution}
              onChange={(value) => dispatch(setShowImportedAttribution(value))}
              label="Show attribution on imported playlists"
            />
          }
        />
      </Card>

      {/* ---- Data ---- */}
      <Section title="Data" icon="settings" />
      <Card>
        <p className="mb-3 text-xs leading-relaxed text-mut">
          Keep a copy in case you get a new phone or reinstall Furqan. Downloaded audio is not included and can be saved again.
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportBackup}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-onaccent pressable"
          >
            <Icon name="download" size={16} />
            Back up your data
          </button>
          <button
            type="button"
            onClick={() => backupInputRef.current?.click()}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-line bg-surface2 px-4 py-2.5 text-sm font-semibold text-ink pressable"
          >
            <Icon name="refresh" size={16} />
            Restore backup
          </button>
          <input
            ref={backupInputRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(event) => {
              void importBackup(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
        </div>
        <button
          type="button"
          onClick={() => setConfirmResetProgress(true)}
          className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-sm pressable"
        >
          <span className="inline-flex items-center gap-2 font-medium text-danger">
            <Icon name="refresh" size={16} />
            Reset reading progress
          </span>
        </button>
        <button
          type="button"
          onClick={() => setConfirmResetSettings(true)}
          className="mt-2 flex w-full items-center justify-between rounded-xl px-2 py-2 text-sm pressable"
        >
          <span className="inline-flex items-center gap-2 font-medium text-danger">
            <Icon name="refresh" size={16} />
            Reset all settings to default
          </span>
        </button>
      </Card>

      {/* ---- Support ---- */}
      <Section title="Support Furqan & LIXZON" icon="heart" />
      <Card>
        <button
          type="button"
          onClick={() => navigate('/support')}
          className="flex w-full items-center gap-3 rounded-xl px-1 py-1 text-left pressable"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/12 text-accent">
            <Icon name="heart" size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink">Support Furqan & LIXZON</span>
            <span className="block text-xs text-mut">Direct transfer · card checkout · Play billing</span>
          </span>
          <Icon name="chevronRight" size={18} className="text-mut" />
        </button>
      </Card>

      {/* ---- LIXZON ecosystem ---- */}
      <Section title="LIXZON ecosystem" icon="info" />
      <Card>
        <button
          type="button"
          onClick={openMishkah}
          className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left pressable"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/12 text-accent">
            <Icon name="sun" size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink">Open Mishkah</span>
            <span className="block text-xs text-mut">Prayer, fasting, and daily worship</span>
          </span>
          <Icon name="chevronRight" size={18} className="text-mut" />
        </button>
        <div className="my-1 border-t border-line" />
        <button
          type="button"
          onClick={() => navigate('/diagnostics')}
          className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left pressable"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/12 text-accent">
            <Icon name="info" size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink">Diagnostics & Friday report</span>
            <span className="block text-xs text-mut">Private health summary stored on this device</span>
          </span>
          <Icon name="chevronRight" size={18} className="text-mut" />
        </button>
      </Card>

      {/* ---- About ---- */}
      <Section title={`About ${APP_NAME}`} icon="info" />
      <Card>
        <div className="mb-4 flex flex-col items-center gap-2">
          <MihrabLogo size={80} />
          <div className="text-center">
            <div className="text-sm font-semibold text-ink">{APP_NAME}</div>
            <div className="text-[11px] text-mut">الفرقان · {APP_TAGLINE}</div>
          </div>
        </div>
        <div className="text-sm leading-relaxed text-mut">
          <p>
            <b className="text-ink">{APP_NAME}</b> is a Qur’an app for reading, listening and
            learning — read all 114 surahs (Arabic, translation & transliteration), build custom
            multi-surah playlists with repeat counts, listen to multiple reciters, save recitations
            for offline listening, and follow uplifting sayings — all without a connection once
            loaded.
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            <li>· Qur’an text/translation: Tanzil.net via Al Quran Cloud (quran-uthmani, en.sahih, en.transliteration)</li>
            <li>· Recitations: islamic.network audio CDN — downloaded files are stored only on this device</li>
            <li>· Arabic fonts: Amiri Quran, Noto Naskh & Scheherazade New (OFL)</li>
          </ul>
          {installEvt && (
            <button
              type="button"
              onClick={async () => {
                await installEvt.prompt();
              }}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-onaccent pressable"
            >
              <Icon name="download" size={16} />
              Install app
            </button>
          )}
          <p className="mt-3 text-center text-[11px] text-mut">
            {APP_NAME} v1.0.0 · الفرقان · made for reading & reflection
          </p>
          <p className="mt-1 text-center text-[10px] tracking-[0.18em] text-mut/70">{APP_ATTRIBUTION}</p>
        </div>
      </Card>

      {/* confirm clear audio */}
      <Modal open={confirmClearAudio} onClose={() => setConfirmClearAudio(false)} title="Clear downloaded audio?">
        <p className="text-sm text-mut">
          Removes {storage.count} stored audio file{storage.count === 1 ? '' : 's'} ({formatBytes(storage.bytes)}) from
          this device. Re-download anytime.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setConfirmClearAudio(false)}
            className="rounded-full px-4 py-2 text-sm font-medium text-mut hover:bg-surface2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={async () => {
              await db.audio.clear();
              setConfirmClearAudio(false);
              dispatch(push('Downloaded audio cleared.', 'info'));
            }}
            className="rounded-full bg-danger px-5 py-2 text-sm font-semibold text-white"
          >
            Clear
          </button>
        </div>
      </Modal>

      {/* confirm reset progress */}
      <Modal open={confirmResetProgress} onClose={() => setConfirmResetProgress(false)} title="Reset reading progress?">
        <p className="text-sm text-mut">
          Clears saved positions, completed surahs/juz and listening history. Playlists & downloads are kept.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setConfirmResetProgress(false)}
            className="rounded-full px-4 py-2 text-sm font-medium text-mut hover:bg-surface2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              dispatch(clearAllProgress());
              setConfirmResetProgress(false);
              dispatch(push('Progress reset.', 'info'));
            }}
            className="rounded-full bg-danger px-5 py-2 text-sm font-semibold text-white"
          >
            Reset
          </button>
        </div>
      </Modal>

      <Modal open={confirmResetSettings} onClose={() => setConfirmResetSettings(false)} title="Reset all settings?">
        <p className="text-sm text-mut">This restores appearance, reader, audio, voice, and storage preferences to their defaults. Reading progress, favorites, playlists, and downloaded audio will not be changed.</p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setConfirmResetSettings(false)} className="rounded-full px-4 py-2 text-sm font-medium text-mut hover:bg-surface2">Cancel</button>
          <button
            type="button"
            onClick={() => {
              dispatch(resetSettings());
              setConfirmResetSettings(false);
              dispatch(push('Settings restored to defaults.', 'success'));
            }}
            className="rounded-full bg-danger px-5 py-2 text-sm font-semibold text-white"
          >
            Reset settings
          </button>
        </div>
      </Modal>

      <Modal open={pendingBackup !== null} onClose={() => setPendingBackup(null)} title="Replace your data?">
        <p className="text-sm leading-relaxed text-mut">
          This will replace your current progress, settings, theme and playlists with the contents of this backup. Continue?
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setPendingBackup(null)}
            className="rounded-full px-4 py-2 text-sm font-medium text-mut hover:bg-surface2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (!pendingBackup) return;
              restoreBackup(pendingBackup);
              setPendingBackup(null);
              dispatch(push('Your data has been restored.', 'success'));
            }}
            className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-onaccent"
          >
            Restore data
          </button>
        </div>
      </Modal>
    </div>
  );
}

/* ---------- small helpers ---------- */
function Section({ title, icon }: { title: string; icon: IconName }) {
  return (
    <div className="mb-2 mt-5 flex items-center gap-1.5 text-sm font-semibold text-ink first:mt-0">
      <Icon name={icon} size={16} className="text-accent" />
      {title}
    </div>
  );
}

function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-line bg-surface p-3.5">{children}</div>;
}

function Row({
  label,
  hint,
  control,
}: {
  label: string;
  hint?: string;
  control: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-0">
      <div className="min-w-0">
        <div className="text-sm font-medium text-ink">{label}</div>
        {hint && <div className="text-xs text-mut">{hint}</div>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}
