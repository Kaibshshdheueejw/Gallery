import 'package:intl/intl.dart';

import '../models/media_item.dart';

/// Timeline grouping granularity (§2: day/month/year with sticky headers).
enum TimelineGrouping { day, month, year }

class TimelineSection {
  const TimelineSection({
    required this.key,
    required this.header,
    required this.items,
  });

  /// Stable sort key (epoch of period start) — also used by the scrubber.
  final DateTime key;
  final String header;
  final List<MediaItem> items;
}

/// Pure domain logic (unit-tested): groups newest-first media into timeline
/// sections with locale-aware headers (§7 — DateFormat with the active
/// locale, no hardcoded English strings for dates).
abstract final class GroupTimeline {
  static List<TimelineSection> call(
    List<MediaItem> items, {
    required TimelineGrouping grouping,
    required String locale,
    DateTime? now,
  }) {
    final effectiveNow = now ?? DateTime.now();
    final sorted = [...items]..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    final dateFormat = DateFormat.yMMMMEEEEd(locale);
    final monthFormat = DateFormat.yMMMM(locale);
    final yearFormat = DateFormat.y(locale);

    final sections = <DateTime, List<MediaItem>>{};
    for (final item in sorted) {
      final bucket = switch (grouping) {
        TimelineGrouping.day => DateTime(
            item.createdAt.year,
            item.createdAt.month,
            item.createdAt.day,
          ),
        TimelineGrouping.month =>
          DateTime(item.createdAt.year, item.createdAt.month),
        TimelineGrouping.year => DateTime(item.createdAt.year),
      };
      (sections[bucket] ??= []).add(item);
    }

    final keys = sections.keys.toList()..sort((a, b) => b.compareTo(a));
    return [
      for (final key in keys)
        TimelineSection(
          key: key,
          header: _header(key, grouping, locale, effectiveNow,
              dayFmt: dateFormat, monthFmt: monthFormat, yearFmt: yearFormat),
          items: sections[key]!,
        ),
    ];
  }

  static String _header(
    DateTime key,
    TimelineGrouping grouping,
    String locale,
    DateTime now, {
    required DateFormat dayFmt,
    required DateFormat monthFmt,
    required DateFormat yearFmt,
  }) {
    switch (grouping) {
      case TimelineGrouping.day:
        final today = DateTime(now.year, now.month, now.day);
        final day = DateTime(key.year, key.month, key.day);
        final diff = today.difference(day).inDays;
        if (diff == 0) return _localizedToday();
        if (diff == 1) return _localizedYesterday();
        if (diff < 7) return DateFormat.EEEE(locale).format(day);
        return dayFmt.format(day);
      case TimelineGrouping.month:
        return monthFmt.format(key);
      case TimelineGrouping.year:
        return yearFmt.format(key);
    }
  }

  /// "Today"/"Yesterday" are localization keys — the UI layer resolves them
  /// through AppLocalizations; the domain returns sentinel tokens that the
  /// presentation layer maps (keeps domain free of Flutter deps while still
  /// honoring §11 "no hardcoded user-facing strings").
  static const String todayToken = '\u0000today\u0000';
  static const String yesterdayToken = '\u0000yesterday\u0000';

  static String _localizedToday() => todayToken;
  static String _localizedYesterday() => yesterdayToken;
}
