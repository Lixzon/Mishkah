import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { KEYS, hasState, loadState } from '../persist';

/**
 * Universal likes ("favourites") for every kind of content the app shows.
 *
 * One store holds all four categories so the Favourites hub, the like buttons
 * and the XP read-out can never disagree. It persists through the same path as
 * the other slices (localStorage + IndexedDB `kv`, plus `lib/backup.ts`), which
 * a set of separate IndexedDB tables would have bypassed.
 */

export interface LikedAyah {
  /** `${surah}:${ayah}` */
  id: string;
  surah: number;
  ayah: number;
  surahName: string;
  arabic: string;
  translation: string;
  likedAt: number;
}

export interface LikesState {
  surahs: number[];
  ayahs: LikedAyah[];
  duas: string[];
  quotes: string[];
}

export type LikeKind = 'surah' | 'ayah' | 'dua' | 'quote';

export type LikedAyahInput = Omit<LikedAyah, 'likedAt'>;

const emptyLikes: LikesState = { surahs: [], ayahs: [], duas: [], quotes: [] };

/** Shape of the retired `favorites` slice, kept only for one-time migration. */
interface LegacyFavorites {
  items?: string[];
}

export function ayahLikeId(surah: number, ayah: number): string {
  return `${surah}:${ayah}`;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

/**
 * Maps the retired flat list (`dua:<id>` / `saying:<id>`) onto the two id
 * buckets, so hearts given before the hub existed are not lost.
 */
export function migrateLegacyFavoriteIds(items: string[]): { duas: string[]; quotes: string[] } {
  const duas: string[] = [];
  const quotes: string[] = [];
  for (const key of items) {
    const separator = key.indexOf(':');
    if (separator < 0) continue;
    const kind = key.slice(0, separator);
    const id = key.slice(separator + 1);
    if (!id) continue;
    if (kind === 'dua') duas.push(id);
    else if (kind === 'saying' || kind === 'quote') quotes.push(id);
  }
  return { duas: unique(duas), quotes: unique(quotes) };
}

/**
 * The first time the likes store loads, adopt the hearts a reader already gave
 * duas and sayings in the old `favorites` list. Only on the very first load:
 * re-applying it later would resurrect a heart the reader has since removed.
 */
function withLegacyFavorites(base: LikesState): LikesState {
  if (hasState(KEYS.likes)) return base;
  const legacy = loadState<LegacyFavorites>(KEYS.favorites, { items: [] });
  const migrated = migrateLegacyFavoriteIds(legacy.items ?? []);
  return { ...base, duas: unique([...base.duas, ...migrated.duas]), quotes: unique([...base.quotes, ...migrated.quotes]) };
}

function initialLikes(): LikesState {
  const stored = loadState<LikesState>(KEYS.likes, emptyLikes);
  return withLegacyFavorites({
    surahs: Array.isArray(stored.surahs) ? stored.surahs : [],
    ayahs: Array.isArray(stored.ayahs) ? stored.ayahs : [],
    duas: Array.isArray(stored.duas) ? stored.duas : [],
    quotes: Array.isArray(stored.quotes) ? stored.quotes : [],
  });
}

/** Older payloads (or a hand-edited backup) may omit a category entirely. */
function normalise(state: LikesState): LikesState {
  state.surahs ??= [];
  state.ayahs ??= [];
  state.duas ??= [];
  state.quotes ??= [];
  return state;
}

function toggleIn(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

const likesSlice = createSlice({
  name: 'likes',
  initialState: initialLikes(),
  reducers: {
    toggleLikedSurah(state, action: PayloadAction<number>) {
      const surahs = normalise(state).surahs;
      state.surahs = surahs.includes(action.payload)
        ? surahs.filter((n) => n !== action.payload)
        : [...surahs, action.payload].sort((a, b) => a - b);
    },
    toggleLikedAyah(state, action: PayloadAction<LikedAyahInput>) {
      normalise(state);
      const existing = state.ayahs.findIndex((item) => item.id === action.payload.id);
      if (existing >= 0) state.ayahs.splice(existing, 1);
      else state.ayahs.unshift({ ...action.payload, likedAt: Date.now() });
    },
    toggleLikedDua(state, action: PayloadAction<string>) {
      state.duas = toggleIn(normalise(state).duas, action.payload);
    },
    toggleLikedQuote(state, action: PayloadAction<string>) {
      state.quotes = toggleIn(normalise(state).quotes, action.payload);
    },
    restoreLikes(_state, action: PayloadAction<LikesState>) {
      return {
        surahs: action.payload?.surahs ?? [],
        ayahs: action.payload?.ayahs ?? [],
        duas: action.payload?.duas ?? [],
        quotes: action.payload?.quotes ?? [],
      };
    },
    clearLikes() {
      return { ...emptyLikes };
    },
  },
});

export const {
  toggleLikedSurah,
  toggleLikedAyah,
  toggleLikedDua,
  toggleLikedQuote,
  restoreLikes,
  clearLikes,
} = likesSlice.actions;
export default likesSlice.reducer;

/* ---------- selectors ---------- */

export function isSurahLiked(state: LikesState, surah: number): boolean {
  return state.surahs.includes(surah);
}

export function isAyahLiked(state: LikesState, surah: number, ayah: number): boolean {
  const id = ayahLikeId(surah, ayah);
  return state.ayahs.some((item) => item.id === id);
}

export function isDuaLiked(state: LikesState, id: string): boolean {
  return state.duas.includes(id);
}

export function isQuoteLiked(state: LikesState, id: string): boolean {
  return state.quotes.includes(id);
}

/** Every liked item, across all four categories. */
export function totalLikedItems(state: LikesState): number {
  return state.surahs.length + state.ayahs.length + state.duas.length + state.quotes.length;
}
