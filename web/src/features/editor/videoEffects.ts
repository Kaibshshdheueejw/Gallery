/**
 * Built-in video effect presets — organised by category, applied live in the
 * canvas player and baked into WebM exports.
 *
 * Each effect = a CSS filter chain (cheap, GPU-composited) + an optional
 * per-frame canvas overlay (scanlines, grain, light leaks, glitch slices,
 * letterbox). Overlays pre-render their static patterns ONCE into offscreen
 * canvases so playback stays smooth on mid-range hardware.
 */

export type EffectOverlay = 'scanlines' | 'grain' | 'leak' | 'glitch' | 'bloom' | 'bars' | 'vignette' | 'flicker';

export interface VideoEffect {
  id: string;
  label: string;
  cat: 'cinematic' | 'retro' | 'stylised' | 'mood' | 'time';
  css: string;                       // ctx.filter chain
  overlay?: EffectOverlay;
  speed?: number;                    // suggested playback speed (slow-mo etc.)
  animated?: boolean;                // overlay changes per frame
}

export const VIDEO_EFFECTS: VideoEffect[] = [
  { id: 'none', label: 'Original', cat: 'cinematic', css: '' },
  /* cinematic */
  { id: 'cinematic', label: 'Cinematic', cat: 'cinematic', css: 'contrast(1.14) saturate(1.12) brightness(0.97) sepia(0.12) hue-rotate(-8deg)', overlay: 'bars' },
  { id: 'tealorange', label: 'Teal & Orange', cat: 'cinematic', css: 'contrast(1.16) saturate(1.3) sepia(0.22) hue-rotate(-12deg)' },
  { id: 'dramatic', label: 'Dramatic', cat: 'cinematic', css: 'contrast(1.35) brightness(0.92) saturate(0.9)', overlay: 'vignette' },
  /* retro */
  { id: 'vhs', label: 'VHS', cat: 'retro', css: 'saturate(1.4) contrast(1.1) hue-rotate(-6deg) blur(0.3px)', overlay: 'scanlines', animated: true },
  { id: 'vintage', label: 'Vintage', cat: 'retro', css: 'sepia(0.42) contrast(0.94) brightness(1.06) saturate(0.85)', overlay: 'grain', animated: true },
  { id: 'film', label: 'Film 35mm', cat: 'retro', css: 'contrast(1.08) saturate(1.05) brightness(1.02)', overlay: 'grain', animated: true },
  { id: 'retro', label: 'Retro', cat: 'retro', css: 'sepia(0.3) saturate(1.35) contrast(1.05) hue-rotate(-14deg)', overlay: 'leak', animated: true },
  { id: 'polaroid', label: 'Polaroid', cat: 'retro', css: 'sepia(0.2) brightness(1.12) contrast(0.88) saturate(0.8)' },
  /* stylised */
  { id: 'glitch', label: 'Glitch', cat: 'stylised', css: 'contrast(1.2) saturate(1.5)', overlay: 'glitch', animated: true },
  { id: 'noir', label: 'Noir', cat: 'stylised', css: 'grayscale(1) contrast(1.4) brightness(0.95)', overlay: 'vignette' },
  { id: 'bw', label: 'Black & White', cat: 'stylised', css: 'grayscale(1) contrast(1.1)' },
  { id: 'bloom', label: 'Bloom', cat: 'stylised', css: 'brightness(1.1) saturate(1.15) blur(0.4px)', overlay: 'bloom' },
  { id: 'dream', label: 'Dreamy', cat: 'stylised', css: 'brightness(1.08) saturate(1.2) blur(0.6px) contrast(0.94)', overlay: 'leak', animated: true },
  /* mood */
  { id: 'lightleak', label: 'Light leak', cat: 'mood', css: 'saturate(1.15) brightness(1.03)', overlay: 'leak', animated: true },
  { id: 'warmglow', label: 'Warm glow', cat: 'mood', css: 'sepia(0.25) saturate(1.25) brightness(1.05)' },
  { id: 'coldnight', label: 'Cold night', cat: 'mood', css: 'hue-rotate(14deg) saturate(0.85) brightness(0.9) contrast(1.2)', overlay: 'vignette' },
  { id: 'faded', label: 'Faded', cat: 'mood', css: 'contrast(0.82) brightness(1.1) saturate(0.72)', overlay: 'flicker', animated: true },
  /* time */
  { id: 'slowmo', label: 'Slow motion', cat: 'time', css: 'saturate(1.08)', speed: 0.4 },
  { id: 'slowmo2', label: 'Ultra slow-mo', cat: 'time', css: 'saturate(1.08) contrast(1.05)', speed: 0.25 },
];

export const EFFECT_CATEGORIES: Array<{ id: VideoEffect['cat']; label: string }> = [
  { id: 'cinematic', label: 'Cinematic' },
  { id: 'retro', label: 'Retro & Film' },
  { id: 'stylised', label: 'Stylised' },
  { id: 'mood', label: 'Mood' },
  { id: 'time', label: 'Time' },
];

export const getEffect = (id: string): VideoEffect => VIDEO_EFFECTS.find((e) => e.id === id) ?? VIDEO_EFFECTS[0];

/* ── pre-rendered overlay patterns (built once, reused every frame) ───── */

let scanPattern: HTMLCanvasElement | null = null;
let grainFrames: HTMLCanvasElement[] | null = null;
let leakGradient: HTMLCanvasElement | null = null;

function ensurePatterns(w: number, h: number) {
  if (!scanPattern) {
    scanPattern = document.createElement('canvas');
    scanPattern.width = 4; scanPattern.height = 4;
    const c = scanPattern.getContext('2d')!;
    c.fillStyle = 'rgba(0,0,0,0.22)';
    c.fillRect(0, 0, 4, 2);
    c.fillStyle = 'rgba(255,255,255,0.03)';
    c.fillRect(0, 2, 4, 1);
  }
  if (!grainFrames) {
    grainFrames = [];
    for (let f = 0; f < 6; f++) {
      const g = document.createElement('canvas');
      g.width = 160; g.height = 160;
      const gc = g.getContext('2d')!;
      const img = gc.createImageData(160, 160);
      for (let i = 0; i < img.data.length; i += 4) {
        const n = 128 + (Math.random() - 0.5) * 90;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = n;
        img.data[i + 3] = 26;
      }
      gc.putImageData(img, 0, 0);
      grainFrames.push(g);
    }
  }
  if (!leakGradient) {
    leakGradient = document.createElement('canvas');
    leakGradient.width = 256; leakGradient.height = 256;
    const lc = leakGradient.getContext('2d')!;
    const grad = lc.createRadialGradient(40, 210, 10, 40, 210, 240);
    grad.addColorStop(0, 'rgba(255,170,80,0.5)');
    grad.addColorStop(0.45, 'rgba(255,110,60,0.18)');
    grad.addColorStop(1, 'rgba(255,90,40,0)');
    lc.fillStyle = grad;
    lc.fillRect(0, 0, 256, 256);
  }
  void w; void h;
}

/**
 * Draws an effect overlay onto the video canvas. `t` = clip time in seconds.
 * All patterns are pre-rendered; per-frame work is a handful of drawImage /
 * fillRect calls — safe for 60 fps playback on mid-range devices.
 */
export function drawEffectOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, effect: VideoEffect) {
  if (!effect.overlay) return;
  ensurePatterns(w, h);
  ctx.save();
  switch (effect.overlay) {
    case 'scanlines': {
      const pat = ctx.createPattern(scanPattern!, 'repeat')!;
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = pat;
      ctx.translate(0, (t * 24) % 4); // slow roll
      ctx.fillRect(0, -4, w, h + 8);
      // tracking wobble band
      const bandY = ((t * 0.22) % 1.2 - 0.1) * h;
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, bandY, w, h * 0.02);
      break;
    }
    case 'grain': {
      const frame = grainFrames![Math.floor(t * 12) % grainFrames!.length];
      ctx.globalAlpha = 0.5;
      const pat = ctx.createPattern(frame, 'repeat')!;
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, w, h);
      break;
    }
    case 'leak': {
      const drift = 0.5 + Math.sin(t * 0.5) * 0.28;
      ctx.globalAlpha = 0.5;
      ctx.globalCompositeOperation = 'screen';
      ctx.drawImage(leakGradient!, w * drift - w * 0.3, -h * 0.1, w * 0.9, h * 0.9);
      break;
    }
    case 'glitch': {
      // slice-offset bursts every ~0.9s
      const phase = (t * 1.1) % 1;
      if (phase < 0.16) {
        const slices = 5;
        for (let i = 0; i < slices; i++) {
          const sy = Math.random() * h;
          const sh = 6 + Math.random() * (h * 0.06);
          const dx = (Math.random() - 0.5) * w * 0.09;
          ctx.drawImage(ctx.canvas, 0, sy, w, sh, dx, sy, w, sh);
        }
        ctx.globalAlpha = 0.14;
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = '#0ff';
        ctx.fillRect(0, Math.random() * h, w, 2 + Math.random() * 6);
        ctx.fillStyle = '#f0f';
        ctx.fillRect(0, Math.random() * h, w, 1 + Math.random() * 4);
      }
      break;
    }
    case 'bloom': {
      ctx.globalAlpha = 0.12;
      ctx.globalCompositeOperation = 'screen';
      ctx.filter = 'blur(14px)';
      ctx.drawImage(ctx.canvas, 0, 0);
      ctx.filter = 'none';
      break;
    }
    case 'bars': {
      const bar = Math.round(h * 0.085);
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, bar);
      ctx.fillRect(0, h - bar, w, bar);
      break;
    }
    case 'vignette': {
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.38, w / 2, h / 2, Math.max(w, h) * 0.72);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.42)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      break;
    }
    case 'flicker': {
      ctx.globalAlpha = 0.03 + Math.abs(Math.sin(t * 9)) * 0.05;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      break;
    }
  }
  ctx.restore();
}
