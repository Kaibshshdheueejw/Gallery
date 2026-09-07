import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addToAlbum, closeViewer, duplicateItem, openEditor, openShare, openViewer, renameItem,
  saveEdits, setFavorite, setHidden, setLocked, toast, trashItems, useApp,
} from '../../store';
import { renderEdited, cssFilterFor } from '../editor/render';
import { loadImage } from '../../ml/pipelines';
import { IconButton, Sheet, Dialog } from '../../components/ui';
import { AnimatedButton } from '../../components/glass';
import { Icon } from '../../core/icons';
import { translate } from '../../core/i18n';
import { formatBytes, formatDateLong, formatDuration, formatTime, relativeTime } from '../../core/utils';
import type { MediaItem } from '../../data/models';

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
function VideoStage({ item, playing, speed, muted, trim, loop, onTime, onEnd }: {
  item: MediaItem; playing: boolean; speed: number; muted: boolean;
  trim: { start: number; end: number }; loop: boolean; onTime: (t: number) => void; onEnd: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const timeRef = useRef(trim.start);
  const audioRef = useRef<{ ctx: AudioContext; gain: GainNode } | null>(null);

  useEffect(() => { loadImage(item.src).then((img) => { imgRef.current = img; }); }, [item]);

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
    const loopFn = (now: number) => {
      const dt = (now - prev) / 1000;
      prev = now;
      if (playing) {
        timeRef.current += dt * speed;
        if (timeRef.current > trim.end) {
          if (loop) timeRef.current = trim.start;
          else { timeRef.current = trim.end; onEnd(); }
        }
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
      raf = requestAnimationFrame(loopFn);
    };
    raf = requestAnimationFrame(loopFn);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, trim, item, onTime, onEnd, loop]);

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
  const [moreOpen, setMoreOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [showFaces, setShowFaces] = useState(false);
  const [playing, setPlaying] = useState(settings.autoplay);
  const [muted, setMuted] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [time, setTime] = useState(0);
  const [trimEdit, setTrimEdit] = useState(false);
  const [flip, setFlip] = useState<'origin' | 'full' | 'back'>(viewer?.origin ? 'origin' : 'full');
  const [layerOn, setLayerOn] = useState(Boolean(viewer?.origin));
  const [backAtFull, setBackAtFull] = useState(false);
  const drag = useRef<{ x: number; y: number; panX: number; panY: number; moved: boolean } | null>(null);

  const resetView = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, []);

  useEffect(() => { resetView(); setChrome(true); setPlaying(settings.autoplay); setTime(item?.edits.trim?.start ?? 0); }, [viewer?.index, resetView, item?.id, settings.autoplay]);

  // shared-element entry: thumbnail rect → fullscreen
  useEffect(() => {
    if (!viewer?.origin) { setFlip('full'); return; }
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setFlip('full')));
    return () => cancelAnimationFrame(id);
  }, [viewer?.origin]);
  useEffect(() => {
    if (viewer?.closing) setFlip('back');
  }, [viewer?.closing]);

  // keep the transition layer alive during the crossfade, then drop it
  useEffect(() => {
    if (flip === 'full') {
      const id = setTimeout(() => setLayerOn(false), 240);
      return () => clearTimeout(id);
    }
    if (flip === 'back') {
      setLayerOn(true);
      setBackAtFull(true);
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setBackAtFull(false)));
      return () => cancelAnimationFrame(id);
    }
    return undefined;
  }, [flip]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!viewer) return;
      if (e.key === 'Escape') closeViewer();
      if (e.key === 'ArrowRight') openNext(1);
      if (e.key === 'ArrowLeft') openNext(-1);
      if (e.key === ' ') { e.preventDefault(); setPlaying((p) => !p); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  const openNext = (delta: number) => {
    if (!viewer) return;
    const next = viewer.index + delta;
    if (next >= 0 && next < viewer.ids.length) {
      setFlip('full');
      openViewer(viewer.ids, next);
    }
  };

  const go = (delta: number) => openNext(delta);

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

  const layerStyle = useMemo((): React.CSSProperties | null => {
    if (!viewer?.origin || !item) return null;
    if (flip === 'origin' || (flip === 'back' && !backAtFull)) {
      const o = viewer.origin;
      return { left: o.x, top: o.y, width: o.w, height: o.h, opacity: 1 };
    }
    const vw = window.innerWidth, vh = window.innerHeight;
    const ar = item.w / item.h;
    let w = vw, h = vh;
    if (ar > vw / vh) h = vw / ar; else w = vh * ar;
    return { left: (vw - w) / 2, top: (vh - h) / 2, width: w, height: h, opacity: 1, borderRadius: 0 };
  }, [flip, backAtFull, viewer?.origin, item]);

  if (!viewer || !item) return null;

  const duration = item.video?.duration ?? 0;
  const trim = item.edits.trim ?? { start: 0, end: duration };
  const isVideo = item.kind === 'video';
  const names = (item.personIds ?? []).map((pid) => app.faceNames[pid] ?? pid);
  const sceneTags = (item.vision?.tags ?? []).filter((tag) => settings.ai.scenes || ['blurry', 'duplicate', 'video', 'screenshot', 'text', 'document'].includes(tag));

  return (
    <div className={`viewer${viewer.closing ? ' closing' : ''}`}>
      <div
        className="viewer-stage"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={doubleClick}
      >
        <div className="zoom-wrap" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, opacity: flip === 'origin' ? 0 : 1, transition: 'opacity 180ms' }}>
          {isVideo
            ? <VideoStage item={item} playing={playing} speed={speed} muted={muted} trim={trim} loop={settings.loop} onTime={setTime} onEnd={() => setPlaying(false)} />
            : <PhotoStage item={item} showFaces={showFaces} />}
        </div>
      </div>

      {layerOn && layerStyle && (
        <img className="viewer-transition-img" src={item.thumb ?? item.src} alt="" style={layerStyle} />
      )}

      <header className={`v-bar top glass glass-strong${chrome ? '' : ' hide'}`}>
        <IconButton icon="back" label="Close" onClick={closeViewer} />
        <div className="grow">
          <strong>{item.title}</strong>
          <span>{formatDateLong(item.takenAt)} · {formatTime(item.takenAt)}</span>
        </div>
        <IconButton icon="heart" label={t('favorite')} filled={item.favorite} onClick={() => setFavorite([item.id], !item.favorite)} />
        <IconButton icon="info" label={t('info')} onClick={() => setInfoOpen(true)} />
        <IconButton icon="more" label="More" onClick={() => setMoreOpen(true)} />
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

      <footer className={`v-bar bottom glass glass-strong${chrome ? '' : ' hide'}`}>
        <IconButton icon="share" label={t('share')} onClick={() => openShare([item.id])} />
        <IconButton icon="edit" label={t('edit')} onClick={() => openEditor(item.id)} />
        <IconButton icon="heart" label={t('favorite')} filled={item.favorite} onClick={() => setFavorite([item.id], !item.favorite)} />
        <IconButton icon={item.locked ? 'lockOpen' : 'lock'} label={t('lock')} onClick={() => setLocked([item.id], !item.locked)} />
        <IconButton icon="trash" label={t('delete')} onClick={() => { trashItems([item.id]); closeViewer(); }} />
      </footer>

      {viewer.ids.length > 1 && (
        <div className={`pager${chrome ? '' : ' hide'}`}>{viewer.index + 1} / {viewer.ids.length}</div>
      )}

      {moreOpen && (
        <Sheet onClose={() => setMoreOpen(false)}>
          <div className="set-group glass glass-subtle">
            <button type="button" className="row-btn pressable-row" onClick={() => { setRenameDraft(item.title); setRenameOpen(true); setMoreOpen(false); }}>
              <Icon name="pen" size={18} /><span className="grow">{t('rename')}</span>
            </button>
            <button type="button" className="row-btn pressable-row" onClick={() => { duplicateItem(item.id); setMoreOpen(false); }}>
              <Icon name="copy" size={18} /><span className="grow">{t('copy')}</span>
            </button>
            <button type="button" className="row-btn pressable-row" onClick={() => { setMoveOpen(true); setMoreOpen(false); }}>
              <Icon name="stack" size={18} /><span className="grow">{t('move_to_album')}</span>
            </button>
            <button type="button" className="row-btn pressable-row" onClick={() => { setHidden([item.id], !item.hidden); setMoreOpen(false); }}>
              <Icon name="eyeOff" size={18} /><span className="grow">{item.hidden ? t('unhide') : t('hide')}</span>
            </button>
            <button type="button" className="row-btn pressable-row" onClick={() => { setLocked([item.id], !item.locked); setMoreOpen(false); }}>
              <Icon name="lock" size={18} /><span className="grow">{item.locked ? t('unlock') : t('lock')}</span>
            </button>
          </div>
          <div className="set-group glass glass-subtle">
            <div className="row-btn disabled" title={t('device_only')}>
              <Icon name="image" size={18} /><span className="grow">{t('set_wallpaper')}</span><em className="muted">{t('device_only')}</em>
            </div>
            <div className="row-btn disabled" title={t('device_only')}>
              <Icon name="contact" size={18} /><span className="grow">{t('set_contact')}</span><em className="muted">{t('device_only')}</em>
            </div>
            <div className="row-btn disabled" title={t('device_only')}>
              <Icon name="send" size={18} /><span className="grow">{t('open_with')}</span><em className="muted">{t('device_only')}</em>
            </div>
          </div>
        </Sheet>
      )}

      {moveOpen && (
        <Sheet title={t('move_to_album')} onClose={() => setMoveOpen(false)}>
          {app.customAlbums.length === 0
            ? <p className="hint">No albums yet — create one from Albums → +.</p>
            : (
              <div className="set-group glass glass-subtle">
                {app.customAlbums.map((a) => (
                  <button key={a.id} type="button" className="row-btn pressable-row" onClick={() => { addToAlbum(a.id, [item.id]); setMoveOpen(false); }}>
                    <Icon name="stack" size={18} /><span className="grow">{a.name}</span><em>{a.itemIds.length}</em>
                  </button>
                ))}
              </div>
            )}
        </Sheet>
      )}

      {renameOpen && (
        <Dialog title={t('rename')} onClose={() => setRenameOpen(false)}>
          <input className="text-input" autoFocus value={renameDraft} onChange={(e) => setRenameDraft(e.target.value)} />
          <div className="dialog-actions">
            <button type="button" className="ghost-btn" onClick={() => setRenameOpen(false)}>{t('cancel')}</button>
            <AnimatedButton icon="check" onClick={() => { renameItem(item.id, renameDraft || item.title); setRenameOpen(false); }}>{t('save')}</AnimatedButton>
          </div>
        </Dialog>
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
          {sceneTags.length ? (
            <div className="chip-row">
              {sceneTags.map((tag) => <span key={tag} className="chip static"><Icon name="tag" size={13} />{tag}</span>)}
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
          {item.ocr && settings.ai.ocr && (
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
