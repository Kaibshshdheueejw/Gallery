import { useEffect, useMemo, useState } from 'react';
import { getState, initApp, purgeItems, setTab, setWallpaperSeed, useApp } from './store';
import { applyTokens, buildTokens, isDarkTokens, SEEDS } from './core/theme';
import { wallpaperSeed } from './ml/pipelines';
import { translate, type Lang } from './core/i18n';
import { Icon } from './core/icons';
import { ToastHost } from './components/ui';
import { TimelineScreen } from './features/timeline/TimelineScreen';
import { AlbumsScreen, AlbumDetailScreen } from './features/albums/AlbumsScreen';
import { SearchScreen } from './features/search/SearchScreen';
import { ForYouScreen } from './features/foryou/ForYouScreen';
import { Viewer } from './features/viewer/Viewer';
import { Editor } from './features/editor/Editor';
import { SettingsScreen } from './features/settings/SettingsScreen';
import { StorageScreen } from './features/storage/StorageScreen';
import { TrashScreen } from './features/trash/TrashScreen';
import { LockedScreen } from './features/locked/LockedScreen';
import { ShareSheet } from './features/share/ShareSheet';
import type { TabId } from './data/models';

const TAB_META: Record<TabId, { icon: string; key: string }> = {
  foryou: { icon: 'sparkle', key: 'tab_foryou' },
  timeline: { icon: 'clock', key: 'tab_timeline' },
  albums: { icon: 'folder', key: 'tab_albums' },
  search: { icon: 'search', key: 'tab_search' },
};

export function App() {
  const app = useApp();
  const { settings } = app;
  const [prefersDark, setPrefersDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setPrefersDark(mq.matches);
    mq.addEventListener?.('change', onChange);
    initApp();
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  // Material You dynamic colour from the newest photo once the scan finishes
  useEffect(() => {
    if (app.status === 'ready' && settings.dynamicColor && !app.wallpaperSeed) {
      setWallpaperSeed(wallpaperSeed(app.items));
    }
  }, [app.status, app.items, settings.dynamicColor, app.wallpaperSeed]);

  // retention auto-purge
  useEffect(() => {
    if (app.status !== 'ready') return;
    const cutoff = Date.now() - settings.retentionDays * 86_400_000;
    const expired = app.items.filter((i) => i.trashedAt !== null && i.trashedAt < cutoff).map((i) => i.id);
    if (expired.length) purgeItems(expired);
  }, [app.status, app.items, settings.retentionDays]);

  const seedHex = useMemo(() => {
    if (settings.dynamicColor && app.wallpaperSeed) return app.wallpaperSeed;
    return SEEDS.find((s) => s.id === settings.seed)?.color ?? settings.seed;
  }, [settings.dynamicColor, settings.seed, app.wallpaperSeed]);

  useEffect(() => {
    applyTokens(buildTokens(seedHex, settings.mode, prefersDark));
    document.documentElement.dataset.dark = String(isDarkTokens(settings.mode, prefersDark));
  }, [seedHex, settings.mode, prefersDark]);

  useEffect(() => {
    document.documentElement.lang = settings.lang;
  }, [settings.lang]);

  const t = (k: string) => translate(settings.lang as Lang, k);

  let body: React.ReactNode;
  switch (app.route.name) {
    case 'album': body = <AlbumDetailScreen key={app.route.album.type + app.route.album.id} album={app.route.album} />; break;
    case 'settings': body = <SettingsScreen />; break;
    case 'storage': body = <StorageScreen />; break;
    case 'trash': body = <TrashScreen />; break;
    case 'locked': body = <LockedScreen />; break;
    default:
      body = app.activeTab === 'timeline' ? <TimelineScreen />
        : app.activeTab === 'albums' ? <AlbumsScreen />
          : app.activeTab === 'search' ? <SearchScreen />
            : <ForYouScreen />;
  }

  return (
    <div className="app-shell">
      <div className="app-frame">
        {body}
        {app.route.name === 'tabs' && (
          <nav className="bottom-nav">
            {settings.tabOrder.map((tab) => (
              <button key={tab} type="button" className={app.activeTab === tab ? 'on' : ''} onClick={() => setTab(tab)}>
                <span className="pill"><Icon name={TAB_META[tab].icon} size={20} filled={app.activeTab === tab && tab === 'foryou'} /></span>
                <em>{t(TAB_META[tab].key)}</em>
              </button>
            ))}
          </nav>
        )}
      </div>
      {app.viewer && <Viewer />}
      {app.editorId && <Editor />}
      {app.shareIds && <ShareSheet />}
      <ToastHost />
      {app.status === 'loading' && (
        <div className="boot">
          <Icon name="sparkle" size={44} className="spin-slow" />
          <strong>{t('app_name')}</strong>
        </div>
      )}
      <DevHint />
    </div>
  );
}

function DevHint() {
  const [open, setOpen] = useState(false);
  const app = getState();
  void app;
  return (
    <button type="button" className={`dev-hint${open ? ' open' : ''}`} onClick={() => setOpen((o) => !o)} title="About this preview">
      <Icon name="info" size={16} />
      {open && (
        <span>
          Web test build of the Nova Gallery Flutter spec (README.md). Try: pinch / Ctrl-scroll the Timeline grid,
          long-press to multi-select, search “sunset beach photos from July”, edit a photo, lock items (PIN 1234),
          and check Settings → Data usage transparency.
        </span>
      )}
    </button>
  );
}
