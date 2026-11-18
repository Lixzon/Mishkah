import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../store';
import { getSurah } from '../../lib/dataClient';
import { TOTAL_QURAN_AYAHS } from '../../lib/progression';
import { toggleAyahBookmark } from '../../store/slices/bookmarksSlice';
import { push } from '../../store/slices/toastSlice';
import { player } from '../../audio/controller';
import { useQuran } from '../../data/QuranProvider';
import { Icon } from '../ui/Icon';
import { ReadScene, type ReadSceneType } from './ReadScene';
import { QURAN_GUIDANCE } from '../../data/quranGuidanceData';
import { getDailyQuranJourney } from '../../data/dailyQuranJourney';
import { dailyQhdTheme, type DailyQhdTheme } from '../../data/dailyQhdReminder';
import { utcDateKey } from '../../data/quranSchedule';
import type { AyahData } from '../../types';

const HOME_PHOTO_VARIANT_KEY = 'furqan:home-photo-variant';
const HOME_PHOTO_VARIANT_COUNT = 9;
const DAY_MS = 86_400_000;

const REFLECT_AND_ACT: Record<DailyQhdTheme['id'], { question: string; action: string }> = {
  remembrance: {
    question: 'What moment today could you meet with remembrance of Allah?',
    action: 'Pause for a minute of dhikr or a sincere du’a.',
  },
  mercy: {
    question: 'Who around you might need patience, mercy, or practical help?',
    action: 'Offer one specific kindness without expecting anything back.',
  },
  prayer: {
    question: 'How can you make space for the next salah in your day?',
    action: 'Check its time now and prepare a calm place to pray.',
  },
  forgiveness: {
    question: 'What would you like to turn back to Allah about, without losing hope?',
    action: 'Make tawbah and take one small step toward a better choice.',
  },
  charity: {
    question: 'What time, skill, or resource could you share for good?',
    action: 'Plan one manageable act of charity or service.',
  },
  character: {
    question: 'Where could you choose fairness, excellence, or care today?',
    action: 'Make one conversation more patient and considerate.',
  },
  gratitude: {
    question: 'Which blessing in your life have you not paused to notice?',
    action: 'Thank Allah for it, then use it in a good way.',
  },
};

const WEEKLY_SURAH_SPOTLIGHTS = [
  { surah: 1, name: 'Al-Fatiha', range: '1–7', note: 'A short opening prayer asking Allah for guidance.' },
  { surah: 18, name: 'Al-Kahf', range: '1–10', note: 'Begin with verses about revelation, faith, and steadfastness.' },
  { surah: 55, name: 'Ar-Rahman', range: '1–16', note: 'Reflect on signs of creation and the blessings named in these verses.' },
  { surah: 67, name: 'Al-Mulk', range: '1–5', note: 'Read about creation and the signs in the heavens.' },
  { surah: 93, name: 'Ad-Duha', range: '1–11', note: 'A reminder of care, gratitude, and kindness to others.' },
  { surah: 94, name: 'Ash-Sharh', range: '1–8', note: 'Reflect on ease, perseverance, and turning to Allah.' },
  { surah: 103, name: 'Al-Asr', range: '1–3', note: 'A concise reminder of faith, good deeds, truth, and patience.' },
] as const;

function nextPhotoVariant(previousVariant?: number): number {
  if (previousVariant === undefined) return Math.floor(Math.random() * HOME_PHOTO_VARIANT_COUNT);
  return (previousVariant + 1 + Math.floor(Math.random() * (HOME_PHOTO_VARIANT_COUNT - 1)))
    % HOME_PHOTO_VARIANT_COUNT;
}

function initialPhotoVariant(): number {
  try {
    const storedVariant = Number.parseInt(localStorage.getItem(HOME_PHOTO_VARIANT_KEY) ?? '', 10);
    if (Number.isInteger(storedVariant) && storedVariant >= 0 && storedVariant < HOME_PHOTO_VARIANT_COUNT) {
      return nextPhotoVariant(storedVariant);
    }
  } catch (error) {
    console.warn('Furqan could not read the Home photo shuffle state.', error);
  }
  return nextPhotoVariant();
}

function weeklySpotlightIndex(date = new Date()): number {
  const utcDate = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const mondayOffset = (new Date(utcDate).getUTCDay() + 6) % 7;
  const monday = utcDate - mondayOffset * DAY_MS;
  return Math.floor(monday / (7 * DAY_MS)) % WEEKLY_SURAH_SPOTLIGHTS.length;
}

const HOME_RECOMMENDATIONS: Array<{
  id: string;
  title: string;
  description: string;
  scene: ReadSceneType;
}> = [
  { id: 'sharh-duha', title: 'For anxiety & stress', description: 'Reflect on reassurance and Allah’s care.', scene: 'clouds' },
  { id: 'fatiha-daily', title: '5 minutes for daily Quran', description: 'A gentle place to begin: Al-Fatiha.', scene: 'quran' },
  { id: 'daily-protection', title: 'Powerful passages', description: 'Explore Ayat al-Kursi and the closing verses.', scene: 'arch' },
  { id: 'mulk-night', title: 'Surahs before bed', description: 'Make a quiet space for a nightly reading.', scene: 'night' },
  { id: 'kahf-friday', title: 'Friday surah', description: 'Set aside time for reflection on Al-Kahf.', scene: 'mosque' },
];

interface DailyVerse {
  surah: number;
  ayah: AyahData;
  surahName: string;
}

export function ReadDashboard() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { surahs } = useQuran();
  const progress = useAppSelector((state) => state.progress);
  const settings = useAppSelector((state) => state.settings);
  const bookmarks = useAppSelector((state) => state.bookmarks.items);
  const [dailyDateKey, setDailyDateKey] = useState(utcDateKey);
  const scheduleDate = new Date(`${dailyDateKey}T12:00:00.000Z`);
  const journey = getDailyQuranJourney(scheduleDate);
  const dailyTheme = dailyQhdTheme(scheduleDate);
  const reflection = REFLECT_AND_ACT[dailyTheme.id];
  const weeklySurah = WEEKLY_SURAH_SPOTLIGHTS[weeklySpotlightIndex()];
  const weeklySurahName = surahs?.find((item) => item.number === weeklySurah.surah)?.englishName ?? weeklySurah.name;
  const mishkahUrl = (import.meta.env.VITE_MISHKAH_URL?.trim() || 'https://lixzon.github.io/Mishkah').replace(/\/+$/, '');
  const journeyStoryUrl = `${mishkahUrl}/?journeyStory=${encodeURIComponent(journey.id)}`;
  const [verse, setVerse] = useState<DailyVerse | null>(null);
  const [photoVariant, setPhotoVariant] = useState(initialPhotoVariant);
  const touchStartY = useRef<number | null>(null);
  const lastBookmark = bookmarks[0];
  const lastPosition = progress.lastPosition;
  const verseIsBookmarked = verse
    ? bookmarks.some((bookmark) => bookmark.id === `${verse.surah}:${verse.ayah.i}`)
    : false;

  useEffect(() => {
    const refreshDate = () => setDailyDateKey(utcDateKey());
    window.addEventListener('focus', refreshDate);
    const interval = window.setInterval(refreshDate, 30_000);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshDate);
    };
  }, []);

  useEffect(() => {
    if (!surahs?.length) return;
    let alive = true;
    const targetGlobalAyah = dailyTheme.globalAyah;
    let cumulative = 0;
    const target = surahs.find((item) => {
      cumulative += item.numberOfAyahs;
      return cumulative >= targetGlobalAyah;
    });
    if (!target) return;
    const ayahNumber = target.numberOfAyahs - (cumulative - targetGlobalAyah);
    void getSurah(target.number)
      .then((data) => {
        if (alive) setVerse({ surah: target.number, ayah: data.ayahs[ayahNumber - 1], surahName: target.englishName });
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [dailyDateKey, dailyTheme.globalAyah, surahs]);

  useEffect(() => {
    try {
      localStorage.setItem(HOME_PHOTO_VARIANT_KEY, String(photoVariant));
    } catch (error) {
      console.warn('Furqan could not save the Home photo shuffle state.', error);
    }
  }, [photoVariant]);

  const shufflePhotos = () => setPhotoVariant((current) => nextPhotoVariant(current));
  const startPullRefresh = (clientY: number) => {
    touchStartY.current = window.scrollY <= 0 ? clientY : null;
  };
  const finishPullRefresh = (clientY: number) => {
    const startY = touchStartY.current;
    touchStartY.current = null;
    if (startY !== null && window.scrollY <= 0 && clientY - startY >= 72) shufflePhotos();
  };

  const toggleBookmark = () => {
    if (!verse) return;
    dispatch(toggleAyahBookmark({
      id: `${verse.surah}:${verse.ayah.i}`,
      surah: verse.surah,
      ayah: verse.ayah.i,
      surahName: verse.surahName,
      arabic: verse.ayah.ar,
      translation: verse.ayah.tr,
    }));
  };

  const shareVerse = async () => {
    if (!verse) return;
    const text = `${verse.ayah.ar}\n${verse.ayah.tr}\n— ${verse.surahName} ${verse.surah}:${verse.ayah.i}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Verse of the day', text });
      else await navigator.clipboard.writeText(text);
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') dispatch(push('Could not share this verse.', 'error'));
    }
  };

  const playVerse = () => {
    if (verse) player.playSingleSurah(verse.surah, { reciter: settings.defaultReciter, startAyahIndex: verse.ayah.i - 1 });
  };

  const khatamAyahsPerDay = Math.ceil(TOTAL_QURAN_AYAHS / settings.khatamTargetDays);

  return (
    <section
      className="mb-5 space-y-3"
      aria-label="Daily reading dashboard"
      onTouchStart={(event) => {
        const touch = event.touches[0];
        if (touch) startPullRefresh(touch.clientY);
      }}
      onTouchEnd={(event) => {
        const touch = event.changedTouches[0];
        if (touch) finishPullRefresh(touch.clientY);
      }}
      onTouchCancel={() => { touchStartY.current = null; }}
    >
      <div className="flex items-center justify-between gap-3 px-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-mut">Your daily Qur’an</p>
        <button
          type="button"
          aria-label="Refresh Home photos"
          title="Refresh Home photos"
          onClick={shufflePhotos}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-accent transition hover:bg-surface2"
        >
          <Icon name="refresh" size={14} />
          Refresh photos
        </button>
      </div>
      {verse && (
        <article className="relative isolate overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-4 text-white shadow-card backdrop-blur-md transition-all duration-300 hover:scale-[1.01] hover:shadow-emerald-900/20">
          <ReadScene scene="quran" variant={photoVariant} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
          <div className="relative">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-200">Verse of the day</div>
              <div className="flex items-center gap-1">
                <button type="button" aria-label="Play verse of the day" title="Play verse" onClick={playVerse} className="rounded-full p-2 text-white/80 hover:bg-white/10"><Icon name="play" size={17} /></button>
                <button
                  type="button"
                  aria-label={verseIsBookmarked ? 'Remove verse bookmark' : 'Bookmark verse'}
                  aria-pressed={verseIsBookmarked}
                  title="Bookmark verse"
                  onClick={toggleBookmark}
                  className="rounded-full p-2 text-white/80 hover:bg-white/10"
                >
                  <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill={verseIsBookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" />
                  </svg>
                </button>
                <button type="button" aria-label="Share verse of the day" title="Share verse" onClick={() => void shareVerse()} className="rounded-full p-2 text-white/80 hover:bg-white/10"><Icon name="forward" size={17} /></button>
              </div>
            </div>
            <button type="button" onClick={() => navigate(`/surah/${verse.surah}?ayah=${verse.ayah.i}`)} className="mt-1 block w-full text-left">
              <p dir="rtl" lang="ar" className="ar-uthmani text-right text-2xl leading-loose text-white">{verse.ayah.ar}</p>
              <p className="mt-2 text-sm leading-relaxed text-white/85">{verse.ayah.tr}</p>
              <p className="mt-2 text-xs font-medium text-white/65">{verse.surahName} · {verse.surah}:{verse.ayah.i}</p>
            </button>
          </div>
        </article>
      )}

      <article className="relative isolate overflow-hidden rounded-2xl border border-white/10 bg-black/45 p-4 text-white shadow-card backdrop-blur-md">
        <ReadScene scene="clouds" variant={photoVariant + 2} />
        <div className="absolute inset-0 bg-gradient-to-br from-black/90 via-black/70 to-emerald-950/75" />
        <div className="relative">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-200">
            Reflect &amp; act · {dailyTheme.title}
          </p>
          <p className="mt-2 text-sm font-medium leading-relaxed">{reflection.question}</p>
          <p className="mt-2 text-xs leading-relaxed text-white/75">
            <span className="font-semibold text-white/90">One small step: </span>{reflection.action}
          </p>
          <button
            type="button"
            onClick={() => navigate(`/surah/${dailyTheme.surah}?ayah=${dailyTheme.ayah}`)}
            className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 text-[11px] font-medium text-white transition hover:bg-white/15"
          >
            Qur’an {dailyTheme.surah}:{dailyTheme.ayah}
            <Icon name="forward" size={13} />
          </button>
          <p className="mt-2 text-[10px] text-white/55">A personal reflection prompt, not a quoted tafsir.</p>
        </div>
      </article>

      <article className="relative isolate overflow-hidden rounded-2xl border border-white/10 bg-black/45 p-4 text-white shadow-card backdrop-blur-md">
        <ReadScene scene="clouds" variant={photoVariant} />
        <div className="absolute inset-0 bg-gradient-to-br from-black/90 via-black/65 to-emerald-950/75" />
        <div className="relative space-y-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-200">Daily Quran journey</p>
            <h2 className="mt-1 text-lg font-semibold">The story of {journey.title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-white/70">Read related passages, then continue with the long story and a reflection.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {journey.passages.map((passage) => (
              <button
                key={`${passage.surah}:${passage.from}`}
                type="button"
                onClick={() => navigate(`/surah/${passage.surah}?ayah=${passage.from}`)}
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-white/15"
              >
                Surah {passage.surah} · {passage.from}{passage.to && passage.to !== passage.from ? `–${passage.to}` : ''}
              </button>
            ))}
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-200">A short reflection</p>
            <p className="mt-1 text-sm leading-relaxed text-white/90">{journey.reflection}</p>
          </div>
          <a
            href={journeyStoryUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => {
              if (!window.confirm('Open this daily Quran journey in Mishkah?')) event.preventDefault();
            }}
            className="inline-flex min-h-10 items-center rounded-full bg-white px-4 py-2 text-xs font-semibold text-emerald-950 transition hover:bg-emerald-50"
          >
            Read the long story in Mishkah ↗
          </a>
        </div>
      </article>

      <button
        type="button"
        onClick={() => lastPosition
          ? navigate(`/surah/${lastPosition.surah}?ayah=${lastPosition.ayah}`)
          : lastBookmark && navigate(`/surah/${lastBookmark.surah}?ayah=${lastBookmark.ayah}`)}
        disabled={!lastPosition && !lastBookmark}
        className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-black/60 px-3.5 py-3 text-left text-white shadow-lg backdrop-blur-md transition hover:bg-black/70 disabled:cursor-default"
      >
          <Icon name="pin" size={18} className="shrink-0 text-accent" />
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-semibold uppercase tracking-widest text-emerald-200">
              {lastPosition ? 'Continue reading' : 'Continue from bookmark'}
            </span>
            <span className="mt-0.5 block truncate text-sm font-semibold text-white">
              {lastPosition
                ? `${lastPosition.surah}. ${lastPosition.name} · Ayah ${lastPosition.ayah}`
                : lastBookmark
                  ? `${lastBookmark.surah}. ${lastBookmark.surahName} · Ayah ${lastBookmark.ayah}`
                  : 'Your last reading position will appear here'}
            </span>
          </span>
          <Icon name="forward" size={16} className="shrink-0 text-white/60" />
      </button>

      <article className="relative isolate overflow-hidden rounded-2xl border border-white/10 bg-black/45 p-4 text-white shadow-card backdrop-blur-md">
        <ReadScene scene="arch" variant={photoVariant + 4} />
        <div className="absolute inset-0 bg-gradient-to-br from-black/90 via-black/65 to-emerald-950/75" />
        <div className="relative flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-200">This week’s surah spotlight</p>
            <h2 className="mt-1 text-lg font-semibold">{weeklySurahName}</h2>
            <p className="mt-1 text-xs leading-relaxed text-white/75">{weeklySurah.note}</p>
            <p className="mt-2 text-[10px] font-medium text-white/55">Qur’an {weeklySurah.surah}:{weeklySurah.range}</p>
          </div>
          <button
            type="button"
            aria-label={`Read ${weeklySurahName}`}
            onClick={() => navigate(`/surah/${weeklySurah.surah}?ayah=1`)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
          >
            <Icon name="forward" size={17} />
          </button>
        </div>
      </article>

      <button
        type="button"
        onClick={() => navigate('/settings')}
        className="group relative isolate flex w-full items-center justify-between gap-4 overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-4 text-left text-white shadow-card backdrop-blur-md transition-all duration-300 hover:scale-[1.01] hover:shadow-emerald-900/20"
      >
        <ReadScene scene="quran" variant={photoVariant} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
        <span className="relative min-w-0">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-200">Khatam planner</span>
          <span className="mt-1 block text-base font-semibold">
            {settings.khatamPlannerEnabled ? `A gentle ${settings.khatamTargetDays}-day reading plan` : 'Make space for a complete reading'}
          </span>
          <span className="mt-1 block text-xs text-white/70">
            {settings.khatamPlannerEnabled
              ? `About ${khatamAyahsPerDay} ayahs each day`
              : 'Choose a pace that feels steady and sustainable'}
          </span>
        </span>
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
          <Icon name="forward" size={17} />
        </span>
      </button>

      <section aria-label="Quran reading recommendations">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-mut">A quiet place to begin</h2>
          <button type="button" onClick={() => navigate('/guidance')} className="text-xs font-medium text-accent hover:underline">More guidance</button>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {HOME_RECOMMENDATIONS.map((recommendation) => {
            const passage = QURAN_GUIDANCE.find((item) => item.id === recommendation.id);
            if (!passage) return null;
            return (
              <button
                key={recommendation.id}
                type="button"
                onClick={() => navigate(`/surah/${passage.surahs[0]}?ayah=${passage.startAyah ?? 1}`)}
                className="group relative isolate flex min-h-36 flex-col justify-end overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-3 text-left text-white shadow-card backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:shadow-emerald-900/20"
              >
                <ReadScene scene={recommendation.scene} variant={photoVariant} />
                <span className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
                <span className="relative text-sm font-semibold leading-snug">{recommendation.title}</span>
                <span className="relative mt-1 line-clamp-2 text-[11px] leading-relaxed text-white/75">{recommendation.description}</span>
                <span className="relative mt-2 text-[10px] font-medium text-emerald-200">{passage.reference}</span>
              </button>
            );
          })}
        </div>
      </section>
    </section>
  );
}
