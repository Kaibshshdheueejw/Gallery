import { useEffect, useMemo, useState } from 'react';
import { initApp, purgeItems, setTab, setWallpaperSeed, useApp } from './store';
import { applyTokens, buildTokens, isDarkTokens, SEEDS } from './core/theme';
import { applyDesignVars } from './core/design';
import { wallpaperSeed } from './ml/pipelines';
import { translate, type Lang } from './core/i18n';
import { Icon } from './core/icons';
import { ToastHost } from './components/ui';
import { FloatingNavigation } from './components/glass';
import { TimelineScreen } from './features/timeline/TimelineScreen';
import { AlbumsScreen, AlbumDetailScreen } from './features/albums/AlbumsScreen';
import { SearchScreen } from './features/search/SearchScreen';
import { ForYouScreen } from './features/foryou/ForYouScreen';
import { Viewer } from './features/viewer/Viewer';
import { Editor } from './features/editor/Editor';
import { SettingsScreen } from './features/settings/SettingsScreen';
import { StorageScreen } from './features/storage/StorageScreen';
import { TrashScreen } from './features/trash/TrashScreen';
import { LockedScreen, LockGate } from './features/locked/LockedScreen';
import { ShareSheet } from './features/share/ShareSheet';
import type { SettingsPage } from './store';

export function App() {
  const app = useApp();
  const { settings } = app;
  const [prefersDark, setPrefersDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true);
  const [sessionUnlocked, setSessionUnlocked] = useState(false);

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

  useEffect(() => { applyDesignVars(settings); }, [settings]);
  useEffect(() => { document.documentElement.lang = settings.lang; }, [settings.lang]);

  const t = (k: string) => translate(settings.lang as Lang, k);

  // app lock gate (Privacy & Security → App lock)
  if (app.status === 'ready' && settings.appLock && !sessionUnlocked && !app.viewer && !app.editorId) {
    return (
      <div className="app-root">
        <div className="content">
          <LockGate onUnlock={() => setSessionUnlocked(true)} title={t('app_name')} />
        </div>
        <ToastHost />
      </div>
    );
  }

  /* page-transition key (§18): every route/tab change remounts the wrapper,
     replaying a cheap fade+scale+slide — only one element animates, never the grid */
  const routeKey = app.route.name === 'settings'
    ? `settings-${app.route.page ?? 'main'}`
    : app.route.name === 'album'
      ? `album-${app.route.album.type}-${app.route.album.id}`
      : app.route.name === 'tabs'
        ? `tab-${app.activeTab}`
        : app.route.name;

  let body: React.ReactNode;
  switch (app.route.name) {
    case 'album': body = <AlbumDetailScreen key={app.route.album.type + app.route.album.id} album={app.route.album} />; break;
    case 'settings': body = <SettingsScreen key={app.route.page ?? 'main'} page={(app.route.page ?? 'main') as SettingsPage} />; break;
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
    <div className="app-root">
      <div className="content">
        <div className={`page-anim${settings.animations ? '' : ' no-anim'}`} key={settings.animations ? routeKey : 'static'}>
          {body}
        </div>
        {app.route.name === 'tabs' && <FloatingNavigation />}
      </div>
      {app.viewer && <Viewer />}
      {app.editorId && <Editor />}
      {app.shareIds && <ShareSheet />}
      <ToastHost />
      {app.status === 'loading' && (
        <div className="boot">
          <Icon name="sparkle" size={46} className="spin-slow" />
          <strong>{t('app_name')}</strong>
        </div>
      )}
      <DevHint />
    </div>
  );
}

function DevHint() {
  const [open, setOpen] = useState(false);
  return (
    <button type="button" className={`dev-hint glass glass-strong${open ? ' open' : ''}`} onClick={() => setOpen((o) => !o)} title="About this preview">
      <Icon name="info" size={16} />
      {open && (
        <span>
          Web test build of the Gallery spec (README.md). Try: the hamburger menu on every tab,
          pinch / Ctrl-scroll the Timeline grid, long-press to multi-select → Collage, search
          “sunset beach photos from July”, edit a photo (curves, HSL, stickers, text, retouch),
          swipe a playing video — left half brightness, right half volume, across to seek —
          lock items (PIN 1234), and explore Settings → Storage & Cleanup.
        </span>
      )}
    </button>
  );
}
