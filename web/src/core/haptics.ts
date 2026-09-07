/** Haptic feedback — vibrates where the platform supports it, silently no-ops elsewhere. */
import { getState } from '../store';

type Kind = 'tap' | 'select' | 'success' | 'dismiss';

const PATTERNS: Record<Kind, number | number[]> = {
  tap: 8,
  select: 14,
  success: [10, 30, 18],
  dismiss: 6,
};

export function haptic(kind: Kind = 'tap') {
  try {
    if (!getState().settings.haptics) return;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(PATTERNS[kind]);
  } catch { /* unsupported */ }
}
