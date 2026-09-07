import { useMemo, useState } from 'react';
import { navigate, openViewer, renameFace, useApp, type AlbumRef } from '../../store';
import {
  blurryItems, documents, duplicateItems, faceClusters, favorites, folders, lockedItems,
  places, screenshots, trashedItems, videos, visibleItems, events,
} from '../../domain/usecases/library';
import { PhotoGrid, Thumb } from '../../components/PhotoGrid';
import { SelectionBar } from '../../components/SelectionBar';
import { useSelection } from '../../components/useSelection';
import { EmptyState, IconButton, SectionTitle, Sheet } from '../../components/ui';
import { Icon } from '../../core/icons';
import { translate } from '../../core/i18n';
import { formatBytes, formatMonthYear } from '../../core/utils';
import type { MediaItem } from '../../data/models';

export function resolveAlbum(ref: AlbumRef, items: MediaItem[], faceNames: Record<string, string>): MediaItem[] {
  const vis = visibleItems(items);
  switch (ref.type) {
    case 'smart':
      switch (ref.id) {
        case 'favorites': return favorites(items);
        case 'videos': return videos(items);
        case 'screenshots': return screenshots(items);
        case 'documents': return documents(items);
        case 'blurry': return blurryItems(items);
        case 'duplicates': return duplicateItems(items);
        case 'recents': return vis.slice(0, 40);
        default: return [];
      }
    case 'folder': return vis.filter((i) => i.folder === ref.id);
    case 'place': return vis.filter((i) => i.place === ref.id);
    case 'event': return vis.filter((i) => i.event === ref.id);
    case 'person': return vis.filter((i) => (i.personIds ?? []).includes(ref.id)).sort((a, b) => b.takenAt - a.takenAt);
    default: return [];
  }
}

const SMART_META: Array<{ id: string; icon: string; key: string }> = [
  { id: 'favorites', icon: 'heart', key: 'favorites' },
  { id: 'videos', icon: 'video', key: 'videos' },
  { id: 'screenshots', icon: 'scanText', key: 'screenshots' },
  { id: 'documents', icon: 'doc', key: 'documents' },
  { id: 'blurry', icon: 'eye', key: 'blurry' },
  { id: 'duplicates', icon: 'copy', key: 'duplicates' },
];

export function AlbumsScreen() {
  const app = useApp();
  const { settings, items } = app;
  const t = (k: string) => translate(settings.lang, k);
  const clusters = useMemo(() => faceClusters(items, app.faceNames), [items, app.faceNames]);
  const smart = useMemo(() => ({
    favorites: favorites(items),
    videos: videos(items),
    screenshots: screenshots(items),
    documents: documents(items),
    blurry: blurryItems(items),
    duplicates: duplicateItems(items),
  }), [items]);
  const dirs = useMemo(() => folders(items), [items]);
  const locs = useMemo(() => places(items), [items]);
  const evts = useMemo(() => events(items), [items]);

  const open = (ref: AlbumRef) => navigate({ name: 'album', album: ref });

  return (
    <div className="screen">
      <header className="app-bar">
        <div><h1>{t('tab_albums')}</h1><span className="sub">{visibleItems(items).length} items on device</span></div>
        <div className="bar-actions">
          <IconButton icon="lock" label={t('locked_folder')} onClick={() => navigate({ name: 'locked' })} />
          <IconButton icon="trash" label={t('trash')} onClick={() => navigate({ name: 'trash' })} />
        </div>
      </header>

      <div className="scroll-area padded">
        {clusters.length > 0 && (
          <>
            <SectionTitle action={<span className="muted">{clusters.length}</span>}>{t('albums_people')}</SectionTitle>
            <div className="h-scroll people">
              {clusters.map((c) => {
                const first = items.find((i) => i.id === c.itemIds[0]);
                return (
                  <button key={c.id} type="button" className="person-card" onClick={() => open({ type: 'person', id: c.id, title: c.name })}>
                    <span className="avatar">{first && <Thumb item={first} ratio="square" />}</span>
                    <strong>{c.name}</strong>
                    <em>{c.itemIds.length}</em>
                  </button>
                );
              })}
            </div>
          </>
        )}

        <SectionTitle>{t('albums_smart')}</SectionTitle>
        <div className="smart-grid">
          {SMART_META.map((meta) => {
            const list = smart[meta.id as keyof typeof smart];
            return (
              <button key={meta.id} type="button" className="smart-card" onClick={() => open({ type: 'smart', id: meta.id, title: t(meta.key) })}>
                <span className="collage">
                  {list.slice(0, 4).map((i) => <Thumb key={i.id} item={i} ratio="square" />)}
                  {list.length === 0 && <Icon name={meta.icon} size={26} strokeWidth={1.4} />}
                </span>
                <span className="meta"><Icon name={meta.icon} size={15} /> {t(meta.key)} <em>{list.length}</em></span>
              </button>
            );
          })}
        </div>

        {evts.length > 0 && (
          <>
            <SectionTitle>{t('memories')}</SectionTitle>
            <div className="h-scroll events">
              {evts.map((e) => (
                <button key={e.id} type="button" className="event-card" onClick={() => open({ type: 'event', id: e.id, title: e.id })}>
                  <span className="cover">{e.items[0] && <Thumb item={e.items[0]} ratio="4:3" />}</span>
                  <span className="meta">
                    <strong>{e.id}</strong>
                    <em>{formatMonthYear(e.items[0].takenAt)} · {e.items.length}</em>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {locs.length > 0 && (
          <>
            <SectionTitle>{t('albums_places')}</SectionTitle>
            <div className="h-scroll events">
              {locs.map((p) => (
                <button key={p.id} type="button" className="event-card" onClick={() => open({ type: 'place', id: p.id, title: p.id })}>
                  <span className="cover">{p.items[0] && <Thumb item={p.items[0]} ratio="4:3" />}</span>
                  <span className="meta"><strong><Icon name="mapPin" size={13} /> {p.id}</strong><em>{p.items.length}</em></span>
                </button>
              ))}
            </div>
          </>
        )}

        <SectionTitle>{t('albums_folders')}</SectionTitle>
        <div className="folder-list">
          {dirs.map((f) => (
            <button key={f.id} type="button" className="row-btn" onClick={() => open({ type: 'folder', id: f.id, title: f.id })}>
              <Icon name={f.id === 'Screenshots' ? 'scanText' : f.id === 'Downloads' ? 'download' : 'folder'} size={19} />
              <span className="grow">{f.id}</span>
              <em>{f.items.length}</em>
              <Icon name="chevronRight" size={16} />
            </button>
          ))}
        </div>

        <SectionTitle>{t('settings')}</SectionTitle>
        <div className="folder-list">
          <button type="button" className="row-btn" onClick={() => navigate({ name: 'locked' })}>
            <Icon name="lock" size={19} /><span className="grow">{t('locked_folder')}</span><em>{lockedItems(items).length}</em><Icon name="chevronRight" size={16} />
          </button>
          <button type="button" className="row-btn" onClick={() => navigate({ name: 'trash' })}>
            <Icon name="trash" size={19} /><span className="grow">{t('trash')}</span><em>{trashedItems(items).length}</em><Icon name="chevronRight" size={16} />
          </button>
          <button type="button" className="row-btn" onClick={() => navigate({ name: 'storage' })}>
            <Icon name="storage" size={19} /><span className="grow">{t('storage_insights')}</span>
            <em>{formatBytes(visibleItems(items).reduce((s, i) => s + i.bytes, 0))}</em>
            <Icon name="chevronRight" size={16} />
          </button>
        </div>
        <div className="scroll-pad" />
      </div>
    </div>
  );
}

export function AlbumDetailScreen({ album: albumRef }: { album: AlbumRef }) {
  const app = useApp();
  const { settings, items } = app;
  const t = (k: string) => translate(settings.lang, k);
  const list = useMemo(() => resolveAlbum(albumRef, items, app.faceNames), [albumRef, items, app.faceNames]);
  const selection = useSelection();
  const [renameOpen, setRenameOpen] = useState(false);
  const [name, setName] = useState(albumRef.title);

  return (
    <div className="screen">
      <header className="app-bar with-back">
        <IconButton icon="back" label="Back" onClick={() => navigate({ name: 'tabs' })} />
        <div className="grow">
          <h1>{albumRef.type === 'person' ? (app.faceNames[albumRef.id] ?? albumRef.title) : albumRef.title}</h1>
          <span className="sub">{list.length} items</span>
        </div>
        <div className="bar-actions">
          {albumRef.type === 'person' && <IconButton icon="edit" label="Rename person" onClick={() => setRenameOpen(true)} />}
        </div>
      </header>
      <div className="scroll-area padded">
        {list.length === 0
          ? <EmptyState icon="image" title={t('empty_album')} />
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
      {selection.active && <SelectionBar selection={selection} />}
      {renameOpen && (
        <Sheet title="Name this person" onClose={() => setRenameOpen(false)}>
          <div className="field">
            <input
              className="text-input"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { renameFace(albumRef.id, name); setRenameOpen(false); } }}
            />
            <p className="hint">Names stay on this device and power people search &amp; face albums.</p>
            <button type="button" className="primary-btn" onClick={() => { renameFace(albumRef.id, name); setRenameOpen(false); }}>{t('save')}</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
