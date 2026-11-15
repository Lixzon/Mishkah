import type { PlaylistState } from '../store/slices/playlistSlice';
import { restorePlaylists } from '../store/slices/playlistSlice';
import type { LikesState } from '../store/slices/likesSlice';
import { migrateLegacyFavoriteIds, restoreLikes } from '../store/slices/likesSlice';
import type { BookmarksState } from '../store/slices/bookmarksSlice';
import { restoreBookmarks } from '../store/slices/bookmarksSlice';
import type { MemorizedState } from '../store/slices/memorizedSlice';
import { restoreMemorized } from '../store/slices/memorizedSlice';
import { restoreProgress } from '../store/slices/progressSlice';
import { restoreSettings } from '../store/slices/settingsSlice';
import { restoreTheme } from '../store/slices/themeSlice';
import { store } from '../store';
import { KEYS, saveState } from '../store/persist';
import type { ProgressState, SettingsState, ThemeState } from '../types';

/** Retired likes list (`dua:<id>` / `saying:<id>`) still found in older exports. */
interface LegacyFavorites {
  items: string[];
}

export interface FurqanBackup {
  version: 1;
  exportedAt: string;
  data: {
    theme: ThemeState;
    settings: SettingsState;
    progress: ProgressState;
    playlists: PlaylistState;
    likes: LikesState;
    bookmarks: BookmarksState;
    memorized: MemorizedState;
  };
}

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isActivityEntry(value: unknown): boolean {
  return isRecord(value) && Number.isInteger(value.surah) && Number.isInteger(value.ayah) &&
    typeof value.name === 'string' && isFiniteNumber(value.at) &&
    (value.kind === 'read' || value.kind === 'listen');
}

function isTheme(value: unknown): value is ThemeState {
  return isRecord(value) &&
    ['light', 'dark', 'system', 'sepia', 'midnight', 'emerald', 'velvet', 'golden'].includes(String(value.mode)) &&
    ['teal', 'emerald', 'green', 'gold', 'blue', 'rose', 'purple', 'sapphire'].includes(String(value.accent)) &&
    // Older backups predate the custom accent; null means "stock palette".
    (value.customAccent === undefined || value.customAccent === null ||
      (typeof value.customAccent === 'string' && /^#[0-9a-f]{6}$/i.test(value.customAccent)));
}

function isSettings(value: unknown): value is SettingsState {
  if (!isRecord(value) || !isRecord(value.notifications)) return false;
  return typeof value.showArabic === 'boolean' &&
    typeof value.showTransliteration === 'boolean' &&
    typeof value.showTranslation === 'boolean' &&
    isFiniteNumber(value.arabicFontScale) && value.arabicFontScale >= 1 && value.arabicFontScale <= 3 &&
    ['uthmani', 'naskh', 'clear'].includes(String(value.script)) &&
    typeof value.readingMode === 'boolean' && typeof value.defaultReciter === 'string' &&
    typeof value.followAudio === 'boolean' &&
    typeof value.hasOfferedDefaultReciterDownload === 'boolean' &&
    typeof value.wifiDownloadPending === 'boolean' &&
    // Optional so backups exported before the assistant layouts still load.
    (value.assistantLayout === undefined ||
      ['classic', 'guided', 'immersive'].includes(String(value.assistantLayout))) &&
    typeof value.notifications.daily === 'boolean' &&
    typeof value.notifications.fridayKahf === 'boolean' &&
    typeof value.notifications.nightlyMulk === 'boolean' &&
    typeof value.notifications.reminderTime === 'string';
}

function isProgress(value: unknown): value is ProgressState {
  if (!isRecord(value) || !isRecord(value.lastRead) || !isRecord(value.lastListened) ||
      !isRecord(value.surahCompleted) || !isRecord(value.juzCompleted) ||
      !isRecord(value.dailyActivity) || !isRecord(value.ayahsReached) ||
      !isRecord(value.milestones) || !Array.isArray(value.activity) ||
      !Array.isArray(value.quoteHistory)) return false;

  return Object.values(value.lastRead).every((entry) => isRecord(entry) &&
      Number.isInteger(entry.ayah) && isFiniteNumber(entry.at)) &&
    Object.values(value.lastListened).every(isFiniteNumber) &&
    Object.values(value.surahCompleted).every((entry) => typeof entry === 'boolean') &&
    Object.values(value.juzCompleted).every((entry) => typeof entry === 'boolean') &&
    Object.values(value.dailyActivity).every((entry) => typeof entry === 'boolean') &&
    Object.values(value.ayahsReached).every(isFiniteNumber) &&
    Object.values(value.milestones).every(isFiniteNumber) &&
    (value.lastPosition === null || isActivityEntry(value.lastPosition)) &&
    value.activity.every(isActivityEntry) &&
    value.quoteHistory.every((entry) => isRecord(entry) && typeof entry.id === 'string' && isFiniteNumber(entry.at));
}

function isPlaylists(value: unknown): value is PlaylistState {
  return isRecord(value) && Array.isArray(value.playlists) &&
    (value.activeId === null || typeof value.activeId === 'string') &&
    value.playlists.every((playlist) => isRecord(playlist) &&
      typeof playlist.id === 'string' && typeof playlist.name === 'string' &&
      typeof playlist.reciter === 'string' && isFiniteNumber(playlist.createdAt) &&
      Array.isArray(playlist.items) && playlist.items.every((item) => isRecord(item) &&
        typeof item.id === 'string' && Number.isInteger(item.surah) &&
        Number(item.surah) >= 1 && Number(item.surah) <= 114 &&
        Number.isInteger(item.repeat) && Number(item.repeat) >= 1));
}

function isLikes(value: unknown): value is LikesState {
  return isRecord(value) &&
    Array.isArray(value.surahs) && value.surahs.every((surah) => Number.isInteger(surah)) &&
    Array.isArray(value.ayahs) && value.ayahs.every((item) =>
      isRecord(item) && typeof item.id === 'string' && Number.isInteger(item.surah) &&
      Number(item.surah) >= 1 && Number(item.surah) <= 114 && Number.isInteger(item.ayah) &&
      typeof item.surahName === 'string' && typeof item.arabic === 'string' &&
      typeof item.translation === 'string' && isFiniteNumber(item.likedAt)) &&
    Array.isArray(value.duas) && value.duas.every((id) => typeof id === 'string') &&
    Array.isArray(value.quotes) && value.quotes.every((id) => typeof id === 'string');
}

/** Validator for the retired `favorites` list, migrated into likes on restore. */
function isLegacyFavorites(value: unknown): value is LegacyFavorites {
  return isRecord(value) && Array.isArray(value.items) && value.items.every((item) => typeof item === 'string');
}

function isBookmarks(value: unknown): value is BookmarksState {
  return isRecord(value) && Array.isArray(value.items) && value.items.every((item) =>
    isRecord(item) && typeof item.id === 'string' && Number.isInteger(item.surah) &&
    Number(item.surah) >= 1 && Number(item.surah) <= 114 && Number.isInteger(item.ayah) &&
    Number(item.ayah) >= 1 && typeof item.surahName === 'string' &&
    typeof item.arabic === 'string' && typeof item.translation === 'string' &&
    typeof item.note === 'string' && isFiniteNumber(item.createdAt));
}

function isMemorized(value: unknown): value is MemorizedState {
  return isRecord(value) && Array.isArray(value.items) && value.items.every((item) =>
    isRecord(item) && typeof item.id === 'string' && Number.isInteger(item.surah) &&
    Number(item.surah) >= 1 && Number(item.surah) <= 114 && Number.isInteger(item.ayah) &&
    Number(item.ayah) >= 1 && typeof item.surahName === 'string' &&
    typeof item.arabic === 'string' && typeof item.translation === 'string' &&
    Number.isInteger(item.repetitions) && Number(item.repetitions) >= 0 &&
    typeof item.memorized === 'boolean' && isFiniteNumber(item.updatedAt));
}

export function createBackupJson(): string {
  const { theme, settings, progress, playlists, likes, bookmarks, memorized } = store.getState();
  const backup: FurqanBackup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: { theme, settings, progress, playlists, likes, bookmarks, memorized },
  };
  return JSON.stringify(backup, null, 2);
}

export function parseBackupJson(text: string): FurqanBackup {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  if (!isRecord(value) || value.version !== 1 || typeof value.exportedAt !== 'string' ||
      !Number.isFinite(Date.parse(value.exportedAt)) || !isRecord(value.data) ||
      !isTheme(value.data.theme) || !isSettings(value.data.settings) ||
      !isProgress(value.data.progress) || !isPlaylists(value.data.playlists) ||
      !isBookmarks(value.data.bookmarks) ||
      (value.data.memorized !== undefined && !isMemorized(value.data.memorized))) {
    throw new Error('This file is not a valid Furqan backup.');
  }

  const legacy = isLegacyFavorites(value.data.favorites) ? value.data.favorites : null;
  if (!isLikes(value.data.likes) && !legacy) {
    throw new Error('This file is not a valid Furqan backup.');
  }

  const backup = value as unknown as FurqanBackup;
  const normalizedBackup: FurqanBackup = {
    ...backup,
    data: { ...backup.data, memorized: isMemorized(value.data.memorized) ? value.data.memorized : { items: [] } },
  };
  if (isLikes(value.data.likes)) return normalizedBackup;

  // An export from before the Favourites hub: carry its hearts over.
  const migrated = migrateLegacyFavoriteIds(legacy?.items ?? []);
  return {
    ...normalizedBackup,
    data: { ...normalizedBackup.data, likes: { surahs: [], ayahs: [], duas: migrated.duas, quotes: migrated.quotes } },
  };
}

export function restoreBackup(backup: FurqanBackup): void {
  const { theme, settings, progress, playlists, likes, bookmarks, memorized } = backup.data;
  store.dispatch(restoreTheme(theme));
  store.dispatch(restoreSettings(settings));
  store.dispatch(restoreProgress(progress));
  store.dispatch(restorePlaylists(playlists));
  store.dispatch(restoreLikes(likes));
  store.dispatch(restoreBookmarks(bookmarks));
  store.dispatch(restoreMemorized(memorized));

  saveState(KEYS.theme, theme);
  saveState(KEYS.settings, settings);
  saveState(KEYS.progress, progress);
  saveState(KEYS.playlists, playlists);
  saveState(KEYS.likes, likes);
  saveState(KEYS.bookmarks, bookmarks);
  saveState(KEYS.memorized, memorized);
}