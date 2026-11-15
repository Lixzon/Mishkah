import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import {
  isAyahLiked,
  isDuaLiked,
  isQuoteLiked,
  isSurahLiked,
  toggleLikedAyah,
  toggleLikedDua,
  toggleLikedQuote,
  toggleLikedSurah,
  type LikedAyahInput,
} from '../store/slices/likesSlice';
import { recordXpAction } from '../store/slices/progressSlice';
import { push } from '../store/slices/toastSlice';
import { copyText, shareContent, type SharePayload } from '../lib/share';

/**
 * One place for "the reader liked / copied / shared something": it flips the
 * state, tells the reader what happened, and credits the XP that only these
 * actions can earn.
 */

export interface LikeToggle {
  liked: boolean;
  toggle: () => void;
}

function useToggle(liked: boolean, toggle: () => void, label: string): LikeToggle {
  const dispatch = useAppDispatch();
  const onToggle = useCallback(() => {
    toggle();
    dispatch(push(liked ? `Removed from Favourites · ${label}` : `Added to Favourites · ${label}`, liked ? 'info' : 'success'));
  }, [dispatch, label, liked, toggle]);
  return { liked, toggle: onToggle };
}

export function useSurahLike(surah: number, label: string): LikeToggle {
  const dispatch = useAppDispatch();
  const liked = useAppSelector((s) => isSurahLiked(s.likes, surah));
  const toggle = useCallback(() => dispatch(toggleLikedSurah(surah)), [dispatch, surah]);
  return useToggle(liked, toggle, label);
}

export function useAyahLike(input: LikedAyahInput): LikeToggle {
  const dispatch = useAppDispatch();
  const liked = useAppSelector((s) => isAyahLiked(s.likes, input.surah, input.ayah));
  const toggle = useCallback(() => dispatch(toggleLikedAyah(input)), [dispatch, input]);
  return useToggle(liked, toggle, `${input.surahName} ${input.surah}:${input.ayah}`);
}

export function useDuaLike(id: string, label: string): LikeToggle {
  const dispatch = useAppDispatch();
  const liked = useAppSelector((s) => isDuaLiked(s.likes, id));
  const toggle = useCallback(() => dispatch(toggleLikedDua(id)), [dispatch, id]);
  return useToggle(liked, toggle, label);
}

export function useQuoteLike(id: string, label: string): LikeToggle {
  const dispatch = useAppDispatch();
  const liked = useAppSelector((s) => isQuoteLiked(s.likes, id));
  const toggle = useCallback(() => dispatch(toggleLikedQuote(id)), [dispatch, id]);
  return useToggle(liked, toggle, label);
}

export interface XpActions {
  /** Copy text the reader asked to copy (+{@link XP_RATES.perCopy} XP). */
  copy: (text: string, label?: string) => Promise<boolean>;
  /**
   * Share via the OS sheet, or the clipboard where no sheet exists. Both credit
   * the share rate: the fallback copy is the share being delivered, which is
   * what the reader asked for.
   */
  share: (payload: SharePayload, label?: string) => Promise<void>;
}

export function useXpActions(): XpActions {
  const dispatch = useAppDispatch();

  const copy = useCallback(
    async (text: string, label?: string) => {
      const copied = await copyText(text);
      if (!copied) {
        dispatch(push('Could not copy to the clipboard.', 'error'));
        return false;
      }
      dispatch(recordXpAction({ kind: 'copy' }));
      dispatch(push(label ? `Copied ${label}` : 'Copied to clipboard', 'success'));
      return true;
    },
    [dispatch],
  );

  const share = useCallback(
    async (payload: SharePayload, label?: string) => {
      const outcome = await shareContent(payload);
      if (outcome === 'cancelled') return;
      if (outcome === 'shared' || outcome === 'copied') {
        dispatch(recordXpAction({ kind: 'share' }));
        dispatch(push(outcome === 'shared' ? 'Shared' : `Copied ${label ?? 'to clipboard'}`, 'success'));
        return;
      }
      dispatch(push('Sharing is not available in this browser.', 'error'));
    },
    [dispatch],
  );

  return { copy, share };
}
