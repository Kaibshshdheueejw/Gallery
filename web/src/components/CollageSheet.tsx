/**
 * CollageSheet — composes the selected photos into a real collage on a
 * canvas (2/3/4-up layouts, adjustable gap & background), then adds the
 * rendered image to the library as a generated item. No fake output: what
 * you preview is exactly the composited file.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Sheet } from './ui';
import { Icon } from '../core/icons';
import { loadImage } from '../ml/pipelines';
import type { MediaItem } from '../data/models';

export type CollageLayout = '2h' | '2v' | '3' | '4' | '1big';

const LAYOUTS: Array<{ id: CollageLayout; label: string; max: number }> = [
  { id: '2h', label: '2 side by side', max: 2 },
  { id: '2v', label: '2 stacked', max: 2 },
  { id: '3', label: '3 (1 big + 2)', max: 3 },
  { id: '4', label: '4 grid', max: 4 },
  { id: '1big', label: '1 hero + strip', max: 6 },
];

/** returns normalized cells {x,y,w,h} for up to n images */
function cellsFor(layout: CollageLayout, n: number): Array<{ x: number; y: number; w: number; h: number }> {
  switch (layout) {
    case '2h': return [{ x: 0, y: 0, w: 0.5, h: 1 }, { x: 0.5, y: 0, w: 0.5, h: 1 }].slice(0, n);
    case '2v': return [{ x: 0, y: 0, w: 1, h: 0.5 }, { x: 0, y: 0.5, w: 1, h: 0.5 }].slice(0, n);
    case '3': return [
      { x: 0, y: 0, w: 1, h: 0.62 },
      { x: 0, y: 0.62, w: 0.5, h: 0.38 },
      { x: 0.5, y: 0.62, w: 0.5, h: 0.38 },
    ].slice(0, n);
    case '4': return [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ].slice(0, n);
    case '1big': {
      const rest = n - 1;
      const c = [{ x: 0, y: 0, w: 1, h: 0.68 }];
      if (rest > 0) {
        const w = 1 / rest;
        for (let i = 0; i < rest; i++) c.push({ x: i * w, y: 0.68, w, h: 0.32 });
      }
      return c;
    }
  }
}

const BG_COLORS = ['#0e0c18', '#ffffff', '#f3ede2', '#1d2b33', '#2b1d26'];

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const ar = img.naturalWidth / img.naturalHeight;
  let dw = w, dh = h;
  if (ar > w / h) dw = h * ar; else dh = w / ar;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

export function CollageSheet({ items, onClose, onSave }: {
  items: MediaItem[];
  onClose: () => void;
  /** called with the composited dataURL + pixel size */
  onSave: (dataUrl: string, w: number, h: number) => void;
}) {
  const [layout, setLayout] = useState<CollageLayout>('4');
  const [gap, setGap] = useState(10);
  const [bg, setBg] = useState(BG_COLORS[0]);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const picked = useMemo(() => items.slice(0, 6), [items]);

  /* live preview render */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const W = 720;
      const layoutDef = LAYOUTS.find((l) => l.id === layout)!;
      const cells = cellsFor(layout, Math.min(picked.length, layoutDef.max));
      const H = layout === '2v' ? 1080 : layout === '2h' ? 480 : 720;
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      const imgs: Array<HTMLImageElement | null> = await Promise.all(
        cells.map(async (_, i) => { try { return await loadImage(picked[i].thumb ?? picked[i].src); } catch { return null; } }),
      );
      if (cancelled) return;
      const g = gap;
      ctx.save();
      cells.forEach((c, i) => {
        const img = imgs[i];
        if (!img) return;
        const x = c.x * W + g / 2, y = c.y * H + g / 2;
        const w = c.w * W - g, h = c.h * H - g;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 10);
        ctx.clip();
        drawCover(ctx, img, x, y, w, h);
        ctx.restore();
      });
      ctx.restore();
    })();
    return () => { cancelled = true; };
  }, [layout, gap, bg, picked]);

  const save = async () => {
    setBusy(true);
    try {
      /* re-render at higher resolution for the saved file */
      const canvas = document.createElement('canvas');
      const W = 1600;
      const layoutDef = LAYOUTS.find((l) => l.id === layout)!;
      const cells = cellsFor(layout, Math.min(picked.length, layoutDef.max));
      const H = Math.round(W * (layout === '2v' ? 1.5 : layout === '2h' ? 0.667 : 1));
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      const imgs = await Promise.all(cells.map(async (_, i) => { try { return await loadImage(picked[i].src); } catch { return null; } }));
      const g = Math.round(gap * (W / 720));
      cells.forEach((c, i) => {
        const img = imgs[i];
        if (!img) return;
        const x = c.x * W + g / 2, y = c.y * H + g / 2;
        const w = c.w * W - g, h = c.h * H - g;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, Math.round(10 * (W / 720)));
        ctx.clip();
        drawCover(ctx, img, x, y, w, h);
        ctx.restore();
      });
      onSave(canvas.toDataURL('image/jpeg', 0.92), W, H);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Create collage" onClose={onClose}>
      <div className="collage-body">
        <div className="collage-preview glass glass-subtle">
          <canvas ref={canvasRef} style={{ maxWidth: '100%', borderRadius: 12, display: 'block' }} />
        </div>
        <div className="panel-row scroll-x">
          {LAYOUTS.map((l) => (
            <button key={l.id} type="button" className={`ghost-btn${layout === l.id ? ' on' : ''}`} disabled={picked.length < 2 && l.id !== '2h' && l.id !== '2v'} onClick={() => setLayout(l.id)}>
              <Icon name="collage" size={14} /> {l.label}
            </button>
          ))}
        </div>
        <label className="mini-slider">
          <span>Gap</span>
          <input type="range" min={0} max={36} value={gap} onChange={(e) => setGap(Number(e.target.value))} />
          <em>{gap}</em>
        </label>
        <div className="panel-row">
          {BG_COLORS.map((c) => (
            <button key={c} type="button" className={`color-dot${bg === c ? ' on' : ''}`} style={{ background: c }} aria-label={`Background ${c}`} onClick={() => setBg(c)} />
          ))}
          <label className="color-custom" title="Custom background">
            <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} />
          </label>
        </div>
        <button type="button" className="primary-btn" disabled={busy || picked.length < 2} onClick={save}>
          <Icon name={busy ? 'refresh' : 'check'} size={16} className={busy ? 'spin-slow' : ''} />
          {busy ? 'Composing…' : `Save collage (${Math.min(picked.length, LAYOUTS.find((l) => l.id === layout)!.max)} photos)`}
        </button>
        {picked.length < 2 && <p className="hint">Select at least 2 photos to compose a collage.</p>}
      </div>
    </Sheet>
  );
}
