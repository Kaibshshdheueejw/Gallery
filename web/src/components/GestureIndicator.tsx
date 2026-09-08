/**
 * GestureIndicator — the temporary Liquid-Glass HUD shown while a video
 * gesture is active (§13): brightness on the left edge, volume on the
 * right edge, seek along the bottom centre.
 *
 * Appears quickly, tracks the finger in real time, animates its bar fill,
 * and auto-dismisses ~700ms after the gesture ends. Pure transform/opacity
 * animation — no layout work per frame.
 */
import { useEffect, useState } from 'react';
import { Icon } from '../core/icons';

export type GestureKind = 'brightness' | 'volume' | 'seek';

export interface GestureState {
  kind: GestureKind;
  value: number;   // 0..1 for brightness/volume; seek uses value as fraction too
  label?: string;  // seek: "+3s" style label
}

export function GestureIndicator({ state }: { state: GestureState | null }) {
  const [shown, setShown] = useState<GestureState | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (state) {
      setShown(state);
      setLeaving(false);
      return undefined;
    }
    if (shown) {
      setLeaving(true);
      const id = setTimeout(() => { setShown(null); setLeaving(false); }, 260);
      return () => clearTimeout(id);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (!shown) return null;

  const pct = Math.round(Math.max(0, Math.min(1, shown.value)) * 100);
  const isSeek = shown.kind === 'seek';
  const side = shown.kind === 'brightness' ? 'left' : shown.kind === 'volume' ? 'right' : 'bottom';
  const icon = shown.kind === 'brightness' ? (pct < 40 ? 'moon' : 'sun') : shown.kind === 'volume' ? (pct === 0 ? 'volumeOff' : 'volume') : 'clock';

  return (
    <div className={`gesture-indicator ${side}${leaving ? ' leaving' : ''}`} aria-hidden="true">
      {isSeek ? (
        <div className="gi-horizontal glass glass-strong">
          <Icon name={icon} size={16} />
          <span className="gi-seek-label">{shown.label ?? ''}</span>
          <div className="gi-track h"><div className="gi-fill" style={{ width: `${pct}%` }} /></div>
        </div>
      ) : (
        <div className="gi-vertical glass glass-strong">
          <Icon name={icon} size={18} />
          <div className="gi-track">
            <div className="gi-fill" style={{ height: `${pct}%` }} />
          </div>
          <strong>{pct}%</strong>
        </div>
      )}
    </div>
  );
}
