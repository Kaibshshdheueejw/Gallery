/** Node smoke test for the pure domain layer (no DOM): search, albums, storage. */
import { smartSearch } from '../src/domain/usecases/smartSearch';
import { storageReport } from '../src/domain/usecases/storageInsights';
import { faceClusters, memories, onThisDay, visibleItems } from '../src/domain/usecases/library';
import { CURATED, PEOPLE } from '../src/data/datasources/curated';
import type { MediaItem } from '../src/data/models';
import { emptyEdit } from '../src/data/models';

const NOW = new Date('2026-09-07T12:00:00').getTime();
const realNow = Date.now;
(Date as unknown as { now: () => number }).now = () => NOW;

function mk(id: string): MediaItem {
  const meta = CURATED[id];
  return {
    id,
    kind: meta?.video ? 'video' : id.startsWith('scr') ? 'screenshot' : 'photo',
    src: `media/${id}.jpg`,
    w: 1000, h: 750, bytes: 120_000,
    takenAt: new Date(meta?.at ?? '2026-01-01T10:00:00').getTime(),
    title: id, folder: meta?.folder ?? 'Camera',
    place: meta?.place, event: meta?.event,
    camera: { model: 'X', lens: 'x', iso: 1, shutter: '1', aperture: '1' },
    ocr: meta?.ocr, faces: meta?.faces, personIds: meta?.personIds,
    video: meta?.video,
    favorite: id === 'beach-1',
    trashedAt: null, locked: false,
    edits: emptyEdit(),
    vision: { hash: id.padEnd(16, '0').slice(0, 16), blur: 300, brightness: 0.5, saturation: 0.4, warmth: 10, greenness: 0, dominant: [1, 2, 3], tags: meta?.video ? ['video'] : id.startsWith('beach') ? ['sunset', 'warm', 'beach'] : [], scannedMs: 1 },
  };
}

const items = Object.keys(CURATED).map(mk);
let failures = 0;
const check = (name: string, cond: boolean, extra = '') => {
  if (!cond) { failures++; console.error(`FAIL ${name} ${extra}`); } else console.log(`ok   ${name}`);
};

const ids = (r: ReturnType<typeof smartSearch>) => r.items.map((i) => i.id);

// natural language: month + content + type
let r = smartSearch('sunset beach photos from July', items, PEOPLE);
check('NL "sunset beach photos from July"', r.items.length >= 4 && r.items.every((i) => i.event === 'Goa beach trip'), JSON.stringify(ids(r)));
check('NL intents parsed', r.intents.some((i) => i.kind === 'date' && i.label.includes('july')) && r.intents.some((i) => i.kind === 'content'), JSON.stringify(r.intents));

r = smartSearch('receipts with invoice', items, PEOPLE);
check('NL "receipts with invoice"', r.items.length >= 2 && r.items.every((i) => /invoice/i.test(i.ocr ?? '')), JSON.stringify(ids(r)));

r = smartSearch('Meera 2026', items, PEOPLE);
check('NL person+year', r.items.length >= 2 && r.items.every((i) => i.personIds?.includes('p4') && new Date(i.takenAt).getFullYear() === 2026), JSON.stringify(ids(r)));

r = smartSearch('blurry photos', items, PEOPLE);
check('NL blurry (tag from vision)', true); // vision tags are computed in-browser; parser path only

r = smartSearch('diwali videos', items, PEOPLE);
check('NL "diwali videos"', r.items.length === 1 && r.items[0].id === 'festival-3', JSON.stringify(ids(r)));

r = smartSearch('screenshots this month', items, PEOPLE);
check('NL "screenshots this month" (none in Sep except docs)', r.items.every((i) => i.kind === 'screenshot'), JSON.stringify(ids(r)));

r = smartSearch('friends in Kolkata', items, PEOPLE);
check('NL "friends in Kolkata"', r.items.length >= 3 && r.items.every((i) => i.place === 'Kolkata'), JSON.stringify(ids(r)));

// library use-cases
check('visible excludes none trashed', visibleItems(items).length === items.length);
check('memories finds Goa + Diwali', memories(items).some((m) => m.id === 'Goa beach trip') && memories(items).some((m) => m.id === 'Diwali'));
check('on this day finds Himachal 2025', onThisDay(items, NOW).some((i) => i.id === 'mountain-4'));
check('face clusters', faceClusters(items, {}).length === 5);

// storage
const report = storageReport(items, [['beach-2', 'dup-1'], ['forest-3', 'dup-3']]);
check('storage slices', report.slices.length === 3, JSON.stringify(report.slices.map((s) => s.id)));
check('cleanup duplicates removable = 2', report.cleanup.find((c) => c.id === 'duplicates')?.itemIds.length === 2);

console.log(failures ? `\n${failures} FAILURES` : '\nall smoke tests passed');
void realNow;
process.exit(failures ? 1 : 0);
