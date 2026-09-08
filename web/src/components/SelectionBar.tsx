import { useState } from 'react';
import type { SelectionApi } from './useSelection';
import { IconButton, Sheet } from './ui';
import { addGeneratedItem, addToAlbum, openShare, openViewer, setFavorite, setHidden, setLocked, toast, trashItems, useApp } from '../store';
import { CollageSheet } from './CollageSheet';
import { translate } from '../core/i18n';
import { Icon } from '../core/icons';
import { haptic } from '../core/haptics';

export function SelectionBar({ selection, onDone, albumMode }: { selection: SelectionApi; onDone?: () => void; albumMode?: string }) {
  const app = useApp();
  const { settings } = app;
  const t = (k: string) => translate(settings.lang, k);
  const [albumSheet, setAlbumSheet] = useState(false);
  const [collageSheet, setCollageSheet] = useState(false);
  const ids = [...selection.selection];
  if (!selection.active) return null;

  const finish = () => { selection.clear(); onDone?.(); };

  return (
    <>
      <div className="selection-bar glass glass-strong">
        <span className="count">{t('selected').replace('{n}', String(ids.length))}</span>
        <div className="actions">
          <IconButton icon="share" label={t('share')} onClick={() => openShare(ids)} />
          <IconButton icon="heart" label={t('favorite')} onClick={() => { haptic('success'); setFavorite(ids, true); finish(); }} />
          <IconButton icon="stack" label={t('add_to_album')} onClick={() => setAlbumSheet(true)} />
          <IconButton icon="collage" label={t('collage')} onClick={() => setCollageSheet(true)} />
          <IconButton icon="eyeOff" label={t('hide')} onClick={() => { setHidden(ids, true); finish(); }} />
          <IconButton icon="lock" label={t('lock')} onClick={() => { setLocked(ids, true); finish(); }} />
          <IconButton icon="trash" label={t('delete')} onClick={() => { trashItems(ids); finish(); }} />
          <IconButton icon="close" label={t('cancel')} onClick={() => selection.clear()} />
        </div>
      </div>
      {collageSheet && (
        <CollageSheet
          items={ids.map((id) => app.items.find((i) => i.id === id)).filter((i): i is import('../data/models').MediaItem => Boolean(i))}
          onClose={() => setCollageSheet(false)}
          onSave={(dataUrl, w, h) => {
            const item = addGeneratedItem({
              id: `collage-${Date.now().toString(36)}`,
              kind: 'photo',
              src: dataUrl,
              w, h,
              bytes: Math.round(dataUrl.length * 0.75),
              takenAt: Date.now(),
              title: `Collage · ${ids.length} photos`,
              folder: 'Gallery/Collages',
              camera: { model: 'Gallery', lens: '—', iso: 0, shutter: '—', aperture: '—' },
              video: undefined,
            });
            setCollageSheet(false);
            finish();
            toast('Collage saved to your library', { label: 'Open', run: () => openViewer([item.id], 0) });
          }}
        />
      )}

      {albumSheet && (
        <Sheet title={t('add_to_album')} onClose={() => setAlbumSheet(false)}>
          {app.customAlbums.length === 0
            ? <p className="hint">No albums yet — create one from Albums → +.</p>
            : (
              <div className="set-group glass glass-subtle">
                {app.customAlbums.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className="row-btn pressable-row"
                    onClick={() => { addToAlbum(a.id, ids); setAlbumSheet(false); finish(); }}
                  >
                    <Icon name="stack" size={18} />
                    <span className="grow">{a.name}</span>
                    <em>{a.itemIds.length}</em>
                  </button>
                ))}
              </div>
            )}
          {albumMode && (
            <button type="button" className="ghost-btn danger" onClick={() => { setAlbumSheet(false); finish(); }}>
              <Icon name="close" size={14} /> {t('cancel')}
            </button>
          )}
        </Sheet>
      )}
    </>
  );
}
