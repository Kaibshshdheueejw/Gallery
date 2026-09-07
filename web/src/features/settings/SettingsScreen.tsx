import { useState } from 'react';
import { navigate, resetAll, runBackup, setSettings, setTabOrder, toast, useApp } from '../../store';
import { Dialog, IconButton, Segmented, Sheet, SliderRow } from '../../components/ui';
import { Icon } from '../../core/icons';
import { LANGS, translate, type Lang } from '../../core/i18n';
import { SEEDS } from '../../core/theme';
import { formatBytes, relativeTime } from '../../core/utils';
import type { TabId } from '../../data/models';
import { visibleItems } from '../../domain/usecases/library';

const TAB_META: Record<TabId, { icon: string; key: string }> = {
  foryou: { icon: 'sparkle', key: 'tab_foryou' },
  timeline: { icon: 'clock', key: 'tab_timeline' },
  albums: { icon: 'folder', key: 'tab_albums' },
  search: { icon: 'search', key: 'tab_search' },
};

export function SettingsScreen() {
  const app = useApp();
  const { settings, report } = app;
  const t = (k: string) => translate(settings.lang, k);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinDraft, setPinDraft] = useState('');
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [dragTab, setDragTab] = useState<TabId | null>(null);

  const moveTab = (id: TabId, dir: -1 | 1) => {
    const order = [...settings.tabOrder];
    const i = order.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    setTabOrder(order);
  };

  const items = visibleItems(app.items);

  return (
    <div className="screen">
      <header className="app-bar with-back">
        <IconButton icon="back" label="Back" onClick={() => navigate({ name: 'tabs' })} />
        <div className="grow"><h1>{t('settings')}</h1></div>
      </header>

      <div className="scroll-area padded settings">
        <section className="set-card">
          <h3><Icon name="palette" size={17} /> {t('appearance')}</h3>
          <Segmented
            value={settings.mode}
            options={[{ id: 'light', label: t('theme_light'), icon: 'sun' }, { id: 'dark', label: t('theme_dark'), icon: 'moon' }, { id: 'system', label: t('theme_system'), icon: 'monitor' }]}
            onChange={(v) => setSettings({ mode: v })}
          />
          <div className="swatch-row">
            {SEEDS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`seed${settings.seed === s.id && !settings.dynamicColor ? ' on' : ''}`}
                style={{ background: s.color }}
                title={s.label}
                aria-label={s.label}
                onClick={() => setSettings({ seed: s.id, dynamicColor: false })}
              />
            ))}
            <button
              type="button"
              className={`seed dynamic${settings.dynamicColor ? ' on' : ''}`}
              title="Material You — derive from latest photo"
              onClick={() => setSettings({ dynamicColor: true })}
            >
              <Icon name="wand" size={15} />
            </button>
          </div>
          <p className="hint">Material You dynamic colour samples the dominant tone of your newest photo.</p>
        </section>

        <section className="set-card">
          <h3><Icon name="grid" size={17} /> {t('display')}</h3>
          <SliderRow label={t('grid_density')} value={settings.gridLevel} min={0} max={5} onChange={(v) => setSettings({ gridLevel: v })} format={(v) => `${[3, 3, 4, 5, 6, 8][v]} cols`} />
          <div className="field-label">{t('thumbnail_ratio')}</div>
          <Segmented
            value={settings.thumbRatio}
            options={[{ id: 'square', label: '1:1' }, { id: '4:3', label: '4:3' }, { id: 'auto', label: 'Original' }]}
            onChange={(v) => setSettings({ thumbRatio: v })}
          />
          <div className="field-label">{t('home_layout')}</div>
          <div className="tab-order">
            {settings.tabOrder.map((id, i) => (
              <div
                key={id}
                className="tab-row"
                draggable
                onDragStart={() => setDragTab(id)}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!dragTab || dragTab === id) return;
                  const order = settings.tabOrder.filter((x) => x !== dragTab);
                  order.splice(i, 0, dragTab);
                  setTabOrder(order);
                }}
                onDragEnd={() => setDragTab(null)}
              >
                <Icon name="drag" size={16} />
                <Icon name={TAB_META[id].icon} size={17} />
                <span className="grow">{t(TAB_META[id].key)}</span>
                <IconButton icon="arrowUp" label="Move up" size={16} onClick={() => moveTab(id, -1)} />
                <IconButton icon="arrowDown" label="Move down" size={16} onClick={() => moveTab(id, 1)} />
              </div>
            ))}
          </div>
          <p className="hint">Drag rows (or use the arrows) to reorder the bottom navigation.</p>
        </section>

        <section className="set-card">
          <h3><Icon name="globe" size={17} /> {t('language')}</h3>
          <div className="lang-list">
            {LANGS.map((l) => (
              <button key={l.id} type="button" className={`row-btn${settings.lang === l.id ? ' on' : ''}`} onClick={() => setSettings({ lang: l.id as Lang })}>
                <span className="grow">{l.native}</span><em>{l.label}</em>
                {settings.lang === l.id && <Icon name="check" size={16} />}
              </button>
            ))}
          </div>
        </section>

        <section className="set-card">
          <h3><Icon name="shield" size={17} /> {t('privacy')}</h3>
          <label className="switch-row">
            <span>Unlock {t('locked_folder')} with biometrics</span>
            <input type="checkbox" checked={settings.biometrics} onChange={(e) => setSettings({ biometrics: e.target.checked })} />
            <i />
          </label>
          <button type="button" className="row-btn" onClick={() => { setPinDraft(settings.pin); setPinOpen(true); }}>
            <Icon name="keypad" size={18} /><span className="grow">Change PIN</span><Icon name="chevronRight" size={16} />
          </button>
          <button type="button" className="row-btn" onClick={() => setPrivacyOpen(true)}>
            <Icon name="eye" size={18} /><span className="grow">Data usage transparency</span><Icon name="chevronRight" size={16} />
          </button>
          <SliderRow label={t('retention')} value={settings.retentionDays} min={7} max={90} step={1}
            onChange={(v) => setSettings({ retentionDays: v as 7 | 30 | 60 | 90 })}
            format={(v) => `${v}d`} />
          <p className="hint">Recycle bin auto-purges after the retention window.</p>
        </section>

        <section className="set-card">
          <h3><Icon name="cloud" size={17} /> {t('backup')}</h3>
          <label className="switch-row">
            <span>Encrypted cloud backup</span>
            <input type="checkbox" checked={settings.backup.enabled} onChange={(e) => setSettings({ backup: { ...settings.backup, enabled: e.target.checked } })} />
            <i />
          </label>
          <Segmented
            value={settings.backup.provider}
            options={[{ id: 'drive', label: 'Google Drive' }, { id: 's3', label: 'S3-compatible' }]}
            onChange={(v) => setSettings({ backup: { ...settings.backup, provider: v } })}
          />
          {settings.backup.provider === 's3' && (
            <input
              className="text-input"
              placeholder="https://s3.example.com/gallery-vault"
              value={settings.backup.endpoint}
              onChange={(e) => setSettings({ backup: { ...settings.backup, endpoint: e.target.value } })}
            />
          )}
          <label className="switch-row">
            <span>End-to-end encryption (AES-256-GCM)</span>
            <input type="checkbox" checked={settings.backup.encrypted} onChange={(e) => setSettings({ backup: { ...settings.backup, encrypted: e.target.checked } })} />
            <i />
          </label>
          <button
            type="button"
            className="primary-btn"
            disabled={backingUp}
            onClick={() => { setBackingUp(true); runBackup(() => { setBackingUp(false); toast('Backup complete — encrypted'); }); }}
          >
            <Icon name={backingUp ? 'sparkle' : 'cloud'} size={16} /> {backingUp ? 'Backing up…' : 'Back up now'}
          </button>
          {settings.backup.lastBackupAt && <p className="hint">Last backup {relativeTime(settings.backup.lastBackupAt)} · {formatBytes(items.reduce((s, i) => s + i.bytes, 0))}</p>}
        </section>

        <section className="set-card">
          <h3><Icon name="info" size={17} /> {t('about')}</h3>
          <p className="hint">Nova Gallery web prototype · v0.1.0 · branch <code>arena/01a07b15-gallery</code></p>
          <p className="hint">Browser-runnable test build of the Flutter spec in <code>README.md</code>. Sample photos are stock thumbnails bundled for testing; see <code>media/ATTRIBUTION.md</code>.</p>
          <button type="button" className="ghost-btn danger" onClick={resetAll}>
            <Icon name="restore" size={14} /> Reset demo data
          </button>
        </section>
        <div className="scroll-pad" />
      </div>

      {pinOpen && (
        <Dialog title="Change PIN" onClose={() => setPinOpen(false)}>
          <input
            className="text-input"
            inputMode="numeric"
            maxLength={4}
            value={pinDraft}
            onChange={(e) => setPinDraft(e.target.value.replace(/\D/g, ''))}
            placeholder="4 digits"
          />
          <div className="dialog-actions">
            <button type="button" className="ghost-btn" onClick={() => setPinOpen(false)}>{t('cancel')}</button>
            <button
              type="button"
              className="primary-btn"
              disabled={pinDraft.length !== 4}
              onClick={() => { setSettings({ pin: pinDraft }); setPinOpen(false); toast('PIN updated'); }}
            >
              {t('save')}
            </button>
          </div>
        </Dialog>
      )}

      {privacyOpen && (
        <Sheet title="Data usage transparency" onClose={() => setPrivacyOpen(false)}>
          <div className="info-grid">
            <div className="info-row"><span>Processing location</span><strong>{t('on_device')}</strong></div>
            <div className="info-row"><span>Items scanned</span><strong>{report?.items ?? 0}</strong></div>
            <div className="info-row"><span>Faces grouped</span><strong>{report?.faces ?? 0}</strong></div>
            <div className="info-row"><span>Documents read (OCR)</span><strong>{report?.ocrDocs ?? 0}</strong></div>
            <div className="info-row"><span>Scan time</span><strong>{report ? `${Math.round(report.ms)} ms` : '—'}</strong></div>
            <div className="info-row"><span>Network uploads</span><strong>{settings.backup.enabled ? 'backup only (encrypted)' : 'none'}</strong></div>
          </div>
          <p className="hint">Face grouping, OCR, sharpness and duplicate detection all run in this browser tab. Nothing is uploaded unless you enable backup.</p>
        </Sheet>
      )}
    </div>
  );
}
