import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/ui/common';
import { Icon } from '../components/ui/Icon';
import { Chip } from '../components/ui/controls';
import { QUOTES, QUOTE_THEMES, QUOTE_THEME_LABELS, quoteOfTheDayIndex } from '../data/quotes';
import { DUA_THEMES, DUA_THEME_LABELS, DUAS, type DuaEntry, type DuaTheme } from '../data/duas';
import { useAppDispatch, useAppSelector } from '../store';
import {
  isDuaLiked,
  isQuoteLiked,
  toggleLikedDua,
  toggleLikedQuote,
} from '../store/slices/likesSlice';
import { push } from '../store/slices/toastSlice';
import type { QuoteEntry, QuoteTheme } from '../types';
import { recordQuoteView } from '../store/slices/progressSlice';
import { Segmented } from '../components/ui/controls';
import { Modal } from '../components/ui/Modal';

type View = 'sayings' | 'duas';
type Filter = 'all' | 'liked' | QuoteTheme | DuaTheme;
type FocusedItem = { kind: 'saying'; entry: QuoteEntry } | { kind: 'dua'; entry: DuaEntry };

export default function QuotesPage() {
  const dispatch = useAppDispatch();
  const likes = useAppSelector((s) => s.likes);
  const [searchParams] = useSearchParams();
  const [view, setView] = useState<View>(() => (searchParams.get('view') === 'duas' ? 'duas' : 'sayings'));
  const [filter, setFilter] = useState<Filter>('all');
  const [featuredIdx, setFeaturedIdx] = useState(() => quoteOfTheDayIndex(new Date()));
  const [focused, setFocused] = useState<FocusedItem | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  const featured = QUOTES[featuredIdx] ?? QUOTES[0];
  const hasArabicVoice = voices.some((voice) => voice.lang.toLowerCase().startsWith('ar'));

  useEffect(() => {
    const nextView = searchParams.get('view') === 'duas' ? 'duas' : 'sayings';
    setView((current) => (current === nextView ? current : nextView));
  }, [searchParams]);

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const synthesis = window.speechSynthesis;
    const refreshVoices = () => setVoices(synthesis.getVoices());
    refreshVoices();
    synthesis.addEventListener('voiceschanged', refreshVoices);
    return () => synthesis.removeEventListener('voiceschanged', refreshVoices);
  }, []);

  useEffect(() => {
    if (view === 'sayings' && featured) dispatch(recordQuoteView(featured.id));
  }, [dispatch, featured?.id, view]);

  const filtered = useMemo(() => {
    if (view === 'sayings') {
      return QUOTES.filter((quote) => filter === 'all' ||
        (filter === 'liked' ? isQuoteLiked(likes, quote.id) : quote.themes.includes(filter as QuoteTheme)));
    }
    return DUAS.filter((dua) => filter === 'all' ||
      (filter === 'liked' ? isDuaLiked(likes, dua.id) : dua.theme === filter));
  }, [filter, likes, view]);

  const shuffle = () => {
    setFeaturedIdx(Math.floor(Math.random() * QUOTES.length));
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      dispatch(push('Copied to clipboard', 'success'));
    } catch {
      dispatch(push('Could not copy', 'error'));
    }
  };

  const speak = (text: string, language: 'en' | 'ar') => {
    if (!('speechSynthesis' in window)) {
      dispatch(push('Read-aloud is not supported in this browser.', 'error'));
      return;
    }
    const synthesis = window.speechSynthesis;
    const voice = voices.find((item) => item.lang.toLowerCase().startsWith(language));
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voice?.lang ?? (language === 'ar' ? 'ar' : 'en-US');
    if (voice) utterance.voice = voice;
    synthesis.cancel();
    synthesis.speak(utterance);
  };

  const copySaying = (quote: QuoteEntry) => copy(`${quote.text}\n— ${quote.by} (${quote.source})`);
  const copyDua = (dua: DuaEntry) => copy(`${dua.arabic}\n${dua.transliteration}\n${dua.translation}\n— ${dua.source}`);
  const isLiked = (item: FocusedItem) => item.kind === 'saying' ? isQuoteLiked(likes, item.entry.id) : isDuaLiked(likes, item.entry.id);
  const toggleLiked = (item: FocusedItem) => {
    if (item.kind === 'saying') dispatch(toggleLikedQuote(item.entry.id));
    else dispatch(toggleLikedDua(item.entry.id));
  };

  return (
    <div className="page-enter">
      <PageHeader
        title="Sayings & Quotes"
        subtitle="Words of the Prophet ﷺ and the Companions to lift the heart."
        right={
          <button
            type="button"
            onClick={shuffle}
            disabled={view !== 'sayings'}
            aria-label="Show another saying"
            className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-onaccent pressable"
          >
            <Icon name="sparkle" size={16} />
            Another
          </button>
        }
      />

      <div className="mb-4">
        <Segmented<View>
          value={view}
          onChange={(next) => { setView(next); setFilter('all'); }}
          options={[{ value: 'sayings', label: 'Sayings' }, { value: 'duas', label: 'Duas' }]}
        />
      </div>

      {/* featured card */}
      {view === 'sayings' && <div className="relative mb-4 overflow-hidden rounded-3xl bg-gradient-to-br from-accent to-accentstrong p-5 text-onaccent shadow-card">
        <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-black/10" />
        <div className="relative">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest opacity-90">
            <Icon name="quote" size={14} />
            Quote of the day
          </div>
          <button type="button" onClick={() => setFocused({ kind: 'saying', entry: featured })} className="mt-3 block text-left text-lg font-medium leading-relaxed">
            “{featured.text}”
          </button>
          <div className="mt-3 text-sm opacity-95">
            — {featured.by}
            <span className="ml-2 opacity-80">· {featured.source}</span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <SpeechActions onEnglish={() => speak(featured.text, 'en')} />
            <button type="button" onClick={() => void copySaying(featured)} aria-label="Copy saying" title="Copy saying" className="rounded-full bg-white/20 p-2 pressable">
              <Icon name="clipboard" size={16} />
            </button>
            <button type="button" onClick={() => toggleLiked({ kind: 'saying', entry: featured })} aria-label={isLiked({ kind: 'saying', entry: featured }) ? 'Unlike saying' : 'Like saying'} aria-pressed={isLiked({ kind: 'saying', entry: featured })} className="rounded-full bg-white/20 p-2 pressable">
              <Icon name="heart" size={16} className={isLiked({ kind: 'saying', entry: featured }) ? 'heart-pop heart-filled' : 'heart-outline'} />
            </button>
          </div>
        </div>
      </div>}

      {/* theme filters */}
      <div className="thin-scroll -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
            filter === 'all' ? 'bg-accent text-onaccent' : 'bg-surface text-mut hover:text-ink'
          }`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setFilter(filter === 'liked' ? 'all' : 'liked')}
          className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${filter === 'liked' ? 'bg-accent text-onaccent' : 'bg-surface text-mut hover:text-ink'}`}
        >
          Liked
        </button>
        {(view === 'sayings' ? QUOTE_THEMES : DUA_THEMES).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setFilter(filter === t ? 'all' : t)}
            className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              filter === t ? 'bg-accent text-onaccent' : 'bg-surface text-mut hover:text-ink'
            }`}
          >
            {view === 'sayings' ? QUOTE_THEME_LABELS[t as QuoteTheme] : DUA_THEME_LABELS[t as DuaTheme]}
          </button>
        ))}
      </div>

      {/* list */}
      <div className="space-y-2.5">
        {filtered.length === 0 && (
          <div className="py-8 text-center text-sm text-mut">{filter === 'liked' ? 'Nothing liked yet.' : 'Nothing here yet.'}</div>
        )}
        {view === 'sayings' && (filtered as QuoteEntry[]).map((quote) => {
          const item: FocusedItem = { kind: 'saying', entry: quote };
          const liked = isLiked(item);
          return (
            <article key={quote.id} className="rounded-2xl bg-surface p-4">
              <button type="button" onClick={() => setFocused(item)} className="flex w-full gap-2 text-left text-gold">
                <Icon name="quote" size={18} className="shrink-0 opacity-70" />
                <span className="text-[15px] leading-relaxed text-ink">“{quote.text}”</span>
              </button>
              <div className="mt-2.5 flex items-start justify-between gap-3 pl-6">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-ink2">{quote.by}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-mut"><Icon name="book" size={12} />{quote.source}</div>
                  <div className="mt-2 flex flex-wrap gap-1">{quote.themes.map((theme) => <button key={theme} type="button" onClick={() => setFilter(theme)}><Chip tone="accent">{QUOTE_THEME_LABELS[theme]}</Chip></button>)}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <SpeechActions onEnglish={() => speak(quote.text, 'en')} compact />
                  <button type="button" aria-label="Copy saying" title="Copy saying" onClick={() => void copySaying(quote)} className="rounded-full p-2 text-mut hover:bg-surface2 hover:text-ink"><Icon name="clipboard" size={17} /></button>
                  <button type="button" aria-label={liked ? 'Unlike saying' : 'Like saying'} title={liked ? 'Unlike' : 'Like'} aria-pressed={liked} onClick={() => toggleLiked(item)} className={`rounded-full p-2 ${liked ? 'text-accent' : 'text-mut hover:bg-surface2 hover:text-accent'}`}><Icon name="heart" size={17} className={liked ? 'heart-pop heart-filled' : 'heart-outline'} /></button>
                </div>
              </div>
            </article>
          );
        })}
        {view === 'duas' && (filtered as DuaEntry[]).map((dua) => {
          const item: FocusedItem = { kind: 'dua', entry: dua };
          const liked = isLiked(item);
          return (
            <article key={dua.id} className="rounded-2xl bg-surface p-4">
              <button type="button" onClick={() => setFocused(item)} className="w-full text-left">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-semibold text-ink">{dua.title}</span>
                  <Chip tone="accent">{DUA_THEME_LABELS[dua.theme]}</Chip>
                </div>
                <p lang="ar" dir="rtl" className="ar-uthmani mt-4 text-right text-2xl leading-loose text-ink">{dua.arabic}</p>
                <p className="mt-2 text-sm italic leading-relaxed text-mut">{dua.transliteration}</p>
                <p className="mt-2 text-sm leading-relaxed text-ink2">{dua.translation}</p>
                <p className="mt-2 text-xs text-mut">{dua.source}</p>
              </button>
              <div className="mt-3 flex justify-end gap-1 border-t border-line pt-2">
                <SpeechActions onEnglish={() => speak(dua.translation, 'en')} onArabic={hasArabicVoice ? () => speak(dua.arabic, 'ar') : undefined} compact />
                <button type="button" aria-label="Copy dua" title="Copy dua" onClick={() => void copyDua(dua)} className="rounded-full p-2 text-mut hover:bg-surface2 hover:text-ink"><Icon name="clipboard" size={17} /></button>
                <button type="button" aria-label={liked ? 'Unlike dua' : 'Like dua'} title={liked ? 'Unlike' : 'Like'} aria-pressed={liked} onClick={() => toggleLiked(item)} className={`rounded-full p-2 ${liked ? 'text-accent' : 'text-mut hover:bg-surface2 hover:text-accent'}`}><Icon name="heart" size={17} className={liked ? 'heart-pop heart-filled' : 'heart-outline'} /></button>
              </div>
            </article>
          );
        })}
      </div>

      <Modal open={focused !== null} onClose={() => setFocused(null)} title={focused?.kind === 'dua' ? focused.entry.title : 'Focused reading'} size="md" variant="frosted">
        {focused?.kind === 'saying' && (
          <div className="py-3">
            <p className="text-xl font-medium leading-relaxed text-ink">“{focused.entry.text}”</p>
            <p className="mt-5 text-sm font-semibold text-ink2">{focused.entry.by}</p>
            <p className="mt-1 text-xs text-mut">{focused.entry.source}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <SpeechActions onEnglish={() => speak(focused.entry.text, 'en')} />
              <button type="button" onClick={() => void copySaying(focused.entry)} className="rounded-full bg-surface2 p-2 text-mut" aria-label="Copy saying"><Icon name="clipboard" size={17} /></button>
              <button type="button" onClick={() => toggleLiked(focused)} className="rounded-full bg-surface2 p-2 text-mut" aria-label={isLiked(focused) ? 'Unlike saying' : 'Like saying'}><Icon name="heart" size={17} className={isLiked(focused) ? 'heart-pop heart-filled' : 'heart-outline'} /></button>
            </div>
          </div>
        )}
        {focused?.kind === 'dua' && (
          <div className="py-3">
            <p lang="ar" dir="rtl" className="ar-uthmani text-right text-3xl leading-loose text-ink">{focused.entry.arabic}</p>
            <p className="mt-5 text-base italic leading-relaxed text-mut">{focused.entry.transliteration}</p>
            <p className="mt-3 text-lg leading-relaxed text-ink2">{focused.entry.translation}</p>
            <p className="mt-4 text-xs text-mut">{focused.entry.source}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <SpeechActions onEnglish={() => speak(focused.entry.translation, 'en')} onArabic={hasArabicVoice ? () => speak(focused.entry.arabic, 'ar') : undefined} />
              <button type="button" onClick={() => void copyDua(focused.entry)} className="rounded-full bg-surface2 p-2 text-mut" aria-label="Copy dua"><Icon name="clipboard" size={17} /></button>
              <button type="button" onClick={() => toggleLiked(focused)} className="rounded-full bg-surface2 p-2 text-mut" aria-label={isLiked(focused) ? 'Unlike dua' : 'Like dua'}><Icon name="heart" size={17} className={isLiked(focused) ? 'heart-pop heart-filled' : 'heart-outline'} /></button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function SpeechActions({ onEnglish, onArabic, compact = false }: { onEnglish: () => void; onArabic?: () => void; compact?: boolean }) {
  return (
    <>
      <button type="button" onClick={onEnglish} aria-label="Read translation aloud" title="Read translation aloud" className={`rounded-full p-2 text-mut hover:bg-surface2 hover:text-accent ${compact ? '' : 'bg-white/20 text-onaccent hover:text-onaccent'}`}>
        <Icon name="play" size={16} />
      </button>
      {/* Arabic voices vary by device; hide this action rather than produce unreliable pronunciation. */}
      {onArabic && <button type="button" onClick={onArabic} aria-label="Read Arabic aloud" title="Read Arabic aloud" className={`rounded-full p-2 text-mut hover:bg-surface2 hover:text-accent ${compact ? '' : 'bg-white/20 text-onaccent hover:text-onaccent'}`}><Icon name="play" size={16} /></button>}
    </>
  );
}
