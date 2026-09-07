/** Storage insights: what is eating the space, and one-tap cleanup candidates. */
import type { MediaItem } from '../../data/models';
import { visibleItems } from './library';
import { formatBytes } from '../../core/utils';

export interface StorageSlice { id: string; label: string; bytes: number; count: number; color: string; itemIds: string[] }

export interface StorageReport {
  total: number;
  slices: StorageSlice[];
  cleanup: Array<{ id: string; label: string; hint: string; bytes: number; itemIds: string[] }>;
}

const DAY = 86_400_000;

export function storageReport(items: MediaItem[], duplicateGroups: string[][]): StorageReport {
  const vis = visibleItems(items);
  const sum = (list: MediaItem[]) => list.reduce((s, i) => s + i.bytes, 0);

  const videos = vis.filter((i) => i.kind === 'video');
  const shots = vis.filter((i) => i.kind === 'screenshot');
  const docs = vis.filter((i) => i.ocr && i.kind !== 'screenshot');
  const photos = vis.filter((i) => i.kind === 'photo');
  const blurry = vis.filter((i) => i.vision?.tags.includes('blurry'));
  // keep the first (sharpest/earliest) of each group, offer the rest for cleanup
  const dupRemovable = duplicateGroups.flatMap((g) => g.slice(1));
  const dupItems = vis.filter((i) => dupRemovable.includes(i.id));

  const slices: StorageSlice[] = [
    { id: 'videos', label: 'Videos', bytes: sum(videos), count: videos.length, color: '#7f9bff', itemIds: videos.map((i) => i.id) },
    { id: 'photos', label: 'Photos', bytes: sum(photos), count: photos.length, color: '#67d18a', itemIds: photos.map((i) => i.id) },
    { id: 'screenshots', label: 'Screenshots', bytes: sum(shots), count: shots.length, color: '#ffc46b', itemIds: shots.map((i) => i.id) },
    { id: 'documents', label: 'Documents', bytes: sum(docs), count: docs.length, color: '#ff8fa3', itemIds: docs.map((i) => i.id) },
  ].filter((s) => s.count > 0);

  const cleanup = [
    {
      id: 'duplicates',
      label: 'Duplicate & similar',
      hint: `${dupItems.length} extra copies · keeps the best of each group`,
      bytes: sum(dupItems),
      itemIds: dupItems.map((i) => i.id),
    },
    {
      id: 'blurry',
      label: 'Blurry shots',
      hint: 'flagged by the on-device sharpness model',
      bytes: sum(blurry),
      itemIds: blurry.map((i) => i.id),
    },
    {
      id: 'old-screenshots',
      label: 'Old screenshots',
      hint: 'older than 30 days',
      bytes: sum(shots.filter((i) => Date.now() - i.takenAt > 30 * DAY)),
      itemIds: shots.filter((i) => Date.now() - i.takenAt > 30 * DAY).map((i) => i.id),
    },
  ].filter((c) => c.itemIds.length > 0);

  return { total: sum(vis) || 1, slices, cleanup };
}

export const sliceLabel = (s: StorageSlice) => `${s.label} · ${formatBytes(s.bytes)}`;
