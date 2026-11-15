import { useSearchParams } from 'react-router-dom';
import { useAppSelector } from '../store';
import { totalLikedItems } from '../store/slices/likesSlice';
import { PageHeader } from '../components/ui/common';
import { Icon } from '../components/ui/Icon';
import FavoritesPage from './FavoritesPage';
import PlaylistsPage from './PlaylistsPage';
import DownloadsPage from './DownloadsPage';
import MemorizedAyahsPage from './MemorizedAyahsPage';

type LibrarySection = 'favorites' | 'playlists' | 'downloads' | 'memorized';

const SECTIONS: Array<{ id: LibrarySection; label: string; icon: 'heart' | 'list' | 'download' | 'book' }> = [
  { id: 'favorites', label: 'Favorites', icon: 'heart' },
  { id: 'playlists', label: 'Playlists', icon: 'list' },
  { id: 'downloads', label: 'Downloads', icon: 'download' },
  { id: 'memorized', label: 'Memorized', icon: 'book' },
];

export default function LibraryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const likes = useAppSelector((state) => state.likes);
  const bookmarks = useAppSelector((state) => state.bookmarks.items.length);
  const memorizedCount = useAppSelector((state) => state.memorized.items.filter((item) => item.memorized).length);
  const sectionParam = searchParams.get('section');
  const section: LibrarySection = SECTIONS.some((item) => item.id === sectionParam)
    ? (sectionParam as LibrarySection)
    : 'favorites';
  const favoriteCount = totalLikedItems(likes) + bookmarks;

  const selectSection = (next: LibrarySection) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'favorites') params.delete('section');
    else params.set('section', next);
    if (next !== 'favorites') {
      params.delete('tab');
      params.delete('q');
    }
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="page-enter">
      <PageHeader title="Library" subtitle="Your favorites, memorized ayahs, playlists and offline recitations." />

      <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl border border-line bg-surface p-1 sm:grid-cols-4" role="tablist" aria-label="Library sections">
        {SECTIONS.map((item) => {
          const active = section === item.id;
          const label = item.id === 'favorites' && favoriteCount > 0
            ? `${item.label} · ${favoriteCount}`
            : item.id === 'memorized' && memorizedCount > 0
              ? `${item.label} · ${memorizedCount}`
              : item.label;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => selectSection(item.id)}
              className={`flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-semibold transition-colors ${active ? 'bg-accent text-onaccent' : 'text-mut hover:bg-surface2 hover:text-ink'}`}
            >
              <Icon name={item.icon} size={15} />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel" aria-label={SECTIONS.find((item) => item.id === section)?.label}>
        {section === 'favorites' && <FavoritesPage embedded />}
        {section === 'playlists' && <PlaylistsPage />}
        {section === 'downloads' && <DownloadsPage />}
        {section === 'memorized' && <MemorizedAyahsPage />}
      </div>
    </div>
  );
}
