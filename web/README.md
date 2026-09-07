# Nova Gallery — web test build

Browser-runnable prototype of the Flutter spec in [`../README.md`](../README.md), built so the
app can be exercised end-to-end in the Arena workspace preview (the Flutter SDK / mobile
emulators are not available in this sandbox).

```bash
cd web
npm install
npm run dev        # http://localhost:5173  (bound to 0.0.0.0 for the workspace preview)
npm run typecheck  # tsc --noEmit
```

Domain-logic smoke tests (natural-language search, albums, memories, storage insights):

```bash
npx esbuild scripts/smoke-test.ts --bundle --platform=node --format=cjs --outfile=/tmp/smoke.cjs && node /tmp/smoke.cjs
```

Sample media is prepared from bundled stock thumbnails:

```bash
node ../scripts/prepare-media.mjs   # normalizes image-search/* into public/media + manifest.json
```

## What is real vs simulated

| Spec feature (README.md) | Implementation here |
|---|---|
| Timeline with sticky day/month/year headers, pinch-to-zoom grid | Real — pinch, Ctrl/Cmd-scroll and the zoom buttons change density; grouping follows |
| Adaptive thumbnails, 1:1 / 4:3 / original ratio | Real (Settings → Display) |
| Natural-language smart search | Real parser: dates (“from July”, “last month”, “2025”), people, places, media types, objects, OCR text |
| On-device duplicate & similar detection | Real — 64-bit average-hash over pixels + hamming grouping |
| Blurry-shot detection | Real — laplacian variance, relative threshold |
| Scene tagging (sunset / night / nature…) | Real colour-statistic heuristics |
| Face detection & grouping | Simulated boxes/clusters (curated), rename + people search work |
| OCR text search | Simulated extraction (curated text incl. the synthetic screenshots) |
| Video playback with trim, mute, speed | Real player controls over a canvas Ken-Burns stream + WebAudio ambient bed |
| Editor: crop, rotate, flip, filters, adjustments, AI enhance, magic eraser, portrait blur, markup | Real canvas pipeline; save / save-as-copy / PNG export |
| Locked folder with biometrics | Simulated fingerprint scan + PIN pad (default PIN `1234`) |
| Recycle bin with retention + auto-purge | Real, retention configurable in Settings |
| Material You dynamic colour | Real — seed sampled from the dominant colour of your newest photo, or fixed seeds |
| Customizable home layout (tab reorder) | Real — drag or arrow buttons in Settings → Display |
| l10n | EN / हिन्दी / বাংলা / ES string tables (`src/core/i18n.ts`) |
| Encrypted cloud backup (BYO provider) | Simulated provider/endpoint/progress, settings persisted |
| Storage insights & one-tap cleanup | Real, from the pixel statistics above |

State (favourites, trash, locks, edits, face names, settings, recent searches) persists in
`localStorage`; **Settings → Reset demo data** restores the factory library.

## Layout

Mirrors the Clean-Architecture tree from the spec:

```
src/
├── core/        # theme (Material You tokens), i18n, icons, utils
├── data/        # models, datasources (media store, curated EXIF, screenshots)
├── domain/      # use-cases: smartSearch, library, storageInsights
├── ml/          # on-device pipelines (hashing, sharpness, colour stats, scan loop)
├── features/    # timeline, albums, search, foryou, viewer, editor, locked, trash, settings, storage, share
├── components/  # grid, selection, sheets, toasts
└── store.ts     # presentation state container + persistence
```

## Testing tour (60 seconds)

1. **For You** — memories carousel, “On this day”, duplicate/blurry cleanup cards, storage donut.
2. **Timeline** — pinch or Ctrl-scroll to regroup day→month→year; long-press to multi-select; drag the right scrubber.
3. **Search** — type `sunset beach photos from July`, `receipts with invoice`, `Meera 2026`.
4. **Viewer** — open a video for trim/speed/mute; open a photo → Details → face boxes + OCR.
5. **Editor** — filters, adjust sliders, AI enhance, magic eraser (paint over something), markup, crop; Save / Save as copy / Export.
6. **Albums** — people (rename), places, smart albums, folders; Locked folder (PIN `1234`); Recycle bin.
7. **Settings** — theme seeds + Material You, tab reorder, language, retention, backup, data-usage transparency.
