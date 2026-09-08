/**
 * GlassPopupMenu — the Liquid-Glass popup behind every hamburger menu.
 * Anchored to its trigger button, opens with a scale/fade/slide spring,
 * closes on outside tap, Escape or item activation. One backdrop-blur layer
 * only (performance budget — §20).
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '../core/icons';
import { haptic } from '../core/haptics';

export interface PopupMenuItem {
  icon?: string;
  label: string;
  onClick?: () => void;
  checked?: boolean;
  danger?: boolean;
  disabled?: boolean;
  hint?: string;
}

interface Pos { top: number; right: number }

export function GlassPopupMenu({ items, anchorRect, onClose, title }: {
  items: PopupMenuItem[];
  anchorRect: DOMRect | null;
  onClose: () => void;
  title?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Pos | null>(null);

  useLayoutEffect(() => {
    if (!anchorRect) return;
    const right = Math.max(10, window.innerWidth - anchorRect.right);
    let top = anchorRect.bottom + 10;
    // flip above if it would overflow the viewport
    const est = items.length * 48 + 30;
    if (top + est > window.innerHeight - 12) top = Math.max(12, anchorRect.top - est - 10);
    setPos({ top, right });
  }, [anchorRect, items.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!pos) return null;

  return (
    <div className="popup-scrim" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={ref}
        className="glass-popup glass glass-strong"
        style={{ top: pos.top, right: pos.right }}
        role="menu"
        aria-modal="false"
      >
        {title && <span className="popup-title">{title}</span>}
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            className={`popup-item${item.danger ? ' danger' : ''}${item.disabled ? ' disabled' : ''}`}
            onPointerDown={() => !item.disabled && haptic('tap')}
            onClick={() => {
              if (item.disabled) return;
              onClose();
              // defer so the menu closes before heavy navigation renders
              setTimeout(() => item.onClick?.(), 0);
            }}
          >
            {item.icon && <span className="popup-ico"><Icon name={item.icon} size={18} /></span>}
            <span className="grow">
              {item.label}
              {item.hint && <em>{item.hint}</em>}
            </span>
            {item.checked && <Icon name="check" size={16} className="popup-check" />}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Convenience hook: manages the open state + anchor rect for a trigger button. */
export function usePopupAnchor() {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const open = rect !== null;
  const toggle = () => {
    if (rect) { setRect(null); return; }
    haptic('tap');
    setRect(btnRef.current?.getBoundingClientRect() ?? null);
  };
  const close = () => setRect(null);
  return { btnRef, rect, open, toggle, close };
}
