import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/glass_theme.dart';
import '../../core/widgets/glass_surface.dart';
import '../../core/widgets/pressable.dart';
import '../../core/widgets/squircle.dart';
import '../../domain/usecases/memory_engine.dart';
import '../../l10n/app_localizations.dart';
import '../shared/asset_thumb.dart';
import '../viewer/media_viewer.dart';

/// Image-first memory card: full-bleed hero thumbnail with a glass info
/// layer at the bottom (title, subtitle, count, play affordance) (§2).
/// Shared by For You rails and the dedicated Memories screen.
class MemoryCard extends ConsumerWidget {
  const MemoryCard({
    super.key,
    required this.memory,
    required this.heroWidth,
    this.height,
  });

  final Memory memory;
  final double heroWidth;

  /// When set, the card is laid out full-width with this height (Memories
  /// screen rows); otherwise [heroWidth] drives horizontal rails.
  final double? height;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    return SizedBox(
      width: height != null ? double.infinity : heroWidth.clamp(170, 400),
      height: height,
      child: Pressable(
        onTap: () {
          Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) =>
                  MediaViewer(items: memory.items, initialIndex: 0),
            ),
          );
        },
        child: _MemoryCardBody(memory: memory, l10n: l10n),
      ),
    );
  }
}

class _MemoryCardBody extends StatelessWidget {
  const _MemoryCardBody({required this.memory, required this.l10n});

  final Memory memory;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    return SquircleClip(
      radius: GlassTokens.radiusLg,
      child: Stack(
        fit: StackFit.expand,
        children: [
          AssetThumb(item: memory.items.first, size: 720, radius: 0),
          // Bottom scrim keeps the glass layer readable over bright photos.
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Colors.transparent, Colors.black.withValues(alpha: 0.55)],
              ),
            ),
          ),
          Positioned(
            left: 12,
            right: 12,
            bottom: 10,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  memory.title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 15,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  memory.subtitle.isEmpty
                      ? l10n.itemsCount(memory.items.length)
                      : '${memory.subtitle} · ${l10n.itemsCount(memory.items.length)}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: Colors.white70, fontSize: 11.5),
                ),
              ],
            ),
          ),
          Positioned(
            right: 12,
            top: 12,
            child: GlassSurface(
              radius: GlassTokens.radiusPill,
              blur: GlassTokens.blurStandard,
              specular: false,
              parallax: false,
              tintOverride: Colors.black.withValues(alpha: 0.30),
              padding: const EdgeInsets.all(7),
              child: const Icon(Icons.play_arrow_rounded,
                  size: 15, color: Colors.white),
            ),
          ),
        ],
      ),
    );
  }
}
