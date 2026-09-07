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

export interface EditAdjust {
  brightness: number; // -100..100
  contrast: number;
  saturation: number;
  warmth: number;
  sharpen: number;    // 0..100
  vignette: number;   // 0..100
  blur: number;       // 0..20 px
}

export interface MarkupStroke {
  tool: 'pen' | 'line' | 'arrow' | 'rect' | 'ellipse' | 'text';
  color: string;
  width: number;
  points: Array<{ x: number; y: number }>; // normalized 0..1
  text?: string;
}

export interface EditState {
  rotate: 0 | 90 | 180 | 270;
  flipH: boolean;
  flipV: boolean;
  crop: { x: number; y: number; w: number; h: number } | null; // normalized
  filterId: string;
  adjust: EditAdjust;
  enhanced: boolean;
  erased: Array<{ x: number; y: number; r: number }>; // normalized brush dabs
  portraitBlur: number; // 0..20
  markup: MarkupStroke[];
  trim: { start: number; end: number } | null; // seconds, videos
}

export const emptyEdit = (): EditState => ({
  rotate: 0,
  flipH: false,
  flipV: false,
  crop: null,
  filterId: 'original',
  adjust: { brightness: 0, contrast: 0, saturation: 0, warmth: 0, sharpen: 0, vignette: 0, blur: 0 },
  enhanced: false,
  erased: [],
  portraitBlur: 0,
  markup: [],
  trim: null,
});

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
  ai: { faces: true, ocr: true, duplicates: true, blur: true, scenes: true },
  notifications: { memories: true, cleanup: true, backup: false },
  wifiOnly: true,
  chargingOnly: false,
};
