import { useEffect, useMemo, useState } from 'react';
import { closeShare, toast, useApp } from '../../store';
import { canvasToBlob, renderEdited } from '../editor/render';
import { loadImage } from '../../ml/pipelines';
import { Sheet } from '../../components/ui';
import { GlassSegmented, AnimatedButton } from '../../components/glass';
import { Thumb } from '../../components/PhotoGrid';
import { Icon } from '../../core/icons';
import { translate } from '../../core/i18n';
import { downloadBlob, formatBytes } from '../../core/utils';

const PRESETS = [
  { id: 'original', label: 'Original', maxDim: 2000, quality: 0.92 },
  { id: 'high', label: 'High', maxDim: 1600, quality: 0.85 },
  { id: 'balanced', label: 'Balanced', maxDim: 1080, quality: 0.8 },
  { id: 'small', label: 'Small', maxDim: 640, quality: 0.7 },
] as const;

type PresetId = typeof PRESETS[number]['id'];

export function ShareSheet() {
  const app = useApp();
  const ids = app.shareIds;
  const { settings, items } = app;
  const t = (k: string) => translate(settings.lang, k);
  const selected = useMemo(() => items.filter((i) => ids?.includes(i.id)), [items, ids]);
  const [preset, setPreset] = useState<PresetId>('balanced');
  const [format, setFormat] = useState<'jpeg' | 'webp'>('jpeg');
  const [size, setSize] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const p = PRESETS.find((x) => x.id === preset)!;
      let total = 0;
      for (const item of selected) {
        try {
          const img = await loadImage(item.src);
          const canvas = await renderEdited(img, item, item.edits, { maxDim: p.maxDim });
          const blob = await canvasToBlob(canvas, format === 'webp' ? 'image/webp' : 'image/jpeg', p.quality);
          total += blob.size;
        } catch { total += item.bytes; }
      }
      if (!cancelled) setSize(total);
    })();
    return () => { cancelled = true; };
  }, [selected, preset, format]);

  if (!ids) return null;

  const doDownload = async () => {
    const p = PRESETS.find((x) => x.id === preset)!;
    for (const item of selected) {
      const img = await loadImage(item.src);
      const canvas = await renderEdited(img, item, item.edits, { maxDim: p.maxDim });
      const blob = await canvasToBlob(canvas, format === 'webp' ? 'image/webp' : 'image/jpeg', p.quality);
      downloadBlob(blob, `${item.id}.${format === 'webp' ? 'webp' : 'jpg'}`);
    }
    toast(`Shared ${selected.length} item${selected.length > 1 ? 's' : ''}`);
    closeShare();
  };

  return (
    <Sheet title={`${t('share')} · ${selected.length}`} onClose={closeShare}>
      <div className="share-preview">
        {selected.slice(0, 6).map((i) => <Thumb key={i.id} item={i} ratio="square" />)}
      </div>
      <GlassSegmented
        value={preset}
        options={PRESETS.map((p) => ({ id: p.id, label: p.label }))}
        onChange={(v) => setPreset(v)}
      />
      <GlassSegmented
        value={format}
        options={[{ id: 'jpeg', label: 'JPEG' }, { id: 'webp', label: 'WebP' }]}
        onChange={(v) => setFormat(v)}
      />
      <p className="hint">
        {size === null ? 'Estimating…' : `Encoded size ≈ ${formatBytes(size)} (${PRESETS.find((p) => p.id === preset)!.maxDim}px, q${Math.round(PRESETS.find((p) => p.id === preset)!.quality * 100)})`}
      </p>
      <div className="share-targets">
        {([
          ['message', 'Messages'],
          ['send', 'WhatsApp'],
          ['cloud', 'Drive'],
          ['bluetooth', 'Bluetooth'],
          ['copy', 'Copy name'],
        ] as const).map(([icon, label]) => (
          <button key={label} type="button" className="target" onClick={() => { toast(`${label}: sharing opens with the system sheet on device`); closeShare(); }}>
            <span><Icon name={icon} size={20} /></span>
            {label}
          </button>
        ))}
      </div>
      <AnimatedButton icon="download" onClick={doDownload}>{t('export')}</AnimatedButton>
    </Sheet>
  );
}
