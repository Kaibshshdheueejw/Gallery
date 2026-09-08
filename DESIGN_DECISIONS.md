# Gallery — Design Decisions

Living document required by the build prompt (§10). Every trade-off, reduced
scope, and version-sensitive choice is recorded here honestly.

## 0. Build environment & verification strategy

**Constraint:** the development sandbox for this repository has no Flutter
SDK and no network access to `storage.googleapis.com` / `pub.dev`, so the app
cannot be compiled locally here.

**Decision:** GitHub Actions is the compiler of record. `.github/workflows/
flutter.yml` runs `flutter pub get` → `flutter gen-l10n` → `flutter analyze`
→ `flutter test` → `flutter build apk --release` on every push, and uploads
the APK as an artifact. A stage is "done" only when its CI run is green.
This is the exact iterative loop the prompt requires ("confirm each stage is
working before moving to the next"), with CI substituting for a local SDK.

**iOS:** building an iOS archive requires macOS — the `build-ios` CI job runs
on `macos-latest` with `flutter build ios --release --no-codesign`. App Store
signing needs the developer's certificates, which cannot live in this
repository; the Fastlane stubs (`app/ios/fastlane`, `app/android/fastlane`)
document exactly where credentials plug in. The `ios/` platform folder was
materialized from the **official Flutter stable templates** (fetched via the
GitHub contents API from `flutter/flutter@stable`) and rendered for this
project (bundle id `dev.gallery.app`, display name `Gallery`, Swift Package
Manager integration kept, plugin-hook template blocks removed) — this avoids
hand-writing `project.pbxproj` drift.

## 1. Staged build plan (per prompt §12 "build this iteratively")

| Stage | Scope | Status |
|---|---|---|
| 0 | Architecture scaffold, navigation shell, Liquid Glass system, timeline grid + sticky headers + pinch density + scrubber, viewer (swipe/zoom/dynamic tint), albums (smart + device), search (text/date/type + recents), For You (real memories engine), settings, permissions, Android target, CI | **code complete — CI: analyze ✅, APK build ✅; test-suite hardening in flight** |
| 1 | iOS target (pbxproj/Info.plist/launch screen/icon set from the official stable Flutter templates, permission rationales), macOS CI job (`--no-codesign`), Fastlane stubs (ios+android), integration_test bootstrap; edit→export legs appended in Stages 4–6 | **in progress** |
| 2 | Metadata DB (Drift), favorites/custom albums/drag-drop, multi-select batch actions, trash + auto-purge, locked folder (biometric + PIN), hero transitions, full video playback | planned |
| 3 | On-device AI: ML Kit faces + OCR, scene tagging, NL smart search, duplicates/blur/quality clean-up, storage insights | planned |
| 4 | Photo editor suite (crop/straighten/adjust/filters/auto-enhance/markup/magic eraser/portrait blur, non-destructive + history) | planned |
| 5 | Video editor suite (trim/split/speed/audio/color/cover/text/export presets on background isolates) | planned |
| 6 | Sharing/export (compression presets, EXIF-preserving batch), pluggable encrypted backup (`BackupProvider`), opt-in sync | planned |
| 7 | Full i18n: remaining 15+ locales, RTL mirroring pass, font fallback audit, locale-aware formatting sweep | planned |
| 8 | Polish pass: 60/120 fps profiling, cold-start budget, Play/App Store assets | planned |

Reduced-scope items inside shipped stages are marked ⚠ below and in code
comments — nothing ships as a fake stub.

## 2. State management: Riverpod

Chosen over Bloc per the prompt's default. Riverpod's `Notifier` +
`FutureProvider` map cleanly onto the async media-store access pattern, its
override mechanism makes every screen testable with `FakeMediaSource`, and it
avoids the event/state boilerplate that would double the size of the media
pipeline. Used consistently — no `setState`-outside-widget state, no Bloc
anywhere.

## 3. Local database: Drift (Stage 2)

The prompt allows Isar **or** Drift. Isar's maintenance stalled in 2024–2025
(the original repo stopped releasing; only community forks continue). Drift
(SQLite) is actively maintained, null-safe end-to-end, and its codegen output
is deterministic — important because codegen must run in CI (see §0).
Stage 0 uses SharedPreferences for preferences only (settings, recent
searches) — no structured data exists yet, so no DB dependency ships dead.

## 4. Blur performance strategy (§1 of the prompt)

- Live `BackdropFilter` is restricted to **small, mostly-static surfaces**:
  the nav capsule, sticky date pills, sheets, dialogs, viewer bars. Grid
  cells NEVER blur — they are squircle-clipped images.
- Every glass surface is wrapped in a `RepaintBoundary` so scrolling content
  behind it doesn't re-raster the blur every frame; Flutter's engine caches
  the backdrop layer while the filter and surface are unchanged.
- **Reduced Transparency / Performance Mode**: `off / on / auto`. Auto uses
  `FrameTierMonitor` — samples `SchedulerBinding` frame timings during the
  first seconds of heavy UI; if p90 total frame time > 20 ms the device is
  flagged low-tier and blur is swapped for solid tints globally. No platform
  API, no device whitelists, reversible the moment frames recover on
  app restart.
- Specular highlights shift with the accelerometer at ~20 Hz (throttled,
  clamped), toggleable in Settings for battery.
- ⚠ Trade-off: real "blur a background snapshot" (render-scene-to-image then
  blur once) costs a `toImage` raster pass per capture and only pays off for
  full-screen dialogs; Flutter's cached BackdropFilter already gives the same
  steady-state cost for our small surfaces. If profiling (Stage 8) shows
  mid-range devices struggling on sheets over video, we will snapshot-blur
  the sheet backdrop specifically.

## 5. Squircle corners

`SquircleBorder`/`SquircleClip` draw a superellipse (n=5) path instead of
circular-arc rounded rects, matching the continuous curvature of iOS/
Liquid-Glass surfaces. Cost: one path build per layout, trivial vs. blur.

## 6. Media access: photo_manager (§9)

- Android: scoped storage only — `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`,
  `READ_MEDIA_VISUAL_USER_SELECTED` (Android 14 partial), legacy
  `READ_EXTERNAL_STORAGE` capped at `maxSdkVersion=32`.
  **No `MANAGE_EXTERNAL_STORAGE`** anywhere.
- iOS: `NSPhotoLibraryUsageDescription` + limited-access support (Stage 1
  manifest).
- ⚠ Version note (§11): photo_manager 3.x's `PermissionExtend` /
  `RequestOption` surface is the single seam (`photo_manager_media_source
  .dart`) — a plugin major bump touches only that file. Verified against the
  plugin's 3.x API; re-verify on every major bump.

## 7. Thumbnail pipeline (§2, §9)

Two-tier custom LRU: memory (48 MB, byte-accounted, in-flight request
dedup) over disk (`gallery_thumbs/`, count-bounded at 2500 files, LRU by
mtime). Keys include pixel size, so pinch-density changes reuse tiers.
Thumbnails are requested at cache size from the media store — full-resolution
bytes are decoded ONLY in the viewer/editor. Grid virtualization comes free
from slivers (lazy builder delegates); the page window keeps 10k+ libraries
from materializing at once.

## 8. Smart-search language architecture (§7 requirement)

`SearchQuery.parse` produces **typed criteria** (text tokens, month, year,
type filter) rather than doing string matching inline. Adding a language to
natural-language search = adding token lexicons + date patterns feeding the
same criteria object; no engine rewrite. Stage 0 supports structured date
queries in every UI locale (intl DateFormat parsing) and free-text matching;
NL phrases like "sunset photos from July at the beach" arrive with the AI
stage (English + Hindi + Bengali lexicons first — stated here per §7's
requirement to document smart-search language coverage vs UI-only
translation).

## 9. Localization

- Official `gen-l10n` + ARB files; `nullable-getter: false`; every
  user-facing string goes through `AppLocalizations` (§7/§11). CI runs
  `flutter gen-l10n` before analyze so generated classes are never stale in
  the repo.
- Launch language plan: Stage 0 ships en/es/hi/bn; Stage 7 adds pt, fr, de,
  it, ru, ar (+ full RTL pass), ur (+ RTL), tr, ja, ko, zh, zh-TW, vi, th,
  id. RTL requires mirrored gesture directions — the nav pill, scrubber and
  swipe-to-dismiss get an explicit RTL audit in Stage 7, not just
  `Directionality` flips.
- Domain layer returns **sentinel tokens** for relative day headers
  ("Today"/"Yesterday") which the presentation layer resolves through
  AppLocalizations — keeps domain Flutter-free without hardcoding strings.

## 10. App identity

`AppConstants.appName = 'Gallery'` is the only place the name exists in Dart
(§11). Platform configs (manifest label, bundle display name) reference the
same string value. The repository also contains `web/` — an earlier
browser-based test build of the same product spec; it is kept as a manual QA
reference and is not part of the Flutter deliverable.

## 11. Video processing (forward decision, Stage 5)

⚠ `ffmpeg_kit_flutter` was **retired** by its maintainer in early 2025
(binaries removed). Stage 5 will use the maintained community continuation
(`ffmpeg_kit_flutter_new`) or a platform-channel bridge to
Media3 Transformer (Android) / AVFoundation (iOS) — decision made at Stage 5
after benchmarking both against the export-preset requirements; all
processing will run off the UI isolate either way. Flagged now per §11 so no
one assumes the original plugin is viable.

## 12. Testing (§9)

- Unit: timeline grouping, search query parsing/matching, memory engine,
  LRU cache semantics (all device-free, running in CI today).
- Widget: shell smoke test with `FakeMediaSource` + mocked SharedPreferences
  (runs in CI). Key screens get per-stage widget tests as they land.
- Integration: `import → edit → export` flow test lands in Stage 1 (needs
  the iOS/Android device matrix) using `integration_test` on emulators via
  CI matrix where available.

## 13. Refinement pass 2 — responsibility split & honest capabilities (web preview)

- **Screen responsibilities (§ split):** For You = content discovery only (Stories, Memories,
  On this day, Recently added, Featured moments, Smart suggestions — no header, no cleanup, no
  storage, no people). Settings = configuration + Storage & Cleanup (liquid visualization,
  analyzer, duplicates/blurry/large/old groups, recycle bin). Albums = organization (People
  stays here). Every tab's top-right is a single hamburger opening a Liquid Glass popup whose
  first entry is always Settings.
- **EditState v2:** one serializable, non-destructive recipe per item (`v: 2`, migrated on
  load). New: straighten, perspective, canvas pad, exposure/highlights/shadows/vibrance/tint/
  hue/clarity/dehaze/denoise/grain, RGB + per-channel curves, 8-band HSL, shadow/midtone/
  highlight colour balance, brush dabs (inpaint/red-eye/blur/mosaic), sticker & text layers
  (with video timing t0/t1), video trim/speed/reverse/mute/volume/aspect/effect. The original
  asset is never mutated; Save writes the recipe, Save-a-copy forks a generated item.
- **Liquid storage (§4):** one canvas, stacked per-category bands drawn as two travelling sine
  waves + wobble, meniscus stroke, bubbles, static specular. rAF pauses via IntersectionObserver,
  `visibilitychange`, reduced-motion and the Animations setting. Detail mode hit-tests bands by
  y-position. Deliberately *not* a spinner — it is a data visualization with ambient motion.
- **Video pipeline:** `drawVideoFrame()` is a pure renderer shared by the viewer, the editor
  preview and the WebM exporter (offscreen canvas → `captureStream` → `MediaRecorder`), so
  exports are guaranteed to match playback. Frame extracts and collages become real library
  items (data-URL, persisted); WebM/blob outputs are honest downloads (session-scoped).
- **Gestures (§13):** left-half vertical = brightness (compositing filter; the native build
  drives the real screen API), right-half vertical = WebAudio bed gain, horizontal = seek via
  `timeOverride` (resumes from the seeked position). A tap toggles chrome; intent is decided
  once per gesture at the 10 px threshold — no mid-gesture mode switching, no conflicts with
  photo zoom/pan (photo and video paths are fully separate).
- **Honest capability line:** real here — perceptual-hash duplicates, laplacian blur detection,
  OCR-ish text hints, face grouping, histogram enhance, inpaint-style eraser (local blend,
  labelled heuristic), red-eye neutralisation, mosaic, denoise, 2× interpolated upscale,
  portrait depth blur. Disabled-until-native (shown, never faked): ML face enhance, background
  removal cut-out, system notifications, real device media access.
- **Animation budget (§19):** page transitions animate ONE keyed wrapper (fade+scale+slide);
  grid entrance stagger is capped at the first 24 cells; nav icons replay keyframes by
  remounting a small SVG subtree (compositor-only transforms); selection uses a 260 ms pop.
  Thousands of items are never animated.

## 14. Flutter app — permissions, memories & menu parity (post-web-corrections)

- **Single permission flow.** `HomeShell` no longer owns a private gate: tabs are wrapped
  in the shared `PermissionGate`/`PermissionFlow`. The user-gate intent is preserved
  (nothing in the tab stack is built until access is confirmed), but the system prompt now
  only fires from the localized rationale screen — never on cold start (`initState` did
  previously call `requestPermissionExtend()` directly, which also shipped hardcoded
  English strings, violating the l10n rule). App-resume does a **silent**
  `getPermissionState` re-check so granting access in system Settings and returning to the
  app unlocks the UI without a prompt.
- **Limited access (iOS 14+, Android 14+ partial grant).** The gate shows a persistent
  banner; its action calls `PermissionFlow.pickMore()` → `PhotoManager.presentLimited()`,
  the official photo_manager 3.x API for the limited-library picker (iOS) / system photo
  picker (Android 14+), then re-reads state and invalidates the repository caches.
  Manifest/plist permissions were audited and are correct (READ_MEDIA_*,
  VISUAL_USER_SELECTED, maxSdk-32 fallback, NSPhotoLibrary*/FaceID usage strings).
- **Memories structure mirrors the corrected web app**: memories are *not* on For You.
  A dedicated `MemoriesScreen` is reached from the hamburger menu (Timeline tab and
  globally). `Memory`/`MemoryEngine` moved to `domain/usecases/memory_engine.dart`;
  new pure `dayMemories()` derives day clusters (≥4 items, 30–365 days back, newest
  first, capped 24) — the recent 30-day window belongs to the "recent highlight" so the
  Memories screen never duplicates a day. All derivations run on real device dates;
  scope note stays honest: the engine scans repository-cached pages (≤8 ≈ 960 items)
  until the indexed DB stage.
- **For You = discovery rails**: On this day, Recent highlight (featured), Recently added
  (newest 20 → viewer). Empty library renders the honest empty state, not fake content.
- **GlassPopupMenu** (`core/widgets/glass_popup_menu.dart`) replicates the web menu:
  anchored to the trigger rect (flips above when there is no room), scale 0.92→1 + fade +
  slight slide, 180 ms ease-out, dim barrier, back-gesture dismissal (transparent
  `PopupRoute`). Item states: checked (radio-style), hint caption, disabled, danger.
  The top-right gear became a hamburger; menu = Settings first, Memories, and on
  Timeline: Group Day/Month/Year (persisted `timelineGrouping`, wired into
  `GroupTimeline`) + Zoom in/out (existing grid-density setting, clamped 2–8).
