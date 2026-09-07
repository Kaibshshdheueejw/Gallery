@Timeout(Duration(seconds: 45))
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gallery_app/data/media/thumb_cache.dart';

import 'helpers/fake_media_source.dart';

// NOTE: these run as testWidgets (not plain test()) on purpose — under the
// flutter_test runner, bare async test bodies awaiting library futures can
// stall outside the binding's async zone. testWidgets gives every await a
// deterministic fake-async flush. No widgets are pumped; this is pure logic.
void main() {
  group('ThumbCache (memory tier)', () {
    testWidgets('second get for the same key hits memory, not the source',
        (tester) async {
      final source = FakeMediaSource();
      final cache = ThumbCache(source, enableDisk: false);
      debugPrint('t1: before first get');
      final first = await cache.get('a1');
      debugPrint('t1: after first get');
      final second = await cache.get('a1');
      debugPrint('t1: after second get');
      expect(first, isNotNull);
      expect(second, same(first));
      expect(source.thumbnailCalls, 1);
    });

    testWidgets('LRU evicts oldest entries past the byte budget',
        (tester) async {
      final source = FakeMediaSource();
      // Fake thumbs are 68-byte PNGs; budget fits exactly two entries.
      final cache = ThumbCache(source, maxMemoryBytes: 150, enableDisk: false);
      await cache.get('a1');
      await cache.get('a2');
      await cache.get('a3'); // 3×68 > 150 → evicts a1
      expect(cache.memoryEntriesForTest, 2);
      await cache.get('a1'); // re-fetched from source
      expect(source.thumbnailCalls, 4);
    });

    testWidgets('concurrent gets share one in-flight request', (tester) async {
      final source = FakeMediaSource();
      final cache = ThumbCache(source, enableDisk: false);
      final results = await Future.wait([
        cache.get('a5'),
        cache.get('a5'),
        cache.get('a5'),
      ]);
      expect(results.every((r) => r != null), isTrue);
      expect(source.thumbnailCalls, 1);
    });

    testWidgets('clear empties the memory tier', (tester) async {
      final cache = ThumbCache(FakeMediaSource(), enableDisk: false);
      await cache.get('a1');
      cache.clear();
      expect(cache.memoryEntriesForTest, 0);
    });
  });
}
