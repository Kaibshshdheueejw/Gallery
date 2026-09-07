import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { closeEditor, saveEditCopy, saveEdits, toast, useApp } from '../../store';
import { canvasToBlob, computeOutputSize, FILTERS, renderEdited } from './render';
import { loadImage } from '../../ml/pipelines';
import { IconButton, Sheet } from '../../components/ui';
import { Icon } from '../../core/icons';
import { translate } from '../../core/i18n';
import { downloadBlob } from '../../core/utils';
import type { EditState, MarkupStroke } from '../../data/models';

type Tool = 'crop' | 'filters' | 'adjust' | 'enhance' | 'eraser' | 'blur' | 'markup';

const TOOLS: Array<{ id: Tool; icon: string; key: string }> = [
  { id: 'crop', icon: 'crop', key: 'crop' },
  { id: 'filters', icon: 'layers', key: 'filters' },
  { id: 'adjust', icon: 'settings', key: 'adjust' },
  { id: 'enhance', icon: 'wand', key: 'enhance' },
  { id: 'eraser', icon: 'eraser', key: 'eraser' },
  { id: 'blur', icon: 'location', key: 'portrait_blur' },
  { id: 'markup', icon: 'pen', key: 'markup' },
];

const MARKUP_COLORS = ['#ffffff', '#ff3b30', '#ffcc00', '#34c759', '#007aff', '#af52de', '#000000'];

/** display-space rect → original-image space (crop is stored pre-rotation). */
function displayToOrig(rect: { x: number; y: number; w: number; h: number }, rotate: number) {
  const corners = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.w, y: rect.y },
    { x: rect.x, y: rect.y + rect.h },
    { x: rect.x + rect.w, y: rect.y + rect.h },
  ].map((p) => {
    switch (rotate) {
      case 90: return { x: p.y, y: 1 - p.x };
      case 180: return { x: 1 - p.x, y: 1 - p.y };
      case 270: return { x: 1 - p.y, y: p.x };
      default: return p;
    }
  });
  const xs = corners.map((c) => c.x), ys = corners.map((c) => c.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
function origToDisplay(rect: { x: number; y: number; w: number; h: number }, rotate: number) {
  return displayToOrig(rect, (360 - rotate) % 360);
}

export function Editor() {
  const app = useApp();
  const { settings, items } = app;
  const t = (k: string) => translate(settings.lang, k);
  const item = items.find((i) => i.id === app.editorId);
  const [edits, setEdits] = useState<EditState | null>(item ? structuredClone(item.edits) : null);
  const [tool, setTool] = useState<Tool>('filters');
  const [saveOpen, setSaveOpen] = useState(false);
  const [textPrompt, setTextPrompt] = useState<{ x: number; y: number } | null>(null);
  const [textValue, setTextValue] = useState('');
  const [markupTool, setMarkupTool] = useState<MarkupStroke['tool']>('pen');
  const [markupColor, setMarkupColor] = useState(MARKUP_COLORS[0]);
  const [markupWidth, setMarkupWidth] = useState(34);
  const [brushSize, setBrushSize] = useState(6);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<MarkupStroke | null>(null);
  const erasing = useRef(false);
  const [cropDrag, setCropDrag] = useState<{ mode: 'move' | 'tl' | 'tr' | 'bl' | 'br'; x: number; y: number } | null>(null);
  const [wrapSize, setWrapSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => { if (item) setEdits(structuredClone(item.edits)); }, [item?.id]);

  const patch = useCallback((p: Partial<EditState>) => setEdits((e) => (e ? { ...e, ...p } : e)), []);

  /* render preview */
  useEffect(() => {
    if (!item || !edits) return;
    let cancelled = false;
    const id = setTimeout(async () => {
      try {
        const img = await loadImage(item.src);
        const canvas = await renderEdited(img, item, edits, { maxDim: 1100 });
        if (cancelled || !canvasRef.current?.parentElement) return;
        canvasRef.current!.replaceWith(canvas);
        canvas.id = 'editor-canvas';
        (canvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current = canvas;
      } catch { /* ignore */ }
    }, 70);
    return () => { cancelled = true; clearTimeout(id); };
  }, [item, edits]);

  // keep the canvas wrap exactly the rendered aspect so crop/markup coords align
  useEffect(() => {
    const el = stageRef.current;
    if (!el || !item || !edits) return;
    const compute = () => {
      const r = el.getBoundingClientRect();
      const o = computeOutputSize(item, edits, 1100);
      const ar = o.w / o.h;
      let w = r.width * 0.96;
      let h = w / ar;
      if (h > r.height * 0.96) { h = r.height * 0.96; w = h * ar; }
      setWrapSize({ w, h });
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [item, edits]);

  if (!item || !edits) return null;

  const out = computeOutputSize(item, edits, 1100);
  const displayCrop = edits.crop ? origToDisplay(edits.crop, edits.rotate) : { x: 0, y: 0, w: 1, h: 1 };

  const stagePoint = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };

  const onStageDown = (e: React.PointerEvent) => {
    const p = stagePoint(e);
    if (tool === 'markup') {
      if (markupTool === 'text') { setTextPrompt(p); return; }
      drawing.current = { tool: markupTool, color: markupColor, width: markupWidth, points: [p] };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } else if (tool === 'eraser') {
      erasing.current = true;
      patch({ erased: [...edits.erased, { x: p.x, y: p.y, r: brushSize / 100 }] });
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  };
  const onStageMove = (e: React.PointerEvent) => {
    const p = stagePoint(e);
    if (drawing.current) {
      drawing.current.points.push(p);
      renderLiveStroke();
    } else if (erasing.current) {
      const last = edits.erased[edits.erased.length - 1];
      if (!last || Math.hypot(last.x - p.x, last.y - p.y) > brushSize / 220) {
        patch({ erased: [...edits.erased, { x: p.x, y: p.y, r: brushSize / 100 }] });
      }
    } else if (cropDrag && tool === 'crop') {
      moveCrop(p);
    }
  };
  const onStageUp = () => {
    if (drawing.current) {
      const stroke = drawing.current;
      drawing.current = null;
      if (stroke.points.length > 1 || stroke.tool === 'text') patch({ markup: [...edits.markup, stroke] });
      clearOverlay();
    }
    erasing.current = false;
    setCropDrag(null);
  };

  const clearOverlay = () => {
    const o = overlayRef.current;
    o?.getContext('2d')?.clearRect(0, 0, o.width, o.height);
  };
  const renderLiveStroke = () => {
    const o = overlayRef.current;
    const c = canvasRef.current;
    if (!o || !c || !drawing.current) return;
    if (o.width !== c.width) { o.width = c.width; o.height = c.height; }
    const ctx = o.getContext('2d')!;
    ctx.clearRect(0, 0, o.width, o.height);
    const s = drawing.current;
    const w = o.width, h = o.height;
    ctx.strokeStyle = s.color; ctx.fillStyle = s.color;
    ctx.lineWidth = Math.max(1.5, (s.width / 100) * Math.min(w, h) * 0.06);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const pts = s.points.map((pt) => ({ x: pt.x * w, y: pt.y * h }));
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (const pt of pts.slice(1)) ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  };

  const moveCrop = (p: { x: number; y: number }) => {
    if (!cropDrag) return;
    const c = { ...displayCrop };
    const minSize = 0.08;
    if (cropDrag.mode === 'move') {
      const dx = p.x - cropDrag.x, dy = p.y - cropDrag.y;
      c.x = Math.max(0, Math.min(1 - c.w, c.x + dx));
      c.y = Math.max(0, Math.min(1 - c.h, c.y + dy));
    } else {
      if (cropDrag.mode.includes('l')) { const right = c.x + c.w; c.x = Math.min(p.x, right - minSize); c.w = right - c.x; }
      if (cropDrag.mode.includes('r')) { c.w = Math.max(minSize, Math.min(1 - c.x, p.x - c.x)); }
      if (cropDrag.mode.includes('t')) { const bottom = c.y + c.h; c.y = Math.min(p.y, bottom - minSize); c.h = bottom - c.y; }
      if (cropDrag.mode.includes('b')) { c.h = Math.max(minSize, Math.min(1 - c.y, p.y - c.y)); }
    }
    setCropDrag({ ...cropDrag, x: p.x, y: p.y });
    patch({ crop: displayToOrig(c, edits.rotate) });
  };

  const applyAspect = (ratio: number | null) => {
    if (!ratio) { patch({ crop: null }); return; }
    const ar = out.w / out.h;
    let w = 1, h = 1;
    if (ratio > ar) h = ar / ratio; else w = ratio / ar;
    patch({ crop: displayToOrig({ x: (1 - w) / 2, y: (1 - h) / 2, w, h }, edits.rotate) });
  };

  const doExport = async () => {
    const img = await loadImage(item.src);
    const canvas = await renderEdited(img, item, edits, { maxDim: 2000 });
    const blob = await canvasToBlob(canvas, 'image/png', 0.92);
    downloadBlob(blob, `${item.id}-edited.png`);
    toast('Exported PNG');
  };

  return (
    <div className="editor">
      <header className="viewer-bar top static">
        <IconButton icon="close" label="Discard" onClick={closeEditor} />
        <div className="grow"><strong>{t('edit')}</strong><span>{item.title}</span></div>
        <IconButton icon="rotate" label={t('rotate')} onClick={() => patch({ rotate: ((edits.rotate + 90) % 360) as EditState['rotate'] })} />
        <IconButton icon="check" label={t('save')} onClick={() => setSaveOpen(true)} />
      </header>

      <div
        className="editor-stage"
        ref={stageRef}
        onPointerDown={onStageDown}
        onPointerMove={onStageMove}
        onPointerUp={onStageUp}
        onPointerLeave={onStageUp}
        style={{ cursor: tool === 'eraser' ? 'cell' : tool === 'markup' ? 'crosshair' : cropDrag ? 'grabbing' : 'default' }}
      >
        <div className="editor-canvas-wrap" style={wrapSize ? { width: wrapSize.w, height: wrapSize.h } : undefined}>
          <canvas id="editor-canvas" ref={canvasRef} />
          <canvas className="overlay" ref={overlayRef} />
          {tool === 'crop' && (
            <div className="crop-overlay">
              <div
                className="crop-window"
                style={{ left: `${displayCrop.x * 100}%`, top: `${displayCrop.y * 100}%`, width: `${displayCrop.w * 100}%`, height: `${displayCrop.h * 100}%` }}
                onPointerDown={(e) => { e.stopPropagation(); setCropDrag({ mode: 'move', ...stagePoint(e) }); }}
              >
                {(['tl', 'tr', 'bl', 'br'] as const).map((mode) => (
                  <span
                    key={mode}
                    className={`handle ${mode}`}
                    onPointerDown={(e) => { e.stopPropagation(); setCropDrag({ mode, ...stagePoint(e) }); }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="editor-panel">
        {tool === 'crop' && (
          <div className="panel-row">
            <button type="button" className="ghost-btn" onClick={() => applyAspect(null)}>Free</button>
            <button type="button" className="ghost-btn" onClick={() => applyAspect(1)}>1:1</button>
            <button type="button" className="ghost-btn" onClick={() => applyAspect(4 / 3)}>4:3</button>
            <button type="button" className="ghost-btn" onClick={() => applyAspect(3 / 4)}>3:4</button>
            <button type="button" className="ghost-btn" onClick={() => applyAspect(16 / 9)}>16:9</button>
            <button type="button" className="ghost-btn" onClick={() => patch({ flipH: !edits.flipH })}><Icon name="copy" size={14} /> Flip H</button>
            <button type="button" className="ghost-btn" onClick={() => patch({ flipV: !edits.flipV })}>Flip V</button>
          </div>
        )}
        {tool === 'filters' && (
          <div className="panel-row scroll-x">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" className={`filter-chip${edits.filterId === f.id ? ' on' : ''}`} onClick={() => patch({ filterId: f.id })}>
                <span className="swatch" style={{ filter: f.css || undefined }} />
                {f.label}
              </button>
            ))}
          </div>
        )}
        {tool === 'adjust' && (
          <div className="panel-sliders">
            {([
              ['brightness', 'Brightness', -100, 100],
              ['contrast', 'Contrast', -100, 100],
              ['saturation', 'Saturation', -100, 100],
              ['warmth', 'Warmth', -100, 100],
              ['sharpen', 'Sharpen', 0, 100],
              ['vignette', 'Vignette', 0, 100],
              ['blur', 'Blur', 0, 20],
            ] as const).map(([key, label, min, max]) => (
              <label key={key} className="mini-slider">
                <span>{label}</span>
                <input
                  type="range" min={min} max={max} value={edits.adjust[key]}
                  onChange={(e) => patch({ adjust: { ...edits.adjust, [key]: Number(e.target.value) } })}
                />
                <em>{edits.adjust[key]}</em>
              </label>
            ))}
            <button type="button" className="ghost-btn" onClick={() => patch({ adjust: { brightness: 0, contrast: 0, saturation: 0, warmth: 0, sharpen: 0, vignette: 0, blur: 0 } })}>
              <Icon name="restore" size={14} /> Reset
            </button>
          </div>
        )}
        {tool === 'enhance' && (
          <div className="panel-row">
            <button type="button" className={`big-action${edits.enhanced ? ' on' : ''}`} onClick={() => patch({ enhanced: !edits.enhanced })}>
              <Icon name="wand" size={20} /> {t('enhance')}
            </button>
            <p className="hint">Auto brightness / contrast / colour from the on-device histogram of this photo.</p>
          </div>
        )}
        {tool === 'eraser' && (
          <div className="panel-sliders">
            <label className="mini-slider">
              <span>Brush</span>
              <input type="range" min={2} max={16} value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} />
              <em>{brushSize}</em>
            </label>
            <div className="panel-row">
              <button type="button" className="ghost-btn" onClick={() => patch({ erased: edits.erased.slice(0, -1) })}><Icon name="restore" size={14} /> Undo dab</button>
              <button type="button" className="ghost-btn" onClick={() => patch({ erased: [] })}><Icon name="close" size={14} /> Clear</button>
            </div>
            <p className="hint">Paint over an object — on-device inpainting blends it away.</p>
          </div>
        )}
        {tool === 'blur' && (
          <div className="panel-sliders">
            <label className="mini-slider">
              <span>Background blur</span>
              <input type="range" min={0} max={20} value={edits.portraitBlur} onChange={(e) => patch({ portraitBlur: Number(e.target.value) })} />
              <em>{edits.portraitBlur}</em>
            </label>
            <p className="hint">Depth effect: subject stays sharp, background melts away.</p>
          </div>
        )}
        {tool === 'markup' && (
          <div className="panel-sliders">
            <div className="panel-row scroll-x">
              {(['pen', 'line', 'arrow', 'rect', 'ellipse', 'text'] as const).map((m) => (
                <button key={m} type="button" className={`ghost-btn${markupTool === m ? ' on' : ''}`} onClick={() => setMarkupTool(m)}>
                  <Icon name={m === 'pen' ? 'pen' : m === 'text' ? 'text' : m === 'arrow' ? 'send' : m === 'line' ? 'list' : 'shapes'} size={15} /> {m}
                </button>
              ))}
            </div>
            <div className="panel-row">
              {MARKUP_COLORS.map((c) => (
                <button key={c} type="button" className={`color-dot${markupColor === c ? ' on' : ''}`} style={{ background: c }} onClick={() => setMarkupColor(c)} aria-label={c} />
              ))}
              <label className="mini-slider grow">
                <span>Width</span>
                <input type="range" min={6} max={90} value={markupWidth} onChange={(e) => setMarkupWidth(Number(e.target.value))} />
                <em>{markupWidth}</em>
              </label>
            </div>
            <div className="panel-row">
              <button type="button" className="ghost-btn" onClick={() => patch({ markup: edits.markup.slice(0, -1) })}><Icon name="restore" size={14} /> Undo</button>
              <button type="button" className="ghost-btn" onClick={() => patch({ markup: [] })}><Icon name="close" size={14} /> Clear</button>
            </div>
          </div>
        )}
      </div>

      <nav className="editor-rail">
        {TOOLS.map((toolDef) => (
          <button key={toolDef.id} type="button" className={tool === toolDef.id ? 'on' : ''} onClick={() => setTool(toolDef.id)}>
            <Icon name={toolDef.icon} size={21} />
            <span>{t(toolDef.key)}</span>
          </button>
        ))}
      </nav>

      {textPrompt && (
        <Sheet title="Add text" onClose={() => setTextPrompt(null)}>
          <div className="field">
            <input className="text-input" autoFocus value={textValue} placeholder="Type something…" onChange={(e) => setTextValue(e.target.value)} />
            <button
              type="button"
              className="primary-btn"
              onClick={() => {
                patch({ markup: [...edits.markup, { tool: 'text', color: markupColor, width: markupWidth, points: [textPrompt], text: textValue || 'Text' }] });
                setTextValue('');
                setTextPrompt(null);
              }}
            >
              Add
            </button>
          </div>
        </Sheet>
      )}

      {saveOpen && (
        <Sheet title={t('save')} onClose={() => setSaveOpen(false)}>
          <div className="field stack">
            <button type="button" className="primary-btn" onClick={() => { saveEdits(item.id, edits); setSaveOpen(false); closeEditor(); toast('Saved'); }}>
              <Icon name="check" size={16} /> {t('save')}
            </button>
            <button type="button" className="ghost-btn" onClick={() => { saveEditCopy(item.id, edits); setSaveOpen(false); closeEditor(); }}>
              <Icon name="copy" size={16} /> {t('save_copy')}
            </button>
            <button type="button" className="ghost-btn" onClick={() => { doExport(); setSaveOpen(false); }}>
              <Icon name="download" size={16} /> {t('export')} PNG
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
