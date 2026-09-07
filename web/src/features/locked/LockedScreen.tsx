import { useMemo, useState } from 'react';
import { navigate, openViewer, setLocked, useApp } from '../../store';
import { lockedItems, visibleItems } from '../../domain/usecases/library';
import { PhotoGrid } from '../../components/PhotoGrid';
import { SelectionBar } from '../../components/SelectionBar';
import { useSelection } from '../../components/useSelection';
import { EmptyState, IconButton, Sheet } from '../../components/ui';
import { Icon } from '../../core/icons';
import { translate } from '../../core/i18n';

export function LockedScreen() {
  const app = useApp();
  const { settings, items } = app;
  const t = (k: string) => translate(settings.lang, k);
  const [unlocked, setUnlocked] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [pinEntry, setPinEntry] = useState('');
  const [pinError, setPinError] = useState(false);
  const [usePin, setUsePin] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const selection = useSelection();
  const pickerSel = useSelection();
  const list = useMemo(() => lockedItems(items), [items]);
  const candidates = useMemo(() => visibleItems(items).filter((i) => !i.locked), [items]);

  if (!unlocked) {
    return (
      <div className="screen">
        <header className="app-bar with-back">
          <IconButton icon="back" label="Back" onClick={() => navigate({ name: 'tabs' })} />
          <div className="grow"><h1>{t('locked_folder')}</h1></div>
        </header>
        <div className="lock-gate">
          {settings.biometrics && !usePin && (
            <>
              <button
                type="button"
                className={`fingerprint${scanning ? ' scanning' : ''}`}
                onClick={() => {
                  setScanning(true);
                  setTimeout(() => { setScanning(false); setUnlocked(true); }, 1300);
                }}
                aria-label={t('unlock_biometric')}
              >
                <Icon name="fingerprint" size={64} strokeWidth={1.3} />
              </button>
              <p>{scanning ? 'Scanning…' : t('unlock_biometric')}</p>
              <button type="button" className="text-btn" onClick={() => setUsePin(true)}>{t('unlock_pin')} →</button>
            </>
          )}
          {(usePin || !settings.biometrics) && (
            <div className="pin-pad">
              <div className={`pin-dots${pinError ? ' error' : ''}`}>
                {[0, 1, 2, 3].map((i) => <i key={i} className={pinEntry.length > i ? 'on' : ''} />)}
              </div>
              <div className="pad">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k, i) => (
                  k === '' ? <span key={i} /> : (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        if (k === '⌫') { setPinEntry((p) => p.slice(0, -1)); setPinError(false); return; }
                        const next = (pinEntry + k).slice(0, 4);
                        setPinEntry(next);
                        if (next.length === 4) {
                          if (next === settings.pin) setUnlocked(true);
                          else { setPinError(true); setTimeout(() => { setPinEntry(''); setPinError(false); }, 500); }
                        }
                      }}
                    >
                      {k}
                    </button>
                  )
                ))}
              </div>
              <p className="hint">Demo PIN: {settings.pin}</p>
              {settings.biometrics && <button type="button" className="text-btn" onClick={() => { setUsePin(false); setPinEntry(''); }}>← {t('unlock_biometric')}</button>}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <header className="app-bar with-back">
        <IconButton icon="back" label="Back" onClick={() => navigate({ name: 'tabs' })} />
        <div className="grow"><h1>{t('locked_folder')}</h1><span className="sub">{list.length} hidden items</span></div>
        <IconButton icon="plus" label="Add items" onClick={() => setAddOpen(true)} />
      </header>
      <div className="scroll-area padded">
        {list.length === 0
          ? <EmptyState icon="lock" title="Nothing locked" hint="Long-press photos anywhere and choose “Move to Locked”, or use + above." />
          : (
            <PhotoGrid
              items={list}
              cols={4}
              ratio="square"
              selection={selection.active ? selection.selection : null}
              onOpen={(idx) => openViewer(list.map((i) => i.id), idx)}
              onToggle={selection.toggle}
              onLongPress={selection.enter}
            />
          )}
        <div className="scroll-pad" />
      </div>
      {selection.active && (
        <div className="selection-bar">
          <span className="count">{t('selected').replace('{n}', String(selection.selection.size))}</span>
          <div className="actions">
            <IconButton icon="lockOpen" label={t('unlock')} onClick={() => { setLocked([...selection.selection], false); selection.clear(); }} />
            <IconButton icon="trash" label={t('delete')} onClick={() => { setLocked([...selection.selection], false); selection.clear(); }} />
            <IconButton icon="close" label={t('cancel')} onClick={selection.clear} />
          </div>
        </div>
      )}
      {addOpen && (
        <Sheet title="Lock items" onClose={() => { setAddOpen(false); pickerSel.clear(); }}>
          <div className="sheet-grid">
            <PhotoGrid
              items={candidates}
              cols={5}
              ratio="square"
              selection={pickerSel.selection}
              onToggle={pickerSel.toggle}
            />
          </div>
          <button
            type="button"
            className="primary-btn"
            disabled={!pickerSel.active}
            onClick={() => { setLocked([...pickerSel.selection], true); pickerSel.clear(); setAddOpen(false); }}
          >
            <Icon name="lock" size={16} /> {t('lock')}
          </button>
        </Sheet>
      )}
    </div>
  );
}
