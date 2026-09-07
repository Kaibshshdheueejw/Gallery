import { useEffect, useMemo, useState } from 'react';
import { navigate, openViewer, toast, trashItems, useApp } from '../../store';
import { memories, onThisDay, faceClusters, visibleItems } from '../../domain/usecases/library';
import { storageReport } from '../../domain/usecases/storageInsights';
import { Thumb } from '../../components/PhotoGrid';
import { AnimatedButton } from '../../components/glass';
import { Donut, IconButton, ProgressBar, SectionTitle } from '../../components/ui';
import { Icon } from '../../core/icons';
import { translate } from '../../core/i18n';
import { formatBytes, formatMonthYear, relativeTime } from '../../core/utils';
import type { MediaItem } from '../../data/models';

function MemorySlideshow({ items, onClose }: { items: MediaItem[]; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % items.length), 2600);
    return () => clearInterval(id);
  }, [items.length]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);
  return (
    <div className="slideshow" onPointerDown={onClose}>
      {items.map((item, i) => (
        <div key={item.id} className={`slide${i === index ? ' on' : ''}`}>
          <img src={item.src} alt={item.title} />
        </div>
      ))}
      <div className="slide-hud">
        <strong>{items[0]?.event ?? 'Memory'}</strong>
        <span>{formatMonthYear(items[0]?.takenAt ?? Date.now())} · {index + 1}/{items.length}</span>
        <ProgressBar value={(index + 1) / items.length} />
      </div>
    </div>
  );
}

/** intelligent aspect: landscape → 16/10, portrait → 4/5, else 1/1 */
function memAspect(item: MediaItem | undefined): string {
  if (!item) return '16 / 10';
  const ar = item.w / item.h;
  if (ar > 1.15) return '16 / 10';
  if (ar < 0.9) return '4 / 5';
  return '1 / 1';
}

export function ForYouScreen() {
  const app = useApp();
  const { settings, items, report } = app;
  const t = (k: string) => translate(settings.lang, k);
  const [playing, setPlaying] = useState<MediaItem[] | null>(null);

  const mems = useMemo(() => memories(items), [items]);
  const otd = useMemo(() => onThisDay(items), [items]);
  const clusters = useMemo(() => (settings.ai.faces ? faceClusters(items, app.faceNames) : []), [items, app.faceNames, settings.ai.faces]);
  const dupGroups = (settings.ai.duplicates ? report?.duplicates : undefined) ?? [];
  const storage = useMemo(() => storageReport(items, dupGroups), [items, dupGroups]);

  const dupRemovable = dupGroups.flatMap((g) => g.slice(1));
  const dupBytes = items.filter((i) => dupRemovable.includes(i.id)).reduce((s, i) => s + i.bytes, 0);
  const blurryIds = (settings.ai.blur ? storage.cleanup.find((c) => c.id === 'blurry')?.itemIds : undefined) ?? [];
  const showCleanup = settings.notifications.cleanup && (dupGroups.length > 0 || blurryIds.length > 0);

  if (app.status !== 'ready') {
    return (
      <div className="screen center-col">
        <Icon name="sparkle" size={42} className="spin-slow" />
        <h2 style={{ fontSize: 17, fontWeight: 650 }}>{t('processing')}</h2>
        <ProgressBar value={app.scan.total ? app.scan.done / app.scan.total : 0} />
        <span className="muted">{app.scan.done}/{app.scan.total} · {t('on_device')}</span>
      </div>
    );
  }

  return (
    <div className="screen">
      <header className="page-head">
        <div className="grow">
          <h1>{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</h1>
          <span className="sub">{t('app_name')} · {visibleItems(items).length} items</span>
        </div>
        <div className="bar-actions">
          <IconButton icon="storage" label={t('storage_insights')} onClick={() => navigate({ name: 'storage' })} />
          <IconButton icon="settings" label={t('settings')} onClick={() => navigate({ name: 'settings' })} />
        </div>
      </header>

      <div className="scroll-area padded">
        {settings.notifications.memories && mems.length > 0 && (
          <>
            <SectionTitle>{t('memories')}</SectionTitle>
            <div className="mem-rail">
              {mems.map((m) => (
                <div
                  key={m.id}
                  role="button"
                  tabIndex={0}
                  className="mem-card pressable"
                  style={{ aspectRatio: memAspect(m.items[0]) }}
                  onClick={() => openViewer(m.items.map((i) => i.id), 0)}
                  onKeyDown={(e) => { if (e.key === 'Enter') openViewer(m.items.map((i) => i.id), 0); }}
                >
                  <span className="mem-media">{m.items[0] && <img src={m.items[0].src} alt={m.id} loading="lazy" decoding="async" />}</span>
                  <span className="mem-scrim" />
                  <span className="mem-badge">{t('memories')}</span>
                  <span className="mem-glass">
                    <span className="mem-txt">
                      <strong>{m.id}</strong>
                      <em>{formatMonthYear(m.at)} · {m.items.length} items · {relativeTime(m.at)}</em>
                    </span>
                    <button
                      type="button"
                      className="mem-play"
                      aria-label="Play memory"
                      onClick={(e) => { e.stopPropagation(); setPlaying(m.items); }}
                    >
                      <Icon name="play" size={14} filled />
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {otd.length > 0 && (
          <>
            <SectionTitle>{t('on_this_day')}</SectionTitle>
            <div className="rail">
              {otd.map((i, idx) => (
                <button key={i.id} type="button" className="strip-card pressable" onClick={() => openViewer(otd.map((x) => x.id), idx)}>
                  <Thumb item={i} ratio="square" />
                  <em>{new Date(i.takenAt).getFullYear()}</em>
                </button>
              ))}
            </div>
          </>
        )}

        {showCleanup && (
          <>
            <SectionTitle>{t('cleanup')}</SectionTitle>
            <div className="card-list">
              {dupGroups.length > 0 && (
                <div className="info-card glass glass-subtle">
                  <span className="card-icon"><Icon name="copy" size={20} /></span>
                  <div className="grow">
                    <strong>{dupGroups.length} duplicate group{dupGroups.length > 1 ? 's' : ''}</strong>
                    <em>{dupRemovable.length} extra copies · {formatBytes(dupBytes)} recoverable</em>
                    <div className="card-actions">
                      <AnimatedButton kind="ghost" onClick={() => navigate({ name: 'album', album: { type: 'smart', id: 'duplicates', title: t('duplicates') } })}>Review</AnimatedButton>
                      <AnimatedButton kind="danger" icon="broom" onClick={() => { trashItems(dupRemovable); toast(`Cleaned ${dupRemovable.length} duplicates`); }}>Clean</AnimatedButton>
                    </div>
                  </div>
                </div>
              )}
              {blurryIds.length > 0 && (
                <div className="info-card glass glass-subtle">
                  <span className="card-icon"><Icon name="eye" size={20} /></span>
                  <div className="grow">
                    <strong>{blurryIds.length} blurry shot{blurryIds.length > 1 ? 's' : ''}</strong>
                    <em>flagged by the on-device sharpness model (laplacian variance)</em>
                    <div className="card-actions">
                      <AnimatedButton kind="ghost" onClick={() => navigate({ name: 'album', album: { type: 'smart', id: 'blurry', title: t('blurry') } })}>Review</AnimatedButton>
                      <AnimatedButton kind="danger" icon="trash" onClick={() => trashItems(blurryIds)}>{t('delete')}</AnimatedButton>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        <SectionTitle action={<button type="button" className="text-btn" onClick={() => navigate({ name: 'storage' })}>{t('storage_insights')} <Icon name="chevronRight" size={14} /></button>}>
          Space
        </SectionTitle>
        <div className="storage-summary glass glass-subtle">
          <Donut slices={storage.slices.map((s) => ({ color: s.color, fraction: s.bytes / storage.total }))} />
          <div className="legend grow">
            {storage.slices.map((s) => (
              <div key={s.id} className="legend-row">
                <i style={{ background: s.color }} />
                <span className="grow">{s.label}</span>
                <em>{s.count}</em>
                <strong>{formatBytes(s.bytes)}</strong>
              </div>
            ))}
          </div>
        </div>

        {clusters.length > 0 && (
          <>
            <SectionTitle>{t('albums_people')}</SectionTitle>
            <div className="rail">
              {clusters.map((c) => {
                const first = items.find((i) => i.id === c.itemIds[0]);
                return (
                  <button key={c.id} type="button" className="person-card pressable" onClick={() => navigate({ name: 'album', album: { type: 'person', id: c.id, title: c.name } })}>
                    <span className="avatar">{first && <Thumb item={first} ratio="square" />}</span>
                    <strong>{c.name}</strong>
                    <em>{c.itemIds.length}</em>
                  </button>
                );
              })}
            </div>
          </>
        )}

        <div className="privacy-note">
          <Icon name="shield" size={16} />
          <span>
            {report ? `${t('scanned').replace('{n}', String(report.items))} · ${t('faces_found').replace('{n}', String(report.faces))} · ${t('ocr_docs').replace('{n}', String(report.ocrDocs))} in ${Math.round(report.ms)} ms` : ''}
            {' '}— all {t('on_device').toLowerCase()}.
          </span>
        </div>
        <div className="scroll-pad" />
      </div>

      {playing && <MemorySlideshow items={playing} onClose={() => setPlaying(null)} />}
    </div>
  );
}
