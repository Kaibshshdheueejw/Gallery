/** Domain entities shared across data / domain / presentation layers. */

export type MediaKind = 'photo' | 'video' | 'screenshot';

export interface FaceBox { x: number; y: number; w: number; h: number }

export interface CameraMeta {
  model: string;
  lens: string;
  iso: number;
  shutter: string;
  aperture: string;
}

export interface VideoMeta {
  duration: number; // seconds
  motion: 'zoomIn' | 'zoomOut' | 'panL' | 'panR' | 'panU' | 'panD';
}

export interface VisionMetrics {
  hash: string;              // 64-bit average hash (hex)
  blur: number;              // laplacian variance — low = blurry
  brightness: number;        // 0..1
  saturation: number;        // 0..1
  warmth: number;            // -128..128 (R-B mean)
  greenness: number;         // -128..128
  dominant: [number, number, number];
  tags: string[];
  scannedMs: number;
}

/* ── editing: adjustments ─────────────────────────────────────────────── */

export interface EditAdjust {
  /* light */
  brightness: number; // -100..100
  exposure: number;   // -100..100 (±1 EV)
  contrast: number;   // -100..100
  highlights: number; // -100..100
  shadows: number;    // -100..100
  /* colour */
  saturation: number; // -100..100
  vibrance: number;   // -100..100 (saturation weighted toward muted tones)
  warmth: number;     // -100..100 (temperature)
  tint: number;       // -100..100 (green ↔ magenta)
  hue: number;        // -180..180 degrees
  /* detail & effects */
  sharpen: number;    // 0..100
  clarity: number;    // -100..100 (local mid-tone contrast)
  dehaze: number;     // 0..100
  denoise: number;    // 0..100 (edge-preserving smoothing)
  vignette: number;   // 0..100
  grain: number;      // 0..100
  blur: number;       // 0..20 px (global)
}

export const emptyAdjust = (): EditAdjust => ({
  brightness: 0, exposure: 0, contrast: 0, highlights: 0, shadows: 0,
  saturation: 0, vibrance: 0, warmth: 0, tint: 0, hue: 0,
  sharpen: 0, clarity: 0, dehaze: 0, denoise: 0, vignette: 0, grain: 0, blur: 0,
});

/* ── editing: curves / HSL / colour balance ───────────────────────────── */

export interface CurvePt { x: number; y: number } // 0..1

export interface CurveState {
  rgb: CurvePt[];
  r: CurvePt[];
  g: CurvePt[];
  b: CurvePt[];
}

export const emptyCurves = (): CurveState => ({ rgb: [], r: [], g: [], b: [] });
export const curvesAreEmpty = (c: CurveState | null): boolean =>
  !c || (c.rgb.length === 0 && c.r.length === 0 && c.g.length === 0 && c.b.length === 0);

/** One HSL adjustment band (8 bands across the hue wheel). */
export interface HslBand { h: number; s: number; l: number } // each -100..100

export const HSL_BANDS = 8;
export const emptyHsl = (): HslBand[] => Array.from({ length: HSL_BANDS }, () => ({ h: 0, s: 0, l: 0 }));
export const hslIsEmpty = (bands: HslBand[] | null): boolean =>
  !bands || bands.every((b) => b.h === 0 && b.s === 0 && b.l === 0);

export interface RgbShift { r: number; g: number; b: number } // -100..100 each

export interface ColorBalance { shadows: RgbShift; midtones: RgbShift; highlights: RgbShift }

export const emptyBalance = (): ColorBalance => ({
  shadows: { r: 0, g: 0, b: 0 },
  midtones: { r: 0, g: 0, b: 0 },
  highlights: { r: 0, g: 0, b: 0 },
});
export const balanceIsEmpty = (b: ColorBalance | null): boolean =>
  !b || [b.shadows, b.midtones, b.highlights].every((s) => s.r === 0 && s.g === 0 && s.b === 0);

/* ── editing: stickers & text layers ──────────────────────────────────── */

export interface StickerLayer {
  id: string;
  stickerId: string;      // id from the built-in sticker catalogue
  x: number; y: number;   // normalized centre 0..1
  scale: number;          // fraction of min(canvas w,h)
  rot: number;            // degrees
  opacity: number;        // 0..1
  color: string | null;   // tint for vector stickers
  z: number;
  t0: number | null;      // video: first second visible (null = always)
  t1: number | null;      // video: last second visible
  anim?: boolean;         // animated sticker (video playback)
}

export interface TextLayer {
  id: string;
  text: string;
  x: number; y: number;   // normalized centre 0..1
  scale: number;          // relative font size (fraction of min(w,h))
  rot: number;            // degrees
  opacity: number;        // 0..1
  z: number;
  fontId: string;         // id from the built-in font list
  color: string;
  align: 'left' | 'center' | 'right';
  bg: string | null;      // background pill/box colour
  outline: number;        // stroke width factor 0..1 (0 = none)
  outlineColor: string;
  shadow: boolean;
  spacing: number;        // letter spacing factor -50..100
  lineHeight: number;     // 0.8..2.4
  t0: number | null;      // video timing
  t1: number | null;
  anim?: 'none' | 'fade' | 'rise' | 'pop';
}

export type BrushDabMode = 'inpaint' | 'redeye' | 'blur' | 'mosaic';

export interface BrushDab { x: number; y: number; r: number; mode: BrushDabMode }

export interface FrameStyle {
  id: string;             // 'none' | 'thin' | 'thick' | 'polaroid' | 'round' | 'corners'
  color: string;
  width: number;          // 0..40 (fraction of min dim /1000)
}

/* ── editing: full (non-destructive) state ────────────────────────────── */

export interface MarkupStroke {
  tool: 'pen' | 'highlighter' | 'line' | 'arrow' | 'rect' | 'ellipse' | 'text';
  color: string;
  width: number;
  opacity: number;
  points: Array<{ x: number; y: number }>; // normalized 0..1
  text?: string;
}

export type VideoAspect = 'original' | '16:9' | '9:16' | '1:1' | '4:5';

export interface EditState {
  v: 2;
  /* geometry */
  rotate: 0 | 90 | 180 | 270;
  flipH: boolean;
  flipV: boolean;
  straighten: number;     // -45..45 degrees (auto zoom-to-fill)
  perspective: { x: number; y: number }; // -100..100 keystone
  crop: { x: number; y: number; w: number; h: number } | null; // normalized, pre-rotation
  pad: { top: number; bottom: number; left: number; right: number; color: string } | null; // expand canvas, fractions
  /* colour pipeline */
  filterId: string;
  adjust: EditAdjust;
  curves: CurveState | null;
  hsl: HslBand[] | null;
  balance: ColorBalance | null;
  enhanced: boolean;
  /* retouch brushes */
  dabs: BrushDab[];
  erased: Array<{ x: number; y: number; r: number }>; // legacy v1 inpaint dabs (migrated into `dabs`)
  portraitBlur: number; // 0..20
  /* overlays */
  stickers: StickerLayer[];
  texts: TextLayer[];
  markup: MarkupStroke[];
  frame: FrameStyle | null;
  /* export */
  exportScale: number;    // 0.25..3 (resize / upscale at export)
  /* video-only */
  trim: { start: number; end: number } | null; // seconds
  speed: number;          // 0.25..3 playback speed multiplier
  reverse: boolean;
  muted: boolean;
  volume: number;         // 0..100
  aspect: VideoAspect;
  effectId: string;       // video effect preset ('none' = off)
}

export const emptyEdit = (): EditState => ({
  v: 2,
  rotate: 0,
  flipH: false,
  flipV: false,
  straighten: 0,
  perspective: { x: 0, y: 0 },
  crop: null,
  pad: null,
  filterId: 'original',
  adjust: emptyAdjust(),
  curves: null,
  hsl: null,
  balance: null,
  enhanced: false,
  dabs: [],
  erased: [],
  portraitBlur: 0,
  stickers: [],
  texts: [],
  markup: [],
  frame: null,
  exportScale: 1,
  trim: null,
  speed: 1,
  reverse: false,
  muted: true,
  volume: 70,
  aspect: 'original',
  effectId: 'none',
});

/** Merge a persisted (possibly v1) edit over the v2 defaults, field by field. */
export function migrateEdits(saved: Partial<EditState> | undefined): EditState {
  const base = emptyEdit();
  if (!saved) return base;
  const legacyDabs = (saved.erased ?? []).map((d) => ({ ...d, mode: 'inpaint' as const }));
  return {
    ...base,
    ...saved,
    v: 2,
    adjust: { ...base.adjust, ...(saved.adjust ?? {}) },
    perspective: { ...base.perspective, ...(saved.perspective ?? {}) },
    stickers: saved.stickers ?? [],
    texts: saved.texts ?? [],
    markup: (saved.markup ?? []).map((m) => ({ ...m, opacity: m.opacity ?? 1 })),
    dabs: [...(saved.dabs ?? []), ...legacyDabs],
  };
}

/* ── media items ──────────────────────────────────────────────────────── */

export interface MediaItem {
  id: string;
  kind: MediaKind;
  src: string;
  thumb?: string;
  w: number;
  h: number;
  bytes: number;
  takenAt: number;
  title: string;
  folder: string;
  place?: string;
  event?: string;
  camera: CameraMeta;
  ocr?: string;
  faces?: FaceBox[];
  personIds?: string[];
  video?: VideoMeta;
  vision?: VisionMetrics;
  favorite: boolean;
  trashedAt: number | null;
  locked: boolean;
  hidden: boolean;
  generated?: boolean;   // created in-app (collage, extracted frame, exported clip…)
  edits: EditState;
}

export interface CustomAlbum {
  id: string;
  name: string;
  itemIds: string[];
  createdAt: number;
}

export interface FaceCluster {
  id: string;
  name: string;
  itemIds: string[];
}

export type TabId = 'foryou' | 'timeline' | 'albums' | 'search';

/* ── settings ─────────────────────────────────────────────────────────── */

export interface BackupSettings {
  enabled: boolean;
  provider: 'drive' | 's3';
  endpoint: string;
  encrypted: boolean;
  lastBackupAt: number | null;
}

export interface GlassSettings {
  intensity: number;   // 0..100 — surface translucency + highlight strength
  blur: number;        // 0..100 — backdrop blur amount
  transparency: number;// 0..100 — how much content shows through
}

export interface AiSettings {
  faces: boolean;
  ocr: boolean;
  duplicates: boolean;
  blur: boolean;
  scenes: boolean;
}

export interface NotificationSettings {
  memories: boolean;
  cleanup: boolean;
  backup: boolean;
}

/** Albums screen composition (Settings → Albums). */
export interface AlbumSettings {
  showPeople: boolean;
  showPlaces: boolean;
  showFolders: boolean;
  showViewed: boolean;
  sort: 'auto' | 'name' | 'count' | 'recent';
}

/** Photo editor defaults (Settings → Photo Editing). */
export interface PhotoEditSettings {
  previewQuality: 'fast' | 'balanced' | 'high';
  autoEnhance: boolean;
  exportFormat: 'png' | 'jpeg';
  exportQuality: number;   // 50..100 (jpeg)
  historyDepth: number;    // undo snapshots kept per session
}

/** Video player gestures + editor defaults (Settings → Playback / Video Editing). */
export interface GestureSettings {
  brightness: boolean; // left-half vertical swipe
  volume: boolean;     // right-half vertical swipe
  seek: boolean;       // two-finger horizontal swipe
}

export interface VideoEditSettings {
  gestures: GestureSettings;
  defaultSpeed: number;     // 0.25..3
  exportFps: 30 | 60;
  exportRes: 720 | 1080;
  frameStep: number;        // seconds per frame-step button (1/30 default)
}

/** For You section visibility (View options menu). */
export interface ForYouSections {
  memories: boolean;
  stories: boolean;
  onThisDay: boolean;
  recently: boolean;
  featured: boolean;
  suggestions: boolean;
}

export interface Settings {
  mode: 'light' | 'dark' | 'system';
  seed: string;           // seed id or hex
  dynamicColor: boolean;  // derive seed from latest photo (Material You)
  lang: 'en' | 'hi' | 'bn' | 'es';
  tabOrder: TabId[];
  gridLevel: number;      // 0..5 zoom level of the timeline grid
  thumbRatio: 'square' | '4:3' | 'auto';
  retentionDays: 7 | 30 | 60 | 90;
  biometrics: boolean;
  appLock: boolean;
  pin: string;
  backup: BackupSettings;
  // liquid-glass appearance
  glass: GlassSettings;
  layout: 'comfortable' | 'standard' | 'compact';
  navStyle: 'capsule' | 'compact';
  animations: boolean;
  animSpeed: 'relaxed' | 'standard' | 'fast';
  haptics: boolean;
  // gallery behaviour
  defaultTab: TabId;
  sortOrder: 'newest' | 'oldest';
  showHidden: boolean;
  autoCleanup: boolean;
  // playback
  autoplay: boolean;
  loop: boolean;
  // feature areas
  albums: AlbumSettings;
  photoEdit: PhotoEditSettings;
  videoEdit: VideoEditSettings;
  foryou: ForYouSections;
  // smart features
  ai: AiSettings;
  notifications: NotificationSettings;
  wifiOnly: boolean;
  chargingOnly: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  mode: 'dark',
  seed: 'violet',
  dynamicColor: true,
  lang: 'en',
  tabOrder: ['foryou', 'timeline', 'albums', 'search'],
  gridLevel: 3,
  thumbRatio: 'square',
  retentionDays: 30,
  biometrics: true,
  appLock: false,
  pin: '1234',
  backup: { enabled: false, provider: 'drive', endpoint: '', encrypted: true, lastBackupAt: null },
  glass: { intensity: 62, blur: 58, transparency: 46 },
  layout: 'standard',
  navStyle: 'capsule',
  animations: true,
  animSpeed: 'standard',
  haptics: true,
  defaultTab: 'foryou',
  sortOrder: 'newest',
  showHidden: false,
  autoCleanup: true,
  autoplay: true,
  loop: true,
  albums: { showPeople: true, showPlaces: true, showFolders: true, showViewed: true, sort: 'auto' },
  photoEdit: { previewQuality: 'balanced', autoEnhance: false, exportFormat: 'png', exportQuality: 92, historyDepth: 40 },
  videoEdit: {
    gestures: { brightness: true, volume: true, seek: true },
    defaultSpeed: 1,
    exportFps: 30,
    exportRes: 720,
    frameStep: 1 / 30,
  },
  foryou: { memories: true, stories: true, onThisDay: true, recently: true, featured: true, suggestions: true },
  ai: { faces: true, ocr: true, duplicates: true, blur: true, scenes: true },
  notifications: { memories: true, cleanup: true, backup: false },
  wifiOnly: true,
  chargingOnly: false,
};
