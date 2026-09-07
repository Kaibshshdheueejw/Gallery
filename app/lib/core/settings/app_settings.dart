import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../constants.dart';

/// ─────────────────────────────────────────────────────────────────────────
/// User settings (§1 performance mode, parallax toggle; §7 language
/// override; grid density; theme). Persisted via SharedPreferences, exposed
/// through Riverpod. Structured metadata (albums, edits, faces) lives in the
/// database layer — this store is only for preferences.
/// ─────────────────────────────────────────────────────────────────────────

/// Reduced-transparency mode: OFF / ON / AUTO (device-tier detection).
enum PerformanceMode { off, on, auto }

class AppSettings {
  const AppSettings({
    this.themeMode = ThemeMode.system,
    this.performanceMode = PerformanceMode.auto,
    /// Set by the frame-timing monitor when AUTO decides the device is
    /// low-tier. Never persisted — recomputed per install.
    this.autoDetectedLowTier = false,
    this.parallaxEnabled = true,
    this.hapticsEnabled = true,
    this.gridColumns = 4,
    this.localeOverride = null, // null = follow system locale (§7)
    this.seedColor = null, // null = brand seed; set by dynamic tint (Stage 2)
  });

  final ThemeMode themeMode;
  final PerformanceMode performanceMode;
  final bool autoDetectedLowTier;
  final bool parallaxEnabled;
  final bool hapticsEnabled;
  final int gridColumns;
  final Locale? localeOverride;
  final Color? seedColor;

  /// True when glass surfaces must fall back to solid tint (no blur).
  bool get reduceTransparency =>
      performanceMode == PerformanceMode.on ||
      (performanceMode == PerformanceMode.auto && autoDetectedLowTier);

  AppSettings copyWith({
    ThemeMode? themeMode,
    PerformanceMode? performanceMode,
    bool? autoDetectedLowTier,
    bool? parallaxEnabled,
    bool? hapticsEnabled,
    int? gridColumns,
    Locale? localeOverride,
    bool clearLocale = false,
    Color? seedColor,
    bool clearSeed = false,
  }) =>
      AppSettings(
        themeMode: themeMode ?? this.themeMode,
        performanceMode: performanceMode ?? this.performanceMode,
        autoDetectedLowTier: autoDetectedLowTier ?? this.autoDetectedLowTier,
        parallaxEnabled: parallaxEnabled ?? this.parallaxEnabled,
        hapticsEnabled: hapticsEnabled ?? this.hapticsEnabled,
        gridColumns: gridColumns ?? this.gridColumns,
        localeOverride: clearLocale ? null : (localeOverride ?? this.localeOverride),
        seedColor: clearSeed ? null : (seedColor ?? this.seedColor),
      );
}

class SettingsController extends Notifier<AppSettings> {
  static const _kTheme = '${AppConstants.prefsKeyPrefix}theme';
  static const _kPerf = '${AppConstants.prefsKeyPrefix}perfMode';
  static const _kParallax = '${AppConstants.prefsKeyPrefix}parallax';
  static const _kHaptics = '${AppConstants.prefsKeyPrefix}haptics';
  static const _kColumns = '${AppConstants.prefsKeyPrefix}columns';
  static const _kLocale = '${AppConstants.prefsKeyPrefix}locale';

  SharedPreferences? _prefs;

  @override
  AppSettings build() {
    // Synchronous default; `hydrate()` is awaited in main() before runApp.
    return const AppSettings();
  }

  Future<void> hydrate() async {
    final prefs = await SharedPreferences.getInstance();
    _prefs = prefs;
    final localeTag = prefs.getString(_kLocale);
    state = AppSettings(
      themeMode: ThemeMode.values[prefs.getInt(_kTheme) ?? ThemeMode.system.index],
      performanceMode:
          PerformanceMode.values[prefs.getInt(_kPerf) ?? PerformanceMode.auto.index],
      parallaxEnabled: prefs.getBool(_kParallax) ?? true,
      hapticsEnabled: prefs.getBool(_kHaptics) ?? true,
      gridColumns: prefs.getInt(_kColumns) ?? 4,
      localeOverride: localeTag == null ? null : Locale(localeTag),
    );
  }

  Future<void> _persist() async {
    final prefs = _prefs;
    if (prefs == null) return;
    await prefs.setInt(_kTheme, state.themeMode.index);
    await prefs.setInt(_kPerf, state.performanceMode.index);
    await prefs.setBool(_kParallax, state.parallaxEnabled);
    await prefs.setBool(_kHaptics, state.hapticsEnabled);
    await prefs.setInt(_kColumns, state.gridColumns);
    final tag = state.localeOverride?.languageCode;
    if (tag == null) {
      await prefs.remove(_kLocale);
    } else {
      await prefs.setString(_kLocale, tag);
    }
  }

  void setThemeMode(ThemeMode mode) {
    state = state.copyWith(themeMode: mode);
    _persist();
  }

  void setPerformanceMode(PerformanceMode mode) {
    state = state.copyWith(performanceMode: mode);
    _persist();
  }

  /// Called by the frame-timing monitor (AUTO tier detection). Not persisted.
  void setAutoDetectedLowTier(bool lowTier) {
    if (state.autoDetectedLowTier == lowTier) return;
    state = state.copyWith(autoDetectedLowTier: lowTier);
  }

  void setParallax(bool enabled) {
    state = state.copyWith(parallaxEnabled: enabled);
    _persist();
  }

  void setHaptics(bool enabled) {
    state = state.copyWith(hapticsEnabled: enabled);
    _persist();
  }

  void setGridColumns(int columns) {
    state = state.copyWith(gridColumns: columns.clamp(2, 8));
    _persist();
  }

  void setLocale(Locale? locale) {
    state = locale == null
        ? state.copyWith(clearLocale: true)
        : state.copyWith(localeOverride: locale);
    _persist();
  }

  void setSeedColor(Color? color) {
    state = color == null
        ? state.copyWith(clearSeed: true)
        : state.copyWith(seedColor: color);
    // Dynamic tint is intentionally NOT persisted — it follows the content.
  }
}

final settingsProvider =
    NotifierProvider<SettingsController, AppSettings>(SettingsController.new);
