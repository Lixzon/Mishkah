import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { APP_NAME } from '../../lib/constants';
import { useAppSelector } from '../../store';
import { useVoiceSearch } from '../search/VoiceSearchModal';
import { QuranSearchModal } from '../search/QuranSearchModal';
import { MihrabLogo } from '../ui/MihrabLogo';
import { StreakHub } from '../ui/StreakHub';
import { Icon } from '../ui/Icon';
import { clearSessionFlag } from '../../lib/sessionFlags';

/** Keep the streak and Quran search controls exclusive to the Read home screen. */
export function TopBar() {
  const readingMode = useAppSelector((s) => s.settings.readingMode);
  const location = useLocation();
  const voiceSearch = useVoiceSearch();
  const [searchOpen, setSearchOpen] = useState(false);
  const isReadHome = location.pathname === '/';
  if (readingMode) return null;

  return (
    <>
      <header className="safe-t sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-3 py-2 sm:px-4">
          {isReadHome ? (
            <>
              <div className="flex shrink-0 items-center gap-2">
                <StreakHub />
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={voiceSearch.open}
                  aria-label={voiceSearch.isListening ? 'Voice search is listening' : 'Search by reciting a verse'}
                  aria-pressed={voiceSearch.isListening}
                  title={voiceSearch.isListening ? 'Listening for a recited verse' : 'Search for a verse by reciting'}
                  className={`pressable relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border p-0 transition ${
                    voiceSearch.isListening
                      ? 'mic-header-listening border-fuchsia-300/60 bg-violet-600 text-white'
                      : 'border-line bg-surface2 text-muted hover:text-ink'
                  }`}
                >
                  <Icon name="mic" size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearSessionFlag('quran_search_dismissed_session');
                    setSearchOpen(true);
                  }}
                  aria-label="Search Quran chapters"
                  title="Search Quran chapters in Arabic or English"
                  className="pressable inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface2 text-muted transition hover:text-ink"
                >
                  <Icon name="search" size={18} />
                </button>
              </div>
            </>
          ) : (
            <div className="flex min-w-0 items-center gap-2">
              <MihrabLogo size={32} />
              <span className="truncate text-sm font-bold text-ink">{APP_NAME}</span>
            </div>
          )}
        </div>
      </header>
      {isReadHome && <QuranSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />}
    </>
  );
}
