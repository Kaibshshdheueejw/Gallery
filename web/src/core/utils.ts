/** Shared, framework-free helpers. */

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

const DAY = 86_400_000;

export const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
export const startOfMonth = (t: number) => {
  const d = new Date(t);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
export const startOfYear = (t: number) => {
  const d = new Date(t);
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export const dayKey = (t: number) => startOfDay(t).toString();
export const monthKey = (t: number) => startOfMonth(t).toString();
export const yearKey = (t: number) => startOfYear(t).toString();

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function formatDateLong(t: number): string {
  const d = new Date(t);
  return `${WDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
export function formatMonthYear(t: number): string {
  const d = new Date(t);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
export function formatDayHeader(t: number): string {
  const today = startOfDay(Date.now());
  const day = startOfDay(t);
  if (day === today) return 'Today';
  if (day === today - DAY) return 'Yesterday';
  return formatDateLong(t);
}
export function formatTime(t: number): string {
  const d = new Date(t);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ap = h < 12 ? 'AM' : 'PM';
  return `${((h + 11) % 12) + 1}:${m} ${ap}`;
}
export function relativeTime(t: number): string {
  const diff = Date.now() - t;
  const days = Math.floor(diff / DAY);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years > 1 ? 's' : ''} ago`;
}

/** Stable 32-bit string hash (for deterministic pseudo-random per-item data). */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function seededRandom(seed: number): () => number {
  let a = seed || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export interface Group<T> { key: string; id: string; items: T[] }

export function groupBy<T>(list: T[], key: (item: T) => string): Array<Group<T>> {
  const out: Array<Group<T>> = [];
  const index = new Map<string, T[]>();
  for (const item of list) {
    const k = key(item);
    let bucket = index.get(k);
    if (!bucket) {
      bucket = [];
      index.set(k, bucket);
      out.push({ key: k, id: k, items: bucket });
    }
    bucket.push(item);
  }
  return out;
}
