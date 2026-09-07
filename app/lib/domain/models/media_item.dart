import 'dart:typed_data';

/// Domain model — platform-independent (§Clean Architecture: domain layer
/// must not import plugin types). `photo_manager` assets are mapped into
/// this at the data layer.
enum MediaKind { photo, video }

class MediaItem {
  const MediaItem({
    required this.id,
    required this.kind,
    required this.title,
    required this.createdAt,
    required this.modifiedAt,
    required this.width,
    required this.height,
    required this.sizeBytes,
    required this.albumId,
    required this.albumName,
    this.duration = Duration.zero,
    this.relativePath = '',
  });

  final String id;
  final MediaKind kind;
  final String title;
  final DateTime createdAt;
  final DateTime modifiedAt;
  final int width;
  final int height;
  final int sizeBytes;

  /// Owning device album/folder id + display name (auto-organization, §2).
  final String albumId;
  final String albumName;

  /// Video duration (zero for photos).
  final Duration duration;

  /// Android relative path (e.g. `DCIM/Camera/`); used for source-app and
  /// Downloads/Screenshots classification. Empty on iOS (no path concept —
  /// classification falls back to photo_manager's `isScreenshot`-ish hints).
  final String relativePath;

  bool get isVideo => kind == MediaKind.video;
  bool get isScreenshot =>
      albumName.toLowerCase().contains('screenshot') ||
      relativePath.toLowerCase().contains('screenshots');

  MediaItem copyWith({String? title}) => MediaItem(
        id: id,
        kind: kind,
        title: title ?? this.title,
        createdAt: createdAt,
        modifiedAt: modifiedAt,
        width: width,
        height: height,
        sizeBytes: sizeBytes,
        albumId: albumId,
        albumName: albumName,
        duration: duration,
        relativePath: relativePath,
      );
}

/// A device/smart album as listed on the Albums screen.
class AlbumInfo {
  const AlbumInfo({
    required this.id,
    required this.name,
    required this.itemCount,
    required this.isSmart,
    this.coverThumbFactory,
  });

  final String id;
  final String name;
  final int itemCount;

  /// Smart albums (Screenshots/Videos/Favorites…) are computed by the app;
  /// device albums mirror media-store folders (§2).
  final bool isSmart;

  /// Provides cover thumbnail bytes — injected by the data layer so the
  /// domain/UI never touches plugin types.
  final Future<Uint8List?> Function()? coverThumbFactory;
}
