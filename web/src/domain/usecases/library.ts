/** Read-side use-cases: deriving albums, clusters and collections from the library. */
import type { FaceCluster, MediaItem } from '../../data/models';
import { PEOPLE } from '../../data/datasources/curated';
import { groupBy, startOfDay, startOfMonth } from '../../core/utils';

export const isTrashed = (i: MediaItem) => i.trashedAt !== null;
export const isVisible = (i: MediaItem) => !isTrashed(i) && !i.locked && !i.hidden;
export const hiddenItems = (items: MediaItem[]) => items.filter((i) => i.hidden && !isTrashed(i));

export const trashedItems = (items: MediaItem[]) => items.filter(isTrashed).sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0));
export const lockedItems = (items: MediaItem[]) => items.filter((i) => i.locked && !isTrashed(i));
export const visibleItems = (items: MediaItem[]) => items.filter(isVisible);

export const favorites = (items: MediaItem[]) => visibleItems(items).filter((i) => i.favorite);
export const videos = (items: MediaItem[]) => visibleItems(items).filter((i) => i.kind === 'video');
export const screenshots = (items: MediaItem[]) => visibleItems(items).filter((i) => i.kind === 'screenshot');
export const documents = (items: MediaItem[]) => visibleItems(items).filter((i) => i.ocr && i.kind !== 'screenshot');
export const blurryItems = (items: MediaItem[]) => visibleItems(items).filter((i) => i.vision?.tags.includes('blurry'));
export const duplicateItems = (items: MediaItem[]) => visibleItems(items).filter((i) => i.vision?.tags.includes('duplicate'));

export function folders(items: MediaItem[]) {
  return groupBy(visibleItems(items), (i) => i.folder).sort((a, b) => b.items.length - a.items.length);
}

export function places(items: MediaItem[]) {
  return groupBy(visibleItems(items).filter((i) => i.place), (i) => i.place!)
    .filter((g) => g.items.length >= 2)
    .sort((a, b) => b.items.length - a.items.length);
}

export function events(items: MediaItem[]) {
  return groupBy(visibleItems(items).filter((i) => i.event), (i) => i.event!)
    .sort((a, b) => b.items[0].takenAt - a.items[0].takenAt);
}

export const largeFiles = (items: MediaItem[]) =>
  visibleItems(items).filter((i) => i.bytes >= 90_000).sort((a, b) => b.bytes - a.bytes);

export function recentlyViewedItems(items: MediaItem[], viewed: string[]): MediaItem[] {
  const map = new Map(items.map((i) => [i.id, i]));
  return viewed.map((id) => map.get(id)).filter((i): i is MediaItem => Boolean(i) && isVisible(i as MediaItem));
}

export function faceClusters(items: MediaItem[], names: Record<string, string>): FaceCluster[] {
  const clusters = new Map<string, string[]>();
  for (const item of visibleItems(items)) {
    for (const pid of item.personIds ?? []) {
      const list = clusters.get(pid) ?? [];
      list.push(item.id);
      clusters.set(pid, list);
    }
  }
  return [...clusters.entries()]
    .map(([id, itemIds]) => ({ id, name: names[id] ?? PEOPLE[id] ?? `Person ${id}`, itemIds }))
    .sort((a, b) => b.itemIds.length - a.itemIds.length);
}

/** Items taken on the same calendar day in previous years ("On this day"). */
export function onThisDay(items: MediaItem[], now = Date.now()): MediaItem[] {
  const d = new Date(now);
  return visibleItems(items).filter((i) => {
    const t = new Date(i.takenAt);
    const yearDiff = d.getFullYear() - t.getFullYear();
    return yearDiff >= 1 && t.getMonth() === d.getMonth() && Math.abs(t.getDate() - d.getDate()) <= 1;
  });
}

/** Curated memory collections: events with 3+ items, newest first. */
export function memories(items: MediaItem[]) {
  return events(items)
    .filter((e) => e.items.length >= 3)
    .map((e) => ({ ...e, at: e.items[0].takenAt }))
    .sort((a, b) => b.at - a.at);
}

export function byDay(items: MediaItem[]) {
  return groupBy(items, (i) => startOfDay(i.takenAt).toString()).sort((a, b) => Number(b.key) - Number(a.key));
}
export function byMonth(items: MediaItem[]) {
  return groupBy(items, (i) => startOfMonth(i.takenAt).toString()).sort((a, b) => Number(b.key) - Number(a.key));
}
