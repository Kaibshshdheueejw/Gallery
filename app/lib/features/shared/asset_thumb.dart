import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/glass_theme.dart';
import '../../core/widgets/squircle.dart';
import '../../data/media/media_repository.dart';
import '../../domain/models/media_item.dart';

/// Virtualization-friendly thumbnail cell (§2):
///  • decodes only cache-sized bytes via the two-tier LRU [ThumbCache],
///  • never touches full-resolution files,
///  • shows a squircle-clipped image with a subtle spring fade-in,
///  • badges videos with duration.
class AssetThumb extends ConsumerStatefulWidget {
  const AssetThumb({
    super.key,
    required this.item,
    this.size = 360,
    this.radius = GlassTokens.radiusXs,
    this.fit = BoxFit.cover,
  });

  final MediaItem item;
  final int size;
  final double radius;
  final BoxFit fit;

  @override
  ConsumerState<AssetThumb> createState() => _AssetThumbState();
}

class _AssetThumbState extends ConsumerState<AssetThumb> {
  Uint8List? _bytes;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant AssetThumb oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.item.id != widget.item.id || oldWidget.size != widget.size) {
      _bytes = null;
      _failed = false;
      _load();
    }
  }

  Future<void> _load() async {
    try {
      final bytes = await ref
          .read(mediaRepositoryProvider)
          .thumbnail(widget.item.id, width: widget.size);
      if (!mounted) return;
      setState(() {
        _bytes = bytes;
        _failed = bytes == null;
      });
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final bytes = _bytes;
    return SquircleClip(
      radius: widget.radius,
      child: Stack(
        fit: StackFit.expand,
        children: [
          ColoredBox(color: scheme.surfaceContainerHighest),
          if (bytes != null)
            FadeInImage(
              fadeInDuration: GlassTokens.durationFast,
              fadeInCurve: Curves.easeOutCubicEmphasized,
              placeholder: MemoryImage(kTransparentImage),
              image: MemoryImage(bytes),
              fit: widget.fit,
            )
          else if (_failed)
            Icon(Icons.broken_image_outlined, color: scheme.outline, size: 22),
          if (widget.item.isVideo && bytes != null) ...[
            Positioned(
              right: 6,
              bottom: 5,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.55),
                  borderRadius: BorderRadius.circular(GlassTokens.radiusXs),
                ),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.play_arrow_rounded, size: 12, color: Colors.white),
                      const SizedBox(width: 2),
                      Text(
                        _formatDuration(widget.item.duration),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  static String _formatDuration(Duration d) {
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return d.inHours > 0 ? '${d.inHours}:$m:$s' : '$m:$s';
  }
}

/// 1×1 transparent PNG (placeholder for FadeInImage) — 68 bytes, generated
/// once. Avoids a network placeholder dependency.
final Uint8List kTransparentImage = Uint8List.fromList(<int>[
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, //
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, //
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00, //
  0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, //
  0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, //
  0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82, //
]);
