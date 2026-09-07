/**
 * Centralized design system tokens.
 * Every surface, motion curve and material in the app derives from here so the
 * Liquid-Glass language stays consistent (and tunable from Settings → Appearance).
 */
import type { Settings } from '../data/models';

/* motion ─────────────────────────────────────────────────────────────── */
export const SPRING = 'cubic-bezier(0.34, 1.46, 0.44, 1)';   // gentle overshoot
export const SPRING_SOFT = 'cubic-bezier(0.3, 1.28, 0.44, 1)';
export const EASE_OUT = 'cubic-bezier(0.22, 0.9, 0.3, 1)';
export const EASE_INOUT = 'cubic-bezier(0.6, 0.05, 0.28, 0.95)';

export const DUR = { tap: 140, base: 220, sheet: 320, page: 260, hero: 420 } as const;

const SPEED_FACTOR = { relaxed: 1.35, standard: 1, fast: 0.68 } as const;

/* radii / spacing scale ────────────────────────────────────────────────── */
export const RADIUS = { sm: 10, md: 16, lg: 22, xl: 30, capsule: 999 } as const;
export const SPACE = [0, 4, 8, 12, 16, 22, 30, 42] as const;

const LAYOUT_FACTOR = { comfortable: 1.14, standard: 1, compact: 0.86 } as const;

/** Pushes motion + glass + layout tokens onto :root as CSS custom properties. */
export function applyDesignVars(settings: Settings) {
  const root = document.documentElement.style;
  const f = settings.animations ? SPEED_FACTOR[settings.animSpeed] : 0;
  root.setProperty('--dur-tap', `${Math.round(DUR.tap * f)}ms`);
  root.setProperty('--dur-base', `${Math.round(DUR.base * f)}ms`);
  root.setProperty('--dur-sheet', `${Math.round(DUR.sheet * f)}ms`);
  root.setProperty('--dur-page', `${Math.round(DUR.page * f)}ms`);
  root.setProperty('--dur-hero', `${Math.round(DUR.hero * f)}ms`);
  root.setProperty('--spring', SPRING);
  root.setProperty('--spring-soft', SPRING_SOFT);
  root.setProperty('--ease-out', EASE_OUT);

  const g = settings.glass;
  root.setProperty('--glass-blur', `${Math.round(5 + g.blur * 0.3)}px`);
  root.setProperty('--glass-saturate', `${Math.round(120 + g.intensity * 0.7)}%`);
  // higher transparency → lower surface alpha
  const alpha = 0.86 - (g.transparency / 100) * 0.58;
  root.setProperty('--glass-alpha', alpha.toFixed(3));
  root.setProperty('--glass-hi', (0.1 + (g.intensity / 100) * 0.42).toFixed(3)); // highlight / border strength
  root.setProperty('--glass-shadow', (0.1 + (g.intensity / 100) * 0.3).toFixed(3));

  const lf = LAYOUT_FACTOR[settings.layout];
  root.setProperty('--space-1', `${Math.round(SPACE[1] * lf)}px`);
  root.setProperty('--space-2', `${Math.round(SPACE[2] * lf)}px`);
  root.setProperty('--space-3', `${Math.round(SPACE[3] * lf)}px`);
  root.setProperty('--space-4', `${Math.round(SPACE[4] * lf)}px`);
  root.setProperty('--space-5', `${Math.round(SPACE[5] * lf)}px`);
  root.setProperty('--space-6', `${Math.round(SPACE[6] * lf)}px`);
  root.setProperty('--radius-lg', `${Math.round(RADIUS.lg * (0.9 + lf * 0.1))}px`);
}
