import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store';
import { setJuzCompleted } from '../store/slices/progressSlice';
import { useQuran } from '../data/QuranProvider';
import { PageHeader, EmptyState } from '../components/ui/common';
import { Icon } from '../components/ui/Icon';
import { timeAgo, surahNumberToArabic } from '../lib/utils';
import { QUOTES } from '../data/quotes';
import {
  ISTIQAMAH_MILESTONES,
  TIERS,
  isTierUnlocked,
  khatmProgress,
  nextTier,
  tierProgress,
  todayKey,
  weeklyRecap,
} from '../lib/progression';

export default function ProgressPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const progress = useAppSelector((s) => s.progress);
  const { surahs } = useQuran();

  const completedSurahs = surahs
    ? surahs.filter((s) => progress.surahCompleted[s.number]).length
    : 0;
  const completedJuz = Object.keys(progress.juzCompleted).filter(
    (k) => progress.juzCompleted[Number(k)],
  ).length;

  const recentlyRead = Object.entries(progress.lastRead)
    .map(([n, v]) => ({ n: Number(n), ...v }))
    .sort((a, b) => b.at - a.at)
    .slice(0, 6);

  const recentlyListened = Object.entries(progress.lastListened)
    .map(([n, at]) => ({ n: Number(n), at }))
    .sort((a, b) => b.at - a.at)
    .slice(0, 6);

  const juzPct = Math.round((completedJuz / 30) * 100);
  const lastPosition = progress.lastPosition;
  const lastMeta = lastPosition ? surahs?.find((s) => s.number === lastPosition.surah) : undefined;
  const totalAyahsReached = Object.values(progress.ayahsReached).reduce((sum, count) => sum + count, 0);
  const streak = progress.progression.currentStreak;

  const today = todayKey();
  const week = weeklyRecap(progress.activity, progress.progression.dailyListenMinutes, today);
  const weekAyahs = week.reduce((sum, day) => sum + day.ayahs, 0);
  const weekMinutes = week.reduce((sum, day) => sum + day.minutes, 0);
  const weekPeak = Math.max(1, ...week.map((day) => day.ayahs));
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthSurahs = Object.values(progress.lastRead).filter((entry) => entry.at >= monthStart.getTime()).length;
  const khatm = khatmProgress(progress.ayahsReached);
  const upcomingTier = nextTier(progress.progression.currentStreak);
  const tierRatio = upcomingTier
    ? tierProgress(progress.progression.currentStreak, upcomingTier).ratio
    : 1;
  const unlockedTierCount = TIERS.filter((tier) => isTierUnlocked(streak, tier)).length;
  const reachedGoalCount = ISTIQAMAH_MILESTONES.filter((days) =>
    progress.progression.celebratedMilestones.includes(days),
  ).length;

  const recentSurahs = progress.activity
    .filter((entry, index, entries) => entries.findIndex((item) => item.surah === entry.surah) === index)
    .slice(0, 5);
  const mostRead = mostActive(progress.activity, 0);
  const mostReadWeek = mostActive(progress.activity, 7);
  const mostReadToday = mostActive(progress.activity, 1);

  return (
    <div className="page-enter">
      <PageHeader title="Your progress" subtitle="A little each day completes the whole Qur’an." />

      {lastPosition ? (
        <div className="mb-4 rounded-2xl border border-accent/30 bg-accent/8 p-4">
          <div className="text-xs font-semibold uppercase tracking-widest text-accent">Continue where you left off</div>
          <div className="mt-1 flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-sm font-bold text-onaccent">
              {surahNumberToArabic(lastPosition.surah)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-base font-semibold text-ink">{lastPosition.name}</div>
              <div className="text-xs text-mut">Āyah {lastPosition.ayah} of {lastMeta?.numberOfAyahs ?? '—'} · {timeAgo(lastPosition.at)}</div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface2">
                <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, ((lastPosition.ayah / Math.max(1, lastMeta?.numberOfAyahs ?? lastPosition.ayah)) * 100))}%` }} />
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/surah/${lastPosition.surah}?ayah=${lastPosition.ayah}`)}
              className="shrink-0 rounded-full bg-accent px-3 py-2 text-xs font-semibold text-onaccent pressable"
            >
              Continue
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-4 rounded-2xl border border-line bg-surface p-4">
          <div className="text-sm font-semibold text-ink">Begin your reading journey</div>
          <div className="mt-1 text-xs text-mut">Open a surah and your latest ayah will appear here for a quick return.</div>
          <button type="button" onClick={() => navigate('/')} className="mt-3 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-onaccent pressable">Browse surahs</button>
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        <StatCard icon="book" label="Ayahs reached" value={String(totalAyahsReached)} sub="across all surahs" />
        <StatCard icon="stack" label="Current streak" value={`${streak} day${streak === 1 ? '' : 's'}`} sub="reading or listening" />
        <StatCard icon="music" label="Most read" value={mostRead ? mostRead.name : '—'} sub={mostRead ? `${mostRead.count} activity marks` : 'none yet'} />
        <StatCard icon="clock" label="This week" value={mostReadWeek ? mostReadWeek.name : '—'} sub={mostReadWeek ? `${mostReadWeek.count} activity marks` : 'none yet'} />
        <StatCard icon="book" label="Today" value={mostReadToday ? mostReadToday.name : '—'} sub={mostReadToday ? `${mostReadToday.count} activity marks` : 'none yet'} />
      </div>

      {recentSurahs.length > 0 && (
        <div className="mb-4">
          <h2 className="mb-2 text-sm font-semibold text-ink">Recent surahs</h2>
          <div className="flex flex-wrap gap-1.5">
            {recentSurahs.map((entry) => <button key={entry.surah} type="button" onClick={() => navigate(`/surah/${entry.surah}?ayah=${entry.ayah}`)} className="rounded-full bg-surface px-3 py-1.5 text-xs text-ink pressable">{entry.name}</button>)}
          </div>
        </div>
      )}

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Milestones &amp; tiers</h2>
          <span className="text-[11px] uppercase tracking-[0.2em] text-mut">{unlockedTierCount}/{TIERS.length} tiers · {reachedGoalCount}/{ISTIQAMAH_MILESTONES.length} goals</span>
        </div>
        <div className="space-y-2.5">
          {TIERS.map((tier) => {
            const reached = isTierUnlocked(streak, tier);
            const daysLeft = Math.max(0, tier.days - streak);
            return (
              <div
                key={tier.tier}
                className={`milestone-card rounded-2xl border p-3 ${reached ? 'border-accent/40 bg-accent/8' : 'border-line bg-surface text-muted'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`milestone-badge flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border ${reached ? 'border-accent/60 bg-accent text-onaccent' : 'border-line bg-surface2 text-accent/70'}`}>
                      <svg viewBox="0 0 40 40" className="h-7 w-7" aria-hidden="true">
                        <path d="M20 3 24.5 15.5 37 20 24.5 24.5 20 37 15.5 24.5 3 20 15.5 15.5Z" fill="currentColor" opacity={reached ? 0.9 : 0.55} />
                        <circle cx="20" cy="20" r="5" fill="currentColor" opacity={reached ? 0.9 : 0.65} />
                      </svg>
                    </div>
                    <div>
                      <div className={`text-sm font-semibold ${reached ? 'text-ink' : 'text-mut'}`}>{tier.name} · {tier.days} days</div>
                      <div className={`text-xs ${reached ? 'text-accent' : 'text-mut'}`}>
                        {reached ? 'Unlocked' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining`}
                      </div>
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${reached ? 'bg-accent text-onaccent' : 'bg-surface2 text-mut'}`}>
                    {reached ? 'Earned' : 'Locked'}
                  </span>
                </div>
                <div className={`mt-2 text-sm ${reached ? 'text-ink2' : 'text-mut'}`}>
                  {tier.unlocks}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* overview */}
      <div className="grid grid-cols-3 gap-2.5">
        <StatCard
          icon="stack"
          label="Juz complete"
          value={`${completedJuz}/30`}
          sub={`${juzPct}%`}
          onClick={undefined}
        />
        <StatCard
          icon="book"
          label="Surahs read"
          value={surahs ? `${completedSurahs}/${surahs.length}` : '—'}
          sub={surahs ? `${Math.round((completedSurahs / surahs.length) * 100)}%` : ''}
          onClick={undefined}
        />
        <StatCard
          icon="clock"
          label="Last listened"
          value={recentlyListened[0] ? surahNumberToArabic(recentlyListened[0].n) : '—'}
          sub={recentlyListened[0] ? timeAgo(recentlyListened[0].at) : 'none yet'}
          onClick={
            recentlyListened[0]
              ? () => navigate(`/surah/${recentlyListened[0].n}`)
              : undefined
          }
        />
      </div>

      {/* juz completion */}
      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Juz / Para completion</h2>
          <span className="inline-flex items-center gap-1.5 text-xs text-mut">
            <Icon name="info" size={13} className="text-accent" />
            tap a juz to mark it
          </span>
        </div>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
          {Array.from({ length: 30 }).map((_, i) => {
            const j = i + 1;
            const done = !!progress.juzCompleted[j];
            return (
              <button
                key={j}
                type="button"
                onClick={() => dispatch(setJuzCompleted({ juz: j, value: !done }))}
                className={`pressable flex aspect-square flex-col items-center justify-center rounded-2xl border transition-colors ${
                  done
                    ? 'border-accent bg-accentstrong text-onaccent'
                    : 'border-accent/25 bg-accent/8 text-ink hover:border-accent/50 hover:bg-accent/12'
                }`}
              >
                <span className="text-lg font-semibold leading-none tracking-wide">{j}</span>
                {done && <Icon name="check" size={13} />}
              </button>
            );
          })}
        </div>
        {surahs && <div className="mt-4 text-center text-sm text-mut">This marks how many juz you’ve completed on your way to finishing the whole Qur’an.</div>}
      </div>

      {/* progress recaps */}
      <div className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-ink">Your recaps</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-surface p-3 sm:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-mut">This week</span>
              <span className="text-[11px] text-mut">
                {weekAyahs} āyāt · {weekMinutes} min listening
              </span>
            </div>
            <div className="mt-3 flex items-end justify-between gap-2">
              {week.map((day) => (
                <div key={day.key} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-16 w-full items-end overflow-hidden rounded-md bg-surface2">
                    <div
                      className="w-full rounded-md bg-accent"
                      style={{ height: `${(day.ayahs / weekPeak) * 100}%` }}
                      title={`${day.ayahs} āyāt · ${day.minutes} min`}
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-mut">{day.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 text-[11px] text-mut">Āyāt recorded each day, from your reading and listening history.</div>
          </div>

          <div className="grid gap-3">
            <StatCard
              icon="book"
              label="This month"
              value={`${monthSurahs} surah${monthSurahs === 1 ? '' : 's'}`}
              sub={`${completedJuz}/30 juz complete`}
            />
            <div className="rounded-2xl bg-surface p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-mut">
                <Icon name="progress" size={13} className="text-accent" />
                Yearly khatm
              </div>
              <div className="mt-1 text-xl font-bold text-ink">{khatm.toFixed(1)}%</div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface2">
                <div className="h-full rounded-full bg-accent" style={{ width: `${khatm}%` }} />
              </div>
              <div className="mt-1 text-[11px] text-mut">Estimated coverage of the whole Qur’an.</div>
            </div>
            <div className="rounded-2xl bg-surface p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-mut">
                <Icon name="sparkle" size={13} className="text-accent" />
                Next tier
              </div>
              {upcomingTier ? (
                <>
                  <div className="mt-1 text-sm font-semibold text-ink">{upcomingTier.name}</div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface2">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${tierRatio * 100}%` }} />
                  </div>
                  <div className="mt-1 text-[11px] text-mut">
                    {progress.progression.currentStreak}/{upcomingTier.days} days
                  </div>
                </>
              ) : (
                <div className="mt-1 text-sm font-semibold text-accent">Every tier unlocked</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* recently read */}
      <div className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-ink">Recently read</h2>
        {recentlyRead.length === 0 ? (
          <EmptyState icon="book" title="Nothing read yet" message="Open any surah to start tracking where you left off." />
        ) : (
          <div className="space-y-2">
            {recentlyRead.map((r) => {
              const meta = surahs?.find((s) => s.number === r.n);
              const total = meta?.numberOfAyahs ?? 0;
              return (
                <button
                  key={r.n}
                  type="button"
                  onClick={() => navigate(`/surah/${r.n}?ayah=${r.ayah}`)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-surface p-3 text-left pressable"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/12 font-semibold text-accent">
                    {surahNumberToArabic(r.n)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-ink">{meta?.englishName ?? `Surah ${r.n}`}</div>
                    <div className="text-xs text-mut">
                      At āyah {r.ayah}{total ? ` of ${total}` : ''} · {timeAgo(r.at)}
                    </div>
                  </div>
                  <Icon name="forward" size={16} className="shrink-0 text-mut" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* recently listened */}
      {recentlyListened.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-ink">Recently listened</h2>
          <div className="flex flex-wrap gap-1.5">
            {recentlyListened.map((r) => {
              const meta = surahs?.find((s) => s.number === r.n);
              return (
                <button
                  key={r.n}
                  type="button"
                  onClick={() => navigate(`/surah/${r.n}`)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs text-ink pressable"
                >
                  <Icon name="music" size={12} className="text-accent" />
                  {meta?.englishName ?? `Surah ${r.n}`}
                  <span className="text-mut">{timeAgo(r.at)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {progress.activity.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-ink">Qur’an history</h2>
          <div className="space-y-1.5">
            {progress.activity.slice(0, 12).map((entry, index) => {
              const group = historyGroup(entry.at);
              const previousGroup = index > 0 ? historyGroup(progress.activity[index - 1].at) : null;
              return (
                <div key={`${entry.at}-${index}`}>
                  {group !== previousGroup && <div className="px-1 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-widest text-mut">{group}</div>}
                  <button type="button" onClick={() => navigate(`/surah/${entry.surah}?ayah=${entry.ayah}`)} className="flex w-full items-center gap-3 rounded-xl bg-surface px-3 py-2 text-left pressable">
                    <Icon name={entry.kind === 'listen' ? 'music' : 'book'} size={15} className="shrink-0 text-accent" />
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{entry.name} · āyah {entry.ayah}</span>
                    <span className="shrink-0 text-[11px] text-mut">{timeAgo(entry.at)}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {progress.quoteHistory.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-ink">Quotes history</h2>
          <div className="space-y-1.5">
            {progress.quoteHistory.slice(0, 8).map((entry) => {
              const quote = QUOTES.find((item) => item.id === entry.id);
              if (!quote) return null;
              return <button key={entry.id} type="button" onClick={() => navigate('/quotes')} className="w-full rounded-xl bg-surface px-3 py-2 text-left text-sm text-ink pressable">“{quote.text}” <span className="text-xs text-mut">· {quote.by}</span></button>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  onClick,
}: {
  icon: 'stack' | 'book' | 'clock' | 'music';
  label: string;
  value: string;
  sub?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-mut">
        <Icon name={icon} size={13} className="text-accent" />
        {label}
      </div>
      <div className="mt-1 text-xl font-bold text-ink">{value}</div>
      {sub && <div className="text-[11px] text-accent">{sub}</div>}
    </>
  );
  const cls = 'rounded-2xl bg-surface p-3';
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={`${cls} text-left pressable hover:bg-surface2/10 transition-colors cursor-pointer`}
    >
      {content}
    </button>
  ) : (
    <div className={cls} role={undefined} tabIndex={undefined}>
      {content}
    </div>
  );
}

function mostActive(activity: { surah: number; name: string; at: number }[], days: number) {
  const since = days === 0 ? 0 : Date.now() - days * 86400000;
  const counts = new Map<number, { name: string; count: number }>();
  activity.filter((entry) => entry.at >= since).forEach((entry) => {
    const current = counts.get(entry.surah) ?? { name: entry.name, count: 0 };
    counts.set(entry.surah, { name: current.name, count: current.count + 1 });
  });
  return [...counts.values()].sort((a, b) => b.count - a.count)[0];
}

function historyGroup(at: number): string {
  const now = new Date();
  const date = new Date(at);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const delta = Math.round((today - day) / 86400000);
  if (delta === 0) return 'Today';
  if (delta === 1) return 'Yesterday';
  if (delta < 7) return 'This week';
  return 'Older';
}
