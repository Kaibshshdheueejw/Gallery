import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from '../core/icons';
import { dismissToast, useApp } from '../store';

export function IconButton({ icon, label, onClick, filled, size = 22, disabled, className, active }: {
  icon: string; label: string; onClick?: (e: React.MouseEvent) => void; filled?: boolean; size?: number; disabled?: boolean; className?: string; active?: boolean;
}) {
  return (
    <button
      type="button"
      className={`icon-btn${active ? ' active' : ''}${className ? ` ${className}` : ''}`}
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={icon} size={size} filled={filled} />
    </button>
  );
}

export function Sheet({ title, onClose, children, wide }: { title?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="scrim" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`sheet${wide ? ' wide' : ''}`} role="dialog" aria-modal="true">
        <div className="sheet-grip" />
        {title && (
          <div className="sheet-head">
            <h3>{title}</h3>
            <IconButton icon="close" label="Close" onClick={onClose} />
          </div>
        )}
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="scrim center" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog glass glass-strong" role="dialog" aria-modal="true">
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: {
  value: T; options: Array<{ id: T; label: string; icon?: string }>; onChange: (v: T) => void;
}) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button key={o.id} type="button" className={o.id === value ? 'on' : ''} onClick={() => onChange(o.id)}>
          {o.icon && <Icon name={o.icon} size={16} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SliderRow({ label, value, min, max, step = 1, onChange, format }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; format?: (v: number) => string;
}) {
  return (
    <label className="slider-row">
      <span className="slider-label">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="slider-value">{format ? format(value) : value}</span>
    </label>
  );
}

export function Chip({ label, icon, onClick, active }: { label: string; icon?: string; onClick?: () => void; active?: boolean }) {
  return (
    <button type="button" className={`chip${active ? ' active' : ''}`} onClick={onClick}>
      {icon && <Icon name={icon} size={15} />}
      {label}
    </button>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="section-title">
      <h2>{children}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <div className="empty">
      <Icon name={icon} size={44} strokeWidth={1.2} />
      <p>{title}</p>
      {hint && <span>{hint}</span>}
    </div>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="progress"><div style={{ width: `${Math.round(value * 100)}%` }} /></div>
  );
}

export function Donut({ slices, size = 148 }: { slices: Array<{ color: string; fraction: number }>; size?: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="donut">
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--md-surface-container-highest)" strokeWidth="13" />
      {slices.map((s, i) => {
        const len = Math.max(0, s.fraction) * c;
        const el = (
          <circle
            key={i}
            cx="50" cy="50" r={r} fill="none"
            stroke={s.color} strokeWidth="13"
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 50 50)"
            strokeLinecap="butt"
          />
        );
        offset += len;
        return el;
      })}
    </svg>
  );
}

export function ToastHost() {
  const { toasts } = useApp();
  const timers = useRef<Map<number, boolean>>(new Map());
  useEffect(() => { timers.current = new Map(); }, []);
  return (
    <div className="toast-host">
      {toasts.map((t) => (
        <div key={t.id} className="toast" onPointerDown={() => dismissToast(t.id)}>
          <span>{t.message}</span>
          {t.action && (
            <button type="button" onClick={(e) => { e.stopPropagation(); t.action!.run(); dismissToast(t.id); }}>
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
