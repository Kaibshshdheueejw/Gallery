import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/glass_theme.dart';
import '../../core/widgets/pressable.dart';
import '../../core/widgets/squircle.dart';
import '../../data/media/media_repository.dart';
import '../../data/media/media_source.dart';
import '../../domain/models/media_item.dart';
import '../../l10n/app_localizations.dart';
import '../shared/permission_gate.dart';
import '../timeline/timeline_screen.dart';

/// ─────────────────────────────────────────────────────────────────────────
/// Albums (§2): auto-organized — smart albums computed by the app (All
/// photos, Videos, Screenshots, Downloads) on top of real device folders
/// from the media store. Custom user albums + drag-and-drop organization
/// arrive with the metadata DB in Stage 2.
/// ─────────────────────────────────────────────────────────────────────────

/// Synthetic smart-album ids (data layer special-cases them).
abstract final class SmartAlbumIds {
  static const String all = '__all';
  static const String videos = '__videos';
}

class AlbumsScreen extends ConsumerWidget {
  const AlbumsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final permission = ref.watch(permissionProvider);
    if (permission != MediaPermission.full && permission != MediaPermission.limited) {
      return const PermissionGate(child: SizedBox.shrink());
    }

    final albumsFuture = ref.watch(_albumsProvider);
    return albumsFuture.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (_, __) => Center(child: Text(l10n.genericError)),
      data: (albums) {
        final smart = <AlbumInfo>[
          AlbumInfo(
            id: SmartAlbumIds.all,
            name: l10n.albumAllPhotos,
            itemCount: albums.$1,
            isSmart: true,
          ),
          if (albums.$2 != null) albums.$2!,
          ...albums.$3.where((a) => _isScreenshotAlbum(a)).map(
                (a) => AlbumInfo(
                  id: a.id,
                  name: l10n.albumScreenshots,
                  itemCount: a.itemCount,
                  isSmart: true,
                  coverThumbFactory: a.coverThumbFactory,
                ),
              ),
        ];
        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
          children: [
            _SectionLabel(text: l10n.albumsSmart),
            _AlbumGrid(albums: smart),
            const SizedBox(height: 18),
            _SectionLabel(text: l10n.albumsDevice),
            _AlbumGrid(albums: albums.$3, deviceStyle: true),
          ],
        );
      },
    );
  }

  static bool _isScreenshotAlbum(AlbumInfo a) =>
      a.name.toLowerCase().contains('screenshot');
}

/// (totalItems, videosAlbumOrNull, deviceAlbums)
final _albumsProvider = FutureProvider<
    (int, AlbumInfo?, List<AlbumInfo>)>((ref) async {
  final repo = ref.read(mediaRepositoryProvider);
  final albums = await repo.albums();
  final total = await repo.totalItemCount();

  // Videos smart album: real, backed by the media store's video-only path.
  AlbumInfo? videos;
  for (final a in albums) {
    if (a.name.toLowerCase().contains('video')) {
      videos = a;
      break;
    }
  }
  return (total, videos, albums);
});

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(4, 6, 4, 10),
        child: Text(
          text,
          style: Theme.of(context)
              .textTheme
              .titleMedium
              ?.copyWith(fontWeight: FontWeight.w800),
        ),
      );
}

class _AlbumGrid extends ConsumerWidget {
  const _AlbumGrid({required this.albums, this.deviceStyle = false});

  final List<AlbumInfo> albums;
  final bool deviceStyle;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    return LayoutBuilder(
      builder: (context, constraints) {
        final cross = constraints.maxWidth > 600 ? 4 : 2;
        return GridView.count(
          crossAxisCount: cross,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: deviceStyle ? 0.82 : 0.92,
          children: [
            for (final album in albums)
              _AlbumCard(
                album: album,
                fallbackName: album.id == SmartAlbumIds.all
                    ? l10n.albumAllPhotos
                    : album.id == SmartAlbumIds.videos
                        ? l10n.albumVideos
                        : album.name,
              ),
          ],
        );
      },
    );
  }
}

class _AlbumCard extends ConsumerWidget {
  const _AlbumCard({required this.album, required this.fallbackName});

  final AlbumInfo album;
  final String fallbackName;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    return Pressable(
      onTap: () {
        Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => AlbumDetailScreen(album: album, displayName: fallbackName),
          ),
        );
      },
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: SquircleClip(
              radius: GlassTokens.radiusMd,
              child: _AlbumCover(album: album),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            fallbackName,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
          ),
          Text(
            l10n.itemsCount(album.itemCount),
            style: TextStyle(fontSize: 11, color: scheme.onSurfaceVariant),
          ),
        ],
      ),
    );
  }
}

class _AlbumCover extends ConsumerWidget {
  const _AlbumCover({required this.album});

  final AlbumInfo album;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    final factory = album.coverThumbFactory;
    if (album.id == SmartAlbumIds.all) {
      // All-photos cover: first page's first item thumbnail.
      return FutureBuilder<Uint8List?>(
        future: ref.read(mediaRepositoryProvider).page(0).then(
              (items) => items.isEmpty
                  ? null
                  : ref.read(mediaRepositoryProvider).thumbnail(items.first.id),
            ),
        builder: (context, snapshot) => _coverOrPlaceholder(snapshot.data, scheme),
      );
    }
    if (factory == null) {
      return _coverOrPlaceholder(null, scheme);
    }
    return FutureBuilder<Uint8List?>(
      future: factory(),
      builder: (context, snapshot) => _coverOrPlaceholder(snapshot.data, scheme),
    );
  }

  Widget _coverOrPlaceholder(Uint8List? bytes, ColorScheme scheme) {
    if (bytes == null) {
      return ColoredBox(
        color: scheme.surfaceContainerHighest,
        child: Center(
          child: Icon(Icons.folder_outlined, color: scheme.outline),
        ),
      );
    }
    return Stack(
      fit: StackFit.expand,
      children: [
        Image.memory(bytes, fit: BoxFit.cover),
        // Subtle glass gradient so overlaid text stays readable (§1 layered
        // surfaces, no heavy chrome).
        DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Colors.transparent, Colors.black.withValues(alpha: 0.18)],
            ),
          ),
        ),
      ],
    );
  }
}

/// Album detail: the timeline grid scoped to one album (reuses the exact
/// same virtualized grid, sticky headers, pinch density and scrubber).
class AlbumDetailScreen extends StatelessWidget {
  const AlbumDetailScreen({super.key, required this.album, required this.displayName});

  final AlbumInfo album;
  final String displayName;

  @override
  Widget build(BuildContext context) {
    final albumId = album.id == SmartAlbumIds.all ? null : album.id;
    return Scaffold(
      appBar: AppBar(
        title: Text(displayName, style: const TextStyle(fontWeight: FontWeight.w800)),
        centerTitle: false,
      ),
      body: TimelineScreen(initialAlbumId: albumId),
    );
  }
}
