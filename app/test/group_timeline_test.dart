import 'package:flutter_test/flutter_test.dart';
import 'package:gallery_app/domain/models/media_item.dart';
import 'package:gallery_app/domain/usecases/group_timeline.dart';

MediaItem item(String id, DateTime at) => MediaItem(
      id: id,
      kind: MediaKind.photo,
      title: id,
      createdAt: at,
      modifiedAt: at,
      width: 100,
      height: 100,
      sizeBytes: 1,
      albumId: 'camera',
      albumName: 'Camera',
    );

void main() {
  final now = DateTime(2026, 9, 7, 12);

  group('GroupTimeline', () {
    test('groups by day, newest first', () {
      final items = [
        item('a', DateTime(2026, 9, 5, 8)),
        item('b', DateTime(2026, 9, 7, 9)),
        item('c', DateTime(2026, 9, 7, 10)),
        item('d', DateTime(2026, 9, 6, 11)),
      ];
      final sections =
          GroupTimeline.call(items, grouping: TimelineGrouping.day, locale: 'en', now: now);
      expect(sections.length, 3);
      expect(sections[0].items.length, 2); // Sep 7 first (newest)
      expect(sections[0].header, GroupTimeline.todayToken);
      expect(sections[1].header, GroupTimeline.yesterdayToken); // Sep 6
      expect(sections[2].header, contains('Sep')); // full date for Sep 5
    });

    test('groups by month and year', () {
      final items = [
        item('a', DateTime(2026, 9, 5)),
        item('b', DateTime(2026, 8, 20)),
        item('c', DateTime(2025, 12, 1)),
      ];
      final byMonth = GroupTimeline.call(items,
          grouping: TimelineGrouping.month, locale: 'en', now: now);
      expect(byMonth.length, 3);
      final byYear =
          GroupTimeline.call(items, grouping: TimelineGrouping.year, locale: 'en', now: now);
      expect(byYear.length, 2);
      expect(byYear[0].items.length, 2); // 2026 has two items
    });

    test('locale-aware headers (Spanish)', () {
      final items = [item('a', DateTime(2026, 9, 5))];
      final sections = GroupTimeline.call(items,
          grouping: TimelineGrouping.month, locale: 'es', now: now);
      expect(sections.single.header.toLowerCase(), contains('septiembre'));
    });

    test('empty library yields no sections', () {
      final sections =
          GroupTimeline.call([], grouping: TimelineGrouping.day, locale: 'en', now: now);
      expect(sections, isEmpty);
    });
  });
}
