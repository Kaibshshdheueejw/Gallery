/**
 * Natural-language smart search.
 * Parses a free-text query into intents (dates, people, places, media types,
 * objects/scenes, OCR text) and intersects them over the visible library —
 * e.g. "sunset beach photos from July", "receipts with invoice", "Meera 2026".
 */
import type { MediaItem } from '../../data/models';
import { isVisible } from './library';
import { formatDateLong } from '../../core/utils';

export interface Intent { kind: 'date' | 'person' | 'place' | 'type' | 'content'; label: string }
export interface SearchResult { items: MediaItem[]; intents: Intent[]; tokens: string[] }

const MONTHS: Record<string, number> = {
  january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3,
  may: 4, june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7, september: 8, sep: 8, sept: 8,
  october: 9, oct: 9, november: 10, nov: 10, december: 11, dec: 11,
};

const PLACES = ['goa', 'kolkata', 'agartala', 'shillong', 'manali', 'uttarakhand', 'meghalaya', 'tripura', 'home', 'office'];

const STOP = new Set(['from', 'with', 'of', 'in', 'on', 'at', 'the', 'a', 'an', 'my', 'me', 'to', 'and', 'or', 'for', 'show', 'find', 'search', 'all', 'any', 'taken', 'during', 'that', 'have', 'has', 'is', 'are', 'please', 'pls']);

const TYPE_WORDS: Record<string, (i: MediaItem) => boolean> = {
  video: (i) => i.kind === 'video',
  videos: (i) => i.kind === 'video',
  photo: (i) => i.kind === 'photo',
  photos: (i) => i.kind === 'photo',
  picture: (i) => i.kind === 'photo',
  pictures: (i) => i.kind === 'photo',
  pic: (i) => i.kind === 'photo',
  pics: (i) => i.kind === 'photo',
  screenshot: (i) => i.kind === 'screenshot',
  screenshots: (i) => i.kind === 'screenshot',
  document: (i) => Boolean(i.ocr),
  documents: (i) => Boolean(i.ocr),
  docs: (i) => Boolean(i.ocr),
  receipt: (i) => Boolean(i.ocr) && i.kind !== 'screenshot',
  receipts: (i) => Boolean(i.ocr) && i.kind !== 'screenshot',
  bill: (i) => Boolean(i.ocr) && i.kind !== 'screenshot',
  bills: (i) => Boolean(i.ocr) && i.kind !== 'screenshot',
  invoice: (i) => Boolean(i.ocr) && /invoice/i.test(i.ocr ?? ''),
  selfie: (i) => (i.faces?.length ?? 0) >= 2,
  selfieies: (i) => (i.faces?.length ?? 0) >= 2,
  favorite: (i) => i.favorite,
  favourites: (i) => i.favorite,
  favorites: (i) => i.favorite,
};

const SYNONYMS: Record<string, string[]> = {
  beach: ['beach', 'sea', 'ocean', 'sand', 'goa'],
  sea: ['beach', 'sea', 'ocean'],
  ocean: ['beach', 'sea', 'ocean'],
  sunset: ['sunset', 'sunrise', 'dusk'],
  dog: ['dog', 'pet', 'puppy'],
  cat: ['cat', 'kitten', 'pet'],
  pet: ['pet', 'dog', 'cat'],
  flower: ['flower', 'garden', 'macro', 'blossom'],
  food: ['food', 'curry', 'thali', 'dish', 'eat'],
  curry: ['curry', 'thali', 'food'],
  city: ['city', 'urban', 'street'],
  night: ['night', 'dark', 'lights'],
  diwali: ['diwali', 'festival', 'diya'],
  festival: ['festival', 'diwali', 'diya'],
  waterfall: ['waterfall', 'falls', 'forest'],
  forest: ['forest', 'waterfall', 'green', 'jungle'],
  mountain: ['mountain', 'lake', 'trek', 'peak', 'hill'],
  friends: ['friends', 'reunion', 'group'],
  people: ['people', 'faces', 'person'],
  blurry: ['blurry', 'blur', 'out of focus'],
  duplicate: ['duplicate', 'duplicates', 'similar'],
};

function haystack(i: MediaItem, personNames: string[]): string {
  return [
    i.title, i.event, i.place, i.folder, i.ocr, i.kind,
    ...(i.vision?.tags ?? []),
    ...personNames,
    formatDateLong(i.takenAt),
    new Date(i.takenAt).getFullYear().toString(),
  ].filter(Boolean).join(' ').toLowerCase();
}

interface DateRange { from: number; to: number; label: string }

function relativeRange(tokens: string[], now: number): DateRange | null {
  const q = tokens.join(' ');
  const d = new Date(now);
  const dayMs = 86_400_000;
  const startOfDay = (t: number) => { const x = new Date(t); x.setHours(0, 0, 0, 0); return x.getTime(); };
  if (/\btoday\b/.test(q)) return { from: startOfDay(now), to: now + dayMs, label: 'today' };
  if (/\byesterday\b/.test(q)) return { from: startOfDay(now - dayMs), to: startOfDay(now), label: 'yesterday' };
  if (/\bthis week\b/.test(q)) { const f = startOfDay(now - ((d.getDay() + 6) % 7) * dayMs); return { from: f, to: now + dayMs, label: 'this week' }; }
  if (/\blast week\b/.test(q)) { const f = startOfDay(now - ((d.getDay() + 6) % 7 + 7) * dayMs); return { from: f, to: f + 7 * dayMs, label: 'last week' }; }
  if (/\bthis month\b/.test(q)) { const f = new Date(d.getFullYear(), d.getMonth(), 1).getTime(); return { from: f, to: now + dayMs, label: 'this month' }; }
  if (/\blast month\b/.test(q)) { const f = new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime(); const t = new Date(d.getFullYear(), d.getMonth(), 1).getTime(); return { from: f, to: t, label: 'last month' }; }
  if (/\bthis year\b/.test(q)) { const f = new Date(d.getFullYear(), 0, 1).getTime(); return { from: f, to: now + dayMs, label: 'this year' }; }
  const lastYear = /\blast year\b/.test(q);
  if (lastYear) { const f = new Date(d.getFullYear() - 1, 0, 1).getTime(); const t = new Date(d.getFullYear(), 0, 1).getTime(); return { from: f, to: t, label: 'last year' }; }
  const daysAgo = q.match(/(\d+)\s+days?\s+ago/);
  if (daysAgo) { const n = Number(daysAgo[1]); return { from: startOfDay(now - n * dayMs), to: startOfDay(now - (n - 1) * dayMs), label: `${n} days ago` }; }
  const yearsAgo = q.match(/(\d+)\s+years?\s+ago/);
  if (yearsAgo) {
    const n = Number(yearsAgo[1]);
    const f = new Date(d.getFullYear() - n, 0, 1).getTime();
    const t = new Date(d.getFullYear() - n + 1, 0, 1).getTime();
    return { from: f, to: t, label: `${n} years ago` };
  }
  if (/\bweekend\b/.test(q)) { const f = startOfDay(now - ((d.getDay() + 6) % 7) * dayMs); return { from: f - 2 * dayMs, to: now + dayMs, label: 'the weekend' }; }
  return null;
}

function monthRange(tokens: string[], now: number): DateRange | null {
  for (let i = 0; i < tokens.length; i++) {
    const m = MONTHS[tokens[i]];
    if (m === undefined) continue;
    const d = new Date(now);
    let year = d.getFullYear();
    const next = tokens[i + 1];
    if (next && /^\d{4}$/.test(next)) year = Number(next);
    else if (new Date(year, m, 1).getTime() > now) year -= 1; // most recent occurrence
    const from = new Date(year, m, 1).getTime();
    const to = new Date(year, m + 1, 1).getTime();
    return { from, to, label: `${tokens[i]}${year !== d.getFullYear() ? ` ${year}` : ''}` };
  }
  return null;
}

function yearRange(tokens: string[], now: number): DateRange | null {
  const y = tokens.find((t) => /^(19|20)\d{2}$/.test(t));
  if (!y) return null;
  const year = Number(y);
  if (year > new Date(now).getFullYear() + 1 || year < 2000) return null;
  return { from: new Date(year, 0, 1).getTime(), to: new Date(year + 1, 0, 1).getTime(), label: y };
}

export function smartSearch(query: string, items: MediaItem[], faceNames: Record<string, string>): SearchResult {
  const raw = query.trim().toLowerCase();
  const intents: Intent[] = [];
  if (!raw) return { items: [], intents, tokens: [] };

  let tokens = raw
    .replace(/[?!,.;:'"]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const pool = items.filter(isVisible);
  let result = pool;

  // ── dates ────────────────────────────────────────────────────────────────
  const range = relativeRange(tokens, Date.now()) ?? monthRange(tokens, Date.now()) ?? yearRange(tokens, Date.now());
  if (range) {
    result = result.filter((i) => i.takenAt >= range.from && i.takenAt < range.to);
    intents.push({ kind: 'date', label: range.label });
    tokens = tokens.filter((t) => !MONTHS[t] && !/^(19|20)\d{2}$/.test(t) && !['today', 'yesterday', 'weekend', 'ago', 'days', 'day', 'weeks', 'week', 'months', 'month', 'years', 'year', 'this', 'last', 'this'].includes(t) && !/^\d+$/.test(t));
  }

  // ── people ───────────────────────────────────────────────────────────────
  const nameToIds = new Map<string, string[]>();
  for (const item of pool) for (const pid of item.personIds ?? []) {
    const name = (faceNames[pid] ?? '').toLowerCase();
    if (!name) continue;
    const list = nameToIds.get(name) ?? [];
    list.push(item.id);
    nameToIds.set(name, list);
  }
  const remaining: string[] = [];
  const personFilters: string[][] = [];
  for (const t of tokens) {
    if (nameToIds.has(t)) {
      personFilters.push(nameToIds.get(t)!);
      intents.push({ kind: 'person', label: t[0].toUpperCase() + t.slice(1) });
    } else remaining.push(t);
  }
  tokens = remaining;
  for (const ids of personFilters) {
    const set = new Set(ids);
    result = result.filter((i) => set.has(i.id));
  }

  // ── places ───────────────────────────────────────────────────────────────
  const kept: string[] = [];
  for (const t of tokens) {
    if (PLACES.includes(t)) {
      const place = t;
      result = result.filter((i) => (i.place ?? '').toLowerCase().includes(place) || (place === 'home' && i.folder === 'Camera' && (i.event ?? '').toLowerCase().includes('home')) || (i.event ?? '').toLowerCase().includes(place));
      intents.push({ kind: 'place', label: place[0].toUpperCase() + place.slice(1) });
    } else kept.push(t);
  }
  tokens = kept;

  // ── media types ──────────────────────────────────────────────────────────
  const kept2: string[] = [];
  for (const t of tokens) {
    const fn = TYPE_WORDS[t];
    if (fn) {
      result = result.filter(fn);
      intents.push({ kind: 'type', label: t });
    } else kept2.push(t);
  }
  tokens = kept2.filter((t) => !STOP.has(t));

  // ── content / objects / OCR text ─────────────────────────────────────────
  for (const t of tokens) {
    const variants = SYNONYMS[t] ?? [t];
    result = result.filter((i) => {
      const names = (i.personIds ?? []).map((pid) => faceNames[pid] ?? '');
      const hay = haystack(i, names);
      return variants.some((v) => hay.includes(v));
    });
    intents.push({ kind: 'content', label: t });
  }

  return { items: result.sort((a, b) => b.takenAt - a.takenAt), intents, tokens };
}

export const EXAMPLE_QUERIES = [
  'sunset beach photos from July',
  'receipts with invoice',
  'blurry photos',
  'friends in Kolkata',
  'Meera 2026',
  'diwali videos',
  'screenshots this month',
  'waterfall last year',
];
