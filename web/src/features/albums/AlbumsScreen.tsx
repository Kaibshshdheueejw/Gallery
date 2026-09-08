import { useMemo, useState } from 'react';
import { createAlbum, deleteAlbum, navigate, openViewer, renameAlbum, renameFace, rescanLibrary, setSettings, useApp, type AlbumRef } from '../../store';
import {
  blurryItems, documents, duplicateItems, faceClusters, favorites, folders, hiddenItems,
  largeFiles, places, screenshots, trashedItems, videos, visibleItems, events, recentlyViewedItems,
} from '../../domain/usecases/library';
import { PhotoGrid, Thumb } from '../../components/PhotoGrid';
import { SelectionBar } from '../../components/SelectionBar';
import { useSelection } from '../../components/useSelection';
import { Dialog, EmptyState, IconButton, SectionTitle, Sheet } from '../../components/ui';
import { ScreenMenu } from '../../components/ScreenMenu';
import { AnimatedButton } from '../../components/glass';
import { Icon } from '../../core/icons';
import { translate } from '../../core/i18n';
import { formatBytes, formatMonthYear } from '../../core/utils';
import type { MediaItem } from '../../data/models';

export function resolveAlbum(ref: AlbumRef, items: MediaItem[], app: ReturnType<typeof useApp>): MediaItem[] {
  const { settings, customAlbums, recentlyViewed } = app;
  const vis = visibleItems(items);
  const sorted = [...vis].sort((a, b) => settings.sortOrder === 'newest' ? b.takenAt - a.takenAt : a.takenAt - b.takenAt);
  switch (ref.type) {
    case 'smart':
      switch (ref.id) {
        case 'favorites': return favorites(items);
        case 'videos': return videos(items);
        case 'screenshots': return screenshots(items);
        case 'documents': return settings.ai.ocr ? documents(items) : [];
        case 'blurry': return settings.ai.blur ? blurryItems(items) : [];
        case 'duplicates': return settings.ai.duplicates ? duplicateItems(items) : [];
        case 'large': return largeFiles(items);
        case 'recents': return sorted.slice(0, 48);
        case 'viewed': return recentlyViewedItems(items, recentlyViewed);
        case 'hidden': return hiddenItems(items);
        default: return [];
      }
    case 'folder': return vis.filter((i) => i.folder === ref.id);
    case 'place': return vis.filter((i) => i.place === ref.id);
    case 'event': return vis.filter((i) => i.event === ref.id);
    case 'album': {
      const album = customAlbums.find((a) => a.id === ref.id);
      const map = new Map(items.map((i) => [i.id, i]));
      return (album?.itemIds ?? []).map((id) => map.get(id)).filter((i): i is MediaItem => Boolean(i && !i.trashedAt));
    }
    case 'person': return vis.filter((i) => (i.personIds ?? []).includes(ref.id)).sort((a, b) => b.takenAt - a.takenAt);
    default: return [];
  }
}

export function AlbumsScreen() {
  const app = useApp();
  const { settings, items } = app;
  const t = (k: string) => translate(settings.lang, k);
  const [newAlbumOpen, setNewAlbumOpen] = useState(false);
  const [albumName, setAlbumName] = useState('');

  const clusters = useMemo(() => (settings.ai.faces ? faceClusters(items, app.faceNames) : []), [items, app.faceNames, settings.ai.faces]);
  const smart = useMemo(() => ({
    recents: visibleItems(items).sort((a, b) => b.takenAt - a.takenAt).slice(0, 24),
    favorites: favorites(items),
    videos: videos(items),
    screenshots: screenshots(items),
    documents: settings.ai.ocr ? documents(items) : [],
    large: largeFiles(items).slice(0, 12),
    blurry: settings.ai.blur ? blurryItems(items) : [],
    duplicates: settings.ai.duplicates ? duplicateItems(items) : [],
  }), [items, settings.ai]);
  const viewed = useMemo(() => recentlyViewedItems(items, app.recentlyViewed), [items, app.recentlyViewed]);
  const dirs = useMemo(() => folders(items), [items]);
  const locs = useMemo(() => places(items), [items]);
  const evts = useMemo(() => events(items), [items]);
  const hidden = useMemo(() => hiddenItems(items), [items]);

  const setSettingsAlbums = (patch: Partial<typeof settings.albums>) => setSettings({ albums: { ...settings.albums, ...patch } });
  const open = (ref: AlbumRef) => navigate({ name: 'album', album: ref });

  /* Settings → Albums: section visibility + album sorting */
  const sortMode = settings.albums.sort;
  const sortCards = <T extends { label?: string; id?: string; list?: MediaItem[]; items?: MediaItem[] }>(arr: T[]): T[] => {
    if (sortMode === 'auto') return arr;
    const label = (x: T) => (x.label ?? x.id ?? '').toLowerCase();
    const list = (x: T) => x.list ?? x.items ?? [];
    const copy = [...arr];
    if (sortMode === 'name') copy.sort((a, b) => label(a).localeCompare(label(b)));
    if (sortMode === 'count') copy.sort((a, b) => list(b).length - list(a).length);
    if (sortMode === 'recent') copy.sort((a, b) => (list(b)[0]?.takenAt ?? 0) - (list(a)[0]?.takenAt ?? 0));
    return copy;
  };

  const SMART_CARDS: Array<{ id: string; icon: string; label: string; list: MediaItem[] }> = [
    { id: 'recents', icon: 'clock', label: t('recently_added'), list: smart.recents },
    { id: 'favorites', icon: 'heart', label: t('favorites'), list: smart.favorites },
    { id: 'videos', icon: 'video', label: t('videos'), list: smart.videos },
    { id: 'screenshots', icon: 'scanText', label: t('screenshots'), list: smart.screenshots },
    { id: 'documents', icon: 'doc', label: t('documents'), list: smart.documents },
    { id: 'large', icon: 'storage', label: t('large_files'), list: smart.large },
    ...(smart.duplicates.length ? [{ id: 'duplicates', icon: 'copy', label: t('duplicates'), list: smart.duplicates }] : []),
    ...(smart.blurry.length ? [{ id: 'blurry', icon: 'eye', label: t('blurry'), list: smart.blurry }] : []),
  ];

  return (
    <div className="screen">
      <header className="page-head">
        <div className="grow">
          <h1>{t('tab_albums')}</h1>
          <span className="sub">{visibleItems(items).length} items · {formatBytes(visibleItems(items).reduce((s, i) => s + i.bytes, 0))}</span>
        </div>
        <div className="bar-actions">
          <ScreenMenu
            title={t('tab_albums')}
            items={[
              { icon: 'settings', label: t('settings'), onClick: () => navigate({ name: 'settings' }) },
              { icon: 'plus', label: t('new_album'), onClick: () => setNewAlbumOpen(true) },
              { icon: 'sort', label: 'Sort: auto', checked: sortMode === 'auto', onClick: () => setSettingsAlbums({ sort: 'auto' }) },
              { icon: 'sort', label: 'Sort: name', checked: sortMode === 'name', onClick: () => setSettingsAlbums({ sort: 'name' }) },
              { icon: 'sort', label: 'Sort: count', checked: sortMode === 'count', onClick: () => setSettingsAlbums({ sort: 'count' }) },
              { icon: 'sort', label: 'Sort: recent', checked: sortMode === 'recent', onClick: () => setSettingsAlbums({ sort: 'recent' }) },
              { icon: 'eyeOff', label: t('hidden_album'), onClick: () => open({ type: 'smart', id: 'hidden', title: t('hidden_album') }) },
              { icon: 'lock', label: t('locked_folder'), onClick: () => navigate({ name: 'locked' }) },
              { icon: 'trash', label: t('trash'), onClick: () => navigate({ name: 'trash' }) },
              { icon: 'refresh', label: 'Refresh library', hint: 're-run the on-device scan', onClick: () => { rescanLibrary(); } },
            ]}
          />
        </div>
      </header>

      <div className="scroll-area padded">
        {settings.albums.showPeople && clusters.length > 0 && (
          <>
            <SectionTitle action={<span className="muted">{clusters.length}</span>}>{t('albums_people')}</SectionTitle>
            <div className="rail">
              {clusters.map((c) => {
                const first = items.find((i) => i.id === c.itemIds[0]);
                return (
                  <button key={c.id} type="button" className="person-card pressable" onClick={() => open({ type: 'person', id: c.id, title: c.name })}>
                    <span className="avatar">{first && <Thumb item={first} ratio="square" />}</span>
                    <strong>{c.name}</strong>
                    <em>{c.itemIds.length}</em>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {settings.albums.showViewed && viewed.length > 0 && (
          <>
            <SectionTitle action={<button type="button" className="text-btn" onClick={() => open({ type: 'smart', id: 'viewed', title: t('recently_viewed') })}>{t('see_all')}</button>}>
              {t('recently_viewed')}
            </SectionTitle>
            <div className="rail">
              {viewed.slice(0, 10).map((i, idx) => (
                <button key={i.id} type="button" className="strip-card pressable" style={{ width: 96 }} onClick={() => openViewer(viewed.slice(0, 10).map((x) => x.id), idx)}>
                  <Thumb item={i} ratio="square" />
                </button>
              ))}
            </div>
          </>
        )}

        <SectionTitle>{t('albums_smart')}</SectionTitle>
        <div className="smart-grid">
          {sortCards(SMART_CARDS).map((card) => (
            <button key={card.id} type="button" className="smart-card pressable" onClick={() => open({ type: 'smart', id: card.id, title: card.label })}>
              <span className="collage">
                {card.list.slice(0, 4).map((i) => <Thumb key={i.id} item={i} ratio="square" />)}
                {card.list.length === 0 && <Icon name={card.icon} size={26} strokeWidth={1.4} />}
              </span>
              <span className="meta"><Icon name={card.icon} size={15} /> {card.label} <em>{card.list.length}</em></span>
            </button>
          ))}
        </div>

        {app.customAlbums.length > 0 && (
          <>
            <SectionTitle>{t('your_albums')}</SectionTitle>
            <div className="album-grid">
              {app.customAlbums.map((a) => {
                const map = new Map(items.map((i) => [i.id, i]));
                const list = a.itemIds.map((id) => map.get(id)).filter(Boolean) as MediaItem[];
                return (
                  <button key={a.id} type="button" className="album-card pressable" onClick={() => open({ type: 'album', id: a.id, title: a.name })}>
                    <span className="collage">
                      {list.slice(0, 4).map((i) => <Thumb key={i.id} item={i} ratio="square" />)}
                      {list.length === 0 && <Icon name="stack" size={26} strokeWidth={1.4} />}
                    </span>
                    <span className="meta"><Icon name="stack" size={15} /> {a.name} <em>{list.length}</em></span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {evts.length > 0 && (
          <>
            <SectionTitle>{t('events')}</SectionTitle>
            <div className="rail">
              {sortCards(evts.map((e) => ({ ...e, label: e.id, list: e.items }))).map(({ id, items: eItems }) => (
                <button key={id} type="button" className="event-card pressable" onClick={() => open({ type: 'event', id, title: id })}>
                  <span className="cover">{eItems[0] && <Thumb item={eItems[0]} ratio="4:3" />}</span>
                  <span className="meta">
                    <strong>{id}</strong>
                    <em>{formatMonthYear(eItems[0].takenAt)} · {eItems.length}</em>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {settings.albums.showPlaces && locs.length > 0 && (
          <>
            <SectionTitle>{t('albums_places')}</SectionTitle>
            <div className="rail">
              {sortCards(locs.map((p2) => ({ ...p2, label: p2.id, list: p2.items }))).map(({ id: pid, items: pItems }) => (
                <button key={pid} type="button" className="event-card pressable" onClick={() => open({ type: 'place', id: pid, title: pid })}>
                  <span className="cover">{pItems[0] && <Thumb item={pItems[0]} ratio="4:3" />}</span>
                  <span className="meta"><strong><Icon name="mapPin" size={13} /> {pid}</strong><em>{pItems.length}</em></span>
                </button>
              ))}
            </div>
          </>
        )}

        {settings.albums.showFolders && <SectionTitle>{t('albums_folders')}</SectionTitle>}
        <div className={`set-group glass glass-subtle folder-list${settings.albums.showFolders ? '' : ' folders-hidden'}`}>
          {settings.albums.showFolders && sortCards(dirs.map((f) => ({ ...f, label: f.id, list: f.items }))).map(({ id: fid, items: fItems }) => (
            <button key={fid} type="button" className="row-btn pressable-row" onClick={() => open({ type: 'folder', id: fid, title: fid })}>
              <Icon name={fid === 'Screenshots' ? 'scanText' : fid === 'Downloads' ? 'download' : 'folder'} size={19} />
              <span className="grow">{fid}</span>
              <em>{fItems.length}</em>
              <Icon name="chevronRight" size={16} className="chev" />
            </button>
          ))}
          {settings.showHidden && (
            <button type="button" className="row-btn pressable-row" onClick={() => open({ type: 'smart', id: 'hidden', title: t('hidden_album') })}>
              <Icon name="eyeOff" size={19} /><span className="grow">{t('hidden_album')}</span><em>{hidden.length}</em><Icon name="chevronRight" size={16} className="chev" />
            </button>
          )}
          <button type="button" className="row-btn pressable-row" onClick={() => navigate({ name: 'settings', page: 'cleanup' })}>
            <Icon name="storage" size={19} /><span className="grow">Storage & Cleanup</span>
            <em>{formatBytes(visibleItems(items).reduce((s, i) => s + i.bytes, 0))}</em>
            <Icon name="chevronRight" size={16} className="chev" />
          </button>
        </div>
        <div className="scroll-pad" />
      </div>

      {newAlbumOpen && (
        <Dialog title={t('new_album')} onClose={() => setNewAlbumOpen(false)}>
          <input className="text-input" autoFocus value={albumName} placeholder="Album name" onChange={(e) => setAlbumName(e.target.value)} />
          <div className="dialog-actions">
            <button type="button" className="ghost-btn" onClick={() => setNewAlbumOpen(false)}>{t('cancel')}</button>
            <AnimatedButton
              disabled={!albumName.trim()}
              onClick={() => {
                const id = createAlbum(albumName.trim());
                setNewAlbumOpen(false);
                setAlbumName('');
                navigate({ name: 'album', album: { type: 'album', id, title: albumName.trim() } });
              }}
            >
              {t('save')}
            </AnimatedButton>
          </div>
        </Dialog>
      )}
    </div>
  );
}

export function AlbumDetailScreen({ album: albumRef }: { album: AlbumRef }) {
  const app = useApp();
  const { settings, items } = app;
  const t = (k: string) => translate(settings.lang, k);
  const list = useMemo(() => resolveAlbum(albumRef, items, app), [albumRef, items, app]);
  const selection = useSelection();
  const [renameOpen, setRenameOpen] = useState(false);
  const [name, setName] = useState(albumRef.title);
  const isCustom = albumRef.type === 'album';

  return (
    <div className="screen slide-in">
      <header className="page-head with-back">
        <button type="button" className="back-btn glass glass-subtle" onClick={() => navigate({ name: 'tabs' })} aria-label="Back">
          <Icon name="back" size={20} />
        </button>
        <div className="grow">
          <h1>{albumRef.type === 'person' ? (app.faceNames[albumRef.id] ?? albumRef.title) : albumRef.title}</h1>
          <span className="sub">{list.length} items</span>
        </div>
        <div className="bar-actions">
          {albumRef.type === 'person' && <IconButton icon="edit" label="Rename person" onClick={() => setRenameOpen(true)} />}
          {isCustom && (
            <>
              <IconButton icon="edit" label={t('rename')} onClick={() => setRenameOpen(true)} />
              <IconButton icon="trash" label="Delete album" onClick={() => { deleteAlbum(albumRef.id); navigate({ name: 'tabs' }); }} />
            </>
          )}
        </div>
      </header>
      <div className="scroll-area padded">
        {list.length === 0
          ? <EmptyState icon="image" title={t('empty_album')} hint={isCustom ? 'Select photos anywhere, then use “Add to album”.' : undefined} />
          : (
            <PhotoGrid
              items={list}
              cols={4}
              ratio={settings.thumbRatio}
              selection={selection.active ? selection.selection : null}
              onOpen={(idx) => openViewer(list.map((i) => i.id), idx)}
              onToggle={selection.toggle}
              onLongPress={selection.enter}
            />
          )}
        <div className="scroll-pad" />
      </div>
      {selection.active && <SelectionBar selection={selection} albumMode={isCustom ? albumRef.id : undefined} />}
      {renameOpen && (
        <Sheet title={albumRef.type === 'person' ? 'Name this person' : t('rename')} onClose={() => setRenameOpen(false)}>
          <div className="field">
            <input
              className="text-input"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (albumRef.type === 'person') renameFace(albumRef.id, name);
                  else if (isCustom) renameAlbum(albumRef.id, name);
                  setRenameOpen(false);
                }
              }}
            />
            <AnimatedButton
              icon="check"
              onClick={() => {
                if (albumRef.type === 'person') renameFace(albumRef.id, name);
                else if (isCustom) renameAlbum(albumRef.id, name);
                setRenameOpen(false);
              }}
            >
              {t('save')}
            </AnimatedButton>
          </div>
        </Sheet>
      )}
    </div>
  );
}
