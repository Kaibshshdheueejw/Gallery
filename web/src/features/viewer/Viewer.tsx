/**
 * MediaViewer — shared-element open/close, pinch/double-tap zoom for photos,
 * and the advanced video player (§12–§13):
 *   play/pause · seek timeline · speed menu · loop · mute/volume · fullscreen
 *   rotation · picture-in-picture · timed text overlays (CC) · ±frame seek
 *   Google-Files-style gestures: left-half vertical swipe = brightness,
 *   right-half vertical swipe = volume, horizontal swipe = seek — with the
 *   Liquid-Glass GestureIndicator HUD. No gesture conflicts: a tap toggles
 *   chrome, a swipe only seeks when horizontal intent dominates.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addToAlbum, closeViewer, duplicateItem, openEditor, openShare, openViewer, renameItem,
  saveEdits, setFavorite, setHidden, setLocked, toast, trashItems, useApp,
} from '../../store';
import { renderEdited } from '../editor/render';
import { loadImage } from '../../ml/pipelines';
import { IconButton, Sheet, Dialog } from '../../components/ui';
import { AnimatedButton } from '../../components/glass';
import { GlassPopupMenu, usePopupAnchor, type PopupMenuItem } from '../../components/GlassPopupMenu';
import { GestureIndicator, type GestureState } from '../../components/GestureIndicator';
import { VideoStage } from './VideoStage';
import { Icon } from '../../core/icons';
import { translate } from '../../core/i18n';
import { clamp, formatBytes, formatDateLong, formatDuration, formatTime, relativeTime } from '../../core/utils';
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

const SPEEDS = [0.25, 0.5, 1, 1.5, 2, 3];

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
  const [volume, setVolume] = useState(70);
  const [brightness, setBrightness] = useState(1);
  const [speed, setSpeed] = useState(settings.videoEdit.defaultSpeed ?? 1);
  const [loopOn, setLoopOn] = useState(settings.loop);
  const [ccOn, setCcOn] = useState(true);
  const [rot, setRot] = useState(0);
  const [time, setTime] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);
  const [trimEdit, setTrimEdit] = useState(false);
  const [gesture, setGesture] = useState<GestureState | null>(null);
  const [flip, setFlip] = useState<'origin' | 'full' | 'back'>(viewer?.origin ? 'origin' : 'full');
  const [layerOn, setLayerOn] = useState(Boolean(viewer?.origin));
  const [backAtFull, setBackAtFull] = useState(false);
  const [stageBox, setStageBox] = useState({ w: 1, h: 1 });
  const drag = useRef<{ x: number; y: number; panX: number; panY: number; moved: boolean } | null>(null);
  const vDrag = useRef<{ x: number; y: number; moved: boolean; kind: 'none' | 'seek' | 'bright' | 'vol'; startVal: number; startTime: number } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasEl = useRef<HTMLCanvasElement | null>(null);
  const pipVideo = useRef<HTMLVideoElement>(null);
  const speedMenu = usePopupAnchor();
  const timeRef = useRef(0);

  const resetView = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); setRot(0); setBrightness(1); }, []);
  useEffect(() => { resetView(); setTime(0); setScrub(null); setPlaying(settings.autoplay); }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setFlip('full')));
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    if (flip === 'full') {
      const id = setTimeout(() => setLayerOn(false), 240);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [flip]);
  useEffect(() => {
    if (viewer?.closing) {
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setBackAtFull(false)));
      return () => cancelAnimationFrame(id);
    }
    return undefined;
  }, [viewer?.closing]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeViewer();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === ' ' && item?.kind === 'video') { e.preventDefault(); setPlaying((p) => !p); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  /* measure the stage for rotation fit */
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setStageBox({ w: r.width || 1, h: r.height || 1 });
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    setStageBox({ w: r.width || 1, h: r.height || 1 });
    return () => ro.disconnect();
  }, [item?.id]);

  const go = (delta: number) => {
    if (!viewer) return;
    const next = viewer.index + delta;
    if (next < 0 || next >= viewer.ids.length) return;
    openViewer(viewer.ids, next);
  };

  const onWheel = (e: React.WheelEvent) => {
    if (item?.kind === 'video') return;
    setZoom((z) => clamp(z * (e.deltaY < 0 ? 1.12 : 0.9), 1, 6));
  };

  /* ── pointer handling: photos zoom/pan/swipe; videos Files-style gestures ── */
  const onPointerDown = (e: React.PointerEvent) => {
    if (item?.kind === 'video') {
      vDrag.current = { x: e.clientX, y: e.clientY, moved: false, kind: 'none', startVal: 0, startTime: timeRef.current };
    } else {
      drag.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y, moved: false };
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (item?.kind === 'video') {
      const d = vDrag.current;
      if (!d || !viewer) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      const rect = stageRef.current?.getBoundingClientRect();
      const w = rect?.width ?? 1, h = rect?.height ?? 1;
      if (!d.moved && Math.hypot(dx, dy) < 10) return;
      if (!d.moved) {
        d.moved = true;
        const g = settings.videoEdit.gestures;
        if (Math.abs(dx) > Math.abs(dy) && g.seek) { d.kind = 'seek'; d.startTime = timeRef.current; }
        else if (dy !== 0 && g.brightness && e.clientX < (rect?.left ?? 0) + w / 2) { d.kind = 'bright'; d.startVal = brightness; }
        else if (dy !== 0 && g.volume) { d.kind = 'vol'; d.startVal = volume; }
        else { d.kind = 'none'; return; }
      }
      if (d.kind === 'seek') {
        const dur = item?.video?.duration ?? 4;
        const tr = item?.edits.trim ?? { start: 0, end: dur };
        const delta = (dx / w) * 60; // full-width swipe ≈ ±60 s
        const tt = clamp(d.startTime + delta, tr.start, tr.end);
        setScrub(tt);
        timeRef.current = tt;
        setTime(tt);
        setGesture({ kind: 'seek', value: (tt - tr.start) / Math.max(0.001, tr.end - tr.start), label: `${delta >= 0 ? '+' : ''}${delta.toFixed(0)}s` });
      } else if (d.kind === 'bright') {
        const b = clamp(d.startVal - (dy / h) * 1.6, 0.3, 1.7);
        setBrightness(b);
        setGesture({ kind: 'brightness', value: (b - 0.3) / 1.4 });
      } else if (d.kind === 'vol') {
        const v = clamp(Math.round(d.startVal - (dy / h) * 130), 0, 100);
        setVolume(v);
        setMuted(v === 0);
        setGesture({ kind: 'volume', value: v / 100 });
      }
      return;
    }
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    if (Math.hypot(dx, dy) > 6) drag.current.moved = true;
    if (zoom > 1) setPan({ x: drag.current.panX + dx, y: drag.current.panY + dy });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (item?.kind === 'video') {
      const d = vDrag.current;
      vDrag.current = null;
      setGesture(null);
      if (!d) return;
      if (!d.moved) { setChrome((c) => !c); return; }
      if (d.kind === 'seek') setScrub(null); // resume from the seeked position
      return;
    }
    const d = drag.current;
    drag.current = null;
    if (!d || !viewer) return;
    const dx = e.clientX - d.x;
    if (!d.moved) { setChrome((c) => !c); return; }
    if (zoom === 1 && Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
  };

  const doubleClick = (e: React.MouseEvent) => {
    if (item?.kind === 'video') { setPlaying((p) => !p); return; }
    if (zoom > 1) resetView();
    else { setZoom(2.6); setPan({ x: (window.innerWidth / 2 - e.clientX) * 0.8, y: (window.innerHeight / 2 - e.clientY) * 0.8 }); }
  };

  /* ── player helpers ── */
  const stepFrame = (dir: 1 | -1) => {
    const stepSize = settings.videoEdit.frameStep ?? 1 / 30;
    setPlaying(false);
    const dur = item?.video?.duration ?? 4;
    const tr = item?.edits.trim ?? { start: 0, end: dur };
    const tt = clamp((scrub ?? timeRef.current) + dir * stepSize, tr.start, tr.end);
    setScrub(tt);
    timeRef.current = tt;
    setTime(tt);
  };

  const togglePip = async () => {
    const canvas = canvasEl.current;
    if (!canvas) return;
    if (!('pictureInPictureEnabled' in document) || !document.pictureInPictureEnabled) {
      toast('Picture-in-picture is not available in this browser');
      return;
    }
    try {
      if (document.pictureInPictureElement) { await document.exitPictureInPicture(); return; }
      const v = pipVideo.current!;
      if (v.srcObject !== canvas.captureStream(30)) {
        v.srcObject = canvas.captureStream(30);
        v.muted = true;
        await v.play();
      }
      await v.requestPictureInPicture();
      toast('Playing in picture-in-picture');
    } catch {
      toast('Picture-in-picture was blocked by the browser');
    }
  };

  const toggleFullscreen = () => {
    const el = document.documentElement;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    else el.requestFullscreen?.().catch(() => toast('Fullscreen was blocked by the browser'));
  };

  const speedItems: PopupMenuItem[] = SPEEDS.map((s) => ({
    label: `${s}×`,
    checked: speed === s,
    onClick: () => { setSpeed(s); toast(`Playback speed ${s}×`); },
  }));

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

  /* rotation-fit sizing for the video canvas */
  let videoFit: React.CSSProperties = {};
  if (isVideo) {
    const { w: sw, h: sh } = stageBox;
    let bw = sw * 0.96, bh = bw * 9 / 16;
    if (bh > sh * 0.92) { bh = sh * 0.92; bw = bh * 16 / 9; }
    if (rot % 2 === 1) {
      const scale = Math.min(1, sw / bh, sh / bw);
      videoFit = { width: bw, height: bh, transform: `rotate(${rot * 90}deg) scale(${scale.toFixed(3)})` };
    } else {
      videoFit = { width: bw, height: bh, transform: rot ? `rotate(${rot * 90}deg)` : undefined };
    }
  }

  /* CC = timed text overlays (the caption mechanism of the video editor) */
  const stageEdits = isVideo && !ccOn ? { ...item.edits, texts: [] } : item.edits;

  return (
    <div className={`viewer${viewer.closing ? ' closing' : ''}`}>
      <div
        className="viewer-stage"
        ref={stageRef}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={doubleClick}
      >
        {isVideo ? (
          <div className="video-fit" style={videoFit}>
            <VideoStage
              item={item}
              edits={stageEdits}
              playing={playing && scrub === null}
              playerSpeed={speed}
              muted={muted}
              volume={volume}
              loop={loopOn}
              brightness={brightness}
              timeOverride={scrub}
              onTime={(tt) => { timeRef.current = tt; if (Math.abs(tt - time) > 0.045) setTime(tt); }}
              onEnd={() => { if (!loopOn) setPlaying(false); }}
              onCanvasReady={(c) => { canvasEl.current = c; }}
            />
          </div>
        ) : (
          <div className="zoom-wrap" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, opacity: flip === 'origin' ? 0 : 1, transition: 'opacity 180ms' }}>
            <PhotoStage item={item} showFaces={showFaces} />
          </div>
        )}
      </div>

      {isVideo && !chrome && (
        <button type="button" className="video-center-play" aria-label={playing ? 'Pause' : 'Play'} onClick={() => setPlaying((p) => !p)}>
          <Icon name={playing ? 'pause' : 'play'} size={30} filled />
        </button>
      )}

      <GestureIndicator state={gesture} />
      <video ref={pipVideo} className="pip-source" muted playsInline aria-hidden="true" />

      {layerOn && layerStyle && (
        <img className="viewer-transition-img" src={item.thumb ?? item.src} alt="" style={layerStyle} />
      )}

      <header className={`v-bar top glass glass-strong${chrome ? '' : ' hide'}`}>
        <IconButton icon="back" label="Close" onClick={closeViewer} />
        <div className="grow">
          <strong>{item.title}</strong>
          <span>{formatDateLong(item.takenAt)} · {formatTime(item.takenAt)}</span>
        </div>
        {isVideo && <IconButton icon="expand" label="Fullscreen" onClick={toggleFullscreen} />}
        <IconButton icon="heart" label={t('favorite')} filled={item.favorite} onClick={() => setFavorite([item.id], !item.favorite)} />
        <IconButton icon="info" label={t('info')} onClick={() => setInfoOpen(true)} />
        <IconButton icon="more" label="More" onClick={() => setMoreOpen(true)} />
      </header>

      {isVideo && (
        <div className={`video-controls${chrome ? '' : ' hide'}`}>
          <div className="vc-row">
            <IconButton icon={playing && scrub === null ? 'pause' : 'play'} label={playing ? 'Pause' : 'Play'} filled={!playing} onClick={() => { setScrub(null); setPlaying((p) => !p); }} />
            <span className="time">{formatDuration(Math.max(0, (scrub ?? time) - trim.start))} / {formatDuration(trim.end - trim.start)}</span>
            <input
              type="range"
              className="grow"
              min={trim.start}
              max={trim.end}
              step={0.05}
              value={Math.min(Math.max(scrub ?? time, trim.start), trim.end)}
              onChange={(e) => { const tt = Number(e.target.value); setScrub(tt); timeRef.current = tt; setTime(tt); }}
              onPointerUp={() => setScrub(null)}
              onKeyUp={() => setScrub(null)}
              onBlur={() => setScrub(null)}
              aria-label="Seek"
            />
            <IconButton icon={muted ? 'volumeOff' : 'volume'} label={muted ? 'Unmute' : 'Mute'} onClick={() => setMuted((m) => !m)} />
            <button ref={speedMenu.btnRef} type="button" className="speed-pill" onClick={speedMenu.toggle} aria-label="Playback speed">
              {speed}×
            </button>
          </div>
          <div className="vc-row vc-row2">
            <IconButton icon="back" label="Step back one frame" size={18} className="flip-x" onClick={() => stepFrame(-1)} />
            <IconButton icon="forward" label="Step forward one frame" size={18} onClick={() => stepFrame(1)} />
            <IconButton icon="restore" label={loopOn ? 'Loop on' : 'Loop off'} active={loopOn} size={18} onClick={() => setLoopOn((l) => !l)} />
            <IconButton icon="subtitle" label="Timed text overlays (CC)" active={ccOn} size={18} onClick={() => setCcOn((c) => !c)} />
            <IconButton icon="pip" label="Picture-in-picture" size={18} onClick={togglePip} />
            <IconButton icon="rotate" label="Rotate 90°" size={18} onClick={() => setRot((r) => (r + 1) % 4)} />
            <label className="vol-slider" title="Volume">
              <input type="range" min={0} max={100} value={volume} onChange={(e) => { setVolume(Number(e.target.value)); setMuted(Number(e.target.value) === 0); }} aria-label="Volume" />
            </label>
            <button type="button" className={`ghost-btn vc-trim${trimEdit ? ' on' : ''}`} onClick={() => setTrimEdit((v) => !v)}>
              <Icon name="scissors" size={14} /> Trim
            </button>
          </div>
          {trimEdit && (
            <div className="vc-row">
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
            </div>
          )}
        </div>
      )}
      {speedMenu.open && <GlassPopupMenu items={speedItems} anchorRect={speedMenu.rect} onClose={speedMenu.close} title="Speed" />}

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
