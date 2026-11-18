import { store } from '../store';
import { patch, type PlayerState, type VerseRange } from '../store/slices/playerSlice';
import { push } from '../store/slices/toastSlice';
import { markListened, rememberListened } from '../store/slices/progressSlice';
import { recordAyahPlay } from '../store/slices/memorizedSlice';
import { reciterById } from '../lib/constants';
import { getSurahTimingData, resolveAudioSourceUrl, type TimingSegment } from '../lib/audioTiming';
import { isAudioDownloaded, getDownloadedAudioUrl, getRangedAudioUrl } from '../services/audioStore';
import { getSurah, getSurahMetaList } from '../lib/dataClient';
import { buildAyahFractions, buildExpandedQueue, clampIndex, shuffleIndices } from '../lib/queue';
import type { Playlist, SurahMeta } from '../types';
import { recordDiagnostic } from '../services/diagnostics';

const PLAYER_PREFS = 'furqan:player';

/** How often the highlight is re-resolved while playing.
 *  50ms ensures precise verse alignment even when timeupdate throttles to 1Hz
 *  on mobile builds. */
const TIMELINE_SAMPLE_MS = 50;

/** A timing table describes one exact rendition. If the loaded file differs in
 *  length by more than this, the table belongs to another edit and is dropped. */
const MAX_TIMING_DRIFT = 0.02;

/** Bounds for the user-adjustable highlight offset. */
const MAX_SYNC_OFFSET_MS = 5000;

interface PlayerPrefs {
  volume: number;
  muted: boolean;
  playbackRate: number;
  hifzPause?: boolean;
}

class PlayerController {
  private el: HTMLAudioElement | null = null;
  private objectUrl: string | null = null;
  private cumulative: number[] | null = null;
  private metaCache = new Map<number, SurahMeta>();
  private pendingStartAyah: number | null = null;
  private sleepTimerId: number | null = null;
  private loadToken = 0;
  private playbackIntentToken = 0;
  private fallbackToken = 0;
  private audioErrorToken = -1;
  private realTiming: Array<{ start: number; end: number }> | null = null;
  private timelineTimer: number | null = null;
  /** Milliseconds added to the audio clock before resolving the ayah index.
   *  Negative values delay the highlight, positive values advance it. */
  private syncOffsetMs = 0;
  /** Character-length timelines per surah, so playback outside the reader
   *  (mini player, Now Playing, playlists) is not stuck on uniform division. */
  private weightsBySurah = new Map<number, number[]>();
  /** Lowest ayah index the highlight may show until the offset catches up.
   *  Set when the reader deliberately seeks, so the highlight cannot jump
   *  backwards to the previous ayah right after the jump. */
  private indexFloor: number | null = null;
  private stopAfterAyahIndex: number | null = null;
  private singleAyahEnded: (() => void) | null = null;
  private rangeAyahRepeated: (() => void) | null = null;
  /** Verse to land on once the next chapter's metadata is known. */
  private pendingEdgeSeek: 'first' | 'last' | null = null;
  private hifzPauseTimer: number | null = null;
  private fadeTimer: number | null = null;
  /** Timestamp of the last "restart chapter" tap (double-tap = previous). */
  private lastChapterRestartAt = 0;

  /* ------------------------------------------------ element --------- */
  private ensureEl(): HTMLAudioElement {
    if (!this.el) {
      const el = new Audio();
      el.preload = 'auto';
      this.wire(el);
      this.el = el;
    }
    return this.el;
  }

  private wire(el: HTMLAudioElement): void {
    el.addEventListener('timeupdate', () => this.onTime());
    el.addEventListener('loadedmetadata', () => this.onLoadedMetadata());
    el.addEventListener('durationchange', () => {
      if (Number.isFinite(el.duration)) {
        store.dispatch(patch({ duration: el.duration }));
      }
    });
    el.addEventListener('play', () => {
      store.dispatch(patch({ isPlaying: true, buffering: false }));
      this.syncPlaybackState('playing');
      this.startTimelineSampler();
    });
    el.addEventListener('playing', () => {
      store.dispatch(patch({ isPlaying: true, buffering: false }));
      this.syncPlaybackState('playing');
      this.startTimelineSampler();
    });
    el.addEventListener('pause', () => {
      store.dispatch(patch({ isPlaying: false, buffering: false }));
      this.syncPlaybackState('paused');
      this.stopTimelineSampler();
    });
    el.addEventListener('waiting', () => store.dispatch(patch({ buffering: true })));
    el.addEventListener('canplay', () => store.dispatch(patch({ buffering: false })));
    el.addEventListener('ended', () => {
      this.stopTimelineSampler();
      this.onEnded();
    });
    el.addEventListener('error', () => this.onError());
  }

  /* ------------------------------------------- meta / data ---------- */
  private async surahMeta(n: number): Promise<SurahMeta> {
    const cached = this.metaCache.get(n);
    if (cached) return cached;
    const all = await getSurahMetaList();
    const meta = all.find((m) => m.number === n);
    if (meta) this.metaCache.set(n, meta);
    return meta ?? { number: n, name: '', englishName: `Surah ${n}`, englishNameTranslation: '', revelationType: 'Meccan', numberOfAyahs: 0 };
  }

  private async resolveAyahCount(surah: number, provided?: number): Promise<number> {
    if (provided && provided > 0) return provided;
    const meta = await this.surahMeta(surah);
    return meta.numberOfAyahs || 0;
  }

  /* ------------------------------------------- helpers --------------- */
  private patch(p: Partial<PlayerState>): void {
    store.dispatch(patch(p));
  }

  private recordCompletedAyah(surah: number, ayahIndex: number): void {
    void getSurah(surah)
      .then((data) => {
        const verse = data.ayahs[ayahIndex];
        if (!verse) return;
        store.dispatch(recordAyahPlay({
          id: `${surah}:${verse.i}`,
          surah,
          ayah: verse.i,
          surahName: data.englishName,
          arabic: verse.ar,
          translation: verse.tr,
        }));
      })
      .catch((error: unknown) => {
        const details = error instanceof Error ? error : new Error('Verse text could not be loaded.');
        recordDiagnostic(
          'memorization-tracking',
          `Could not record completed audio for ${surah}:${ayahIndex + 1}`,
          details.stack ?? '',
        );
      });
  }

  private getState() {
    return store.getState().player;
  }

  private revokeUrl(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  private async loadSurah(surah: number, reciter: string, ayahCount: number, startAyahIndex: number | null): Promise<void> {
    const loadToken = ++this.loadToken;
    const el = this.ensureEl();
    el.pause();
    this.revokeUrl();
    this.realTiming = null;

    const timing = await getSurahTimingData(reciter, surah);
    if (loadToken !== this.loadToken) return;
    this.realTiming = timing?.timestamps.length === ayahCount ? timing.timestamps : null;
    if (timing && !this.realTiming) {
      console.warn(
        `[player] ignoring incomplete ayah timings for surah ${surah}: ` +
          `expected ${ayahCount}, received ${timing.timestamps.length}`,
      );
    }

    const downloaded = await isAudioDownloaded(reciter, surah);
    if (loadToken !== this.loadToken) return;
    let src: string;
    if (downloaded) {
      const url = await getDownloadedAudioUrl(reciter, surah);
      if (url) {
        src = url;
        this.objectUrl = url;
      } else {
        src = await resolveAudioSourceUrl(reciter, surah);
      }
    } else {
      src = await resolveAudioSourceUrl(reciter, surah);
    }
    if (loadToken !== this.loadToken) {
      if (this.objectUrl && downloaded) this.revokeUrl();
      return;
    }

    this.cumulative = null;
    this.indexFloor = null;
    const knownLengths = this.weightsBySurah.get(surah);
    if (knownLengths) this.applyWeights(knownLengths);
    else void this.hydrateWeights(surah);
    this.pendingStartAyah = startAyahIndex;
    if (startAyahIndex !== null) this.pendingEdgeSeek = null;
    this.patch({
      surah,
      ayahCount,
      ayah: startAyahIndex ?? 0,
      currentTime: 0,
      duration: 0,
      usingDownload: downloaded,
      buffering: true,
      error: null,
      isPlaying: false,
    });
    el.playbackRate = this.getState().playbackRate;
    this.fallbackToken = 0;

    try {
      el.src = src;
      el.load();
    } catch {
      this.onError();
    }
  }

  private async playElement(intentToken = this.playbackIntentToken): Promise<void> {
    const el = this.ensureEl();
    try {
      await el.play();
      if (intentToken !== this.playbackIntentToken) {
        el.pause();
        this.patch({ isPlaying: false, buffering: false });
        return;
      }
      this.patch({ isPlaying: true });
    } catch {
      // Autoplay may be blocked (e.g. no user gesture yet). Surface once.
      if (intentToken === this.playbackIntentToken) this.patch({ isPlaying: false, buffering: false });
    }
  }

  /** The Hifz loop saved on the playlist slot that the queue is pointing at. */
  private queueLoopRange(s: PlayerState): VerseRange | null {
    if (!s.playlistId || s.order.length === 0) return null;
    const playlist = store.getState().playlists.playlists.find((p) => p.id === s.playlistId);
    const queueIndex = s.order[s.pos];
    if (!playlist || queueIndex === undefined) return null;
    let acc = 0;
    for (const item of playlist.items) {
      const repeat = Math.min(99, Math.max(1, Math.round(item.repeat) || 1));
      if (queueIndex < acc + repeat) {
        return item.loop ? { start: item.loop.start, end: item.loop.end } : null;
      }
      acc += repeat;
    }
    return null;
  }

  /** Loads whatever the queue currently points at and (optionally) plays. */
  private async loadCurrent(autoplay: boolean, startAyahIndex: number | null = null): Promise<void> {
    const intentToken = ++this.playbackIntentToken;
    const s = this.getState();
    if (s.queue.length === 0 || s.order.length === 0) return;
    const surah = s.queue[s.order[s.pos]];
    if (surah === undefined) return;
    const loop = this.queueLoopRange(s);
    const from = loop ? loop.start : startAyahIndex;
    const count = await this.resolveAyahCount(surah, s.ayahCount);
    if (intentToken !== this.playbackIntentToken) return;
    this.patch({ ayahCount: count, range: loop });
    await this.loadSurah(surah, s.reciter, count, from);
    if (intentToken !== this.playbackIntentToken) return;
    if (autoplay) await this.playElement(intentToken);
  }

  private updateMediaSession(surahName: string, reciterLabel: string): void {
    const ms = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined;
    if (!ms) return;
    ms.metadata = new MediaMetadata({
      title: surahName,
      artist: reciterLabel,
      album: 'Furqan · Qur’an',
      artwork: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    });
  }

  private setupMediaSession(): void {
    const ms = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined;
    if (!ms || !('setActionHandler' in ms)) return;
    ms.setActionHandler('play', () => {
      void this.play();
    });
    ms.setActionHandler('pause', () => this.pause());
    ms.setActionHandler('previoustrack', () => this.previous());
    ms.setActionHandler('nexttrack', () => this.next());
    ms.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined) this.seek(details.seekTime);
    });
    ms.setActionHandler('seekbackward', (details) => {
      this.seek(this.getState().currentTime - (details.seekOffset ?? 10));
    });
    ms.setActionHandler('seekforward', (details) => {
      this.seek(this.getState().currentTime + (details.seekOffset ?? 10));
    });
    ms.setActionHandler('stop', () => this.stop());
  }

  /** Reflect transport state to the OS (lock screen, notification shade, Bluetooth). */
  private syncPlaybackState(state: 'none' | 'paused' | 'playing'): void {
    const ms = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined;
    if (!ms) return;
    try {
      ms.playbackState = state;
    } catch {
      /* not supported on this platform */
    }
  }

  /* ------------------------------------------- timing / highlight ---- */
  private onLoadedMetadata(): void {
    const el = this.ensureEl();
    const s = this.getState();
    const count = s.ayahCount || 0;
    const duration = Number.isFinite(el.duration) ? el.duration : 0;

    // Drop timings that describe a different rendition (another edit, or a
    // downloaded copy) before they can skew the highlight.
    if (this.realTiming && !this.timingMatchesAudio(this.realTiming, duration)) {
      console.warn(
        `[player] ignoring ayah timings for surah ${s.surah}: they span ` +
          `${this.realTiming[this.realTiming.length - 1]?.end ?? 0}s but the audio is ${duration}s`,
      );
      this.realTiming = null;
    }

    if (this.pendingEdgeSeek !== null) {
      this.pendingStartAyah = this.pendingEdgeSeek === 'last' ? Math.max(0, count - 1) : 0;
      this.pendingEdgeSeek = null;
    }

    if (this.pendingStartAyah !== null && duration > 0) {
      const target = this.ayahStartTime(this.pendingStartAyah, count, duration);
      try {
        el.currentTime = Math.max(0, Math.min(target, duration - 0.05));
      } catch {
        /* ignore seek errors */
      }
      this.pendingStartAyah = null;
    }
    this.indexFloor = null;
    this.patch({ duration: el.duration || 0 });
  }

  private timingMatchesAudio(timing: TimingSegment[], duration: number): boolean {
    if (timing.length === 0 || !(duration > 0)) return false;
    const span = timing[timing.length - 1]?.end ?? 0;
    if (!(span > 0)) return false;
    return Math.abs(span - duration) / duration <= MAX_TIMING_DRIFT;
  }

  private ayahStartTime(ayahIndex: number, count: number, duration: number): number {
    if (this.realTiming && this.realTiming.length >= count) {
      const segment = this.realTiming[ayahIndex];
      return segment ? segment.start : (ayahIndex / Math.max(1, count)) * duration;
    }
    if (this.cumulative && this.cumulative.length === count) {
      const frac = ayahIndex === 0 ? 0 : this.cumulative[ayahIndex - 1];
      return frac * duration;
    }
    return (ayahIndex / Math.max(1, count)) * duration;
  }

  private ayahEndTime(ayahIndex: number, count: number, duration: number): number {
    if (this.realTiming && this.realTiming.length >= count) {
      return this.realTiming[ayahIndex]?.end ?? duration;
    }
    return ayahIndex + 1 < count ? this.ayahStartTime(ayahIndex + 1, count, duration) : duration;
  }

  private computeAyahIndex(time: number, duration: number, count: number): number {
    if (count <= 0 || duration <= 0) return 0;
    if (this.realTiming && this.realTiming.length >= count) {
      for (let i = 0; i < count; i++) {
        const segment = this.realTiming[i];
        if (!segment) continue;
        if (time < segment.end) return i;
      }
      return Math.max(0, count - 1);
    }
    const p = Math.min(1, Math.max(0, time / duration));
    if (this.cumulative && this.cumulative.length === count) {
      let lo = 0;
      let hi = count - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (this.cumulative[mid] < p) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    }
    return Math.min(count - 1, Math.floor(p * count));
  }

  /**
   * Audio-clock position used to resolve the highlighted ayah, after the
   * reader's sync offset (negative = highlight follows later). Clamped so the
   * first ayah still matches while the offset plays out at the start.
   */
  private timelineTime(raw: number): number {
    if (this.syncOffsetMs === 0) return raw;
    return Math.max(0, raw + this.syncOffsetMs / 1000);
  }

  /**
   * Keeps the playhead inside the active Hifz range. Time-based (rather than
   * index-based) so the loop restarts on the boundary instead of up to one
   * sampler tick into the following ayah. Returns true when it moved the
   * playhead, so the caller can skip its normal position patch.
   */
  private applyRangeLoop(t: number, duration: number, s: PlayerState): boolean {
    const range = s.range;
    if (!range || s.ayahCount <= 0 || duration <= 0) return false;
    const end = this.ayahEndTime(range.end, s.ayahCount, duration);
    if (t < end - 0.05) return false;
    if (s.surah !== null && s.ayah === range.end) {
      this.recordCompletedAyah(s.surah, range.end);
    }
    const start = this.ayahStartTime(range.start, s.ayahCount, duration);
    const el = this.ensureEl();
    try {
      el.currentTime = start;
    } catch {
      /* ignore seek errors */
    }
    this.indexFloor = range.start;
    this.patch({ ayah: range.start, currentTime: start });
    if (s.isPlaying && s.hifzPause) this.pauseForHifz();
    return true;
  }

  private startTimelineSampler(): void {
    if (this.timelineTimer !== null) return;
    this.timelineTimer = window.setInterval(() => this.onTime(), TIMELINE_SAMPLE_MS);
  }

  private stopTimelineSampler(): void {
    if (this.timelineTimer === null) return;
    window.clearInterval(this.timelineTimer);
    this.timelineTimer = null;
  }

  private onTime(): void {
    const el = this.ensureEl();
    const s = this.getState();
    if (s.surah === null) return;
    const t = Number.isFinite(el.currentTime) ? el.currentTime : 0;
    const d = Number.isFinite(el.duration) ? el.duration : 0;
    if (this.applyRangeLoop(t, d, s)) return;
    const wasSeeking = this.indexFloor !== null;
    let idx = this.computeAyahIndex(this.timelineTime(t), d, s.ayahCount);

    // After a deliberate seek the offset would briefly name the previous ayah;
    // hold the floor instead so the highlight never steps backwards.
    if (this.indexFloor !== null) {
      if (idx >= this.indexFloor) this.indexFloor = null;
      else idx = this.indexFloor;
    }

    if (this.stopAfterAyahIndex !== null && idx > this.stopAfterAyahIndex) {
      const target = this.stopAfterAyahIndex;
      const stopAt = this.ayahEndTime(target, s.ayahCount, d);
      const onEnded = this.singleAyahEnded;
      this.stopAfterAyahIndex = null;
      this.singleAyahEnded = null;
      this.indexFloor = null;
      el.pause();
      try {
        el.currentTime = stopAt;
      } catch {
        /* ignore */
      }
      this.patch({ ayah: target, currentTime: stopAt, isPlaying: false, buffering: false });
      this.stopTimelineSampler();
      this.recordCompletedAyah(s.surah, target);
      onEnded?.();
      return;
    }

    const toPatch: Partial<PlayerState> = { currentTime: t };
    if (Math.abs(d - s.duration) > 0.05) toPatch.duration = d;
    if (idx !== s.ayah) toPatch.ayah = idx;
    if (s.isPlaying !== !el.paused) toPatch.isPlaying = !el.paused;
    if (Object.keys(toPatch).length > 0) this.patch(toPatch);
    if (idx !== s.ayah) {
      if (!wasSeeking && s.isPlaying && s.ayah !== null && idx === s.ayah + 1) {
        this.recordCompletedAyah(s.surah, s.ayah);
      }
      const surahName = this.metaCache.get(s.surah)?.englishName ?? `Surah ${s.surah}`;
      this.updateMediaSession(`${surahName} ${s.surah}:${idx + 1}`, reciterLabel(s.reciter));
      store.dispatch(
        rememberListened({
          surah: s.surah,
          ayah: idx + 1,
          name: this.metaCache.get(s.surah)?.englishName ?? `Surah ${s.surah}`,
        }),
      );
      if (s.isPlaying && s.hifzPause && !wasSeeking && this.stopAfterAyahIndex === null) {
        this.pauseForHifz();
      }
    }

    // position state for lock-screen seek scrubbing
    const ms = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined;
    if (ms && 'setPositionState' in ms && Number.isFinite(d) && d > 0) {
      try {
        ms.setPositionState({ duration: d, playbackRate: el.playbackRate, position: t });
      } catch {
        /* not supported */
      }
    }
  }

  /* ------------------------------------------- queue advancement ----- */
  private onError(): void {
    const s = this.getState();
    if (s.surah === null) {
      this.patch({ buffering: false });
      return;
    }
    if (this.audioErrorToken !== this.loadToken) {
      this.audioErrorToken = this.loadToken;
      const code = this.el?.error?.code ?? 0;
      recordDiagnostic(
        'audio-stream',
        `Audio playback failed (media error ${code}; downloaded ${s.usingDownload})`,
        new Error('Audio playback failed').stack ?? '',
      );
    }
    if (!s.usingDownload && this.fallbackToken !== this.loadToken) {
      const token = this.loadToken;
      this.fallbackToken = token;
      this.patch({ buffering: true, error: null });
      void getRangedAudioUrl(s.reciter, s.surah)
        .then((url) => {
          if (token !== this.loadToken) {
            URL.revokeObjectURL(url);
            return;
          }
          this.revokeUrl();
          this.objectUrl = url;
          const el = this.ensureEl();
          el.src = url;
          el.load();
          void this.playElement();
        })
        .catch(() => {
          if (token === this.loadToken) this.patch({ buffering: false, isPlaying: false, error: 'Unable to play this recitation. Check your connection, or download the surah for offline listening.' });
        });
      return;
    }
    this.patch({
      buffering: false,
      isPlaying: false,
      error: 'Unable to play this recitation. Check your connection, or download the surah for offline listening.',
    });
  }

  private onEnded(): void {
    const s = this.getState();
    if (s.range && s.surah !== null) {
      if (s.ayah !== null) this.recordCompletedAyah(s.surah, s.ayah);
      this.rangeAyahRepeated?.();
      const el = this.ensureEl();
      const d = Number.isFinite(el.duration) ? el.duration : 0;
      const target = d > 0 ? this.ayahStartTime(s.range.start, s.ayahCount, d) : 0;
      try {
        el.currentTime = target;
      } catch {
        /* ignore seek errors */
      }
      this.indexFloor = s.range.start;
      this.patch({ ayah: s.range.start, currentTime: target });
      void this.playElement();
      return;
    }
    if (this.stopAfterAyahIndex !== null) {
      const target = this.stopAfterAyahIndex;
      const onAyahEnded = this.singleAyahEnded;
      this.stopAfterAyahIndex = null;
      this.singleAyahEnded = null;
      this.patch({ isPlaying: false, buffering: false, ayah: target });
      if (s.surah !== null) this.recordCompletedAyah(s.surah, target);
      onAyahEnded?.();
      return;
    }
    if (s.surah !== null && s.ayah !== null) this.recordCompletedAyah(s.surah, s.ayah);
    if (s.surah !== null) store.dispatch(markListened(s.surah));

    if (s.stopAfterSurah) {
      this.patch({ isPlaying: false, stopAfterSurah: false, ayah: s.ayahCount ? s.ayahCount - 1 : s.ayah });
      return;
    }
    if (s.loopSurah || s.repeat === 'one') {
      void this.loadCurrent(true);
      return;
    }
    if (s.playlistId === null && s.queue.length === 1 && s.surah !== null) {
      if (s.surah < 114) this.playSingleSurah(s.surah + 1, { reciter: s.reciter });
      else this.patch({ isPlaying: false, ayah: s.ayahCount ? s.ayahCount - 1 : s.ayah });
      return;
    }
    const np = s.pos + 1;
    if (np >= s.order.length) {
      if (s.repeat === 'all') {
        this.jumpTo(0);
      } else {
        this.patch({ isPlaying: false, ayah: s.ayahCount ? s.ayahCount - 1 : s.ayah });
      }
      return;
    }
    this.jumpTo(np);
  }

  private jumpTo(index: number): void {
    const s = this.getState();
    if (s.queue.length === 0) return;
    const target = clampIndex(index, s.order.length);
    this.patch({ pos: target, ayah: null, range: null });
    void this.loadCurrent(true);
  }

  /* ------------------------------------------- public API ------------ */
  startPlaylist(playlist: Playlist, fromIndex = 0): void {
    const s = this.getState();
    this.pendingEdgeSeek = null;
    const queue = buildExpandedQueue(playlist.items);
    if (queue.length === 0) {
      store.dispatch(push('This playlist is empty — add some surahs first.', 'error'));
      return;
    }
    const order = Array.from({ length: queue.length }, (_, i) => i);
    const pos = clampIndex(fromIndex, queue.length);
    this.patch({
      playlistId: playlist.id,
      queueName: playlist.name,
      queue,
      order,
      pos,
      mode: 'order',
      reciter: playlist.reciter || s.reciter,
      loopSurah: false,
      range: null,
      isPlaying: false,
    });
    void this.loadCurrent(true).then(() => {
      void this.surahMeta(queue[order[pos]] ?? 0).then((m) => {
        this.updateMediaSession(m.englishName, reciterLabel(playlist.reciter || s.reciter));
      });
    });
  }

  playSingleSurah(surah: number, opts: {
    reciter?: string;
    startAyahIndex?: number | null;
    stopAfterAyahIndex?: number | null;
    onAyahEnded?: () => void;
    stopAfterSurah?: boolean;
    recommended?: boolean;
    range?: VerseRange | null;
    /** Land on the last verse once the surah length is known. */
    fromEnd?: boolean;
  } = {}): void {
    this.rangeAyahRepeated = null;
    this.pendingEdgeSeek = opts.fromEnd ? 'last' : null;
    const s = this.getState();
    const reciter = opts.reciter ?? s.reciter;
    this.stopAfterAyahIndex = opts.stopAfterAyahIndex ?? null;
    this.singleAyahEnded = opts.onAyahEnded ?? null;
    this.patch({
      playlistId: null,
      queueName: null,
      queue: [surah],
      order: [0],
      pos: 0,
      mode: 'order',
      repeat: 'off',
      range: opts.range ?? null,
      reciter,
      loopSurah: false,
      stopAfterSurah: opts.stopAfterSurah ?? false,
      isPlaying: false,
    });
    void this.loadCurrent(true, opts.startAyahIndex ?? null);
    void this.surahMeta(surah).then((m) => {
      this.updateMediaSession(m.englishName, reciterLabel(reciter));
    });
  }

  /**
   * Continuous Hifz loop over an inclusive ayah range (0-based indices).
   * Resolves the surah length first so out-of-range requests are clamped
   * instead of producing an unbounded loop.
   */
  async playRange(
    surah: number,
    start: number,
    end: number,
    opts: { reciter?: string; onAyahRepeated?: () => void } = {},
  ): Promise<void> {
    const meta = await this.surahMeta(surah);
    const count = Math.max(1, meta.numberOfAyahs || 0);
    const from = clampIndex(start, count);
    const to = clampIndex(end, count);
    const range = { start: Math.min(from, to), end: Math.max(from, to) };
    this.playSingleSurah(surah, {
      reciter: opts.reciter,
      startAyahIndex: range.start,
      range,
    });
    this.rangeAyahRepeated = opts.onAyahRepeated ?? null;
  }

  /** Restrict the loaded surah to a range without changing what is playing. */
  setVerseRange(start: number, end: number): void {
    const s = this.getState();
    if (s.surah === null || s.ayahCount <= 0) return;
    const from = clampIndex(start, s.ayahCount);
    const to = clampIndex(end, s.ayahCount);
    const range = { start: Math.min(from, to), end: Math.max(from, to) };
    this.patch({ range, repeat: 'off', loopSurah: false });
    this.seekToAyah(range.start);
  }

  clearVerseRange(): void {
    this.patch({ range: null });
  }

  /**
  * Plays a surah from a guidance recommendation. Listening is tracked
  * separately; only foreground reading minutes complete the daily goal.
   */
  playRecommendedRecitation(surah: number, opts: { reciter?: string; startAyahIndex?: number | null } = {}): void {
    this.playSingleSurah(surah, { ...opts, recommended: true });
  }

  /** Attach text-length weights for more accurate ayah highlighting. */
  setWeights(textLengths: number[]): void {
    const surah = this.getState().surah;
    if (surah !== null) this.weightsBySurah.set(surah, textLengths);
    this.applyWeights(textLengths);
  }

  private applyWeights(textLengths: number[]): void {
    this.cumulative = textLengths.length > 0 ? buildAyahFractions(textLengths) : null;
  }

  /**
   * Playback started outside the reader (mini player, Now Playing, playlist),
   * so nobody has registered ayah lengths yet. Without them the highlight falls
   * back to dividing the surah into equal slots, which for a surah with uneven
   * verses (Al-Baqara, Yaseen) is minutes out rather than seconds.
   */
  private async hydrateWeights(surah: number): Promise<void> {
    if (this.weightsBySurah.has(surah)) return;
    try {
      const data = await getSurah(surah);
      const lengths = data.ayahs.map((a) => a.ar.length);
      if (lengths.length === 0) return;
      this.weightsBySurah.set(surah, lengths);
      if (this.getState().surah === surah) this.applyWeights(lengths);
    } catch {
      /* keep the uniform fallback */
    }
  }

  /**
   * Milliseconds added to the audio clock before resolving the highlighted
   * ayah. Negative values delay the highlight and auto-scroll (the usual
   * correction when a verse lights up before you hear it).
   */
  setSyncOffset(ms: number): void {
    const clamped = Math.max(-MAX_SYNC_OFFSET_MS, Math.min(MAX_SYNC_OFFSET_MS, Math.round(ms) || 0));
    this.syncOffsetMs = clamped;
    this.onTime();
  }

  get syncOffset(): number {
    return this.syncOffsetMs;
  }

  async play(): Promise<void> {
    const s = this.getState();
    if (s.surah === null) return;
    const intentToken = ++this.playbackIntentToken;
    const el = this.ensureEl();
    const d = Number.isFinite(el.duration) ? el.duration : 0;
    // Restart if we reached the very end while paused.
    if (d > 0 && el.currentTime >= d - 0.4) {
      el.currentTime = 0;
    }
    // Re-entering after the range moved on: resume at its first ayah.
    if (s.range && d > 0 && s.ayahCount > 0) {
      const start = this.ayahStartTime(s.range.start, s.ayahCount, d);
      const end = this.ayahEndTime(s.range.end, s.ayahCount, d);
      if (el.currentTime < start - 0.05 || el.currentTime >= end - 0.05) {
        el.currentTime = start;
        this.indexFloor = s.range.start;
        this.patch({ ayah: s.range.start, currentTime: start });
      }
    }
    await this.playElement(intentToken);
  }

  pause(): void {
    this.playbackIntentToken += 1;
    this.loadToken += 1;
    if (this.hifzPauseTimer !== null) {
      window.clearTimeout(this.hifzPauseTimer);
      this.hifzPauseTimer = null;
    }
    if (this.fadeTimer !== null) {
      window.clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
      const el = this.ensureEl();
      el.volume = this.getState().volume;
      el.muted = this.getState().muted;
    }
    const el = this.ensureEl();
    el.pause();
    this.patch({ isPlaying: false, buffering: false });
  }

  togglePlay(): void {
    if (this.getState().isPlaying) this.pause();
    else void this.play();
  }

  next(): void {
    const s = this.getState();
    if (s.queue.length === 0) return;
    if (s.loopSurah) this.patch({ loopSurah: false });
    if (s.playlistId === null && s.queue.length === 1 && s.surah !== null) {
      if (s.surah < 114) this.playSingleSurah(s.surah + 1, { reciter: s.reciter });
      return;
    }
    const np = s.pos + 1;
    if (np >= s.order.length) {
      this.jumpTo(0);
      return;
    }
    this.patch({ pos: np, ayah: null, range: null });
    void this.loadCurrent(true);
  }

  previous(): void {
    const s = this.getState();
    if (s.queue.length === 0) return;
    if (s.loopSurah) this.patch({ loopSurah: false });
    if (s.playlistId === null && s.queue.length === 1 && s.surah !== null) {
      if (s.surah > 1) this.playSingleSurah(s.surah - 1, { reciter: s.reciter });
      return;
    }
    const np = s.pos > 0 ? s.pos - 1 : s.order.length - 1;
    this.patch({ pos: np, ayah: null, range: null });
    void this.loadCurrent(true);
  }

  /** Restart the current chapter; a second press steps to the previous one. */
  previousChapter(): void {
    const s = this.getState();
    if (s.surah === null) return;
    const now = Date.now();
    const recentlyRestarted = now - this.lastChapterRestartAt < 2500;
    if (!recentlyRestarted && s.currentTime > 3) {
      this.lastChapterRestartAt = now;
      if (s.range) this.seekToAyah(s.range.start);
      else this.seek(0);
      return;
    }
    this.lastChapterRestartAt = 0;
    this.previous();
  }

  /** Step back exactly one verse, crossing into the previous chapter. */
  previousVerse(): void {
    const s = this.getState();
    if (s.surah === null) return;
    const range = s.range;
    const idx = s.ayah ?? range?.start ?? 0;
    // Keep memorisation loops closed: at the first verse, wrap to the last.
    if (range) {
      this.seekToAyah(idx <= range.start ? range.end : idx - 1);
      return;
    }
    if (idx > 0) {
      this.seekToAyah(idx - 1);
      return;
    }
    this.jumpChapter(-1);
  }

  /** Step forward exactly one verse, crossing into the next chapter. */
  nextVerse(): void {
    const s = this.getState();
    if (s.surah === null) return;
    const range = s.range;
    const idx = s.ayah ?? range?.start ?? 0;
    if (range) {
      this.seekToAyah(idx >= range.end ? range.start : idx + 1);
      return;
    }
    if (idx < s.ayahCount - 1) {
      this.seekToAyah(idx + 1);
      return;
    }
    this.jumpChapter(1);
  }

  /**
   * Change chapter and land on the edge verse that keeps verse-by-verse
   * stepping continuous (the last verse when moving backwards).
   */
  private jumpChapter(dir: 1 | -1): void {
    const s = this.getState();
    if (s.queue.length === 0) return;
    const edge = dir === 1 ? 'first' : 'last';
    if (s.playlistId === null && s.queue.length === 1 && s.surah !== null) {
      const target = s.surah + dir;
      if (target < 1 || target > 114) return;
      this.playSingleSurah(target, { reciter: s.reciter, fromEnd: dir === -1 });
      return;
    }
    const pos =
      dir === 1
        ? (s.pos + 1 >= s.order.length ? 0 : s.pos + 1)
        : (s.pos > 0 ? s.pos - 1 : s.order.length - 1);
    this.pendingEdgeSeek = edge;
    this.patch({ pos, ayah: null, range: null });
    void this.loadCurrent(true);
  }

  stop(): void {
    this.playbackIntentToken += 1;
    this.loadToken += 1;
    const el = this.ensureEl();
    if (this.sleepTimerId !== null) {
      window.clearTimeout(this.sleepTimerId);
      this.sleepTimerId = null;
    }
    if (this.hifzPauseTimer !== null) {
      window.clearTimeout(this.hifzPauseTimer);
      this.hifzPauseTimer = null;
    }
    if (this.fadeTimer !== null) {
      window.clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }
    this.pendingEdgeSeek = null;
    this.stopTimelineSampler();
    this.indexFloor = null;
    el.pause();
    el.currentTime = 0;
    this.syncPlaybackState('none');
    this.revokeUrl();
    this.patch({
      isPlaying: false,
      surah: null,
      ayah: null,
      ayahCount: 0,
      playlistId: null,
      queueName: null,
      queue: [],
      order: [],
      pos: 0,
      currentTime: 0,
      duration: 0,
      usingDownload: false,
      buffering: false,
      error: null,
      sleepTimer: null,
      stopAfterSurah: false,
      range: null,
    });
  }

  seek(time: number): void {
    const el = this.ensureEl();
    const s = this.getState();
    if (!s.surah) return;
    const d = Number.isFinite(el.duration) ? el.duration : 0;
    const range = s.range;
    const min = range && d > 0 ? this.ayahStartTime(range.start, s.ayahCount, d) : 0;
    const max = range && d > 0 ? this.ayahEndTime(range.end, s.ayahCount, d) - 0.05 : d > 0 ? d : time;
    const bounded = Math.max(min, Math.min(time, max > min ? max : min));
    const clamped = Math.max(0, bounded);
    try {
      el.currentTime = clamped;
    } catch {
      /* ignore */
    }
    // The reader chose this position, so highlight what the audio actually
    // landed on rather than what the offset would have said.
    this.indexFloor = this.computeAyahIndex(clamped, d, s.ayahCount);
    this.patch({ currentTime: clamped, ayah: this.indexFloor });
  }

  seekToAyah(index: number): void {
    const s = this.getState();
    if (!s.surah) return;
    const count = s.ayahCount || 1;
    const clamped = clampIndex(index, count);
    if (s.range && (clamped < s.range.start || clamped > s.range.end)) {
      // The reader picked a verse outside the loop window; release the lock.
      this.patch({ range: null });
    }
    const el = this.ensureEl();
    const d = Number.isFinite(el.duration) ? el.duration : 0;
    const target = d > 0 ? this.ayahStartTime(clamped, count, d) : 0;
    if (d > 0) {
      try {
        el.currentTime = target;
      } catch {
        /* ignore */
      }
    }
    this.indexFloor = clamped;
    this.patch({ ayah: clamped, currentTime: target });
  }

  /** Jump straight to a queue position (as shown on the Now-Playing queue). */
  goToQueueIndex(index: number): void {
    const s = this.getState();
    if (index < 0 || index >= s.order.length) return;
    this.patch({ pos: index, ayah: null, range: null });
    void this.loadCurrent(true);
  }

  setVolume(v: number): void {
    if (this.fadeTimer !== null) {
      window.clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }
    const vol = Math.min(1, Math.max(0, v));
    const el = this.ensureEl();
    el.volume = vol;
    el.muted = vol === 0 ? el.muted : false;
    this.patch({ volume: vol, muted: vol === 0 });
    this.savePrefs();
  }

  setPlaybackRate(rate: number): void {
    const playbackRate = Math.min(2, Math.max(0.5, rate));
    const el = this.ensureEl();
    el.playbackRate = playbackRate;
    this.patch({ playbackRate });
    this.savePrefs();
  }

  /** Memorisation break: pause briefly after every verse. */
  setHifzPause(v: boolean): void {
    this.patch({ hifzPause: v });
    if (!v && this.hifzPauseTimer !== null) {
      window.clearTimeout(this.hifzPauseTimer);
      this.hifzPauseTimer = null;
    }
    this.savePrefs();
  }

  /** Gently lowers the volume before pausing, so the timer never cuts a verse. */
  private fadeOutAndPause(seconds = 6): void {
    if (this.fadeTimer !== null) window.clearTimeout(this.fadeTimer);
    const el = this.ensureEl();
    const startVol = el.volume;
    const startedAt = performance.now();
    const step = () => {
      const t = Math.min(1, (performance.now() - startedAt) / (seconds * 1000));
      el.volume = Math.max(0, startVol * (1 - t));
      if (t < 1) {
        this.fadeTimer = window.setTimeout(step, 80);
        return;
      }
      this.fadeTimer = null;
      this.pause();
      el.volume = startVol;
      el.muted = this.getState().muted;
    };
    step();
  }

  private pauseForHifz(): void {
    if (this.hifzPauseTimer !== null) return;
    const el = this.ensureEl();
    el.pause();
    this.patch({ isPlaying: false });
    this.hifzPauseTimer = window.setTimeout(() => {
      this.hifzPauseTimer = null;
      if (store.getState().player.hifzPause) void this.play();
    }, 3000);
  }

  cyclePlaybackRate(): void {
    const rates = [0.5, 1, 1.5, 2];
    const current = this.getState().playbackRate;
    const next = rates[(rates.indexOf(current) + 1) % rates.length];
    this.setPlaybackRate(next);
  }

  setMuted(m: boolean): void {
    const el = this.ensureEl();
    el.muted = m;
    this.patch({ muted: m });
    this.savePrefs();
  }

  toggleMute(): void {
    const s = this.getState();
    this.setMuted(!s.muted);
  }

  setRepeat(mode: PlayerState['repeat']): void {
    this.patch({ repeat: mode });
  }

  setLoopSurah(v: boolean): void {
    this.patch({ loopSurah: v });
  }

  setMode(mode: 'order' | 'shuffle'): void {
    const s = this.getState();
    if (s.queue.length === 0) {
      this.patch({ mode });
      return;
    }
    if (mode === 'shuffle') {
      const order = shuffleIndices(s.queue.length);
      // keep continuity on the current surah if playing
      let pos = 0;
      if (s.surah !== null) {
        const found = order.findIndex((i) => s.queue[i] === s.surah);
        if (found >= 0) pos = found;
      }
      this.patch({ mode, order, pos });
    } else {
      const identity = Array.from({ length: s.queue.length }, (_, i) => i);
      let pos = 0;
      if (s.surah !== null) {
        const found = identity.findIndex((i) => s.queue[i] === s.surah);
        if (found >= 0) pos = found;
      }
      this.patch({ mode, order: identity, pos });
    }
  }

  setReciter(reciter: string, opts: { autoplay?: boolean } = {}): void {
    const s = this.getState();
    if (s.reciter === reciter) return;
    this.patch({ reciter });
    if (s.surah !== null) {
      const wasPlaying = opts.autoplay ?? s.isPlaying;
      void this.loadCurrent(wasPlaying);
    }
  }

  /* ------------------------------------------- sleep timer ------------ */
  setSleepTimer(minutes: number | null): void {
    if (this.sleepTimerId !== null) {
      window.clearTimeout(this.sleepTimerId);
      this.sleepTimerId = null;
    }
    if (!minutes || minutes <= 0) {
      this.patch({ sleepTimer: null });
      return;
    }
    const endsAt = Date.now() + minutes * 60_000;
    this.patch({ sleepTimer: { minutes, endsAt } });
    this.sleepTimerId = window.setTimeout(() => {
      this.sleepTimerId = null;
      this.patch({ sleepTimer: null });
      this.fadeOutAndPause(6);
      store.dispatch(push('Sleep timer finished — fading playback out.', 'info'));
    }, minutes * 60_000);
  }

  cancelSleepTimer(): void {
    this.setSleepTimer(null);
  }

  setStopAfterSurah(v: boolean): void {
    this.patch({ stopAfterSurah: v });
    if (v) store.dispatch(push('Will stop when the current surah finishes.', 'info'));
  }

  /* ------------------------------------------- misc ------------------- */
  private savePrefs(): void {
    const s = this.getState();
    const prefs: PlayerPrefs = {
      volume: s.volume,
      muted: s.muted,
      playbackRate: s.playbackRate,
      hifzPause: s.hifzPause,
    };
    try {
      localStorage.setItem(PLAYER_PREFS, JSON.stringify(prefs));
    } catch {
      /* ignore */
    }
  }

  initialize(): void {
    this.setupMediaSession();
    let prefs: PlayerPrefs = { volume: 1, muted: false, playbackRate: 1 };
    try {
      const raw = localStorage.getItem(PLAYER_PREFS);
      if (raw) prefs = { ...prefs, ...(JSON.parse(raw) as PlayerPrefs) };
    } catch {
      /* ignore */
    }
    const playbackRate = Number.isFinite(prefs.playbackRate) ? prefs.playbackRate : 1;
    this.patch({
      volume: prefs.volume,
      muted: prefs.muted,
      playbackRate,
      hifzPause: Boolean(prefs.hifzPause),
    });
    const el = this.ensureEl();
    el.volume = prefs.volume;
    el.muted = prefs.muted;
    el.playbackRate = playbackRate;

    // Keep the highlight offset in step with the reader-facing setting.
    this.setSyncOffset(store.getState().settings.audioSyncOffsetMs);
    store.subscribe(() => {
      const next = store.getState().settings.audioSyncOffsetMs;
      if (next !== this.syncOffsetMs) this.setSyncOffset(next);
    });
  }

  get isActive(): boolean {
    return this.getState().surah !== null;
  }
}

function reciterLabel(reciterId: string): string {
  return reciterById(reciterId).label;
}

export const player = new PlayerController();
