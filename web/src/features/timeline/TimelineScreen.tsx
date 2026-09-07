import { useMemo, useRef, useState } from 'react';
import { useApp, openViewer, setSettings, navigate } from '../../store';
import { visibleItems, byDay, byMonth } from '../../domain/usecases/library';
import { PhotoGrid } from '../../components/PhotoGrid';
import { SelectionBar } from '../../components/SelectionBar';
import { useSelection } from '../../components/useSelection';
import { IconButton, Sheet, EmptyState } from '../../components/ui';
import { GlassSegmented, GlassSlider } from '../../components/glass';
import { formatDayHeader, formatMonthYear, groupBy, startOfYear, formatBytes } from '../../core/utils';
import { translate } from '../../core/i18n';
import { Icon } from '../../core/icons';

const LEVELS = [
  { group: 'year' as const, cols: 3 },
  { group: 'month' as const, cols: 3 },
  { group: 'day' as const, cols: 4 },
  { group: 'day' as const, cols: 5 },
  { group: 'day' as const, cols: 6 },
  { group: 'day' as const, cols: 8 },
];

export function TimelineScreen() {
  const app = useApp();
  const { settings } = app;
  const t = (k: string) => translate(settings.lang, k);
  const items = useMemo(() => visibleItems(app.items), [app.items]);
  const level = Math.max(0, Math.min(LEVELS.length - 1, settings.gridLevel));
  const { group, cols } = LEVELS[level];

  const sections = useMemo(() => {
    const ordered = settings.sortOrder === 'oldest' ? [...items].reverse() : items;
    const grouped = group === 'year'
      ? groupBy(ordered, (i) => startOfYear(i.takenAt).toString())
      : group === 'month'
        ? byMonth(ordered)
        : byDay(ordered);
    const secs = grouped.map((g) => ({
      key: g.key,
      label: group === 'year' ? new Date(Number(g.key)).getFullYear().toString() : group === 'month' ? formatMonthYear(Number(g.key)) : formatDayHeader(Number(g.key)),
      items: g.items,
    }));
    return settings.sortOrder === 'oldest' ? secs.reverse() : secs;
  }, [items, group, settings.sortOrder]);

  const selection = useSelection();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchBase = useRef<number | null>(null);
  const [scrubLabel, setScrubLabel] = useState<string | null>(null);

  const changeLevel = (delta: number) => {
    const next = Math.max(0, Math.min(LEVELS.length - 1, settings.gridLevel + delta));
    if (next !== settings.gridLevel) setSettings({ gridLevel: next });
  };

  const onWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      changeLevel(e.deltaY > 0 ? -1 : 1);
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchBase.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinchBase.current !== null) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (Math.abs(dist - pinchBase.current) > 46) {
        changeLevel(dist > pinchBase.current ? -1 : 1);
        pinchBase.current = dist;
      }
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchBase.current = null;
  };

  // right-edge scrubber
  const scrubbing = useRef(false);
  const scrubTo = (clientY: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    el.scrollTop = f * (el.scrollHeight - el.clientHeight);
    const center = el.scrollTop + el.clientHeight / 2;
    let label = '';
    let acc = 0;
    for (const s of sections) {
      const rows = Math.ceil(s.items.length / cols);
      const h = rows * (el.clientWidth / cols) + 46;
      acc += h;
      if (acc > center) { label = s.label; break; }
    }
    setScrubLabel(label || sections[sections.length - 1]?.label || '');
  };

  const totalBytes = items.reduce((s, i) => s + i.bytes, 0);

  return (
    <div className="screen">
      <header className="page-head">
        <div className="grow">
          <h1>{t('tab_timeline')}</h1>
          <span className="sub">{items.length} items · {formatBytes(totalBytes)}</span>
        </div>
        <div className="bar-actions">
          <IconButton icon="zoomIn" label="Zoom in grid" onClick={() => changeLevel(1)} />
          <IconButton icon="zoomOut" label="Zoom out grid" onClick={() => changeLevel(-1)} />
          <IconButton icon="list" label="View options" onClick={() => setOptionsOpen(true)} />
        </div>
      </header>

      {items.length === 0 ? (
        <EmptyState icon="image" title={t('empty_album')} hint="Delete something to see it in the Recycle bin, or reset the demo data in Settings." />
      ) : (
        <div
          className="scroll-area"
          ref={scrollRef}
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onScroll={() => { if (!scrubbing.current) setScrubLabel(null); }}
        >
          {sections.map((section) => (
            <section key={section.key} className="grid-section">
              <div className="sticky-head">
                <span className="head-pill">{section.label}<em>{section.items.length}</em></span>
              </div>
              <PhotoGrid
                items={section.items}
                cols={cols}
                ratio={settings.thumbRatio}
                selection={selection.active ? selection.selection : null}
                onOpen={(idx) => openViewer(section.items.map((i) => i.id), idx)}
                onToggle={selection.toggle}
                onLongPress={selection.enter}
              />
            </section>
          ))}
          <div className="scroll-pad" />
        </div>
      )}

      <div
        className="scrubber"
        onPointerDown={(e) => { scrubbing.current = true; (e.target as HTMLElement).setPointerCapture(e.pointerId); scrubTo(e.clientY); }}
        onPointerMove={(e) => { if (scrubbing.current) scrubTo(e.clientY); }}
        onPointerUp={() => { scrubbing.current = false; setTimeout(() => setScrubLabel(null), 900); }}
      >
        <div className="scrub-track" />
      </div>
      {scrubLabel && <div className="scrub-label">{scrubLabel}</div>}

      {selection.active && <SelectionBar selection={selection} />}

      {optionsOpen && (
        <Sheet title="View options" onClose={() => setOptionsOpen(false)}>
          <div className="field">
            <span className="field-label">Group by</span>
            <GlassSegmented
              value={group}
              options={[{ id: 'day', label: 'Day' }, { id: 'month', label: 'Month' }, { id: 'year', label: 'Year' }]}
              onChange={(v) => setSettings({ gridLevel: v === 'year' ? 0 : v === 'month' ? 1 : 3 })}
            />
          </div>
          <div className="field">
            <GlassSlider label={`${t('grid_density')} · ${cols} columns`} value={level} min={0} max={LEVELS.length - 1} onChange={(v) => setSettings({ gridLevel: v })} format={(v) => ['Year', 'Month', 'Day', 'Day+', 'Day++', 'Day max'][v]} />
            <p className="hint">Pinch the grid or Ctrl/Cmd-scroll to change density, like the mobile app.</p>
          </div>
          <div className="field">
            <span className="field-label">{t('thumbnail_ratio')}</span>
            <GlassSegmented
              value={settings.thumbRatio}
              options={[{ id: 'square', label: '1:1' }, { id: '4:3', label: '4:3' }, { id: 'auto', label: 'Original' }]}
              onChange={(v) => setSettings({ thumbRatio: v })}
            />
          </div>
          <button type="button" className="text-btn" onClick={() => { setOptionsOpen(false); navigate({ name: 'settings' }); }}>
            <Icon name="settings" size={16} /> {t('settings')}
          </button>
        </Sheet>
      )}
    </div>
  );
}
