/**
 * LiquidStorageCircle — premium "liquid inside a circular container"
 * storage visualization (§2).
 *
 * Physics-ish, cheap:
 *   • each storage category is a LIQUID BAND stacked by cumulative fill
 *     (bottom band = largest category), each with its own colour
 *   • every surface is the sum of two travelling sine waves with a slow
 *     amplitude wobble → the fluid reads as physically moving
 *   • a specular meniscus rides the top surface, soft glass rim + inner
 *     shading sells the container
 *   • a handful of low-alpha bubbles drift upward inside the liquid
 *
 * Performance budget (§20): ONE small canvas, transform-free 2D draws,
 * rAF paused via IntersectionObserver + document visibility + reduced
 * motion + the app's Animations setting. Never animates off-screen.
 */
import { useEffect, useRef } from 'react';

export interface LiquidSlice {
  id: string;
  label: string;
  color: string;
  bytes: number;
}

interface Props {
  slices: LiquidSlice[];          // bottom of the tank first
  capacityBytes: number;          // total container capacity
  size?: number;
  detailed?: boolean;             // opened Storage section → richer motion + hit-testing
  onSelect?: (id: string) => void;
  animate?: boolean;              // app-level animations setting
  centerLabel?: { value: string; sub: string };
}

interface Bubble { x: number; y: number; r: number; speed: number; wob: number }

export function LiquidStorageCircle({ slices, capacityBytes, size = 200, detailed = false, onSelect, animate = true, centerLabel }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ slices, capacityBytes, detailed, animate });
  stateRef.current = { slices, capacityBytes, detailed, animate };

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d')!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const wantsMotion = animate && !reduced;

    let visible = true;
    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (!visible) running = false;
      else if (wantsMotion && !running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
      else draw(performance.now() / 1000); // static repaint
    }, { threshold: 0.05 });
    io.observe(wrap);
    const onVis = () => {
      if (document.hidden) running = false;
      else if (visible && wantsMotion && !running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
    };
    document.addEventListener('visibilitychange', onVis);

    const bubbles: Bubble[] = Array.from({ length: detailed ? 7 : 4 }, () => ({
      x: 0.2 + Math.random() * 0.6,
      y: Math.random(),
      r: 1 + Math.random() * 2.2,
      speed: 0.02 + Math.random() * 0.045,
      wob: Math.random() * Math.PI * 2,
    }));

    let running = false;
    let raf = 0;
    let last = performance.now();
    let simT = 0;

    function surfaceY(x: number, baseY: number, t: number, amp: number, r: number) {
      // two travelling waves + slow wobble modulation
      const wob = 1 + Math.sin(t * 0.6 + baseY * 0.05) * 0.28;
      const a = amp * wob;
      return baseY
        + Math.sin((x / r) * 2.4 + t * 1.15) * a
        + Math.sin((x / r) * 4.1 - t * 0.72 + 1.7) * a * 0.45;
    }

    function draw(t: number) {
      const { slices: sl, capacityBytes: cap, detailed: det } = stateRef.current;
      const R = size / 2;
      const cx = R, cy = R;
      const rIn = R - 3;
      ctx.clearRect(0, 0, size, size);

      /* container: glass interior */
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, rIn, 0, Math.PI * 2);
      ctx.clip();
      const interior = ctx.createLinearGradient(0, 0, 0, size);
      interior.addColorStop(0, 'rgba(255,255,255,0.07)');
      interior.addColorStop(1, 'rgba(255,255,255,0.02)');
      ctx.fillStyle = interior;
      ctx.fillRect(0, 0, size, size);

      /* stacked liquid bands */
      const total = Math.max(1, sl.reduce((s, x) => s + x.bytes, 0));
      const usedFrac = Math.min(1, total / Math.max(1, cap));
      const fillH = usedFrac * (rIn * 2 - 8);
      const bottom = cy + rIn - 4;
      let acc = 0;
      const bandTops: number[] = [];
      // draw top-most band first; lower bands overpaint the region below their surface
      const bands = sl.map((s) => {
        const frac = s.bytes / Math.max(1, cap);
        const top = bottom - (acc + frac) * (rIn * 2 - 8);
        acc += frac;
        return { s, top };
      }).filter((b) => b.s.bytes > 0);
      for (let i = bands.length - 1; i >= 0; i--) {
        const { s, top } = bands[i];
        bandTops[i] = top;
        const amp = (det ? 2.6 : 1.9) * (i === bands.length - 1 ? 1 : 0.55);
        ctx.beginPath();
        ctx.moveTo(cx - rIn, size);
        for (let x = cx - rIn; x <= cx + rIn; x += 3) {
          ctx.lineTo(x, surfaceY(x, top, t + i * 0.7, amp, rIn));
        }
        ctx.lineTo(cx + rIn, size);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, top, 0, bottom);
        grad.addColorStop(0, s.color);
        grad.addColorStop(1, shade(s.color, -26));
        ctx.fillStyle = grad;
        ctx.globalAlpha = 0.94;
        ctx.fill();
        ctx.globalAlpha = 1;
        // meniscus highlight on the surface
        ctx.beginPath();
        for (let x = cx - rIn; x <= cx + rIn; x += 3) {
          const y = surfaceY(x, top, t + i * 0.7, amp, rIn);
          if (x === cx - rIn) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.34)';
        ctx.lineWidth = i === bands.length - 1 ? 1.6 : 0.9;
        ctx.stroke();
      }

      /* bubbles drifting inside the liquid */
      const topSurface = bands.length ? bands[bands.length - 1].top : bottom;
      for (const b of bubbles) {
        b.y -= b.speed * 0.016 * (wantsMotion ? 1 : 0);
        if (b.y < 0) { b.y = 1; b.x = 0.2 + Math.random() * 0.6; }
        const bx = cx - rIn + b.x * rIn * 2 + Math.sin(t * 1.4 + b.wob) * 3;
        const by = bottom - b.y * (bottom - topSurface);
        if (by > topSurface + 4) {
          ctx.beginPath();
          ctx.arc(bx, by, b.r, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          ctx.fill();
        }
      }

      /* specular glass highlight (static) */
      const spec = ctx.createRadialGradient(cx - rIn * 0.42, cy - rIn * 0.5, 2, cx - rIn * 0.42, cy - rIn * 0.5, rIn * 0.9);
      spec.addColorStop(0, 'rgba(255,255,255,0.20)');
      spec.addColorStop(0.5, 'rgba(255,255,255,0.04)');
      spec.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = spec;
      ctx.fillRect(0, 0, size, size);
      /* inner bottom shade */
      const shadeG = ctx.createLinearGradient(0, size * 0.7, 0, size);
      shadeG.addColorStop(0, 'rgba(0,0,0,0)');
      shadeG.addColorStop(1, 'rgba(0,0,0,0.16)');
      ctx.fillStyle = shadeG;
      ctx.fillRect(0, 0, size, size);
      ctx.restore();

      /* rim */
      ctx.beginPath();
      ctx.arc(cx, cy, rIn + 1.5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, rIn + 3, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 1;
      ctx.stroke();

      void fillH; void bandTops;
    }

    function frame(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!running) return;
      simT += dt;
      draw(simT);
      raf = requestAnimationFrame(frame);
    }

    draw(0);
    if (wantsMotion) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); }

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [size, detailed, animate]);

  const onClick = (e: React.MouseEvent) => {
    if (!onSelect || !detailed) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const R = size / 2;
    const rIn = R - 3;
    const bottom = R + rIn - 4;
    const cap = Math.max(1, stateRef.current.capacityBytes);
    let acc = 0;
    for (const s of stateRef.current.slices) {
      if (s.bytes <= 0) continue;
      acc += s.bytes;
      const top = bottom - (acc / cap) * (rIn * 2 - 8);
      if (y >= top) { onSelect(s.id); return; }
    }
  };

  return (
    <div ref={wrapRef} className={`liquid-storage${detailed ? ' detailed' : ''}`} style={{ width: size, height: size }} onClick={onClick} role={onSelect ? 'button' : undefined} aria-label="Storage liquid visualization">
      <canvas ref={canvasRef} style={{ width: size, height: size }} />
      {centerLabel && (
        <div className="liquid-center">
          <strong>{centerLabel.value}</strong>
          <span>{centerLabel.sub}</span>
        </div>
      )}
    </div>
  );
}

/** darken/lighten a hex colour by `amt` (-100..100) */
function shade(hex: string, amt: number): string {
  const m = hex.replace('#', '');
  const num = parseInt(m.length === 3 ? m.split('').map((c) => c + c).join('') : m, 16);
  let r = (num >> 16) + amt, g = ((num >> 8) & 0xff) + amt, b = (num & 0xff) + amt;
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return `rgb(${r},${g},${b})`;
}
