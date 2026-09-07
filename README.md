# 📸 Gallery

> A modern, feature-rich media gallery app for Android & iOS — built with Flutter. Inspired by Samsung Gallery, reimagined with smarter organization, on-device AI, and a cleaner, more fluid UI.

![Flutter](https://img.shields.io/badge/Flutter-3.x-02569B?logo=flutter&logoColor=white)
![Dart](https://img.shields.io/badge/Dart-3.x-0175C2?logo=dart&logoColor=white)
![Platform](https://img.shields.io/badge/platform-Android%20%7C%20iOS-lightgrey)
![License](https://img.shields.io/badge/license-MIT-green)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)

---

## ✨ Overview

**Gallery** is a next-generation photo & video gallery app. It goes beyond simple browsing by adding on-device intelligence (face grouping, object/scene detection, smart search), a highly customizable UI, and privacy-first design — all without shipping your media off-device unless you explicitly enable cloud backup.

---

## 🚀 Features

### Core
- 📁 Smart album auto-organization (by folder, date, source app)
- 🖼️ Buttery-smooth grid with pinch-to-zoom scaling and adaptive thumbnail sizing
- 🎞️ Timeline view grouped by day / month / year with sticky headers
- 🎬 Built-in video playback with trim, mute, and speed controls
- 🔒 Private/Locked folder with biometric (Face ID / Fingerprint) lock
- 🗑️ Recycle bin with auto-purge after configurable retention period

### Smart & AI-Powered
- 🧠 On-device face detection & grouping (no cloud upload required)
- 🔍 Natural-language smart search (e.g. "sunset beach photos from July")
- 🏷️ Automatic scene/object tagging (food, documents, screenshots, receipts)
- 📝 OCR text detection in images (search photos by text they contain)
- 🧹 Duplicate & similar-image detection with one-tap cleanup
- 📊 Storage insights — see what's eating your space (screenshots, memes, blurry shots)

### Editing
- ✂️ Built-in editor: crop, rotate, filters, adjustments, markup
- 🎨 One-tap AI enhance (auto brightness/contrast/color correction)
- 🖌️ Magic eraser for object removal (on-device ML)
- 🌫️ Portrait blur / background blur adjustment

### Customization & UX
- 🌗 Full Material You (dynamic color) + custom theming
- 🧩 Customizable home layout (reorder tabs: Albums, Timeline, Search, For You)
- 📐 Adjustable grid density and thumbnail aspect ratio
- 🌍 Multi-language support (l10n-ready)

### Sharing & Backup
- ☁️ Optional encrypted cloud backup (bring-your-own provider: Drive/S3-compatible)
- 🔗 Quick share sheet with compression presets
- 📤 Batch export/import with metadata (EXIF) preservation
- 🔁 Cross-device sync (opt-in)

### Privacy & Security
- 🔐 All AI processing runs on-device — no image leaves the device unless backup is explicitly enabled
- 🕵️ Granular permission handling (scoped storage / photo picker compliant)
- 🧾 Transparent data usage settings screen

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Flutter](https://flutter.dev) 3.x |
| Language | Dart 3.x (null-safe) |
| State Management | Riverpod / Bloc *(pick one — see [Architecture](#-architecture))* |
| Local Database | Isar / Drift (SQLite) |
| ML / On-device AI | Google ML Kit, TensorFlow Lite |
| Media Handling | `photo_manager`, `video_player`, `ffmpeg_kit_flutter` |
| Image Caching | `cached_network_image`, custom LRU thumbnail cache |
| Backup (optional) | `googleapis` / S3-compatible SDK |
| CI/CD | GitHub Actions, Fastlane |

> ⚠️ Some plugin APIs (media store access, scoped storage) are OS-version sensitive on Android — verify current behavior against the latest `photo_manager` and Android target SDK docs before relying on version-specific assumptions.

---

## 🏗️ Architecture

```
lib/
├── core/               # Shared utilities, constants, theming
├── data/
│   ├── datasources/    # Local DB, device media store, cloud backup
│   ├── models/         # Data models / entities
│   └── repositories/   # Repository implementations
├── domain/
│   ├── entities/
│   ├── repositories/   # Abstract contracts
│   └── usecases/
├── features/
│   ├── albums/
│   ├── timeline/
│   ├── search/
│   ├── editor/
│   ├── locked_folder/
│   └── settings/
├── ml/                 # On-device ML pipelines (face, OCR, tagging)
└── main.dart
```

Follows a **Clean Architecture** approach (data / domain / presentation separation) to keep ML pipelines, storage backends, and UI independently testable and swappable.

---

## 📦 Getting Started

### Prerequisites
- Flutter SDK (stable channel) — check `flutter doctor`
- Android Studio / Xcode for platform builds
- A physical device or emulator with sample media for testing gallery features

### Installation

```bash
# Clone the repo
git clone https://github.com/<your-username>/novagallery.git
cd novagallery

# Install dependencies
flutter pub get

# Generate code (if using build_runner for models/DB)
dart run build_runner build --delete-conflicting-outputs

# Run the app
flutter run
```

### Required Permissions
| Platform | Permission | Purpose |
|---|---|---|
| Android | `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO` | Access device gallery |
| Android | `MANAGE_EXTERNAL_STORAGE` *(optional)* | Full folder management on older SDKs |
| iOS | `NSPhotoLibraryUsageDescription` | Access device photo library |
| Both | Biometric | Locked folder authentication |

---

## 🗺️ Roadmap

- [ ] Face grouping v1 (on-device)
- [ ] Natural-language search
- [ ] Magic eraser tool
- [ ] Cross-device sync
- [ ] Desktop (Windows/macOS) companion app
- [ ] Widget support (home screen memories widget)

See the [open issues](https://github.com/<your-username>/novagallery/issues) for the full list of proposed features and known bugs.

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the repo
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please read `CONTRIBUTING.md` (add one if it doesn't exist yet) for coding style and PR guidelines.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

## 🙏 Acknowledgments

- [Flutter](https://flutter.dev)
- [Google ML Kit](https://developers.google.com/ml-kit)
- Samsung Gallery / Google Photos for UX inspiration
