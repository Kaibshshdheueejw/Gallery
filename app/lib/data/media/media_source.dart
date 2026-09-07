import 'dart:typed_data';

import '../../domain/models/media_item.dart';

/// Permission posture (§8): full / limited (iOS + Android 14 partial) /
/// denied / restricted.
enum MediaPermission { unknown, full, limited, denied, restricted }

/// Abstract media store boundary. The presentation and domain layers only
/// ever see this interface; `PhotoManagerMediaSource` implements it against
/// the real device media store, and tests inject fakes. Swapping
/// `photo_manager` for another plugin later touches one file.
abstract interface class MediaSource {
  /// Requests (or re-checks) library access. On Android 14+/iOS 14+ the user
  /// may grant LIMITED access to selected photos only.
  Future<MediaPermission> requestPermission();

  /// Current permission without prompting.
  Future<MediaPermission> checkPermission();

  /// Total item count (photos + videos).
  Future<int> itemCount();

  /// Paged fetch of the full library, newest first. Pages are bounded so
  /// 10k+ item libraries never materialize at once (§2).
  Future<List<MediaItem>> fetchPage({int page = 0, int size = 120});

  /// Device albums/folders with counts, newest-item first inside each.
  Future<List<AlbumInfo>> albums();

  /// Items inside one album (paged), newest first.
  Future<List<MediaItem>> albumItems(String albumId, {int page = 0, int size = 200});

  /// Thumbnail bytes at the requested pixel size (media store provides
  /// appropriately-sized decodes — we never decode full-res for grids).
  Future<Uint8List?> thumbnail(String itemId, {int width = 360, int height = 360});

  /// Full-size bytes for the viewer/editor stage.
  Future<Uint8List?> fullBytes(String itemId);
}
