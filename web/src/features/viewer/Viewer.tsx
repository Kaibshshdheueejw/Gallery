import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  closeViewer, openViewer, openEditor, openShare, saveEdits, setFavorite, setLocked,
  toast, trashItems, useApp,
} from '../../store';
import { renderEdited } from '../editor/render';
import { loadImage } from '../../ml/pipelines';
import { cssFilterFor } from '../editor/render';
import { IconButton, Sheet } from '../../components/ui';
import { Icon } from '../../core/icons';
import { translate } from '../../core/i18n';
import { formatBytes, formatDateLong, formatDuration, formatTime, relativeTime } from '../../core/utils';
import type { EditState, MediaItem } from '../../data/models';

/* ── canvas stage for edited photos / screenshots ─────────────────────── */
function PhotoStage({ item, showFaces }: { item: MediaItem; showFaces: boolean }) {
  const holder = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    (async () => {
      try {
        const img = await loadImage(item.src);
        const canvas = await renderEdited(img, item, item.edits, { maxDim: 1600 });
        if (cancelled || !holder.current) return;
        holder.current.replaceChildren(canvas);
        if (showFaces && item.faces?.length) {
          const overlay = document.createElement('div');
          overlay.className = 'face-overlay';
          for (const f of item.faces) {
            const box = document.createElement('span');
            box.style.left = `${f.x * 100}%`;
            box.style.top = `${f.y * 100}%`;
            box.style.width = `${f.w * 100}%`;
            box.style.height = `${f.h * 100}%`;
            overlay.appendChild(box);
          }
          holder.current.appendChild(overlay);
        }
        setBusy(false);
      } catch {
        setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [item, showFaces]);

  return (
    <div className="stage" ref={holder}>
      {busy && <span className="stage-busy"><Icon name="sparkle" size={26} className="spin-slow" /></span>}
    </div>
  );
}

/* ── simulated video playback (Ken-Burns motion + ambient audio) ──────── */
function VideoStage({ item, playing, speed, muted, trim, onTime }: {
  item: MediaItem; playing: boolean; speed: number; muted: boolean;
  trim: { start: number; end: number }; onTime: (t: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const timeRef = useRef(trim.start);
  const audioRef = useRef<{ ctx: AudioContext; gain: GainNode } | null>(null);

  useEffect(() => { loadImage(item.src).then((img) => { imgRef.current = img; }); }, [item]);

  // ambient audio bed so "mute" is meaningful
  useEffect(() => {
    if (!playing) { audioRef.current?.ctx.suspend(); return; }
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
      gain.gain.value = muted ? 0 : 0.12;
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start();
      audioRef.current = { ctx, gain };
    }
    audioRef.current.ctx.resume();
    audioRef.current.gain.gain.value = muted ? 0 : 0.12;
    return () => { audioRef.current?.ctx.suspend(); };
  }, [playing, muted]);

  useEffect(() => {
    let raf = 0;
    let prev = performance.now();
    const loop = (now: number) => {
      const dt = (now - prev) / 1000;
      prev = now;
      if (playing) {
        timeRef.current += dt * speed;
        if (timeRef.current > trim.end) timeRef.current = trim.start;
        onTime(timeRef.current);
      }
      const canvas = canvasRef.current;
      const img = imgRef.current;
      if (canvas && img) {
        const ctx = canvas.getContext('2d')!;
        const w = canvas.width, h = canvas.height;
        const span = Math.max(0.001, trim.end - trim.start);
        const p = Math.max(0, Math.min(1, (timeRef.current - trim.start) / span));
        const motion = item.video?.motion ?? 'zoomIn';
        ctx.clearRect(0, 0, w, h);
        ctx.save();
        const scaleBase = 1.06;
        let scale = scaleBase, tx = 0, ty = 0;
        switch (motion) {
          case 'zoomIn': scale = scaleBase + p * 0.22; break;
          case 'zoomOut': scale = scaleBase + 0.22 - p * 0.22; break;
          case 'panL': tx = (0.5 - p) * 0.16; break;
          case 'panR': tx = (p - 0.5) * 0.16; break;
          case 'panU': ty = (p - 0.5) * 0.16; break;
          case 'panD': ty = (0.5 - p) * 0.16; break;
        }
        ctx.translate(w / 2 + tx * w, h / 2 + ty * h);
        ctx.scale(scale, scale);
        const ar = img.naturalWidth / img.naturalHeight;
        let dw = w, dh = h;
        if (ar > w / h) dw = h * ar; else dh = w / ar;
        ctx.filter = cssFilterFor(item) || 'none';
        ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
        ctx.restore();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, trim, item, onTime]);

  return <canvas ref={canvasRef} width={1280} height={720} className="video-canvas" />;
}

/* ── viewer shell ─────────────────────────────────────────────────────── */
export function Viewer() {
  const app = useApp();
  const viewer = app.viewer;
  const { settings, items } = app;
  const t = (k: string) => translate(settings.lang, k);
  const item = viewer ? items.find((i) => i.id === viewer.ids[viewer.index]) : undefined;

  const [chrome, setChrome] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [infoOpen, setInfoOpen] = useState(false);
  const [showFaces, setShowFaces] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [time, setTime] = useState(0);
  const [trimEdit, setTrimEdit] = useState(false);
  const drag = useRef<{ x: number; y: number; panX: number; panY: number; moved: boolean } | null>(null);

  const resetView = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, []);

  useEffect(() => { resetView(); setChrome(true); setPlaying(true); setTime(item?.edits.trim?.start ?? 0); }, [viewer?.index, resetView, item?.id]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!viewer) return;
      if (e.key === 'Escape') closeViewer();
      if (e.key === 'ArrowRight') openViewer(viewer.ids, Math.min(viewer.ids.length - 1, viewer.index + 1));
      if (e.key === 'ArrowLeft') openViewer(viewer.ids, Math.max(0, viewer.index - 1));
      if (e.key === ' ') { e.preventDefault(); setPlaying((p) => !p); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [viewer]);

  const go = (delta: number) => {
    if (!viewer) return;
    const next = viewer.index + delta;
    if (next >= 0 && next < viewer.ids.length) openViewer(viewer.ids, next);
  };

  const onWheel = (e: React.WheelEvent) => {
    setZoom((z) => Math.max(1, Math.min(6, z - e.deltaY * 0.0022)));
  };
  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    if (Math.hypot(dx, dy) > 6) drag.current.moved = true;
    if (zoom > 1) setPan({ x: drag.current.panX + dx, y: drag.current.panY + dy });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || !viewer) return;
    const dx = e.clientX - d.x;
    if (!d.moved) { setChrome((c) => !c); return; }
    if (zoom === 1 && Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
  };
  const doubleClick = (e: React.MouseEvent) => {
    if (zoom > 1) resetView();
    else { setZoom(2.6); setPan({ x: (window.innerWidth / 2 - e.clientX) * 0.8, y: (window.innerHeight / 2 - e.clientY) * 0.8 }); }
  };

  if (!viewer || !item) return null;

  const duration = item.video?.duration ?? 0;
  const trim = item.edits.trim ?? { start: 0, end: duration };
  const isVideo = item.kind === 'video';
  const names = (item.personIds ?? []).map((pid) => app.faceNames[pid] ?? pid);

  return (
    <div className="viewer">
      <div
        className="viewer-stage"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={doubleClick}
      >
        <div className="zoom-wrap" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
          {isVideo
            ? <VideoStage item={item} playing={playing} speed={speed} muted={muted} trim={trim} onTime={setTime} />
            : <PhotoStage item={item} showFaces={showFaces} />}
        </div>
      </div>

      <header className={`viewer-bar top${chrome ? '' : ' hide'}`}>
        <IconButton icon="back" label="Close" onClick={closeViewer} />
        <div className="grow">
          <strong>{item.title}</strong>
          <span>{formatDateLong(item.takenAt)} · {formatTime(item.takenAt)}</span>
        </div>
        <IconButton icon="heart" label={t('favorite')} filled={item.favorite} onClick={() => setFavorite([item.id], !item.favorite)} />
        <IconButton icon="info" label={t('info')} onClick={() => setInfoOpen(true)} />
      </header>

      {isVideo && (
        <div className={`video-controls${chrome ? '' : ' hide'}`}>
          <div className="vc-row">
            <IconButton icon={playing ? 'pause' : 'play'} label={playing ? 'Pause' : 'Play'} filled={!playing} onClick={() => setPlaying((p) => !p)} />
            <span className="time">{formatDuration(time - trim.start)} / {formatDuration(trim.end - trim.start)}</span>
            <input
              type="range"
              className="grow"
              min={trim.start}
              max={trim.end}
              step={0.05}
              value={Math.min(Math.max(time, trim.start), trim.end)}
              onChange={(e) => setTime(Number(e.target.value))}
            />
            <IconButton icon={muted ? 'volumeOff' : 'volume'} label={muted ? 'Unmute' : 'Mute'} onClick={() => setMuted((m) => !m)} />
            <button type="button" className="speed-pill" onClick={() => setSpeed((s) => (s === 1 ? 1.5 : s === 1.5 ? 2 : s === 2 ? 0.5 : s === 0.5 ? 0.25 : 1))}>
              {speed}×
            </button>
          </div>
          <div className="vc-row">
            <button type="button" className={`ghost-btn${trimEdit ? ' on' : ''}`} onClick={() => setTrimEdit((v) => !v)}>
              <Icon name="scissors" size={14} /> Trim
            </button>
            {trimEdit && (
              <>
                <label className="trim-field">In {formatDuration(trim.start)}
                  <input type="range" min={0} max={duration} step={0.1} value={trim.start} onChange={(e) => {
                    const v = Math.min(Number(e.target.value), trim.end - 0.5);
                    saveEdits(item.id, { ...item.edits, trim: { ...trim, start: v } });
                  }} />
                </label>
                <label className="trim-field">Out {formatDuration(trim.end)}
                  <input type="range" min={0} max={duration} step={0.1} value={trim.end} onChange={(e) => {
                    const v = Math.max(Number(e.target.value), trim.start + 0.5);
                    saveEdits(item.id, { ...item.edits, trim: { ...trim, end: v } });
                  }} />
                </label>
                <button type="button" className="ghost-btn" onClick={() => { saveEdits(item.id, { ...item.edits, trim: null }); toast('Trim reset'); }}>
                  <Icon name="restore" size={14} /> Reset
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <footer className={`viewer-bar bottom${chrome ? '' : ' hide'}`}>
        <IconButton icon="share" label={t('share')} onClick={() => openShare([item.id])} />
        <IconButton icon="edit" label={t('edit')} onClick={() => openEditor(item.id)} />
        <IconButton icon="heart" label={t('favorite')} filled={item.favorite} onClick={() => setFavorite([item.id], !item.favorite)} />
        <IconButton icon={item.locked ? 'lockOpen' : 'lock'} label={t('lock')} onClick={() => setLocked([item.id], !item.locked)} />
        <IconButton icon="trash" label={t('delete')} onClick={() => { trashItems([item.id]); closeViewer(); }} />
      </footer>

      {viewer.ids.length > 1 && (
        <div className={`pager${chrome ? '' : ' hide'}`}>{viewer.index + 1} / {viewer.ids.length}</div>
      )}

      {infoOpen && (
        <Sheet title={t('info')} onClose={() => setInfoOpen(false)}>
          <div className="info-grid">
            <Row k="Taken" v={`${formatDateLong(item.takenAt)} ${formatTime(item.takenAt)} (${relativeTime(item.takenAt)})`} />
            {item.place && <Row k="Place" v={item.place} />}
            {item.event && <Row k="Event" v={item.event} />}
            <Row k="Folder" v={item.folder} />
            <Row k="Device" v={item.camera.model} />
            <Row k="Lens" v={item.camera.lens} />
            <Row k="Exposure" v={`${item.camera.shutter} · ${item.camera.aperture} · ISO ${item.camera.iso}`} />
            <Row k="Resolution" v={`${item.w} × ${item.h}`} />
            <Row k="Size" v={formatBytes(item.bytes)} />
            {isVideo && <Row k="Duration" v={formatDuration(duration)} />}
            {item.vision && <Row k="Sharpness" v={`${item.vision.blur.toFixed(0)} (laplacian var)`} />}
            {item.vision && <Row k="Brightness" v={`${Math.round(item.vision.brightness * 100)}%`} />}
          </div>
          {item.vision?.tags.length ? (
            <div className="chip-row">
              {item.vision.tags.map((tag) => <span key={tag} className="chip static"><Icon name="tag" size={13} />{tag}</span>)}
            </div>
          ) : null}
          {names.length > 0 && (
            <div className="chip-row">
              {names.map((n) => <span key={n} className="chip static"><Icon name="person" size={13} />{n}</span>)}
            </div>
          )}
          {(item.faces?.length ?? 0) > 0 && (
            <label className="switch-row">
              <span>Show on-device face boxes</span>
              <input type="checkbox" checked={showFaces} onChange={(e) => setShowFaces(e.target.checked)} />
              <i />
            </label>
          )}
          {item.ocr && (
            <div className="ocr-box">
              <span className="field-label"><Icon name="scanText" size={14} /> On-device text (OCR)</span>
              <pre>{item.ocr}</pre>
            </div>
          )}
        </Sheet>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="info-row"><span>{k}</span><strong>{v}</strong></div>
  );
}

export type { EditState };
