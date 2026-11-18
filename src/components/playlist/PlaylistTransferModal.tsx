import { useEffect, useMemo, useState } from 'react';
import type { Playlist } from '../../types';
import { useAppDispatch, useAppSelector } from '../../store';
import { importPlaylist } from '../../store/slices/playlistSlice';
import { push } from '../../store/slices/toastSlice';
import { copyText } from '../../lib/share';
import {
  decodePlaylist,
  encodePlaylist,
  loadCreatorName,
  saveCreatorName,
  type DecodedPlaylist,
} from '../../lib/playlistShare';
import { uid } from '../../lib/utils';
import { reciterById } from '../../lib/constants';
import { Modal } from '../ui/Modal';
import { Icon } from '../ui/Icon';

type Tab = 'export' | 'import';

/** Import / export a playlist as a portable Base64 code. */
export function PlaylistTransferModal({
  open,
  onClose,
  playlist,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  playlist: Playlist;
  onImported: (playlistId: string) => void;
}) {
  const dispatch = useAppDispatch();
  const showAttribution = useAppSelector((s) => s.settings.showImportedAttribution);
  const [tab, setTab] = useState<Tab>('export');
  const [creator, setCreator] = useState(() => loadCreatorName());
  const [importCode, setImportCode] = useState('');
  const [preview, setPreview] = useState<DecodedPlaylist | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCreator(loadCreatorName());
  }, [open]);

  useEffect(() => {
    if (tab !== 'import') return;
    const value = importCode.trim();
    if (!value) {
      setPreview(null);
      setError(null);
      return;
    }
    try {
      setPreview(decodePlaylist(value));
      setError(null);
    } catch (caught) {
      setPreview(null);
      setError(caught instanceof Error ? caught.message : 'That code could not be read.');
    }
  }, [importCode, tab]);

  const code = useMemo(() => encodePlaylist(playlist, creator), [playlist, creator]);

  const copyCode = async () => {
    const copied = await copyText(code);
    dispatch(
      copied
        ? push('Playlist code copied — share it anywhere.', 'success')
        : push('Could not copy the code.', 'error'),
    );
  };

  const runImport = () => {
    if (!preview) return;
    const action = dispatch(
      importPlaylist({
        name: preview.name,
        reciter: preview.reciter,
        items: preview.items.map((item) => ({
          id: uid('it'),
          surah: item.surah,
          repeat: item.repeat,
          ...(item.loop ? { loop: item.loop } : {}),
        })),
        credit: { author: preview.author, importedAt: Date.now() },
      }),
    );
    const created = action.payload as Playlist;
    dispatch(push(`Imported “${created.name}”`, 'success'));
    setImportCode('');
    setPreview(null);
    onClose();
    onImported(created.id);
  };

  return (
    <Modal open={open} onClose={onClose} title="Import / export playlist" size="md" variant="frosted">
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-full bg-surface2 p-1">
        {(['export', 'import'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold capitalize transition-colors ${
              tab === value ? 'bg-accent text-onaccent' : 'text-mut hover:text-ink'
            }`}
          >
            <Icon name={value === 'export' ? 'share' : 'download'} size={14} />
            {value === 'export' ? 'Export' : 'Import'}
          </button>
        ))}
      </div>

      {tab === 'export' ? (
        <div className="space-y-4">
          <p className="text-xs leading-relaxed text-mut">
            Share this code with any Furqan listener. They paste it under <b className="text-ink">Import</b> to
            get the same queue, repeats and verse loops.
          </p>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-mut">
              Your name <span className="text-mut/70">(optional · shown as the creator)</span>
            </span>
            <input
              value={creator}
              maxLength={60}
              onChange={(event) => {
                setCreator(event.target.value);
                saveCreatorName(event.target.value);
              }}
              placeholder="e.g. Yusuf"
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-mut">Playlist code</span>
            <textarea
              readOnly
              value={code}
              rows={5}
              spellCheck={false}
              onFocus={(event) => event.currentTarget.select()}
              className="thin-scroll w-full resize-none break-all rounded-xl border border-line bg-surface2 px-3 py-2.5 font-mono text-[11px] leading-relaxed text-ink focus:border-accent focus:outline-none"
            />
          </label>

          <button
            type="button"
            onClick={() => void copyCode()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-onaccent pressable"
          >
            <Icon name="clipboard" size={16} />
            Copy to clipboard
          </button>
          <p className="text-center text-[10px] leading-relaxed text-mut">
            {playlist.items.length} surah{playlist.items.length === 1 ? '' : 's'} · {code.length} characters ·
            no account needed.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs leading-relaxed text-mut">
            Paste a playlist code below. Furqan checks it first and shows you exactly what will be added.
          </p>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-mut">Playlist code</span>
            <textarea
              value={importCode}
              rows={5}
              spellCheck={false}
              autoFocus
              placeholder="FQPL1.…"
              onChange={(event) => setImportCode(event.target.value)}
              className="thin-scroll w-full resize-none break-all rounded-xl border border-line bg-surface px-3 py-2.5 font-mono text-[11px] leading-relaxed text-ink focus:border-accent focus:outline-none"
            />
          </label>

          {error && importCode.trim().length > 0 && (
            <div className="flex items-start gap-2 rounded-xl bg-danger/10 px-3 py-2 text-[11px] leading-relaxed text-danger">
              <Icon name="warning" size={14} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {preview && (
            <div className="rounded-2xl border border-accent/30 bg-accent/6 p-3.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-accent">
                <Icon name="check" size={13} />
                Ready to import
              </div>
              <div className="mt-1.5 text-base font-semibold text-ink">{preview.name}</div>
              <div className="mt-0.5 text-xs text-mut">
                {preview.items.length} surah{preview.items.length === 1 ? '' : 's'} · reciter{' '}
                {reciterById(preview.reciter).label}
              </div>
              {showAttribution && (
                <div className="mt-2 text-[11px] italic text-mut">
                  Originally created by {preview.author ?? 'a Furqan listener'}
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={runImport}
            disabled={!preview}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-onaccent pressable disabled:opacity-40"
          >
            <Icon name="plus" size={16} />
            Add to my playlists
          </button>
          <p className="text-center text-[10px] leading-relaxed text-mut">
            Your current playlists are untouched; the import is added as a new playlist.
          </p>
        </div>
      )}
    </Modal>
  );
}
