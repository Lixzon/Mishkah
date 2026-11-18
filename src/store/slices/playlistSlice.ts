import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Playlist } from '../../types';
import { loadState } from '../persist';
import { KEYS } from '../persist';
import { uid } from '../../lib/utils';
import { DEFAULT_RECITER } from '../../lib/constants';

export interface PlaylistState {
  playlists: Playlist[];
  activeId: string | null;
}

const DEFAULT_ID = 'pl-default';

const seed: Playlist = {
  id: DEFAULT_ID,
  name: 'My Playlist',
  reciter: DEFAULT_RECITER,
  createdAt: 0,
  items: [],
};

const initialState: PlaylistState = loadState<PlaylistState>(KEYS.playlists, {
  playlists: [seed],
  activeId: DEFAULT_ID,
});

function findList(state: PlaylistState, id: string): Playlist | undefined {
  return state.playlists.find((p) => p.id === id);
}

const playlistSlice = createSlice({
  name: 'playlists',
  initialState,
  reducers: {
    restorePlaylists(_state, action: PayloadAction<PlaylistState>) {
      return action.payload;
    },
    createPlaylist: {
      reducer(state, action: PayloadAction<Playlist>) {
        state.playlists.push(action.payload);
        state.activeId = action.payload.id;
      },
      prepare(name: string, reciter: string = DEFAULT_RECITER) {
        return {
          payload: {
            id: uid('pl'),
            name: name.trim() || 'Playlist',
            reciter,
            createdAt: Date.now(),
            items: [],
          } satisfies Playlist,
        };
      },
    },
    importPlaylist: {
      reducer(state, action: PayloadAction<Playlist>) {
        // Imported codes may arrive twice; keep both copies distinct.
        state.playlists.push(action.payload);
        state.activeId = action.payload.id;
      },
      prepare(input: Omit<Playlist, 'id' | 'createdAt'>) {
        return {
          payload: {
            ...input,
            id: uid('pl'),
            createdAt: Date.now(),
          } satisfies Playlist,
        };
      },
    },
    renamePlaylist(state, action: PayloadAction<{ id: string; name: string }>) {
      const p = findList(state, action.payload.id);
      if (p) p.name = action.payload.name.trim() || p.name;
    },
    deletePlaylist(state, action: PayloadAction<string>) {
      state.playlists = state.playlists.filter((p) => p.id !== action.payload);
      if (state.activeId === action.payload) {
        state.activeId = state.playlists[0]?.id ?? null;
      }
    },
    setActive(state, action: PayloadAction<string | null>) {
      state.activeId = action.payload;
    },
    setPlaylistReciter(state, action: PayloadAction<{ id: string; reciter: string }>) {
      const p = findList(state, action.payload.id);
      if (p) p.reciter = action.payload.reciter;
    },
    addItem(state, action: PayloadAction<{ playlistId: string; surah: number }>) {
      const p = findList(state, action.payload.playlistId);
      if (!p) return;
      if (p.items.length >= 10) return; // hard cap: 10 surahs per playlist
      // avoid duplicate same surah slots? allow but warn in UI; skip duplicates
      if (p.items.some((it) => it.surah === action.payload.surah)) return;
      p.items.push({ id: uid('it'), surah: action.payload.surah, repeat: 1 });
    },
    removeItem(state, action: PayloadAction<{ playlistId: string; itemId: string }>) {
      const p = findList(state, action.payload.playlistId);
      if (!p) return;
      p.items = p.items.filter((it) => it.id !== action.payload.itemId);
    },
    setItemRepeat(state, action: PayloadAction<{ playlistId: string; itemId: string; repeat: number }>) {
      const p = findList(state, action.payload.playlistId);
      const it = p?.items.find((x) => x.id === action.payload.itemId);
      if (it) it.repeat = Math.min(99, Math.max(1, Math.round(action.payload.repeat)));
    },
    setItemSurah(state, action: PayloadAction<{ playlistId: string; itemId: string; surah: number }>) {
      const p = findList(state, action.payload.playlistId);
      const it = p?.items.find((x) => x.id === action.payload.itemId);
      if (it) it.surah = action.payload.surah;
    },
    setItemLoop(
      state,
      action: PayloadAction<{
        playlistId: string;
        itemId: string;
        loop: { start: number; end: number } | null;
      }>,
    ) {
      const p = findList(state, action.payload.playlistId);
      const it = p?.items.find((x) => x.id === action.payload.itemId);
      if (!it) return;
      if (!action.payload.loop) {
        delete it.loop;
        return;
      }
      const { start, end } = action.payload.loop;
      it.loop = { start: Math.min(start, end), end: Math.max(start, end) };
    },
    moveItem(state, action: PayloadAction<{ playlistId: string; from: number; to: number }>) {
      const p = findList(state, action.payload.playlistId);
      if (!p) return;
      const { from, to } = action.payload;
      if (from < 0 || from >= p.items.length || to < 0 || to >= p.items.length || from === to) return;
      const [moved] = p.items.splice(from, 1);
      p.items.splice(to, 0, moved);
    },
    clearItems(state, action: PayloadAction<string>) {
      const p = findList(state, action.payload);
      if (p) p.items = [];
    },
  },
});

export const {
  restorePlaylists,
  createPlaylist,
  importPlaylist,
  renamePlaylist,
  deletePlaylist,
  setActive,
  setPlaylistReciter,
  addItem,
  removeItem,
  setItemRepeat,
  setItemSurah,
  setItemLoop,
  moveItem,
  clearItems,
} = playlistSlice.actions;
export default playlistSlice.reducer;
