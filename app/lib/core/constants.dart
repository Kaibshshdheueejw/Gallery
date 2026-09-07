/// Single source of truth for product identity (§11: the app name must not be
/// hardcoded anywhere except this file).
abstract final class AppConstants {
  /// User-facing product name. In every locale. Always.
  static const String appName = 'Gallery';

  /// Build version shown in Settings → About (kept in sync with pubspec).
  static const String appVersion = '0.1.0';

  /// Reverse-DNS application id, shared by Android (`applicationId`) and iOS
  /// (`PRODUCT_BUNDLE_IDENTIFIER`).
  static const String applicationId = 'dev.gallery.app';

  /// SharedPreferences namespace prefixes.
  static const String prefsKeyPrefix = 'gallery.v1.';

  /// Thumbnail cache sizing (memory tier). Disk tier is bounded separately in
  /// `data/media/thumb_cache.dart`.
  static const int thumbCacheMaxBytes = 48 * 1024 * 1024; // 48 MB
}
