import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store';
import { setBookmarkNote, removeBookmark, toggleAyahBookmark } from '../store/slices/bookmarksSlice';
import {
  isDuaLiked,
  isQuoteLiked,
  toggleLikedAyah,
  toggleLikedDua,
  toggleLikedQuote,
  toggleLikedSurah,
  type LikeKind,
  type LikesState,
} from '../store/slices/likesSlice';
import { useQuran } from '../data/QuranProvider';
import { DUAS } from '../data/duas';
import { QUOTES } from '../data/quotes';
import { useXpActions } from '../services/useLikes';
import { PageHeader, EmptyState } from '../components/ui/common';
import { Icon } from '../components/ui/Icon';
import { LikeButton } from '../components/ui/LikeButton';
import { Modal } from '../components/ui/Modal';
import { XpPill } from '../components/ui/XpPill';
import type { AyahBookmark } from '../store/slices/bookmarksSlice';

type Tab = LikeKind;

const TABS: Array<{ value: Tab; label: string; icon: 'stack' | 'book' | 'quote' | 'sparkle' }> = [
  { value: 'surah', label: 'Surahs', icon: 'stack' },
  { value: 'ayah', label: 'Ayahs', icon: 'book' },
  { value: 'dua', label: 'Duas', icon: 'sparkle' },
  { value: 'quote', label: 'Sayings', icon: 'quote' },
];

export default function FavoritesPage({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { copy, share } = useXpActions();
  const [searchParams, setSearchParams] = useSearchParams();
  const likes = useAppSelector((s) => s.likes);
  const bookmarks = useAppSelector((s) => s.bookmarks.items);
  const { surahs } = useQuran();

  const requested = searchParams.get('tab');
  const tab: Tab = TABS.some((entry) => entry.value === requested) ? (requested as Tab) : 'surah';
  const query = searchParams.get('q') ?? '';
  const [editing, setEditing] = useState<AyahBookmark | null>(null);
  const [note, setNote] = useState('');

  const setParam = (key: 'tab' | 'q', value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const counts: Record<Tab, number> = {
    surah: likes.surahs.length,
    ayah: likes.ayahs.length + bookmarks.length,
    dua: likes.duas.length,
    quote: likes.quotes.length,
  };

  const total = likes.surahs.length + likes.ayahs.length + likes.duas.length + likes.quotes.length;
  const needle = query.trim().toLowerCase();
  const matches = (...fields: string[]) =>
    !needle || fields.some((field) => field.toLowerCase().includes(needle));

  const likedSurahs = useMemo(
    () =>
      likes.surahs
        .map((number) => surahs?.find((surah) => surah.number === number) ?? null)
        .filter((meta): meta is NonNullable<typeof meta> => meta !== null)
        .filter((meta) => matches(meta.englishName, meta.englishNameTranslation, String(meta.number))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [likes.surahs, surahs, needle],
  );

  /** Liked ayahs and bookmarked ayahs are the same content, so they share one tab. */
  const ayahRows = useMemo(() => {
    const rows = new Map<string, { bookmark?: AyahBookmark; liked?: LikesState['ayahs'][number] }>();
    for (const item of bookmarks) rows.set(item.id, { ...rows.get(item.id), bookmark: item });
    for (const item of likes.ayahs) rows.set(item.id, { ...rows.get(item.id), liked: item });
    return [...rows.entries()]
      .map(([id, value]) => ({
        id,
        surah: value.bookmark?.surah ?? value.liked?.surah ?? 0,
        ayah: value.bookmark?.ayah ?? value.liked?.ayah ?? 0,
        surahName: value.bookmark?.surahName ?? value.liked?.surahName ?? '',
        arabic: value.bookmark?.arabic ?? value.liked?.arabic ?? '',
        translation: value.bookmark?.translation ?? value.liked?.translation ?? '',
        note: value.bookmark?.note ?? '',
        liked: !!value.liked,
        bookmarked: !!value.bookmark,
      }))
      .filter((row) => matches(row.surahName, row.translation, row.arabic, `${row.surah}:${row.ayah}`))
      .sort((a, b) => a.surah - b.surah || a.ayah - b.ayah);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookmarks, likes.ayahs, needle]);

  const likedDuas = useMemo(
    () =>
      likes.duas
        .map((id) => DUAS.find((dua) => dua.id === id) ?? null)
        .filter((dua): dua is NonNullable<typeof dua> => dua !== null)
        .filter((dua) => matches(dua.translation, dua.arabic, dua.source, dua.theme)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [likes.duas, needle],
  );

  const likedQuotes = useMemo(
    () =>
      likes.quotes
        .map((id) => QUOTES.find((quote) => quote.id === id) ?? null)
        .filter((quote): quote is NonNullable<typeof quote> => quote !== null)
        .filter((quote) => matches(quote.text, quote.by, quote.source)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [likes.quotes, needle],
  );

  const shareAyah = (row: { surah: number; ayah: number; surahName: string; arabic: string; translation: string }) =>
    share(
      { title: `${row.surahName} ${row.surah}:${row.ayah}`, text: `${row.arabic}\n\n${row.translation}\n\n— ${row.surahName} ${row.surah}:${row.ayah}` },
      'ayah',
    );

  return (
    <div className="page-enter">
      {!embedded && (
        <PageHeader
          title="Favourites"
          subtitle="Everything you have liked or saved, in one place."
          right={<XpPill />}
        />
      )}

      <div className="mb-3 grid grid-cols-4 gap-1 rounded-2xl bg-surface2 p-1" role="tablist" aria-label="Favourite types">
        {TABS.map((entry) => {
          const active = tab === entry.value;
          return (
            <button
              key={entry.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setParam('tab', entry.value)}
              className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold transition-colors ${active ? 'bg-accent text-onaccent' : 'text-mut hover:bg-surface hover:text-ink'}`}
            >
              <Icon name={entry.icon} size={15} />
              <span className="max-w-full truncate">
                {entry.label}{counts[entry.value] > 0 ? ` · ${counts[entry.value]}` : ''}
              </span>
            </button>
          );
        })}
      </div>

      <div className="relative mb-3">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mut">
          <Icon name="search" size={17} />
        </span>
        <input
          value={query}
          onChange={(event) => setParam('q', event.target.value)}
          placeholder="Search your favourites…"
          aria-label="Search favourites"
          className="w-full rounded-2xl border border-line bg-surface py-2.5 pl-10 pr-4 text-sm text-ink placeholder:text-mut focus:border-accent focus:outline-none"
        />
      </div>

      {total === 0 && bookmarks.length === 0 ? (
        <EmptyState
          icon="heart"
          title="Nothing saved yet"
          message="Tap the heart on a surah, ayah, dua or saying and it will appear here."
          action={
            <button type="button" onClick={() => navigate('/')} className="min-h-12 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-onaccent">
              Browse surahs
            </button>
          }
        />
      ) : (
        <div className="space-y-2">
          {tab === 'surah' &&
            (likedSurahs.length === 0 ? (
              <EmptyState icon="stack" title="No liked surahs" message={needle ? 'No liked surah matches that search.' : 'Like a whole chapter from its reader header or the browse list.'} />
            ) : (
              likedSurahs.map((meta) => (
                <Row key={meta.number} onClick={() => navigate(`/surah/${meta.number}`)}>
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/12 text-xs font-bold text-accent">
                      {meta.number}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-semibold text-ink">{meta.englishName}</div>
                      <div className="truncate text-xs text-mut">
                        {meta.englishNameTranslation} · {meta.numberOfAyahs} āyāt
                      </div>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-accent">Open</span>
                  <LikeButton
                    liked
                    label={`Remove ${meta.englishName} from favourites`}
                    onToggle={() => dispatch(toggleLikedSurah(meta.number))}
                  />
                </Row>
              ))
            ))}

          {tab === 'ayah' &&
            (ayahRows.length === 0 ? (
              <EmptyState icon="book" title="No liked ayahs" message={needle ? 'No saved ayah matches that search.' : 'Tap the heart beside an ayah in the reader.'} />
            ) : (
              ayahRows.map((row) => (
                <article key={row.id} className="rounded-2xl border border-line bg-surface p-3.5">
                  <button
                    type="button"
                    onClick={() => navigate(`/surah/${row.surah}?ayah=${row.ayah}`)}
                    className="block w-full text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-accent/12 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-accent">
                        {row.surah}:{row.ayah}
                      </span>
                      <span className="min-w-0 truncate text-sm font-semibold text-ink">{row.surahName}</span>
                      {row.bookmarked && !row.liked && <span className="text-[11px] text-mut">bookmark</span>}
                      <Icon name="forward" size={15} className="ml-auto shrink-0 text-mut" />
                    </div>
                    <p lang="ar" dir="rtl" className="ar-uthmani mt-3 text-right text-2xl leading-loose text-ink">
                      {row.arabic}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-ink2">{row.translation}</p>
                  </button>

                  {row.note && (
                    <p className="mt-3 rounded-lg border-l-2 border-accent bg-accent/8 px-3 py-2 text-sm leading-relaxed text-ink">
                      {row.note}
                    </p>
                  )}

                  <div className="mt-3 flex items-center justify-end gap-1 border-t border-line pt-2">
                    <button
                      type="button"
                      aria-label={row.note ? 'Edit note' : 'Add note'}
                      title={row.note ? 'Edit note' : 'Add note'}
                      onClick={() => {
                        setEditing({
                          id: row.id,
                          surah: row.surah,
                          ayah: row.ayah,
                          surahName: row.surahName,
                          arabic: row.arabic,
                          translation: row.translation,
                          note: row.note,
                          createdAt: Date.now(),
                        });
                        setNote(row.note);
                      }}
                      className="flex h-11 items-center gap-1 rounded-full px-3 text-xs font-medium text-mut pressable hover:bg-surface2 hover:text-ink"
                    >
                      <Icon name="edit" size={16} /> Note
                    </button>
                    <button
                      type="button"
                      aria-label="Copy ayah"
                      title="Copy ayah"
                      onClick={() => void copy(`${row.arabic}\n\n${row.translation}\n\n— ${row.surahName} ${row.surah}:${row.ayah}`, 'ayah')}
                      className="flex h-11 items-center gap-1 rounded-full px-3 text-xs font-medium text-mut pressable hover:bg-surface2 hover:text-ink"
                    >
                      <Icon name="clipboard" size={16} /> Copy
                    </button>
                    <button
                      type="button"
                      aria-label="Share ayah"
                      title="Share ayah"
                      onClick={() => void shareAyah(row)}
                      className="flex h-11 items-center gap-1 rounded-full px-3 text-xs font-medium text-mut pressable hover:bg-surface2 hover:text-ink"
                    >
                      <Icon name="share" size={16} /> Share
                    </button>
                    {row.bookmarked && (
                      <button
                        type="button"
                        aria-label="Remove bookmark"
                        title="Remove bookmark"
                        onClick={() => dispatch(removeBookmark(row.id))}
                        className="flex h-11 items-center rounded-full px-3 text-xs font-medium text-mut pressable hover:bg-danger/10 hover:text-danger"
                      >
                        <Icon name="pin" size={16} />
                      </button>
                    )}
                    <LikeButton
                      liked={row.liked}
                      label={row.liked ? `Remove ayah ${row.surah}:${row.ayah} from favourites` : `Add ayah ${row.surah}:${row.ayah} to favourites`}
                      onToggle={() =>
                        dispatch(
                          toggleLikedAyah({
                            id: row.id,
                            surah: row.surah,
                            ayah: row.ayah,
                            surahName: row.surahName,
                            arabic: row.arabic,
                            translation: row.translation,
                          }),
                        )
                      }
                    />
                    {!row.bookmarked && (
                      <button
                        type="button"
                        aria-label="Add bookmark"
                        title="Add bookmark with a note"
                        onClick={() =>
                          dispatch(
                            toggleAyahBookmark({
                              id: row.id,
                              surah: row.surah,
                              ayah: row.ayah,
                              surahName: row.surahName,
                              arabic: row.arabic,
                              translation: row.translation,
                            }),
                          )
                        }
                        className="flex h-11 items-center rounded-full px-3 text-xs font-medium text-mut pressable hover:bg-surface2 hover:text-ink"
                      >
                        <Icon name="pin" size={16} />
                      </button>
                    )}
                  </div>
                </article>
              ))
            ))}

          {tab === 'dua' &&
            (likedDuas.length === 0 ? (
              <EmptyState icon="sparkle" title="No liked duas" message={needle ? 'No liked dua matches that search.' : 'Tap the heart on a dua in Sayings & Quotes.'} />
            ) : (
              likedDuas.map((dua) => (
                <Card
                  key={dua.id}
                  title={dua.theme}
                  arabic={dua.arabic}
                  body={dua.translation}
                  footnote={dua.source}
                  liked={isDuaLiked(likes, dua.id)}
                  likeLabel={`Remove ${dua.translation.slice(0, 40)} from favourites`}
                  onLike={() => dispatch(toggleLikedDua(dua.id))}
                  onCopy={() => void copy(`${dua.arabic}\n${dua.transliteration}\n${dua.translation}\n— ${dua.source}`, 'dua')}
                  onShare={() => void share({ title: 'A dua', text: `${dua.arabic}\n${dua.transliteration}\n${dua.translation}\n— ${dua.source}` }, 'dua')}
                />
              ))
            ))}

          {tab === 'quote' &&
            (likedQuotes.length === 0 ? (
              <EmptyState icon="quote" title="No liked sayings" message={needle ? 'No liked saying matches that search.' : 'Tap the heart on a saying in Sayings & Quotes.'} />
            ) : (
              likedQuotes.map((quote) => (
                <Card
                  key={quote.id}
                  title={quote.themes[0] ?? 'saying'}
                  body={`“${quote.text}”`}
                  footnote={`${quote.by} · ${quote.source}`}
                  liked={isQuoteLiked(likes, quote.id)}
                  likeLabel={`Remove saying by ${quote.by} from favourites`}
                  onLike={() => dispatch(toggleLikedQuote(quote.id))}
                  onCopy={() => void copy(`${quote.text}\n— ${quote.by} (${quote.source})`, 'saying')}
                  onShare={() => void share({ title: 'A saying', text: `${quote.text}\n— ${quote.by} (${quote.source})` }, 'saying')}
                />
              ))
            ))}
        </div>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Bookmark note">
        <label htmlFor="favourite-note" className="mb-2 block text-sm font-medium text-ink">
          Personal reflection
        </label>
        <textarea
          id="favourite-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={5}
          maxLength={2000}
          className="w-full resize-y rounded-xl border border-line bg-surface2 p-3 text-sm leading-relaxed text-ink focus:border-accent focus:outline-none"
          placeholder="Add a note for this ayah…"
        />
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={() => setEditing(null)} className="min-h-12 rounded-full px-4 py-2 text-sm font-medium text-mut">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (editing) dispatch(setBookmarkNote({ id: editing.id, note: note.trim() }));
              setEditing(null);
            }}
            className="min-h-12 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-onaccent"
          >
            Save note
          </button>
        </div>
      </Modal>
    </div>
  );
}

/* ---------- small pieces ---------- */

function Row({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onClick();
      }}
      className="pressable flex w-full items-center gap-3 rounded-2xl border border-transparent bg-surface p-3 text-left"
    >
      {children}
    </div>
  );
}

function Card({
  title,
  arabic,
  body,
  footnote,
  liked,
  likeLabel,
  onLike,
  onCopy,
  onShare,
}: {
  title: string;
  arabic?: string;
  body: string;
  footnote: string;
  liked: boolean;
  likeLabel: string;
  onLike: () => void;
  onCopy: () => void;
  onShare: () => void;
}) {
  return (
    <article className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
          {title}
        </span>
        <LikeButton liked={liked} label={likeLabel} onToggle={onLike} />
      </div>
      {arabic && (
        <p lang="ar" dir="rtl" className="ar-uthmani mt-2 text-right text-2xl leading-loose text-ink">
          {arabic}
        </p>
      )}
      <p className="mt-2 text-sm leading-relaxed text-ink2">{body}</p>
      <p className="mt-2 text-xs text-mut">{footnote}</p>
      <div className="mt-3 flex justify-end gap-1 border-t border-line pt-2">
        <button type="button" onClick={onCopy} aria-label="Copy" title="Copy" className="flex h-11 items-center gap-1 rounded-full px-3 text-xs font-medium text-mut pressable hover:bg-surface2 hover:text-ink">
          <Icon name="clipboard" size={16} /> Copy
        </button>
        <button type="button" onClick={onShare} aria-label="Share" title="Share" className="flex h-11 items-center gap-1 rounded-full px-3 text-xs font-medium text-mut pressable hover:bg-surface2 hover:text-ink">
          <Icon name="share" size={16} /> Share
        </button>
      </div>
    </article>
  );
}
