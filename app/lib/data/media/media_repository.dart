import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/models/media_item.dart';
import 'media_source.dart';
import 'photo_manager_media_source.dart';
import 'thumb_cache.dart';

/// Composition-root providers for the media stack. Tests override
/// [mediaSourceProvider] with a fake — the repository and every screen above
/// it are then fully testable without a device (§9 testing).
final mediaSourceProvider = Provider<MediaSource>((ref) {
  return PhotoManagerMediaSource();
});

final thumbCacheProvider = Provider<ThumbCache>((ref) {
  final cache = ThumbCache(ref.watch(mediaSourceProvider));
  ref.onDispose(cache.clear);
  return cache;
});

/// Paged access to the timeline. Keeps an in-memory window of loaded pages;
/// callers request `page(i)` and get domain models back. 10k+ libraries only
/// ever hold the pages the user actually scrolled through (§2).
class MediaRepository {
  MediaRepository(this._source, this._thumbs);

  final MediaSource _source;
  final ThumbCache _thumbs;

  static const int pageSize = 120;
  final Map<int, List<MediaItem>> _pages = {};
  int? _total;

  Future<MediaPermission> requestPermission() => _source.requestPermission();
  Future<MediaPermission> checkPermission() => _source.checkPermission();

  Future<int> totalItemCount() async => _total ??= await _source.itemCount();

  Future<List<MediaItem>> page(int index) async {
    final cached = _pages[index];
    if (cached != null) return cached;
    final loaded = await _source.fetchPage(page: index, size: pageSize);
    return _pages[index] = loaded;
  }

  Future<List<AlbumInfo>> albums() => _source.albums();

  Future<List<MediaItem>> albumItems(String albumId, {int page = 0}) =>
      _source.albumItems(albumId, page: page);

  Future<Uint8List?> thumbnail(String itemId, {int width = 360}) =>
      _thumbs.get(itemId, width: width, height: width);

  Future<Uint8List?> fullBytes(String itemId) => _source.fullBytes(itemId);

  void invalidate() {
    _pages.clear();
    _total = null;
    _thumbs.clear();
  }
}

final mediaRepositoryProvider = Provider<MediaRepository>((ref) {
  return MediaRepository(
    ref.watch(mediaSourceProvider),
    ref.watch(thumbCacheProvider),
  );
});
