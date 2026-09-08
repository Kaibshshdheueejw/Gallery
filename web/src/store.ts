/**
 * Application store (presentation-layer state container).
 * Tiny external store + useSyncExternalStore binding, persisted to localStorage
 * the way the Flutter app persists to Isar/Drift.
 */
import { useSyncExternalStore } from 'react';
import type { CustomAlbum, EditState, MediaItem, Settings, TabId } from './data/models';
import { DEFAULT_SETTINGS, emptyEdit, migrateEdits } from './data/models';
import { loadLibrary } from './data/datasources/mediaStore';
import { scanLibrary, type ScanReport } from './ml/pipelines';

export type AlbumRef = { type: 'smart' | 'folder' | 'place' | 'event' | 'person' | 'album'; id: string; title: string };

export type SettingsPage =
  | 'main' | 'appearance' | 'gallery' | 'albums' | 'playback' | 'photoEdit' | 'videoEdit'
  | 'privacy' | 'cleanup' | 'backup' | 'notifications' | 'ai' | 'permissions' | 'about';

export type Route =
  | { name: 'tabs' }
  | { name: 'album'; album: AlbumRef }
  | { name: 'trash' }
  | { name: 'locked' }
  | { name: 'memories' }
  | { name: 'settings'; page?: SettingsPage }
  | { name: 'storage' };

export interface Toast { id: number; message: string; action?: { label: string; run: () => void } }

export interface AppState {
  status: 'loading' | 'scanning' | 'ready';
  scan: { done: number; total: number };
  report: ScanReport | null;
  items: MediaItem[];
  faceNames: Record<string, string>;
  settings: Settings;
  recentSearches: string[];
  recentlyViewed: string[];
  customAlbums: CustomAlbum[];
  route: Route;
  activeTab: TabId;
  viewer: { ids: string[]; index: number; origin?: { x: number; y: number; w: number; h: number }; closing?: boolean } | null;
  editorId: string | null;
  shareIds: string[] | null;
  toasts: Toast[];
  wallpaperSeed: string | null;
  /** incremented when a screen menu asks its grid to enter selection mode */
  selectRequest: number;
  /** one-shot search query requested by another screen (For You suggestions) */
  pendingSearch: string | null;
}

const LS_KEY = 'nova.gallery.v1';

interface Persisted {
  favorites: string[];
  trash: Record<string, number>;
  locked: string[];
  hidden: string[];
  edits: Record<string, EditState>;
  faceNames: Record<string, string>;
  settings: Settings;
  recentSearches: string[];
  recentlyViewed: string[];
  customAlbums: CustomAlbum[];
  generated: MediaItem[];
  titles: Record<string, string>;
}

/** deep-merge persisted settings over defaults so new nested keys survive upgrades */
function mergeSettings(base: Settings, saved: Partial<Settings> | undefined): Settings {
  if (!saved) return base;
  return {
    ...base,
    ...saved,
    backup: { ...base.backup, ...(saved.backup ?? {}) },
    glass: { ...base.glass, ...(saved.glass ?? {}) },
    ai: { ...base.ai, ...(saved.ai ?? {}) },
    notifications: { ...base.notifications, ...(saved.notifications ?? {}) },
    albums: { ...base.albums, ...(saved.albums ?? {}) },
    photoEdit: { ...base.photoEdit, ...(saved.photoEdit ?? {}) },
    videoEdit: {
      ...base.videoEdit,
      ...(saved.videoEdit ?? {}),
      gestures: { ...base.videoEdit.gestures, ...(saved.videoEdit?.gestures ?? {}) },
    },
    foryou: { ...base.foryou, ...(saved.foryou ?? {}) },
  };
}

function loadPersisted(): Partial<Persisted> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Partial<Persisted>) : {};
  } catch {
    return {};
  }
}

let state: AppState = {
  status: 'loading',
  scan: { done: 0, total: 0 },
  report: null,
  items: [],
  faceNames: {},
  settings: { ...DEFAULT_SETTINGS },
  recentSearches: [],
  recentlyViewed: [],
  customAlbums: [],
  route: { name: 'tabs' },
  activeTab: 'foryou',
  viewer: null,
  editorId: null,
  shareIds: null,
  toasts: [],
  wallpaperSeed: null,
  selectRequest: 0,
  pendingSearch: null,
};

const listeners = new Set<() => void>();
function set(patch: Partial<AppState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
export const getState = () => state;
export function useApp(): AppState {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => state,
  );
}

let toastSeq = 1;
export function toast(message: string, action?: Toast['action']) {
  const id = toastSeq++;
  set({ toasts: [...state.toasts, { id, message, action }] });
  setTimeout(() => dismissToast(id), action ? 6000 : 3200);
}
export function dismissToast(id: number) {
  set({ toasts: state.toasts.filter((t) => t.id !== id) });
}

function persist() {
  const base = emptyEdit();
  const baseJson = JSON.stringify(base);
  const p: Persisted = {
    favorites: state.items.filter((i) => i.favorite).map((i) => i.id),
    trash: Object.fromEntries(state.items.filter((i) => i.trashedAt !== null).map((i) => [i.id, i.trashedAt!])),
    locked: state.items.filter((i) => i.locked).map((i) => i.id),
    hidden: state.items.filter((i) => i.hidden).map((i) => i.id),
    edits: Object.fromEntries(
      state.items
        .filter((i) => !i.generated && JSON.stringify(i.edits) !== baseJson)
        .map((i) => [i.id, i.edits]),
    ),
    faceNames: state.faceNames,
    settings: state.settings,
    recentSearches: state.recentSearches,
    recentlyViewed: state.recentlyViewed,
    customAlbums: state.customAlbums,
    // generated items persist whole when their source survives reloads
    // (data: URLs and bundled asset paths do; blob: URLs don't — those are
    // offered as downloads instead).
    generated: state.items.filter((i) => i.generated && !i.src.startsWith('blob:')),
    titles: Object.fromEntries(state.items.filter((i) => !i.generated).map((i) => [i.id, i.title])),
  };
  try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch { /* quota */ }
}

/* ── boot ─────────────────────────────────────────────────────────────── */
export async function initApp() {
  const persisted = loadPersisted();
  const items = await loadLibrary();
  const fav = new Set(persisted.favorites ?? []);
  const trash = persisted.trash ?? {};
  const locked = new Set(persisted.locked ?? []);
  const hidden = new Set(persisted.hidden ?? []);
  const edits = persisted.edits ?? {};
  const titles = persisted.titles ?? {};
  for (const item of items) {
    item.favorite = fav.has(item.id);
    item.trashedAt = trash[item.id] ?? null;
    item.locked = locked.has(item.id);
    item.hidden = hidden.has(item.id);
    if (edits[item.id]) item.edits = migrateEdits(edits[item.id]);
    if (titles[item.id]) item.title = titles[item.id];
  }
  // merge in-app generated items (collages, extracted frames, saved copies…)
  const generated = (persisted.generated ?? []).map((g) => ({ ...g, edits: migrateEdits(g.edits) }));
  const all = [...generated, ...items];
  const settings = mergeSettings(DEFAULT_SETTINGS, persisted.settings);
  set({
    items: all,
    faceNames: persisted.faceNames ?? {},
    settings,
    activeTab: settings.defaultTab,
    recentSearches: persisted.recentSearches ?? [],
    recentlyViewed: persisted.recentlyViewed ?? [],
    customAlbums: persisted.customAlbums ?? [],
    status: 'scanning',
    scan: { done: 0, total: all.length },
  });

  const report = await scanLibrary(all, (done, total) => set({ scan: { done, total } }));
  set({ report, status: 'ready', items: [...state.items] });
  persist();
}

/* ── navigation ───────────────────────────────────────────────────────── */
export const navigate = (route: Route) => set({ route, viewer: null, editorId: null });
export const setTab = (tab: TabId) => set({ activeTab: tab, route: { name: 'tabs' } });
export const openViewer = (ids: string[], index: number, origin?: { x: number; y: number; w: number; h: number }) => {
  set({ viewer: { ids, index, origin } });
  recordView(ids[index]);
};
export function recordView(id?: string) {
  if (!id) return;
  const next = [id, ...state.recentlyViewed.filter((x) => x !== id)].slice(0, 40);
  set({ recentlyViewed: next });
  persist();
}
export function closeViewer() {
  if (!state.viewer || state.viewer.closing) return;
  set({ viewer: { ...state.viewer, closing: true } });
  setTimeout(() => set({ viewer: null }), 240);
}
export const openEditor = (id: string) => set({ editorId: id, viewer: null });
export const closeEditor = () => set({ editorId: null });
export const openShare = (ids: string[]) => set({ shareIds: ids });
export const closeShare = () => set({ shareIds: null });
/** ask the current screen's grid to enter multi-select (menu → Select) */
export const requestSelect = () => set({ selectRequest: state.selectRequest + 1 });
export const requestSearch = (q: string | null) => set({ pendingSearch: q });

/* ── library mutations ────────────────────────────────────────────────── */
const mutate = (fn: () => void) => { fn(); set({ items: [...state.items] }); persist(); };

export function setFavorite(ids: string[], value: boolean) {
  mutate(() => { for (const id of ids) { const i = state.items.find((x) => x.id === id); if (i) i.favorite = value; } });
}
export function toggleFavorite(id: string) {
  const item = state.items.find((i) => i.id === id);
  if (item) setFavorite([id], !item.favorite);
}
export function trashItems(ids: string[]) {
  const now = Date.now();
  mutate(() => { for (const id of ids) { const i = state.items.find((x) => x.id === id); if (i) i.trashedAt = now; } });
  toast(`Moved ${ids.length} item${ids.length > 1 ? 's' : ''} to Recycle bin`, {
    label: 'Undo',
    run: () => restoreItems(ids),
  });
}
export function restoreItems(ids: string[]) {
  mutate(() => { for (const id of ids) { const i = state.items.find((x) => x.id === id); if (i) i.trashedAt = null; } });
}
export function purgeItems(ids: string[]) {
  mutate(() => { state.items = state.items.filter((i) => !ids.includes(i.id)); });
}
export function emptyTrash() {
  const ids = state.items.filter((i) => i.trashedAt !== null).map((i) => i.id);
  purgeItems(ids);
  toast('Recycle bin emptied');
}
export function setLocked(ids: string[], locked: boolean) {
  mutate(() => { for (const id of ids) { const i = state.items.find((x) => x.id === id); if (i) i.locked = locked; } });
  toast(locked ? `Locked ${ids.length} item${ids.length > 1 ? 's' : ''}` : 'Removed from Locked folder');
}
export function saveEdits(id: string, edits: EditState) {
  mutate(() => { const i = state.items.find((x) => x.id === id); if (i) i.edits = edits; });
}
export function saveEditCopy(id: string, edits: EditState) {
  const src = state.items.find((i) => i.id === id);
  if (!src) return;
  const copy: MediaItem = {
    ...src,
    id: `${src.id}-copy-${Date.now().toString(36)}`,
    title: `${src.title} (edited)`,
    takenAt: Date.now(),
    favorite: false,
    trashedAt: null,
    locked: false,
    edits,
    vision: undefined,
    generated: true,
  };
  mutate(() => { state.items = [copy, ...state.items]; });
  toast('Saved a copy');
}
export function setHidden(ids: string[], hidden: boolean) {
  mutate(() => { for (const id of ids) { const i = state.items.find((x) => x.id === id); if (i) i.hidden = hidden; } });
  toast(hidden ? `Hidden ${ids.length} item${ids.length > 1 ? 's' : ''}` : 'Unhidden');
}
export function renameItem(id: string, title: string) {
  mutate(() => { const i = state.items.find((x) => x.id === id); if (i) i.title = title; });
  toast('Renamed');
}
export function duplicateItem(id: string) {
  const src = state.items.find((i) => i.id === id);
  if (!src) return;
  const copy: MediaItem = { ...src, id: `${src.id}-copy-${Date.now().toString(36)}`, title: `${src.title} (copy)`, takenAt: Date.now(), favorite: false, trashedAt: null, locked: false, hidden: false, vision: undefined, generated: true, edits: structuredClone(src.edits) };
  mutate(() => { state.items = [copy, ...state.items]; });
  toast('Copied');
}

/**
 * Add an item generated inside the app (collage, extracted video frame,
 * edited export…). `src` must be a data: URL for the item to survive reloads.
 */
export function addGeneratedItem(partial: Omit<MediaItem, 'favorite' | 'trashedAt' | 'locked' | 'hidden' | 'edits'> & { edits?: EditState }): MediaItem {
  const item: MediaItem = {
    favorite: false,
    trashedAt: null,
    locked: false,
    hidden: false,
    edits: partial.edits ?? emptyEdit(),
    ...partial,
    generated: true,
  } as MediaItem;
  mutate(() => { state.items = [item, ...state.items]; });
  return item;
}

/** Re-run the on-device scan (menu → Refresh / Scan). */
export async function rescanLibrary() {
  const items = state.items;
  set({ status: 'scanning', scan: { done: 0, total: items.length } });
  const report = await scanLibrary(items, (done, total) => set({ scan: { done, total } }));
  set({ report, status: 'ready', items: [...state.items] });
  persist();
  toast(`Rescanned ${report.items} items on-device`);
}

export function createAlbum(name: string): string {
  const id = `album-${Date.now().toString(36)}`;
  set({ customAlbums: [...state.customAlbums, { id, name, itemIds: [], createdAt: Date.now() }] });
  persist();
  return id;
}
export function renameAlbum(id: string, name: string) {
  set({ customAlbums: state.customAlbums.map((a) => (a.id === id ? { ...a, name } : a)) });
  persist();
}
export function deleteAlbum(id: string) {
  set({ customAlbums: state.customAlbums.filter((a) => a.id !== id) });
  persist();
  toast('Album deleted');
}
export function addToAlbum(albumId: string, ids: string[]) {
  set({
    customAlbums: state.customAlbums.map((a) => (a.id === albumId ? { ...a, itemIds: [...new Set([...a.itemIds, ...ids])] } : a)),
  });
  persist();
  toast(`Added ${ids.length} to album`);
}
export function removeFromAlbum(albumId: string, ids: string[]) {
  set({
    customAlbums: state.customAlbums.map((a) => (a.id === albumId ? { ...a, itemIds: a.itemIds.filter((x) => !ids.includes(x)) } : a)),
  });
  persist();
}
export function renameFace(id: string, name: string) {
  set({ faceNames: { ...state.faceNames, [id]: name } });
  persist();
}
export function setSettings(patch: Partial<Settings>) {
  set({ settings: { ...state.settings, ...patch } });
  persist();
}
export function setTabOrder(order: TabId[]) {
  setSettings({ tabOrder: order });
}
export function pushRecentSearch(q: string) {
  const next = [q, ...state.recentSearches.filter((s) => s !== q)].slice(0, 8);
  set({ recentSearches: next });
  persist();
}
export function clearRecentSearches() {
  set({ recentSearches: [] });
  persist();
}
export function setWallpaperSeed(seed: string | null) {
  set({ wallpaperSeed: seed });
}
export function runBackup(onDone: () => void) {
  const { settings } = state;
  setTimeout(() => {
    setSettings({ backup: { ...settings.backup, enabled: true, lastBackupAt: Date.now() } });
    onDone();
  }, 1800);
}
export function resetAll() {
  localStorage.removeItem(LS_KEY);
  location.reload();
}
