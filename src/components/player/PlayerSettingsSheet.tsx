import { useEffect, useState } from 'react';
import { useAppSelector } from '../../store';
import { player } from '../../audio/controller';
import { formatTime } from '../../lib/utils';
import { Modal } from '../ui/Modal';
import { Icon, type IconName } from '../ui/Icon';
import { Toggle } from '../ui/controls';

const SLEEP_MINUTES = [15, 30, 45];
const SPEEDS = [0.5, 1, 1.5, 2];

/** Quick player controls behind the ⋮ button on the floating player. */
export function PlayerSettingsSheet({
  open,
  onClose,
  onSetRange,
}: {
  open: boolean;
  onClose: () => void;
  onSetRange: () => void;
}) {
  const p = useAppSelector((s) => s.player);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!open || !p.sleepTimer) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [open, p.sleepTimer]);

  const remaining = p.sleepTimer ? Math.max(0, Math.ceil((p.sleepTimer.endsAt - now) / 1000)) : 0;
  const rangeLabel = p.range
    ? p.range.start === p.range.end
      ? `Ayah ${p.range.start + 1}`
      : `Ayat ${p.range.start + 1}–${p.range.end + 1}`
    : null;

  return (
    <Modal open={open} onClose={onClose} title="Player settings" variant="frosted" size="md">
      <div className="space-y-5">
        <section>
          <SectionHead
            icon="timer"
            title="Sleep timer"
            hint={p.sleepTimer ? `Fading out in ${formatTime(remaining)}` : 'Audio fades out when time is up'}
          />
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {SLEEP_MINUTES.map((minutes) => {
              const active = p.sleepTimer?.minutes === minutes;
              return (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => player.setSleepTimer(active ? null : minutes)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    active ? 'bg-accent text-onaccent' : 'bg-surface2 text-mut hover:text-ink'
                  }`}
                >
                  {minutes} min
                </button>
              );
            })}
            {p.sleepTimer && (
              <button
                type="button"
                onClick={() => player.setSleepTimer(null)}
                className="rounded-full px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10"
              >
                Off
              </button>
            )}
          </div>
        </section>

        <section className="flex items-center justify-between gap-3 rounded-2xl bg-surface2/60 px-3.5 py-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-ink">Hifz pause</div>
            <div className="text-[11px] leading-relaxed text-mut">
              Pause for 3 seconds after each verse so you can repeat it.
            </div>
          </div>
          <Toggle
            checked={p.hifzPause}
            onChange={(v) => player.setHifzPause(v)}
            label="Hifz pause after each verse"
          />
        </section>

        <section>
          <SectionHead icon="repeatOne" title="Verse looping" hint={rangeLabel ?? 'Loop a verse range for memorisation'} />
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onSetRange}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-xs font-semibold text-onaccent pressable"
            >
              <Icon name="repeatOne" size={14} />
              {p.range ? 'Change range' : 'Set range'}
            </button>
            {p.range && (
              <button
                type="button"
                onClick={() => player.clearVerseRange()}
                className="rounded-full bg-surface2 px-3 py-1.5 text-xs font-medium text-mut hover:text-ink"
              >
                Clear loop
              </button>
            )}
          </div>
        </section>

        <section>
          <SectionHead icon="headphones" title="Playback speed" hint={`${p.playbackRate}×`} />
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {SPEEDS.map((rate) => {
              const active = p.playbackRate === rate;
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
            onClose();
            player.stop();
          }}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-line/70 px-4 py-2.5 text-sm font-semibold text-danger pressable hover:bg-danger/10"
        >
          <Icon name="stop" size={16} />
          Stop playback
        </button>
      </div>
    </Modal>
  );
}

function SectionHead({ icon, title, hint }: { icon: IconName; title: string; hint: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon name={icon} size={15} className="text-accent" />
      <span className="text-sm font-semibold text-ink">{title}</span>
      <span className="ml-auto truncate text-[11px] text-mut">{hint}</span>
    </div>
  );
}
