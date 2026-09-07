import { useEffect, useMemo, useState } from 'react';
import { navigate, openViewer, toast, trashItems, useApp } from '../../store';
import { memories, onThisDay, faceClusters, visibleItems } from '../../domain/usecases/library';
import { storageReport } from '../../domain/usecases/storageInsights';
import { Thumb } from '../../components/PhotoGrid';
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

export function ForYouScreen() {
  const app = useApp();
  const { settings, items, report } = app;
  const t = (k: string) => translate(settings.lang, k);
  const [playing, setPlaying] = useState<MediaItem[] | null>(null);

  const mems = useMemo(() => memories(items), [items]);
  const otd = useMemo(() => onThisDay(items), [items]);
  const clusters = useMemo(() => faceClusters(items, app.faceNames), [items, app.faceNames]);
  const dupGroups = report?.duplicates ?? [];
  const storage = useMemo(() => storageReport(items, dupGroups), [items, dupGroups]);
  const vis = visibleItems(items);

  const dupRemovable = dupGroups.flatMap((g) => g.slice(1));
  const dupBytes = items.filter((i) => dupRemovable.includes(i.id)).reduce((s, i) => s + i.bytes, 0);
  const blurryIds = storage.cleanup.find((c) => c.id === 'blurry')?.itemIds ?? [];

  if (app.status !== 'ready') {
    return (
      <div className="screen center-col">
        <Icon name="sparkle" size={40} className="spin-slow" />
        <h2>{t('processing')}</h2>
        <ProgressBar value={app.scan.total ? app.scan.done / app.scan.total : 0} />
        <span className="muted">{app.scan.done}/{app.scan.total} · {t('on_device')}</span>
      </div>
    );
  }

  return (
    <div className="screen">
      <header className="app-bar">
        <div><h1>{t('app_name')}</h1><span className="sub">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
        <div className="bar-actions">
          <IconButton icon="storage" label={t('storage_insights')} onClick={() => navigate({ name: 'storage' })} />
          <IconButton icon="settings" label={t('settings')} onClick={() => navigate({ name: 'settings' })} />
        </div>
      </header>

      <div className="scroll-area padded">
        {mems.length > 0 && (
          <>
            <SectionTitle>{t('memories')}</SectionTitle>
            <div className="h-scroll memories">
              {mems.map((m) => (
                <button key={m.id} type="button" className="memory-card" onClick={() => setPlaying(m.items)}>
                  <span className="cover">{m.items[0] && <Thumb item={m.items[0]} ratio="4:3" />}</span>
                  <span className="meta">
                    <strong>{m.id}</strong>
                    <em>{formatMonthYear(m.at)} · {m.items.length} items · {relativeTime(m.at)}</em>
                    <span className="play-pill"><Icon name="play" size={12} filled /> Play</span>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {otd.length > 0 && (
          <>
            <SectionTitle>{t('on_this_day')}</SectionTitle>
            <div className="h-scroll strip">
              {otd.map((i) => (
                <button key={i.id} type="button" className="strip-card" onClick={() => openViewer(otd.map((x) => x.id), otd.indexOf(i))}>
                  <Thumb item={i} ratio="square" />
                  <em>{new Date(i.takenAt).getFullYear()}</em>
                </button>
              ))}
            </div>
          </>
        )}

        <SectionTitle>{t('cleanup')}</SectionTitle>
        <div className="card-list">
          {dupGroups.length > 0 && (
            <div className="info-card">
              <span className="card-icon"><Icon name="copy" size={20} /></span>
              <div className="grow">
                <strong>{dupGroups.length} duplicate group{dupGroups.length > 1 ? 's' : ''}</strong>
                <em>{dupRemovable.length} extra copies · {formatBytes(dupBytes)} recoverable</em>
                <div className="card-actions">
                  <button type="button" className="ghost-btn" onClick={() => navigate({ name: 'album', album: { type: 'smart', id: 'duplicates', title: t('duplicates') } })}>Review</button>
                  <button type="button" className="ghost-btn danger" onClick={() => { trashItems(dupRemovable); toast(`Cleaned ${dupRemovable.length} duplicates`); }}>
                    <Icon name="broom" size={14} /> Clean
                  </button>
                </div>
              </div>
            </div>
          )}
          {blurryIds.length > 0 && (
            <div className="info-card">
              <span className="card-icon"><Icon name="eye" size={20} /></span>
              <div className="grow">
                <strong>{blurryIds.length} blurry shot{blurryIds.length > 1 ? 's' : ''}</strong>
                <em>flagged by the on-device sharpness model (laplacian variance)</em>
                <div className="card-actions">
                  <button type="button" className="ghost-btn" onClick={() => navigate({ name: 'album', album: { type: 'smart', id: 'blurry', title: t('blurry') } })}>Review</button>
                  <button type="button" className="ghost-btn danger" onClick={() => trashItems(blurryIds)}><Icon name="trash" size={14} /> {t('delete')}</button>
                </div>
              </div>
            </div>
          )}
          {storage.cleanup.filter((c) => c.id === 'old-screenshots').map((c) => (
            <div className="info-card" key={c.id}>
              <span className="card-icon"><Icon name="scanText" size={20} /></span>
              <div className="grow">
                <strong>{c.label}</strong>
                <em>{c.itemIds.length} items · {formatBytes(c.bytes)} · {c.hint}</em>
                <div className="card-actions">
                  <button type="button" className="ghost-btn" onClick={() => navigate({ name: 'album', album: { type: 'smart', id: 'screenshots', title: t('screenshots') } })}>Review</button>
                  <button type="button" className="ghost-btn danger" onClick={() => trashItems(c.itemIds)}><Icon name="trash" size={14} /> {t('delete')}</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <SectionTitle action={<button type="button" className="text-btn" onClick={() => navigate({ name: 'storage' })}>{t('storage_insights')} <Icon name="chevronRight" size={14} /></button>}>
          Space
        </SectionTitle>
        <div className="storage-summary">
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
            <div className="h-scroll people">
              {clusters.map((c) => {
                const first = items.find((i) => i.id === c.itemIds[0]);
                return (
                  <button key={c.id} type="button" className="person-card" onClick={() => navigate({ name: 'album', album: { type: 'person', id: c.id, title: c.name } })}>
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
