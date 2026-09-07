import 'dart:async';
import 'dart:collection';
import 'dart:io';
import 'dart:typed_data';

import 'package:path_provider/path_provider.dart';

import '../../core/constants.dart';
import 'media_source.dart';

/// ─────────────────────────────────────────────────────────────────────────
/// Two-tier LRU thumbnail cache (§2, §9 "custom LRU thumbnail cache layered
/// with disk caching"):
///   1. Memory LRU bounded by total decoded bytes (48 MB default).
///   2. Disk LRU (`<cacheDir>/thumbs/<size>/<id>.thumb`) bounded by count;
///      evicts least-recently-used on overflow.
///
/// Keys include the pixel size so pinch-to-zoom density changes reuse
/// already-decoded tiers instead of re-requesting every cell.
/// ─────────────────────────────────────────────────────────────────────────
class ThumbCache {
  ThumbCache(this._source, {int maxMemoryBytes = AppConstants.thumbCacheMaxBytes})
      : _maxMemoryBytes = maxMemoryBytes;

  final MediaSource _source;
  final int _maxMemoryBytes;

  final LinkedHashMap<String, _Entry> _memory = LinkedHashMap();
  int _memoryBytes = 0;

  Directory? _diskRoot;
  Future<Directory> _disk() async {
    final existing = _diskRoot;
    if (existing != null) return existing;
    final base = await getTemporaryDirectory();
    final dir = Directory('${base.path}/gallery_thumbs');
    if (!dir.existsSync()) dir.createSync(recursive: true);
    return _diskRoot = dir;
  }

  static const int _diskMaxFiles = 2500;

  /// Returns thumbnail bytes, hitting memory → disk → media source in order.
  /// Concurrent requests for the same key share one in-flight future.
  final Map<String, Future<Uint8List?>> _inFlight = {};

  Future<Uint8List?> get(String itemId, {int width = 360, int height = 360}) {
    final key = '$itemId@$width';
    final hit = _memory.remove(key);
    if (hit != null) {
      hit.lastUse = DateTime.now();
      _memory[key] = hit; // move to MRU end (true LRU ordering)
      return Future.value(hit.bytes);
    }
    return _inFlight.putIfAbsent(
      key,
      () => _load(key, itemId, width, height).whenComplete(() => _inFlight.remove(key)),
    );
  }

  Future<Uint8List?> _load(String key, String itemId, int width, int height) async {
    // Disk tier.
    try {
      final file = File('${(await _disk()).path}/$key.thumb');
      if (file.existsSync()) {
        final bytes = file.readAsBytesSync();
        _promote(key, bytes);
        _touchDisk(file);
        return bytes;
      }
    } catch (_) {
      // Disk cache is best-effort; fall through to source.
    }
    final bytes = await _source.thumbnail(itemId, width: width, height: height);
    if (bytes != null) {
      _promote(key, bytes);
      unawaited(_writeDisk(key, bytes));
    }
    return bytes;
  }

  Future<void> _writeDisk(String key, Uint8List bytes) async {
    try {
      final dir = await _disk();
      File('${dir.path}/$key.thumb').writeAsBytesSync(bytes, flush: false);
      _evictDiskIfNeeded(dir);
    } catch (_) {
      // Non-fatal.
    }
  }

  void _touchDisk(File file) {
    try {
      file.setLastModifiedSync(DateTime.now());
    } catch (_) {}
  }

  void _evictDiskIfNeeded(Directory dir) {
    try {
      final files = dir.listSync().whereType<File>().toList();
      if (files.length <= _diskMaxFiles) return;
      files.sort((a, b) => a
          .lastModifiedSync()
          .compareTo(b.lastModifiedSync()));
      for (final f in files.take(files.length - _diskMaxFiles)) {
        f.deleteSync();
      }
    } catch (_) {}
  }

  void _promote(String key, Uint8List bytes) {
    _memory.remove(key);
    _memory[key] = _Entry(bytes: bytes, lastUse: DateTime.now());
    _memoryBytes += bytes.lengthInBytes;
    while (_memoryBytes > _maxMemoryBytes && _memory.isNotEmpty) {
      final oldestKey = _memory.keys.first; // LinkedHashMap order == LRU
      final oldest = _memory.remove(oldestKey)!; // (hits re-insert at tail).
      _memoryBytes -= oldest.bytes.lengthInBytes;
    }
  }

  /// Drops everything (e.g. after permission changes or in tests).
  void clear() {
    _memory.clear();
    _memoryBytes = 0;
    try {
      final dir = _diskRoot;
      if (dir != null && dir.existsSync()) {
        for (final f in dir.listSync().whereType<File>()) {
          f.deleteSync();
        }
      }
    } catch (_) {}
  }

  /// Test hook: memory occupancy in bytes.
  int get memoryBytesForTest => _memoryBytes;
  int get memoryEntriesForTest => _memory.length;
}

class _Entry {
  _Entry({required this.bytes, required this.lastUse});
  final Uint8List bytes;
  DateTime lastUse;
}
