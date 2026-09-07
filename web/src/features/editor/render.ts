/**
 * Non-destructive edit pipeline.
 * Thumbnails use a cheap CSS approximation; the viewer / editor / exporter run
 * the full canvas pipeline (crop → rotate → filters → adjust → enhance →
 * magic-eraser inpaint → portrait blur → vignette → markup).
 */
import type { EditState, MediaItem } from '../../data/models';

export interface FilterPreset { id: string; label: string; css: string; adjust?: Partial<EditState['adjust']> }

export const FILTERS: FilterPreset[] = [
  { id: 'original', label: 'Original', css: '' },
  { id: 'vivid', label: 'Vivid', css: 'saturate(1.35) contrast(1.12)' },
  { id: 'warm', label: 'Warm', css: 'sepia(0.28) saturate(1.2) brightness(1.04)' },
  { id: 'cool', label: 'Cool', css: 'hue-rotate(-12deg) saturate(1.1) brightness(1.02)' },
  { id: 'mono', label: 'Mono', css: 'grayscale(1) contrast(1.08)' },
  { id: 'noir', label: 'Noir', css: 'grayscale(1) contrast(1.45) brightness(0.92)' },
  { id: 'fade', label: 'Fade', css: 'contrast(0.82) brightness(1.12) saturate(0.75)' },
  { id: 'cinema', label: 'Cinema', css: 'contrast(1.18) saturate(1.15) hue-rotate(-8deg) brightness(0.96)' },
  { id: 'bloom', label: 'Bloom', css: 'brightness(1.1) saturate(1.1) blur(0.4px)' },
];

export const filterPreset = (id: string) => FILTERS.find((f) => f.id === id) ?? FILTERS[0];

/** Cheap CSS approximation for grid thumbnails. */
export function cssFilterFor(item: MediaItem): string {
  const e = item.edits;
  const preset = filterPreset(e.filterId);
  const a = e.adjust;
  const parts: string[] = [];
  if (preset.css) parts.push(preset.css);
  if (a.brightness) parts.push(`brightness(${(1 + a.brightness / 220).toFixed(3)})`);
  if (a.contrast) parts.push(`contrast(${(1 + a.contrast / 220).toFixed(3)})`);
  if (a.saturation) parts.push(`saturate(${(1 + a.saturation / 160).toFixed(3)})`);
  if (a.warmth) parts.push(`sepia(${Math.min(0.5, Math.abs(a.warmth) / 160).toFixed(3)})`);
  if (a.blur) parts.push(`blur(${(a.blur / 6).toFixed(2)}px)`);
  if (e.enhanced) parts.push('contrast(1.08) saturate(1.1) brightness(1.05)');
  return parts.join(' ');
}

export function cssTransformFor(item: MediaItem): string {
  const e = item.edits;
  const parts: string[] = [];
  if (e.rotate) parts.push(`rotate(${e.rotate}deg)`);
  if (e.flipH) parts.push('scaleX(-1)');
  if (e.flipV) parts.push('scaleY(-1)');
  return parts.join(' ');
}

export function isEdited(item: MediaItem): boolean {
  const e = item.edits;
  return Boolean(
    e.rotate || e.flipH || e.flipV || e.crop || e.filterId !== 'original' || e.enhanced ||
    e.erased.length || e.portraitBlur || e.markup.length || e.trim ||
    Object.values(e.adjust).some((v) => v !== 0),
  );
}

interface Ctx2D extends CanvasRenderingContext2D {}

function enhanceDelta(item: MediaItem): { b: number; c: number; s: number } {
  const v = item.vision;
  if (!v) return { b: 8, c: 10, s: 10 };
  const b = Math.max(-18, Math.min(22, (0.52 - v.brightness) * 70));
  const c = Math.max(0, 16 - v.saturation * 10);
  const s = Math.max(0, 14 - v.saturation * 12);
  return { b, c, s };
}

function drawSharpen(ctx: Ctx2D, w: number, h: number, amount: number) {
  if (amount <= 0) return;
  const src = ctx.getImageData(0, 0, w, h);
  const out = ctx.createImageData(w, h);
  const d = src.data, o = out.data;
  const k = amount / 100;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const lap = 4 * d[i + c] - d[i - 4 + c] - d[i + 4 + c] - d[i - w * 4 + c] - d[i + w * 4 + c];
        o[i + c] = Math.max(0, Math.min(255, d[i + c] + k * 0.6 * lap));
      }
      o[i + 3] = d[i + 3];
    }
  }
  // edges untouched → copy
  for (let x = 0; x < w; x++) {
    for (const y of [0, h - 1]) {
      const i = (y * w + x) * 4;
      o[i] = d[i]; o[i + 1] = d[i + 1]; o[i + 2] = d[i + 2]; o[i + 3] = d[i + 3];
    }
  }
  for (let y = 0; y < h; y++) {
    for (const x of [0, w - 1]) {
      const i = (y * w + x) * 4;
      o[i] = d[i]; o[i + 1] = d[i + 1]; o[i + 2] = d[i + 2]; o[i + 3] = d[i + 3];
    }
  }
  ctx.putImageData(out, 0, 0);
}

export interface RenderOptions { maxDim?: number; includeMarkup?: boolean }

export function computeOutputSize(item: MediaItem, edits: EditState, maxDim: number): { w: number; h: number } {
  const rotated = edits.rotate === 90 || edits.rotate === 270;
  let w = rotated ? item.h : item.w;
  let h = rotated ? item.w : item.h;
  if (edits.crop) {
    const baseW = rotated ? item.h : item.w;
    const baseH = rotated ? item.w : item.h;
    w = baseW * edits.crop.w;
    h = baseH * edits.crop.h;
  }
  const scale = Math.min(1, maxDim / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
}

export async function renderEdited(img: HTMLImageElement, item: MediaItem, edits: EditState, opts: RenderOptions = {}): Promise<HTMLCanvasElement> {
  const maxDim = opts.maxDim ?? 1600;
  const includeMarkup = opts.includeMarkup ?? true;
  const { w: outW, h: outH } = computeOutputSize(item, edits, maxDim);
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d')!;

  // source rect (crop is applied pre-rotation, in original orientation)
  const crop = edits.crop ?? { x: 0, y: 0, w: 1, h: 1 };
  const sx = img.naturalWidth * crop.x;
  const sy = img.naturalHeight * crop.y;
  const sw = img.naturalWidth * crop.w;
  const sh = img.naturalHeight * crop.h;

  ctx.save();
  ctx.translate(outW / 2, outH / 2);
  ctx.rotate((edits.rotate * Math.PI) / 180);
  ctx.scale(edits.flipH ? -1 : 1, edits.flipV ? -1 : 1);
  const dw = edits.rotate % 180 === 0 ? outW : outH;
  const dh = edits.rotate % 180 === 0 ? outH : outW;
  ctx.drawImage(img, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();

  // filters + adjustments
  const preset = filterPreset(edits.filterId);
  const a = { ...edits.adjust };
  if (edits.enhanced) {
    const d = enhanceDelta(item);
    a.brightness += d.b; a.contrast += d.c; a.saturation += d.s;
  }
  const filterParts: string[] = [];
  if (preset.css) filterParts.push(preset.css);
  if (a.brightness) filterParts.push(`brightness(${(1 + a.brightness / 220).toFixed(3)})`);
  if (a.contrast) filterParts.push(`contrast(${(1 + a.contrast / 220).toFixed(3)})`);
  if (a.saturation) filterParts.push(`saturate(${(1 + a.saturation / 160).toFixed(3)})`);
  if (a.blur) filterParts.push(`blur(${(a.blur / 6).toFixed(2)}px)`);
  if (filterParts.length) {
    const snap = document.createElement('canvas');
    snap.width = outW; snap.height = outH;
    snap.getContext('2d')!.drawImage(canvas, 0, 0);
    ctx.save();
    ctx.filter = filterParts.join(' ');
    ctx.clearRect(0, 0, outW, outH);
    ctx.drawImage(snap, 0, 0);
    ctx.restore();
  }
  // warmth tint
  if (a.warmth) {
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = Math.min(0.55, Math.abs(a.warmth) / 130);
    ctx.fillStyle = a.warmth > 0 ? '#ff9a3c' : '#4aa3ff';
    ctx.fillRect(0, 0, outW, outH);
    ctx.restore();
  }
  if (a.sharpen) drawSharpen(ctx, outW, outH, a.sharpen);

  // magic eraser: blur-fill inpaint dabs
  if (edits.erased.length) {
    const snap = document.createElement('canvas');
    snap.width = outW; snap.height = outH;
    snap.getContext('2d')!.drawImage(canvas, 0, 0);
    for (const dab of edits.erased) {
      const r = dab.r * outW;
      ctx.save();
      ctx.beginPath();
      ctx.arc(dab.x * outW, dab.y * outH, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.filter = 'blur(16px)';
      ctx.drawImage(snap, -outW * 0.02, -outH * 0.02, outW * 1.04, outH * 1.04);
      ctx.restore();
    }
  }

  // portrait blur: blurred everywhere except a soft centre subject mask
  if (edits.portraitBlur > 0) {
    const blurred = document.createElement('canvas');
    blurred.width = outW; blurred.height = outH;
    const bctx = blurred.getContext('2d')!;
    bctx.filter = `blur(${edits.portraitBlur}px)`;
    bctx.drawImage(canvas, 0, 0);
    const sharp = document.createElement('canvas');
    sharp.width = outW; sharp.height = outH;
    const sctx = sharp.getContext('2d')!;
    sctx.drawImage(canvas, 0, 0);
    sctx.globalCompositeOperation = 'destination-in';
    const g = sctx.createRadialGradient(outW / 2, outH * 0.46, Math.min(outW, outH) * 0.12, outW / 2, outH * 0.46, Math.min(outW, outH) * 0.46);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.75, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    sctx.fillStyle = g;
    sctx.fillRect(0, 0, outW, outH);
    ctx.clearRect(0, 0, outW, outH);
    ctx.drawImage(blurred, 0, 0);
    ctx.drawImage(sharp, 0, 0);
  }

  // vignette
  if (a.vignette > 0) {
    const g = ctx.createRadialGradient(outW / 2, outH / 2, Math.min(outW, outH) * 0.35, outW / 2, outH / 2, Math.max(outW, outH) * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${Math.min(0.85, a.vignette / 110)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, outW, outH);
  }

  if (includeMarkup && edits.markup.length) drawMarkup(ctx, edits, outW, outH);
  return canvas;
}

export function drawMarkup(ctx: Ctx2D, edits: EditState, w: number, h: number) {
  for (const s of edits.markup) {
    ctx.save();
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineWidth = Math.max(1.5, (s.width / 100) * Math.min(w, h) * 0.06);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const pts = s.points.map((p) => ({ x: p.x * w, y: p.y * h }));
    if (!pts.length) { ctx.restore(); continue; }
    switch (s.tool) {
      case 'pen': {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
        ctx.stroke();
        break;
      }
      case 'line': {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.stroke();
        break;
      }
      case 'arrow': {
        const a0 = pts[0], a1 = pts[pts.length - 1];
        ctx.beginPath();
        ctx.moveTo(a0.x, a0.y);
        ctx.lineTo(a1.x, a1.y);
        ctx.stroke();
        const ang = Math.atan2(a1.y - a0.y, a1.x - a0.x);
        const hl = ctx.lineWidth * 3.2;
        ctx.beginPath();
        ctx.moveTo(a1.x, a1.y);
        ctx.lineTo(a1.x - hl * Math.cos(ang - 0.45), a1.y - hl * Math.sin(ang - 0.45));
        ctx.lineTo(a1.x - hl * Math.cos(ang + 0.45), a1.y - hl * Math.sin(ang + 0.45));
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'rect': {
        const p0 = pts[0], p1 = pts[pts.length - 1];
        ctx.strokeRect(Math.min(p0.x, p1.x), Math.min(p0.y, p1.y), Math.abs(p1.x - p0.x), Math.abs(p1.y - p0.y));
        break;
      }
      case 'ellipse': {
        const p0 = pts[0], p1 = pts[pts.length - 1];
        ctx.beginPath();
        ctx.ellipse((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, Math.abs(p1.x - p0.x) / 2, Math.abs(p1.y - p0.y) / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'text': {
        const size = Math.max(14, (s.width / 100) * Math.min(w, h) * 0.16);
        ctx.font = `600 ${size}px system-ui, sans-serif`;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = size * 0.25;
        ctx.fillText(s.text ?? '', pts[0].x, pts[0].y);
        break;
      }
    }
    ctx.restore();
  }
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), type, quality);
  });
}
