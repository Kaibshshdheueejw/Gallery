import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/theme/glass_theme.dart';
import '../../core/widgets/glass_surface.dart';
import '../../core/widgets/pressable.dart';
import '../../core/widgets/squircle.dart';
import '../../data/media/media_source.dart';
import '../../domain/models/media_item.dart';
import '../../domain/usecases/memory_engine.dart';
import '../../l10n/app_localizations.dart';
import '../memories/memory_card.dart';
import '../memories/memories_providers.dart';
import '../shared/asset_thumb.dart';
import '../shared/permission_gate.dart';
import '../viewer/media_viewer.dart';

/// ─────────────────────────────────────────────────────────────────────────
/// For You (§2): discovery surface — "On this day", a featured recent
/// highlight, and "Recently added". The full memories collection lives on
/// the dedicated Memories screen (Timeline hamburger menu), matching the
/// web app's structure. Everything is computed from REAL library dates.
/// ─────────────────────────────────────────────────────────────────────────
class ForYouScreen extends ConsumerWidget {
  const ForYouScreen({super.key});

  static const MemoryEngine _engine = MemoryEngine();
  static const int _recentCount = 20;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final permission = ref.watch(permissionProvider);
    if (permission != MediaPermission.full && permission != MediaPermission.limited) {
      return const PermissionGate(child: SizedBox.shrink());
    }

    final locale = Localizations.localeOf(context).toString();
    final itemsAsync = ref.watch(memoryItemsProvider);
    final now = DateTime.now();

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 0, 120),
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 10),
          child: Text(
            l10n.tabForYou,
            style: Theme.of(context)
                .textTheme
                .titleLarge
                ?.copyWith(fontWeight: FontWeight.w800),
          ),
        ),
        itemsAsync.when(
          loading: () => const SizedBox(
            height: 220,
            child: Center(child: CircularProgressIndicator()),
          ),
          error: (_, __) => Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Text(l10n.errorLibraryLoad),
          ),
          data: (items) {
            if (items.isEmpty) {
              return Padding(
                padding: const EdgeInsets.fromLTRB(4, 8, 20, 8),
                child: GlassCard(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      Icon(Icons.photo_library_outlined,
                          color: Theme.of(context).colorScheme.primary),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(l10n.emptyLibrary,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w700)),
                            const SizedBox(height: 2),
                            Text(l10n.emptyLibraryHint,
                                style: Theme.of(context)
                                    .textTheme
                                    .bodySmall),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }

            final memories = _engine.compute(
              items,
              now,
              (key) => switch (key) {
                'memoryOnThisDay' => l10n.memoryOnThisDay,
                'memoryRecentHighlight' => l10n.memoryRecentHighlight,
                _ => key,
              },
              (date) => l10n.memoryBestDayDesc(
                DateFormat.yMMMMEEEEd(locale).format(date),
              ),
              (date) => DateFormat.yMMMM(locale).format(date),
            );
            final onThisDay =
                memories.where((m) => m.id == 'on-this-day').toList();
            final featured =
                memories.where((m) => m.id == 'recent-highlight').toList();
            final recent = items.take(_recentCount).toList();

            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (onThisDay.isNotEmpty) ...[
                  _SectionHeader(label: l10n.memoryOnThisDay),
                  _MemoryRail(memories: onThisDay),
                ],
                if (featured.isNotEmpty) ...[
                  _SectionHeader(label: l10n.memoryRecentHighlight),
                  _MemoryRail(memories: featured),
                ],
                _SectionHeader(label: l10n.forYouRecentlyAdded),
                _RecentlyAddedRail(items: recent),
              ],
            );
          },
        ),
      ],
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 18, 16, 10),
      child: Text(
        label,
        style: Theme.of(context)
            .textTheme
            .titleSmall
            ?.copyWith(fontWeight: FontWeight.w800),
      ),
    );
  }
}

/// Horizontal rail of memory cards (intelligent aspect ratios, §2).
class _MemoryRail extends StatelessWidget {
  const _MemoryRail({required this.memories});

  final List<Memory> memories;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 240,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.only(right: 16),
        itemCount: memories.length,
        separatorBuilder: (_, __) => const SizedBox(width: 12),
        itemBuilder: (context, i) => MemoryCard(
          memory: memories[i],
          heroWidth: 240 * memories[i].aspectRatio,
        ),
      ),
    );
  }
}

/// Newest additions as a square-thumbnail rail; opens the viewer scoped to
/// the recent slice.
class _RecentlyAddedRail extends StatelessWidget {
  const _RecentlyAddedRail({required this.items});

  final List<MediaItem> items;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 112,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.only(right: 16),
        itemCount: items.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, i) {
          final item = items[i];
          return Pressable(
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => MediaViewer(items: items, initialIndex: i),
                ),
              );
            },
            child: SquircleClip(
              radius: GlassTokens.radiusMd,
              child: SizedBox(
                width: 112,
                height: 112,
                child: AssetThumb(item: item, size: 320, radius: 0),
              ),
            ),
          );
        },
      ),
    );
  }
}
