import 'package:flutter_test/flutter_test.dart';
import 'package:gallery_app/domain/models/media_item.dart';
import 'package:gallery_app/features/foryou/foryou_screen.dart';

MediaItem item(String id, DateTime at, {int w = 1200, int h = 1600}) => MediaItem(
      id: id,
      kind: MediaKind.photo,
      title: id,
      createdAt: at,
      modifiedAt: at,
      width: w,
      height: h,
      sizeBytes: 1,
      albumId: 'camera',
      albumName: 'Camera',
    );

void main() {
  const engine = MemoryEngine();
  final now = DateTime(2026, 9, 7, 12);

  List<Memory> run(List<MediaItem> items) => engine.compute(
        items,
        now,
        (key) => key,
        (d) => d.toIso8601String(),
        (d) => d.toIso8601String(),
      );

  test('finds On-this-day memories from previous years', () {
    final memories = run([
      item('old1', DateTime(2025, 9, 7, 9)),
      item('old2', DateTime(2024, 9, 7, 10)),
      item('other', DateTime(2025, 8, 7, 10)),
    ]);
    final onThisDay = memories.where((m) => m.id == 'on-this-day');
    expect(onThisDay, hasLength(1));
    expect(onThisDay.first.items.map((i) => i.id), containsAll(['old1', 'old2']));
  });

  test('finds busiest recent day (>= 3 items) as highlight', () {
    final memories = run([
      item('x1', DateTime(2026, 8, 20, 9)),
      item('x2', DateTime(2026, 8, 20, 10)),
      item('x3', DateTime(2026, 8, 20, 11)),
      item('y1', DateTime(2026, 8, 25, 9)),
    ]);
    final highlight = memories.where((m) => m.id == 'recent-highlight');
    expect(highlight, hasLength(1));
    expect(highlight.first.items.map((i) => i.id), containsAll(['x1', 'x2', 'x3']));
  });

  test('ignores today and stale days; empty library yields nothing', () {
    expect(run([item('t', DateTime(2026, 9, 7, 8))]), isEmpty);
    expect(run([item('s', DateTime(2026, 1, 1, 8))]), isEmpty);
    expect(run([]), isEmpty);
  });

  test('intelligent aspect ratio by dominant orientation', () {
    final landscape = Memory(
      id: 'l',
      title: 't',
      subtitle: 's',
      items: [
        item('a', now, w: 1600, h: 1200),
        item('b', now, w: 1600, h: 1200),
        item('c', now, w: 1600, h: 1200),
      ],
    );
    expect(landscape.aspectRatio, 16 / 10);
    final portrait = Memory(id: 'p', title: 't', subtitle: 's', items: [item('a', now)]);
    expect(portrait.aspectRatio, 4 / 5);
    final mixed = Memory(id: 'm', title: 't', subtitle: 's', items: [
      item('a', now, w: 1600, h: 1200),
      item('b', now),
    ]);
    expect(mixed.aspectRatio, 1);
  });
}
