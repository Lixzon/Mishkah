import type { Playlist, PlaylistItem } from '../types';
import { DEFAULT_RECITER, MAX_PLAYLIST_ITEMS, RECITERS } from './constants';

/**
 * Portable playlist codes.
 *
 * A code is plain Base64 over a small JSON document, so it can be pasted into
 * any chat and stays human-inspectable after decoding. Validation is strict:
 * an imported code can only ever produce a playlist with known surah numbers,
 * sane repeat counts and loops that fit inside the surah.
 */

const CODE_PREFIX = 'FQPL1.';
const PAYLOAD_TYPE = 'furqan.playlist';
const MAX_CODE_LENGTH = 6000;
const MAX_NAME_LENGTH = 60;
const MAX_AUTHOR_LENGTH = 60;
const MAX_REPEAT = 99;
const MAX_AYAH_INDEX = 300;
const CREATOR_NAME_KEY = 'furqan:playlist-credit-name';

interface SharedItem {
  /** surah number 1..114 */
  s: number;
  /** repeat count */
  r: number;
  /** 0-based inclusive loop window */
  l?: [number, number];
}

interface SharedPayload {
  t: typeof PAYLOAD_TYPE;
  v: 1;
  n: string;
  r: string;
  a?: string;
  i: SharedItem[];
}

export interface DecodedPlaylist {
  name: string;
  reciter: string;
  author: string | null;
  items: Array<Pick<PlaylistItem, 'surah' | 'repeat' | 'loop'>>;
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(encoded: string): string {
  const binary = atob(encoded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Build a shareable code for a playlist. */
export function encodePlaylist(playlist: Playlist, author?: string | null): string {
  const payload: SharedPayload = {
    t: PAYLOAD_TYPE,
    v: 1,
    n: playlist.name.trim().slice(0, MAX_NAME_LENGTH) || 'Playlist',
    r: playlist.reciter,
    i: playlist.items.slice(0, MAX_PLAYLIST_ITEMS).map((item) => {
      const shared: SharedItem = { s: item.surah, r: clamp(Math.round(item.repeat), 1, MAX_REPEAT) };
      if (item.loop) shared.l = [item.loop.start, item.loop.end];
      return shared;
    }),
  };
  const name = author?.trim().slice(0, MAX_AUTHOR_LENGTH);
  if (name) payload.a = name;
  return `${CODE_PREFIX}${toBase64(JSON.stringify(payload))}`;
}

/** Decode and validate a pasted code. Throws a user-facing message on bad input. */
export function decodePlaylist(raw: string): DecodedPlaylist {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error('Paste a playlist code first.');
  if (trimmed.length > MAX_CODE_LENGTH) throw new Error('That code is too long to be a playlist.');

  const body = (trimmed.startsWith(CODE_PREFIX) ? trimmed.slice(CODE_PREFIX.length) : trimmed)
    .replace(/\s+/g, '');
  if (!body) throw new Error('That code is empty.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(fromBase64(body));
  } catch {
    throw new Error('That does not look like a Furqan playlist code.');
  }

  if (!isRecord(parsed) || parsed.t !== PAYLOAD_TYPE || parsed.v !== 1) {
    throw new Error('That code is not a Furqan playlist.');
  }

  const name = typeof parsed.n === 'string' ? parsed.n.trim().slice(0, MAX_NAME_LENGTH) : '';
  const author = typeof parsed.a === 'string' ? parsed.a.trim().slice(0, MAX_AUTHOR_LENGTH) : '';
  const reciterId = typeof parsed.r === 'string' ? parsed.r : '';
  const reciter = RECITERS.some((item) => item.id === reciterId) ? reciterId : DEFAULT_RECITER;

  if (!Array.isArray(parsed.i) || parsed.i.length === 0) {
    throw new Error('This playlist has no surahs to import.');
  }

  const seen = new Set<number>();
  const items: DecodedPlaylist['items'] = [];
  for (const entry of parsed.i.slice(0, MAX_PLAYLIST_ITEMS)) {
    if (!isRecord(entry)) continue;
    const surah = Number(entry.s);
    if (!Number.isInteger(surah) || surah < 1 || surah > 114 || seen.has(surah)) continue;
    seen.add(surah);
    const repeat = Number.isFinite(Number(entry.r))
      ? clamp(Math.round(Number(entry.r)), 1, MAX_REPEAT)
      : 1;
    const item: DecodedPlaylist['items'][number] = { surah, repeat };
    if (Array.isArray(entry.l) && entry.l.length === 2) {
      const start = Number(entry.l[0]);
      const end = Number(entry.l[1]);
      if (Number.isInteger(start) && Number.isInteger(end)) {
        const low = clamp(Math.min(start, end), 0, MAX_AYAH_INDEX);
        const high = clamp(Math.max(start, end), 0, MAX_AYAH_INDEX);
        item.loop = { start: low, end: high };
      }
    }
    items.push(item);
  }

  if (items.length === 0) throw new Error('This playlist code has no valid surahs.');

  return {
    name: name || 'Imported playlist',
    reciter,
    author: author || null,
    items,
  };
}

/** Creator name remembered between exports, so it is typed once. */
export function loadCreatorName(): string {
  try {
    return localStorage.getItem(CREATOR_NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveCreatorName(name: string): void {
  try {
    const trimmed = name.trim().slice(0, MAX_AUTHOR_LENGTH);
    if (trimmed) localStorage.setItem(CREATOR_NAME_KEY, trimmed);
    else localStorage.removeItem(CREATOR_NAME_KEY);
  } catch {
    /* attribution is optional; storage may be unavailable */
  }
}
