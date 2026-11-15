const PREFIX = 'furqan:';

/** Load persisted JSON, deep-merging object payloads over the fallback
 *  (so newly added fields keep their defaults). */
export function loadState<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && fallback && typeof fallback === 'object') {
      return { ...(fallback as object), ...(parsed as object) } as T;
    }
    return parsed;
  } catch {
    return fallback;
  }
}

export function saveState(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage may be unavailable (private mode) – ignore */
  }
}

/** Whether a slice has ever been written, as opposed to holding its defaults. */
export function hasState(key: string): boolean {
  try {
    return localStorage.getItem(PREFIX + key) !== null;
  } catch {
    return false;
  }
}

export function removeState(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

export const KEYS = {
  theme: 'theme',
  settings: 'settings',
  playlists: 'playlists',
  progress: 'progress',
  favorites: 'favorites',
  likes: 'likes',
  bookmarks: 'bookmarks',
  memorized: 'memorized',
} as const;
