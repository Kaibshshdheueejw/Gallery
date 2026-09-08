import '../models/media_item.dart';

/// ─────────────────────────────────────────────────────────────────────────
/// Memory engine (§2 memories): derives memories from REAL library dates —
/// "On this day" (same month/day, previous years), "Recent highlight"
/// (busiest day in the last 30 days) and day-cluster memories for the
/// dedicated Memories screen. Pure domain logic, unit-tested with fixed
/// clocks (test/memory_engine_test.dart). All labels are injected already
/// localized (§11 — no strings constructed here).
///
/// Scope note (honest, per §1): the engine scans the most recent pages
/// already cached by the repository (up to [MemoryEngine.maxPages] pages
/// ≈ 960 items) — deep-history memories extend automatically as the
/// timeline pages get visited, and a later stage moves this to an
/// indexed DB.
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

  /// Day-cluster memories for the dedicated Memories screen: days with at
  /// least [minItems] photos, newest first, between [startDaysAgo] and
  /// [windowDays] in the past. The recent window is left to
  /// [compute]'s "recent highlight" so the Memories screen never shows the
  /// same day twice.
  List<Memory> dayMemories(
    List<MediaItem> items,
    DateTime now, {
    required String Function(DateTime date) dateLabel,
    int startDaysAgo = 30,
    int windowDays = 365,
    int minItems = 4,
    int maxMemories = 24,
  }) {
    final today = DateTime(now.year, now.month, now.day);
    final recentEdge = today.subtract(Duration(days: startDaysAgo));
    final farEdge = today.subtract(Duration(days: windowDays));
    final byDay = <DateTime, List<MediaItem>>{};
    for (final i in items) {
      final day = DateTime(i.createdAt.year, i.createdAt.month, i.createdAt.day);
      if (day.isAfter(recentEdge) || day.isBefore(farEdge)) continue;
      (byDay[day] ??= []).add(i);
    }
    final days = byDay.keys.toList()..sort((a, b) => b.compareTo(a));
    final out = <Memory>[];
    for (final d in days) {
      final dayItems = byDay[d]!;
      if (dayItems.length < minItems) continue;
      dayItems.sort((a, b) => b.createdAt.compareTo(a.createdAt));
      out.add(
        Memory(
          id: 'day-${d.year}-${d.month}-${d.day}',
          title: dateLabel(d),
          // Card UI appends the localized item count itself — keeping the
          // subtitle empty avoids a "N items · N items" duplication.
          subtitle: '',
          items: dayItems,
        ),
      );
      if (out.length >= maxMemories) break;
    }
    return out;
  }
}
