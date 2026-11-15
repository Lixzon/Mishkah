import { configureStore, createSelector } from '@reduxjs/toolkit';
import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux';

import themeReducer from './slices/themeSlice';
import settingsReducer from './slices/settingsSlice';
import playlistReducer from './slices/playlistSlice';
import progressReducer from './slices/progressSlice';
import playerReducer from './slices/playerSlice';
import toastReducer from './slices/toastSlice';
import likesReducer, { totalLikedItems } from './slices/likesSlice';
import bookmarksReducer from './slices/bookmarksSlice';
import memorizedReducer from './slices/memorizedSlice';
import searchSessionReducer from './slices/searchSessionSlice';
import { computeXp, type XpProgress } from '../lib/xp';
import { db } from '../db/database';

import { saveState, KEYS } from './persist';

export const store = configureStore({
  reducer: {
    theme: themeReducer,
    settings: settingsReducer,
    playlists: playlistReducer,
    progress: progressReducer,
    player: playerReducer,
    toast: toastReducer,
    likes: likesReducer,
    bookmarks: bookmarksReducer,
    memorized: memorizedReducer,
    searchSession: searchSessionReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

/**
 * Level, lifetime XP and the activity breakdown behind them. Memoised on the
 * progress slice and the number of liked items, so a reader with the player
 * running (which patches state several times a second) does not recompute it.
 */
export const selectXpProgress = createSelector(
  [(state: RootState) => state.progress, (state: RootState) => totalLikedItems(state.likes)],
  (progress, likedItems): XpProgress => computeXp(progress, likedItems),
);

/* ---------- persist selected slices ---------- */

let lastSaved = new Map<string, string>();
let lastBookmarksJson: string | null = null;
let stateWriteQueue = Promise.resolve();
let bookmarkWriteQueue = Promise.resolve();

function persistSlicesToIndexedDb(rows: [string, unknown][]): void {
  if (rows.length === 0) return;
  const snapshot = rows.map(([key, value]) => ({ key, value: JSON.parse(JSON.stringify(value)) as unknown }));
  stateWriteQueue = stateWriteQueue.then(() => db.kv.bulkPut(snapshot)).then(() => undefined).catch(() => {
    /* localStorage remains the fallback when IndexedDB is unavailable */
  });
}

function persistBookmarksToIndexedDb(): void {
  const items = store.getState().bookmarks.items;
  const serialized = JSON.stringify(items);
  if (serialized === lastBookmarksJson) return;
  lastBookmarksJson = serialized;
  const snapshot = [...items];
  bookmarkWriteQueue = bookmarkWriteQueue.then(async () => {
    await db.transaction('rw', db.bookmarks, async () => {
      await db.bookmarks.clear();
      if (snapshot.length > 0) await db.bookmarks.bulkPut(snapshot);
    });
  }).catch(() => {
    /* localStorage remains the fallback when IndexedDB is unavailable */
  });
}

store.subscribe(() => {
  const s = store.getState();
  const writers: [string, unknown][] = [
    [KEYS.theme, s.theme],
    [KEYS.settings, s.settings],
    [KEYS.playlists, s.playlists],
    [KEYS.progress, s.progress],
    [KEYS.likes, s.likes],
    [KEYS.bookmarks, s.bookmarks],
    [KEYS.memorized, s.memorized],
  ];
  const changed: [string, unknown][] = [];
  for (const [key, value] of writers) {
    let next: string;
    try {
      next = JSON.stringify(value);
    } catch {
      continue;
    }
    if (lastSaved.get(key) === next) continue;
    lastSaved.set(key, next);
    saveState(key, value);
    changed.push([key, value]);
  }
  persistSlicesToIndexedDb(changed);
  persistBookmarksToIndexedDb();
});

const initialState = store.getState();
persistSlicesToIndexedDb([
  [KEYS.theme, initialState.theme],
  [KEYS.settings, initialState.settings],
  [KEYS.playlists, initialState.playlists],
  [KEYS.progress, initialState.progress],
  [KEYS.likes, initialState.likes],
  [KEYS.bookmarks, initialState.bookmarks],
  [KEYS.memorized, initialState.memorized],
]);
persistBookmarksToIndexedDb();
