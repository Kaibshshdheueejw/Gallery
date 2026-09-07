import 'package:flutter_test/flutter_test.dart';
import 'package:gallery_app/data/media/thumb_cache.dart';

import 'helpers/fake_media_source.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('ThumbCache (memory tier)', () {
    test('second get for the same key hits memory, not the source', () async {
      final source = FakeMediaSource();
      final cache = ThumbCache(source);
      final first = await cache.get('a1');
      final second = await cache.get('a1');
      expect(first, isNotNull);
      expect(second, same(first));
      expect(source.thumbnailCalls, 1);
    });

    test('LRU evicts oldest entries past the byte budget', () async {
      final source = FakeMediaSource();
      // Fake thumbs are `width` bytes long; width=100 → 100 bytes per entry.
      final cache = ThumbCache(source, maxMemoryBytes: 250);
      await cache.get('a1', width: 100);
      await cache.get('a2', width: 100);
      await cache.get('a3', width: 100); // evicts a1
      expect(cache.memoryEntriesForTest, 2);
      await cache.get('a1', width: 100); // re-fetched from source
      expect(source.thumbnailCalls, 4);
    });

    test('concurrent gets share one in-flight request', () async {
      final source = FakeMediaSource();
      final cache = ThumbCache(source);
      final results = await Future.wait([
        cache.get('a5'),
        cache.get('a5'),
        cache.get('a5'),
      ]);
      expect(results.every((r) => r != null), isTrue);
      expect(source.thumbnailCalls, 1);
    });

    test('clear empties the memory tier', () async {
      final cache = ThumbCache(FakeMediaSource());
      await cache.get('a1');
      cache.clear();
      expect(cache.memoryEntriesForTest, 0);
    });
  });
}
