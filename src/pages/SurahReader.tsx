import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLayoutEffect } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useAppDispatch, useAppSelector } from '../store';
import { player } from '../audio/controller';
import { getIndoPakSurah, getSurah } from '../lib/dataClient';
import { useQuran } from '../data/QuranProvider';
import { addReadMinute, rememberRead } from '../store/slices/progressSlice';
import { push } from '../store/slices/toastSlice';
import { toggleAyahBookmark } from '../store/slices/bookmarksSlice';
import type { AyahBookmark } from '../store/slices/bookmarksSlice';
import { toggleMemorizedAyah } from '../store/slices/memorizedSlice';
import {
  setArabicFontSize,
  setDefaultReciterId,
  setLineSpacing,
  setReadingMode,
  setShowArabic,
  setShowTransliteration,
  setShowTranslation,
  setShowVerseNumbers,
  setTranslationFontSize,
} from '../store/slices/settingsSlice';
import { setAccentColor, setThemeMode } from '../store/slices/settingsSlice';
import { ACCENTS, RECITERS, scriptClassName } from '../lib/constants';
import { isThemeSelectable } from '../lib/unlocks';
import { clamp, formatTime } from '../lib/utils';
import { isSessionFlagSet, setSessionFlag } from '../lib/sessionFlags';
import { Icon } from '../components/ui/Icon';
import { Slider, Toggle } from '../components/ui/controls';
import { Modal } from '../components/ui/Modal';
import { SurahArtwork } from '../components/ui/SurahArtwork';
import { VerseActionModal } from '../components/VerseActionModal';
import { ShareCardModal } from '../components/share/ShareCardModal';
import { AddToPlaylistModal } from '../components/playlist/AddToPlaylistModal';
import { SessionEndModal } from '../components/SessionEndModal';
import { insightForAyah } from '../data/quranInsightsData';
import {
  AMBIENT_SOUND_TRACKS,
  startAmbientSound,
  type AmbientSoundHandle,
  type AmbientSoundTrack,
} from '../audio/ambientSound';
import { activityDayKey } from '../lib/progression';
import { ErrorBlock, SkeletonRows } from '../components/ui/common';
import type { AyahData, SettingsState, SurahFull, ThemeMode } from '../types';
import type { PlayerState } from '../store/slices/playerSlice';

export default function SurahReader() {
  const { number } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const surahNumber = Number(number);

  const settings = useAppSelector((s) => s.settings);
  const playerState = useAppSelector((s) => s.player);
  const bookmarkItems = useAppSelector((s) => s.bookmarks.items);
  const bookmarkIds = useMemo(() => new Set(bookmarkItems.map((item) => item.id)), [bookmarkItems]);
  const memorizedItems = useAppSelector((s) => s.memorized.items);
  const memorizedById = useMemo(() => new Map(memorizedItems.map((item) => [item.id, item])), [memorizedItems]);
  const lastRead = useAppSelector((s) => s.progress.lastRead[surahNumber]);
  const dailyActivity = useAppSelector((s) => s.progress.dailyActivity);
  const dailyReadMinutes = useAppSelector((s) => s.progress.progression.dailyReadMinutes);
  const { surahs, juz } = useQuran();

  const [surah, setSurah] = useState<SurahFull | null>(null);
  const [indoPakAyahs, setIndoPakAyahs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [activeAyah, setActiveAyah] = useState(0);
  const [focusedAyahIndex, setFocusedAyahIndex] = useState<number | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [addToPlaylistOpen, setAddToPlaylistOpen] = useState(false);
  const [playbackSettingsOpen, setPlaybackSettingsOpen] = useState(false);
  const [mediaHudVisible, setMediaHudVisible] = useState(true);
  const [readerElapsedSeconds, setReaderElapsedSeconds] = useState(0);
  const [viewMode, setViewMode] = useState<'list' | 'book'>('list');
  const [bookPage, setBookPage] = useState(0);
  const [sessionFinished, setSessionFinished] = useState(false);
  const [ambientPromptMounted, setAmbientPromptMounted] = useState(false);
  const [ambientPromptDismissed, setAmbientPromptDismissed] = useState(
    () => isSessionFlagSet('reader_ambient_prompt_dismissed_session'),
  );
  const [ambientActive, setAmbientActive] = useState(false);
  const [ambientTrack, setAmbientTrack] = useState<AmbientSoundTrack | null>(null);
  const ambientHandleRef = useRef<AmbientSoundHandle | null>(null);
  const mediaHudTimerRef = useRef<number | null>(null);
  const readerElapsedMsRef = useRef(0);
  const sessionFinishedRef = useRef(sessionFinished);

  const stopAmbient = useCallback(() => {
    ambientHandleRef.current?.stop();
    ambientHandleRef.current = null;
  }, []);

  const startAmbient = useCallback(() => {
    stopAmbient();
    const handle = startAmbientSound(
      settings.ambientSoundVolume,
      setAmbientTrack,
      (error) => {
        stopAmbient();
        setAmbientActive(false);
        setAmbientTrack(null);
        dispatch(push(`Could not continue the nature sounds: ${error.message}`, 'error'));
      },
    );
    if (!handle) {
      dispatch(push('Ambient audio is not available in this browser.', 'error'));
      return;
    }
    ambientHandleRef.current = handle;
    setAmbientActive(true);
  }, [dispatch, settings.ambientSoundVolume, stopAmbient]);

  useLayoutEffect(() => {
    stopAmbient();
    player.pause();
    setSessionFinished(false);
    setAmbientPromptMounted(false);
    setAmbientActive(false);
    setAmbientTrack(null);
    setReaderElapsedSeconds(0);
    setMediaHudVisible(true);
  }, [surahNumber, stopAmbient]);

  useEffect(() => {
    sessionFinishedRef.current = sessionFinished;
  }, [sessionFinished]);

  useEffect(() => {
    let lastTick = Date.now();
    readerElapsedMsRef.current = 0;
    setReaderElapsedSeconds(0);
    const timer = window.setInterval(() => {
      const now = Date.now();
      if (document.visibilityState === 'visible' && !sessionFinishedRef.current) {
        readerElapsedMsRef.current += Math.min(2000, Math.max(0, now - lastTick));
        setReaderElapsedSeconds(Math.floor(readerElapsedMsRef.current / 1000));
      }
      lastTick = now;
    }, 1000);
    return () => window.clearInterval(timer);
  }, [surahNumber]);

  const revealMediaHud = useCallback(() => {
    setMediaHudVisible(true);
    if (mediaHudTimerRef.current !== null) window.clearTimeout(mediaHudTimerRef.current);
    if (playerState.isPlaying) {
      mediaHudTimerRef.current = window.setTimeout(() => setMediaHudVisible(false), 2800);
    }
  }, [playerState.isPlaying]);

  useEffect(() => {
    if (mediaHudTimerRef.current !== null) window.clearTimeout(mediaHudTimerRef.current);
    if (!playerState.isPlaying) {
      setMediaHudVisible(true);
      return;
    }
    mediaHudTimerRef.current = window.setTimeout(() => setMediaHudVisible(false), 2800);
    return () => {
      if (mediaHudTimerRef.current !== null) window.clearTimeout(mediaHudTimerRef.current);
    };
  }, [playerState.isPlaying]);

  useEffect(() => {
    if (surah) setAmbientPromptMounted(true);
  }, [surah?.number]);

  useEffect(() => {
    if (!ambientPromptDismissed || ambientActive) return;
    const timeout = window.setTimeout(() => setAmbientPromptMounted(false), 250);
    return () => window.clearTimeout(timeout);
  }, [ambientPromptDismissed, ambientActive]);

  useEffect(() => () => stopAmbient(), [stopAmbient]);

  useEffect(() => {
    let alive = true;
    if (!surah || settings.scriptType !== 'indopak') {
      setIndoPakAyahs([]);
      return () => { alive = false; };
    }
    void getIndoPakSurah(surah.number)
      .then((data) => {
        if (alive) setIndoPakAyahs(data.ayahs.map((ayah) => ayah.text));
      })
      .catch(() => {
        if (alive) setIndoPakAyahs([]);
      });
    return () => { alive = false; };
  }, [surah?.number, settings.scriptType]);

  const validSurahNumber = Number.isInteger(surahNumber) && surahNumber >= 1 && surahNumber <= 114;
  const handleBack = useCallback(() => {
    if (location.key !== 'default') navigate(-1);
    else navigate('/library');
  }, [location.key, navigate]);

  const refs = useRef(new Map<number, HTMLDivElement>());
  const listRef = useRef<HTMLDivElement>(null);
  const pendingAyahScroll = useRef<{ index: number; smooth: boolean } | null>(null);
  const [listOffset, setListOffset] = useState(0);
  const listSwipeStart = useRef<{ x: number; y: number } | null>(null);
  const initTarget = useRef<number | null>(null);
  const bookPageRef = useRef(0);

  const rowVirtualizer = useWindowVirtualizer({
    count: viewMode === 'list' ? surah?.ayahs.length ?? 0 : 0,
    estimateSize: () => settings.showArabic
      ? Math.max(150, settings.arabicFontSize * settings.lineSpacing * 4)
      : Math.max(100, settings.translationFontSize * settings.lineSpacing * 4),
    overscan: 3,
    scrollMargin: listOffset,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();

  useLayoutEffect(() => {
    if (viewMode !== 'list' || !listRef.current) return;
    const measureOffset = () => {
      const node = listRef.current;
      if (node) setListOffset(node.getBoundingClientRect().top + window.scrollY);
    };
    measureOffset();
    window.addEventListener('resize', measureOffset);
    return () => window.removeEventListener('resize', measureOffset);
  }, [surah?.number, settings.showArabic, settings.showTranslation, settings.showTransliteration, viewMode]);

  useEffect(() => {
    refs.current.forEach((element, index) => {
      if (!element.isConnected) refs.current.delete(index);
    });
    for (const element of listRef.current?.querySelectorAll<HTMLDivElement>('.ayah-row[data-index]') ?? []) {
      const index = Number(element.dataset.index);
      if (!Number.isInteger(index)) continue;
      refs.current.set(index, element);
      rowVirtualizer.measureElement(element);
    }

    const pending = pendingAyahScroll.current;
    if (!pending) return;
    const element = refs.current.get(pending.index);
    if (!element) return;
    pendingAyahScroll.current = null;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    element.scrollIntoView({ behavior: pending.smooth && !reduceMotion ? 'smooth' : 'auto', block: 'start' });
  }, [virtualRows]);

  useEffect(() => {
    document.documentElement.style.setProperty('--q-reader-bar-h', '64px');
    return () => {
      document.documentElement.style.removeProperty('--q-reader-bar-h');
    };
  }, []);

  const updateBookPage = useCallback((page: number) => {
    bookPageRef.current = page;
    setBookPage(page);
  }, []);

  const pages = useMemo(() => {
    if (!surah) return [];
    const capacity = settings.showArabic ? 8 : 12;
    const lineWeight = (ayah: AyahData) => {
      let weight = settings.showArabic ? 1.6 + ayah.ar.length / 140 : 0;
      if (settings.showTransliteration && ayah.tl) weight += 1 + ayah.tl.length / 180;
      if (settings.showTranslation && ayah.tr) weight += 1 + ayah.tr.length / 220;
      return Math.max(1, weight);
    };
    const result: number[][] = [];
    let current: number[] = [];
    let used = 0;
    surah.ayahs.forEach((ayah, index) => {
      const weight = lineWeight(ayah);
      if (current.length > 0 && used + weight > capacity) {
        result.push(current);
        current = [];
        used = 0;
      }
      current.push(index);
      used += weight;
    });
    if (current.length > 0) result.push(current);
    return result;
  }, [surah, settings.showArabic, settings.showTransliteration, settings.showTranslation]);

  const pageForAyah = useCallback(
    (index: number) => Math.max(0, pages.findIndex((page) => page.includes(index))),
    [pages],
  );

  const fromUrl = useMemo(() => {
    const a = Number(searchParams.get('ayah'));
    return Number.isFinite(a) && a > 0 ? a : null;
  }, [searchParams]);

  useEffect(() => {
    let alive = true;
    if (!validSurahNumber) {
      setLoading(false);
      setError('That chapter number is not valid.');
      return () => {
        alive = false;
      };
    }
    setLoading(true);
    setError(null);
    setSurah(null);
    getSurah(surahNumber)
      .then((d) => {
        if (!alive) return;
        setSurah(d);
        // register length weights for proportional audio highlight
        player.setWeights(d.ayahs.map((a) => a.ar.length));
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [surahNumber, attempt, validSurahNumber]);

  // Initial target: URL ?ayah → last-read → 1
  useEffect(() => {
    if (!surah) return;
    const resume = lastRead?.ayah;
    const startRaw = (fromUrl ?? resume ?? 1) - 1;
    const start = clamp(startRaw, 0, surah.ayahs.length - 1);
    setActiveAyah(start);
    initTarget.current = start;
    updateBookPage(pageForAyah(start));
  }, [surah?.number]); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollToAyah = useCallback(
    (index: number, smooth: boolean) => {
      const el = refs.current.get(index);
      if (!el) {
        pendingAyahScroll.current = { index, smooth };
        rowVirtualizer.scrollToIndex(index, { align: 'start', behavior: 'auto' });
        return;
      }
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: smooth && !reduceMotion ? 'smooth' : 'auto', block: 'start' });
    },
    [rowVirtualizer],
  );

  /**
   * Auto-scroll waits a beat before moving: the highlight updates instantly,
   * then the viewport follows the same index. Coalescing the hops means a
   * skipped or retimed verse does not leave two smooth scrolls fighting, and a
   * boundary crossed twice in quick succession only scrolls once.
   */
  const followScrollTimer = useRef<number | null>(null);
  const scheduleFollowScroll = useCallback(
    (index: number) => {
      if (followScrollTimer.current !== null) window.clearTimeout(followScrollTimer.current);
      followScrollTimer.current = window.setTimeout(() => {
        followScrollTimer.current = null;
        scrollToAyah(index, true);
      }, settings.autoScrollSpeed);
    },
    [scrollToAyah, settings.autoScrollSpeed],
  );

  useEffect(
    () => () => {
      if (followScrollTimer.current !== null) window.clearTimeout(followScrollTimer.current);
    },
    [],
  );

  // One-time scroll to the resume target after first paint. An ayah requested
  // through the URL (search, juz jump) is scrolled to smoothly.
  useEffect(() => {
    if (initTarget.current === null) return;
    if (initTarget.current === activeAyah) {
      const t = initTarget.current;
      initTarget.current = null;
      const raf = requestAnimationFrame(() => scrollToAyah(t, fromUrl !== null));
      return () => cancelAnimationFrame(raf);
    }
  }, [activeAyah, scrollToAyah, surah?.number]); // eslint-disable-line react-hooks/exhaustive-deps

  // Only the ?ayah target changed (e.g. a second voice-search result in the same
  // surah): the surah itself did not reload, so scroll manually.
  useEffect(() => {
    if (!surah || fromUrl === null || initTarget.current !== null) return;
    const target = clamp(fromUrl - 1, 0, surah.ayahs.length - 1);
    setActiveAyah(target);
    if (viewMode === 'book') updateBookPage(pageForAyah(target));
    else requestAnimationFrame(() => scrollToAyah(target, true));
  }, [fromUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist reading position when the active ayah changes.
  useEffect(() => {
    if (!surah) return;
    dispatch(rememberRead({ surah: surah.number, ayah: activeAyah + 1, name: surah.englishName }));
  }, [activeAyah, surah, dispatch]);

  useLayoutEffect(() => {
    if (!playerState.isPlaying) return;
    stopAmbient();
    setAmbientActive(false);
    setAmbientTrack(null);
  }, [playerState.isPlaying, stopAmbient]);

  useEffect(() => {
    ambientHandleRef.current?.setVolume(settings.ambientSoundVolume);
  }, [settings.ambientSoundVolume]);

  const prepareForRecitation = useCallback(() => {
    stopAmbient();
    setAmbientActive(false);
    setAmbientTrack(null);
    setAmbientPromptDismissed(true);
    setSessionFlag('reader_ambient_prompt_dismissed_session');
  }, [stopAmbient]);

  // Follow the sounding ayah while audio plays on this surah.
  useEffect(() => {
    const { ayah, isPlaying } = playerState;
    const same = playerState.surah === surah?.number;
    if (!surah || !same || !isPlaying || ayah === null || !settings.followAudio) return;
    if (ayah !== activeAyah) {
      // cancel any pending “resume” jump so it can’t fight live playback
      initTarget.current = null;
      setActiveAyah(ayah);
      if (viewMode === 'book') updateBookPage(pageForAyah(ayah));
      else scheduleFollowScroll(ayah);
    }
  }, [playerState.ayah, playerState.surah, playerState.isPlaying, settings.followAudio, activeAyah, pageForAyah, updateBookPage, viewMode, surah?.number, scheduleFollowScroll]);

  const isActiveSession = playerState.surah === surahNumber;
  const readerRepeat = isActiveSession ? playerState.repeat : 'off';
  const currentJuz = useMemo(() => {
    if (!juz) return null;
    return juz.reduce<(typeof juz)[number] | null>((found, boundary) => {
      const startsBeforeSurah = boundary.startSurah < surahNumber;
      const startsInSurah = boundary.startSurah === surahNumber && boundary.startAyah <= 1;
      return startsBeforeSurah || startsInSurah ? boundary : found;
    }, null);
  }, [juz, surahNumber]);

  const handleSelect = (index: number) => {
    setActiveAyah(index);
    if (isActiveSession) {
      player.seekToAyah(index);
    }
  };

  const handlePlay = () => {
    if (!surah) return;
    if (isActiveSession) {
      if (playerState.isPlaying) player.pause();
      else {
        prepareForRecitation();
        void player.play();
      }
    } else {
      prepareForRecitation();
      player.playSingleSurah(surah.number, {
        reciter: settings.defaultReciter,
        startAyahIndex: activeAyah,
      });
    }
  };

  const handlePreviousChapter = () => {
    if (surahNumber <= 1) return;
    const previous = surahs?.find((item) => item.number === surahNumber - 1);
    navigate(`/surah/${surahNumber - 1}?ayah=${previous?.numberOfAyahs ?? 1}`);
  };

  const handleNextChapter = () => {
    if (surahNumber < 114) navigate(`/surah/${surahNumber + 1}?ayah=1`);
  };

  const currentAyahIndex = playerState.surah === surahNumber
    ? playerState.ayah ?? activeAyah
    : activeAyah;

  const handleBeginningOrPreviousChapter = () => {
    if (currentAyahIndex === 0) handlePreviousChapter();
    else handleSelect(0);
  };

  const handleEndOrNextChapter = () => {
    if (currentAyahIndex >= (surah?.ayahs.length ?? 1) - 1) handleNextChapter();
    else if (surah) handleSelect(surah.ayahs.length - 1);
  };

  const jumpToAyah = (ayahNumber: number) => {
    if (!surah || !Number.isInteger(ayahNumber) || ayahNumber < 1 || ayahNumber > surah.ayahs.length) return;
    const index = ayahNumber - 1;
    handleSelect(index);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('ayah', String(ayahNumber));
    setSearchParams(nextParams, { replace: true });
    if (viewMode === 'book') updateBookPage(pageForAyah(index));
    else requestAnimationFrame(() => scrollToAyah(index, true));
    setPlaybackSettingsOpen(false);
  };

  const dismissAmbientPrompt = () => {
    setAmbientPromptDismissed(true);
    setSessionFlag('reader_ambient_prompt_dismissed_session');
  };

  const changeViewMode = (mode: 'list' | 'book') => {
    if (mode === 'book') updateBookPage(pageForAyah(activeAyah));
    setViewMode(mode);
  };

  const turnPage = (direction: -1 | 1) => {
    const nextPage = bookPageRef.current + direction;
    if (nextPage >= 0 && nextPage < pages.length) {
      updateBookPage(nextPage);
      return;
    }
    if (direction > 0 && surahNumber < 114) {
      navigate(`/surah/${surahNumber + 1}?ayah=1`);
    } else if (direction < 0 && surahNumber > 1) {
      const previous = surahs?.find((item) => item.number === surahNumber - 1);
      navigate(`/surah/${surahNumber - 1}?ayah=${previous?.numberOfAyahs ?? 1}`);
    }
  };

  if (loading || (!surah && !error)) {
    return (
      <div className="page-enter">
        <ReaderBar
          onBack={handleBack}
          timer={formatTime(readerElapsedSeconds)}
          onOptions={() => setOptionsOpen(true)}
        />
        <div className="mt-4">
          <SkeletonRows rows={12} />
        </div>
      </div>
    );
  }

  if (error || !surah) {
    return (
      <div className="page-enter">
        <ReaderBar
          onBack={handleBack}
          timer={formatTime(readerElapsedSeconds)}
          onOptions={() => setOptionsOpen(true)}
        />
        <ErrorBlock
          message={`Couldn’t load this surah: ${error ?? 'unknown error'}`}
          onRetry={() => setAttempt((a) => a + 1)}
        />
      </div>
    );
  }

  const arFontPx = settings.arabicFontSize;
  const arClass = scriptClassName(settings.script);
  const showBasmala = surah.number !== 1 && surah.number !== 9;

  return (
    <div
      className="page-enter reader-viewport"
      onPointerDown={revealMediaHud}
      onPointerMove={revealMediaHud}
      onTouchStart={revealMediaHud}
    >
      {/* sticky toolbar */}
      <ReaderBar
        onBack={handleBack}
        timer={formatTime(readerElapsedSeconds)}
        onOptions={() => setOptionsOpen(true)}
      />

      {ambientPromptMounted && (
        <div
          aria-hidden={playerState.isPlaying || (ambientPromptDismissed && !ambientActive)}
          className={`ambient-suggestion anim-fade-up mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-white shadow-lg backdrop-blur-md ${
            playerState.isPlaying || (ambientPromptDismissed && !ambientActive) ? 'pointer-events-none translate-y-1 opacity-0' : 'translate-y-0 opacity-100'
          }`}
        >
          {ambientActive ? (
            <>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">Now playing · {ambientTrack?.label ?? 'Nature sounds'}</div>
                <div className="mt-0.5 text-xs text-white/65">{AMBIENT_SOUND_TRACKS.length} real nature recordings shuffle without repeats. Qur’an recitation takes priority.</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  disabled={playerState.isPlaying}
                  onClick={() => ambientHandleRef.current?.shuffleNext()}
                  aria-label="Shuffle to another nature sound"
                  className="rounded-full bg-emerald-500/90 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
                >
                  Shuffle now
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopAmbient();
                    setAmbientActive(false);
                    setAmbientTrack(null);
                    setAmbientPromptDismissed(true);
                  }}
                  className="rounded-full border border-white/20 px-3 py-2 text-xs font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
                >
                  Turn off
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">Enhance your reading focus with calming nature sounds?</div>
                <div className="mt-0.5 text-xs text-white/65">{AMBIENT_SOUND_TRACKS.length} real field recordings shuffle in the background. Recitation always takes priority.</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  disabled={playerState.isPlaying || ambientPromptDismissed}
                  onClick={() => {
                    startAmbient();
                    dismissAmbientPrompt();
                  }}
                  className="rounded-full bg-emerald-500/90 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-400"
                >
                  Yes
                </button>
                <button
                  type="button"
                  disabled={playerState.isPlaying || ambientPromptDismissed}
                  onClick={dismissAmbientPrompt}
                  className="rounded-full border border-white/20 px-3 py-2 text-xs font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
                >
                  No / Dismiss
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="reader-surah-hero relative mt-3 mb-3 overflow-hidden rounded-3xl border border-line bg-surface/70 px-4 py-3 text-center shadow-card backdrop-blur-sm">
        <SurahArtwork surah={surah.number} className="opacity-70" />
        <div className="relative">
        <div className="text-xs font-medium uppercase tracking-widest text-mut">
          Juz {currentJuz?.juz ?? '—'} · {surah.englishName}
        </div>
        <div className="mt-1 text-xs text-mut">{surah.revelationType} · {surah.numberOfAyahs} āyāt</div>
        <div className={`${arClass} mt-3 text-4xl font-semibold text-ink`} style={{ direction: 'rtl' }}>
          {surah.name}
        </div>
        <div className="mt-1 text-sm text-mut">{surah.englishNameTranslation}</div>
        {showBasmala && (
          <div className={`${arClass} mt-4 text-2xl leading-loose text-ink2`} style={{ direction: 'rtl' }}>
            بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
          </div>
        )}
        <button
          type="button"
          onClick={handlePlay}
          aria-label={isActiveSession && playerState.isPlaying ? 'Pause Audio' : 'Play Audio'}
          aria-pressed={isActiveSession && playerState.isPlaying}
          className="pressable mx-auto mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-onaccent shadow-card transition hover:brightness-110"
        >
          <Icon name={isActiveSession && playerState.isPlaying ? 'pause' : 'play'} size={17} />
          {isActiveSession && playerState.isPlaying ? 'Pause Audio' : 'Play Audio'}
        </button>
        </div>
      </div>

      {viewMode === 'list' ? (
        <div
          ref={listRef}
          className="mt-2 touch-pan-y"
          style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}
          onPointerDown={(event) => {
            if (event.pointerType === 'mouse' || (event.target as HTMLElement).closest('button')) return;
            listSwipeStart.current = { x: event.clientX, y: event.clientY };
          }}
          onPointerUp={(event) => {
            const start = listSwipeStart.current;
            listSwipeStart.current = null;
            if (!start) return;
            const deltaX = event.clientX - start.x;
            const deltaY = event.clientY - start.y;
            if (Math.abs(deltaX) < 72 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return;
            turnPage(deltaX < 0 ? 1 : -1);
          }}
          onPointerCancel={() => { listSwipeStart.current = null; }}
        >
          {virtualRows.map((virtualRow) => {
            const i = virtualRow.index;
            const ayah = surah.ayahs[i];
            return (
              <AyahBlock
                key={ayah.g}
                virtualIndex={virtualRow.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start - rowVirtualizer.options.scrollMargin}px)`,
                }}
                ayah={ayah}
                arabicText={settings.scriptType === 'indopak' ? indoPakAyahs[i] ?? ayah.ar : ayah.ar}
                index={i}
                bookmark={{ id: `${surah.number}:${ayah.i}`, surah: surah.number, ayah: ayah.i, surahName: surah.englishName, arabic: settings.scriptType === 'indopak' ? indoPakAyahs[i] ?? ayah.ar : ayah.ar, translation: ayah.tr }}
                isBookmarked={bookmarkIds.has(`${surah.number}:${ayah.i}`)}
                onToggleBookmark={(item) => dispatch(toggleAyahBookmark(item))}
                arClass={arClass}
                arFontPx={arFontPx}
                showArabic={settings.showArabic}
                showTranslation={settings.showTranslation}
                showTransliteration={settings.showTransliteration}
                showVerseNumbers={settings.showVerseNumbers}
                translationFontSize={settings.translationFontSize}
                lineSpacing={settings.lineSpacing}
                sounding={isActiveSession && playerState.isPlaying && playerState.ayah === i}
                selected={activeAyah === i}
                onOpenFocus={() => setFocusedAyahIndex(i)}
                onSelect={() => handleSelect(i)}
              />
            );
          })}
        </div>
      ) : (
        <BookView
          pages={pages}
          pageIndex={bookPage}
          surah={surah}
          arClass={arClass}
          arFontPx={arFontPx}
          showArabic={settings.showArabic}
          showTranslation={settings.showTranslation}
          showTransliteration={settings.showTransliteration}
          showVerseNumbers={settings.showVerseNumbers}
          translationFontSize={settings.translationFontSize}
          lineSpacing={settings.lineSpacing}
          scriptType={settings.scriptType}
          indoPakAyahs={indoPakAyahs}
          isActiveSession={isActiveSession}
          isPlaying={playerState.isPlaying}
          activeAyah={activeAyah}
          onSelect={handleSelect}
          onOpenFocus={setFocusedAyahIndex}
          bookmarkedIds={bookmarkIds}
          onToggleBookmark={(item) => dispatch(toggleAyahBookmark(item))}
          onTurn={turnPage}
        />
      )}

      <ReaderMediaHud
        visible={mediaHudVisible || !playerState.isPlaying}
        isPlaying={isActiveSession && playerState.isPlaying}
        onPlaybackSettings={() => setPlaybackSettingsOpen(true)}
        onBeginningOrPreviousChapter={handleBeginningOrPreviousChapter}
        onPrevious={() => handleSelect(Math.max(0, currentAyahIndex - 1))}
        onPlay={handlePlay}
        onNext={() => handleSelect(Math.min(surah.ayahs.length - 1, currentAyahIndex + 1))}
        onEndOrNextChapter={handleEndOrNextChapter}
      />

      {/* reader options modal */}
      <ReaderOptions
        open={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        settings={settings}
        dispatch={dispatch}
        viewMode={viewMode}
        onViewModeChange={changeViewMode}
        onAddToPlaylist={() => {
          setOptionsOpen(false);
          setAddToPlaylistOpen(true);
        }}
      />
      <AddToPlaylistModal
        open={addToPlaylistOpen}
        onClose={() => setAddToPlaylistOpen(false)}
        surah={surah.number}
        surahName={surah.englishName}
      />
      <ReaderPlaybackSettings
        open={playbackSettingsOpen}
        onClose={() => setPlaybackSettingsOpen(false)}
        settings={settings}
        playerState={playerState}
        onReciterChange={(reciter) => {
          dispatch(setDefaultReciterId(reciter));
          player.setReciter(reciter);
        }}
        onRepeat={() => {
          const next = readerRepeat === 'off' ? 'one' : readerRepeat === 'one' ? 'all' : 'off';
          player.setRepeat(next);
        }}
        currentAyah={currentAyahIndex + 1}
        ayahCount={surah.ayahs.length}
        onJumpToAyah={jumpToAyah}
      />
      {focusedAyahIndex !== null && surah.ayahs[focusedAyahIndex] && (() => {
        const ayah = surah.ayahs[focusedAyahIndex];
        const arabic = settings.scriptType === 'indopak' ? indoPakAyahs[focusedAyahIndex] ?? ayah.ar : ayah.ar;
        const bookmark = {
          id: `${surah.number}:${ayah.i}`,
          surah: surah.number,
          ayah: ayah.i,
          surahName: surah.englishName,
          arabic,
          translation: ayah.tr,
        };
        return (
          <VerseActionModal
            open
            onClose={() => setFocusedAyahIndex(null)}
            surahNumber={surah.number}
            surahName={surah.englishName}
            ayahNumber={ayah.i}
            arabic={arabic}
            translation={ayah.tr}
            transliteration={ayah.tl}
            reciter={settings.defaultReciter}
            bookmark={bookmark}
            isBookmarked={bookmarkIds.has(bookmark.id)}
            isMemorized={memorizedById.get(bookmark.id)?.memorized ?? false}
            repetitions={memorizedById.get(bookmark.id)?.repetitions ?? 0}
            onToggleBookmark={(item) => dispatch(toggleAyahBookmark(item))}
            insight={insightForAyah(surah.number, ayah.i)}
            hifzEnabled={settings.hifzRepetitionEnabled}
            wordByWordEnabled={settings.wordByWordEnabled}
          />
        );
      })()}
      <SessionEndModal
        active={!!surah && !sessionFinished}
        readerMode
        todayMinutes={dailyReadMinutes[activityDayKey(new Date(), dailyActivity)] ?? 0}
        goalMinutes={settings.dailyReadingGoalMinutes}
        onMinute={() => dispatch(addReadMinute({ at: Date.now(), goalMinutes: settings.dailyReadingGoalMinutes }))}
        onFinish={() => setSessionFinished(true)}
      />
    </div>
  );
}

/* ============================ Ayah block ============================ */
function AyahBlock({
  ayah,
  arabicText,
  index,
  bookmark,
  isBookmarked,
  onToggleBookmark,
  arClass,
  arFontPx,
  showArabic,
  showTranslation,
  showTransliteration,
  showVerseNumbers,
  translationFontSize,
  lineSpacing,
  sounding,
  selected,
  onSelect,
  onOpenFocus,
  virtualIndex,
  style,
}: {
  ayah: AyahData;
  arabicText?: string;
  index: number;
  bookmark: Omit<AyahBookmark, 'note' | 'createdAt'>;
  isBookmarked: boolean;
  onToggleBookmark: (bookmark: Omit<AyahBookmark, 'note' | 'createdAt'>) => void;
  arClass: string;
  arFontPx: number;
  showArabic: boolean;
  showTranslation: boolean;
  showTransliteration: boolean;
  showVerseNumbers: boolean;
  translationFontSize: number;
  lineSpacing: number;
  sounding: boolean;
  selected: boolean;
  onSelect: () => void;
  onOpenFocus: () => void;
  virtualIndex?: number;
  style?: React.CSSProperties;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const dispatch = useAppDispatch();
  const memorized = useAppSelector((state) => state.memorized.items.find((item) => item.id === bookmark.id));
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const displayedArabic = arabicText ?? ayah.ar;

  const closeMenu = () => {
    setMenuOpen(false);
    menuButtonRef.current?.focus();
  };

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node) && !menuButtonRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuOpen]);

  const copyArabic = () => {
    void navigator.clipboard?.writeText(displayedArabic);
    closeMenu();
  };

  return (
    <>
    <div
      data-index={virtualIndex}
      onClick={() => {
        onSelect();
        onOpenFocus();
      }}
      style={style}
      className={`ayah-row group relative scroll-mt-24 cursor-pointer border-b border-line px-3 py-5 transition-colors ${
        sounding ? 'ayah-active' : selected ? 'bg-accent/6 ring-1 ring-accent/30' : 'hover:bg-surface'
      }`}
      data-ayah={index}
    >
      {showArabic && (
        <p className={`ayah-ar ${arClass} pr-8 text-right text-ink`} dir="rtl" style={{ fontSize: arFontPx, lineHeight: lineSpacing }}>
          {displayedArabic}
          {showVerseNumbers && <span className="ayah-marker">{index + 1}</span>}
        </p>
      )}
      {showTransliteration && ayah.tl && (
        <p className="ayah-tl mt-4 pr-8 italic text-ink2" style={{ fontSize: Math.min(translationFontSize, 20), lineHeight: lineSpacing }}>
          {showVerseNumbers && <span className="mr-1.5 font-semibold not-italic text-accent">{index + 1}.</span>}
          {ayah.tl}
        </p>
      )}
      {showTranslation && ayah.tr && (
        <p className="ayah-tr mt-3 pr-8 text-ink2" style={{ fontSize: translationFontSize, lineHeight: lineSpacing }}>
          {showVerseNumbers && <span className="mr-1.5 font-semibold text-accent">{index + 1}.</span>}
          {ayah.tr}
        </p>
      )}
      <div className="absolute right-1 top-5">
        <button
          ref={menuButtonRef}
          type="button"
          aria-label={`More actions for ayah ${index + 1}`}
          onClick={(event) => {
            event.stopPropagation();
            setMenuOpen((open) => !open);
          }}
          className="pressable flex h-12 w-12 items-center justify-center rounded-full text-mut hover:bg-surface2 hover:text-ink sm:opacity-0 sm:group-hover:opacity-100"
        >
          <Icon name="more" size={18} />
        </button>
        {menuOpen && (
          <div ref={menuRef} className="absolute right-0 top-9 z-10 w-44 rounded-xl border border-line bg-surface p-1 shadow-card">
            <button
              type="button"
              aria-label={isBookmarked ? `Remove bookmark for ayah ${index + 1}` : `Bookmark ayah ${index + 1}`}
              aria-pressed={isBookmarked}
              className="flex min-h-12 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-surface2"
              onClick={(event) => {
                event.stopPropagation();
                onToggleBookmark(bookmark);
                closeMenu();
              }}
            >
              <Icon name="pin" size={16} /> {isBookmarked ? 'Remove bookmark' : 'Bookmark ayah'}
            </button>
            <button
              type="button"
              aria-pressed={memorized?.memorized ?? false}
              className="flex min-h-12 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-surface2"
              onClick={(event) => {
                event.stopPropagation();
                dispatch(toggleMemorizedAyah(bookmark));
                closeMenu();
              }}
            >
              <Icon name={memorized?.memorized ? 'check' : 'book'} size={16} />
              {memorized?.memorized ? 'Memorized' : 'Mark as memorized'}
            </button>
            <button
              type="button"
              aria-label="Close actions"
              className="absolute right-1 top-1 rounded-full p-1 text-mut hover:bg-surface2 hover:text-ink"
              onClick={closeMenu}
            >
              <Icon name="close" size={15} />
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-surface2"
              onClick={(event) => {
                event.stopPropagation();
                onSelect();
                closeMenu();
              }}
            >
              <Icon name="play" size={15} /> Play from here
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-surface2"
              onClick={(event) => {
                event.stopPropagation();
                copyArabic();
              }}
            >
              <Icon name="stack" size={15} /> Copy Arabic
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-surface2"
              onClick={(event) => {
                event.stopPropagation();
                setShareOpen(true);
                closeMenu();
              }}
            >
              <Icon name="share" size={15} /> Share as image
            </button>
          </div>
        )}
      </div>
    </div>
    <ShareCardModal
      open={shareOpen}
      onClose={() => setShareOpen(false)}
      content={{
        surahName: bookmark.surahName,
        surahNumber: bookmark.surah,
        ayahFrom: bookmark.ayah,
        arabic: displayedArabic,
        translation: bookmark.translation,
      }}
    />
    </>
  );
}

function BookView({
  pages,
  pageIndex,
  surah,
  arClass,
  arFontPx,
  showArabic,
  showTranslation,
  showTransliteration,
  showVerseNumbers,
  translationFontSize,
  lineSpacing,
  scriptType,
  indoPakAyahs,
  isActiveSession,
  isPlaying,
  activeAyah,
  onSelect,
  onOpenFocus,
  bookmarkedIds,
  onToggleBookmark,
  onTurn,
}: {
  pages: number[][];
  pageIndex: number;
  surah: SurahFull;
  arClass: string;
  arFontPx: number;
  showArabic: boolean;
  showTranslation: boolean;
  showTransliteration: boolean;
  showVerseNumbers: boolean;
  translationFontSize: number;
  lineSpacing: number;
  scriptType: SettingsState['scriptType'];
  indoPakAyahs: string[];
  isActiveSession: boolean;
  isPlaying: boolean;
  activeAyah: number;
  onSelect: (index: number) => void;
  onOpenFocus: (index: number) => void;
  bookmarkedIds: Set<string>;
  onToggleBookmark: (bookmark: Omit<AyahBookmark, 'note' | 'createdAt'>) => void;
  onTurn: (direction: -1 | 1) => void;
}) {
  const dragStart = useRef<number | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') onTurn(1);
      if (event.key === 'ArrowRight') onTurn(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onTurn]);

  const page = pages[pageIndex] ?? [];
  return (
    <div className="mt-2">
      <div
        className="relative touch-pan-y overflow-hidden rounded-2xl border border-line bg-surface px-3 py-2 shadow-card"
        onPointerDown={(event) => {
          dragStart.current = event.clientX;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerUp={(event) => {
          if (dragStart.current === null) return;
          const delta = event.clientX - dragStart.current;
          dragStart.current = null;
          if (Math.abs(delta) < 40) return;
          onTurn(delta < 0 ? 1 : -1);
        }}
        onPointerCancel={() => {
          dragStart.current = null;
        }}
      >
        <div key={pageIndex} className="anim-fade min-h-[55vh]">
          {page.map((index) => {
            const ayah = surah.ayahs[index];
            return (
              <AyahBlock
                key={ayah.g}
                ayah={ayah}
                arabicText={scriptType === 'indopak' ? indoPakAyahs[index] ?? ayah.ar : ayah.ar}
                index={index}
                bookmark={{ id: `${surah.number}:${ayah.i}`, surah: surah.number, ayah: ayah.i, surahName: surah.englishName, arabic: scriptType === 'indopak' ? indoPakAyahs[index] ?? ayah.ar : ayah.ar, translation: ayah.tr }}
                isBookmarked={bookmarkedIds.has(`${surah.number}:${ayah.i}`)}
                onToggleBookmark={onToggleBookmark}
                arClass={arClass}
                arFontPx={arFontPx}
                showArabic={showArabic}
                showTranslation={showTranslation}
                showTransliteration={showTransliteration}
                showVerseNumbers={showVerseNumbers}
                translationFontSize={translationFontSize}
                lineSpacing={lineSpacing}
                sounding={isActiveSession && isPlaying && activeAyah === index}
                selected={activeAyah === index}
                onSelect={() => onSelect(index)}
                onOpenFocus={() => onOpenFocus(index)}
              />
            );
          })}
        </div>
        <button
          type="button"
          aria-label="Previous page"
          onClick={() => onTurn(-1)}
          className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-surface2/80 text-mut hover:text-ink"
        >
          <Icon name="chevronRight" size={16} className="rotate-180" />
        </button>
        <button
          type="button"
          aria-label="Next page"
          onClick={() => onTurn(1)}
          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-surface2/80 text-mut hover:text-ink"
        >
          <Icon name="chevronRight" size={16} />
        </button>
      </div>
      <div className="mt-2 text-center text-xs text-mut">Page {Math.min(pageIndex + 1, pages.length)} of {pages.length}</div>
    </div>
  );
}

/* ============================ sticky bar ============================ */
function ReaderBar({
  onBack,
  timer,
  onOptions,
}: {
  onBack: () => void;
  timer: string;
  onOptions: () => void;
}) {
  return (
    <div className="safe-t reader-toolbar sticky top-0 z-30 -mx-4 flex items-center gap-2 border-b border-line bg-canvas/85 px-3 py-2 backdrop-blur sm:px-4">
      <button
        type="button"
        onClick={onBack}
        aria-label="Go back"
        title="Go back"
        className="pressable inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-2xl font-medium text-mut hover:bg-surface2 hover:text-ink"
      >
        ←
      </button>
      <div className="flex-1" />
      <div className="flex shrink-0 flex-col items-center">
        <button
          type="button"
          aria-label="Reading settings"
          onClick={onOptions}
          className="pressable flex h-10 w-10 items-center justify-center rounded-full p-2 text-mut transition-colors hover:bg-surface2 hover:text-ink"
        >
          <span aria-hidden="true" className="text-2xl leading-none">⋮</span>
        </button>
        <div className="inline-flex items-center gap-1 text-[11px] font-medium tabular-nums text-mut" aria-label={`Reading session ${timer}`}>
          <Icon name="clock" size={12} />
          <span>{timer}</span>
        </div>
      </div>
    </div>
  );
}

function ReaderMediaHud({
  visible,
  isPlaying,
  onPlaybackSettings,
  onBeginningOrPreviousChapter,
  onPrevious,
  onPlay,
  onNext,
  onEndOrNextChapter,
}: {
  visible: boolean;
  isPlaying: boolean;
  onPlaybackSettings: () => void;
  onBeginningOrPreviousChapter: () => void;
  onPrevious: () => void;
  onPlay: () => void;
  onNext: () => void;
  onEndOrNextChapter: () => void;
}) {
  return (
    <div className={`reader-hud-position ${visible ? 'reader-hud-visible' : 'reader-hud-hidden'}`}>
      <div className="reader-hud-grid mx-auto grid w-full max-w-xl grid-cols-6 items-center gap-1 rounded-full border border-line/70 bg-surface/90 px-2 py-2 shadow-card backdrop-blur-xl sm:gap-2 sm:px-3">
        <HudButton label="Go to beginning or previous chapter" onClick={onBeginningOrPreviousChapter}>
          <span className="text-xs font-bold" aria-hidden="true">|‹</span>
        </HudButton>
        <HudButton label="Previous ayah" onClick={onPrevious}>
          <Icon name="chevronRight" size={19} className="rotate-180" />
        </HudButton>
        <button
          type="button"
          onClick={onPlay}
          aria-label={isPlaying ? 'Pause recitation' : 'Play recitation'}
          className="reader-hud-play-button pressable mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent text-onaccent shadow-card transition-transform hover:scale-105 sm:h-14 sm:w-14"
        >
          <Icon name={isPlaying ? 'pause' : 'play'} size={23} />
        </button>
        <HudButton label="Next ayah" onClick={onNext}>
          <Icon name="chevronRight" size={19} />
        </HudButton>
        <HudButton label="Go to end or next chapter" onClick={onEndOrNextChapter}>
          <span className="text-xs font-bold" aria-hidden="true">›|</span>
        </HudButton>
        <HudButton label="Playback settings" onClick={onPlaybackSettings}>
          <Icon name="moreVertical" size={19} />
        </HudButton>
      </div>
    </div>
  );
}

function HudButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="reader-hud-secondary pressable mx-auto flex h-10 w-10 items-center justify-center rounded-full text-mut transition-colors hover:bg-surface2 hover:text-ink sm:h-11 sm:w-11"
    >
      {children}
    </button>
  );
}

function ReaderPlaybackSettings({
  open,
  onClose,
  settings,
  playerState,
  onReciterChange,
  onRepeat,
  currentAyah,
  ayahCount,
  onJumpToAyah,
}: {
  open: boolean;
  onClose: () => void;
  settings: SettingsState;
  playerState: PlayerState;
  onReciterChange: (reciter: string) => void;
  onRepeat: () => void;
  currentAyah: number;
  ayahCount: number;
  onJumpToAyah: (ayah: number) => void;
}) {
  const [ayahInput, setAyahInput] = useState(String(currentAyah));
  useEffect(() => {
    if (open) setAyahInput(String(currentAyah));
  }, [open, currentAyah]);

  const goToAyah = () => {
    const ayah = Number(ayahInput);
    if (Number.isInteger(ayah) && ayah >= 1 && ayah <= ayahCount) onJumpToAyah(ayah);
  };

  return (
    <Modal open={open} onClose={onClose} title="Playback settings" size="md" variant="frosted">
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-mut">Reciter</span>
        <select
          value={playerState.reciter || settings.defaultReciter}
          onChange={(event) => onReciterChange(event.target.value)}
          className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {RECITERS.map((reciter) => (
            <option key={reciter.id} value={reciter.id}>{reciter.label}</option>
          ))}
        </select>
      </label>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-ink">Playback speed</span>
        <button
          type="button"
          onClick={() => player.cyclePlaybackRate()}
          className="rounded-full bg-surface2 px-4 py-2 text-sm font-semibold tabular-nums text-ink"
        >
          {playerState.playbackRate}×
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={onRepeat} className="rounded-xl bg-surface2 px-3 py-2.5 text-sm font-medium text-ink">
          Repeat: {playerState.repeat}
        </button>
        <button type="button" onClick={() => player.setLoopSurah(!playerState.loopSurah)} className="rounded-xl bg-surface2 px-3 py-2.5 text-sm font-medium text-ink">
          Repeat chapter: {playerState.loopSurah ? 'On' : 'Off'}
        </button>
      </div>
      <form
        className="mt-4 border-t border-line pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          goToAyah();
        }}
      >
        <label htmlFor="reader-ayah-jump" className="mb-1.5 block text-xs font-medium text-mut">
          Go to ayah (1–{ayahCount})
        </label>
        <div className="flex gap-2">
          <input
            id="reader-ayah-jump"
            type="number"
            min={1}
            max={ayahCount}
            step={1}
            value={ayahInput}
            onChange={(event) => setAyahInput(event.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm tabular-nums text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          <button type="submit" className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-onaccent">
            Go
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ============================ options modal ============================ */
function OptionRow({
  label,
  hint,
  control,
}: {
  label: string;
  hint?: string;
  control: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <div className="text-sm font-medium text-ink">{label}</div>
        {hint && <div className="text-xs text-mut">{hint}</div>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-mut">{children}</div>
  );
}

function ReaderOptions({
  open,
  onClose,
  settings,
  dispatch,
  viewMode,
  onViewModeChange,
  onAddToPlaylist,
}: {
  open: boolean;
  onClose: () => void;
  settings: SettingsState;
  dispatch: ReturnType<typeof useAppDispatch>;
  viewMode: 'list' | 'book';
  onViewModeChange: (mode: 'list' | 'book') => void;
  onAddToPlaylist: () => void;
}) {
  const theme = useAppSelector((state) => state.theme);
  const streak = useAppSelector((state) => state.progress.progression.currentStreak);
  const navigate = useNavigate();
  const allPreviews: { mode: ThemeMode; label: string; background: string; surface: string; ink: string; muted: string; line: string }[] = [
    { mode: 'light', label: 'Light', background: '#f1f6f3', surface: '#ffffff', ink: '#142520', muted: '#6d7d77', line: '#dbe6e1' },
    { mode: 'dark', label: 'Dark', background: '#0a120f', surface: '#101d19', ink: '#e9f1ee', muted: '#8ba09a', line: '#1f332c' },
    { mode: 'system', label: 'Auto', background: 'linear-gradient(135deg, #f1f6f3 0 49%, #101d19 51% 100%)', surface: '#ffffff', ink: '#142520', muted: '#6d7d77', line: '#dbe6e1' },
    { mode: 'sepia', label: 'Sepia', background: '#f2e7cf', surface: '#fbf3e3', ink: '#3b3022', muted: '#786b58', line: '#d6c6a8' },
    { mode: 'midnight', label: 'Midnight', background: '#070f1d', surface: '#0d1a2e', ink: '#e6eefb', muted: '#8296b8', line: '#1b2c48' },
    { mode: 'emerald', label: 'Emerald', background: '#eaf4ec', surface: '#f7fcf8', ink: '#10241a', muted: '#5f7a66', line: '#cfe4d5' },
  ];
  // The gated reading themes only appear once the 100-day milestone is held,
  // unless one of them is the theme already in use.
  const previews = allPreviews.filter((preview) =>
    isThemeSelectable(preview.mode, streak, theme.mode === preview.mode),
  );

  return (
    <Modal open={open} onClose={onClose} title="Reading settings" variant="frosted">
      <SectionLabel>Playlist</SectionLabel>
      <button
        type="button"
        onClick={onAddToPlaylist}
        className="mt-1 flex w-full items-center gap-3 rounded-xl border border-line bg-surface2 px-3 py-2.5 text-left pressable hover:border-accent/40"
      >
        <Icon name="plus" size={16} className="shrink-0 text-accent" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink">Add this surah to a playlist</span>
          <span className="block text-[11px] text-mut">Queue it for later listening or memorisation.</span>
        </span>
        <Icon name="chevronRight" size={16} className="shrink-0 text-mut" />
      </button>

      <SectionLabel>Appearance</SectionLabel>
      <div className="grid grid-cols-2 gap-2 py-2">
        {previews.map((preview) => {
          const selected = theme.mode === preview.mode;
          return (
            <button
              key={preview.mode}
              type="button"
              aria-pressed={selected}
              onClick={() => dispatch(setThemeMode(preview.mode))}
              className={`relative min-w-0 rounded-xl border p-1.5 text-left ${selected ? 'border-accent ring-2 ring-accent/40' : 'border-line'}`}
            >
              <div className="flex aspect-[4/5] flex-col overflow-hidden rounded-lg p-1.5" style={{ background: preview.background, color: preview.ink }}>
                <div className="flex-1 rounded-md border p-1.5" style={{ backgroundColor: preview.surface, borderColor: preview.line }}>
                  <div dir="rtl" className="text-[9px] leading-relaxed">بِسْمِ اللَّهِ الرَّحْمَٰنِ</div>
                  <div className="mt-1 h-1 rounded-full" style={{ backgroundColor: preview.muted, opacity: 0.5 }} />
                  <div className="mt-1 h-1 w-4/5 rounded-full" style={{ backgroundColor: preview.muted, opacity: 0.35 }} />
                </div>
              </div>
              <span className="mt-1 block text-center text-[11px] font-medium text-ink">{preview.label}</span>
              {selected && <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-onaccent"><Icon name="check" size={12} /></span>}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <SectionLabel>Accent</SectionLabel>
        <div className="flex items-center gap-2">
          {ACCENTS.map((accent) => {
            const selected = theme.accent === accent.id;
            return (
              <button
                key={accent.id}
                type="button"
                aria-label={`${accent.label} accent`}
                aria-pressed={selected}
                title={accent.label}
                onClick={() => dispatch(setAccentColor(accent.id))}
                className="flex h-12 w-12 items-center justify-center rounded-full transition-colors hover:bg-surface2"
              >
                <span className={`flex h-7 w-7 items-center justify-center rounded-full ${selected ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface' : ''}`} style={{ backgroundColor: accent.swatch }}>
                  {selected && <Icon name="check" size={14} className="text-white" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <SectionLabel>Arabic font size · {settings.arabicFontSize}px</SectionLabel>
      <div className="py-2">
        <Slider min={18} max={50} step={1} value={settings.arabicFontSize} onChange={(value) => dispatch(setArabicFontSize(value))} ariaLabel="Arabic font size" />
      </div>
      <div className="overflow-hidden rounded-xl bg-surface2 px-3 py-2 text-center text-ink" dir="rtl">
        <span className="ar-uthmani" style={{ fontSize: settings.arabicFontSize, lineHeight: settings.lineSpacing }}>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</span>
      </div>

      <SectionLabel>Translation font size · {settings.translationFontSize}px</SectionLabel>
      <div className="py-2">
        <Slider min={12} max={30} step={1} value={settings.translationFontSize} onChange={(value) => dispatch(setTranslationFontSize(value))} ariaLabel="Translation font size" />
      </div>

      <SectionLabel>Line spacing · {settings.lineSpacing.toFixed(1)}</SectionLabel>
      <div className="py-2">
        <Slider min={1.2} max={2.6} step={0.1} value={settings.lineSpacing} onChange={(value) => dispatch(setLineSpacing(value))} ariaLabel="Reading line spacing" />
      </div>

      <SectionLabel>Reading layout</SectionLabel>
      <div className="grid grid-cols-2 gap-2 py-2">
        {(['list', 'book'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            aria-pressed={viewMode === mode}
            onClick={() => onViewModeChange(mode)}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium capitalize ${viewMode === mode ? 'bg-accent/15 text-accent' : 'bg-surface2 text-ink'}`}
          >
            <Icon name={mode} size={16} /> {mode}
          </button>
        ))}
      </div>

      <SectionLabel>Show lines</SectionLabel>
      <div className="divide-y divide-line">
        <OptionRow label="Arabic" control={<Toggle checked={settings.showArabic} onChange={(value) => dispatch(setShowArabic(value))} label="Arabic" />} />
        <OptionRow label="Transliteration" control={<Toggle checked={settings.showTransliteration} onChange={(value) => dispatch(setShowTransliteration(value))} label="Transliteration" />} />
        <OptionRow label="Translation" control={<Toggle checked={settings.showTranslation} onChange={(value) => dispatch(setShowTranslation(value))} label="Translation" />} />
        <OptionRow label="Verse numbers" control={<Toggle checked={settings.showVerseNumbers} onChange={(value) => dispatch(setShowVerseNumbers(value))} label="Verse numbers" />} />
        <OptionRow label="Focus mode" control={<Toggle checked={settings.readingMode} onChange={(value) => dispatch(setReadingMode(value))} label="Focus mode" />} />
      </div>

      <button type="button" onClick={() => { onClose(); navigate('/settings'); }} className="mt-3 w-full border-t border-line pt-3 text-left text-sm font-semibold text-accent">
        More settings <Icon name="forward" size={15} className="ml-1 inline" />
      </button>
    </Modal>
  );
}
