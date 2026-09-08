/**
 * The Gallery editor — advanced, non-destructive, recipe-based (§7–§11, §14–§16).
 *
 * PHOTO tools: Crop (aspect/straighten/perspective/flip/expand-canvas/resize),
 * Light, Colour, Curves (RGB + per-channel), HSL (8 bands), Colour balance,
 * Filters (categorised, previewable), Stickers (drag/resize/rotate/duplicate/
 * opacity/layering), Text (fonts/colour/outline/shadow/background/spacing/
 * alignment/layering), Draw (pen/highlighter/shapes), Retouch (magic eraser,
 * red-eye, blur brush, mosaic), Depth (background blur), Frames, Enhance.
 *
 * VIDEO tools: Trim timeline (drag handles + playhead), Split at playhead,
 * Speed / Reverse / Mute / Volume, Effects (categorised), Colour, timed
 * Stickers & Text, Aspect ratio, Extract frame → library, Export WebM
 * (MediaRecorder re-render of the exact recipe).
 *
 * Non-destructive guarantees: the original asset is never mutated — every
 * tool edits an EditState recipe rendered on demand; Undo/Redo/Reset/Revert
 * are always available; "Save a copy" forks the item.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addGeneratedItem, closeEditor, saveEditCopy, saveEdits, setSettings, toast, useApp } from '../../store';
import {
  canvasToBlob, computeGeometry, computeOutputSize, cssFilterFor, drawMarkup, FILTERS, FILTER_CATEGORIES,
  FRAME_COLORS, FRAME_PRESETS, renderEdited, curveToLut,
} from './render';
import { EFFECT_CATEGORIES, getEffect, VIDEO_EFFECTS } from './videoEffects';
import { FONTS, getFont, STICKER_CATEGORIES, STICKER_COLORS, getSticker } from './stickers';
import { loadImage } from '../../ml/pipelines';
import { IconButton, Sheet } from '../../components/ui';
import { GlassPopupMenu, usePopupAnchor, type PopupMenuItem } from '../../components/GlassPopupMenu';
import { Icon } from '../../core/icons';
import { translate } from '../../core/i18n';
import { clamp, downloadBlob, formatDuration } from '../../core/utils';
import { ASPECTS, drawVideoFrame, effectiveSpeed, VideoStage } from '../viewer/VideoStage';
import type {
  BrushDabMode, CurvePt, EditState, FrameStyle, MarkupStroke, StickerLayer, TextLayer, VideoAspect,
} from '../../data/models';
import { emptyEdit } from '../../data/models';

type PhotoTool =
  | 'crop' | 'light' | 'color' | 'detail' | 'curves' | 'hsl' | 'balance'
  | 'filters' | 'stickers' | 'text' | 'draw' | 'retouch' | 'depth' | 'frame' | 'enhance';
type VideoTool = 'trim' | 'motion' | 'effects' | 'color' | 'stickers' | 'text' | 'aspect' | 'export';

const PHOTO_TOOLS: Array<{ id: PhotoTool; icon: string; label: string }> = [
  { id: 'crop', icon: 'crop', label: 'Crop' },
  { id: 'light', icon: 'sun', label: 'Light' },
  { id: 'color', icon: 'palette', label: 'Colour' },
  { id: 'curves', icon: 'activity', label: 'Curves' },
  { id: 'hsl', icon: 'droplet', label: 'HSL' },
  { id: 'balance', icon: 'sliders', label: 'Balance' },
  { id: 'filters', icon: 'layers', label: 'Filters' },
  { id: 'stickers', icon: 'sticker', label: 'Stickers' },
  { id: 'text', icon: 'text', label: 'Text' },
  { id: 'draw', icon: 'pen', label: 'Draw' },
  { id: 'retouch', icon: 'eraser', label: 'Retouch' },
  { id: 'depth', icon: 'location', label: 'Depth' },
  { id: 'frame', icon: 'frame', label: 'Frame' },
  { id: 'enhance', icon: 'wand', label: 'Enhance' },
];

const VIDEO_TOOLS: Array<{ id: VideoTool; icon: string; label: string }> = [
  { id: 'trim', icon: 'scissors', label: 'Trim' },
  { id: 'motion', icon: 'speed', label: 'Speed' },
  { id: 'effects', icon: 'film', label: 'Effects' },
  { id: 'color', icon: 'palette', label: 'Colour' },
  { id: 'stickers', icon: 'sticker', label: 'Stickers' },
  { id: 'text', icon: 'text', label: 'Text' },
  { id: 'aspect', icon: 'expand', label: 'Crop' },
  { id: 'export', icon: 'download', label: 'Export' },
];

const MARKUP_COLORS = ['#ffffff', '#ff3b30', '#ffcc00', '#34c759', '#007aff', '#af52de', '#000000'];

const ASPECT_CHOICES: Array<{ id: VideoAspect; label: string }> = [
  { id: 'original', label: 'Original' },
  { id: '16:9', label: '16:9' },
  { id: '9:16', label: '9:16' },
  { id: '1:1', label: '1:1' },
  { id: '4:5', label: '4:5' },
];

/* ── small shared bits ────────────────────────────────────────────────── */

function MiniSlider({ label, value, min, max, step = 1, onChange, format }: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; format?: (v: number) => string;
}) {
  return (
    <label className="mini-slider">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <em>{format ? format(value) : value}</em>
    </label>
  );
}

function SegRow<T extends string>({ value, options, onChange }: {
  value: T; options: Array<{ id: T; label: string; icon?: string }>; onChange: (v: T) => void;
}) {
  return (
    <div className="glass-seg small">
      {options.map((o) => (
        <button key={o.id} type="button" className={o.id === value ? 'on' : ''} onClick={() => onChange(o.id)}>
          {o.icon && <Icon name={o.icon} size={13} />}{o.label}
        </button>
      ))}
    </div>
  );
}

function ColorDots({ value, onChange, colors = MARKUP_COLORS }: { value: string; onChange: (c: string) => void; colors?: string[] }) {
  return (
    <div className="panel-row">
      {colors.map((c) => (
        <button key={c} type="button" className={`color-dot${value === c ? ' on' : ''}`} style={{ background: c }} aria-label={c} onClick={() => onChange(c)} />
      ))}
      <label className="color-custom" title="Custom colour">
        <input type="color" value={value.startsWith('#') ? value : '#ffffff'} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  );
}

function LayerOps({ onForward, onBackward, onDuplicate, onDelete }: {
  onForward: () => void; onBackward: () => void; onDuplicate: () => void; onDelete: () => void;
}) {
  return (
    <div className="panel-row">
      <button type="button" className="ghost-btn" onClick={onBackward} title="Send backward"><Icon name="arrowDown" size={14} /> Back</button>
      <button type="button" className="ghost-btn" onClick={onForward} title="Bring forward"><Icon name="arrowUp" size={14} /> Forward</button>
      <button type="button" className="ghost-btn" onClick={onDuplicate}><Icon name="copy" size={14} /> Duplicate</button>
      <button type="button" className="ghost-btn danger" onClick={onDelete}><Icon name="trash" size={14} /> Delete</button>
    </div>
  );
}

/* ── curves editor ────────────────────────────────────────────────────── */

type CurveChannel = 'rgb' | 'r' | 'g' | 'b';

const CURVE_PRESETS: Array<{ id: string; label: string; pts: CurvePt[] }> = [
  { id: 'none', label: 'Reset', pts: [] },
  { id: 'soft-s', label: 'Soft S', pts: [{ x: 0.25, y: 0.2 }, { x: 0.75, y: 0.8 }] },
  { id: 'strong-s', label: 'Strong S', pts: [{ x: 0.25, y: 0.14 }, { x: 0.75, y: 0.86 }] },
  { id: 'fade', label: 'Fade', pts: [{ x: 0, y: 0.08 }, { x: 1, y: 0.94 }] },
  { id: 'brighten', label: 'Brighten', pts: [{ x: 0.5, y: 0.6 }] },
  { id: 'darken', label: 'Darken', pts: [{ x: 0.5, y: 0.4 }] },
];

function CurvesEditor({ pts, channel, onChange }: { pts: CurvePt[]; channel: CurveChannel; onChange: (p: CurvePt[]) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const dragIdx = useRef<number | null>(null);
  const S = 224;

  const draw = useCallback(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== S * dpr) { c.width = S * dpr; c.height = S * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, S, S);
    // grid
    ctx.strokeStyle = 'rgba(128,128,140,0.22)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo((S / 4) * i, 0); ctx.lineTo((S / 4) * i, S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, (S / 4) * i); ctx.lineTo(S, (S / 4) * i); ctx.stroke();
    }
    // identity
    ctx.strokeStyle = 'rgba(128,128,140,0.4)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(0, S); ctx.lineTo(S, 0); ctx.stroke();
    ctx.setLineDash([]);
    // lut curve
    const lut = curveToLut(pts);
    ctx.strokeStyle = channel === 'r' ? '#ff6b6b' : channel === 'g' ? '#69db7c' : channel === 'b' ? '#74a4ff' : 'var(--md-primary, #b9a5ff)';
    ctx.strokeStyle = channel === 'rgb' ? '#cfc3ff' : ctx.strokeStyle as string;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * S;
      const y = S - (lut[i] / 255) * S;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // control points
    for (const p of pts) {
      ctx.beginPath();
      ctx.arc(p.x * S, S - p.y * S, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }, [pts, channel]);

  useEffect(draw, [draw]);

  const toPt = (e: React.PointerEvent): CurvePt => {
    const r = ref.current!.getBoundingClientRect();
    return { x: clamp((e.clientX - r.left) / r.width, 0, 1), y: clamp(1 - (e.clientY - r.top) / r.height, 0, 1) };
  };

  return (
    <div className="curves-wrap">
      <canvas
        ref={ref}
        style={{ width: S, height: S, touchAction: 'none' }}
        onPointerDown={(e) => {
          const p = toPt(e);
          const S2 = ref.current!.getBoundingClientRect().width;
          let best = -1, bestD = 14 / S2;
          pts.forEach((q, i) => {
            const d = Math.hypot(q.x - p.x, q.y - p.y);
            if (d < bestD) { bestD = d; best = i; }
          });
          if (best >= 0) { dragIdx.current = best; }
          else {
            const next = [...pts, p].sort((a, b) => a.x - b.x);
            onChange(next);
            dragIdx.current = next.indexOf(p);
          }
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (dragIdx.current === null) return;
          const p = toPt(e);
          const i = dragIdx.current;
          const next = pts.map((q, qi) => {
            if (qi !== i) return q;
            // endpoints lock on x; keep ordering stable
            const lo = qi === 0 ? 0 : pts[qi - 1].x + 0.01;
            const hi = qi === pts.length - 1 ? 1 : pts[qi + 1].x - 0.01;
            return { x: clamp(p.x, lo, hi), y: p.y };
          });
          onChange(next);
        }}
        onPointerUp={() => { dragIdx.current = null; }}
        onDoubleClick={(e) => {
          const r = ref.current!.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width, py = 1 - (e.clientY - r.top) / r.height;
          let best = -1, bestD = 0.06;
          pts.forEach((q, i) => { const d = Math.hypot(q.x - px, q.y - py); if (d < bestD) { bestD = d; best = i; } });
          if (best >= 0) onChange(pts.filter((_, i) => i !== best));
        }}
      />
      <p className="hint">Tap to add a point · drag to shape · double-tap a point to remove it.</p>
    </div>
  );
}

/* ── sticker picker cell (renders vector art at pick size) ────────────── */

function StickerCell({ id, onPick }: { id: string; onPick: (id: string) => void }) {
  const def = getSticker(id)!;
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (def.kind !== 'vector' || !ref.current) return;
    const c = ref.current;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = 34 * dpr; c.height = 34 * dpr;
    const ctx = c.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.translate(17, 17);
    ctx.scale(30, 30);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    def.draw?.(ctx, '#e8e2ff');
  }, [def]);
  return (
    <button type="button" className="sticker-cell pressable" onClick={() => onPick(id)} aria-label={def.label} title={def.label}>
      {def.kind === 'emoji'
        ? <span className="sticker-glyph">{def.glyph}</span>
        : <canvas ref={ref} style={{ width: 34, height: 34 }} />}
      {def.animated && <span className="sticker-anim-dot" title="Animates in videos" />}
    </button>
  );
}

/* ── display-space crop mapping (kept from v1; crop lives pre-rotation) ─ */

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

let layerSeq = 1;
const newLayerId = () => `L${Date.now().toString(36)}-${layerSeq++}`;

/* ── the editor ───────────────────────────────────────────────────────── */

export function Editor() {
  const app = useApp();
  const { settings } = app;
  const t = (k: string) => translate(settings.lang, k);
  const item = app.items.find((i) => i.id === app.editorId);
  const isVideo = item?.kind === 'video';

  const previewDim = settings.photoEdit.previewQuality === 'fast' ? 700 : settings.photoEdit.previewQuality === 'high' ? 1500 : 1100;

  /* ── edit state + undo/redo history ── */
  const initial = useMemo<EditState>(() => {
    if (!item) return emptyEdit();
    const e = structuredClone(item.edits);
    if (!isVideo && settings.photoEdit.autoEnhance && e.filterId === 'original' && !e.enhanced) e.enhanced = true;
    return e;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);
  const [history, setHistory] = useState<EditState[]>([initial]);
  const [hIdx, setHIdx] = useState(0);
  const edits = history[hIdx] ?? initial;
  const coalesce = useRef<{ key: string; at: number } | null>(null);

  useEffect(() => {
    if (!item) return;
    const fresh = structuredClone(item.edits);
    setHistory([fresh]);
    setHIdx(0);
    setSelected(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  const commit = useCallback((next: EditState, key?: string) => {
    setHistory((h) => {
      const now = Date.now();
      let base = h.slice(0, hIdx + 1);
      if (key && coalesce.current?.key === key && now - coalesce.current.at < 650 && base.length > 1) {
        base = base.slice(0, -1);
      }
      coalesce.current = key ? { key, at: now } : null;
      const capped = [...base, next].slice(-Math.max(8, settings.photoEdit.historyDepth));
      setHIdx(capped.length - 1);
      return capped;
    });
  }, [hIdx, settings.photoEdit.historyDepth]);

  const patch = useCallback((p: Partial<EditState>, key?: string) => commit({ ...edits, ...p }, key), [edits, commit]);
  const patchAdjust = useCallback((p: Partial<EditState['adjust']>, key: string) => commit({ ...edits, adjust: { ...edits.adjust, ...p } }, key), [edits, commit]);

  const undo = useCallback(() => setHIdx((i) => Math.max(0, i - 1)), []);
  const redo = useCallback(() => setHIdx((i) => Math.min(history.length - 1, i + 1)), [history.length]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [undo, redo]);

  /* ── ui state ── */
  const [tool, setTool] = useState<string>(isVideo ? 'trim' : 'filters');
  const [saveOpen, setSaveOpen] = useState(false);
  const resetMenu = usePopupAnchor();
  const [selected, setSelected] = useState<{ type: 'sticker' | 'text'; id: string } | null>(null);
  const [textSheet, setTextSheet] = useState(false);
  const [textDraft, setTextDraft] = useState('');
  const [stickerCat, setStickerCat] = useState(STICKER_CATEGORIES[0].id);
  const [filterCat, setFilterCat] = useState<string>('all');
  const [effectCat, setEffectCat] = useState<string>('cinematic');
  const [curveCh, setCurveCh] = useState<CurveChannel>('rgb');
  const [hslBand, setHslBand] = useState(0);
  const [balZone, setBalZone] = useState<'shadows' | 'midtones' | 'highlights'>('midtones');
  const [markupTool, setMarkupTool] = useState<MarkupStroke['tool']>('pen');
  const [markupColor, setMarkupColor] = useState(MARKUP_COLORS[0]);
  const [markupWidth, setMarkupWidth] = useState(34);
  const [markupOpacity, setMarkupOpacity] = useState(1);
  const [brushMode, setBrushMode] = useState<BrushDabMode>('inpaint');
  const [brushSize, setBrushSize] = useState(6);
  const [exportScale, setExportScale] = useState(1);
  const [exporting, setExporting] = useState<number | null>(null); // 0..1 progress
  const stageRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const videoCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef<MarkupStroke | null>(null);
  const brushing = useRef(false);
  const [cropDrag, setCropDrag] = useState<{ mode: 'move' | 'tl' | 'tr' | 'bl' | 'br'; x: number; y: number } | null>(null);
  const [wrapSize, setWrapSize] = useState<{ w: number; h: number } | null>(null);
  /* video preview transport */
  const [vPlaying, setVPlaying] = useState(true);
  const [vTime, setVTime] = useState(0);
  const [vScrub, setVScrub] = useState<number | null>(null); // non-null while scrubbing/paused
  const vTimeRef = useRef(0);

  /* ── photo preview render (debounced full pipeline) ── */
  useEffect(() => {
    if (!item || isVideo) return;
    let cancelled = false;
    const id = setTimeout(async () => {
      try {
        const img = await loadImage(item.src);
        const canvas = await renderEdited(img, item, edits, { maxDim: previewDim });
        if (cancelled || !wrapRef.current) return;
        canvasRef.current!.replaceWith(canvas);
        canvas.id = 'editor-canvas';
        (canvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current = canvas;
      } catch { /* ignore decode failures */ }
    }, 70);
    return () => { cancelled = true; clearTimeout(id); };
  }, [item, edits, isVideo, previewDim]);

  /* keep the canvas wrap at the rendered aspect */
  useEffect(() => {
    const el = stageRef.current;
    if (!el || !item) return;
    const compute = () => {
      const r = el.getBoundingClientRect();
      if (isVideo) {
        let w = r.width * 0.96;
        let h = w * 9 / 16;
        if (h > r.height * 0.9) { h = r.height * 0.9; w = h * 16 / 9; }
        setWrapSize({ w, h });
        return;
      }
      const o = computeOutputSize(item, edits, previewDim);
      const ar = o.w / o.h;
      let w = r.width * 0.96;
      let h = w / ar;
      if (h > r.height * 0.9) { h = r.height * 0.9; w = h * ar; }
      setWrapSize({ w, h });
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [item, edits, isVideo, previewDim]);

  if (!item) return null;

  const geom = isVideo ? null : computeGeometry(item, edits, previewDim);
  const out = isVideo ? { w: 16, h: 9 } : computeOutputSize(item, edits, previewDim);
  const displayCrop = edits.crop ? origToDisplay(edits.crop, edits.rotate) : { x: 0, y: 0, w: 1, h: 1 };
  const duration = item.video?.duration ?? 4;
  const trim = edits.trim ?? { start: 0, end: duration };

  /* ── stage geometry helpers ── */
  const stagePoint = (e: React.PointerEvent) => {
    const wrap = wrapRef.current ?? stageRef.current;
    if (!wrap) return { x: 0.5, y: 0.5 };
    const r = wrap.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };

  /* ── stage interactions (draw / brush / crop) ── */
  const onStageDown = (e: React.PointerEvent) => {
    const p = stagePoint(e);
    if (isVideo) return;
    if (tool === 'draw') {
      drawing.current = { tool: markupTool, color: markupColor, width: markupWidth, opacity: markupOpacity, points: [p] };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } else if (tool === 'retouch') {
      brushing.current = true;
      commit({ ...edits, dabs: [...edits.dabs, { x: p.x, y: p.y, r: brushSize / 100, mode: brushMode }] }, 'dab');
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  };
  const onStageMove = (e: React.PointerEvent) => {
    if (isVideo) return;
    const p = stagePoint(e);
    if (drawing.current) {
      drawing.current.points.push(p);
      renderLiveStroke();
    } else if (brushing.current) {
      const last = edits.dabs[edits.dabs.length - 1];
      if (!last || Math.hypot(last.x - p.x, last.y - p.y) > brushSize / 220) {
        commit({ ...edits, dabs: [...edits.dabs, { x: p.x, y: p.y, r: brushSize / 100, mode: brushMode }] }, 'dab');
      }
    } else if (cropDrag && tool === 'crop') {
      moveCrop(p);
    }
  };
  const onStageUp = () => {
    if (drawing.current) {
      const stroke = drawing.current;
      drawing.current = null;
      if (stroke.points.length > 1) commit({ ...edits, markup: [...edits.markup, stroke] });
      clearOverlay();
    }
    brushing.current = false;
    setCropDrag(null);
  };

  const clearOverlay = () => overlayRef.current?.getContext('2d')?.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
  const renderLiveStroke = () => {
    const o = overlayRef.current;
    const c = canvasRef.current;
    if (!o || !c || !drawing.current) return;
    if (o.width !== c.width) { o.width = c.width; o.height = c.height; }
    const ctx = o.getContext('2d')!;
    ctx.clearRect(0, 0, o.width, o.height);
    // same shape code as the final render — WYSIWYG for every markup tool
    drawMarkup(ctx, { markup: [drawing.current] } as EditState, o.width, o.height);
  };

  const moveCrop = (p: { x: number; y: number }) => {
    if (!cropDrag || isVideo) return;
    const c = { ...displayCrop };
    const minSize = 0.08;
    if (cropDrag.mode === 'move') {
      const dx = p.x - cropDrag.x, dy = p.y - cropDrag.y;
      c.x = clamp(c.x + dx, 0, 1 - c.w);
      c.y = clamp(c.y + dy, 0, 1 - c.h);
    } else {
      if (cropDrag.mode.includes('l')) { const right = c.x + c.w; c.x = Math.min(p.x, right - minSize); c.w = right - c.x; }
      if (cropDrag.mode.includes('r')) { c.w = Math.max(minSize, Math.min(1 - c.x, p.x - c.x)); }
      if (cropDrag.mode.includes('t')) { const bottom = c.y + c.h; c.y = Math.min(p.y, bottom - minSize); c.h = bottom - c.y; }
      if (cropDrag.mode.includes('b')) { c.h = Math.max(minSize, Math.min(1 - c.y, p.y - c.y)); }
    }
    setCropDrag({ ...cropDrag, x: p.x, y: p.y });
    patch({ crop: displayToOrig(c, edits.rotate) }, 'crop');
  };

  const applyAspect = (ratio: number | null) => {
    if (!ratio) { patch({ crop: null }); return; }
    const ar = out.w / out.h;
    let w = 1, h = 1;
    if (ratio > ar) h = ar / ratio; else w = ratio / ar;
    patch({ crop: displayToOrig({ x: (1 - w) / 2, y: (1 - h) / 2, w, h }, edits.rotate) });
  };

  /* ── layers (stickers & text) ── */
  const selectedSticker = selected?.type === 'sticker' ? edits.stickers.find((s) => s.id === selected.id) : undefined;
  const selectedText = selected?.type === 'text' ? edits.texts.find((s) => s.id === selected.id) : undefined;
  const maxZ = Math.max(0, ...edits.stickers.map((s) => s.z), ...edits.texts.map((s) => s.z));

  const addSticker = (stickerId: string) => {
    const layer: StickerLayer = {
      id: newLayerId(), stickerId, x: 0.5, y: 0.46, scale: 0.24, rot: 0, opacity: 1,
      color: null, z: maxZ + 1, t0: null, t1: null, anim: getSticker(stickerId)?.animated ?? false,
    };
    commit({ ...edits, stickers: [...edits.stickers, layer] });
    setSelected({ type: 'sticker', id: layer.id });
  };
  const addText = (text: string) => {
    const layer: TextLayer = {
      id: newLayerId(), text, x: 0.5, y: 0.5, scale: 0.14, rot: 0, opacity: 1, z: maxZ + 1,
      fontId: 'sans', color: '#ffffff', align: 'center', bg: null, outline: 0.35, outlineColor: '#000000',
      shadow: true, spacing: 0, lineHeight: 1.25, t0: null, t1: null, anim: 'none',
    };
    commit({ ...edits, texts: [...edits.texts, layer] });
    setSelected({ type: 'text', id: layer.id });
  };
  const updateSticker = (id: string, p: Partial<StickerLayer>, key?: string) =>
    commit({ ...edits, stickers: edits.stickers.map((s) => (s.id === id ? { ...s, ...p } : s)) }, key);
  const updateText = (id: string, p: Partial<TextLayer>, key?: string) =>
    commit({ ...edits, texts: edits.texts.map((s) => (s.id === id ? { ...s, ...p } : s)) }, key);
  const deleteLayer = () => {
    if (!selected) return;
    if (selected.type === 'sticker') commit({ ...edits, stickers: edits.stickers.filter((s) => s.id !== selected.id) });
    else commit({ ...edits, texts: edits.texts.filter((s) => s.id !== selected.id) });
    setSelected(null);
  };
  const duplicateLayer = () => {
    if (!selected) return;
    if (selected.type === 'sticker' && selectedSticker) {
      const copy = { ...selectedSticker, id: newLayerId(), x: clamp(selectedSticker.x + 0.06, 0, 1), y: clamp(selectedSticker.y + 0.06, 0, 1), z: maxZ + 1 };
      commit({ ...edits, stickers: [...edits.stickers, copy] });
      setSelected({ type: 'sticker', id: copy.id });
    } else if (selected.type === 'text' && selectedText) {
      const copy = { ...selectedText, id: newLayerId(), x: clamp(selectedText.x + 0.05, 0, 1), y: clamp(selectedText.y + 0.05, 0, 1), z: maxZ + 1 };
      commit({ ...edits, texts: [...edits.texts, copy] });
      setSelected({ type: 'text', id: copy.id });
    }
  };
  const reorderLayer = (dir: 1 | -1) => {
    if (!selected) return;
    const z = (selected.type === 'sticker' ? selectedSticker?.z : selectedText?.z) ?? 0;
    const next = Math.max(0, z + dir);
    if (selected.type === 'sticker') updateSticker(selected.id, { z: next });
    else updateText(selected.id, { z: next });
  };

  /* ── export ── */
  const doExport = async () => {
    if (isVideo) return;
    const img = await loadImage(item.src);
    const exportEdits = { ...edits, exportScale };
    const canvas = await renderEdited(img, item, exportEdits, { maxDim: 2000 });
    const fmt = settings.photoEdit.exportFormat;
    const blob = await canvasToBlob(canvas, fmt === 'png' ? 'image/png' : 'image/jpeg', settings.photoEdit.exportQuality / 100);
    downloadBlob(blob, `${item.id}-edited.${fmt === 'png' ? 'png' : 'jpg'}`);
    toast(`Exported ${fmt.toUpperCase()}${exportScale > 1 ? ` · upscaled ${exportScale}× (high-quality interpolation)` : ''}`);
  };

  const extractFrame = () => {
    const canvas = videoCanvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/jpeg', 0.92);
    addGeneratedItem({
      id: `${item.id}-frame-${Date.now().toString(36)}`,
      kind: 'photo',
      src: url,
      w: canvas.width, h: canvas.height,
      bytes: Math.round(url.length * 0.75),
      takenAt: Date.now(),
      title: `${item.title} · frame ${formatDuration(vTimeRef.current)}`,
      folder: 'Gallery/Extracted',
      camera: { ...item.camera },
      video: undefined,
    });
    toast('Frame added to your library');
  };

  const exportWebM = async () => {
    if (!('MediaRecorder' in window)) { toast('WebM export needs a Chromium-based browser'); return; }
    const img = await loadImage(item.src);
    const resH = settings.videoEdit.exportRes;
    const resW = Math.round(resH * 16 / 9);
    const fps = settings.videoEdit.exportFps;
    const canvas = document.createElement('canvas');
    canvas.width = resW; canvas.height = resH;
    const ctx = canvas.getContext('2d')!;
    const stream = canvas.captureStream(fps);
    const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m));
    if (!mime) { toast('WebM recording unsupported in this browser'); return; }
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: resH >= 1080 ? 8_000_000 : 4_000_000 });
    const chunks: BlobPart[] = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise<Blob>((resolve) => { rec.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' })); });
    setVPlaying(false);
    rec.start(200);
    const speed = effectiveSpeed(edits);
    const span = trim.end - trim.start;
    const t0 = performance.now();
    await new Promise<void>((resolve) => {
      const step = () => {
        const elapsed = (performance.now() - t0) / 1000 * speed;
        const time = edits.reverse ? trim.end - elapsed : trim.start + elapsed;
        const finished = edits.reverse ? time <= trim.start : time >= trim.end;
        const tt = clamp(time, trim.start, trim.end);
        drawVideoFrame(ctx, resW, resH, img, item, edits, tt, 1);
        setExporting(clamp(elapsed / Math.max(0.001, span), 0, 1));
        if (finished) resolve();
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    rec.stop();
    const blob = await done;
    setExporting(null);
    downloadBlob(blob, `${item.id}-edit.webm`);
    toast(`Exported WebM · ${resH}p${fps} · ${(blob.size / 1e6).toFixed(1)} MB`);
  };

  const splitAtPlayhead = () => {
    const t2 = clamp(vTimeRef.current, trim.start + 0.3, trim.end - 0.3);
    const second: typeof item = {
      ...structuredClone(item),
      id: `${item.id}-split-${Date.now().toString(36)}`,
      title: `${item.title} (part 2)`,
      takenAt: Date.now(),
      favorite: false, trashedAt: null, locked: false, hidden: false, generated: true, vision: undefined,
      edits: { ...structuredClone(edits), trim: { start: t2, end: trim.end } },
    };
    addGeneratedItem({ ...second });
    commit({ ...edits, trim: { start: trim.start, end: t2 } });
    toast(`Split at ${formatDuration(t2)} — part 2 added to your library`);
  };

  /* reset menu */
  const resetItems: PopupMenuItem[] = [
    { icon: 'restore', label: 'Reset this tool', onClick: () => resetTool() },
    { icon: 'close', label: 'Clear overlays', hint: 'stickers · text · drawing', onClick: () => commit({ ...edits, stickers: [], texts: [], markup: [], dabs: [] }) },
    { icon: 'history', label: 'Revert to original', danger: true, onClick: () => { commit(emptyEdit()); toast('Reverted to the original — nothing is lost until you save'); } },
  ];

  const resetTool = () => {
    switch (tool) {
      case 'light': patchAdjust({ brightness: 0, exposure: 0, contrast: 0, highlights: 0, shadows: 0 }, 'reset'); break;
      case 'color': patchAdjust({ saturation: 0, vibrance: 0, warmth: 0, tint: 0, hue: 0 }, 'reset'); break;
      case 'detail': patchAdjust({ sharpen: 0, clarity: 0, dehaze: 0, denoise: 0, grain: 0, vignette: 0, blur: 0 }, 'reset'); break;
      case 'curves': patch({ curves: null }); break;
      case 'hsl': patch({ hsl: null }); break;
      case 'balance': patch({ balance: null }); break;
      case 'crop': patch({ crop: null, straighten: 0, perspective: { x: 0, y: 0 }, pad: null, rotate: 0, flipH: false, flipV: false }); break;
      case 'filters': patch({ filterId: 'original' }); break;
      case 'retouch': patch({ dabs: [], erased: [] }); break;
      case 'depth': patch({ portraitBlur: 0 }); break;
      case 'frame': patch({ frame: null }); break;
      case 'draw': patch({ markup: [] }); break;
      default: break;
    }
  };

  /* ── sticker/text overlay manipulation (DOM hit-boxes over the canvas) ─ */
  const layerDrag = useRef<{
    id: string; type: 'sticker' | 'text'; mode: 'move' | 'scale' | 'rotate';
    orig: StickerLayer | TextLayer; startX: number; startY: number;
    centerX: number; centerY: number; startDist: number; startAngle: number;
  } | null>(null);

  /** layer centre in wrap pixels (same mapping the DOM boxes use) */
  const layerCenter = (layer: StickerLayer | TextLayer) => {
    if (!wrapSize) return { cx: 0, cy: 0, iw: 1, ih: 1 };
    if (isVideo) {
      const m2 = (() => {
        const targetAr = ASPECTS[edits.aspect ?? 'original'];
        const curAr = wrapSize.w / wrapSize.h;
        if (!targetAr) return { ox: 0, oy: 0, iw: 1, ih: 1 };
        if (targetAr < curAr) { const iw2 = targetAr / curAr; return { ox: (1 - iw2) / 2, oy: 0, iw: iw2, ih: 1 }; }
        const ih2 = curAr / targetAr; return { ox: 0, oy: (1 - ih2) / 2, iw: 1, ih: ih2 };
      })();
      return { cx: (m2.ox + layer.x * m2.iw) * wrapSize.w, cy: (m2.oy + layer.y * m2.ih) * wrapSize.h, iw: m2.iw, ih: m2.ih };
    }
    const ox = geom ? geom.imgX / geom.w : 0, oy = geom ? geom.imgY / geom.h : 0;
    const iw = geom ? geom.imgW / geom.w : 1, ih = geom ? geom.imgH / geom.h : 1;
    return { cx: (ox + layer.x * iw) * wrapSize.w, cy: (oy + layer.y * ih) * wrapSize.h, iw, ih };
  };

  const onLayerDown = (e: React.PointerEvent, type: 'sticker' | 'text', layer: StickerLayer | TextLayer, mode: 'move' | 'scale' | 'rotate') => {
    e.stopPropagation();
    e.preventDefault();
    setSelected({ type, id: layer.id });
    const wr = wrapRef.current?.getBoundingClientRect();
    const { cx, cy } = layerCenter(layer);
    const px = wr ? e.clientX - wr.left : e.clientX;
    const py = wr ? e.clientY - wr.top : e.clientY;
    layerDrag.current = {
      id: layer.id, type, mode, orig: { ...layer },
      startX: e.clientX, startY: e.clientY, centerX: cx, centerY: cy,
      startDist: Math.max(14, Math.hypot(px - cx, py - cy)),
      startAngle: (Math.atan2(py - cy, px - cx) * 180) / Math.PI,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onLayerMove = (e: React.PointerEvent) => {
    const d = layerDrag.current;
    if (!d || !wrapSize) return;
    const wr = wrapRef.current?.getBoundingClientRect();
    if (d.mode === 'move') {
      const { iw, ih } = layerCenter(d.orig);
      const dx = (e.clientX - d.startX) / (wrapSize.w * iw);
      const dy = (e.clientY - d.startY) / (wrapSize.h * ih);
      const p = { x: clamp(d.orig.x + dx, -0.15, 1.15), y: clamp(d.orig.y + dy, -0.15, 1.15) };
      if (d.type === 'sticker') updateSticker(d.id, p, 'layer-move'); else updateText(d.id, p, 'layer-move');
      return;
    }
    const rx = wr ? e.clientX - wr.left : e.clientX;
    const ry = wr ? e.clientY - wr.top : e.clientY;
    if (d.mode === 'scale') {
      const dist = Math.hypot(rx - d.centerX, ry - d.centerY);
      const scale = clamp(d.orig.scale * (dist / d.startDist), 0.02, 1.6);
      if (d.type === 'sticker') updateSticker(d.id, { scale }, 'layer-scale'); else updateText(d.id, { scale }, 'layer-scale');
    } else if (d.mode === 'rotate') {
      const ang = (Math.atan2(ry - d.centerY, rx - d.centerX) * 180) / Math.PI;
      let rot = Math.round(d.orig.rot + (ang - d.startAngle));
      // snap to upright within 4°
      const snapped = Math.round(rot / 90) * 90;
      if (Math.abs(rot - snapped) < 4) rot = snapped;
      if (d.type === 'sticker') updateSticker(d.id, { rot }, 'layer-rot'); else updateText(d.id, { rot }, 'layer-rot');
    }
  };
  const onLayerUp = () => { layerDrag.current = null; };

  /** video matte rect as fractions of the wrap (mirrors drawVideoFrame) */
  const videoMatte = () => {
    if (!wrapSize) return { ox: 0, oy: 0, iw: 1, ih: 1 };
    const targetAr = ASPECTS[edits.aspect ?? 'original'];
    const curAr = wrapSize.w / wrapSize.h;
    if (!targetAr) return { ox: 0, oy: 0, iw: 1, ih: 1 };
    if (targetAr < curAr) { const iw = targetAr / curAr; return { ox: (1 - iw) / 2, oy: 0, iw, ih: 1 }; }
    const ih = curAr / targetAr; return { ox: 0, oy: (1 - ih) / 2, iw: 1, ih };
  };

  const renderLayerBoxes = () => {
    if (!wrapSize || (!isVideo && !geom)) return null;
    const m = isVideo ? videoMatte() : null;
    const ox = isVideo ? m!.ox : geom!.imgX / geom!.w;
    const oy = isVideo ? m!.oy : geom!.imgY / geom!.h;
    const iw = isVideo ? m!.iw : geom!.imgW / geom!.w;
    const ih = isVideo ? m!.ih : geom!.imgH / geom!.h;
    const minDimPx = Math.min(wrapSize.w * iw, wrapSize.h * ih);
    const boxes: React.ReactNode[] = [];
    for (const s of edits.stickers) {
      const side = s.scale * minDimPx * 1.25;
      const sel = selected?.type === 'sticker' && selected.id === s.id;
      boxes.push(
        <div
          key={s.id}
          className={`layer-box${sel ? ' selected' : ''}`}
          style={{
            left: `${(ox + s.x * iw) * 100}%`, top: `${(oy + s.y * ih) * 100}%`,
            width: side, height: side, transform: `translate(-50%, -50%) rotate(${s.rot}deg)`,
          }}
          onPointerDown={(e) => onLayerDown(e, 'sticker', s, 'move')}
          onPointerMove={onLayerMove}
          onPointerUp={onLayerUp}
        >
          {sel && <span className="handle rotate" onPointerDown={(e) => onLayerDown(e, 'sticker', s, 'rotate')} />}
          {sel && <span className="handle scale" onPointerDown={(e) => onLayerDown(e, 'sticker', s, 'scale')} />}
        </div>,
      );
    }
    for (const tl of edits.texts) {
      const font = getFont(tl.fontId);
      const fontSize = tl.scale * minDimPx * 0.5;
      const lines = tl.text.split('\n');
      const wEst = Math.max(...lines.map((l) => l.length)) * fontSize * 0.62 + fontSize * 0.5;
      const hEst = lines.length * fontSize * tl.lineHeight + fontSize * 0.4;
      const sel = selected?.type === 'text' && selected.id === tl.id;
      boxes.push(
        <div
          key={tl.id}
          className={`layer-box text${sel ? ' selected' : ''}`}
          style={{
            left: `${(ox + tl.x * iw) * 100}%`, top: `${(oy + tl.y * ih) * 100}%`,
            width: wEst, height: hEst, transform: `translate(-50%, -50%) rotate(${tl.rot}deg)`,
          }}
          onPointerDown={(e) => onLayerDown(e, 'text', tl, 'move')}
          onPointerMove={onLayerMove}
          onPointerUp={onLayerUp}
          title={font.label}
        >
          {sel && <span className="handle rotate" onPointerDown={(e) => onLayerDown(e, 'text', tl, 'rotate')} />}
          {sel && <span className="handle scale" onPointerDown={(e) => onLayerDown(e, 'text', tl, 'scale')} />}
        </div>,
      );
    }
    return <div className="layer-overlay" onPointerDown={(e) => { if (e.target === e.currentTarget) setSelected(null); }}>{boxes}</div>;
  };

  const timingControls = (layer: StickerLayer | TextLayer, type: 'sticker' | 'text') => (
    <div className="panel-sliders">
      <div className="panel-row">
        <button
          type="button"
          className={`ghost-btn${layer.t0 === null && layer.t1 === null ? ' on' : ''}`}
          onClick={() => (type === 'sticker' ? updateSticker(layer.id, { t0: null, t1: null }) : updateText(layer.id, { t0: null, t1: null }))}
        >
          <Icon name="film" size={14} /> Whole clip
        </button>
        {type === 'sticker' && getSticker((layer as StickerLayer).stickerId)?.animated && (
          <button
            type="button"
            className={`ghost-btn${(layer as StickerLayer).anim ? ' on' : ''}`}
            onClick={() => updateSticker(layer.id, { anim: !(layer as StickerLayer).anim })}
          >
            <Icon name="bolt" size={14} /> Animated
          </button>
        )}
        {type === 'text' && (
          <SegRow
            value={(layer as TextLayer).anim ?? 'none'}
            options={[{ id: 'none', label: 'Static' }, { id: 'fade', label: 'Fade' }, { id: 'rise', label: 'Rise' }, { id: 'pop', label: 'Pop' }] as Array<{ id: 'none' | 'fade' | 'rise' | 'pop'; label: string }>}
            onChange={(v) => updateText(layer.id, { anim: v })}
          />
        )}
      </div>
      <MiniSlider label="Appears" value={layer.t0 ?? 0} min={0} max={duration} step={0.1}
        format={(v) => formatDuration(v)}
        onChange={(v) => (type === 'sticker'
          ? updateSticker(layer.id, { t0: Math.min(v, (layer.t1 ?? duration) - 0.1) }, 't0')
          : updateText(layer.id, { t0: Math.min(v, (layer.t1 ?? duration) - 0.1) }, 't0'))} />
      <MiniSlider label="Disappears" value={layer.t1 ?? duration} min={0} max={duration} step={0.1}
        format={(v) => formatDuration(v)}
        onChange={(v) => (type === 'sticker'
          ? updateSticker(layer.id, { t1: Math.max(v, (layer.t0 ?? 0) + 0.1) }, 't1')
          : updateText(layer.id, { t1: Math.max(v, (layer.t0 ?? 0) + 0.1) }, 't1'))} />
    </div>
  );

  /* ── render ── */
  return (
    <div className="editor">
      <header className="viewer-bar top static">
        <IconButton icon="close" label="Discard" onClick={closeEditor} />
        <IconButton icon="restore" label="Undo (Ctrl+Z)" onClick={undo} disabled={hIdx === 0} />
        <IconButton icon="reverse" label="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={hIdx >= history.length - 1} className="flip-x" />
        <div className="grow"><strong>{isVideo ? 'Edit clip' : t('edit')}</strong><span>{item.title}</span></div>
        <span className="editor-history-count" title="Edit history">{hIdx + 1}/{history.length}</span>
        <button ref={resetMenu.btnRef} type="button" className="icon-btn" aria-label="Reset menu" onClick={resetMenu.toggle}>
          <Icon name="sliders" size={20} />
        </button>
        <IconButton icon="check" label={t('save')} onClick={() => setSaveOpen(true)} />
      </header>
      {resetMenu.open && <GlassPopupMenu items={resetItems} anchorRect={resetMenu.rect} onClose={resetMenu.close} title="Reset" />}

      <div
        className="editor-stage"
        ref={stageRef}
        onPointerDown={onStageDown}
        onPointerMove={onStageMove}
        onPointerUp={onStageUp}
        onPointerLeave={onStageUp}
        style={{ cursor: tool === 'retouch' ? 'cell' : tool === 'draw' ? 'crosshair' : cropDrag ? 'grabbing' : 'default' }}
      >
        <div className="editor-canvas-wrap" ref={wrapRef} style={wrapSize ? { width: wrapSize.w, height: wrapSize.h } : undefined}>
          {isVideo ? (
            <VideoEditorStage
              item={item}
              edits={edits}
              playing={vPlaying && vScrub === null}
              scrubTime={vScrub}
              onTime={(tt) => { vTimeRef.current = tt; setVTime(tt); }}
              onCanvas={(c) => { videoCanvasRef.current = c; }}
            />
          ) : (
            <>
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
                      <span key={mode} className={`handle ${mode}`} onPointerDown={(e) => { e.stopPropagation(); setCropDrag({ mode, ...stagePoint(e) }); }} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          {renderLayerBoxes()}
        </div>
      </div>

      {/* ── tool panel ── */}
      <div className="editor-panel">
        {!isVideo && tool === 'crop' && (
          <div className="panel-sliders">
            <div className="panel-row scroll-x">
              <button type="button" className="ghost-btn" onClick={() => applyAspect(null)}>Free</button>
              <button type="button" className="ghost-btn" onClick={() => patch({ crop: null })}>Original</button>
              {[[1, '1:1'], [4 / 3, '4:3'], [3 / 4, '3:4'], [16 / 9, '16:9'], [9 / 16, '9:16'], [3 / 2, '3:2'], [2 / 3, '2:3']].map(([r, label]) => (
                <button key={label as string} type="button" className="ghost-btn" onClick={() => applyAspect(r as number)}>{label}</button>
              ))}
            </div>
            <div className="panel-row">
              <button type="button" className="ghost-btn" onClick={() => patch({ rotate: ((edits.rotate + 90) % 360) as EditState['rotate'] })}><Icon name="rotate" size={14} /> Rotate</button>
              <button type="button" className={`ghost-btn${edits.flipH ? ' on' : ''}`} onClick={() => patch({ flipH: !edits.flipH })}>Flip H</button>
              <button type="button" className={`ghost-btn${edits.flipV ? ' on' : ''}`} onClick={() => patch({ flipV: !edits.flipV })}>Flip V</button>
            </div>
            <MiniSlider label="Straighten" value={edits.straighten} min={-45} max={45} step={0.5} format={(v) => `${v}°`} onChange={(v) => patch({ straighten: v }, 'straighten')} />
            <MiniSlider label="Perspective H" value={edits.perspective.x} min={-100} max={100} onChange={(v) => patch({ perspective: { ...edits.perspective, x: v } }, 'persp')} />
            <MiniSlider label="Perspective V" value={edits.perspective.y} min={-100} max={100} onChange={(v) => patch({ perspective: { ...edits.perspective, y: v } }, 'persp')} />
            <div className="panel-sep" />
            <span className="panel-label"><Icon name="expand" size={13} /> Expand canvas</span>
            <div className="panel-row">
              {FRAME_COLORS.slice(0, 5).map((c) => (
                <button key={c} type="button" className={`color-dot${(edits.pad?.color ?? '#ffffff') === c ? ' on' : ''}`} style={{ background: c }} aria-label={`Pad colour ${c}`}
                  onClick={() => patch({ pad: { ...(edits.pad ?? { top: 0.08, bottom: 0.08, left: 0.08, right: 0.08 }), color: c } })} />
              ))}
            </div>
            <MiniSlider label="Expand" value={Math.round((edits.pad?.left ?? 0) * 200)} min={0} max={60}
              format={(v) => `${v}%`}
              onChange={(v) => {
                const f = v / 200;
                patch({ pad: f <= 0.001 ? null : { top: f, bottom: f, left: f, right: f, color: edits.pad?.color ?? '#ffffff' } }, 'pad');
              }} />
            <MiniSlider label="Resize (export)" value={exportScale * 100} min={25} max={300} step={25} format={(v) => `${v}%`} onChange={(v) => setExportScale(v / 100)} />
          </div>
        )}

        {!isVideo && tool === 'light' && (
          <div className="panel-sliders">
            <MiniSlider label="Brightness" value={edits.adjust.brightness} min={-100} max={100} onChange={(v) => patchAdjust({ brightness: v }, 'brightness')} />
            <MiniSlider label="Exposure" value={edits.adjust.exposure} min={-100} max={100} onChange={(v) => patchAdjust({ exposure: v }, 'exposure')} />
            <MiniSlider label="Contrast" value={edits.adjust.contrast} min={-100} max={100} onChange={(v) => patchAdjust({ contrast: v }, 'contrast')} />
            <MiniSlider label="Highlights" value={edits.adjust.highlights} min={-100} max={100} onChange={(v) => patchAdjust({ highlights: v }, 'highlights')} />
            <MiniSlider label="Shadows" value={edits.adjust.shadows} min={-100} max={100} onChange={(v) => patchAdjust({ shadows: v }, 'shadows')} />
          </div>
        )}

        {(tool === 'color' || (isVideo && tool === 'color')) && (
          <div className="panel-sliders">
            {!isVideo && <MiniSlider label="Saturation" value={edits.adjust.saturation} min={-100} max={100} onChange={(v) => patchAdjust({ saturation: v }, 'sat')} />}
            {!isVideo && <MiniSlider label="Vibrance" value={edits.adjust.vibrance} min={-100} max={100} onChange={(v) => patchAdjust({ vibrance: v }, 'vib')} />}
            <MiniSlider label="Temperature" value={edits.adjust.warmth} min={-100} max={100} onChange={(v) => patchAdjust({ warmth: v }, 'warm')} />
            <MiniSlider label="Tint" value={edits.adjust.tint} min={-100} max={100} onChange={(v) => patchAdjust({ tint: v }, 'tint')} />
            {!isVideo && <MiniSlider label="Hue" value={edits.adjust.hue} min={-180} max={180} format={(v) => `${v}°`} onChange={(v) => patchAdjust({ hue: v }, 'hue')} />}
            {isVideo && (
              <>
                <MiniSlider label="Brightness" value={edits.adjust.brightness} min={-100} max={100} onChange={(v) => patchAdjust({ brightness: v }, 'brightness')} />
                <MiniSlider label="Contrast" value={edits.adjust.contrast} min={-100} max={100} onChange={(v) => patchAdjust({ contrast: v }, 'contrast')} />
                <MiniSlider label="Saturation" value={edits.adjust.saturation} min={-100} max={100} onChange={(v) => patchAdjust({ saturation: v }, 'sat')} />
                <p className="hint">Colour renders live with GPU-composited filters; the same recipe is baked into frame extracts and WebM exports.</p>
              </>
            )}
          </div>
        )}

        {!isVideo && tool === 'detail' && (
          <div className="panel-sliders">
            <MiniSlider label="Sharpness" value={edits.adjust.sharpen} min={0} max={100} onChange={(v) => patchAdjust({ sharpen: v }, 'sharp')} />
            <MiniSlider label="Clarity" value={edits.adjust.clarity} min={-100} max={100} onChange={(v) => patchAdjust({ clarity: v }, 'clarity')} />
            <MiniSlider label="Dehaze" value={edits.adjust.dehaze} min={-50} max={100} onChange={(v) => patchAdjust({ dehaze: v }, 'dehaze')} />
            <MiniSlider label="Noise reduction" value={edits.adjust.denoise} min={0} max={100} onChange={(v) => patchAdjust({ denoise: v }, 'denoise')} />
            <MiniSlider label="Grain" value={edits.adjust.grain} min={0} max={100} onChange={(v) => patchAdjust({ grain: v }, 'grain')} />
            <MiniSlider label="Vignette" value={edits.adjust.vignette} min={0} max={100} onChange={(v) => patchAdjust({ vignette: v }, 'vignette')} />
            <MiniSlider label="Blur" value={edits.adjust.blur} min={0} max={20} step={0.5} onChange={(v) => patchAdjust({ blur: v }, 'blur')} />
          </div>
        )}

        {!isVideo && tool === 'curves' && (
          <div className="panel-sliders">
            <SegRow value={curveCh} options={[{ id: 'rgb', label: 'RGB' }, { id: 'r', label: 'Red' }, { id: 'g', label: 'Green' }, { id: 'b', label: 'Blue' }] as Array<{ id: CurveChannel; label: string }>} onChange={setCurveCh} />
            <CurvesEditor
              channel={curveCh}
              pts={edits.curves?.[curveCh] ?? []}
              onChange={(p) => patch({ curves: { ...(edits.curves ?? { rgb: [], r: [], g: [], b: [] }), [curveCh]: p } }, `curve-${curveCh}`)}
            />
            <div className="panel-row scroll-x">
              {CURVE_PRESETS.map((p) => (
                <button key={p.id} type="button" className="ghost-btn" onClick={() => patch({ curves: { ...(edits.curves ?? { rgb: [], r: [], g: [], b: [] }), [curveCh]: p.pts } })}>{p.label}</button>
              ))}
            </div>
          </div>
        )}

        {!isVideo && tool === 'hsl' && (
          <div className="panel-sliders">
            <div className="panel-row">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((b) => (
                <button
                  key={b} type="button"
                  className={`hsl-band${hslBand === b ? ' on' : ''}`}
                  style={{ background: `hsl(${[0, 30, 60, 110, 180, 235, 280, 320][b]} 70% 55%)` }}
                  aria-label={['Reds', 'Oranges', 'Yellows', 'Greens', 'Cyans', 'Blues', 'Purples', 'Magentas'][b]}
                  onClick={() => setHslBand(b)}
                />
              ))}
            </div>
            {(() => {
              const bands = edits.hsl ?? Array.from({ length: 8 }, () => ({ h: 0, s: 0, l: 0 }));
              const bnd = bands[hslBand];
              const setBand = (p: Partial<{ h: number; s: number; l: number }>) => {
                const next = bands.map((b, i) => (i === hslBand ? { ...b, ...p } : b));
                patch({ hsl: next }, `hsl-${hslBand}`);
              };
              return (
                <>
                  <MiniSlider label="Hue" value={bnd.h} min={-100} max={100} onChange={(v) => setBand({ h: v })} />
                  <MiniSlider label="Saturation" value={bnd.s} min={-100} max={100} onChange={(v) => setBand({ s: v })} />
                  <MiniSlider label="Luminance" value={bnd.l} min={-100} max={100} onChange={(v) => setBand({ l: v })} />
                  <button type="button" className="ghost-btn" onClick={() => setBand({ h: 0, s: 0, l: 0 })}><Icon name="restore" size={14} /> Reset band</button>
                </>
              );
            })()}
          </div>
        )}

        {!isVideo && tool === 'balance' && (
          <div className="panel-sliders">
            <SegRow value={balZone} options={[{ id: 'shadows', label: 'Shadows' }, { id: 'midtones', label: 'Midtones' }, { id: 'highlights', label: 'Highlights' }] as Array<{ id: 'shadows' | 'midtones' | 'highlights'; label: string }>} onChange={setBalZone} />
            {(() => {
              const bal = edits.balance ?? { shadows: { r: 0, g: 0, b: 0 }, midtones: { r: 0, g: 0, b: 0 }, highlights: { r: 0, g: 0, b: 0 } };
              const zone = bal[balZone];
              const set = (p: Partial<{ r: number; g: number; b: number }>) =>
                patch({ balance: { ...bal, [balZone]: { ...zone, ...p } } }, `bal-${balZone}`);
              return (
                <>
                  <MiniSlider label="Red ↔ Cyan" value={zone.r} min={-100} max={100} onChange={(v) => set({ r: v })} />
                  <MiniSlider label="Green ↔ Magenta" value={zone.g} min={-100} max={100} onChange={(v) => set({ g: v })} />
                  <MiniSlider label="Blue ↔ Yellow" value={zone.b} min={-100} max={100} onChange={(v) => set({ b: v })} />
                  <button type="button" className="ghost-btn" onClick={() => set({ r: 0, g: 0, b: 0 })}><Icon name="restore" size={14} /> Reset zone</button>
                </>
              );
            })()}
          </div>
        )}

        {tool === 'filters' && (
          <div className="panel-sliders">
            <div className="panel-row scroll-x">
              {(isVideo ? [{ id: 'all', label: 'All' }] : FILTER_CATEGORIES).map((c) => (
                <button key={c.id} type="button" className={`chip${(isVideo ? 'all' : filterCat) === c.id ? ' active' : ''}`} onClick={() => setFilterCat(c.id)}>{c.label}</button>
              ))}
            </div>
            <div className="filter-grid">
              {FILTERS.filter((f) => filterCat === 'all' || f.cat === filterCat).map((f) => (
                <button key={f.id} type="button" className={`filter-tile${edits.filterId === f.id ? ' on' : ''}`} onClick={() => patch({ filterId: f.id })}>
                  <span className="filter-prev">
                    <img src={item.thumb ?? item.src} alt="" style={{ filter: f.css || undefined }} loading="lazy" decoding="async" />
                  </span>
                  <em>{f.label}</em>
                </button>
              ))}
            </div>
          </div>
        )}

        {tool === 'stickers' && (
          <div className="panel-sliders">
            {selectedSticker ? (
              <>
                <div className="panel-row">
                  <span className="panel-label grow"><Icon name="sticker" size={14} /> Selected sticker</span>
                  <button type="button" className="text-btn" onClick={() => setSelected(null)}>Browse</button>
                </div>
                <MiniSlider label="Size" value={Math.round(selectedSticker.scale * 100)} min={4} max={120} format={(v) => `${v}%`} onChange={(v) => updateSticker(selectedSticker.id, { scale: v / 100 }, 'st-scale')} />
                <MiniSlider label="Rotation" value={selectedSticker.rot} min={-180} max={180} format={(v) => `${v}°`} onChange={(v) => updateSticker(selectedSticker.id, { rot: v }, 'st-rot')} />
                <MiniSlider label="Opacity" value={Math.round(selectedSticker.opacity * 100)} min={5} max={100} format={(v) => `${v}%`} onChange={(v) => updateSticker(selectedSticker.id, { opacity: v / 100 }, 'st-op')} />
                {getSticker(selectedSticker.stickerId)?.kind === 'vector' && (
                  <ColorDots value={selectedSticker.color ?? '#ffffff'} colors={STICKER_COLORS} onChange={(c) => updateSticker(selectedSticker.id, { color: c })} />
                )}
                <LayerOps onForward={() => reorderLayer(1)} onBackward={() => reorderLayer(-1)} onDuplicate={duplicateLayer} onDelete={deleteLayer} />
                {isVideo && timingControls(selectedSticker, 'sticker')}
                <p className="hint">Drag it on the canvas · corner handle resizes · top handle rotates.</p>
              </>
            ) : (
              <>
                <div className="panel-row scroll-x">
                  {STICKER_CATEGORIES.map((c) => (
                    <button key={c.id} type="button" className={`chip${stickerCat === c.id ? ' active' : ''}`} onClick={() => setStickerCat(c.id)}>
                      <Icon name={c.icon} size={13} />{c.label}
                    </button>
                  ))}
                </div>
                <div className="sticker-grid">
                  {(STICKER_CATEGORIES.find((c) => c.id === stickerCat) ?? STICKER_CATEGORIES[0]).stickers.map((s) => (
                    <StickerCell key={s.id} id={s.id} onPick={addSticker} />
                  ))}
                </div>
                {edits.stickers.length > 0 && (
                  <div className="panel-row scroll-x">
                    {edits.stickers.map((s) => (
                      <button key={s.id} type="button" className="ghost-btn" onClick={() => setSelected({ type: 'sticker', id: s.id })}>
                        {getSticker(s.stickerId)?.kind === 'emoji' ? getSticker(s.stickerId)?.glyph : '◆'} #{s.z}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tool === 'text' && (
          <div className="panel-sliders">
            {selectedText ? (
              <>
                <div className="panel-row">
                  <input className="text-input grow" value={selectedText.text} onChange={(e) => updateText(selectedText.id, { text: e.target.value }, 'txt')} />
                </div>
                <div className="panel-row scroll-x">
                  {FONTS.map((f) => (
                    <button key={f.id} type="button" className={`font-chip${selectedText.fontId === f.id ? ' on' : ''}`} style={{ fontFamily: f.stack }} onClick={() => updateText(selectedText.id, { fontId: f.id })}>
                      {f.sample} {f.label}
                    </button>
                  ))}
                </div>
                <MiniSlider label="Size" value={Math.round(selectedText.scale * 400)} min={4} max={80} format={(v) => `${Math.round((v / 400) * 100)}%`} onChange={(v) => updateText(selectedText.id, { scale: v / 400 }, 'tx-scale')} />
                <MiniSlider label="Opacity" value={Math.round(selectedText.opacity * 100)} min={5} max={100} format={(v) => `${v}%`} onChange={(v) => updateText(selectedText.id, { opacity: v / 100 }, 'tx-op')} />
                <MiniSlider label="Letter spacing" value={selectedText.spacing} min={-50} max={100} onChange={(v) => updateText(selectedText.id, { spacing: v }, 'tx-sp')} />
                <MiniSlider label="Line height" value={selectedText.lineHeight * 100} min={80} max={240} format={(v) => `${(v / 100).toFixed(2)}`} onChange={(v) => updateText(selectedText.id, { lineHeight: v / 100 }, 'tx-lh')} />
                <MiniSlider label="Rotation" value={selectedText.rot} min={-180} max={180} format={(v) => `${v}°`} onChange={(v) => updateText(selectedText.id, { rot: v }, 'tx-rot')} />
                <SegRow value={selectedText.align} options={[{ id: 'left', label: 'Left' }, { id: 'center', label: 'Center' }, { id: 'right', label: 'Right' }] as Array<{ id: 'left' | 'center' | 'right'; label: string }>} onChange={(v) => updateText(selectedText.id, { align: v })} />
                <span className="panel-label">Colour</span>
                <ColorDots value={selectedText.color} onChange={(c) => updateText(selectedText.id, { color: c })} />
                <div className="panel-row">
                  <button type="button" className={`ghost-btn${selectedText.bg ? ' on' : ''}`} onClick={() => updateText(selectedText.id, { bg: selectedText.bg ? null : 'rgba(0,0,0,0.55)' })}>
                    <Icon name="frame" size={14} /> Background
                  </button>
                  {selectedText.bg && (
                    <label className="color-custom" title="Background colour">
                      <input type="color" value={selectedText.bg.startsWith('#') ? selectedText.bg : '#000000'} onChange={(e) => updateText(selectedText.id, { bg: e.target.value })} />
                    </label>
                  )}
                  <button type="button" className={`ghost-btn${selectedText.shadow ? ' on' : ''}`} onClick={() => updateText(selectedText.id, { shadow: !selectedText.shadow })}>
                    <Icon name="copy" size={14} /> Shadow
                  </button>
                </div>
                <MiniSlider label="Outline" value={Math.round(selectedText.outline * 100)} min={0} max={100} format={(v) => `${v}%`} onChange={(v) => updateText(selectedText.id, { outline: v / 100 }, 'tx-ol')} />
                {selectedText.outline > 0 && <ColorDots value={selectedText.outlineColor} onChange={(c) => updateText(selectedText.id, { outlineColor: c })} />}
                <LayerOps onForward={() => reorderLayer(1)} onBackward={() => reorderLayer(-1)} onDuplicate={duplicateLayer} onDelete={deleteLayer} />
                {isVideo && timingControls(selectedText, 'text')}
              </>
            ) : (
              <>
                <div className="panel-row">
                  <button type="button" className="big-action" onClick={() => setTextSheet(true)}><Icon name="text" size={18} /> Add text</button>
                </div>
                {edits.texts.length > 0 && (
                  <div className="panel-row scroll-x">
                    {edits.texts.map((tl) => (
                      <button key={tl.id} type="button" className="ghost-btn" onClick={() => setSelected({ type: 'text', id: tl.id })}>“{tl.text.slice(0, 12)}”</button>
                    ))}
                  </div>
                )}
                <p className="hint">Six built-in typefaces · outline, shadow, background, spacing & alignment — all rendered into the export.</p>
              </>
            )}
          </div>
        )}

        {!isVideo && tool === 'draw' && (
          <div className="panel-sliders">
            <div className="panel-row scroll-x">
              {(['pen', 'highlighter', 'line', 'arrow', 'rect', 'ellipse'] as const).map((m) => (
                <button key={m} type="button" className={`ghost-btn${markupTool === m ? ' on' : ''}`} onClick={() => setMarkupTool(m)}>
                  <Icon name={m === 'pen' ? 'pen' : m === 'highlighter' ? 'highlighter' : m === 'arrow' ? 'send' : m === 'line' ? 'list' : m === 'rect' ? 'frame' : 'shapes'} size={15} /> {m}
                </button>
              ))}
            </div>
            <ColorDots value={markupColor} onChange={setMarkupColor} />
            <MiniSlider label="Width" value={markupWidth} min={6} max={90} onChange={setMarkupWidth} />
            <MiniSlider label="Opacity" value={Math.round(markupOpacity * 100)} min={10} max={100} format={(v) => `${v}%`} onChange={(v) => setMarkupOpacity(v / 100)} />
            <div className="panel-row">
              <button type="button" className="ghost-btn" onClick={() => commit({ ...edits, markup: edits.markup.slice(0, -1) })}><Icon name="restore" size={14} /> Undo stroke</button>
              <button type="button" className="ghost-btn" onClick={() => commit({ ...edits, markup: [] })}><Icon name="close" size={14} /> Clear</button>
            </div>
          </div>
        )}

        {!isVideo && tool === 'retouch' && (
          <div className="panel-sliders">
            <SegRow
              value={brushMode}
              options={[
                { id: 'inpaint', label: 'Eraser', icon: 'eraser' },
                { id: 'redeye', label: 'Red-eye', icon: 'eye' },
                { id: 'blur', label: 'Blur', icon: 'droplet' },
                { id: 'mosaic', label: 'Mosaic', icon: 'mosaic' },
              ] as Array<{ id: BrushDabMode; label: string; icon: string }>}
              onChange={setBrushMode}
            />
            <MiniSlider label="Brush" value={brushSize} min={2} max={16} onChange={setBrushSize} />
            <div className="panel-row">
              <button type="button" className="ghost-btn" onClick={() => commit({ ...edits, dabs: edits.dabs.slice(0, -1) })}><Icon name="restore" size={14} /> Undo dab</button>
              <button type="button" className="ghost-btn" onClick={() => commit({ ...edits, dabs: [], erased: [] })}><Icon name="close" size={14} /> Clear</button>
            </div>
            <p className="hint">
              {brushMode === 'inpaint' && 'Object eraser — paint over an object; on-device inpainting blends it into its surroundings (heuristic, no cloud).'}
              {brushMode === 'redeye' && 'Red-eye correction — dab over eyes; red-dominant pixels are neutralised to the local tone.'}
              {brushMode === 'blur' && 'Selective blur — paint to melt only the regions you touch.'}
              {brushMode === 'mosaic' && 'Mosaic / pixelate — paint to pixelate private details.'}
            </p>
          </div>
        )}

        {!isVideo && tool === 'depth' && (
          <div className="panel-sliders">
            <MiniSlider label="Background blur" value={edits.portraitBlur} min={0} max={20} onChange={(v) => patch({ portraitBlur: v }, 'pblur')} />
            <p className="hint">Depth effect: the subject stays sharp while the background melts. Uses an on-device centre-weighted depth estimate — for AI subject cut-out see the native build.</p>
          </div>
        )}

        {!isVideo && tool === 'frame' && (
          <div className="panel-sliders">
            <div className="panel-row scroll-x">
              {FRAME_PRESETS.map((f) => (
                <button key={f.id} type="button" className={`ghost-btn${(edits.frame?.id ?? 'none') === f.id ? ' on' : ''}`}
                  onClick={() => patch({ frame: f.id === 'none' ? null : { ...(edits.frame ?? { color: '#ffffff', width: 14 }), id: f.id as FrameStyle['id'] } })}>
                  {f.label}
                </button>
              ))}
            </div>
            {edits.frame && edits.frame.id !== 'none' && (
              <>
                <ColorDots value={edits.frame.color} colors={FRAME_COLORS} onChange={(c) => patch({ frame: { ...edits.frame!, color: c } })} />
                <MiniSlider label="Width" value={edits.frame.width} min={2} max={40} onChange={(v) => patch({ frame: { ...edits.frame!, width: v } }, 'fr-w')} />
              </>
            )}
          </div>
        )}

        {!isVideo && tool === 'enhance' && (
          <div className="panel-sliders">
            <div className="panel-row">
              <button type="button" className={`big-action${edits.enhanced ? ' on' : ''}`} onClick={() => patch({ enhanced: !edits.enhanced })}>
                <Icon name="wand" size={20} /> {t('enhance')}
              </button>
            </div>
            <p className="hint">Auto brightness / contrast / colour from the on-device histogram of this photo. No cloud, no AI claims — pure pixel statistics.</p>
            <div className="panel-sep" />
            <span className="panel-label">Advanced — native build</span>
            <div className="set-group glass glass-subtle">
              <div className="row-btn disabled" title={t('device_only')}>
                <Icon name="scanFace" size={18} /><span className="grow">Face enhance<em className="face-sub">needs the on-device ML relight model</em></span><em className="muted">SOON</em>
              </div>
              <div className="row-btn disabled" title={t('device_only')}>
                <Icon name="person" size={18} /><span className="grow">Background removal<em className="face-sub">subject cut-out needs the segmentation model</em></span><em className="muted">SOON</em>
              </div>
            </div>
            <p className="hint">These two need real ML models — they ship in the Flutter build rather than fake a result here. Background <strong>blur</strong> (Depth tool) and the <strong>object eraser</strong> (Retouch) do work in this preview.</p>
          </div>
        )}

        {isVideo && tool === 'trim' && (
          <div className="panel-sliders">
            <TrimTimeline
              duration={duration}
              trim={trim}
              playhead={vScrub ?? vTime}
              onTrim={(next) => commit({ ...edits, trim: next })}
              onScrub={(tt) => { setVScrub(tt); vTimeRef.current = tt; setVTime(tt); }}
              onScrubEnd={() => setVScrub(null)}
            />
            <div className="panel-row">
              <button type="button" className="ghost-btn" onClick={() => setVPlaying((p) => !p)}>
                <Icon name={vPlaying && vScrub === null ? 'pause' : 'play'} size={14} /> {vPlaying && vScrub === null ? 'Pause' : 'Play'}
              </button>
              <button type="button" className="ghost-btn" onClick={splitAtPlayhead}><Icon name="split" size={14} /> Split at playhead</button>
              <button type="button" className="ghost-btn" onClick={() => commit({ ...edits, trim: null })}><Icon name="restore" size={14} /> Reset trim</button>
            </div>
            <p className="hint">Drag the handles to trim · drag the playhead to scrub · Split creates a second clip in your library at the playhead.</p>
          </div>
        )}

        {isVideo && tool === 'motion' && (
          <div className="panel-sliders">
            <SegRow
              value={String(edits.speed)}
              options={[{ id: '0.25', label: '0.25×' }, { id: '0.5', label: '0.5×' }, { id: '1', label: '1×' }, { id: '1.5', label: '1.5×' }, { id: '2', label: '2×' }, { id: '3', label: '3×' }]}
              onChange={(v) => commit({ ...edits, speed: Number(v) })}
            />
            <div className="panel-row">
              <button type="button" className={`ghost-btn${edits.reverse ? ' on' : ''}`} onClick={() => commit({ ...edits, reverse: !edits.reverse })}><Icon name="reverse" size={14} /> Reverse</button>
              <button type="button" className={`ghost-btn${edits.muted ? ' on' : ''}`} onClick={() => commit({ ...edits, muted: !edits.muted })}><Icon name={edits.muted ? 'volumeOff' : 'volume'} size={14} /> {edits.muted ? 'Muted' : 'Sound on'}</button>
            </div>
            <MiniSlider label="Volume" value={edits.volume} min={0} max={100} format={(v) => `${v}%`} onChange={(v) => commit({ ...edits, volume: v }, 'vol')} />
            {getEffect(edits.effectId).speed && <p className="hint">The {getEffect(edits.effectId).label} effect suggests {getEffect(edits.effectId).speed}× — effective speed: {effectiveSpeed(edits).toFixed(2)}×.</p>}
          </div>
        )}

        {isVideo && tool === 'effects' && (
          <div className="panel-sliders">
            <div className="panel-row scroll-x">
              {EFFECT_CATEGORIES.map((c) => (
                <button key={c.id} type="button" className={`chip${effectCat === c.id ? ' active' : ''}`} onClick={() => setEffectCat(c.id)}>{c.label}</button>
              ))}
            </div>
            <div className="filter-grid">
              {VIDEO_EFFECTS.filter((e) => e.cat === effectCat || e.id === 'none').map((e) => (
                <button key={e.id} type="button" className={`filter-tile${edits.effectId === e.id ? ' on' : ''}`} onClick={() => commit({ ...edits, effectId: e.id })}>
                  <span className="filter-prev">
                    <img src={item.thumb ?? item.src} alt="" style={{ filter: e.css || undefined }} loading="lazy" decoding="async" />
                  </span>
                  <em>{e.label}{e.speed ? ` · ${e.speed}×` : ''}</em>
                </button>
              ))}
            </div>
          </div>
        )}

        {isVideo && tool === 'aspect' && (
          <div className="panel-sliders">
            <SegRow value={edits.aspect} options={ASPECT_CHOICES.map((a) => ({ id: a.id, label: a.label }))} onChange={(v) => commit({ ...edits, aspect: v })} />
            <div className="panel-row">
              <button type="button" className="ghost-btn" onClick={() => commit({ ...edits, rotate: (((edits.rotate ?? 0) + 90) % 360) as EditState['rotate'] })}>
                <Icon name="rotate" size={14} /> Rotate 90°
              </button>
              <button type="button" className={`ghost-btn${edits.flipH ? ' on' : ''}`} onClick={() => commit({ ...edits, flipH: !edits.flipH })}>Flip H</button>
              <button type="button" className={`ghost-btn${edits.flipV ? ' on' : ''}`} onClick={() => commit({ ...edits, flipV: !edits.flipV })}>Flip V</button>
            </div>
            <p className="hint">Crops the frame to the target ratio with letterbox mattes where needed; rotate & flip are baked into playback, frame extracts and WebM exports.</p>
          </div>
        )}

        {isVideo && tool === 'export' && (
          <div className="panel-sliders">
            <div className="panel-row">
              <button type="button" className="big-action" onClick={extractFrame}><Icon name="camera" size={18} /> Extract frame</button>
              <button type="button" className="big-action" onClick={exportWebM} disabled={exporting !== null}>
                <Icon name={exporting !== null ? 'refresh' : 'download'} size={18} className={exporting !== null ? 'spin-slow' : ''} />
                {exporting !== null ? `Recording ${Math.round(exporting * 100)}%` : 'Export WebM'}
              </button>
            </div>
            {exporting !== null && <div className="progress"><div style={{ width: `${exporting * 100}%` }} /></div>}
            <div className="panel-row">
              <SegRow value={String(settings.videoEdit.exportRes)} options={[{ id: '720', label: '720p' }, { id: '1080', label: '1080p' }]}
                onChange={(v) => setSettings({ videoEdit: { ...settings.videoEdit, exportRes: Number(v) as 720 | 1080 } })} />
              <SegRow value={String(settings.videoEdit.exportFps)} options={[{ id: '30', label: '30 fps' }, { id: '60', label: '60 fps' }]}
                onChange={(v) => setSettings({ videoEdit: { ...settings.videoEdit, exportFps: Number(v) as 30 | 60 } })} />
            </div>
            <p className="hint">
              Extract frame saves the current canvas (effects, stickers & text included) as a photo in your library.
              Export WebM re-renders your exact recipe in real time via MediaRecorder — trim, speed, reverse, effects, overlays and aspect all bake in. Audio export is not included in the web preview.
            </p>
          </div>
        )}
      </div>

      {/* ── tool rail ── */}
      <nav className="editor-rail">
        {(isVideo ? VIDEO_TOOLS : PHOTO_TOOLS).map((toolDef) => (
          <button key={toolDef.id} type="button" className={tool === toolDef.id ? 'on' : ''} onClick={() => { setTool(toolDef.id); setSelected(null); }}>
            <Icon name={toolDef.icon} size={21} />
            <span>{toolDef.label}</span>
          </button>
        ))}
      </nav>

      {textSheet && (
        <Sheet title="Add text" onClose={() => setTextSheet(false)}>
          <div className="field">
            <textarea
              className="text-input" autoFocus rows={2} value={textDraft} placeholder="Type something…"
              onChange={(e) => setTextDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (textDraft.trim()) { addText(textDraft); setTextDraft(''); setTextSheet(false); } } }}
            />
            <div className="panel-row">
              {FONTS.slice(0, 3).map((f) => <span key={f.id} className="font-preview" style={{ fontFamily: f.stack }}>{textDraft || 'Aa'}</span>)}
            </div>
            <button type="button" className="primary-btn" disabled={!textDraft.trim()}
              onClick={() => { addText(textDraft); setTextDraft(''); setTextSheet(false); }}>
              Add
            </button>
          </div>
        </Sheet>
      )}

      {saveOpen && (
        <Sheet title={t('save')} onClose={() => setSaveOpen(false)}>
          <div className="field stack">
            <button type="button" className="primary-btn" onClick={() => { saveEdits(item.id, edits); setSaveOpen(false); closeEditor(); toast('Saved — the original stays safe (non-destructive recipe)'); }}>
              <Icon name="check" size={16} /> {t('save')}
            </button>
            <button type="button" className="ghost-btn" onClick={() => { saveEditCopy(item.id, edits); setSaveOpen(false); closeEditor(); }}>
              <Icon name="copy" size={16} /> {t('save_copy')}
            </button>
            {!isVideo && (
              <button type="button" className="ghost-btn" onClick={() => { doExport(); setSaveOpen(false); }}>
                <Icon name="download" size={16} /> Export {settings.photoEdit.exportFormat.toUpperCase()}{exportScale > 1 ? ` · ${exportScale}×` : ''}
              </button>
            )}
            {isVideo && (
              <button type="button" className="ghost-btn" onClick={() => { setSaveOpen(false); setTool('export'); }}>
                <Icon name="download" size={16} /> Export tools…
              </button>
            )}
            <button type="button" className="ghost-btn danger" onClick={() => { commit(emptyEdit()); toast('Reverted to original'); }}>
              <Icon name="history" size={16} /> Revert to original
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

/* ── video stage wrapper (editor transport) ───────────────────────────── */

function VideoEditorStage({ item, edits, playing, scrubTime, onTime, onCanvas }: {
  item: import('../../data/models').MediaItem;
  edits: EditState;
  playing: boolean;
  scrubTime: number | null;
  onTime: (t: number) => void;
  onCanvas: (c: HTMLCanvasElement) => void;
}) {
  return (
    <VideoStage
      item={item}
      edits={edits}
      playing={playing}
      playerSpeed={1}
      muted={false}
      volume={edits.muted ? 0 : edits.volume}
      loop
      brightness={1}
      timeOverride={scrubTime}
      onTime={onTime}
      onEnd={() => undefined}
      onCanvasReady={onCanvas}
    />
  );
}

/* ── trim timeline (drag handles + playhead) ──────────────────────────── */

function TrimTimeline({ duration, trim, playhead, onTrim, onScrub, onScrubEnd }: {
  duration: number;
  trim: { start: number; end: number };
  playhead: number;
  onTrim: (t: { start: number; end: number }) => void;
  onScrub: (t: number) => void;
  onScrubEnd: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<'in' | 'out' | 'head' | null>(null);
  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return clamp((e.clientX - r.left) / r.width, 0, 1) * duration;
  };
  return (
    <div
      className="trim-timeline"
      ref={ref}
      onPointerDown={(e) => {
        const t = pos(e);
        drag.current = 'head';
        onScrub(t);
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const t = pos(e);
        if (drag.current === 'head') onScrub(t);
        else if (drag.current === 'in') onTrim({ start: Math.min(t, trim.end - 0.3), end: trim.end });
        else onTrim({ start: trim.start, end: Math.max(t, trim.start + 0.3) });
      }}
      onPointerUp={() => { drag.current = null; onScrubEnd(); }}
    >
      <div className="tt-region" style={{ left: `${(trim.start / duration) * 100}%`, width: `${((trim.end - trim.start) / duration) * 100}%` }}>
        <span className="tt-handle in" onPointerDown={(e) => { e.stopPropagation(); drag.current = 'in'; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }} />
        <span className="tt-handle out" onPointerDown={(e) => { e.stopPropagation(); drag.current = 'out'; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }} />
      </div>
      <div className="tt-head" style={{ left: `${(clamp(playhead, trim.start, trim.end) / duration) * 100}%` }} />
      <span className="tt-label l">{formatDuration(trim.start)}</span>
      <span className="tt-label r">{formatDuration(trim.end)}</span>
    </div>
  );
}
