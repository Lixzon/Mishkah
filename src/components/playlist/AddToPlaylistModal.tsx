import { useEffect, useState } from 'react';
import type { Playlist } from '../../types';
import { useAppDispatch, useAppSelector } from '../../store';
import { addItem, createPlaylist } from '../../store/slices/playlistSlice';
import { push } from '../../store/slices/toastSlice';
import { MAX_PLAYLIST_ITEMS } from '../../lib/constants';
import { Modal } from '../ui/Modal';
import { Icon } from '../ui/Icon';

/** Pick a playlist (or make one) and drop the current surah straight in. */
export function AddToPlaylistModal({
  open,
  onClose,
  surah,
  surahName,
}: {
  open: boolean;
  onClose: () => void;
  surah: number;
  surahName: string;
}) {
  const dispatch = useAppDispatch();
  const { playlists } = useAppSelector((s) => s.playlists);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (!open) setNewName('');
  }, [open]);

  const addTo = (playlist: Playlist) => {
    if (playlist.items.some((item) => item.surah === surah)) {
      dispatch(push(`${surahName} is already in “${playlist.name}”.`, 'error'));
      return;
    }
    if (playlist.items.length >= MAX_PLAYLIST_ITEMS) {
      dispatch(push(`Playlists hold up to ${MAX_PLAYLIST_ITEMS} surahs.`, 'error'));
      return;
    }
    dispatch(addItem({ playlistId: playlist.id, surah }));
    dispatch(push(`Added ${surahName} to “${playlist.name}”.`, 'success'));
    onClose();
  };

  const createAndAdd = () => {
    const name = newName.trim();
    if (!name) return;
    const action = dispatch(createPlaylist(name));
    const created = action.payload as Playlist;
    dispatch(addItem({ playlistId: created.id, surah }));
    dispatch(push(`Added ${surahName} to “${created.name}”.`, 'success'));
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Add to playlist" size="md" variant="frosted">
      <p className="text-xs leading-relaxed text-mut">
        Add <b className="text-ink">{surahName}</b> to one of your playlists. You can reorder, loop or repeat
        it later from the playlist screen.
      </p>

      <div className="thin-scroll mt-3 max-h-[42vh] space-y-1.5 overflow-y-auto pr-1">
        {playlists.length === 0 && (
          <p className="rounded-xl bg-surface2 px-3 py-2.5 text-xs text-mut">
            No playlists yet — create one below.
          </p>
        )}
        {playlists.map((playlist) => {
          const already = playlist.items.some((item) => item.surah === surah);
          const full = !already && playlist.items.length >= MAX_PLAYLIST_ITEMS;
          const disabled = already || full;
          return (
            <button
              key={playlist.id}
              type="button"
              disabled={disabled}
              onClick={() => addTo(playlist)}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left pressable ${
                disabled
                  ? 'border-transparent bg-surface2/60 opacity-60'
                  : 'border-line bg-surface hover:border-accent/40 hover:bg-accent/6'
              }`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/12 text-accent">
                <Icon name="list" size={15} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{playlist.name}</span>
                <span className="block text-[11px] text-mut">
                  {playlist.items.length}/{MAX_PLAYLIST_ITEMS} surahs
                  {already ? ' · already added' : full ? ' · full' : ''}
                </span>
              </span>
              {!disabled && <Icon name="plus" size={16} className="shrink-0 text-accent" />}
            </button>
          );
        })}
      </div>

      <div className="mt-4 border-t border-line pt-3">
        <div className="mb-1.5 text-xs font-medium text-mut">New playlist</div>
        <div className="flex items-center gap-2">
          <input
            value={newName}
            maxLength={60}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') createAndAdd();
            }}
            placeholder="e.g. Morning"
            className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          />
          <button
            type="button"
            disabled={!newName.trim()}
            onClick={createAndAdd}
            className="shrink-0 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-onaccent pressable disabled:opacity-40"
          >
            Create &amp; add
          </button>
        </div>
      </div>
    </Modal>
  );
}
