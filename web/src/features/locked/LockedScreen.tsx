import { useMemo, useState } from 'react';
import { navigate, openViewer, setLocked, useApp } from '../../store';
import { lockedItems, visibleItems } from '../../domain/usecases/library';
import { PhotoGrid } from '../../components/PhotoGrid';
import { useSelection } from '../../components/useSelection';
import { EmptyState, IconButton, Sheet } from '../../components/ui';
import { AnimatedButton } from '../../components/glass';
import { Icon } from '../../core/icons';
import { translate } from '../../core/i18n';
import { haptic } from '../../core/haptics';

/** Shared biometric / PIN gate (locked folder + app lock). */
export function LockGate({ onUnlock, title }: { onUnlock: () => void; title?: string }) {
  const app = useApp();
  const { settings } = app;
  const t = (k: string) => translate(settings.lang, k);
  const [scanning, setScanning] = useState(false);
  const [pinEntry, setPinEntry] = useState('');
  const [pinError, setPinError] = useState(false);
  const [usePin, setUsePin] = useState(false);

  return (
    <div className="screen">
      <div className="lock-gate">
        {title && <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.4px' }}>{title}</h1>}
        {settings.biometrics && !usePin ? (
          <>
            <button
              type="button"
              className={`fingerprint glass glass-strong${scanning ? ' scanning' : ''}`}
              onClick={() => {
                haptic('select');
                setScanning(true);
                setTimeout(() => { setScanning(false); haptic('success'); onUnlock(); }, 1250);
              }}
              aria-label={t('unlock_biometric')}
            >
              <Icon name="fingerprint" size={62} strokeWidth={1.25} />
            </button>
            <p className="muted" style={{ fontSize: 13.5 }}>{scanning ? 'Scanning…' : t('unlock_biometric')}</p>
            <button type="button" className="text-btn" onClick={() => setUsePin(true)}>{t('unlock_pin')} →</button>
          </>
        ) : (
          <div className="pin-pad" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
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
                      haptic('tap');
                      if (k === '⌫') { setPinEntry((p) => p.slice(0, -1)); setPinError(false); return; }
                      const next = (pinEntry + k).slice(0, 4);
                      setPinEntry(next);
                      if (next.length === 4) {
                        if (next === settings.pin) { haptic('success'); onUnlock(); }
                        else { setPinError(true); haptic('dismiss'); setTimeout(() => { setPinEntry(''); setPinError(false); }, 480); }
                      }
                    }}
                  >
                    {k}
                  </button>
                )
              ))}
            </div>
            <p className="hint">Default PIN: {settings.pin} — change it in Settings → Privacy & Security.</p>
            {settings.biometrics && (
              <button type="button" className="text-btn" onClick={() => { setUsePin(false); setPinEntry(''); }}>← {t('unlock_biometric')}</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function LockedScreen() {
  const app = useApp();
  const { settings, items } = app;
  const t = (k: string) => translate(settings.lang, k);
  const [unlocked, setUnlocked] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const selection = useSelection();
  const pickerSel = useSelection();
  const list = useMemo(() => lockedItems(items), [items]);
  const candidates = useMemo(() => visibleItems(items).filter((i) => !i.locked), [items]);

  if (!unlocked) {
    return (
      <div className="screen">
        <header className="page-head with-back">
          <button type="button" className="back-btn glass glass-subtle" onClick={() => navigate({ name: 'tabs' })} aria-label="Back">
            <Icon name="back" size={20} />
          </button>
          <div className="grow"><h1>{t('locked_folder')}</h1></div>
        </header>
        <LockGate onUnlock={() => setUnlocked(true)} />
      </div>
    );
  }

  return (
    <div className="screen">
      <header className="page-head with-back">
        <button type="button" className="back-btn glass glass-subtle" onClick={() => navigate({ name: 'tabs' })} aria-label="Back">
          <Icon name="back" size={20} />
        </button>
        <div className="grow">
          <h1>{t('locked_folder')}</h1>
          <span className="sub">{list.length} hidden items · kept on this device</span>
        </div>
        <div className="bar-actions">
          <IconButton icon="plus" label="Add items" onClick={() => setAddOpen(true)} />
        </div>
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
        <div className="selection-bar glass glass-strong">
          <span className="count">{t('selected').replace('{n}', String(selection.selection.size))}</span>
          <div className="actions">
            <IconButton icon="lockOpen" label={t('unlock')} onClick={() => { setLocked([...selection.selection], false); selection.clear(); }} />
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
          <AnimatedButton
            icon="lock"
            disabled={!pickerSel.active}
            onClick={() => { setLocked([...pickerSel.selection], true); pickerSel.clear(); setAddOpen(false); }}
          >
            {t('lock')}
          </AnimatedButton>
        </Sheet>
      )}
    </div>
  );
}
