import { useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store';
import { player } from '../audio/controller';
import {
  addItem,
  moveItem,
  removeItem,
  renamePlaylist,
  setActive,
  setItemLoop,
  setItemRepeat,
  setItemSurah,
  setPlaylistReciter,
} from '../store/slices/playlistSlice';
import { push } from '../store/slices/toastSlice';
import { useQuran } from '../data/QuranProvider';
import { SurahPicker } from '../components/surah/SurahPicker';
import { PlaylistItemSheet } from '../components/playlist/PlaylistItemSheet';
import { PlaylistTransferModal } from '../components/playlist/PlaylistTransferModal';
import { useLongPressReorder } from '../components/playlist/useLongPressReorder';
import { Modal } from '../components/ui/Modal';
import { Icon } from '../components/ui/Icon';
import { EmptyState } from '../components/ui/common';
import { RECITERS, MAX_PLAYLIST_ITEMS } from '../lib/constants';
import { surahNumberToArabic } from '../lib/utils';
import type { PlaylistItem } from '../types';

interface PickerState {
  target: 'add' | 'replace';
  itemId?: string;
}

export default function PlaylistDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const playlist = useAppSelector((s) => s.playlists.playlists.find((p) => p.id === id));
  const playerState = useAppSelector((s) => s.player);
  const showImportedAttribution = useAppSelector((s) => s.settings.showImportedAttribution);
  const quran = useQuran();

  const [picker, setPicker] = useState<PickerState | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameVal, setRenameVal] = useState('');
  const [menuItemId, setMenuItemId] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);

  const reorder = useLongPressReorder({
    count: playlist?.items.length ?? 0,
    onReorder: (from, to) => {
      if (!playlist) return;
      dispatch(moveItem({ playlistId: playlist.id, from, to }));
    },
  });

  if (!playlist) {
    return (
      <div className="page-enter">
        <EmptyState
          icon="list"
          title="Playlist not found"
          message="It may have been deleted."
          action={
            <button
              type="button"
              onClick={() => navigate('/playlists')}
              className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-onaccent"
            >
              Back to playlists
            </button>
          }
        />
      </div>
    );
  }

  const inList = new Set(playlist.items.map((it) => it.surah));
  const playingHere = playerState.playlistId === playlist.id;
  const currentQueueSurah =
    playingHere && playerState.order.length > 0
      ? playerState.queue[playerState.order[playerState.pos]]
      : null;

  const menuItem = menuItemId ? playlist.items.find((it) => it.id === menuItemId) ?? null : null;
  const menuMeta = menuItem ? quran.surahById(menuItem.surah) : undefined;
  const menuIsCurrent = Boolean(menuItem) && currentQueueSurah === menuItem?.surah;

  const playItem = (index: number, item: PlaylistItem) => {
    if (currentQueueSurah === item.surah) {
      player.togglePlay();
      return;
    }
    let queueIndex = 0;
    for (let i = 0; i < index; i++) queueIndex += Math.max(1, playlist.items[i].repeat);
    dispatch(setActive(playlist.id));
    player.startPlaylist(playlist, queueIndex);
    dispatch(
      push(
        `Playing “${quran.surahById(item.surah)?.englishName ?? `Surah ${item.surah}`}”`,
        'success',
      ),
    );
  };

  const start = () => {
    dispatch(setActive(playlist.id));
    if (playlist.items.length === 0) {
      dispatch(push('Add a surah to play this playlist.', 'error'));
      return;
    }
    player.startPlaylist(playlist);
    dispatch(push(`Playing “${playlist.name}”`, 'success'));
    navigate('/player');
  };

  const handlePick = (surah: number) => {
    if (!picker) return;
    if (picker.target === 'add') {
      if (inList.has(surah)) {
        dispatch(push('That surah is already in this playlist.', 'error'));
        setPicker(null);
        return;
      }
      if (playlist.items.length >= MAX_PLAYLIST_ITEMS) {
        dispatch(push(`Playlists hold up to ${MAX_PLAYLIST_ITEMS} surahs.`, 'error'));
        setPicker(null);
        return;
      }
      dispatch(addItem({ playlistId: playlist.id, surah }));
    } else if (picker.itemId) {
      if (playlist.items.some((it) => it.id !== picker.itemId && it.surah === surah)) {
        dispatch(push('That surah is already in this playlist.', 'error'));
        setPicker(null);
        return;
      }
      dispatch(setItemSurah({ playlistId: playlist.id, itemId: picker.itemId, surah }));
    }
    setPicker(null);
  };

  const move = (from: number, to: number) => {
    const len = playlist.items.length;
    if (from < 0 || from >= len || to < 0 || to >= len || from === to) return;
    dispatch(moveItem({ playlistId: playlist.id, from, to }));
  };

  const applyItemLoop = (from: number, to: number) => {
    if (!menuItem) return;
    dispatch(
      setItemLoop({ playlistId: playlist.id, itemId: menuItem.id, loop: { start: from, end: to } }),
    );
    if (menuIsCurrent) {
      player.setVerseRange(from, to);
      dispatch(push('Verse loop active.', 'success'));
    } else {
      dispatch(push('Loop saved — it starts when this surah plays.', 'success'));
    }
    setMenuItemId(null);
  };

  const clearItemLoop = () => {
    if (!menuItem) return;
    dispatch(setItemLoop({ playlistId: playlist.id, itemId: menuItem.id, loop: null }));
    if (menuIsCurrent) player.clearVerseRange();
    setMenuItemId(null);
    dispatch(push('Verse loop removed.', 'info'));
  };

  const playNext = () => {
    if (!menuItem) return;
    const index = playlist.items.findIndex((it) => it.id === menuItem.id);
    move(index, 0);
    dispatch(push('Moved to play next.', 'success'));
  };

  return (
    <div className="page-enter">
      {/* header */}
      <button
        type="button"
        onClick={() => navigate('/playlists')}
        className="pressable mb-3 inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-sm font-medium text-mut hover:bg-surface2 hover:text-ink"
      >
        <Icon name="back" size={18} />
        Playlists
      </button>

      <div className="relative overflow-hidden rounded-3xl bg-surface p-5">
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-accent/10" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-accent">Playlist</div>
            <h1 className="mt-1 text-2xl font-bold text-ink">{playlist.name}</h1>
            <div className="mt-1 text-sm text-mut">
              {playlist.items.length}/{MAX_PLAYLIST_ITEMS} slots ·{' '}
              {playlist.items.reduce((s, it) => s + it.repeat, 0)} total plays per pass
            </div>
            {showImportedAttribution && playlist.credit && (
              <div className="mt-1.5 text-[11px] italic text-mut">
                Originally created by {playlist.credit.author ?? 'a Furqan listener'}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Import or export playlist"
              title="Import / export"
              onClick={() => setTransferOpen(true)}
              className="pressable rounded-full p-2 text-mut hover:bg-surface2 hover:text-ink"
            >
              <Icon name="transfer" size={18} />
            </button>
            <button
              type="button"
              aria-label="Rename playlist"
              onClick={() => {
                setRenameVal(playlist.name);
                setRenameOpen(true);
              }}
              className="pressable rounded-full p-2 text-mut hover:bg-surface2 hover:text-ink"
            >
              <Icon name="edit" size={18} />
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className="text-xs font-medium text-mut">Reciter</label>
          <select
            value={playlist.reciter}
            onChange={(e) => dispatch(setPlaylistReciter({ id: playlist.id, reciter: e.target.value }))}
            className="max-w-[16rem] rounded-full border border-line bg-surface2 px-3 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
          >
            {RECITERS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={start}
            className="ml-auto inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-onaccent pressable"
          >
            <Icon name={playingHere && playerState.isPlaying ? 'pause' : 'play'} size={18} />
            {playingHere && playerState.isPlaying ? 'Pause' : 'Play playlist'}
          </button>
        </div>
      </div>

      {/* items */}
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">Queue order</h2>
          <span className="text-right text-[11px] text-mut">
            hold &amp; drag to reorder · tap a name to change it
          </span>
        </div>

        {playlist.items.length === 0 ? (
          <EmptyState
            icon="plus"
            title="Empty playlist"
            message={`Add up to ${MAX_PLAYLIST_ITEMS} surahs in any order. Each one can repeat a set number of times before the next begins.`}
            action={
              <button
                type="button"
                onClick={() => setPicker({ target: 'add' })}
                className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-onaccent"
              >
                Add first surah
              </button>
            }
          />
        ) : (
          <div className={`space-y-2 ${reorder.dragIndex !== null ? 'touch-none' : ''}`}>
            {playlist.items.map((item, idx) => {
              const meta = quran.surahById(item.surah);
              return (
                <PlaylistRow
                  key={item.id}
                  item={item}
                  metaName={meta?.englishName ?? `Surah ${item.surah}`}
                  metaAr={meta?.name ?? ''}
                  isCurrent={currentQueueSurah === item.surah}
                  isPlaying={currentQueueSurah === item.surah && playerState.isPlaying}
                  dragging={reorder.dragIndex === idx}
                  dropTarget={
                    reorder.dragIndex !== null &&
                    reorder.dragIndex !== idx &&
                    reorder.hoverIndex === idx
                  }
                  rowRef={reorder.registerRow(idx)}
                  onPointerDown={reorder.onPointerDown(idx)}
                  shouldIgnoreClick={reorder.shouldIgnoreClick}
                  onPlay={() => playItem(idx, item)}
                  onMenu={() => setMenuItemId(item.id)}
                  onChangeSurah={() => setPicker({ target: 'replace', itemId: item.id })}
                  onMoveUp={() => move(idx, idx - 1)}
                  onMoveDown={() => move(idx, idx + 1)}
                />
              );
            })}
          </div>
        )}
      </div>

      {playlist.items.length < MAX_PLAYLIST_ITEMS && (
        <button
          type="button"
          onClick={() => setPicker({ target: 'add' })}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line2 py-3 text-sm font-medium text-mut pressable hover:border-accent hover:text-accent"
        >
          <Icon name="plus" size={18} />
          Add surah ({playlist.items.length}/{MAX_PLAYLIST_ITEMS})
        </button>
      )}

      <div className="mt-6 rounded-2xl bg-surface2/60 p-4 text-xs leading-relaxed text-mut">
        <div className="mb-1 flex items-center gap-1.5 font-semibold text-ink">
          <Icon name="info" size={14} className="text-accent" />
          Playlist tips
        </div>
        Hold a row to drag it into a new position. Open <b>⋮</b> on any surah for verse looping,
        repeats, playback speed, play next, or removal. <b>Shuffle</b> and <b>repeat all</b> stay in
        the player.
      </div>

      {/* surah picker */}
      <SurahPicker
        open={picker !== null}
        onClose={() => setPicker(null)}
        onPick={handlePick}
        disabled={picker?.target === 'add' ? inList : undefined}
        title={picker?.target === 'replace' ? 'Replace with…' : 'Add a surah'}
      />

      {/* per-surah options */}
      <PlaylistItemSheet
        open={menuItem !== null}
        item={menuItem}
        surahName={
          menuItem ? menuMeta?.englishName ?? `Surah ${menuItem.surah}` : ''
        }
        ayahCount={menuItem ? menuMeta?.numberOfAyahs ?? 0 : 0}
        playbackRate={playerState.playbackRate}
        isCurrent={menuIsCurrent}
        activeLoop={Boolean(playerState.range)}
        onClose={() => setMenuItemId(null)}
        onApplyLoop={applyItemLoop}
        onClearLoop={clearItemLoop}
        onRepeat={(repeat) => {
          if (!menuItem) return;
          dispatch(setItemRepeat({ playlistId: playlist.id, itemId: menuItem.id, repeat }));
        }}
        onPlayNext={playNext}
        onRemove={() => {
          if (!menuItem) return;
          dispatch(removeItem({ playlistId: playlist.id, itemId: menuItem.id }));
          setMenuItemId(null);
        }}
      />

      <PlaylistTransferModal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        playlist={playlist}
        onImported={(playlistId) => navigate(`/playlist/${playlistId}`)}
      />

      {/* rename modal */}
      <Modal open={renameOpen} onClose={() => setRenameOpen(false)} title="Rename playlist">
        <input
          autoFocus
          value={renameVal}
          onChange={(e) => setRenameVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              dispatch(renamePlaylist({ id: playlist.id, name: renameVal }));
              setRenameOpen(false);
            }
          }}
          className="w-full rounded-xl border border-line bg-surface2 px-4 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setRenameOpen(false)}
            className="rounded-full px-4 py-2 text-sm font-medium text-mut hover:bg-surface2"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!renameVal.trim()}
            onClick={() => {
              dispatch(renamePlaylist({ id: playlist.id, name: renameVal }));
              setRenameOpen(false);
            }}
            className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-onaccent disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </Modal>
    </div>
  );
}

/* ============================ playlist row ============================ */
function PlaylistRow({
  item,
  metaName,
  metaAr,
  isCurrent,
  isPlaying,
  dragging,
  dropTarget,
  rowRef,
  onPointerDown,
  shouldIgnoreClick,
  onPlay,
  onMenu,
  onChangeSurah,
  onMoveUp,
  onMoveDown,
}: {
  item: PlaylistItem;
  metaName: string;
  metaAr: string;
  isCurrent: boolean;
  isPlaying: boolean;
  dragging: boolean;
  dropTarget: boolean;
  rowRef: (element: HTMLDivElement | null) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  shouldIgnoreClick: () => boolean;
  onPlay: () => void;
  onMenu: () => void;
  onChangeSurah: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const loop = item.loop;
  return (
    <div
      ref={rowRef}
      role="listitem"
      tabIndex={0}
      data-dragging={dragging ? 'true' : undefined}
      data-drop-target={dropTarget ? 'true' : undefined}
      onPointerDown={onPointerDown}
      onClick={() => {
        if (!shouldIgnoreClick()) onChangeSurah();
      }}
      onKeyDown={(event) => {
        if (!event.altKey) return;
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          onMoveUp();
        } else if (event.key === 'ArrowDown') {
          event.preventDefault();
          onMoveDown();
        }
      }}
      aria-label={`${metaName}, surah ${item.surah}. Hold and drag to reorder.`}
      className={`relative flex touch-manipulation select-none items-center gap-1.5 rounded-2xl border p-2 transition-[transform,background-color,border-color,box-shadow] duration-150 ${
        isCurrent ? 'border-accent/40 bg-accent/6' : 'border-transparent bg-surface'
      } ${dragging ? 'playlist-row-dragging z-10 border-accent/50 bg-surface3' : ''} ${
        dropTarget ? 'playlist-row-dropzone' : ''
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold ${
            isCurrent ? 'bg-accent text-onaccent' : 'bg-accent/12 text-accent'
          }`}
        >
          {surahNumberToArabic(item.surah)}
        </div>
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="truncate text-sm font-semibold text-ink">{metaName}</span>
            <span className="shrink-0 text-[11px] tabular-nums text-mut">#{item.surah}</span>
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-mut">
            <span className="truncate" style={{ direction: 'rtl' }}>
              {metaAr}
            </span>
            {item.repeat > 1 && <span className="shrink-0">· ×{item.repeat}</span>}
            {loop && (
              <span className="shrink-0 rounded-full bg-accent/12 px-1.5 py-0.5 font-semibold text-accent">
                {loop.start === loop.end
                  ? `Ayah ${loop.start + 1}`
                  : `Ayat ${loop.start + 1}–${loop.end + 1}`}
              </span>
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        aria-label={isPlaying ? `Pause ${metaName}` : `Play ${metaName}`}
        title={isPlaying ? 'Pause' : 'Play'}
        onClick={(event) => {
          event.stopPropagation();
          onPlay();
        }}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full pressable ${
          isCurrent ? 'bg-accent text-onaccent shadow-card' : 'bg-surface2 text-accent hover:bg-accent/15'
        }`}
      >
        <Icon name={isPlaying ? 'pause' : 'play'} size={17} />
      </button>

      <button
        type="button"
        aria-label={`More options for ${metaName}`}
        title="More"
        aria-haspopup="dialog"
        onClick={(event) => {
          event.stopPropagation();
          onMenu();
        }}
        className="flex h-9 w-8 shrink-0 items-center justify-center rounded-full text-mut pressable hover:bg-surface2 hover:text-ink"
      >
        <Icon name="more" size={18} />
      </button>
    </div>
  );
}