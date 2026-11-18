import { useEffect, useState } from 'react';
import type { PlaylistItem } from '../../types';
import { player } from '../../audio/controller';
import { Modal } from '../ui/Modal';
import { Icon } from '../ui/Icon';

const SPEEDS = [0.5, 1, 1.5, 2];
const MAX_REPEAT = 50;

/**
 * Bottom sheet for one playlist slot: memorisation loop, speed, queue order
 * and removal. Everything that used to be crammed into the row lives here.
 */
export function PlaylistItemSheet({
  open,
  item,
  surahName,
  ayahCount,
  playbackRate,
  isCurrent,
  activeLoop,
  onClose,
  onApplyLoop,
  onClearLoop,
  onRepeat,
  onPlayNext,
  onRemove,
}: {
  open: boolean;
  item: PlaylistItem | null;
  surahName: string;
  ayahCount: number;
  playbackRate: number;
  isCurrent: boolean;
  activeLoop: boolean;
  onClose: () => void;
  onApplyLoop: (from: number, to: number) => void;
  onClearLoop: () => void;
  onRepeat: (repeat: number) => void;
  onPlayNext: () => void;
  onRemove: () => void;
}) {
  const count = Math.max(1, ayahCount);
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !item) return;
    const start = item.loop?.start ?? 0;
    const end = item.loop?.end ?? start;
    setFrom(Math.min(count, start + 1));
    setTo(Math.min(count, Math.max(start, end) + 1));
    setError(null);
  }, [open, item?.id, item?.loop?.start, item?.loop?.end, count]);

  if (!item) return null;

  const repeat = Math.max(1, item.repeat);
  const clamp = (value: number) => Math.min(count, Math.max(1, Math.round(value) || 1));

  const apply = () => {
    if (from > to) {
      setError('“From” must come before “To”.');
      return;
    }
    setError(null);
    onApplyLoop(from - 1, to - 1);
  };

  const hasLoop = Boolean(item.loop) || (isCurrent && activeLoop);

  return (
    <Modal open={open} onClose={onClose} title={surahName} size="md">
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface2/60 px-3.5 py-2.5">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-ink">Repeats</div>
            <div className="text-[11px] text-mut">Times this surah plays before the next one.</div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              aria-label="Decrease repeats"
              disabled={repeat <= 1}
              onClick={() => onRepeat(repeat - 1)}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface text-mut pressable hover:text-ink disabled:opacity-35"
            >
              <Icon name="prev" size={11} />
            </button>
            <span className="min-w-[2.5rem] text-center text-sm font-semibold tabular-nums text-ink">
              ×{repeat}
            </span>
            <button
              type="button"
              aria-label="Increase repeats"
              disabled={repeat >= MAX_REPEAT}
              onClick={() => onRepeat(repeat + 1)}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface text-mut pressable hover:text-ink disabled:opacity-35"
            >
              <Icon name="forward" size={11} />
            </button>
          </div>
        </div>

        <section>
          <div className="flex items-center gap-2">
            <Icon name="repeatOne" size={15} className="text-accent" />
            <span className="text-sm font-semibold text-ink">Loop verse</span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-mut">
            Keep repeating a verse window for memorisation. Surah has {count} verse{count === 1 ? '' : 's'}.
          </p>
          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-mut">From verse</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={count}
                value={from}
                onChange={(event) => setFrom(clamp(Number(event.target.value)))}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm tabular-nums text-ink focus:border-accent focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-mut">To verse</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={count}
                value={to}
                onChange={(event) => setTo(clamp(Number(event.target.value)))}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm tabular-nums text-ink focus:border-accent focus:outline-none"
              />
            </label>
          </div>
          {error && <p className="mt-1.5 text-[11px] text-danger">{error}</p>}
          <button
            type="button"
            onClick={apply}
            className="mt-2.5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-onaccent pressable"
          >
            <Icon name="repeatOne" size={15} />
            {item.loop ? 'Update loop' : 'Start loop'}
          </button>
        </section>

        <button
          type="button"
          onClick={onClearLoop}
          disabled={!hasLoop}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-surface2 px-4 py-2 text-xs font-semibold text-mut pressable hover:text-ink disabled:opacity-40"
        >
          <Icon name="close" size={14} />
          Remove verse loop
        </button>

        <section>
          <div className="flex items-center gap-2">
            <Icon name="headphones" size={15} className="text-accent" />
            <span className="text-sm font-semibold text-ink">Playback speed</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SPEEDS.map((rate) => {
              const active = playbackRate === rate;
              return (
                <button
                  key={rate}
                  type="button"
                  onClick={() => player.setPlaybackRate(rate)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold tabular-nums transition-colors ${
                    active ? 'bg-accent text-onaccent' : 'bg-surface2 text-mut hover:text-ink'
                  }`}
                >
                  {rate}×
                </button>
              );
            })}
          </div>
        </section>

        <button
          type="button"
          onClick={() => {
            onPlayNext();
            onClose();
          }}
          className="flex w-full items-center gap-2.5 rounded-2xl bg-surface2/60 px-3.5 py-3 text-left pressable hover:bg-surface2"
        >
          <Icon name="stack" size={17} className="text-accent" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink">Play next</span>
            <span className="block text-[11px] text-mut">Move this surah to the top of the queue.</span>
          </span>
          <Icon name="chevronRight" size={16} className="text-mut" />
        </button>

        <button
          type="button"
          onClick={() => {
            onRemove();
            onClose();
          }}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-danger/30 px-4 py-2.5 text-sm font-semibold text-danger pressable hover:bg-danger/10"
        >
          <Icon name="trash" size={16} />
          Remove from playlist
        </button>
      </div>
    </Modal>
  );
}
