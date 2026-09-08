/**
 * Storage & Cleanup (§2–§4) — lives under Settings (and remains reachable as
 * its own route). Liquid Storage visualization: a circular glass container
 * with animated per-category liquid (waves, wobble, bubbles) that pauses when
 * off-screen; tapping a band opens that category. Below: the storage analyzer
 * (per-category breakdown), cleanup groups (duplicates, blurry, large files,
 * old screenshots, old media), recommendations and the recycle bin controls.
 */
import { useEffect, useMemo, useState } from 'react';
import { emptyTrash, navigate, rescanLibrary, setSettings, toast, trashItems, useApp } from '../../store';
import { storageReport } from '../../domain/usecases/storageInsights';
import { largeFiles, trashedItems, visibleItems } from '../../domain/usecases/library';
import { LiquidStorageCircle } from '../../components/LiquidStorageCircle';
import { SectionTitle } from '../../components/ui';
import { AnimatedButton, GlassSlider } from '../../components/glass';
import { Icon } from '../../core/icons';
import { translate } from '../../core/i18n';
import { formatBytes } from '../../core/utils';

const DAY = 86_400_000;
const SMART_IDS: Record<string, string> = {
  videos: 'videos', photos: 'recents', screenshots: 'screenshots', documents: 'documents',
};

export function StorageCleanup({ embedded = false }: { embedded?: boolean }) {
  const app = useApp();
  const { settings, items, report } = app;
  const t = (k: string) => translate(settings.lang, k);
  const groups = report?.duplicates ?? [];
  const storage = useMemo(() => storageReport(items, groups), [items, groups]);
  const [quota, setQuota] = useState<{ usage: number; quota: number } | null>(null);
  const [rescanning, setRescanning] = useState(false);

  useEffect(() => {
    let alive = true;
    navigator.storage?.estimate?.().then((e) => {
      if (alive && e.quota) setQuota({ usage: e.usage ?? 0, quota: e.quota });
    }).catch(() => undefined);
    return () => { alive = false; };
  }, []);

  const vis = visibleItems(items);
  const large = largeFiles(items);
  const oldMedia = vis.filter((i) => Date.now() - i.takenAt > 365 * DAY);
  const trashed = trashedItems(items);
  const trashedBytes = trashed.reduce((s, i) => s + i.bytes, 0);

  const cleanupGroups = [
    ...storage.cleanup,
    ...(large.length ? [{
      id: 'large',
      label: 'Large files',
      hint: `${large.length} items over ~90 KB (biggest first)`,
      bytes: large.reduce((s, i) => s + i.bytes, 0),
      itemIds: large.map((i) => i.id),
    }] : []),
    ...(oldMedia.length ? [{
      id: 'old',
      label: 'Old media',
      hint: 'not touched in over a year',
      bytes: oldMedia.reduce((s, i) => s + i.bytes, 0),
      itemIds: oldMedia.map((i) => i.id),
    }] : []),
  ];

  const recoverable = cleanupGroups.reduce((s, c) => s + c.bytes, 0);
  /* circle capacity: keep bands readable — scale to the library, honest caption below */
  const capacity = Math.max(storage.total * 1.35, 1);

  const openCategory = (id: string) => {
    const slice = storage.slices.find((s2) => s2.id === id);
    if (!slice) return;
    navigate({ name: 'album', album: { type: 'smart', id: SMART_IDS[id] ?? 'recents', title: slice.label } });
  };

  const reviewGroup = (id: string) => {
    if (id === 'duplicates') navigate({ name: 'album', album: { type: 'smart', id: 'duplicates', title: t('duplicates') } });
    else if (id === 'blurry') navigate({ name: 'album', album: { type: 'smart', id: 'blurry', title: t('blurry') } });
    else if (id === 'large') navigate({ name: 'album', album: { type: 'smart', id: 'large', title: t('large_files') } });
    else if (id === 'old-screenshots') navigate({ name: 'album', album: { type: 'smart', id: 'screenshots', title: t('screenshots') } });
    else navigate({ name: 'album', album: { type: 'smart', id: 'recents', title: 'Old media' } });
  };

  const body = (
    <>
      {/* ── liquid storage visualization ── */}
      <div className="liquid-hero glass glass-subtle">
        <LiquidStorageCircle
          slices={storage.slices.map((s) => ({ id: s.id, label: s.label, bytes: s.bytes, color: s.color }))}
          capacityBytes={capacity}
          size={236}
          detailed
          animate={settings.animations}
          onSelect={openCategory}
          centerLabel={{ value: formatBytes(storage.total), sub: 'used by library' }}
        />
        <div className="liquid-side">
          <strong>{formatBytes(storage.total)}</strong>
          <em>{vis.length} items · circle scaled to library</em>
          {quota && (
            <span className="liquid-quota">
              <Icon name="storage" size={13} />
              Browser vault: {formatBytes(quota.usage)} of {formatBytes(quota.quota)}
            </span>
          )}
          <div className="legend">
            {storage.slices.map((s) => (
              <button key={s.id} type="button" className="legend-row clickable" onClick={() => openCategory(s.id)}>
                <i style={{ background: s.color }} />
                <span className="grow">{s.label}</span>
                <em>{s.count}</em>
                <strong>{formatBytes(s.bytes)}</strong>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── recommendations ── */}
      <SectionTitle>Recommendations</SectionTitle>
      <div className="card-list">
        {recoverable > 0 && (
          <div className="info-card glass glass-subtle">
            <span className="card-icon"><Icon name="sparkle" size={20} /></span>
            <div className="grow">
              <strong>Recover {formatBytes(recoverable)}</strong>
              <em>{cleanupGroups.length} cleanup groups found · review before deleting</em>
              <div className="card-actions">
                <AnimatedButton kind="ghost" onClick={() => document.getElementById('cleanup-groups')?.scrollIntoView({ behavior: 'smooth' })}>Review groups</AnimatedButton>
              </div>
            </div>
          </div>
        )}
        {trashedBytes > 0 && (
          <div className="info-card glass glass-subtle">
            <span className="card-icon"><Icon name="trash" size={20} /></span>
            <div className="grow">
              <strong>Recycle bin holds {formatBytes(trashedBytes)}</strong>
              <em>{trashed.length} items · auto-purge after {settings.retentionDays} days</em>
              <div className="card-actions">
                <AnimatedButton kind="ghost" onClick={() => navigate({ name: 'trash' })}>{t('trash')}</AnimatedButton>
                <AnimatedButton kind="danger" icon="broom" onClick={() => { emptyTrash(); toast('Recycle bin emptied'); }}>Empty bin</AnimatedButton>
              </div>
            </div>
          </div>
        )}
        {recoverable === 0 && trashedBytes === 0 && (
          <p className="hint">Nothing to clean — your library is tidy ✨</p>
        )}
      </div>

      {/* ── cleanup groups ── */}
      <div id="cleanup-groups" />
      <SectionTitle>{t('cleanup')}</SectionTitle>
      <div className="card-list">
        {cleanupGroups.map((c) => (
          <div className="info-card glass glass-subtle" key={c.id}>
            <span className="card-icon">
              <Icon name={c.id === 'duplicates' ? 'copy' : c.id === 'blurry' ? 'eye' : c.id === 'large' ? 'storage' : c.id === 'old' ? 'clock' : 'scanText'} size={20} />
            </span>
            <div className="grow">
              <strong>{c.label}</strong>
              <em>{c.itemIds.length} items · {formatBytes(c.bytes)} · {c.hint}</em>
              <div className="card-actions">
                <AnimatedButton kind="ghost" onClick={() => reviewGroup(c.id)}>Review</AnimatedButton>
                <AnimatedButton kind="danger" icon="broom" onClick={() => { trashItems(c.itemIds); toast(`Moved ${c.itemIds.length} items to bin`); }}>
                  Free {formatBytes(c.bytes)}
                </AnimatedButton>
              </div>
            </div>
          </div>
        ))}
        {cleanupGroups.length === 0 && <p className="hint">No cleanup candidates — duplicates, blur, size and age all look healthy.</p>}
      </div>

      {/* ── bin & analysis controls ── */}
      <SectionTitle>Recycle bin & analysis</SectionTitle>
      <div className="set-group glass glass-subtle">
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <GlassSlider label={t('retention')} value={settings.retentionDays} min={7} max={90} onChange={(v) => setSettings({ retentionDays: v as 7 | 30 | 60 | 90 })} format={(v) => `${v} days`} />
          <label className="switch-row">
            <span>Automatic cleanup — purge expired items without asking</span>
            <input type="checkbox" checked={settings.autoCleanup} onChange={(e) => setSettings({ autoCleanup: e.target.checked })} />
            <i />
          </label>
        </div>
        <button type="button" className="row-btn pressable-row" onClick={() => navigate({ name: 'trash' })}>
          <Icon name="trash" size={18} /><span className="grow">Open Recycle bin</span><em>{trashed.length}</em>
        </button>
        <button
          type="button" className="row-btn pressable-row" disabled={rescanning}
          onClick={async () => { setRescanning(true); await rescanLibrary(); setRescanning(false); toast('Library re-scanned on-device'); }}
        >
          <Icon name={rescanning ? 'refresh' : 'scan'} size={18} className={rescanning ? 'spin-slow' : ''} />
          <span className="grow">Refresh analysis</span>
          <em>{report ? `${report.items} items · ${Math.round(report.ms)} ms` : 'scanning…'}</em>
        </button>
      </div>
      <p className="privacy-note"><Icon name="shield" size={15} /> Insights computed on-device from real pixel statistics (perceptual hashes + laplacian variance). Nothing is uploaded.</p>
      {!embedded && <div className="scroll-pad" />}
    </>
  );

  return <>{body}</>;
}

export function StorageScreen() {
  const app = useApp();
  const t = (k: string) => translate(app.settings.lang, k);
  return (
    <div className="screen slide-in">
      <header className="page-head with-back">
        <button type="button" className="back-btn glass glass-subtle" onClick={() => navigate({ name: 'tabs' })} aria-label="Back">
          <Icon name="back" size={20} />
        </button>
        <div className="grow"><h1>{t('storage_insights')}</h1><span className="sub">Storage & Cleanup</span></div>
      </header>
      <div className="scroll-area padded">
        <StorageCleanup />
      </div>
    </div>
  );
}
