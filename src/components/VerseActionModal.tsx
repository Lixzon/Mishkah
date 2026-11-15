import { useState } from 'react';
import { Modal } from './ui/Modal';
import { Icon, type IconName } from './ui/Icon';
import { player } from '../audio/controller';
import { ShareCardModal } from './share/ShareCardModal';
import type { AyahBookmark } from '../store/slices/bookmarksSlice';
import { useAppDispatch } from '../store';
import { recordMemorizationRepetition, toggleMemorizedAyah } from '../store/slices/memorizedSlice';
import type { QuranVerseInsight } from '../data/quranInsightsData';
import { wordGloss } from '../data/quranWordGlosses';

export function VerseActionModal({
  open,
  onClose,
  surahNumber,
  surahName,
  ayahNumber,
  arabic,
  translation,
  transliteration,
  reciter,
  bookmark,
  isBookmarked,
  isMemorized,
  repetitions,
  onToggleBookmark,
  insight,
  hifzEnabled = false,
  wordByWordEnabled = false,
}: {
  open: boolean;
  onClose: () => void;
  surahNumber: number;
  surahName: string;
  ayahNumber: number;
  arabic: string;
  translation: string;
  transliteration?: string;
  reciter: string;
  bookmark: Omit<AyahBookmark, 'note' | 'createdAt'>;
  isBookmarked: boolean;
  isMemorized: boolean;
  repetitions: number;
  onToggleBookmark: (bookmark: Omit<AyahBookmark, 'note' | 'createdAt'>) => void;
  insight?: QuranVerseInsight;
  hifzEnabled?: boolean;
  wordByWordEnabled?: boolean;
}) {
  const dispatch = useAppDispatch();
  const [repeatCount, setRepeatCount] = useState(3);
  const [shareOpen, setShareOpen] = useState(false);
  const recordRepetition = () => dispatch(recordMemorizationRepetition({
    id: `${surahNumber}:${ayahNumber}`,
    surah: surahNumber,
    ayah: ayahNumber,
    surahName,
    arabic,
    translation,
  }));
  const playArabic = (withTranslation: boolean, repeats = 1) => {
    let played = 0;
    const playNext = () => {
      played += 1;
      player.playSingleSurah(surahNumber, {
        reciter,
        startAyahIndex: ayahNumber - 1,
        stopAfterAyahIndex: ayahNumber - 1,
        onAyahEnded: () => {
          recordRepetition();
          const continueRepeating = () => {
            if (played < repeats) window.setTimeout(playNext, 180);
          };
          if (withTranslation && 'speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(translation);
            utterance.lang = 'en-US';
            utterance.onend = continueRepeating;
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(utterance);
          } else continueRepeating();
        },
      });
    };
    playNext();
  };

  const playFromHere = () => {
    player.playSingleSurah(surahNumber, {
      reciter,
      startAyahIndex: ayahNumber - 1,
      stopAfterSurah: true,
    });
  };

  const glossedArabic = arabic.split(/(\s+)/u).map((word, index) => {
    if (!word.trim()) return word;
    const gloss = wordGloss(word);
    if (!gloss) return <span key={`${word}-${index}`}>{word}</span>;
    const meaning = `${gloss.meaning}${gloss.root ? ` · root ${gloss.root}` : ''}`;
    return <button key={`${word}-${index}`} type="button" title={meaning} aria-label={`${word}: ${meaning}`} className="rounded px-0.5 underline decoration-dotted decoration-accent/50 underline-offset-4 hover:bg-accent/10">{word}</button>;
  });

  return (
    <>
    <Modal
      open={open}
      onClose={onClose}
      title={`${surahName} · Ayah ${ayahNumber}`}
      size="md"
      variant="frosted"
      preserveBackground
      overlayClassName="bg-black/60 backdrop-blur-md anim-fade"
    >
      <div className="py-2">
        <p lang="ar" dir="rtl" className="ar-uthmani text-right text-3xl leading-loose text-ink">{wordByWordEnabled ? glossedArabic : arabic}</p>
        {transliteration && <p className="mt-4 text-sm italic leading-relaxed text-mut">{transliteration}</p>}
        <p className="mt-4 text-base leading-relaxed text-ink2">{translation}</p>

        <div className="mt-6 grid grid-cols-2 gap-2 border-t border-line pt-4">
          <ActionButton icon="play" label="Play Arabic once" onClick={() => playArabic(false)} />
          <ActionButton icon="play" label="Play Arabic + English" onClick={() => playArabic(true)} />
          <ActionButton icon="forward" label="Play continuously from here" onClick={playFromHere} />
          <ActionButton
            icon={isBookmarked ? 'check' : 'pin'}
            label={isBookmarked ? 'Saved to Library' : 'Save to Library'}
            pressed={isBookmarked}
            onClick={() => onToggleBookmark(bookmark)}
          />
          <ActionButton
            icon={isMemorized ? 'check' : 'book'}
            label={isMemorized ? 'Memorized' : 'Mark as memorized'}
            pressed={isMemorized}
            toggle
            onClick={() => dispatch(toggleMemorizedAyah({
              id: `${surahNumber}:${ayahNumber}`,
              surah: surahNumber,
              ayah: ayahNumber,
              surahName,
              arabic,
              translation,
            }))}
          />
          <ActionButton
            icon="repeatOne"
            label="Loop this ayah"
            onClick={() => {
              void player.playRange(surahNumber, ayahNumber - 1, ayahNumber - 1, {
                reciter,
                onAyahRepeated: recordRepetition,
              });
              onClose();
            }}
          />
          <ActionButton icon="share" label="Share card" onClick={() => setShareOpen(true)} />
        </div>

        {hifzEnabled && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-surface2 p-3">
            <div>
              <div className="text-xs font-semibold text-ink">Hifz repetition</div>
              <div className="text-[11px] text-mut">Repeat this ayah 2–50 times · {Math.min(repetitions, 50)}/50 completed</div>
            </div>
            <div className="flex items-center gap-2">
              <input type="number" aria-label="Verse repeat count" min={2} max={50} value={repeatCount} onChange={(event) => setRepeatCount(Math.min(50, Math.max(2, Number(event.target.value) || 2)))} className="w-14 rounded-lg border border-line bg-surface px-2 py-1.5 text-center text-sm tabular-nums text-ink" />
              <button type="button" onClick={() => playArabic(false, repeatCount)} className="rounded-full bg-accent px-3 py-2 text-xs font-semibold text-onaccent">Repeat</button>
            </div>
          </div>
        )}

        {insight && (
          <section className="mt-4 space-y-2 border-t border-line pt-4" aria-label="Quran reflection">
            <h3 className="text-sm font-semibold text-ink">Tadabbur · deeper understanding</h3>
            <InsightBlock title="Context" text={insight.asbabAlNuzul} />
            <InsightBlock title="Tafsir summary" text={insight.tafsirSummary} />
            <div className="rounded-xl bg-surface2 p-3">
              <div className="text-xs font-semibold text-ink">Reflect</div>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-xs leading-relaxed text-ink2">
                {insight.lessons.filter(Boolean).map((lesson) => <li key={lesson}>{lesson}</li>)}
              </ul>
            </div>
            <p className="text-[10px] leading-relaxed text-mut">{insight.source}. Summarized for study; consult the cited tafsir for detail.</p>
          </section>
        )}
      </div>
    </Modal>
    <ShareCardModal
      open={shareOpen}
      onClose={() => setShareOpen(false)}
      content={{
        surahName,
        surahNumber,
        ayahFrom: ayahNumber,
        arabic,
        translation,
      }}
    />
    </>
  );
}

function InsightBlock({ title, text }: { title: string; text: string }) {
  return <div className="rounded-xl bg-surface2 p-3"><div className="text-xs font-semibold text-ink">{title}</div><p className="mt-1 text-xs leading-relaxed text-ink2">{text}</p></div>;
}

function ActionButton({
  icon,
  label,
  onClick,
  pressed = false,
  toggle = false,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  pressed?: boolean;
  toggle?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={toggle || icon === 'check' ? pressed : undefined}
      onClick={onClick}
      className={`flex min-h-12 items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${pressed ? 'border-accent/40 bg-accent/10 text-accent' : 'border-line bg-surface2 text-ink hover:border-accent/40 hover:text-accent'}`}
    >
      <Icon name={icon} size={17} className="shrink-0" />
      <span>{label}</span>
    </button>
  );
}