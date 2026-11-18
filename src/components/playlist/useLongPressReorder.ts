import { useCallback, useEffect, useRef, useState } from 'react';

/** Hold this long to pick a row up with a finger. */
const LONG_PRESS_MS = 320;
/** Moving further than this before the hold completes means "scroll", not "drag". */
const TOUCH_CANCEL_PX = 10;
/** A mouse can start dragging straight away. */
const MOUSE_START_PX = 6;

interface PressState {
  index: number;
  pointerId: number;
  startX: number;
  startY: number;
  active: boolean;
  touch: boolean;
  timer: number | null;
}

/**
 * Long-press (touch) / press-and-move (mouse) reordering for a vertical list.
 * Rows register themselves; the hook reports the row being dragged and the
 * row currently under the pointer so the caller can paint a drop target.
 */
export function useLongPressReorder({
  count,
  onReorder,
}: {
  count: number;
  onReorder: (from: number, to: number) => void;
}) {
  const rows = useRef<Array<HTMLElement | null>>([]);
  const press = useRef<PressState | null>(null);
  const hover = useRef<number | null>(null);
  const suppressClickUntil = useRef(0);
  const countRef = useRef(count);
  countRef.current = count;
  const reorderRef = useRef(onReorder);
  reorderRef.current = onReorder;

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const clearPress = useCallback(() => {
    if (press.current?.timer != null) window.clearTimeout(press.current.timer);
    press.current = null;
  }, []);

  const finish = useCallback((commit: boolean) => {
    const state = press.current;
    clearPress();
    if (!state) return;
    const target = hover.current;
    hover.current = null;
    setDragIndex(null);
    setHoverIndex(null);
    document.body.classList.remove('is-reordering');
    if (commit && state.active) {
      // A long-press is not a tap: never let it open the surah picker.
      suppressClickUntil.current = Date.now() + 350;
      if (target !== null && target !== state.index) {
        reorderRef.current(state.index, target);
      }
    }
  }, [clearPress]);

  const activate = useCallback((state: PressState) => {
    state.active = true;
    hover.current = state.index;
    setDragIndex(state.index);
    setHoverIndex(state.index);
    document.body.classList.add('is-reordering');
    navigator.vibrate?.(10);
  }, []);

  const onPointerDown = useCallback(
    (index: number) => (event: React.PointerEvent<HTMLElement>) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if ((event.target as HTMLElement).closest('button, a, input, select, textarea')) return;
      clearPress();
      const state: PressState = {
        index,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        active: false,
        touch: event.pointerType !== 'mouse',
        timer: null,
      };
      press.current = state;
      if (state.touch) {
        state.timer = window.setTimeout(() => {
          if (press.current !== state || state.active) return;
          state.timer = null;
          activate(state);
        }, LONG_PRESS_MS);
      }
    },
    [activate, clearPress],
  );

  useEffect(() => {
    const findTarget = (clientY: number) => {
      let target = 0;
      for (let i = 0; i < countRef.current; i++) {
        const el = rows.current[i];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (clientY < rect.top + rect.height / 2) return i;
        target = i;
      }
      return target;
    };

    const onMove = (event: PointerEvent) => {
      const state = press.current;
      if (!state || event.pointerId !== state.pointerId) return;
      if (!state.active) {
        const dx = event.clientX - state.startX;
        const dy = event.clientY - state.startY;
        const distance = Math.hypot(dx, dy);
        if (state.touch) {
          if (distance > TOUCH_CANCEL_PX) clearPress();
          return;
        }
        if (distance <= MOUSE_START_PX) return;
        activate(state);
      }
      event.preventDefault();
      const next = findTarget(event.clientY);
      if (next !== hover.current) {
        hover.current = next;
        setHoverIndex(next);
      }
    };

    /**
     * `touchmove` is the only event whose preventDefault reliably stops a
     * touch scroll, so the drag keeps the page still while a row is lifted.
     */
    const onTouchMove = (event: TouchEvent) => {
      const state = press.current;
      if (!state) return;
      const touch = event.touches[0];
      if (!state.active) {
        if (
          touch &&
          Math.hypot(touch.clientX - state.startX, touch.clientY - state.startY) > TOUCH_CANCEL_PX
        ) {
          clearPress();
        }
        return;
      }
      if (event.cancelable) event.preventDefault();
    };

    const onUp = (event: PointerEvent) => {
      const state = press.current;
      if (!state || event.pointerId !== state.pointerId) return;
      finish(true);
    };

    const onCancel = (event: PointerEvent) => {
      const state = press.current;
      if (!state || event.pointerId !== state.pointerId) return;
      finish(false);
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      document.body.classList.remove('is-reordering');
    };
  }, [activate, clearPress, finish]);

  const registerRow = useCallback(
    (index: number) => (element: HTMLElement | null) => {
      rows.current[index] = element;
    },
    [],
  );

  const shouldIgnoreClick = useCallback(() => Date.now() < suppressClickUntil.current, []);

  return { registerRow, onPointerDown, dragIndex, hoverIndex, shouldIgnoreClick };
}
