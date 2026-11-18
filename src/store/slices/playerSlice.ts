import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { PlayerRepeatMode } from '../../types';
import { DEFAULT_RECITER } from '../../lib/constants';

export interface SleepTimerState {
  minutes: number;
  endsAt: number; // epoch ms
}

/** An inclusive, 0-based ayah window that the player loops for memorisation. */
export interface VerseRange {
  start: number;
  end: number;
}

export interface PlayerState {
  isPlaying: boolean;
  /** currently loaded surah number */
  surah: number | null;
  /** 0-based ayah index into the surah that is currently sounding (for highlighting) */
  ayah: number | null;
  /** number of ayahs in the loaded surah */
  ayahCount: number;
  /** the playlist this session belongs to (null when playing a single surah) */
  playlistId: string | null;
  /** display name of the active queue (playlist name or surah name) */
  queueName: string | null;
  reciter: string;
  /** expanded queue: surah numbers (per-item repeat counts folded in) */
  queue: number[];
  /** play order: indices into `queue` (identity, or shuffled) */
  order: number[];
  /** current position: index into `order` */
  pos: number;
  mode: 'order' | 'shuffle';
  repeat: PlayerRepeatMode; // 'off' = play once then stop, 'all' = loop whole queue
  loopSurah: boolean; // repeat current surah until user taps next
  /** Active Hifz range; when set the playhead never leaves it. */
  range: VerseRange | null;
  currentTime: number;
  duration: number;
  volume: number; // 0..1
  muted: boolean;
  playbackRate: number;
  /** Pause for a few seconds after each verse, for memorisation. */
  hifzPause: boolean;
  usingDownload: boolean; // audio currently served from a downloaded blob
  buffering: boolean;
  error: string | null;
  sleepTimer: SleepTimerState | null;
  stopAfterSurah: boolean;
}

const initialState: PlayerState = {
  isPlaying: false,
  surah: null,
  ayah: null,
  ayahCount: 0,
  playlistId: null,
  queueName: null,
  reciter: DEFAULT_RECITER,
  queue: [],
  order: [],
  pos: 0,
  mode: 'order',
  repeat: 'all',
  loopSurah: false,
  range: null,
  currentTime: 0,
  duration: 0,
  volume: 1,
  muted: false,
  playbackRate: 1,
  hifzPause: false,
  usingDownload: false,
  buffering: false,
  error: null,
  sleepTimer: null,
  stopAfterSurah: false,
};

const playerSlice = createSlice({
  name: 'player',
  initialState,
  reducers: {
    patch(state, action: PayloadAction<Partial<PlayerState>>) {
      Object.assign(state, action.payload);
    },
    reset(state) {
      Object.assign(state, initialState);
    },
  },
});

export const { patch, reset } = playerSlice.actions;
export default playerSlice.reducer;

/** a mini-selector used throughout components */
export function selectCurrentSurahNumber(s: { player: PlayerState }): number | null {
  const p = s.player;
  if (p.pos >= p.order.length) return null;
  return p.queue[p.order[p.pos]] ?? null;
}
