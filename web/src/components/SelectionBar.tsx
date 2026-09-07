import type { SelectionApi } from './useSelection';
import { IconButton } from './ui';
import { openShare, setFavorite, setLocked, trashItems, useApp } from '../store';
import { translate } from '../core/i18n';

export function SelectionBar({ selection, onDone }: { selection: SelectionApi; onDone?: () => void }) {
  const { settings } = useApp();
  const t = (k: string) => translate(settings.lang, k);
  const ids = [...selection.selection];
  if (!selection.active) return null;

  return (
    <div className="selection-bar">
      <span className="count">{t('selected').replace('{n}', String(ids.length))}</span>
      <div className="actions">
        <IconButton icon="share" label={t('share')} onClick={() => openShare(ids)} />
        <IconButton icon="heart" label={t('favorite')} onClick={() => { setFavorite(ids, true); selection.clear(); }} />
        <IconButton icon="lock" label={t('lock')} onClick={() => { setLocked(ids, true); selection.clear(); onDone?.(); }} />
        <IconButton icon="trash" label={t('delete')} onClick={() => { trashItems(ids); selection.clear(); onDone?.(); }} />
        <IconButton icon="close" label={t('cancel')} onClick={() => selection.clear()} />
      </div>
    </div>
  );
}
