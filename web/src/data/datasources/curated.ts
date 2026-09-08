/**
 * Curated device-side metadata for the bundled sample library —
 * the equivalent of what the Flutter app reads from the media store + EXIF.
 * Dates are anchored around "today" so timeline, memories and natural-language
 * date queries ("from July", "last month") behave like a real camera roll.
 */
import type { CameraMeta, FaceBox } from '../models';

export interface CuratedMeta {
  at: string;                    // ISO local time
  folder: string;
  place?: string;
  event?: string;
  title?: string;
  ocr?: string;
  faces?: FaceBox[];
  personIds?: string[];
  video?: { duration: number; motion: 'zoomIn' | 'zoomOut' | 'panL' | 'panR' | 'panU' | 'panD' };
  camera?: Partial<CameraMeta>;
}

const PX9: CameraMeta = { model: 'Pixel 9 Pro', lens: '24mm f/1.7', iso: 64, shutter: '1/1200s', aperture: 'f/1.7' };
const S25: CameraMeta = { model: 'Galaxy S25 Ultra', lens: '23mm f/1.8', iso: 50, shutter: '1/900s', aperture: 'f/1.8' };
const IP16: CameraMeta = { model: 'iPhone 16', lens: '26mm f/1.6', iso: 80, shutter: '1/640s', aperture: 'f/1.6' };

export const PEOPLE: Record<string, string> = {
  p1: 'Maya',
  p2: 'David',
  p3: 'Liam',
  p4: 'Sofia',
  p5: 'Emma',
};

export const CURATED: Record<string, CuratedMeta> = {
  // ── Bali beach trip, July 2026 ────────────────────────────────────────────
  'beach-1': { at: '2026-07-14T18:42:00', folder: 'Camera', place: 'Bali', event: 'Bali beach trip', camera: PX9 },
  'beach-2': { at: '2026-07-14T18:51:00', folder: 'Camera', place: 'Bali', event: 'Bali beach trip', camera: PX9, video: { duration: 14, motion: 'panR' } },
  'beach-3': { at: '2026-07-15T06:18:00', folder: 'Camera', place: 'Bali', event: 'Bali beach trip', camera: S25 },
  'beach-4': { at: '2026-07-16T18:05:00', folder: 'Camera', place: 'Bali', event: 'Bali beach trip', camera: IP16 },
  'beach-5': { at: '2026-07-17T17:38:00', folder: 'Camera', place: 'Bali', event: 'Bali beach trip', camera: PX9 },
  'blur-1': { at: '2026-07-15T19:12:00', folder: 'Camera', place: 'Bali', event: 'Bali beach trip', camera: { ...PX9, shutter: '1/8s' } },
  'dup-1': { at: '2026-07-14T18:51:04', folder: 'Camera', place: 'Bali', event: 'Bali beach trip', camera: PX9 },

  // ── Dolomites trek, Dec 2025 ───────────────────────────────────────────
  'mountain-1': { at: '2025-12-20T08:12:00', folder: 'Camera', place: 'Dolomites', event: 'Dolomites trek', camera: S25 },
  'mountain-2': { at: '2025-12-20T16:40:00', folder: 'Camera', place: 'Dolomites', event: 'Dolomites trek', camera: S25 },
  'mountain-3': { at: '2025-12-21T07:05:00', folder: 'Camera', place: 'Dolomites', event: 'Dolomites trek', camera: PX9 },
  // ── Himachal, "on this day" last year ───────────────────────────────────
  'mountain-4': { at: '2025-09-06T09:22:00', folder: 'Camera', place: 'Interlaken', event: 'Swiss road trip', camera: IP16 },
  'mountain-5': { at: '2025-09-07T17:55:00', folder: 'Camera', place: 'Interlaken', event: 'Swiss road trip', camera: IP16 },

  // ── Bangkok street-food crawl, last month ──────────────────────────────
  'food-1': { at: '2026-08-02T13:24:00', folder: 'Camera', place: 'Bangkok', event: 'Street-food crawl', camera: PX9 },
  'food-2': { at: '2026-08-02T13:26:00', folder: 'Camera', place: 'Bangkok', event: 'Street-food crawl', camera: PX9 },
  'food-3': { at: '2026-08-02T14:02:00', folder: 'Instagram', place: 'Bangkok', event: 'Street-food crawl', camera: S25 },
  'food-4': { at: '2026-08-02T20:41:00', folder: 'Camera', place: 'Bangkok', event: 'Street-food crawl', camera: IP16 },
  'food-5': { at: '2026-08-02T21:15:00', folder: 'WhatsApp', place: 'Bangkok', event: 'Street-food crawl', camera: S25 },

  // ── Team headshots ──────────────────────────────────────────────────────
  'person-1': { at: '2026-03-11T11:05:00', folder: 'Camera', place: 'London', event: 'Team headshots', camera: IP16, faces: [{ x: 0.36, y: 0.12, w: 0.28, h: 0.34 }], personIds: ['p1'] },
  'person-2': { at: '2026-03-11T11:18:00', folder: 'Camera', place: 'London', event: 'Team headshots', camera: IP16, faces: [{ x: 0.34, y: 0.16, w: 0.3, h: 0.36 }], personIds: ['p2'] },
  'person-3': { at: '2026-03-11T11:32:00', folder: 'Camera', place: 'London', event: 'Team headshots', camera: IP16, faces: [{ x: 0.37, y: 0.14, w: 0.27, h: 0.32 }], personIds: ['p3'] },
  'person-4': { at: '2026-03-11T11:47:00', folder: 'Camera', place: 'London', event: 'Team headshots', camera: IP16, faces: [{ x: 0.35, y: 0.15, w: 0.28, h: 0.33 }], personIds: ['p4'] },

  // ── New York night walk ──────────────────────────────────────────────────
  'city-1': { at: '2026-01-25T21:14:00', folder: 'Camera', place: 'New York', event: 'Night walk', camera: { ...PX9, iso: 800, shutter: '1/30s' } },
  'city-2': { at: '2026-01-25T21:32:00', folder: 'Camera', place: 'New York', event: 'Night walk', camera: { ...PX9, iso: 1200, shutter: '1/20s' } },
  'city-3': { at: '2026-01-25T21:58:00', folder: 'Camera', place: 'New York', event: 'Night walk', camera: { ...PX9, iso: 640, shutter: '1/40s' }, video: { duration: 11, motion: 'zoomIn' } },
  'city-4': { at: '2026-01-25T22:20:00', folder: 'Camera', place: 'New York', event: 'Night walk', camera: { ...S25, iso: 1000, shutter: '1/25s' } },
  'city-5': { at: '2026-01-25T22:47:00', folder: 'Camera', place: 'New York', event: 'Night walk', camera: { ...S25, iso: 500, shutter: '1/60s' } },
  'blur-2': { at: '2026-01-25T22:31:00', folder: 'Camera', place: 'New York', event: 'Night walk', camera: { ...S25, iso: 1600, shutter: '1/6s' } },

  // ── Bills & receipts (OCR) ──────────────────────────────────────────────
  'doc-1': { at: '2026-06-11T12:20:00', folder: 'Downloads', place: 'Chicago', title: 'Cash bill — stationery', ocr: 'CASH RECEIPT  STATIONERY MART  24 Maple Street  Invoice No SM-2214  Notebooks x3  18.00  Pens x2  6.00  TOTAL 24.00  THANK YOU VISIT AGAIN', camera: PX9 },
  'doc-2': { at: '2026-07-03T17:44:00', folder: 'Downloads', place: 'Home', title: 'Invoice — broadband', ocr: 'INVOICE  NORTHSTAR FIBER  Bill period Jun 2026  Plan 300 Mbps  Amount 59.00  Tax 4.72  TOTAL DUE 63.72  Pay by 15 Jul 2026', camera: S25 },
  'doc-3': { at: '2026-08-14T10:02:00', folder: 'Downloads', place: 'Toronto', title: 'Receipts pile', ocr: 'RECEIPT  CITY PHARMACY  Ibuprofen 8.50  Cough syrup 12.75  TOTAL 21.25  CASH RECEIPT  Store 4471', camera: PX9 },
  'doc-4': { at: '2026-08-29T19:30:00', folder: 'Downloads', place: 'New York', title: 'Restaurant bill', ocr: 'TAX INVOICE  HARBOUR BISTRO  12 Dockside Ave New York  Grilled salmon 34.00  Lemonade 6.00  Service charge 4.00  Tax 2.20  GRAND TOTAL 46.20  THANK YOU', camera: IP16 },
  'doc-5': { at: '2026-09-04T09:15:00', folder: 'Downloads', place: 'Home', title: 'Bills stack', ocr: 'CASH RECEIPT  ELECTRIC HOUSE  LED bulb x2 16.00  Wiring kit 21.00  TOTAL 37.00  INVOICE EH-88912  THANK YOU CALL AGAIN', camera: S25 },

  // ── Pets ────────────────────────────────────────────────────────────────
  'pets-1': { at: '2026-05-18T10:12:00', folder: 'Camera', place: 'Home', event: 'Pets', camera: PX9, faces: [{ x: 0.3, y: 0.12, w: 0.34, h: 0.3 }], personIds: [] },
  'pets-2': { at: '2026-05-18T10:14:00', folder: 'Camera', place: 'Home', event: 'Pets', camera: PX9 },
  'pets-3': { at: '2026-05-18T17:40:00', folder: 'WhatsApp', place: 'Home', event: 'Pets', camera: S25 },
  'pets-4': { at: '2026-05-19T08:55:00', folder: 'Camera', place: 'Home', event: 'Pets', camera: IP16 },
  'pets-5': { at: '2026-05-19T09:02:00', folder: 'Camera', place: 'Home', event: 'Pets', camera: IP16 },

  // ── Terrace garden macro (this week) ────────────────────────────────────
  'flowers-1': { at: '2026-09-05T07:48:00', folder: 'Camera', place: 'Home', event: 'Terrace garden', camera: { ...PX9, lens: '100mm macro f/2.8', aperture: 'f/2.8' } },
  'flowers-2': { at: '2026-09-05T07:52:00', folder: 'Camera', place: 'Home', event: 'Terrace garden', camera: { ...PX9, lens: '100mm macro f/2.8', aperture: 'f/2.8' } },
  'flowers-3': { at: '2026-09-05T08:03:00', folder: 'Camera', place: 'Home', event: 'Terrace garden', camera: { ...S25, lens: 'macro f/2.4', aperture: 'f/2.4' } },
  'flowers-4': { at: '2026-09-06T07:31:00', folder: 'Camera', place: 'Home', event: 'Terrace garden', camera: { ...S25, lens: 'macro f/2.4', aperture: 'f/2.4' } },
  'flowers-5': { at: '2026-09-06T07:44:00', folder: 'Camera', place: 'Home', event: 'Terrace garden', camera: IP16 },

  // ── Lantern night at home, 2025 ────────────────────────────────────────────────
  'festival-1': { at: '2025-10-21T19:02:00', folder: 'Camera', place: 'Home', event: 'Lantern night', camera: { ...PX9, iso: 400, shutter: '1/40s' } },
  'festival-2': { at: '2025-10-21T19:24:00', folder: 'Camera', place: 'Home', event: 'Lantern night', camera: { ...PX9, iso: 500, shutter: '1/30s' } },
  'festival-3': { at: '2025-10-21T19:51:00', folder: 'Camera', place: 'Home', event: 'Lantern night', camera: { ...S25, iso: 640, shutter: '1/30s' }, video: { duration: 9, motion: 'zoomOut' } },
  'festival-4': { at: '2025-10-21T20:12:00', folder: 'Camera', place: 'Home', event: 'Lantern night', camera: IP16 },
  'festival-5': { at: '2025-10-21T20:40:00', folder: 'WhatsApp', place: 'Home', event: 'Lantern night', camera: S25 },
  'dup-2': { at: '2025-10-21T20:12:03', folder: 'Camera', place: 'Home', event: 'Lantern night', camera: IP16 },

  // ── Queenstown waterfalls ────────────────────────────────────────────────
  'forest-1': { at: '2026-06-12T11:20:00', folder: 'Camera', place: 'Queenstown', event: 'Queenstown weekend', camera: PX9 },
  'forest-2': { at: '2026-06-12T11:44:00', folder: 'Camera', place: 'Queenstown', event: 'Queenstown weekend', camera: PX9, video: { duration: 18, motion: 'panL' } },
  'forest-3': { at: '2026-06-12T15:10:00', folder: 'Camera', place: 'Queenstown', event: 'Queenstown weekend', camera: S25 },
  'forest-4': { at: '2026-06-13T09:36:00', folder: 'Camera', place: 'Queenstown', event: 'Queenstown weekend', camera: S25 },
  'forest-5': { at: '2026-06-13T10:02:00', folder: 'Camera', place: 'Queenstown', event: 'Queenstown weekend', camera: IP16 },
  'dup-3': { at: '2026-06-12T15:10:02', folder: 'Camera', place: 'Queenstown', event: 'Queenstown weekend', camera: S25 },

  // ── College friends reunion ─────────────────────────────────────────────
  'friends-1': { at: '2026-02-14T17:22:00', folder: 'Camera', place: 'Barcelona', event: 'Friends reunion', camera: IP16, faces: [{ x: 0.16, y: 0.3, w: 0.14, h: 0.2 }, { x: 0.36, y: 0.26, w: 0.15, h: 0.21 }, { x: 0.58, y: 0.3, w: 0.14, h: 0.2 }, { x: 0.76, y: 0.28, w: 0.14, h: 0.2 }], personIds: ['p4', 'p5', 'p1', 'p2'] },
  'friends-2': { at: '2026-02-14T17:35:00', folder: 'Camera', place: 'Barcelona', event: 'Friends reunion', camera: IP16, faces: [{ x: 0.2, y: 0.34, w: 0.15, h: 0.2 }, { x: 0.42, y: 0.3, w: 0.15, h: 0.21 }, { x: 0.63, y: 0.32, w: 0.15, h: 0.2 }], personIds: ['p5', 'p1', 'p3'] },
  'friends-3': { at: '2026-02-14T18:02:00', folder: 'WhatsApp', place: 'Barcelona', event: 'Friends reunion', camera: S25, faces: [{ x: 0.24, y: 0.3, w: 0.14, h: 0.2 }, { x: 0.46, y: 0.28, w: 0.15, h: 0.21 }, { x: 0.68, y: 0.3, w: 0.14, h: 0.2 }], personIds: ['p4', 'p5', 'p2'] },
  'friends-4': { at: '2026-02-14T18:26:00', folder: 'Camera', place: 'Barcelona', event: 'Friends reunion', camera: PX9, faces: [{ x: 0.18, y: 0.32, w: 0.15, h: 0.2 }, { x: 0.4, y: 0.3, w: 0.16, h: 0.22 }, { x: 0.64, y: 0.32, w: 0.15, h: 0.2 }, { x: 0.82, y: 0.34, w: 0.13, h: 0.18 }], personIds: ['p1', 'p5', 'p3', 'p4'] },
  'friends-5': { at: '2026-02-14T19:10:00', folder: 'Camera', place: 'Barcelona', event: 'Friends reunion', camera: PX9, faces: [{ x: 0.3, y: 0.3, w: 0.16, h: 0.22 }, { x: 0.55, y: 0.32, w: 0.15, h: 0.2 }], personIds: ['p2', 'p5'] },
  'blur-3': { at: '2026-02-14T18:44:00', folder: 'Camera', place: 'Barcelona', event: 'Friends reunion', camera: { ...PX9, shutter: '1/5s' } },
};
