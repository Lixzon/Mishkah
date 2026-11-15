import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EVERYDAY_MOMENTS,
  GUIDANCE_CATEGORIES,
  PRACTICAL_GUIDANCE,
  QURAN_GUIDANCE,
  type GuidanceCategoryId,
} from '../data/quranGuidanceData';
import { useAppSelector } from '../store';
import { PageHeader } from '../components/ui/common';
import { Icon } from '../components/ui/Icon';
import { player } from '../audio/controller';

type GuidanceView = 'practice' | 'readings' | 'moments';

const VIEWS: Array<{ value: GuidanceView; label: string }> = [
  { value: 'practice', label: 'Sunnah & daily life' },
  { value: 'readings', label: 'Qur’an readings' },
  { value: 'moments', label: 'Du’as & moments' },
];

const FILTERS: Array<{ value: 'all' | GuidanceCategoryId; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'routines', label: 'Daily & nightly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'emotional', label: 'Emotional relief' },
  { value: 'family', label: 'Family & home' },
];

const PHOTO_FILES = [
  'ocean.jpg',
  'snow.jpg',
  'sky.jpg',
  'skyline.jpg',
  'mountain-starry.jpg',
  'mountain-valley.jpg',
  'alpine-range.jpg',
  'forest-sunrise.jpg',
  'lakeshore.jpg',
] as const;

function photoUrl(index: number): string {
  return `${import.meta.env.BASE_URL}share-backgrounds/${PHOTO_FILES[index % PHOTO_FILES.length]}`;
}

function SourceLinks({ sources }: { sources: readonly { label: string; url: string }[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-white/20 pt-3">
      {sources.map((source) => (
        <a
          key={source.url}
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-semibold text-amber-100 underline decoration-white/35 underline-offset-4 hover:text-white"
        >
          {source.label} ↗
        </a>
      ))}
    </div>
  );
}

function PhotoCard({
  imageIndex,
  eyebrow,
  title,
  summary,
  practice,
  sources,
}: {
  imageIndex: number;
  eyebrow: string;
  title: string;
  summary: string;
  practice?: string;
  sources: readonly { label: string; url: string }[];
}) {
  return (
    <article className="relative isolate overflow-hidden rounded-2xl border border-white/15 bg-black/45 text-white shadow-card">
      <img src={photoUrl(imageIndex)} alt="" aria-hidden="true" className="absolute inset-0 -z-10 h-full w-full object-cover" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-black/85 via-black/70 to-black/45" />
      <div className="absolute bottom-4 left-0 top-4 w-[3px] rounded-r bg-amber-200" />
      <div className="relative p-4 pl-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-amber-100">{eyebrow}</p>
        <h3 className="mt-2 text-base font-semibold leading-snug text-white">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-white/90">{summary}</p>
        {practice ? (
          <div className="mt-3 border-l border-white/35 pl-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-100">Try this</p>
            <p className="mt-1 text-xs leading-relaxed text-white/85">{practice}</p>
          </div>
        ) : null}
        <SourceLinks sources={sources} />
      </div>
    </article>
  );
}

export default function GuidancePage() {
  const navigate = useNavigate();
  const defaultReciter = useAppSelector((state) => state.settings.defaultReciter);
  const [view, setView] = useState<GuidanceView>('practice');
  const [filter, setFilter] = useState<'all' | GuidanceCategoryId>('all');

  const groups = useMemo(() => {
    return GUIDANCE_CATEGORIES
      .filter((category) => filter === 'all' || filter === category.id)
      .map((category) => ({
        ...category,
        items: QURAN_GUIDANCE.filter((item) => item.category === category.id),
      }));
  }, [filter]);

  return (
    <div className="page-enter">
      <PageHeader title="Guidance" subtitle="Practical Prophetic habits, everyday du’as, and Qur’an readings—with sources to check." />
      <div className="mb-4 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap" role="group" aria-label="Guidance sections">
        {VIEWS.map((item) => {
          const active = item.value === view;
          return (
            <button
              key={item.value}
              type="button"
              aria-pressed={active}
              onClick={() => setView(item.value)}
              className={`min-h-10 rounded-xl border px-3 py-2 text-xs font-medium transition-colors sm:rounded-full ${
                active ? 'border-accent bg-accent text-onaccent shadow' : 'border-line bg-surface2 text-mut hover:text-ink'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {view === 'practice' ? (
        <div className="space-y-3">
          <PhotoCard
            imageIndex={0}
            eyebrow="GUIDANCE WITH SOURCES"
            title="A Sunnah for everyday life."
            summary="Practical habits from the Qur’an and Prophetic reports. Each teaching summary points to its source; summaries are not fatwas."
            sources={[{ label: 'Ask a trusted scholar about personal rulings', url: 'https://quran.com/16/43' }]}
          />
          {PRACTICAL_GUIDANCE.map((item, index) => (
            <PhotoCard
              key={item.id}
              imageIndex={index + 1}
              eyebrow={`PRACTICE · ${item.title}`}
              title={item.summary}
              summary={item.practice}
              sources={item.sources}
            />
          ))}
        </div>
      ) : null}

      {view === 'moments' ? (
        <div className="space-y-3">
          <PhotoCard
            imageIndex={5}
            eyebrow="DU’AS FOR EVERYDAY MOMENTS"
            title="Read the moment, then the source."
            summary="These short guides point to a Qur’anic passage or narration. Check its wording and context from the cited source."
            sources={[{ label: 'Qur’an 2:186', url: 'https://quran.com/2/186' }]}
          />
          {EVERYDAY_MOMENTS.map((item, index) => (
            <article key={item.id} className="relative isolate overflow-hidden rounded-2xl border border-white/15 bg-black/45 text-white shadow-card">
              <img src={photoUrl(index + 6)} alt="" aria-hidden="true" className="absolute inset-0 -z-10 h-full w-full object-cover" />
              <div className="absolute inset-0 -z-10 bg-gradient-to-br from-black/85 via-black/70 to-black/45" />
              <div className="absolute bottom-4 left-0 top-4 w-[3px] rounded-r bg-amber-200" />
              <div className="relative p-4 pl-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-amber-100">A DU’A OR REMEMBRANCE</p>
                <h3 className="mt-2 text-base font-semibold text-white">{item.moment}</h3>
                {item.arabic ? <p dir="rtl" lang="ar" className="mt-3 text-right font-arabic text-xl leading-[1.9] text-white">{item.arabic}</p> : null}
                {item.transliteration ? <p className="mt-2 text-xs leading-relaxed text-amber-100">{item.transliteration}</p> : null}
                <p className="mt-2 text-sm leading-relaxed text-white/90">{item.meaning}</p>
                {item.practice ? <p className="mt-2 text-xs leading-relaxed text-white/75">{item.practice}</p> : null}
                <SourceLinks sources={item.sources} />
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {view === 'readings' ? (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" role="group" aria-label="Filter Quran reading guidance">
            {FILTERS.map((item) => {
              const active = item.value === filter;
              return (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(item.value)}
                  className={`min-h-10 min-w-0 rounded-xl border px-3 py-2 text-xs font-medium transition-colors sm:rounded-full ${
                    active
                      ? 'border-accent bg-accent text-onaccent shadow'
                      : 'border-line bg-surface2 text-mut hover:text-ink'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          <div className="space-y-5">
            {groups.map((group) => (
              <section key={group.id} aria-label={group.label}>
                <h2 className="mb-2 text-sm font-semibold text-ink">{group.label}</h2>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {group.items.map((item) => (
                    <article key={item.id} className="relative isolate overflow-hidden rounded-2xl border border-white/15 bg-black/45 shadow-card transition duration-300 hover:shadow-emerald-900/20">
                      <img src={photoUrl(QURAN_GUIDANCE.indexOf(item) + 2)} alt="" aria-hidden="true" className="absolute inset-0 -z-10 h-full w-full object-cover" />
                      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-black/85 via-black/70 to-black/45" />
                      <div className="relative p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                            <p className="mt-1 text-xs font-medium text-amber-100">{item.timing ? `${item.timing} · ` : ''}{item.reference}</p>
                          </div>
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 text-amber-100">
                            <Icon name="book" size={18} />
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-relaxed text-white/90">{item.summary}</p>
                        <p className="mt-2 text-[11px] leading-relaxed text-white/75">{item.sourceNote}</p>
                        <div className="mt-3 flex flex-wrap gap-2 border-t border-white/20 pt-3">
                          <button
                            type="button"
                            onClick={() => player.playRecommendedRecitation(item.surahs[0], {
                              reciter: defaultReciter,
                              startAyahIndex: item.startAyah ? item.startAyah - 1 : null,
                            })}
                            className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-2 text-xs font-semibold text-onaccent pressable"
                          >
                            <Icon name="play" size={14} /> Listen
                          </button>
                          {item.surahs.map((surahNumber) => (
                            <button
                              key={surahNumber}
                              type="button"
                              onClick={() => navigate(`/surah/${surahNumber}?ayah=${surahNumber === item.surahs[0] ? item.startAyah ?? 1 : 1}`)}
                              className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-2 text-xs font-medium text-white pressable hover:bg-white/20"
                            >
                              <Icon name="book" size={14} />
                              {item.surahs.length > 1 ? `Read ${surahNumber}` : 'Open in reader'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
