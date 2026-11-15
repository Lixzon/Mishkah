import MishkaArchivesPage from './pages/MishkaArchivesPage';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { lazy, Suspense } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { useAppSelector } from './store';
import { QuranProvider } from './data/QuranProvider';
import { ThemeManager } from './components/layout/ThemeManager';
import { AppLayout } from './components/layout/AppLayout';
import { ToastHost } from './components/ui/ToastHost';
import { ErrorBoundary } from './components/ErrorBoundary';
import { APP_NAME, APP_TAGLINE } from './lib/constants';
import { islamicQuoteOfTheDay } from './data/quotes';
import { todayKey } from './lib/progression';
import { ProgressionHost } from './components/layout/ProgressionHost';
import { VoiceSearchProvider } from './components/search/VoiceSearchModal';
import { VoiceMatchDrawer } from './components/VoiceMatchDrawer';
import { DeepLinkHost } from './components/DeepLinkHost';
import { CloudSyncProvider } from './components/CloudSync';

const LibraryPage = lazy(() => import('./pages/LibraryPage'));
const SurahReader = lazy(() => import('./pages/SurahReader'));
const PlaylistsPage = lazy(() => import('./pages/PlaylistsPage'));
const PlaylistDetailPage = lazy(() => import('./pages/PlaylistDetailPage'));
const NowPlayingPage = lazy(() => import('./pages/NowPlayingPage'));
const GuidancePage = lazy(() => import('./pages/GuidancePage'));
const ProgressPage = lazy(() => import('./pages/ProgressPage'));
const DownloadsPage = lazy(() => import('./pages/DownloadsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const SupportPage = lazy(() => import('./pages/SupportPage'));
const DiagnosticsPage = lazy(() => import('./pages/DiagnosticsPage'));
const MishkahAssistantPage = lazy(() => import('./pages/MishkahAssistantPage'));
const QuotesPage = lazy(() => import('./pages/QuotesPage'));
const StoriesPage = lazy(() => import('./pages/StoriesPage'));
const MishkaLibraryPage = lazy(() => import('./pages/MishkaLibraryPage'));
const MishkaCommunityPage = lazy(() => import('./pages/MishkaCommunityPage'));
const MishkaGuidancePage = lazy(() => import('./pages/MishkaGuidancePage'));

const MishkahSettings = lazy(() => import('./components/MishkahSettings'));

export default function App() {
  const { pathname } = useLocation();
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const updateSWRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    document.title = pathname.startsWith('/surah/')
      ? `Reading · ${APP_NAME}`
      : `${APP_NAME} — ${APP_TAGLINE}`;
  }, [pathname]);

  useEffect(() => {
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh: () => setUpdateAvailable(true),
      onOfflineReady: () => setOfflineReady(true),
    });
    updateSWRef.current = updateSW;
  }, []);

  const applyUpdate = () => {
    setUpdateAvailable(false);
    void updateSWRef.current?.(true);
  };

  return (
    <ErrorBoundary>
      <QuranProvider>
        <VoiceSearchProvider>
          <ThemeManager />
          <CloudSyncProvider />
          {offlineReady && (
            <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3">
              <div className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink shadow-lg shadow-black/10">
                Manāra is ready to work offline.
              </div>
            </div>
          )}
          {updateAvailable && (
            <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-3">
              <div className="flex max-w-md flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-lg shadow-black/10">
                <div className="text-sm text-ink">
                  <span className="font-semibold">Update ready.</span> A new Manāra version is available.
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <button type="button" onClick={applyUpdate} className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-onaccent pressable">
                    Update now
                  </button>
                  <button type="button" onClick={() => setUpdateAvailable(false)} className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink pressable">
                    Later
                  </button>
                </div>
              </div>
            </div>
          )}
          <Suspense fallback={<div className="p-6 text-center text-sm text-muted" role="status" aria-live="polite">Loading Manāra…</div>}>
            <Routes>
              <Route element={<AppLayout />}>
                <Route index element={<Navigate to="/journey" replace />} />
                <Route path="journey" element={null} />
                <Route path="quran" element={null} />
                <Route path="library" element={<LibraryPage />} />
                <Route path="mishka/library" element={<MishkaLibraryPage />} />
                <Route path="mishka/community" element={<MishkaCommunityPage />} />
                <Route path="mishka/guidance" element={<MishkaGuidancePage />} />
                <Route path="mishka/archives" element={<MishkaArchivesPage />} />
                <Route path="mishka/favorites" element={<LibraryPage />} />
                
                <Route path="mishka/settings" element={<MishkahSettings />} />
                <Route path="surah/:number" element={<SurahReader />} />
                <Route path="playlists" element={<PlaylistsPage />} />
                <Route path="playlist/:id" element={<PlaylistDetailPage />} />
                <Route path="player" element={<NowPlayingPage />} />
                <Route path="guidance" element={<GuidancePage />} />
                <Route path="quotes" element={<QuotesPage />} />
                <Route path="stories" element={<StoriesPage />} />
                <Route path="favorites" element={<LegacyFavoritesRedirect />} />
                <Route path="bookmarks" element={<Navigate to="/library?tab=ayah&section=favorites" replace />} />
                <Route path="progress" element={<ProgressPage />} />
                <Route path="downloads" element={<DownloadsPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="support" element={<SupportPage />} />
                <Route path="diagnostics" element={<DiagnosticsPage />} />
                <Route path="mishkah" element={<MishkahAssistantPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Suspense>
          <ToastHost />
          <DeepLinkHost />
          <ReminderHost />
          <ProgressionHost />
          <VoiceMatchDrawer />
        </VoiceSearchProvider>
      </QuranProvider>
    </ErrorBoundary>
  );
}

function LegacyFavoritesRedirect() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  params.set('section', 'favorites');
  if (params.get('tab') === 'ayahs') params.set('tab', 'ayah');
  return <Navigate to={`/library?${params.toString()}`} replace />;
}

function ReminderHost() {
  const notifications = useAppSelector((s) => s.settings.notifications);
  const dailyActivity = useAppSelector((s) => s.progress.dailyActivity);

  useEffect(() => {
    const check = () => {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      const now = new Date();
      const date = todayKey();
      const [hour, minute] = notifications.reminderTime.split(':').map(Number);
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const reminderMinutes = (hour || 0) * 60 + (minute || 0);
      const show = (key: string, title: string, body: string, path: string) => {
        try {
          if (localStorage.getItem(`furqan:reminder:${key}:${date}`)) return;
        } catch {
          return;
        }

        const notify = async () => {
          try {
            const options = { body, tag: `furqan-${key}` };
            const registration = await navigator.serviceWorker?.getRegistration();
            if (registration) {
              if (!registration.active) return;
              await registration.showNotification(title, options);
            } else {
              const notification = new Notification(title, options);
              notification.onclick = () => {
                window.focus();
                window.location.href = path;
              };
            }
          } catch {
            // Notifications may be unavailable in restricted browser contexts.
          }
        };
        void notify();

        try {
          localStorage.setItem(`furqan:reminder:${key}:${date}`, '1');
        } catch {
          // ignore storage failures when the browser blocks writes
        }
      };

      if (currentMinutes < reminderMinutes) return;
      if (notifications.daily && !dailyActivity[date]) {
        const quote = islamicQuoteOfTheDay(new Date());
        show('daily', 'Your Quran streak is waiting! 🔥', quote.text, '/');
      }
      if (notifications.nightlyMulk) {
        show('mulk', 'Surah Al-Mulk', 'Take a few minutes with Surah Al-Mulk.', '/surah/67');
      }
      if (notifications.fridayKahf && now.getDay() === 5) {
        show('kahf', 'Friday reminder', 'Spend a moment with Surah Al-Kahf.', '/surah/18');
      }
    };
    check();
    const timer = window.setInterval(check, 60_000);
    return () => window.clearInterval(timer);
  }, [notifications, dailyActivity]);

  return null;
}

