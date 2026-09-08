/**
 * Settings — categorised hub (§6–§7). The hub lists every feature area
 * (Appearance, Gallery, Albums, Playback, Photo Editing, Video Editing,
 * Privacy & Security, Storage & Cleanup, Backup & Sync, Notifications,
 * AI & Smart Features, Permissions, About Gallery); each row opens its own
 * dedicated sub-screen. Storage & Cleanup hosts the liquid visualization and
 * every cleanup tool moved out of For You.
 */
import { useState } from 'react';
import { navigate, resetAll, runBackup, setSettings, setTabOrder, toast, useApp, type SettingsPage } from '../../store';
import { AnimatedToggle, GlassSegmented, GlassSlider, SettingsCategory, SettingsRow, SettingsSection } from '../../components/glass';
import { Dialog, IconButton, Sheet } from '../../components/ui';
import { StorageCleanup } from '../storage/StorageScreen';
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
  albums: { title: 'set_albums', desc: 'set_albums_d', icon: 'folder' },
  playback: { title: 'set_playback', desc: 'set_playback_d', icon: 'playCircle' },
  photoEdit: { title: 'set_photoedit', desc: 'set_photoedit_d', icon: 'edit' },
  videoEdit: { title: 'set_videoedit', desc: 'set_videoedit_d', icon: 'video' },
  privacy: { title: 'set_privacy', desc: 'set_privacy_d', icon: 'shield' },
  cleanup: { title: 'set_cleanup', desc: 'set_cleanup_d', icon: 'storage' },
  backup: { title: 'set_backup', desc: 'set_backup_d', icon: 'cloud' },
  notifications: { title: 'set_notifications', desc: 'set_notifications_d', icon: 'bell' },
  ai: { title: 'set_ai', desc: 'set_ai_d', icon: 'sparkle' },
  permissions: { title: 'set_permissions', desc: 'set_permissions_d', icon: 'key' },
  about: { title: 'set_about', desc: 'set_about_d', icon: 'info' },
};

/** the hub order requested in §7 */
const HUB: Array<{ page: Exclude<SettingsPage, 'main'>; icon: string; title: string; desc: string }> = [
  { page: 'appearance', icon: 'palette', title: 'set_appearance', desc: 'set_appearance_d' },
  { page: 'gallery', icon: 'image', title: 'set_gallery', desc: 'set_gallery_d' },
  { page: 'albums', icon: 'folder', title: 'set_albums', desc: 'set_albums_d' },
  { page: 'playback', icon: 'playCircle', title: 'set_playback', desc: 'set_playback_d' },
  { page: 'photoEdit', icon: 'edit', title: 'set_photoedit', desc: 'set_photoedit_d' },
  { page: 'videoEdit', icon: 'video', title: 'set_videoedit', desc: 'set_videoedit_d' },
  { page: 'privacy', icon: 'shield', title: 'set_privacy', desc: 'set_privacy_d' },
  { page: 'cleanup', icon: 'storage', title: 'set_cleanup', desc: 'set_cleanup_d' },
  { page: 'backup', icon: 'cloud', title: 'set_backup', desc: 'set_backup_d' },
  { page: 'notifications', icon: 'bell', title: 'set_notifications', desc: 'set_notifications_d' },
  { page: 'ai', icon: 'sparkle', title: 'set_ai', desc: 'set_ai_d' },
  { page: 'permissions', icon: 'key', title: 'set_permissions', desc: 'set_permissions_d' },
  { page: 'about', icon: 'info', title: 'set_about', desc: 'set_about_d' },
];

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
            <div className="set-group glass hub-group">
              {HUB.map((h) => (
                <SettingsCategory key={h.page} icon={h.icon} title={t(h.title)} desc={t(h.desc)} onClick={() => navigate({ name: 'settings', page: h.page })} />
              ))}
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
            <SettingsSection title="For You sections" footnote="Control which discovery rails appear on the For You tab.">
              <SettingsRow icon="memories" title="Memories" desc="Dedicated screen from the Timeline menu" right={<AnimatedToggle label="Memories" checked={settings.foryou.memories} onChange={(v) => setSettings({ foryou: { ...settings.foryou, memories: v } })} />} />
              <SettingsRow icon="story" title="Stories" right={<AnimatedToggle label="Stories" checked={settings.foryou.stories} onChange={(v) => setSettings({ foryou: { ...settings.foryou, stories: v } })} />} />
              <SettingsRow icon="clock" title="On this day" right={<AnimatedToggle label="On this day" checked={settings.foryou.onThisDay} onChange={(v) => setSettings({ foryou: { ...settings.foryou, onThisDay: v } })} />} />
              <SettingsRow icon="image" title="Recently added" right={<AnimatedToggle label="Recently" checked={settings.foryou.recently} onChange={(v) => setSettings({ foryou: { ...settings.foryou, recently: v } })} />} />
              <SettingsRow icon="sparkle" title="Featured moments" right={<AnimatedToggle label="Featured" checked={settings.foryou.featured} onChange={(v) => setSettings({ foryou: { ...settings.foryou, featured: v } })} />} />
              <SettingsRow icon="wand" title="Smart suggestions" right={<AnimatedToggle label="Suggestions" checked={settings.foryou.suggestions} onChange={(v) => setSettings({ foryou: { ...settings.foryou, suggestions: v } })} />} />
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

        {page === 'albums' && (
          <div className="set-list">
            <div className="set-page-title"><h2>{t('set_albums')}</h2><p>{t('set_albums_d')}</p></div>
            <SettingsSection title="Sections" footnote="People live in Albums — For You stays focused on discovery.">
              <SettingsRow icon="person" title="People" desc="On-device face clusters" right={<AnimatedToggle label="People" checked={settings.albums.showPeople} onChange={(v) => setSettings({ albums: { ...settings.albums, showPeople: v } })} />} />
              <SettingsRow icon="mapPin" title="Places" desc="Group photos by location" right={<AnimatedToggle label="Places" checked={settings.albums.showPlaces} onChange={(v) => setSettings({ albums: { ...settings.albums, showPlaces: v } })} />} />
              <SettingsRow icon="folder" title="Folders" desc="Show device folder albums" right={<AnimatedToggle label="Folders" checked={settings.albums.showFolders} onChange={(v) => setSettings({ albums: { ...settings.albums, showFolders: v } })} />} />
              <SettingsRow icon="history" title="Recently viewed" right={<AnimatedToggle label="Viewed" checked={settings.albums.showViewed} onChange={(v) => setSettings({ albums: { ...settings.albums, showViewed: v } })} />} />
            </SettingsSection>
            <SettingsSection title="Sorting">
              <div style={{ padding: 14 }}>
                <GlassSegmented
                  value={settings.albums.sort}
                  options={[{ id: 'auto', label: 'Auto' }, { id: 'name', label: 'Name' }, { id: 'count', label: 'Count' }, { id: 'recent', label: 'Recent' }]}
                  onChange={(v) => setSettings({ albums: { ...settings.albums, sort: v } })}
                />
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
              <SettingsRow icon="pip" title="Picture-in-picture" desc="Available from the viewer's video controls" right={<Icon name="check" size={17} className="chev" />} />
              <SettingsRow icon="subtitle" title="Timed text overlays (CC)" desc="Toggle in the viewer — layers from the video editor" right={<Icon name="check" size={17} className="chev" />} />
            </SettingsSection>
            <SettingsSection title="Media" footnote="Thumbnails are decoded at display size; full-resolution images are only decoded in the viewer and editor.">
              <SettingsRow icon="image" title="Decode full resolution" desc="Viewer & editor only" right={<Icon name="check" size={17} className="chev" />} />
              <SettingsRow icon="grid" title="Lazy thumbnail loading" desc="Grids decode on scroll" right={<Icon name="check" size={17} className="chev" />} />
            </SettingsSection>
            <div className="scroll-pad" />
          </div>
        )}

        {page === 'photoEdit' && (
          <div className="set-list">
            <div className="set-page-title"><h2>{t('set_photoedit')}</h2><p>{t('set_photoedit_d')}</p></div>
            <SettingsSection title="Editing">
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="field-label">Preview quality</div>
                <GlassSegmented
                  value={settings.photoEdit.previewQuality}
                  options={[{ id: 'fast', label: 'Fast' }, { id: 'balanced', label: 'Balanced' }, { id: 'high', label: 'High' }]}
                  onChange={(v) => setSettings({ photoEdit: { ...settings.photoEdit, previewQuality: v } })}
                />
              </div>
              <SettingsRow icon="wand" title="Auto enhance on open" desc="Apply histogram-based enhance when entering the editor" right={<AnimatedToggle label="Auto enhance" checked={settings.photoEdit.autoEnhance} onChange={(v) => setSettings({ photoEdit: { ...settings.photoEdit, autoEnhance: v } })} />} />
              <div style={{ padding: 14 }}>
                <GlassSlider label="Undo history depth" value={settings.photoEdit.historyDepth} min={10} max={100} step={5} onChange={(v) => setSettings({ photoEdit: { ...settings.photoEdit, historyDepth: v } })} format={(v) => `${v} steps`} />
              </div>
            </SettingsSection>
            <SettingsSection title="Export">
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="field-label">Format</div>
                <GlassSegmented
                  value={settings.photoEdit.exportFormat}
                  options={[{ id: 'png', label: 'PNG (lossless)' }, { id: 'jpeg', label: 'JPEG' }]}
                  onChange={(v) => setSettings({ photoEdit: { ...settings.photoEdit, exportFormat: v } })}
                />
                <GlassSlider label="JPEG quality" value={settings.photoEdit.exportQuality} min={50} max={100} onChange={(v) => setSettings({ photoEdit: { ...settings.photoEdit, exportQuality: v } })} format={(v) => `${v}%`} />
              </div>
            </SettingsSection>
            <div className="scroll-pad" />
          </div>
        )}

        {page === 'videoEdit' && (
          <div className="set-list">
            <div className="set-page-title"><h2>{t('set_videoedit')}</h2><p>{t('set_videoedit_d')}</p></div>
            <SettingsSection title="Player gestures" footnote="Google-Files style: swipe the left half for brightness, right half for volume, horizontally to seek.">
              <SettingsRow icon="sun" title="Brightness swipe" desc="Left-half vertical swipe" right={<AnimatedToggle label="Brightness gesture" checked={settings.videoEdit.gestures.brightness} onChange={(v) => setSettings({ videoEdit: { ...settings.videoEdit, gestures: { ...settings.videoEdit.gestures, brightness: v } } })} />} />
              <SettingsRow icon="volume" title="Volume swipe" desc="Right-half vertical swipe" right={<AnimatedToggle label="Volume gesture" checked={settings.videoEdit.gestures.volume} onChange={(v) => setSettings({ videoEdit: { ...settings.videoEdit, gestures: { ...settings.videoEdit.gestures, volume: v } } })} />} />
              <SettingsRow icon="clock" title="Seek swipe" desc="Horizontal swipe along the frame" right={<AnimatedToggle label="Seek gesture" checked={settings.videoEdit.gestures.seek} onChange={(v) => setSettings({ videoEdit: { ...settings.videoEdit, gestures: { ...settings.videoEdit.gestures, seek: v } } })} />} />
            </SettingsSection>
            <SettingsSection title="Playback defaults">
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="field-label">Default speed</div>
                <GlassSegmented
                  value={String(settings.videoEdit.defaultSpeed)}
                  options={[{ id: '0.5', label: '0.5×' }, { id: '1', label: '1×' }, { id: '1.5', label: '1.5×' }, { id: '2', label: '2×' }]}
                  onChange={(v) => setSettings({ videoEdit: { ...settings.videoEdit, defaultSpeed: Number(v) } })}
                />
                <div className="field-label">Frame-step size</div>
                <GlassSegmented
                  value={settings.videoEdit.frameStep === 1 / 30 ? '30' : '60'}
                  options={[{ id: '30', label: '1/30 s' }, { id: '60', label: '1/60 s' }]}
                  onChange={(v) => setSettings({ videoEdit: { ...settings.videoEdit, frameStep: v === '30' ? 1 / 30 : 1 / 60 } })}
                />
              </div>
            </SettingsSection>
            <SettingsSection title="Export" footnote="WebM export re-renders your exact edit recipe via MediaRecorder.">
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="field-label">Resolution</div>
                <GlassSegmented
                  value={String(settings.videoEdit.exportRes)}
                  options={[{ id: '720', label: '720p' }, { id: '1080', label: '1080p' }]}
                  onChange={(v) => setSettings({ videoEdit: { ...settings.videoEdit, exportRes: Number(v) as 720 | 1080 } })}
                />
                <div className="field-label">Frame rate</div>
                <GlassSegmented
                  value={String(settings.videoEdit.exportFps)}
                  options={[{ id: '30', label: '30 fps' }, { id: '60', label: '60 fps' }]}
                  onChange={(v) => setSettings({ videoEdit: { ...settings.videoEdit, exportFps: Number(v) as 30 | 60 } })}
                />
              </div>
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

        {page === 'cleanup' && (
          <div className="set-list">
            <div className="set-page-title"><h2>{t('set_cleanup')}</h2><p>{t('set_cleanup_d')}</p></div>
            <StorageCleanup embedded />
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
            <SettingsSection title="Suggestions" footnote="Preferences are stored and applied in-app (For You cards). System push notifications arrive with the device build.">
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
            <SettingsSection title="Granted" footnote="The phone app requests runtime permissions for your real photo library; this build reads its bundled sample library.">
              <SettingsRow icon="image" title="Photos & videos" desc="Media library access" right={<span className="chip static">Granted</span>} />
              <SettingsRow icon="mapPin" title="Location" desc="Read from embedded EXIF only" right={<span className="chip static">Embedded</span>} />
              <SettingsRow icon="fingerprint" title="Biometrics" desc={settings.biometrics ? 'Available for Locked folder' : 'Disabled'} right={<span className="chip static">{settings.biometrics ? 'On' : 'Off'}</span>} />
              <SettingsRow icon="bell" title="Notifications" desc="Not requested yet" right={<span className="chip static">None</span>} />
            </SettingsSection>
            <div className="scroll-pad" />
          </div>
        )}

        {page === 'about' && (
          <div className="set-list">
            <div className="set-page-title"><h2>{t('set_about')}</h2><p>{t('set_about_d')}</p></div>
            <SettingsSection>
              <SettingsRow icon="sparkle" title={t('app_name')} desc="Version 1.0" />
              <SettingsRow icon="image" title="Sample media attribution" desc="Bundled library credits" onClick={() => setAttribOpen(true)} />
              <SettingsRow icon="restore" title="Reset Gallery" desc="Restore default settings and clear all in-app changes" onClick={resetAll} />
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
            The bundled sample library is generated from low-resolution search thumbnails (Pexels, Unsplash, Vecteezy and
            stock-agency previews) saved under <code>image-search/</code>, downscaled to ≤1000 px. Screenshots are
            synthetic SVG mocks. See <code>web/public/media/ATTRIBUTION.md</code>. Replace with licensed assets or the
            user's own media before shipping.
          </p>
        </Sheet>
      )}
    </div>
  );
}
