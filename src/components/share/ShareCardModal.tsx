import { useEffect, useRef, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Icon } from '../ui/Icon';
import { Toggle } from '../ui/controls';
import { useAppDispatch } from '../../store';
import { push } from '../../store/slices/toastSlice';
import { copyText } from '../../lib/share';
import { verseDeepLink } from '../../lib/deepLink';
import {
  CARD_PRESETS,
  canvasToBlob,
  cardFilename,
  renderShareCard,
  type CardContent,
  type CardFormat,
  type CardPresetId,
} from '../../lib/shareCard';

const FORMATS: Array<{ id: CardFormat; label: string; hint: string }> = [
  { id: 'square', label: '1:1', hint: 'Feed / post' },
  { id: 'story', label: '9:16', hint: 'Story / status' },
];

export function ShareCardModal({
  open,
  onClose,
  content,
}: {
  open: boolean;
  onClose: () => void;
  content: CardContent;
}) {
  const dispatch = useAppDispatch();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const [format, setFormat] = useState<CardFormat>('square');
  const [preset, setPreset] = useState<CardPresetId>('photo-ocean');
  const [showBadge, setShowBadge] = useState(true);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const { surahName, surahNumber, ayahFrom, ayahTo, arabic, translation } = content;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setBusy(true);
    setFailed(false);
    blobRef.current = null;
    renderShareCard({
      content: { surahName, surahNumber, ayahFrom, ayahTo, arabic, translation },
      format,
      preset,
      showBadge,
    })
      .then(async (rendered) => {
        if (cancelled) return;
        const preview = canvasRef.current;
        if (preview) {
          preview.width = rendered.width;
          preview.height = rendered.height;
          preview.getContext('2d')?.drawImage(rendered, 0, 0);
        }
        blobRef.current = await canvasToBlob(rendered);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, surahName, surahNumber, ayahFrom, ayahTo, arabic, translation, format, preset, showBadge]);

  const shareLink = verseDeepLink(surahNumber, ayahFrom);

  const download = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = cardFilename(content, format);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const shareCard = async () => {
    const blob = blobRef.current;
    if (!blob) {
      dispatch(push('The card is still rendering. Try again in a moment.', 'info'));
      return;
    }
    const file = new File([blob], cardFilename(content, format), { type: 'image/jpeg' });
    const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
    const payload: ShareData = {
      title: `${surahName} ${ayahFrom} · Furqan`,
      text: `${translation}\n\n${shareLink}\n\nby LIXZON`,
      files: [file],
    };
    if (typeof navigator.share === 'function' && (!nav.canShare || nav.canShare(payload))) {
      try {
        await navigator.share(payload);
        dispatch(push('Card shared.', 'success'));
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    download(blob);
    dispatch(push('Card saved to this device. Share it wherever you like.', 'success'));
  };

  const copyLink = async () => {
    const copied = await copyText(shareLink);
    dispatch(copied ? push('Deep link copied.', 'success') : push('Could not copy the link.', 'error'));
  };

  return (
    <Modal open={open} onClose={onClose} title="Share card" size="md" variant="frosted" preserveBackground>
      <div className="space-y-4">
        <div
          className="mx-auto w-full overflow-hidden rounded-2xl border border-line bg-surface2"
          style={{ maxWidth: format === 'square' ? 360 : 300 }}
        >
          <canvas ref={canvasRef} className="block h-auto w-full" aria-label="Share card preview" role="img" />
          {busy && <div className="py-2 text-center text-[11px] text-mut">Rendering…</div>}
          {failed && <div className="py-2 text-center text-[11px] text-danger">This device could not render the card.</div>}
        </div>

        <div className="flex items-center justify-center gap-1 rounded-full bg-surface2 p-1">
          {FORMATS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={format === option.id}
              onClick={() => setFormat(option.id)}
              className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold transition-colors ${
                format === option.id ? 'bg-accent text-onaccent' : 'text-mut hover:text-ink'
              }`}
            >
              {option.label} · {option.hint}
            </button>
          ))}
        </div>

        <div>
          <div className="mb-2 text-xs font-medium text-mut">Photo background · works offline</div>
          <div className="thin-scroll flex gap-2 overflow-x-auto pb-1">
            {CARD_PRESETS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={preset === option.id}
                title={option.label}
                onClick={() => setPreset(option.id)}
                className={`flex w-16 shrink-0 flex-col items-center gap-1 rounded-xl border p-1.5 text-[10px] font-medium transition-colors ${
                  preset === option.id ? 'border-accent text-accent' : 'border-line text-mut hover:text-ink'
                }`}
              >
                <img
                  src={option.image}
                  alt=""
                  className="h-10 w-full rounded-lg object-cover"
                  style={{ background: `linear-gradient(160deg, ${option.swatch[0]}, ${option.swatch[1]})` }}
                />
                <span className="w-full truncate text-center">{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl bg-surface2 px-3 py-2.5">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-ink">Referral badge</div>
            <div className="text-[11px] text-mut">“Read on Furqan • by LIXZON”</div>
          </div>
          <Toggle checked={showBadge} onChange={setShowBadge} label="Show referral badge" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={shareCard}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-onaccent pressable disabled:opacity-50"
          >
            <Icon name="share" size={16} />
            Share card
          </button>
          <button
            type="button"
            onClick={copyLink}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink pressable"
          >
            <Icon name="clipboard" size={16} />
            Copy link
          </button>
        </div>
        <p className="text-center text-[10px] leading-relaxed text-mut">
          Photos are bundled with Furqan, so cards work offline. Links open Furqan at this ayah.
        </p>
      </div>
    </Modal>
  );
}
