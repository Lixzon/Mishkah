import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../store';
import { player } from '../../audio/controller';
import { useQuran } from '../../data/QuranProvider';
import { formatTime, surahNumberToArabic } from '../../lib/utils';
import { reciterById } from '../../lib/constants';
import { clearSessionFlag } from '../../lib/sessionFlags';
import { Icon } from '../ui/Icon';
import { SurahArtwork } from '../ui/SurahArtwork';
import { PlayerSettingsSheet } from '../player/PlayerSettingsSheet';
import { VerseRangeSheet } from '../player/VerseRangeSheet';

/** Glass dock player shown above the bottom navigation. */
export function MiniPlayer() {
  const p = useAppSelector((s) => s.player);
  const readingMode = useAppSelector((s) => s.settings.readingMode);
  const quran = useQuran();
  const navigate = useNavigate();
  const location = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);

  const surah = p.surah;
  const meta = surah ? quran.surahById(surah) : undefined;
  if (!surah || !meta) return null;

  const reciter = reciterById(p.reciter);
  const progress = p.duration > 0 ? Math.min(100, (p.currentTime / p.duration) * 100) : 0;
  const isReader = location.pathname === `/surah/${surah}`;
  const positionClass = isReader
    ? readingMode ? 'mini-player-reader-reading' : 'mini-player-reader'
    : readingMode ? 'mini-player-reading' : 'mini-player-default';
  const title = p.ayah === null ? meta.englishName : `${meta.englishName} · ${surah}:${p.ayah + 1}`;
  const controlClass =
    'pressable flex h-7 w-7 items-center justify-center rounded-full text-mut transition-colors hover:bg-surface2 hover:text-ink sm:h-8 sm:w-8';

  const openRange = () => {
    setSettingsOpen(false);
    clearSessionFlag('hifz_prompt_dismissed_session');
    setRangeOpen(true);
  };

  return (
    <div
      className={`mini-player-position pointer-events-none fixed inset-x-0 z-40 md:left-60 ${positionClass}`}
    >
      <div
        onClick={() => navigate('/player')}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            navigate('/player');
          }
        }}
        className="glass-player mini-player-capsule anim-fade-up pointer-events-auto relative mx-auto flex w-[calc(100%-20px)] max-w-2xl cursor-pointer items-center gap-2 overflow-hidden rounded-full py-1.5 pl-2.5 pr-1.5 sm:gap-3 sm:py-2 sm:pl-3.5 sm:pr-2.5"
        role="button"
        tabIndex={0}
        aria-label={`Open player for ${title}`}
      >
        {/* hairline progress rail hugging the top edge */}
        <div className="pointer-events-none absolute inset-x-10 top-0 h-[2px] overflow-hidden rounded-full bg-surface2/70">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mini-player-artwork relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface2 text-accent">
          <SurahArtwork surah={surah} className="opacity-90" />
          <span className="relative text-sm font-semibold">{surahNumberToArabic(surah)}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold leading-tight text-ink sm:text-sm">
            {title}
          </div>
          <div className="truncate text-[10.5px] leading-tight text-mut sm:text-[11px]">
            {p.isPlaying ? (
              <span className="inline-flex items-center gap-1.5 text-accent">
                <span className="eq"><span /><span /><span /></span>
                {reciter.label}
              </span>
            ) : <span>Paused · {reciter.label}</span>}
            {p.hifzPause && <span className="ml-1.5 text-accent/80">· Hifz pause</span>}
          </div>
        </div>

        <div
          className="flex shrink-0 items-center"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            aria-label="Previous chapter"
            title="Previous chapter"
            className={controlClass}
            onClick={() => player.previousChapter()}
          >
            <Icon name="prev" size={17} />
          </button>
          <button
            type="button"
            aria-label="Previous verse"
            title="Previous verse"
            className={controlClass}
            onClick={() => player.previousVerse()}
          >
            <Icon name="back" size={16} />
          </button>
          <button
            type="button"
            aria-label={p.isPlaying ? 'Pause playback' : 'Play playback'}
            title={p.isPlaying ? 'Pause' : 'Play'}
            className="pressable mx-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-accent text-onaccent shadow-card sm:h-10 sm:w-10"
            onClick={() => player.togglePlay()}
          >
            <Icon name={p.isPlaying ? 'pause' : 'play'} size={18} />
          </button>
          <button
            type="button"
            aria-label="Next verse"
            title="Next verse"
            className={controlClass}
            onClick={() => player.nextVerse()}
          >
            <Icon name="forward" size={16} />
          </button>
          <button
            type="button"
            aria-label="Next chapter"
            title="Next chapter"
            className={controlClass}
            onClick={() => player.next()}
          >
            <Icon name="next" size={17} />
          </button>
          <button
            type="button"
            aria-label="Player settings"
            title="Player settings"
            aria-haspopup="dialog"
            className={`${controlClass} ml-0.5`}
            onClick={() => setSettingsOpen(true)}
          >
            <Icon name="moreVertical" size={18} />
          </button>
        </div>
      </div>

      <PlayerSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSetRange={openRange}
      />
      <VerseRangeSheet open={rangeOpen} onClose={() => setRangeOpen(false)} />
    </div>
  );
}

/** Thin progress text helper (shared). */
export function useTimeHelpers() {
  return { formatTime };
}
