import 'dart:typed_data';

import 'package:photo_manager/photo_manager.dart';

import '../../domain/models/media_item.dart';
import 'media_source.dart';

/// ─────────────────────────────────────────────────────────────────────────
/// Real device media store via photo_manager (§2, §8).
///
/// Android: scoped storage — photo_manager requests READ_MEDIA_IMAGES /
/// READ_MEDIA_VIDEO (declared in the manifest) and supports Android 14's
/// partial ("limited") grant. No MANAGE_EXTERNAL_STORAGE anywhere.
/// iOS: PHPhotoLibrary via NSPhotoLibraryUsageDescription + limited access.
///
/// ⚠ Version note (flagged per §11): photo_manager 3.x maps PermissionState
/// and `RequestOption`. If the plugin majors again, this file is the single
/// seam that needs updating.
/// ─────────────────────────────────────────────────────────────────────────
class PhotoManagerMediaSource implements MediaSource {
  /// All-media path list requested once and cached per permission grant.
  AssetPathEntity? _allPath;

  Future<AssetPathEntity> _all() async {
    final cached = _allPath;
    if (cached != null) return cached;
    final paths = await PhotoManager.getAssetPathList(
      type: RequestType.common,
      onlyAll: true,
    );
    if (paths.isEmpty) {
      throw StateError('No media path available (permission not granted?)');
    }
    return _allPath = paths.first;
  }

  @override
  Future<MediaPermission> requestPermission() async =>
      _map(_extract(await PhotoManager.requestPermissionExtend()));

  @override
  Future<MediaPermission> checkPermission() async {
    // ⚠ Version seam (§11): some photo_manager releases require a
    // `requestOption` argument here. Dynamic dispatch keeps this file
    // compiling across those shapes; CI reports the resolved signature and
    // the seam is then finalized to the exact typed call.
    final dynamic pm = PhotoManager;
    try {
      return _map(_extract(await pm.getPermissionState()));
    } catch (_) {
      return MediaPermission.unknown;
    }
  }

  /// ⚠ Version seam (§11): photo_manager's permission API has churned across
  /// majors (PermissionState vs PermissionExtend{authorizationState}). This
  /// extractor accepts either shape so upgrades touch only this file.
  PermissionState _extract(dynamic value) {
    if (value is PermissionState) return value;
    try {
      final state = value.authorizationState;
      if (state is PermissionState) return state;
    } catch (_) {}
    return PermissionState.denied;
  }

  MediaPermission _map(PermissionState state) => switch (state) {
        PermissionState.authorized => MediaPermission.full,
        PermissionState.limited => MediaPermission.limited,
        PermissionState.denied => MediaPermission.denied,
        PermissionState.restricted => MediaPermission.restricted,
        PermissionState.notDetermined => MediaPermission.unknown,
      };

  @override
  Future<int> itemCount() async => (await _all()).assetCountAsync;

  @override
  Future<List<MediaItem>> fetchPage({int page = 0, int size = 120}) async {
    final path = await _all();
    final assets = await path.getAssetListPaged(page: page, size: size);
    return Future.wait(assets.map(_mapAsset));
  }

  @override
  Future<List<AlbumInfo>> albums() async {
    final paths = await PhotoManager.getAssetPathList(type: RequestType.common);
    final infos = <AlbumInfo>[];
    for (final p in paths) {
      final count = await p.assetCountAsync;
      if (count == 0) continue;
      infos.add(
        AlbumInfo(
          id: p.id,
          name: p.name,
          itemCount: count,
          isSmart: false,
          coverThumbFactory: () async {
            final first = await p.getAssetListPaged(page: 0, size: 1);
            if (first.isEmpty) return null;
            return first.first.thumbnailDataWithSize(const ThumbnailSize(360, 360));
          },
        ),
      );
    }
    return infos;
  }

  @override
  Future<List<MediaItem>> albumItems(String albumId, {int page = 0, int size = 200}) async {
    final paths = await PhotoManager.getAssetPathList(type: RequestType.common);
    for (final p in paths) {
      if (p.id != albumId) continue;
      final assets = await p.getAssetListPaged(page: page, size: size);
      return Future.wait(assets.map(_mapAsset));
    }
    return const [];
  }

  @override
  Future<Uint8List?> thumbnail(String itemId, {int width = 360, int height = 360}) async {
    final asset = await AssetEntity.fromId(itemId);
    if (asset == null) return null;
    return asset.thumbnailDataWithSize(ThumbnailSize(width, height));
  }

  @override
  Future<Uint8List?> fullBytes(String itemId) async {
    final asset = await AssetEntity.fromId(itemId);
    if (asset == null) return null;
    return asset.originBytes;
  }

  Future<MediaItem> _mapAsset(AssetEntity a) async {
    final relativePath = a.relativePath ?? '';
    return MediaItem(
      id: a.id,
      kind: a.type == AssetType.video ? MediaKind.video : MediaKind.photo,
      title: (await a.titleAsync) ?? a.id,
      createdAt: a.createDateTime,
      modifiedAt: a.modifiedDateTime,
      width: a.width,
      height: a.height,
      sizeBytes: await _sizeOf(a),
      albumId: a.relativePath ?? 'all',
      albumName: _folderName(relativePath),
      duration: Duration(seconds: a.duration),
      relativePath: relativePath,
    );
  }

  /// ⚠ Version seam (§11): `AssetEntity.size` has been int-bytes in some
  /// releases and a Size-like object in others; resolve defensively.
  Future<int> _sizeOf(AssetEntity a) async {
    try {
      final dynamic s = await (a as dynamic).size;
      if (s is int) return s;
      return (s as dynamic).toInt() as int;
    } catch (_) {
      return 0; // Storage features re-derive sizes in Stage 3.
    }
  }

  static String _folderName(String relativePath) {
    final trimmed = relativePath.endsWith('/')
        ? relativePath.substring(0, relativePath.length - 1)
        : relativePath;
    final idx = trimmed.lastIndexOf('/');
    return idx == -1 || trimmed.isEmpty ? 'Library' : trimmed.substring(idx + 1);
  }
}
