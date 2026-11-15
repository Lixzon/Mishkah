import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Outlet } from 'react-router-dom';
import { useAppSelector } from '../../store';
import { Sidebar } from './nav';
import { BottomNav } from './BottomNav';
import { MiniPlayer } from './MiniPlayer';
import { TopBar } from './TopBar';

export function AppLayout() {
  const readingMode = useAppSelector((s) => s.settings.readingMode);
  const location = useLocation();
  const isReaderRoute = /^\/surah(?:\/|$)/.test(location.pathname);

  // scroll the window to the top on navigation (reader restores its own position)
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname]);

  return (
    <div className={`min-h-dvh bg-canvas text-ink ${isReaderRoute ? 'reader-app-shell' : ''}`}>
      {!readingMode && <Sidebar />}
      <div className={readingMode ? '' : 'md:pl-60'}>
        {!isReaderRoute && <TopBar />}
        <main
          className={isReaderRoute
            ? 'min-h-dvh w-full px-4 pt-0 pb-0'
            : `mx-auto w-full max-w-3xl px-4 ${readingMode ? 'safe-t pt-6' : 'pt-4'} ${readingMode ? 'layout-bottom-reading' : 'layout-bottom-default'}`}
        >
          <Outlet />
        </main>
      </div>
      {!isReaderRoute && <MiniPlayer />}
      {!isReaderRoute && <BottomNav />}
    </div>
  );
}
