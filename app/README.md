# Gallery — Flutter app

Private-first, on-device-AI photo & video gallery with a Liquid Glass UI.
Android + iOS. This directory is the production Flutter deliverable; the
repository root's `web/` folder holds an earlier browser test build of the
same product spec (kept for manual QA reference).

## Requirements

- Flutter stable ≥ 3.22 (Dart ≥ 3.4)
- Android: JDK 17, Android SDK 35 (minSdk 24)
- iOS (Stage 1): Xcode 15+ on macOS

## Run

```bash
cd app
flutter pub get
flutter gen-l10n        # generates AppLocalizations from lib/l10n/*.arb
flutter run             # device or emulator with real photos
```

## Build release artifacts

```bash
# Android (signed when android/key.properties exists — see key.properties.example)
flutter build apk --release
flutter build appbundle --release

# iOS (macOS only, Stage 1+)
flutter build ipa --release
```

GitHub Actions (`.github/workflows/flutter.yml`) runs analyze → test →
release APK build on every push and uploads the APK artifact. See the root
`DESIGN_DECISIONS.md` for the staged build plan and every trade-off
(blur performance, DB choice, plugin version risks, i18n coverage).

## Architecture

Clean Architecture, one direction of dependency:

```
lib/
├── core/          # constants, theme tokens, glass widgets, settings, haptics
├── data/          # media source (photo_manager), LRU thumb cache, repository
├── domain/        # models + pure use cases (no Flutter/plugin imports)
├── features/      # presentation: shell, timeline, albums, search, foryou,
│                  # settings, viewer (grows: editor_photo, editor_video,
│                  # locked_folder per the prompt's layout)
├── l10n/          # ARB localization sources (gen-l10n)
└── main.dart
```

State management is **Riverpod** everywhere. Screens depend only on domain
models and the repository; `photo_manager` is isolated behind
`data/media/media_source.dart` (tests inject `FakeMediaSource`).
