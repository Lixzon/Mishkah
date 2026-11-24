import { useEffect } from 'react';
import { useAppSelector } from '../../store';
import { accentHex } from '../../lib/constants';
import { customAccentVars } from '../../lib/customTheme';

import type { ThemeMode } from '../../types';

/** Themes built on a dark palette, so `color-scheme` and on-accent ink follow. */
const DARK_MODES: ThemeMode[] = ['dark', 'oled', 'emerald', 'velvet', 'midnight'];

/** Themes that carry their own palette instead of resolving through light/dark. */
const EXPLICIT_MODES: ThemeMode[] = ['oled', 'sepia', 'midnight', 'emerald', 'velvet', 'golden'];

/** Applies the active theme (data-mode / data-accent + theme-color) to <html>. */
export function ThemeManager() {
  const mode = useAppSelector((s) => s.theme.mode);
  const accent = useAppSelector((s) => s.theme.accent);
  const customAccent = useAppSelector((s) => s.theme.customAccent);
  const assistantLayout = useAppSelector((s) => s.settings.assistantLayout);
  const fontFamily = useAppSelector((s) => s.settings.fontFamily);
  const reducedMotion = useAppSelector((s) => s.settings.reducedMotion);
  const streak = useAppSelector((s) => s.progress.progression.currentStreak);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const prefersDark = mq.matches;
      // Velvet and Midnight Blue are dark-family themes; Golden is a light one.
      const dark = DARK_MODES.includes(mode) || (mode === 'system' && prefersDark);
      const root = document.documentElement;
      root.dataset.mode = EXPLICIT_MODES.includes(mode) ? mode : dark ? 'dark' : 'light';
      root.dataset.accent = accent;
      root.dataset.fontFamily = fontFamily;
      root.dataset.reducedMotion = String(reducedMotion);

      // The layout falls back to classic when not explicitly set,
      // and custom accents are not applied outside the AI UI gate.
      root.dataset.assistantLayout = assistantLayout;

      const custom = customAccent ? customAccentVars(customAccent) : null;
      if (custom) {
        // Inline custom properties outrank the [data-accent] palette rules,
        // which is exactly what a reader-built accent needs.
        root.style.setProperty('--q-accent', custom.accent);
        root.style.setProperty('--q-accent-strong', custom.strong);
        root.style.setProperty('--q-on-accent', custom.on);
      } else {
        root.style.removeProperty('--q-accent');
        root.style.removeProperty('--q-accent-strong');
        root.style.removeProperty('--q-on-accent');
      }

      root.style.colorScheme = dark ? 'dark' : 'light';
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', custom?.accent ?? accentHex(accent, dark));
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [mode, accent, customAccent, assistantLayout, streak, fontFamily, reducedMotion]);

  return null;
}
