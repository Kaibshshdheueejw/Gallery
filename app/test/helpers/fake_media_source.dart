import 'dart:typed_data';

import 'package:gallery_app/data/media/media_source.dart';
import 'package:gallery_app/domain/models/media_item.dart';

/// Minimal valid 1×1 transparent PNG (decodable by MemoryImage in widget
/// tests). Kept local so the fake source has zero transitive plugin imports.
final Uint8List kFakePng = Uint8List.fromList(const <int>[
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
  0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
]);

/// Deterministic in-memory media source for unit/widget tests (§9):
/// screens and repositories are exercised without a device or plugin.
class FakeMediaSource implements MediaSource {
  FakeMediaSource({
    List<MediaItem>? items,
    this.permission = MediaPermission.full,
  }) : items = items ?? _defaultItems();

  final List<MediaItem> items;
  final MediaPermission permission;

  int thumbnailCalls = 0;
  int fullBytesCalls = 0;

  static List<MediaItem> _defaultItems() {
    final now = DateTime(2026, 9, 7, 12);
    return [
      _item('a1', now, album: 'Camera', title: 'Sunset beach.jpg'),
      _item('a2', now.subtract(const Duration(hours: 3)), album: 'Camera', title: 'Friends selfie.jpg'),
      _item('a3', now.subtract(const Duration(days: 1)), album: 'Screenshots', title: 'Screenshot_2026.png'),
      _item('a4', now.subtract(const Duration(days: 2)),
          album: 'Camera', title: 'Trip clip.mp4', video: true),
      _item('a5', DateTime(2025, 9, 7, 9), album: 'Camera', title: 'Last year today.jpg'),
      _item('a6', DateTime(2025, 9, 7, 10), album: 'Downloads', title: 'Diwali diya.jpg'),
      _item('a7', now.subtract(const Duration(days: 5)), album: 'Camera', title: 'Receipt 2026-07.pdf.jpg'),
      _item('a8', DateTime(2026, 7, 14, 18), album: 'Camera', title: 'July beach evening.jpg'),
    ];
  }

  static MediaItem _item(
    String id,
    DateTime at, {
    required String album,
    required String title,
    bool video = false,
  }) =>
      MediaItem(
        id: id,
        kind: video ? MediaKind.video : MediaKind.photo,
        title: title,
        createdAt: at,
        modifiedAt: at,
        width: video ? 1920 : 1200,
        height: video ? 1080 : 1600,
        sizeBytes: video ? 42 * 1024 * 1024 : 3 * 1024 * 1024,
        albumId: album.toLowerCase(),
        albumName: album,
        duration: video ? const Duration(seconds: 18) : Duration.zero,
        relativePath: 'DCIM/$album/',
      );

  @override
  Future<MediaPermission> requestPermission() async => permission;

  @override
  Future<MediaPermission> checkPermission() async => permission;

  @override
  Future<int> itemCount() async => items.length;

  @override
  Future<List<MediaItem>> fetchPage({int page = 0, int size = 120}) async {
    final start = page * size;
    if (start >= items.length) return const [];
    final end = (start + size).clamp(0, items.length);
    final sorted = [...items]..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return sorted.sublist(start, end);
  }

  @override
  Future<List<AlbumInfo>> albums() async {
    final byAlbum = <String, List<MediaItem>>{};
    for (final i in items) {
      (byAlbum[i.albumId] ??= []).add(i);
    }
    return [
      for (final entry in byAlbum.entries)
        AlbumInfo(
          id: entry.key,
          name: entry.value.first.albumName,
          itemCount: entry.value.length,
          isSmart: false,
          coverThumbFactory: () async => kFakePng,
        ),
    ];
  }

  @override
  Future<List<MediaItem>> albumItems(String albumId, {int page = 0, int size = 200}) async {
    if (page > 0) return const [];
    return items.where((i) => i.albumId == albumId).toList()
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
  }

  @override
  Future<Uint8List?> thumbnail(String itemId, {int width = 360, int height = 360}) async {
    thumbnailCalls++;
    // A real (1×1 transparent) PNG so widget tests can decode it.
    return kFakePng;
  }

  @override
  Future<Uint8List?> fullBytes(String itemId) async {
    fullBytesCalls++;
    return kFakePng;
  }
}
