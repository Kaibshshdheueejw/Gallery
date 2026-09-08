import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../constants.dart';
import '../theme/seed_theme.dart';

/// ─────────────────────────────────────────────────────────────────────────
/// User settings — a faithful port of the sandbox preview's Settings model
/// (`web/src/data/models.ts` DEFAULT_SETTINGS) plus the Flutter-only
/// performance layer (device-tier glass fallback, parallax toggle).
/// Persisted as one JSON blob (deep-merged over defaults on load, exactly
/// like the preview's localStorage payload) via SharedPreferences.
/// ─────────────────────────────────────────────────────────────────────────

/* ── enums (persisted as web-identical strings) ───────────────────────── */

enum Lang {
  system('system'),
  en('en'),
  hi('hi'),
  bn('bn'),
  es('es');

  const Lang(this.wire);
  final String wire;
  static Lang fromWire(String? v) =>
      Lang.values.firstWhere((e) => e.wire == v, orElse: () => Lang.system);
}

enum ThumbRatio {
  square('square'),
  r43('4:3'),
  auto('auto');

  const ThumbRatio(this.wire);
  final String wire;
  static ThumbRatio fromWire(String? v) =>
      ThumbRatio.values.firstWhere((e) => e.wire == v, orElse: () => ThumbRatio.square);
}

enum LayoutDensity {
  comfortable('comfortable'),
  standard('standard'),
  compact('compact');

  const LayoutDensity(this.wire);
  final String wire;
  static LayoutDensity fromWire(String? v) => LayoutDensity.values
      .firstWhere((e) => e.wire == v, orElse: () => LayoutDensity.standard);
}

enum NavStyle {
  capsule('capsule'),
  compact('compact');

  const NavStyle(this.wire);
  final String wire;
  static NavStyle fromWire(String? v) =>
      NavStyle.values.firstWhere((e) => e.wire == v, orElse: () => NavStyle.capsule);
}

enum AnimSpeed {
  relaxed('relaxed'),
  standard('standard'),
  fast('fast');

  const AnimSpeed(this.wire);
  final String wire;
  static AnimSpeed fromWire(String? v) =>
      AnimSpeed.values.firstWhere((e) => e.wire == v, orElse: () => AnimSpeed.standard);
}

enum SortOrder {
  newest('newest'),
  oldest('oldest');

  const SortOrder(this.wire);
  final String wire;
  static SortOrder fromWire(String? v) =>
      SortOrder.values.firstWhere((e) => e.wire == v, orElse: () => SortOrder.newest);
}

enum TabId {
  foryou('foryou'),
  timeline('timeline'),
  albums('albums'),
  search('search');

  const TabId(this.wire);
  final String wire;
  static TabId fromWire(String? v) =>
      TabId.values.firstWhere((e) => e.wire == v, orElse: () => TabId.foryou);
}

enum AlbumSort {
  auto_('auto'),
  name('name'),
  count('count'),
  recent('recent');

  const AlbumSort(this.wire);
  final String wire;
  static AlbumSort fromWire(String? v) =>
      AlbumSort.values.firstWhere((e) => e.wire == v, orElse: () => AlbumSort.auto_);
}

enum PreviewQuality {
  fast('fast'),
  balanced('balanced'),
  high('high');

  const PreviewQuality(this.wire);
  final String wire;
  static PreviewQuality fromWire(String? v) => PreviewQuality.values
      .firstWhere((e) => e.wire == v, orElse: () => PreviewQuality.balanced);
}

enum ExportFormat {
  png('png'),
  jpeg('jpeg');

  const ExportFormat(this.wire);
  final String wire;
  static ExportFormat fromWire(String? v) =>
      ExportFormat.values.firstWhere((e) => e.wire == v, orElse: () => ExportFormat.png);
}

enum BackupProvider {
  drive('drive'),
  s3('s3');

  const BackupProvider(this.wire);
  final String wire;
  static BackupProvider fromWire(String? v) => BackupProvider.values
      .firstWhere((e) => e.wire == v, orElse: () => BackupProvider.drive);
}

/// Reduced-transparency mode: OFF / ON / AUTO (device-tier detection).
/// Flutter-only performance layer (no web counterpart) — gates backdrop
/// blur on low-tier devices.
enum PerformanceMode { off, on, auto }

/* ── nested setting groups ─────────────────────────────────────────────── */

class GlassSettings {
  const GlassSettings({this.intensity = 62, this.blur = 58, this.transparency = 46});
  final double intensity; // 0..100
  final double blur; // 0..100
  final double transparency; // 0..100

  GlassSettings copyWith({double? intensity, double? blur, double? transparency}) =>
      GlassSettings(
        intensity: intensity ?? this.intensity,
        blur: blur ?? this.blur,
        transparency: transparency ?? this.transparency,
      );

  Map<String, dynamic> toJson() =>
      {'intensity': intensity, 'blur': blur, 'transparency': transparency};

  factory GlassSettings.fromJson(Map<String, dynamic>? j) {
    const d = GlassSettings();
    if (j == null) return d;
    return GlassSettings(
      intensity: (j['intensity'] as num?)?.toDouble() ?? d.intensity,
      blur: (j['blur'] as num?)?.toDouble() ?? d.blur,
      transparency: (j['transparency'] as num?)?.toDouble() ?? d.transparency,
    );
  }
}

class AlbumSettings {
  const AlbumSettings({
    this.showPeople = true,
    this.showPlaces = true,
    this.showFolders = true,
    this.showViewed = true,
    this.sort = AlbumSort.auto_,
  });
  final bool showPeople;
  final bool showPlaces;
  final bool showFolders;
  final bool showViewed;
  final AlbumSort sort;

  AlbumSettings copyWith({
    bool? showPeople,
    bool? showPlaces,
    bool? showFolders,
    bool? showViewed,
    AlbumSort? sort,
  }) =>
      AlbumSettings(
        showPeople: showPeople ?? this.showPeople,
        showPlaces: showPlaces ?? this.showPlaces,
        showFolders: showFolders ?? this.showFolders,
        showViewed: showViewed ?? this.showViewed,
        sort: sort ?? this.sort,
      );

  Map<String, dynamic> toJson() => {
        'showPeople': showPeople,
        'showPlaces': showPlaces,
        'showFolders': showFolders,
        'showViewed': showViewed,
        'sort': sort.wire,
      };

  factory AlbumSettings.fromJson(Map<String, dynamic>? j) {
    const d = AlbumSettings();
    if (j == null) return d;
    return AlbumSettings(
      showPeople: j['showPeople'] as bool? ?? d.showPeople,
      showPlaces: j['showPlaces'] as bool? ?? d.showPlaces,
      showFolders: j['showFolders'] as bool? ?? d.showFolders,
      showViewed: j['showViewed'] as bool? ?? d.showViewed,
      sort: AlbumSort.fromWire(j['sort'] as String?),
    );
  }
}

class PhotoEditSettings {
  const PhotoEditSettings({
    this.previewQuality = PreviewQuality.balanced,
    this.autoEnhance = false,
    this.exportFormat = ExportFormat.png,
    this.exportQuality = 92,
    this.historyDepth = 40,
  });
  final PreviewQuality previewQuality;
  final bool autoEnhance;
  final ExportFormat exportFormat;
  final int exportQuality; // 50..100
  final int historyDepth;

  PhotoEditSettings copyWith({
    PreviewQuality? previewQuality,
    bool? autoEnhance,
    ExportFormat? exportFormat,
    int? exportQuality,
    int? historyDepth,
  }) =>
      PhotoEditSettings(
        previewQuality: previewQuality ?? this.previewQuality,
        autoEnhance: autoEnhance ?? this.autoEnhance,
        exportFormat: exportFormat ?? this.exportFormat,
        exportQuality: exportQuality ?? this.exportQuality,
        historyDepth: historyDepth ?? this.historyDepth,
      );

  Map<String, dynamic> toJson() => {
        'previewQuality': previewQuality.wire,
        'autoEnhance': autoEnhance,
        'exportFormat': exportFormat.wire,
        'exportQuality': exportQuality,
        'historyDepth': historyDepth,
      };

  factory PhotoEditSettings.fromJson(Map<String, dynamic>? j) {
    const d = PhotoEditSettings();
    if (j == null) return d;
    return PhotoEditSettings(
      previewQuality: PreviewQuality.fromWire(j['previewQuality'] as String?),
      autoEnhance: j['autoEnhance'] as bool? ?? d.autoEnhance,
      exportFormat: ExportFormat.fromWire(j['exportFormat'] as String?),
      exportQuality: (j['exportQuality'] as num?)?.toInt() ?? d.exportQuality,
      historyDepth: (j['historyDepth'] as num?)?.toInt() ?? d.historyDepth,
    );
  }
}

class GestureSettings {
  const GestureSettings({this.brightness = true, this.volume = true, this.seek = true});
  final bool brightness;
  final bool volume;
  final bool seek;

  GestureSettings copyWith({bool? brightness, bool? volume, bool? seek}) => GestureSettings(
        brightness: brightness ?? this.brightness,
        volume: volume ?? this.volume,
        seek: seek ?? this.seek,
      );

  Map<String, dynamic> toJson() =>
      {'brightness': brightness, 'volume': volume, 'seek': seek};

  factory GestureSettings.fromJson(Map<String, dynamic>? j) {
    const d = GestureSettings();
    if (j == null) return d;
    return GestureSettings(
      brightness: j['brightness'] as bool? ?? d.brightness,
      volume: j['volume'] as bool? ?? d.volume,
      seek: j['seek'] as bool? ?? d.seek,
    );
  }
}

class VideoEditSettings {
  const VideoEditSettings({
    this.gestures = const GestureSettings(),
    this.defaultSpeed = 1.0,
    this.exportFps = 30,
    this.exportRes = 720,
    this.frameStep = 1 / 30,
  });
  final GestureSettings gestures;
  final double defaultSpeed; // 0.25..3
  final int exportFps; // 30 | 60
  final int exportRes; // 720 | 1080
  final double frameStep; // seconds per frame-step

  VideoEditSettings copyWith({
    GestureSettings? gestures,
    double? defaultSpeed,
    int? exportFps,
    int? exportRes,
    double? frameStep,
  }) =>
      VideoEditSettings(
        gestures: gestures ?? this.gestures,
        defaultSpeed: defaultSpeed ?? this.defaultSpeed,
        exportFps: exportFps ?? this.exportFps,
        exportRes: exportRes ?? this.exportRes,
        frameStep: frameStep ?? this.frameStep,
      );

  Map<String, dynamic> toJson() => {
        'gestures': gestures.toJson(),
        'defaultSpeed': defaultSpeed,
        'exportFps': exportFps,
        'exportRes': exportRes,
        'frameStep': frameStep,
      };

  factory VideoEditSettings.fromJson(Map<String, dynamic>? j) {
    const d = VideoEditSettings();
    if (j == null) return d;
    return VideoEditSettings(
      gestures: GestureSettings.fromJson(j['gestures'] as Map<String, dynamic>?),
      defaultSpeed: (j['defaultSpeed'] as num?)?.toDouble() ?? d.defaultSpeed,
      exportFps: (j['exportFps'] as num?)?.toInt() ?? d.exportFps,
      exportRes: (j['exportRes'] as num?)?.toInt() ?? d.exportRes,
      frameStep: (j['frameStep'] as num?)?.toDouble() ?? d.frameStep,
    );
  }
}

class ForYouSections {
  const ForYouSections({
    this.memories = true,
    this.stories = true,
    this.onThisDay = true,
    this.recently = true,
    this.featured = true,
    this.suggestions = true,
  });
  final bool memories;
  final bool stories;
  final bool onThisDay;
  final bool recently;
  final bool featured;
  final bool suggestions;

  ForYouSections copyWith({
    bool? memories,
    bool? stories,
    bool? onThisDay,
    bool? recently,
    bool? featured,
    bool? suggestions,
  }) =>
      ForYouSections(
        memories: memories ?? this.memories,
        stories: stories ?? this.stories,
        onThisDay: onThisDay ?? this.onThisDay,
        recently: recently ?? this.recently,
        featured: featured ?? this.featured,
        suggestions: suggestions ?? this.suggestions,
      );

  Map<String, dynamic> toJson() => {
        'memories': memories,
        'stories': stories,
        'onThisDay': onThisDay,
        'recently': recently,
        'featured': featured,
        'suggestions': suggestions,
      };

  factory ForYouSections.fromJson(Map<String, dynamic>? j) {
    const d = ForYouSections();
    if (j == null) return d;
    return ForYouSections(
      memories: j['memories'] as bool? ?? d.memories,
      stories: j['stories'] as bool? ?? d.stories,
      onThisDay: j['onThisDay'] as bool? ?? d.onThisDay,
      recently: j['recently'] as bool? ?? d.recently,
      featured: j['featured'] as bool? ?? d.featured,
      suggestions: j['suggestions'] as bool? ?? d.suggestions,
    );
  }
}

class AiSettings {
  const AiSettings({
    this.faces = true,
    this.ocr = true,
    this.duplicates = true,
    this.blur = true,
    this.scenes = true,
  });
  final bool faces;
  final bool ocr;
  final bool duplicates;
  final bool blur;
  final bool scenes;

  AiSettings copyWith({
    bool? faces,
    bool? ocr,
    bool? duplicates,
    bool? blur,
    bool? scenes,
  }) =>
      AiSettings(
        faces: faces ?? this.faces,
        ocr: ocr ?? this.ocr,
        duplicates: duplicates ?? this.duplicates,
        blur: blur ?? this.blur,
        scenes: scenes ?? this.scenes,
      );

  Map<String, dynamic> toJson() =>
      {'faces': faces, 'ocr': ocr, 'duplicates': duplicates, 'blur': blur, 'scenes': scenes};

  factory AiSettings.fromJson(Map<String, dynamic>? j) {
    const d = AiSettings();
    if (j == null) return d;
    return AiSettings(
      faces: j['faces'] as bool? ?? d.faces,
      ocr: j['ocr'] as bool? ?? d.ocr,
      duplicates: j['duplicates'] as bool? ?? d.duplicates,
      blur: j['blur'] as bool? ?? d.blur,
      scenes: j['scenes'] as bool? ?? d.scenes,
    );
  }
}

class AppNotificationSettings {
  const AppNotificationSettings({
    this.memories = true,
    this.cleanup = true,
    this.backup = false,
  });
  final bool memories;
  final bool cleanup;
  final bool backup;

  AppNotificationSettings copyWith({bool? memories, bool? cleanup, bool? backup}) =>
      AppNotificationSettings(
        memories: memories ?? this.memories,
        cleanup: cleanup ?? this.cleanup,
        backup: backup ?? this.backup,
      );

  Map<String, dynamic> toJson() =>
      {'memories': memories, 'cleanup': cleanup, 'backup': backup};

  factory AppNotificationSettings.fromJson(Map<String, dynamic>? j) {
    const d = AppNotificationSettings();
    if (j == null) return d;
    return AppNotificationSettings(
      memories: j['memories'] as bool? ?? d.memories,
      cleanup: j['cleanup'] as bool? ?? d.cleanup,
      backup: j['backup'] as bool? ?? d.backup,
    );
  }
}

class BackupSettings {
  const BackupSettings({
    this.enabled = false,
    this.provider = BackupProvider.drive,
    this.endpoint = '',
    this.encrypted = true,
    this.lastBackupAt = null,
  });
  final bool enabled;
  final BackupProvider provider;
  final String endpoint;
  final bool encrypted;
  final DateTime? lastBackupAt;

  BackupSettings copyWith({
    bool? enabled,
    BackupProvider? provider,
    String? endpoint,
    bool? encrypted,
    DateTime? lastBackupAt,
  }) =>
      BackupSettings(
        enabled: enabled ?? this.enabled,
        provider: provider ?? this.provider,
        endpoint: endpoint ?? this.endpoint,
        encrypted: encrypted ?? this.encrypted,
        lastBackupAt: lastBackupAt ?? this.lastBackupAt,
      );

  Map<String, dynamic> toJson() => {
        'enabled': enabled,
        'provider': provider.wire,
        'endpoint': endpoint,
        'encrypted': encrypted,
        'lastBackupAt': lastBackupAt?.millisecondsSinceEpoch,
      };

  factory BackupSettings.fromJson(Map<String, dynamic>? j) {
    const d = BackupSettings();
    if (j == null) return d;
    final last = (j['lastBackupAt'] as num?)?.toInt();
    return BackupSettings(
      enabled: j['enabled'] as bool? ?? d.enabled,
      provider: BackupProvider.fromWire(j['provider'] as String?),
      endpoint: j['endpoint'] as String? ?? d.endpoint,
      encrypted: j['encrypted'] as bool? ?? d.encrypted,
      lastBackupAt: last == null ? null : DateTime.fromMillisecondsSinceEpoch(last),
    );
  }
}

/* ── timeline zoom levels (TimelineScreen LEVELS from the preview) ─────── */

/// gridLevel 0..5 → (grouping, columns). Year/Month group at 3 columns,
/// Day grouping at 4/5/6/8.
const List<int> kLevelCols = [3, 3, 4, 5, 6, 8];

/// 0 = year, 1 = month, 2..5 = day (index into domain TimelineGrouping via
/// the compat getter below).
int groupingForLevel(int level) => level <= 0 ? 2 : (level == 1 ? 1 : 0);

/* ── the settings model ────────────────────────────────────────────────── */

class AppSettings {
  const AppSettings({
    // web-parity fields (DEFAULT_SETTINGS values)
    this.mode = ThemeMode.dark,
    this.seed = 'violet',
    this.dynamicColor = true,
    this.lang = Lang.system,
    this.tabOrder = const [TabId.foryou, TabId.timeline, TabId.albums, TabId.search],
    this.gridLevel = 3,
    this.thumbRatio = ThumbRatio.square,
    this.retentionDays = 30,
    this.biometrics = true,
    this.appLock = false,
    this.pin = '1234',
    this.backup = const BackupSettings(),
    this.glass = const GlassSettings(),
    this.layout = LayoutDensity.standard,
    this.navStyle = NavStyle.capsule,
    this.animations = true,
    this.animSpeed = AnimSpeed.standard,
    this.haptics = true,
    this.defaultTab = TabId.foryou,
    this.sortOrder = SortOrder.newest,
    this.showHidden = false,
    this.autoCleanup = true,
    this.autoplay = true,
    this.loop = true,
    this.albums = const AlbumSettings(),
    this.photoEdit = const PhotoEditSettings(),
    this.videoEdit = const VideoEditSettings(),
    this.foryou = const ForYouSections(),
    this.ai = const AiSettings(),
    this.notifications = const AppNotificationSettings(),
    this.wifiOnly = true,
    this.chargingOnly = false,
    // Flutter-only performance layer
    this.performanceMode = PerformanceMode.auto,
    this.autoDetectedLowTier = false,
    this.parallaxEnabled = true,
    this.seedColor = null,
  });

  final ThemeMode mode;
  final String seed; // seed id or #hex
  final bool dynamicColor; // Material You from newest photo / viewed media
  final Lang lang;
  final List<TabId> tabOrder;
  final int gridLevel; // 0..5 timeline zoom level
  final ThumbRatio thumbRatio;
  final int retentionDays; // 7 | 30 | 60 | 90
  final bool biometrics;
  final bool appLock;
  final String pin;
  final BackupSettings backup;
  final GlassSettings glass;
  final LayoutDensity layout;
  final NavStyle navStyle;
  final bool animations;
  final AnimSpeed animSpeed;
  final bool haptics;
  final TabId defaultTab;
  final SortOrder sortOrder;
  final bool showHidden;
  final bool autoCleanup;
  final bool autoplay;
  final bool loop;
  final AlbumSettings albums;
  final PhotoEditSettings photoEdit;
  final VideoEditSettings videoEdit;
  final ForYouSections foryou;
  final AiSettings ai;
  final AppNotificationSettings notifications;
  final bool wifiOnly;
  final bool chargingOnly;

  // Flutter-only (device-tier glass fallback; wallpaper-tint override).
  final PerformanceMode performanceMode;
  /// Set by the frame-timing monitor when AUTO decides the device is
  /// low-tier. Never persisted — recomputed per install.
  final bool autoDetectedLowTier;
  final bool parallaxEnabled;
  /// Dynamic-tint override (preview: wallpaperSeed) — dominant colour from
  /// the newest photo / viewed media. Not persisted (follows content).
  final Color? seedColor;

  /* ── derived values ── */

  /// The seed actually driving the theme (preview: seedHex memo).
  Color get effectiveSeedColor =>
      (dynamicColor && seedColor != null) ? seedColor! : seedColorFor(seed);

  /// True when glass surfaces must fall back to solid tint (no blur).
  bool get reduceTransparency =>
      performanceMode == PerformanceMode.on ||
      (performanceMode == PerformanceMode.auto && autoDetectedLowTier);

  /* ── compat getters for screens not yet rebuilt ── */

  ThemeMode get themeMode => mode;
  Locale? get localeOverride => lang == Lang.system ? null : Locale(lang.wire);
  int get gridColumns => kLevelCols[gridLevel.clamp(0, 5)];
  /// TimelineGrouping enum index (0=day, 1=month, 2=year).
  int get timelineGrouping => groupingForLevel(gridLevel);
  bool get hapticsEnabled => haptics;

  AppSettings copyWith({
    ThemeMode? mode,
    String? seed,
    bool? dynamicColor,
    Lang? lang,
    List<TabId>? tabOrder,
    int? gridLevel,
    ThumbRatio? thumbRatio,
    int? retentionDays,
    bool? biometrics,
    bool? appLock,
    String? pin,
    BackupSettings? backup,
    GlassSettings? glass,
    LayoutDensity? layout,
    NavStyle? navStyle,
    bool? animations,
    AnimSpeed? animSpeed,
    bool? haptics,
    TabId? defaultTab,
    SortOrder? sortOrder,
    bool? showHidden,
    bool? autoCleanup,
    bool? autoplay,
    bool? loop,
    AlbumSettings? albums,
    PhotoEditSettings? photoEdit,
    VideoEditSettings? videoEdit,
    ForYouSections? foryou,
    AiSettings? ai,
    AppNotificationSettings? notifications,
    bool? wifiOnly,
    bool? chargingOnly,
    PerformanceMode? performanceMode,
    bool? autoDetectedLowTier,
    bool? parallaxEnabled,
    Color? seedColor,
    bool clearSeed = false,
  }) =>
      AppSettings(
        mode: mode ?? this.mode,
        seed: seed ?? this.seed,
        dynamicColor: dynamicColor ?? this.dynamicColor,
        lang: lang ?? this.lang,
        tabOrder: tabOrder ?? this.tabOrder,
        gridLevel: (gridLevel ?? this.gridLevel).clamp(0, 5),
        thumbRatio: thumbRatio ?? this.thumbRatio,
        retentionDays: retentionDays ?? this.retentionDays,
        biometrics: biometrics ?? this.biometrics,
        appLock: appLock ?? this.appLock,
        pin: pin ?? this.pin,
        backup: backup ?? this.backup,
        glass: glass ?? this.glass,
        layout: layout ?? this.layout,
        navStyle: navStyle ?? this.navStyle,
        animations: animations ?? this.animations,
        animSpeed: animSpeed ?? this.animSpeed,
        haptics: haptics ?? this.haptics,
        defaultTab: defaultTab ?? this.defaultTab,
        sortOrder: sortOrder ?? this.sortOrder,
        showHidden: showHidden ?? this.showHidden,
        autoCleanup: autoCleanup ?? this.autoCleanup,
        autoplay: autoplay ?? this.autoplay,
        loop: loop ?? this.loop,
        albums: albums ?? this.albums,
        photoEdit: photoEdit ?? this.photoEdit,
        videoEdit: videoEdit ?? this.videoEdit,
        foryou: foryou ?? this.foryou,
        ai: ai ?? this.ai,
        notifications: notifications ?? this.notifications,
        wifiOnly: wifiOnly ?? this.wifiOnly,
        chargingOnly: chargingOnly ?? this.chargingOnly,
        performanceMode: performanceMode ?? this.performanceMode,
        autoDetectedLowTier: autoDetectedLowTier ?? this.autoDetectedLowTier,
        parallaxEnabled: parallaxEnabled ?? this.parallaxEnabled,
        seedColor: clearSeed ? null : (seedColor ?? this.seedColor),
      );

  /* ── JSON (deep-merge over defaults on load, like mergeSettings) ── */

  Map<String, dynamic> toJson() => {
        'mode': mode.name,
        'seed': seed,
        'dynamicColor': dynamicColor,
        'lang': lang.wire,
        'tabOrder': tabOrder.map((t) => t.wire).toList(),
        'gridLevel': gridLevel,
        'thumbRatio': thumbRatio.wire,
        'retentionDays': retentionDays,
        'biometrics': biometrics,
        'appLock': appLock,
        'pin': pin,
        'backup': backup.toJson(),
        'glass': glass.toJson(),
        'layout': layout.wire,
        'navStyle': navStyle.wire,
        'animations': animations,
        'animSpeed': animSpeed.wire,
        'haptics': haptics,
        'defaultTab': defaultTab.wire,
        'sortOrder': sortOrder.wire,
        'showHidden': showHidden,
        'autoCleanup': autoCleanup,
        'autoplay': autoplay,
        'loop': loop,
        'albums': albums.toJson(),
        'photoEdit': photoEdit.toJson(),
        'videoEdit': videoEdit.toJson(),
        'foryou': foryou.toJson(),
        'ai': ai.toJson(),
        'notifications': notifications.toJson(),
        'wifiOnly': wifiOnly,
        'chargingOnly': chargingOnly,
        'performanceMode': performanceMode.name,
        'parallax': parallaxEnabled,
      };

  static AppSettings fromJson(Map<String, dynamic>? j) {
    const d = AppSettings();
    if (j == null) return d;
    List<TabId> tabOrder = d.tabOrder;
    final rawOrder = j['tabOrder'];
    if (rawOrder is List && rawOrder.length == 4) {
      final parsed = rawOrder
          .map((e) => TabId.fromWire(e as String?))
          .toSet();
      if (parsed.length == 4) {
        tabOrder = rawOrder.map((e) => TabId.fromWire(e as String?)).toList();
      }
    }
    return AppSettings(
      mode: ThemeMode.values.firstWhere(
        (m) => m.name == j['mode'],
        orElse: () => d.mode,
      ),
      seed: j['seed'] as String? ?? d.seed,
      dynamicColor: j['dynamicColor'] as bool? ?? d.dynamicColor,
      lang: Lang.fromWire(j['lang'] as String?),
      tabOrder: tabOrder,
      gridLevel: ((j['gridLevel'] as num?)?.toInt() ?? d.gridLevel).clamp(0, 5),
      thumbRatio: ThumbRatio.fromWire(j['thumbRatio'] as String?),
      retentionDays: (j['retentionDays'] as num?)?.toInt() ?? d.retentionDays,
      biometrics: j['biometrics'] as bool? ?? d.biometrics,
      appLock: j['appLock'] as bool? ?? d.appLock,
      pin: j['pin'] as String? ?? d.pin,
      backup: BackupSettings.fromJson(j['backup'] as Map<String, dynamic>?),
      glass: GlassSettings.fromJson(j['glass'] as Map<String, dynamic>?),
      layout: LayoutDensity.fromWire(j['layout'] as String?),
      navStyle: NavStyle.fromWire(j['navStyle'] as String?),
      animations: j['animations'] as bool? ?? d.animations,
      animSpeed: AnimSpeed.fromWire(j['animSpeed'] as String?),
      haptics: j['haptics'] as bool? ?? d.haptics,
      defaultTab: TabId.fromWire(j['defaultTab'] as String?),
      sortOrder: SortOrder.fromWire(j['sortOrder'] as String?),
      showHidden: j['showHidden'] as bool? ?? d.showHidden,
      autoCleanup: j['autoCleanup'] as bool? ?? d.autoCleanup,
      autoplay: j['autoplay'] as bool? ?? d.autoplay,
      loop: j['loop'] as bool? ?? d.loop,
      albums: AlbumSettings.fromJson(j['albums'] as Map<String, dynamic>?),
      photoEdit: PhotoEditSettings.fromJson(j['photoEdit'] as Map<String, dynamic>?),
      videoEdit: VideoEditSettings.fromJson(j['videoEdit'] as Map<String, dynamic>?),
      foryou: ForYouSections.fromJson(j['foryou'] as Map<String, dynamic>?),
      ai: AiSettings.fromJson(j['ai'] as Map<String, dynamic>?),
      notifications:
          AppNotificationSettings.fromJson(j['notifications'] as Map<String, dynamic>?),
      wifiOnly: j['wifiOnly'] as bool? ?? d.wifiOnly,
      chargingOnly: j['chargingOnly'] as bool? ?? d.chargingOnly,
      performanceMode: PerformanceMode.values.firstWhere(
        (m) => m.name == j['performanceMode'],
        orElse: () => d.performanceMode,
      ),
      parallaxEnabled: (j['parallax'] as bool?) ?? d.parallaxEnabled,
    );
  }
}

/* ── controller ────────────────────────────────────────────────────────── */

class SettingsController extends Notifier<AppSettings> {
  static const _kBlob = '${AppConstants.prefsKeyPrefix}settings';
  // Legacy per-field keys (Stage 0/1 installs) — migrated once into the blob.
  static const _kTheme = '${AppConstants.prefsKeyPrefix}theme';
  static const _kPerf = '${AppConstants.prefsKeyPrefix}perfMode';
  static const _kParallax = '${AppConstants.prefsKeyPrefix}parallax';
  static const _kHaptics = '${AppConstants.prefsKeyPrefix}haptics';
  static const _kColumns = '${AppConstants.prefsKeyPrefix}columns';
  static const _kLocale = '${AppConstants.prefsKeyPrefix}locale';
  static const _kGrouping = '${AppConstants.prefsKeyPrefix}grouping';

  SharedPreferences? _prefs;

  @override
  AppSettings build() {
    // Synchronous default; `hydrate()` is awaited in main() before runApp.
    return const AppSettings();
  }

  Future<void> hydrate() async {
    final prefs = await SharedPreferences.getInstance();
    _prefs = prefs;
    final blob = prefs.getString(_kBlob);
    if (blob != null) {
      try {
        state = AppSettings.fromJson(jsonDecode(blob) as Map<String, dynamic>);
        return;
      } catch (_) {
        // corrupt blob → fall through to legacy/defaults
      }
    }
    // Legacy migration from per-field keys.
    var s = const AppSettings();
    final theme = prefs.getInt(_kTheme);
    if (theme != null && theme >= 0 && theme < ThemeMode.values.length) {
      s = s.copyWith(mode: ThemeMode.values[theme]);
    }
    final perf = prefs.getInt(_kPerf);
    if (perf != null && perf >= 0 && perf < PerformanceMode.values.length) {
      s = s.copyWith(performanceMode: PerformanceMode.values[perf]);
    }
    s = s.copyWith(parallaxEnabled: prefs.getBool(_kParallax) ?? s.parallaxEnabled);
    s = s.copyWith(haptics: prefs.getBool(_kHaptics) ?? s.haptics);
    final cols = prefs.getInt(_kColumns);
    if (cols != null) {
      s = s.copyWith(gridLevel: levelForColumns(cols));
    }
    final loc = prefs.getString(_kLocale);
    if (loc != null) s = s.copyWith(lang: Lang.fromWire(loc));
    final grouping = prefs.getInt(_kGrouping);
    if (grouping != null) {
      s = s.copyWith(gridLevel: levelForGrouping(grouping));
    }
    state = s;
    await _persist();
  }

  Future<void> _persist() async {
    final prefs = _prefs;
    if (prefs == null) return;
    await prefs.setString(_kBlob, jsonEncode(state.toJson()));
  }

  /// Generic updater (preview: setSettings(patch) + persist).
  void update(AppSettings Function(AppSettings current) f) {
    state = f(state);
    _persist();
  }

  /* ── web-parity setters ── */

  void setMode(ThemeMode mode) => update((s) => s.copyWith(mode: mode));
  void setSeed(String seed) => update((s) => s.copyWith(seed: seed, dynamicColor: false));
  void setDynamicColor(bool on) => update((s) => s.copyWith(dynamicColor: on));
  void setLang(Lang lang) => update((s) => s.copyWith(lang: lang));
  void setTabOrder(List<TabId> order) => update((s) => s.copyWith(tabOrder: order));
  void setGridLevel(int level) => update((s) => s.copyWith(gridLevel: level));
  void setThumbRatio(ThumbRatio r) => update((s) => s.copyWith(thumbRatio: r));
  void setRetentionDays(int days) => update((s) => s.copyWith(retentionDays: days));
  void setBiometrics(bool on) => update((s) => s.copyWith(biometrics: on));
  void setAppLock(bool on) => update((s) => s.copyWith(appLock: on));
  void setPin(String pin) => update((s) => s.copyWith(pin: pin));
  void setBackup(BackupSettings b) => update((s) => s.copyWith(backup: b));
  void setGlass(GlassSettings g) => update((s) => s.copyWith(glass: g));
  void setLayout(LayoutDensity l) => update((s) => s.copyWith(layout: l));
  void setNavStyle(NavStyle n) => update((s) => s.copyWith(navStyle: n));
  void setAnimations(bool on) => update((s) => s.copyWith(animations: on));
  void setAnimSpeed(AnimSpeed v) => update((s) => s.copyWith(animSpeed: v));
  void setHapticsSetting(bool on) => update((s) => s.copyWith(haptics: on));
  void setDefaultTab(TabId t) => update((s) => s.copyWith(defaultTab: t));
  void setSortOrder(SortOrder o) => update((s) => s.copyWith(sortOrder: o));
  void setShowHidden(bool on) => update((s) => s.copyWith(showHidden: on));
  void setAutoCleanup(bool on) => update((s) => s.copyWith(autoCleanup: on));
  void setAutoplay(bool on) => update((s) => s.copyWith(autoplay: on));
  void setLoop(bool on) => update((s) => s.copyWith(loop: on));
  void setAlbums(AlbumSettings a) => update((s) => s.copyWith(albums: a));
  void setPhotoEdit(PhotoEditSettings p) => update((s) => s.copyWith(photoEdit: p));
  void setVideoEdit(VideoEditSettings v) => update((s) => s.copyWith(videoEdit: v));
  void setForYou(ForYouSections f) => update((s) => s.copyWith(foryou: f));
  void setAi(AiSettings a) => update((s) => s.copyWith(ai: a));
  void setNotifications(AppNotificationSettings n) =>
      update((s) => s.copyWith(notifications: n));
  void setWifiOnly(bool on) => update((s) => s.copyWith(wifiOnly: on));
  void setChargingOnly(bool on) => update((s) => s.copyWith(chargingOnly: on));

  /* ── compat setters (screens not yet rebuilt) ── */

  void setThemeMode(ThemeMode mode) => setMode(mode);
  void setLocale(Locale? locale) => setLang(
        locale == null ? Lang.system : Lang.fromWire(locale.languageCode),
      );

  void setGridColumns(int columns) =>
      update((s) => s.copyWith(gridLevel: levelForColumns(columns)));

  void setTimelineGrouping(int groupingIndex) =>
      update((s) => s.copyWith(gridLevel: levelForGrouping(groupingIndex)));

  void setPerformanceMode(PerformanceMode mode) =>
      update((s) => s.copyWith(performanceMode: mode));

  /// Called by the frame-timing monitor (AUTO tier detection). Not persisted.
  void setAutoDetectedLowTier(bool lowTier) {
    if (state.autoDetectedLowTier == lowTier) return;
    state = state.copyWith(autoDetectedLowTier: lowTier);
  }

  void setParallax(bool enabled) => update((s) => s.copyWith(parallaxEnabled: enabled));
  void setHaptics(bool enabled) => setHapticsSetting(enabled);

  void setSeedColor(Color? color) {
    state = color == null
        ? state.copyWith(clearSeed: true)
        : state.copyWith(seedColor: color);
    // Dynamic tint is intentionally NOT persisted — it follows the content.
  }

  /// Restore defaults + clear persisted blob (preview: resetAll).
  Future<void> resetAll() async {
    state = const AppSettings();
    await _prefs?.remove(_kBlob);
  }
}

/// Nearest zoom level for a legacy column count.
int levelForColumns(int columns) {
  var best = 3;
  var bestDiff = 99;
  for (var i = 0; i < kLevelCols.length; i++) {
    final diff = (kLevelCols[i] - columns).abs();
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
}

/// TimelineGrouping index (0=day, 1=month, 2=year) → representative level.
int levelForGrouping(int groupingIndex) => switch (groupingIndex) {
      2 => 0, // year
      1 => 1, // month
      _ => 3, // day
    };

final settingsProvider =
    NotifierProvider<SettingsController, AppSettings>(SettingsController.new);
