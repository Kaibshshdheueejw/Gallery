/** Device media-store datasource: bundles manifest + curated EXIF into entities. */
import type { CameraMeta, MediaItem } from '../models';
import { emptyEdit } from '../models';
import { CURATED } from './curated';
import { buildScreenshotItems } from './screenshots';

interface ManifestEntry { id: string; file: string; thumb?: string; w: number; h: number; bytes: number }

const FALLBACK_CAM: CameraMeta = { model: 'Pixel 9 Pro', lens: '24mm f/1.7', iso: 100, shutter: '1/240s', aperture: 'f/1.7' };

const pretty = (id: string) =>
  id
    .replace(/-\d+$/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());

export async function loadLibrary(base = import.meta.env.BASE_URL): Promise<MediaItem[]> {
  const res = await fetch(`${base}media/manifest.json`);
  const manifest: ManifestEntry[] = await res.json();

  const items: MediaItem[] = manifest.map((entry) => {
    const meta = CURATED[entry.id];
    const isVideo = Boolean(meta?.video);
    return {
      id: entry.id,
      kind: isVideo ? 'video' : 'photo',
      src: `${base}${entry.file}`,
      thumb: entry.thumb ? `${base}${entry.thumb}` : undefined,
      w: entry.w,
      h: entry.h,
      bytes: entry.bytes,
      takenAt: meta ? new Date(meta.at).getTime() : Date.now(),
      title: meta?.title ?? pretty(entry.id),
      folder: meta?.folder ?? 'Camera',
      place: meta?.place,
      event: meta?.event,
      camera: { ...FALLBACK_CAM, ...(meta?.camera ?? {}) },
      ocr: meta?.ocr,
      faces: meta?.faces,
      personIds: meta?.personIds,
      video: meta?.video,
      favorite: false,
      trashedAt: null,
      locked: false,
      hidden: false,
      edits: emptyEdit(),
    };
  });

  items.push(...buildScreenshotItems());
  items.sort((a, b) => b.takenAt - a.takenAt);
  return items;
}
