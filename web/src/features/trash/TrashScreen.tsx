import { useMemo } from 'react';
import { emptyTrash, navigate, openViewer, purgeItems, restoreItems, useApp } from '../../store';
import { trashedItems } from '../../domain/usecases/library';
import { PhotoGrid } from '../../components/PhotoGrid';
import { useSelection } from '../../components/useSelection';
import { EmptyState, IconButton } from '../../components/ui';
import { translate } from '../../core/i18n';

export function TrashScreen() {
  const app = useApp();
  const { settings } = app;
  const t = (k: string) => translate(settings.lang, k);
  const list = useMemo(() => trashedItems(app.items), [app.items]);
  const selection = useSelection();

  const daysLeft = (trashedAt: number) => Math.max(0, settings.retentionDays - Math.floor((Date.now() - trashedAt) / 86_400_000));

  return (
    <div className="screen">
      <header className="app-bar with-back">
        <IconButton icon="back" label="Back" onClick={() => navigate({ name: 'tabs' })} />
        <div className="grow">
          <h1>{t('trash')}</h1>
          <span className="sub">{list.length} items · auto-purge after {settings.retentionDays} days</span>
        </div>
        {list.length > 0 && <IconButton icon="broom" label={t('empty_bin')} onClick={emptyTrash} />}
      </header>
      <div className="scroll-area padded">
        {list.length === 0
          ? <EmptyState icon="trash" title="Recycle bin is empty" hint="Deleted items stay here for the retention window before being purged." />
          : (
            <PhotoGrid
              items={list}
              cols={4}
              ratio="square"
              selection={selection.active ? selection.selection : null}
              onOpen={(idx) => openViewer(list.map((i) => i.id), idx)}
              onToggle={selection.toggle}
              onLongPress={selection.enter}
              badge={(i) => (i.trashedAt !== null ? t('days_left').replace('{n}', String(daysLeft(i.trashedAt))) : null)}
            />
          )}
        <div className="scroll-pad" />
      </div>
      {selection.active && (
        <div className="selection-bar">
          <span className="count">{t('selected').replace('{n}', String(selection.selection.size))}</span>
          <div className="actions">
            <IconButton icon="restore" label={t('restore')} onClick={() => { restoreItems([...selection.selection]); selection.clear(); }} />
            <IconButton icon="trash" label={t('delete_forever')} onClick={() => { purgeItems([...selection.selection]); selection.clear(); }} />
            <IconButton icon="close" label={t('cancel')} onClick={selection.clear} />
          </div>
        </div>
      )}
    </div>
  );
}
