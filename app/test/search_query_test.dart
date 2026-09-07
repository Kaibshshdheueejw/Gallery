import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:gallery_app/domain/models/media_item.dart';
import 'package:gallery_app/features/search/search_screen.dart';

MediaItem item(String id, String title, DateTime at,
        {String album = 'Camera', bool video = false}) =>
    MediaItem(
      id: id,
      kind: video ? MediaKind.video : MediaKind.photo,
      title: title,
      createdAt: at,
      modifiedAt: at,
      width: 100,
      height: 100,
      sizeBytes: 1,
      albumId: album.toLowerCase(),
      albumName: album,
      relativePath: 'DCIM/$album/',
    );

void main() {
  setUpAll(() async => initializeDateFormatting());

  group('SearchQuery.parse', () {
    test('ISO month: 2026-07', () {
      final q = SearchQuery.parse('2026-07', 'en', SearchTypeFilter.all);
      expect(q.month, DateTime(2026, 7));
      expect(q.year, 2026);
    });

    test('bare year: 2026', () {
      final q = SearchQuery.parse('2026', 'en', SearchTypeFilter.all);
      expect(q.year, 2026);
      expect(q.month, isNull);
    });

    test('locale month name: July 2026', () {
      final q = SearchQuery.parse('July 2026', 'en', SearchTypeFilter.all);
      expect(q.month, DateTime(2026, 7));
    });

    test('free text stays text', () {
      final q = SearchQuery.parse('receipt invoice', 'en', SearchTypeFilter.all);
      expect(q.text, 'receipt invoice');
      expect(q.month, isNull);
      expect(q.year, isNull);
    });
  });

  group('SearchQuery.matches', () {
    final july = item('j', 'July beach evening.jpg', DateTime(2026, 7, 14));
    final sep = item('s', 'Sunset.jpg', DateTime(2026, 9, 1), album: 'Screenshots');
    final vid = item('v', 'Trip clip.mp4', DateTime(2026, 7, 20), video: true);

    test('text matches title, album and path', () {
      final q = SearchQuery.parse('beach', 'en', SearchTypeFilter.all);
      expect(q.matches(july, const []), isTrue);
      expect(q.matches(sep, const []), isFalse);
      final albumQ = SearchQuery.parse('screens', 'en', SearchTypeFilter.all);
      expect(albumQ.matches(sep, const []), isTrue);
    });

    test('date criteria filter by month', () {
      final q = SearchQuery.parse('2026-07', 'en', SearchTypeFilter.all);
      expect(q.matches(july, const []), isTrue);
      expect(q.matches(sep, const []), isFalse);
      expect(q.matches(vid, const []), isTrue);
    });

    test('type filter: photos vs videos', () {
      final photos = SearchQuery(type: SearchTypeFilter.photos);
      expect(photos.matches(july, const []), isTrue);
      expect(photos.matches(vid, const []), isFalse);
      final videos = SearchQuery(type: SearchTypeFilter.videos);
      expect(videos.matches(vid, const []), isTrue);
      expect(videos.matches(july, const []), isFalse);
    });
  });
}
