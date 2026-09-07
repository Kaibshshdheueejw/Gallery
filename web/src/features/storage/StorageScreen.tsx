import { useMemo } from 'react';
import { navigate, toast, trashItems, useApp } from '../../store';
import { storageReport } from '../../domain/usecases/storageInsights';
import { Donut, SectionTitle } from '../../components/ui';
import { Icon } from '../../core/icons';
import { translate } from '../../core/i18n';
import { formatBytes } from '../../core/utils';

export function StorageScreen() {
  const app = useApp();
  const { settings, items, report } = app;
  const t = (k: string) => translate(settings.lang, k);
  const groups = report?.duplicates ?? [];
  const storage = useMemo(() => storageReport(items, groups), [items, groups]);

  return (
    <div className="screen">
      <header className="page-head with-back">
        <button type="button" className="back-btn glass glass-subtle" onClick={() => navigate({ name: 'tabs' })} aria-label="Back">
          <Icon name="back" size={20} />
        </button>
        <div className="grow"><h1>{t('storage_insights')}</h1><span className="sub">{formatBytes(storage.total)} in library</span></div>
      </header>
      <div className="scroll-area padded">
        <div className="storage-summary big glass glass-subtle">
          <Donut size={190} slices={storage.slices.map((s) => ({ color: s.color, fraction: s.bytes / storage.total }))} />
          <div className="legend grow">
            {storage.slices.map((s) => (
              <button key={s.id} type="button" className="legend-row clickable" onClick={() => navigate({ name: 'album', album: { type: 'smart', id: s.id === 'videos' ? 'videos' : s.id === 'screenshots' ? 'screenshots' : s.id === 'documents' ? 'documents' : 'recents', title: s.label } })}>
                <i style={{ background: s.color }} />
                <span className="grow">{s.label}</span>
                <em>{s.count}</em>
                <strong>{formatBytes(s.bytes)}</strong>
              </button>
            ))}
          </div>
        </div>

        <SectionTitle>{t('cleanup')}</SectionTitle>
        <div className="card-list">
          {storage.cleanup.map((c) => (
            <div className="info-card glass glass-subtle" key={c.id}>
              <span className="card-icon"><Icon name={c.id === 'duplicates' ? 'copy' : c.id === 'blurry' ? 'eye' : 'scanText'} size={20} /></span>
              <div className="grow">
                <strong>{c.label}</strong>
                <em>{c.itemIds.length} items · {formatBytes(c.bytes)} · {c.hint}</em>
                <div className="card-actions">
                  <button type="button" className="ghost-btn danger" onClick={() => { trashItems(c.itemIds); toast(`Moved ${c.itemIds.length} items to bin`); }}>
                    <Icon name="broom" size={14} /> Free {formatBytes(c.bytes)}
                  </button>
                </div>
              </div>
            </div>
          ))}
          {storage.cleanup.length === 0 && <p className="hint">Nothing to clean — your library is tidy ✨</p>}
        </div>
        <p className="privacy-note"><Icon name="shield" size={15} /> Insights computed on-device from real pixel statistics (perceptual hashes + laplacian variance).</p>
        <div className="scroll-pad" />
      </div>
    </div>
  );
}
