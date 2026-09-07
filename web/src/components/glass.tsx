/**
 * Reusable Liquid-Glass primitives (design-system components).
 * GlassSurface / FloatingNavigation / SettingsRow / SettingsSection /
 * AnimatedButton / AnimatedCard / AnimatedToggle / GlassSlider / GlassDialog.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../core/icons';
import { haptic } from '../core/haptics';
import { setTab, useApp } from '../store';
import { translate } from '../core/i18n';
import type { TabId } from '../data/models';

/* ── surfaces ─────────────────────────────────────────────────────────── */
export function GlassSurface({ children, className = '', variant = 'base', onClick, style }: {
  children?: ReactNode; className?: string; variant?: 'base' | 'strong' | 'subtle' | 'raised'; onClick?: () => void; style?: React.CSSProperties;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`glass glass-${variant} ${onClick ? 'pressable' : ''} ${className}`}
      onClick={onClick}
      style={style}
    >
      {children}
    </Tag>
  );
}

export function AnimatedButton({ children, onClick, kind = 'primary', icon, disabled, className = '' }: {
  children?: ReactNode; onClick?: () => void; kind?: 'primary' | 'ghost' | 'danger' | 'glass'; icon?: string; disabled?: boolean; className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`btn btn-${kind} press ${className}`}
      onPointerDown={() => haptic('tap')}
      onClick={onClick}
    >
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  );
}

export function AnimatedCard({ children, onClick, className = '', style }: {
  children: ReactNode; onClick?: () => void; className?: string; style?: React.CSSProperties;
}) {
  return (
    <button type="button" className={`card pressable ${className}`} style={style} onClick={onClick} onPointerDown={() => haptic('tap')}>
      {children}
    </button>
  );
}

/* ── controls ─────────────────────────────────────────────────────────── */
export function AnimatedToggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="toggle" aria-label={label}>
      <input type="checkbox" checked={checked} onChange={(e) => { haptic('tap'); onChange(e.target.checked); }} />
      <span className="track"><span className="knob" /></span>
    </label>
  );
}

export function GlassSlider({ label, value, min, max, step = 1, onChange, format }: {
  label?: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; format?: (v: number) => string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="glass-slider">
      {label && (
        <div className="glass-slider-head">
          <span>{label}</span>
          <em>{format ? format(value) : value}</em>
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--fill': `${pct}%` } as React.CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
    </div>
  );
}

export function GlassSegmented<T extends string>({ value, options, onChange }: {
  value: T; options: Array<{ id: T; label: string; icon?: string }>; onChange: (v: T) => void;
}) {
  return (
    <div className="glass-seg" role="tablist">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={o.id === value}
          className={o.id === value ? 'on' : ''}
          onPointerDown={() => haptic('tap')}
          onClick={() => onChange(o.id)}
        >
          {o.icon && <Icon name={o.icon} size={15} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ── settings building blocks ─────────────────────────────────────────── */
export function SettingsSection({ title, children, footnote }: { title?: string; children: ReactNode; footnote?: string }) {
  return (
    <section className="set-section">
      {title && <h4>{title}</h4>}
      <div className="set-group glass glass-subtle">{children}</div>
      {footnote && <p className="footnote">{footnote}</p>}
    </section>
  );
}

export function SettingsRow({ icon, title, desc, right, onClick, disabled }: {
  icon?: string; title: string; desc?: string; right?: ReactNode; onClick?: () => void; disabled?: boolean;
}) {
  const Tag = onClick && !disabled ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`set-row${onClick && !disabled ? ' pressable-row' : ''}${disabled ? ' disabled' : ''}`}
      onClick={onClick && !disabled ? () => { haptic('tap'); onClick(); } : undefined}
      disabled={Tag === 'button' ? disabled : undefined}
    >
      {icon && <span className="set-icon"><Icon name={icon} size={18} /></span>}
      <span className="set-text">
        <strong>{title}</strong>
        {desc && <em>{desc}</em>}
      </span>
      {right ?? (onClick && !disabled ? <Icon name="chevronRight" size={16} className="chev" /> : null)}
    </Tag>
  );
}

export function SettingsCategory({ icon, title, desc, onClick }: { icon: string; title: string; desc: string; onClick: () => void }) {
  return (
    <button type="button" className="cat-row pressable-row" onClick={() => { haptic('tap'); onClick(); }}>
      <span className="cat-icon"><Icon name={icon} size={20} /></span>
      <span className="set-text">
        <strong>{title}</strong>
        <em>{desc}</em>
      </span>
      <Icon name="chevronRight" size={17} className="chev" />
    </button>
  );
}

/* ── floating capsule navigation ──────────────────────────────────────── */
const NAV_META: Record<TabId, { icon: string; key: string }> = {
  foryou: { icon: 'sparkle', key: 'tab_foryou' },
  timeline: { icon: 'clock', key: 'tab_timeline' },
  albums: { icon: 'folder', key: 'tab_albums' },
  search: { icon: 'search', key: 'tab_search' },
};

export function FloatingNavigation() {
  const { settings, activeTab } = useApp();
  const t = (k: string) => translate(settings.lang, k);
  const refs = useRef(new Map<TabId, HTMLButtonElement>());
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);
  const compact = settings.navStyle === 'compact';

  const measure = () => {
    const el = refs.current.get(activeTab);
    if (el) setPill({ x: el.offsetLeft, w: el.offsetWidth });
  };
  useLayoutEffect(measure, [activeTab, settings.tabOrder, compact]);
  useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  });

  return (
    <nav className={`float-nav glass glass-strong${compact ? ' compact' : ''}`} aria-label="Primary">
      {pill && <span className="nav-pill" style={{ transform: `translateX(${pill.x}px)`, width: pill.w }} />}
      {settings.tabOrder.map((tab) => (
        <button
          key={tab}
          ref={(el) => { if (el) refs.current.set(tab, el); else refs.current.delete(tab); }}
          type="button"
          className={`nav-btn${activeTab === tab ? ' on' : ''}`}
          aria-current={activeTab === tab ? 'page' : undefined}
          onPointerDown={() => haptic('select')}
          onClick={() => setTab(tab)}
        >
          <span className="nav-ico"><Icon name={NAV_META[tab].icon} size={21} /></span>
          {!compact && <em>{t(NAV_META[tab].key)}</em>}
        </button>
      ))}
    </nav>
  );
}
