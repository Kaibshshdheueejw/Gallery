/**
 * VideoStage — the canvas video renderer shared by the Viewer, the video
 * editor and the WebM exporter. The preview library's "videos" are motion
 * clips simulated from stills (Ken-Burns camera motion + an ambient WebAudio
 * bed); the stage applies the FULL non-destructive edit recipe on top, live:
 *
 *   filters/adjustments → video-effect overlays → aspect matte
 *   → timed stickers & text layers
 *
 * Brightness/volume gestures (§13): brightness is a compositing filter on the
 * frame (screen-brightness stand-in for the web preview — the native build
 * drives the real screen API), volume is the WebAudio gain of the bed.
 *
 * Perf: one rAF loop, pre-rendered overlay patterns, zero per-frame
 * allocations beyond draw calls. Loop stops on unmount.
 */
import { useEffect, useRef } from 'react';
import type { EditState, MediaItem, VideoAspect } from '../../data/models';
import { cssFilterFor, drawStickerLayers, drawTextLayers } from '../editor/render';
import { drawEffectOverlay, getEffect } from '../editor/videoEffects';
import { loadImage } from '../../ml/pipelines';

export const ASPECTS: Record<VideoAspect, number | null> = {
  'original': null, '16:9': 16 / 9, '9:16': 9 / 16, '1:1': 1, '4:5': 4 / 5,
};

/**
 * Draws one video frame into ctx (pure function — playback & export share it).
 * `time` is clip time in seconds (post-trim timeline position).
 */
export function drawVideoFrame(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  img: HTMLImageElement,
  item: MediaItem,
  edits: EditState,
  time: number,
  brightness = 1,
) {
  const trim = edits.trim ?? { start: 0, end: item.video?.duration ?? 4 };
  const span = Math.max(0.001, trim.end - trim.start);
  const prog = Math.max(0, Math.min(1, (time - trim.start) / span));
  const motion = item.video?.motion ?? 'zoomIn';
  const effect = getEffect(edits.effectId);

  ctx.clearRect(0, 0, w, h);

  // aspect matte geometry
  const targetAr = ASPECTS[edits.aspect ?? 'original'];
  let vx = 0, vy = 0, vw = w, vh = h;
  if (targetAr) {
    const curAr = w / h;
    if (targetAr < curAr) { vw = h * targetAr; vx = (w - vw) / 2; }
    else { vh = w / targetAr; vy = (h - vh) / 2; }
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(vx, vy, vw, vh);
  ctx.clip();

  // recipe rotate / flip (video editor crop-rotate tool)
  const rot = ((edits.rotate ?? 0) % 360 + 360) % 360;
  const swapped = rot === 90 || rot === 270;
  const boxW = swapped ? vh : vw;
  const boxH = swapped ? vw : vh;
  if (rot || edits.flipH || edits.flipV) {
    ctx.translate(vx + vw / 2, vy + vh / 2);
    if (rot) ctx.rotate((rot * Math.PI) / 180);
    ctx.scale(edits.flipH ? -1 : 1, edits.flipV ? -1 : 1);
    ctx.translate(-(vx + vw / 2), -(vy + vh / 2));
  }

  // Ken-Burns camera motion
  const scaleBase = 1.06;
  let scale = scaleBase, tx = 0, ty = 0;
  switch (motion) {
    case 'zoomIn': scale = scaleBase + prog * 0.22; break;
    case 'zoomOut': scale = scaleBase + 0.22 - prog * 0.22; break;
    case 'panL': tx = (0.5 - prog) * 0.16; break;
    case 'panR': tx = (prog - 0.5) * 0.16; break;
    case 'panU': ty = (prog - 0.5) * 0.16; break;
    case 'panD': ty = (0.5 - prog) * 0.16; break;
  }
  ctx.translate(vx + vw / 2 + tx * boxW, vy + vh / 2 + ty * boxH);
  ctx.scale(scale, scale);
  const ar = img.naturalWidth / img.naturalHeight;
  let dw = boxW, dh = boxH;
  if (ar > boxW / boxH) dw = boxH * ar; else dh = boxW / ar;
  const css = cssFilterFor(item);
  let filter = [effect.css, css].filter(Boolean).join(' ');
  if (brightness !== 1) filter = `${filter} brightness(${brightness.toFixed(3)})`.trim();
  ctx.filter = filter || 'none';
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  ctx.filter = 'none';
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // effect overlay (scanlines / grain / glitch / leaks …)
  if (effect.overlay) {
    ctx.save();
    ctx.beginPath(); ctx.rect(vx, vy, vw, vh); ctx.clip();
    drawEffectOverlay(ctx, w, h, time, effect);
    ctx.restore();
  }

  // timed sticker & text overlays
  const g = { w, h, imgX: vx, imgY: vy, imgW: vw, imgH: vh };
  if (edits.stickers?.length) drawStickerLayers(ctx, edits.stickers, g, time);
  if (edits.texts?.length) drawTextLayers(ctx, edits.texts, g, time);
  ctx.restore();

  // matte bars
  if (targetAr && (vx > 0 || vy > 0)) {
    ctx.fillStyle = '#000';
    if (vx > 0) { ctx.fillRect(0, 0, vx, h); ctx.fillRect(w - vx, 0, vx, h); }
    if (vy > 0) { ctx.fillRect(0, 0, w, vy); ctx.fillRect(0, h - vy, w, vy); }
  }
}

/** effective playback speed = user speed × effect suggestion (slow-mo) */
export function effectiveSpeed(edits: EditState): number {
  const effect = getEffect(edits.effectId);
  return (edits.speed || 1) * (effect.speed ?? 1);
}

/* ── the React stage ──────────────────────────────────────────────────── */

export interface VideoStageProps {
  item: MediaItem;
  edits: EditState;
  playing: boolean;
  /** extra speed multiplier from the player UI (viewer speed control) */
  playerSpeed: number;
  muted: boolean;      // player-level mute (gesture/toggle) — edits.muted is separate
  volume: number;      // 0..100 player volume (gesture target)
  loop: boolean;
  brightness: number;  // 0.3..1.7 gesture overlay (1 = neutral)
  /** when set, shows this exact time without self-advancing (editor scrubbing) */
  timeOverride?: number | null;
  onTime: (t: number) => void;
  onEnd: () => void;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
}

export function VideoStage(props: VideoStageProps) {
  const { item, edits, muted, volume, brightness, timeOverride, onCanvasReady } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const trim = edits.trim ?? { start: 0, end: item.video?.duration ?? 4 };
  const timeRef = useRef(edits.reverse ? trim.end : trim.start);
  const audioRef = useRef<{ ctx: AudioContext; gain: GainNode } | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => { loadImage(item.src).then((img) => { imgRef.current = img; }); }, [item]);
  useEffect(() => {
    timeRef.current = edits.reverse ? (edits.trim?.end ?? item.video?.duration ?? 4) : (edits.trim?.start ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);
  useEffect(() => { if (canvasRef.current) onCanvasReady?.(canvasRef.current); }, [onCanvasReady]);

  /* ambient audio bed with real gain control (volume gesture target) */
  const wantAudio = props.playing && !muted && !edits.muted && volume > 0 && timeOverride == null;
  useEffect(() => {
    if (!wantAudio) { audioRef.current?.ctx.suspend(); return; }
    if (!audioRef.current) {
      const ctx = new AudioContext();
      const seconds = 2;
      const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
      const ch = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < ch.length; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        ch[i] = last * 3.2;
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer; src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 900;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start();
      audioRef.current = { ctx, gain };
    }
    audioRef.current.ctx.resume();
    audioRef.current.gain.gain.value = (volume / 100) * ((edits.volume ?? 70) / 100) * 0.16;
    return () => { audioRef.current?.ctx.suspend(); };
  }, [wantAudio, volume, edits.volume, edits.muted]);

  /* the render loop */
  useEffect(() => {
    let raf = 0;
    let prev = performance.now();
    const loopFn = (now: number) => {
      const p = propsRef.current;
      const dt = (now - prev) / 1000;
      prev = now;
      const e = p.edits;
      const tr = e.trim ?? { start: 0, end: p.item.video?.duration ?? 4 };
      if (p.timeOverride == null && p.playing) {
        const dir = e.reverse ? -1 : 1;
        timeRef.current += dt * effectiveSpeed(e) * p.playerSpeed * dir;
        if (dir > 0 && timeRef.current > tr.end) {
          if (p.loop) timeRef.current = tr.start;
          else { timeRef.current = tr.end; p.onEnd(); }
        }
        if (dir < 0 && timeRef.current < tr.start) {
          if (p.loop) timeRef.current = tr.end;
          else { timeRef.current = tr.start; p.onEnd(); }
        }
        p.onTime(timeRef.current);
      } else if (p.timeOverride != null) {
        timeRef.current = p.timeOverride;
      }
      const canvas = canvasRef.current;
      const img = imgRef.current;
      if (canvas && img) {
        drawVideoFrame(canvas.getContext('2d')!, canvas.width, canvas.height, img, p.item, e, timeRef.current, p.brightness);
      }
      raf = requestAnimationFrame(loopFn);
    };
    raf = requestAnimationFrame(loopFn);
    return () => cancelAnimationFrame(raf);
  }, []);

  void brightness;
  return <canvas ref={canvasRef} width={1280} height={720} className="video-canvas" />;
}
