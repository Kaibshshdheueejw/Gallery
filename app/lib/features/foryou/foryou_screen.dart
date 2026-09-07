import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/theme/glass_theme.dart';
import '../../core/widgets/glass_surface.dart';
import '../../core/widgets/pressable.dart';
import '../../core/widgets/squircle.dart';
import '../../data/media/media_repository.dart';
import '../../data/media/media_source.dart';
import '../../domain/models/media_item.dart';
import '../../l10n/app_localizations.dart';
import '../shared/asset_thumb.dart';
import '../shared/permission_gate.dart';
import '../viewer/media_viewer.dart';

/// ─────────────────────────────────────────────────────────────────────────
/// For You (§2 memories): computed from REAL library dates — "On this day"
/// (same month/day, previous years) and "Recent highlight" (busiest day in
/// the last 30 days). Cards use intelligent aspect ratios (landscape days →
/// wide card, portrait days → tall card), are image-first with a glass info
/// layer, and open the full-screen viewer scoped to that memory.
///
/// Scope note (honest, per §1): the memory engine scans the most recent
/// pages already cached by the repository (up to [MemoryEngine.maxPages]
/// pages ≈ 960 items) — deep-history memories extend automatically as the
/// timeline pages get visited, and Stage 3 moves this to an indexed DB.
/// ─────────────────────────────────────────────────────────────────────────
class Memory {
  const Memory({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.items,
  });

  final String id;
  final String title;
  final String subtitle;
  final List<MediaItem> items;

  /// Intelligent aspect ratio from the memory's dominant orientation (§2).
  double get aspectRatio {
    if (items.isEmpty) return 4 / 5;
    final landscape =
        items.where((i) => i.width >= i.height).length / items.length;
    if (landscape > 0.66) return 16 / 10;
    if (landscape < 0.33) return 4 / 5;
    return 1;
  }
}

/// Pure-ish engine: computes memories from a sample of the library.
/// Unit-tested (test/memory_engine_test.dart) with fixed clocks.
class MemoryEngine {
  const MemoryEngine();

  static const int maxPages = 8;

  /// [onThisDayLabel] / [recentLabel] / [bestDayDesc] are passed in already
  /// localized (§11: no strings constructed here).
  List<Memory> compute(
    List<MediaItem> items,
    DateTime now,
    String Function(String titleKey) l10n,
    String Function(DateTime date) bestDayDesc,
    String Function(DateTime date) dateLabel,
  ) {
    final memories = <Memory>[];

    // On this day — same month/day in previous years.
    final onThisDay = items
        .where((i) =>
            i.createdAt.month == now.month &&
            i.createdAt.day == now.day &&
            i.createdAt.year < now.year)
        .toList()
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    if (onThisDay.isNotEmpty) {
      final yearsAgo = now.year - onThisDay.first.createdAt.year;
      memories.add(
        Memory(
          id: 'on-this-day',
          title: l10n('memoryOnThisDay'),
          subtitle: '$yearsAgo · ${dateLabel(onThisDay.first.createdAt)}',
          items: onThisDay.take(40).toList(),
        ),
      );
    }

    // Recent highlight — busiest day in the last 30 days.
    final cutoff = now.subtract(const Duration(days: 30));
    final byDay = <DateTime, List<MediaItem>>{};
    for (final i in items) {
      if (i.createdAt.isBefore(cutoff)) continue;
      final day = DateTime(i.createdAt.year, i.createdAt.month, i.createdAt.day);
      if (day == DateTime(now.year, now.month, now.day)) continue;
      (byDay[day] ??= []).add(i);
    }
    if (byDay.isNotEmpty) {
      final best = byDay.entries.reduce((a, b) => a.value.length >= b.value.length ? a : b);
      if (best.value.length >= 3) {
        memories.add(
          Memory(
            id: 'recent-highlight',
            title: l10n('memoryRecentHighlight'),
            subtitle: bestDayDesc(best.key),
            items: best.value,
          ),
        );
      }
    }
    return memories;
  }
}

final _memoryItemsProvider = FutureProvider<List<MediaItem>>((ref) async {
  final repo = ref.read(mediaRepositoryProvider);
  final items = <MediaItem>[];
  for (var page = 0; page < MemoryEngine.maxPages; page++) {
    final loaded = await repo.page(page);
    items.addAll(loaded);
    if (loaded.length < MediaRepository.pageSize) break;
  }
  return items;
});

class ForYouScreen extends ConsumerWidget {
  const ForYouScreen({super.key});

  static const MemoryEngine _engine = MemoryEngine();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final permission = ref.watch(permissionProvider);
    if (permission != MediaPermission.full && permission != MediaPermission.limited) {
      return const PermissionGate(child: SizedBox.shrink());
    }

    final locale = Localizations.localeOf(context).toString();
    final itemsAsync = ref.watch(_memoryItemsProvider);
    final now = DateTime.now();

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 0, 120),
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 10),
          child: Text(
            l10n.memoriesTitle,
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
            if (memories.isEmpty) {
              return Padding(
                padding: const EdgeInsets.fromLTRB(4, 8, 20, 8),
                child: GlassCard(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      Icon(Icons.auto_awesome_outlined,
                          color: Theme.of(context).colorScheme.primary),
                      const SizedBox(width: 10),
                      Expanded(child: Text(l10n.memoryOnThisDayEmpty)),
                    ],
                  ),
                ),
              );
            }
            return SizedBox(
              height: 240,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.only(right: 16),
                itemCount: memories.length,
                separatorBuilder: (_, __) => const SizedBox(width: 12),
                itemBuilder: (context, i) =>
                    _MemoryCard(memory: memories[i], heroWidth: 240 * memories[i].aspectRatio),
              ),
            );
          },
        ),
      ],
    );
  }
}

class _MemoryCard extends ConsumerWidget {
  const _MemoryCard({required this.memory, required this.heroWidth});

  final Memory memory;
  final double heroWidth;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SizedBox(
      width: heroWidth.clamp(170, 400),
      child: Pressable(
        onTap: () {
          Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => MediaViewer(items: memory.items, initialIndex: 0),
            ),
          );
        },
        child: _MemoryCardBody(memory: memory, l10n: AppLocalizations.of(context)),
      ),
    );
  }
}

/// Image-first memory card: full-bleed hero thumbnail with a glass info
/// layer at the bottom (title, subtitle, count, play affordance) (§2).
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
                  '${memory.subtitle} · ${l10n.itemsCount(memory.items.length)}',
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
              child: const Icon(Icons.play_arrow_rounded, size: 15, color: Colors.white),
            ),
          ),
        ],
      ),
    );
  }
}
