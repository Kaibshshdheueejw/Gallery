/**
 * Settings — flagship-style hierarchy.
 * Hub of categories → focused sub-pages (Appearance, Gallery, Playback,
 * Privacy & Security, Storage, Backup & Sync, Notifications, AI, Permissions, About).
 */
import { useState } from 'react';
import { navigate, resetAll, runBackup, setSettings, setTabOrder, toast, useApp, type SettingsPage } from '../../store';
import { AnimatedToggle, GlassSegmented, GlassSlider, SettingsCategory, SettingsRow, SettingsSection } from '../../components/glass';
import { Dialog, IconButton, Sheet } from '../../components/ui';
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

const PAGES: Record<SettingsPage, { title: string; desc: string; icon: string }> = {
  main: { title: 'settings', desc: '', icon: 'settings' },
  appearance: { title: 'set_appearance', desc: 'set_appearance_d', icon: 'palette' },
  gallery: { title: 'set_gallery', desc: 'set_gallery_d', icon: 'image' },
  playback: { title: 'set_playback', desc: 'set_playback_d', icon: 'playCircle' },
  privacy: { title: 'set_privacy', desc: 'set_privacy_d', icon: 'shield' },
  storage: { title: 'set_storage', desc: 'set_storage_d', icon: 'storage' },
  backup: { title: 'set_backup', desc: 'set_backup_d', icon: 'cloud' },
  notifications: { title: 'set_notifications', desc: 'set_notifications_d', icon: 'bell' },
  ai: { title: 'set_ai', desc: 'set_ai_d', icon: 'sparkle' },
  permissions: { title: 'set_permissions', desc: 'set_permissions_d', icon: 'key' },
  about: { title: 'set_about', desc: 'set_about_d', icon: 'info' },
};

export function SettingsScreen({ page }: { page: SettingsPage }) {
  const app = useApp();
  const { settings, report } = app;
  const t = (k: string) => translate(settings.lang, k);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinDraft, setPinDraft] = useState('');
  const [backingUp, setBackingUp] = useState(false);
  const [dragTab, setDragTab] = useState<TabId | null>(null);
  const [attribOpen, setAttribOpen] = useState(false);

  const back = () => navigate(page === 'main' ? { name: 'tabs' } : { name: 'settings', page: 'main' });
  const meta = PAGES[page];
  const items = visibleItems(app.items);
  const totalBytes = items.reduce((s, i) => s + i.bytes, 0);

  const moveTab = (id: TabId, dir: -1 | 1) => {
    const order = [...settings.tabOrder];
    const i = order.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    setTabOrder(order);
  };

  return (
    <div className="screen slide-in">
      <header className="page-head with-back">
        <button type="button" className="back-btn glass glass-subtle" onClick={back} aria-label="Back">
          <Icon name="back" size={20} />
        </button>
        <div className="grow"><h1>{page === 'main' ? t('settings') : t(meta.title)}</h1></div>
      </header>

      <div className="scroll-area padded">
        {page === 'main' && (
          <div className="set-list">
            <div className="set-page-title">
              <h2>{t('settings')}</h2>
              <p>{t('app_name')} · {formatBytes(totalBytes)} · {items.length} items</p>
            </div>
            <div className="set-group glass">
              <SettingsCategory icon="palette" title={t('set_appearance')} desc={t('set_appearance_d')} onClick={() => navigate({ name: 'settings', page: 'appearance' })} />
              <SettingsCategory icon="image" title={t('set_gallery')} desc={t('set_gallery_d')} onClick={() => navigate({ name: 'settings', page: 'gallery' })} />
              <SettingsCategory icon="playCircle" title={t('set_playback')} desc={t('set_playback_d')} onClick={() => navigate({ name: 'settings', page: 'playback' })} />
              <SettingsCategory icon="shield" title={t('set_privacy')} desc={t('set_privacy_d')} onClick={() => navigate({ name: 'settings', page: 'privacy' })} />
              <SettingsCategory icon="storage" title={t('set_storage')} desc={t('set_storage_d')} onClick={() => navigate({ name: 'settings', page: 'storage' })} />
              <SettingsCategory icon="cloud" title={t('set_backup')} desc={t('set_backup_d')} onClick={() => navigate({ name: 'settings', page: 'backup' })} />
              <SettingsCategory icon="bell" title={t('set_notifications')} desc={t('set_notifications_d')} onClick={() => navigate({ name: 'settings', page: 'notifications' })} />
              <SettingsCategory icon="sparkle" title={t('set_ai')} desc={t('set_ai_d')} onClick={() => navigate({ name: 'settings', page: 'ai' })} />
              <SettingsCategory icon="key" title={t('set_permissions')} desc={t('set_permissions_d')} onClick={() => navigate({ name: 'settings', page: 'permissions' })} />
              <SettingsCategory icon="info" title={t('set_about')} desc={t('set_about_d')} onClick={() => navigate({ name: 'settings', page: 'about' })} />
            </div>
            <div className="scroll-pad" />
          </div>
        )}

        {page === 'appearance' && (
          <div className="set-list">
            <div className="set-page-title"><h2>{t('set_appearance')}</h2><p>{t('set_appearance_d')}</p></div>
            <SettingsSection title="Theme">
              <div style={{ padding: 14 }}>
                <GlassSegmented
                  value={settings.mode}
                  options={[{ id: 'system', label: t('theme_system'), icon: 'monitor' }, { id: 'light', label: t('theme_light'), icon: 'sun' }, { id: 'dark', label: t('theme_dark'), icon: 'moon' }]}
                  onChange={(v) => setSettings({ mode: v })}
                />
              </div>
            </SettingsSection>
            <SettingsSection title="Liquid Glass">
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <GlassSlider label="Glass intensity" value={settings.glass.intensity} min={0} max={100} onChange={(v) => setSettings({ glass: { ...settings.glass, intensity: v } })} />
                <GlassSlider label="Blur" value={settings.glass.blur} min={0} max={100} onChange={(v) => setSettings({ glass: { ...settings.glass, blur: v } })} />
                <GlassSlider label="Transparency" value={settings.glass.transparency} min={0} max={100} onChange={(v) => setSettings({ glass: { ...settings.glass, transparency: v } })} />
              </div>
            </SettingsSection>
            <SettingsSection title="Accent">
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="swatch-row">
                  {SEEDS.map((s) => (
                    <button key={s.id} type="button" className={`seed${settings.seed === s.id && !settings.dynamicColor ? ' on' : ''}`} style={{ background: s.color }} title={s.label} aria-label={s.label} onClick={() => setSettings({ seed: s.id, dynamicColor: false })} />
                  ))}
                  <button type="button" className={`seed dynamic${settings.dynamicColor ? ' on' : ''}`} title="Material You — sample from newest photo" onClick={() => setSettings({ dynamicColor: true })}>
                    <Icon name="wand" size={15} />
                  </button>
                </div>
                <p className="footnote" style={{ padding: 0 }}>Material You samples the dominant tone of your newest photo; pick a swatch to use a fixed accent.</p>
              </div>
            </SettingsSection>
            <SettingsSection title="Layout">
              <div style={{ padding: 14 }}>
                <GlassSegmented
                  value={settings.layout}
                  options={[{ id: 'comfortable', label: 'Comfortable' }, { id: 'standard', label: 'Standard' }, { id: 'compact', label: 'Compact' }]}
                  onChange={(v) => setSettings({ layout: v })}
                />
              </div>
            </SettingsSection>
            <SettingsSection title="Navigation">
              <div style={{ padding: 14 }}>
                <GlassSegmented
                  value={settings.navStyle}
                  options={[{ id: 'capsule', label: 'Floating capsule', icon: 'sparkle' }, { id: 'compact', label: 'Compact', icon: 'grid' }]}
                  onChange={(v) => setSettings({ navStyle: v })}
                />
              </div>
            </SettingsSection>
            <SettingsSection title="Animations">
              <SettingsRow title="Smooth animations" desc="Spring transitions & micro-interactions" right={<AnimatedToggle label="Animations" checked={settings.animations} onChange={(v) => setSettings({ animations: v })} />} />
              <SettingsRow title="Haptic feedback" desc="Vibration on supported devices" right={<AnimatedToggle label="Haptics" checked={settings.haptics} onChange={(v) => setSettings({ haptics: v })} />} />
              <div style={{ padding: 14 }}>
                <div className="field-label" style={{ marginBottom: 8 }}>Animation speed</div>
                <GlassSegmented
                  value={settings.animSpeed}
                  options={[{ id: 'relaxed', label: 'Relaxed' }, { id: 'standard', label: 'Standard' }, { id: 'fast', label: 'Fast' }]}
                  onChange={(v) => setSettings({ animSpeed: v })}
                />
              </div>
            </SettingsSection>
            <div className="scroll-pad" />
          </div>
        )}

        {page === 'gallery' && (
          <div className="set-list">
            <div className="set-page-title"><h2>{t('set_gallery')}</h2><p>{t('set_gallery_d')}</p></div>
            <SettingsSection title="Browsing">
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="field-label">Default view</div>
                <GlassSegmented
                  value={settings.defaultTab}
                  options={settings.tabOrder.map((id) => ({ id, label: t(TAB_META[id].key) }))}
                  onChange={(v) => setSettings({ defaultTab: v })}
                />
                <div className="field-label">Sort order</div>
                <GlassSegmented
                  value={settings.sortOrder}
                  options={[{ id: 'newest', label: 'Newest first', icon: 'sort' }, { id: 'oldest', label: 'Oldest first' }]}
                  onChange={(v) => setSettings({ sortOrder: v })}
                />
                <div className="field-label">Default grouping</div>
                <GlassSegmented
                  value={settings.gridLevel <= 0 ? 'year' : settings.gridLevel === 1 ? 'month' : 'day'}
                  options={[{ id: 'day', label: 'Day' }, { id: 'month', label: 'Month' }, { id: 'year', label: 'Year' }]}
                  onChange={(v) => setSettings({ gridLevel: v === 'year' ? 0 : v === 'month' ? 1 : 3 })}
                />
              </div>
            </SettingsSection>
            <SettingsSection title="Media display">
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="field-label">{t('thumbnail_ratio')}</div>
                <GlassSegmented
                  value={settings.thumbRatio}
                  options={[{ id: 'square', label: '1:1' }, { id: '4:3', label: '4:3' }, { id: 'auto', label: 'Original' }]}
                  onChange={(v) => setSettings({ thumbRatio: v })}
                />
                <GlassSlider label={t('grid_density')} value={settings.gridLevel} min={0} max={5} onChange={(v) => setSettings({ gridLevel: v })} format={(v) => `${[3, 3, 4, 5, 6, 8][v]} cols`} />
              </div>
            </SettingsSection>
            <SettingsSection title="Hidden albums">
              <SettingsRow icon="eyeOff" title="Show Hidden album" desc="Reveal the Hidden album in Albums" right={<AnimatedToggle label="Show hidden" checked={settings.showHidden} onChange={(v) => setSettings({ showHidden: v })} />} />
            </SettingsSection>
            <SettingsSection title={t('home_layout')} footnote="Drag rows (or use the arrows) to reorder the floating navigation.">
              <div style={{ padding: 14 }}>
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
              </div>
            </SettingsSection>
            <SettingsSection title={t('language')}>
              <div className="lang-list">
                {LANGS.map((l) => (
                  <SettingsRow key={l.id} title={l.native} desc={l.label} right={settings.lang === l.id ? <Icon name="check" size={17} className="chev" /> : undefined} onClick={() => setSettings({ lang: l.id as Lang })} />
                ))}
              </div>
            </SettingsSection>
            <div className="scroll-pad" />
          </div>
        )}

        {page === 'playback' && (
          <div className="set-list">
            <div className="set-page-title"><h2>{t('set_playback')}</h2><p>{t('set_playback_d')}</p></div>
            <SettingsSection title="Video player">
              <SettingsRow icon="playCircle" title="Autoplay videos" desc="Start playing when opened in the viewer" right={<AnimatedToggle label="Autoplay" checked={settings.autoplay} onChange={(v) => setSettings({ autoplay: v })} />} />
              <SettingsRow icon="restore" title="Loop" desc="Repeat clips from the trim start" right={<AnimatedToggle label="Loop" checked={settings.loop} onChange={(v) => setSettings({ loop: v })} />} />
              <SettingsRow icon="pip" title="Picture-in-picture" desc={t('device_only')} disabled right={<span className="chev" style={{ fontSize: 11, fontWeight: 700 }}>SOON</span>} />
            </SettingsSection>
            <SettingsSection title="Media" footnote="Thumbnails are decoded at display size; full-resolution images are only decoded in the viewer and editor.">
              <SettingsRow icon="image" title="Decode full resolution" desc="Viewer & editor only" right={<Icon name="check" size={17} className="chev" />} />
              <SettingsRow icon="grid" title="Lazy thumbnail loading" desc="Grids decode on scroll" right={<Icon name="check" size={17} className="chev" />} />
            </SettingsSection>
            <div className="scroll-pad" />
          </div>
        )}

        {page === 'privacy' && (
          <div className="set-list">
            <div className="set-page-title"><h2>{t('set_privacy')}</h2><p>{t('set_privacy_d')}</p></div>
            <SettingsSection title="Private space">
              <SettingsRow icon="lock" title={t('locked_folder')} desc="Biometric-protected private media" onClick={() => navigate({ name: 'locked' })} />
              <SettingsRow icon="eyeOff" title="Hidden media" desc="Show the Hidden album in Albums" right={<AnimatedToggle label="Hidden" checked={settings.showHidden} onChange={(v) => setSettings({ showHidden: v })} />} />
            </SettingsSection>
            <SettingsSection title="App lock">
              <SettingsRow icon="shield" title="Lock Gallery on open" desc="Require unlock each session" right={<AnimatedToggle label="App lock" checked={settings.appLock} onChange={(v) => { setSettings({ appLock: v }); toast(v ? 'Gallery will lock on next launch' : 'App lock off'); }} />} />
              <SettingsRow icon="fingerprint" title="Biometric unlock" desc="Fingerprint / face where available" right={<AnimatedToggle label="Biometrics" checked={settings.biometrics} onChange={(v) => setSettings({ biometrics: v })} />} />
              <SettingsRow icon="keypad" title="Change PIN" desc="Used when biometrics are unavailable" onClick={() => { setPinDraft(settings.pin); setPinOpen(true); }} />
            </SettingsSection>
            <SettingsSection title="Data" footnote="Face grouping, OCR, sharpness and duplicate detection run in this browser tab. Nothing uploads unless backup is enabled.">
              <SettingsRow icon="eye" title="Data usage transparency" desc={report ? `${report.items} items · ${report.faces} faces · ${report.ocrDocs} docs` : '—'} onClick={() => navigate({ name: 'settings', page: 'ai' })} />
            </SettingsSection>
            <div className="scroll-pad" />
          </div>
        )}

        {page === 'storage' && (
          <div className="set-list">
            <div className="set-page-title"><h2>{t('set_storage')}</h2><p>{t('set_storage_d')}</p></div>
            <SettingsSection title="Analyse">
              <SettingsRow icon="storage" title="Storage analyzer" desc={`${formatBytes(totalBytes)} across ${items.length} items`} onClick={() => navigate({ name: 'storage' })} />
              <SettingsRow icon="copy" title="Duplicate detection" desc="Perceptual-hash grouping, on-device" right={<AnimatedToggle label="Duplicates" checked={settings.ai.duplicates} onChange={(v) => setSettings({ ai: { ...settings.ai, duplicates: v } })} />} />
              <SettingsRow icon="eye" title="Blurry photo detection" desc="Laplacian-variance sharpness model" right={<AnimatedToggle label="Blurry" checked={settings.ai.blur} onChange={(v) => setSettings({ ai: { ...settings.ai, blur: v } })} />} />
            </SettingsSection>
            <SettingsSection title={t('trash')}>
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <GlassSlider label={t('retention')} value={settings.retentionDays} min={7} max={90} onChange={(v) => setSettings({ retentionDays: v as 7 | 30 | 60 | 90 })} format={(v) => `${v} days`} />
                <SettingsRow title="Automatic cleanup" desc="Purge expired items without asking" right={<AnimatedToggle label="Auto cleanup" checked={settings.autoCleanup} onChange={(v) => setSettings({ autoCleanup: v })} />} />
              </div>
              <SettingsRow icon="trash" title="Open Recycle bin" onClick={() => navigate({ name: 'trash' })} />
            </SettingsSection>
            <div className="scroll-pad" />
          </div>
        )}

        {page === 'backup' && (
          <div className="set-list">
            <div className="set-page-title"><h2>{t('set_backup')}</h2><p>{t('set_backup_d')}</p></div>
            <SettingsSection title="Backup">
              <SettingsRow icon="cloud" title="Encrypted cloud backup" desc="AES-256-GCM, bring-your-own provider" right={<AnimatedToggle label="Backup" checked={settings.backup.enabled} onChange={(v) => setSettings({ backup: { ...settings.backup, enabled: v } })} />} />
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <GlassSegmented
                  value={settings.backup.provider}
                  options={[{ id: 'drive', label: 'Google Drive' }, { id: 's3', label: 'S3-compatible' }]}
                  onChange={(v) => setSettings({ backup: { ...settings.backup, provider: v } })}
                />
                {settings.backup.provider === 's3' && (
                  <input className="text-input" placeholder="https://s3.example.com/gallery-vault" value={settings.backup.endpoint} onChange={(e) => setSettings({ backup: { ...settings.backup, endpoint: e.target.value } })} />
                )}
              </div>
              <SettingsRow icon="wifi" title="Wi-Fi only" desc="Never back up over mobile data" right={<AnimatedToggle label="Wi-Fi only" checked={settings.wifiOnly} onChange={(v) => setSettings({ wifiOnly: v })} />} />
              <SettingsRow icon="flash" title="Charging only" desc="Wait for a power source" right={<AnimatedToggle label="Charging only" checked={settings.chargingOnly} onChange={(v) => setSettings({ chargingOnly: v })} />} />
              <div style={{ padding: 14 }}>
                <button type="button" className="btn btn-primary press" disabled={backingUp} onClick={() => { setBackingUp(true); runBackup(() => { setBackingUp(false); toast('Backup complete — encrypted'); }); }}>
                  <Icon name={backingUp ? 'sparkle' : 'cloud'} size={16} /> {backingUp ? 'Backing up…' : 'Back up now'}
                </button>
                {settings.backup.lastBackupAt && <p className="footnote">Last backup {relativeTime(settings.backup.lastBackupAt)} · {formatBytes(totalBytes)}</p>}
              </div>
            </SettingsSection>
            <div className="scroll-pad" />
          </div>
        )}

        {page === 'notifications' && (
          <div className="set-list">
            <div className="set-page-title"><h2>{t('set_notifications')}</h2><p>{t('set_notifications_d')}</p></div>
            <SettingsSection title="Suggestions" footnote="In this web preview preferences are stored and applied in-app (For You cards); system push notifications require the on-device build.">
              <SettingsRow icon="memories" title="Memories" desc="Resurface trips & events" right={<AnimatedToggle label="Memories" checked={settings.notifications.memories} onChange={(v) => setSettings({ notifications: { ...settings.notifications, memories: v } })} />} />
              <SettingsRow icon="broom" title="Cleanup suggestions" desc="Duplicates, blurry & large files" right={<AnimatedToggle label="Cleanup" checked={settings.notifications.cleanup} onChange={(v) => setSettings({ notifications: { ...settings.notifications, cleanup: v } })} />} />
              <SettingsRow icon="cloud" title="Backup reminders" desc="When the vault is stale" right={<AnimatedToggle label="Backup" checked={settings.notifications.backup} onChange={(v) => setSettings({ notifications: { ...settings.notifications, backup: v } })} />} />
            </SettingsSection>
            <div className="scroll-pad" />
          </div>
        )}

        {page === 'ai' && (
          <div className="set-list">
            <div className="set-page-title"><h2>{t('set_ai')}</h2><p>{t('set_ai_d')}</p></div>
            <SettingsSection title="On-device intelligence" footnote={`Last scan: ${report ? `${report.items} items in ${Math.round(report.ms)} ms` : 'running…'}. Models never leave this device.`}>
              <SettingsRow icon="scanFace" title="Face grouping" desc={`${report?.faces ?? 0} faces grouped`} right={<AnimatedToggle label="Faces" checked={settings.ai.faces} onChange={(v) => setSettings({ ai: { ...settings.ai, faces: v } })} />} />
              <SettingsRow icon="scanText" title="Text recognition (OCR)" desc={`${report?.ocrDocs ?? 0} documents readable`} right={<AnimatedToggle label="OCR" checked={settings.ai.ocr} onChange={(v) => setSettings({ ai: { ...settings.ai, ocr: v } })} />} />
              <SettingsRow icon="copy" title="Duplicate & similar detection" right={<AnimatedToggle label="Duplicates" checked={settings.ai.duplicates} onChange={(v) => setSettings({ ai: { ...settings.ai, duplicates: v } })} />} />
              <SettingsRow icon="eye" title="Blurry photo detection" right={<AnimatedToggle label="Blurry" checked={settings.ai.blur} onChange={(v) => setSettings({ ai: { ...settings.ai, blur: v } })} />} />
              <SettingsRow icon="tag" title="Scene & object tagging" desc="Sunset, night, nature, food…" right={<AnimatedToggle label="Scenes" checked={settings.ai.scenes} onChange={(v) => setSettings({ ai: { ...settings.ai, scenes: v } })} />} />
            </SettingsSection>
            <div className="scroll-pad" />
          </div>
        )}

        {page === 'permissions' && (
          <div className="set-list">
            <div className="set-page-title"><h2>{t('set_permissions')}</h2><p>{t('set_permissions_d')}</p></div>
            <SettingsSection title="Granted" footnote="The web preview reads a bundled sample library instead of your device media.">
              <SettingsRow icon="image" title="Photos & videos" desc="Bundled sample library (read-only)" right={<span className="chip static">Granted</span>} />
              <SettingsRow icon="mapPin" title="Location" desc="Read from embedded EXIF only" right={<span className="chip static">Embedded</span>} />
              <SettingsRow icon="fingerprint" title="Biometrics" desc={settings.biometrics ? 'Available for Locked folder' : 'Disabled'} right={<span className="chip static">{settings.biometrics ? 'On' : 'Off'}</span>} />
              <SettingsRow icon="bell" title="Notifications" desc="Not requested in the web preview" right={<span className="chip static">None</span>} />
            </SettingsSection>
            <div className="scroll-pad" />
          </div>
        )}

        {page === 'about' && (
          <div className="set-list">
            <div className="set-page-title"><h2>{t('set_about')}</h2><p>{t('set_about_d')}</p></div>
            <SettingsSection>
              <SettingsRow icon="sparkle" title={t('app_name')} desc="Version 1.0 · web preview" />
              <SettingsRow icon="layers" title="Branch" desc="arena/01a07b15-gallery" />
              <SettingsRow icon="shield" title="Licence" desc="MIT" />
              <SettingsRow icon="image" title="Sample media attribution" desc="Stock thumbnails & synthetic screenshots" onClick={() => setAttribOpen(true)} />
              <SettingsRow icon="restore" title="Reset demo data" desc="Restore the factory library & settings" onClick={resetAll} />
            </SettingsSection>
            <div className="scroll-pad" />
          </div>
        )}
      </div>

      {pinOpen && (
        <Dialog title="Change PIN" onClose={() => setPinOpen(false)}>
          <input className="text-input" inputMode="numeric" maxLength={4} value={pinDraft} onChange={(e) => setPinDraft(e.target.value.replace(/\D/g, ''))} placeholder="4 digits" />
          <div className="dialog-actions">
            <button type="button" className="ghost-btn" onClick={() => setPinOpen(false)}>{t('cancel')}</button>
            <button type="button" className="btn btn-primary press" disabled={pinDraft.length !== 4} onClick={() => { setSettings({ pin: pinDraft }); setPinOpen(false); toast('PIN updated'); }}>
              {t('save')}
            </button>
          </div>
        </Dialog>
      )}

      {attribOpen && (
        <Sheet title="Sample media" onClose={() => setAttribOpen(false)}>
          <p className="hint">
            The demo library is generated from low-resolution search thumbnails (Pexels, Unsplash, Vecteezy and
            stock-agency previews) saved under <code>image-search/</code>, downscaled to ≤1000 px. Screenshots are
            synthetic SVG mocks. See <code>web/public/media/ATTRIBUTION.md</code>. Replace with licensed assets or the
            user's own media before shipping.
          </p>
        </Sheet>
      )}
    </div>
  );
}
