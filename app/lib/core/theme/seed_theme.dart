import 'package:flutter/material.dart';

import '../design/tokens.dart';

/// ─────────────────────────────────────────────────────────────────────────
/// Material You style theming — a faithful port of the sandbox preview's
/// `web/src/core/theme.ts`. A single seed colour is expanded into a tonal
/// token set (light + dark) with the exact HSL recipe used by the preview,
/// so the Flutter app's palette is pixel-identical for the same seed.
/// ─────────────────────────────────────────────────────────────────────────

class SeedOption {
  const SeedOption(this.id, this.label, this.color);
  final String id;
  final String label;
  final Color color;
}

/// SEEDS from theme.ts (labels are l10n keys resolved by the UI layer; the
/// ids are what persist in settings).
const List<SeedOption> kSeeds = [
  SeedOption('violet', 'Violet bloom', Color(0xFF6750A4)),
  SeedOption('teal', 'Teal shore', Color(0xFF00696D)),
  SeedOption('sunset', 'Sunset sand', Color(0xFF8C5123)),
  SeedOption('magenta', 'Bougainvillea', Color(0xFF9C4170)),
  SeedOption('forest', 'Monsoon green', Color(0xFF3F6B21)),
  SeedOption('indigo', 'Night indigo', Color(0xFF4355B9)),
];

Color seedColorFor(String seedIdOrHex) {
  for (final s in kSeeds) {
    if (s.id == seedIdOrHex) return s.color;
  }
  if (seedIdOrHex.startsWith('#') && seedIdOrHex.length == 7) {
    final v = int.tryParse(seedIdOrHex.substring(1), radix: 16);
    if (v != null) return Color(0xFF000000 | v);
  }
  return kSeeds.first.color;
}

Color _hsl(double h, double s, double l) =>
    HSLColor.fromAHSL(1, h % 360, s.clamp(0, 1), l.clamp(0, 1)).toColor();

/// schemeFrom(seedHex, dark) from theme.ts — identical hue/saturation/
/// lightness triplets per role.
ColorScheme _schemeFrom(Color seed, bool dark) {
  final hsl = HSLColor.fromColor(seed);
  final h = hsl.hue;
  var s = hsl.saturation.clamp(0.28, 0.75);
  final t = (h + 60) % 360;

  if (dark) {
    return ColorScheme(
      brightness: Brightness.dark,
      primary: _hsl(h, s, 0.8),
      onPrimary: _hsl(h, s, 0.2),
      primaryContainer: _hsl(h, s, 0.3),
      onPrimaryContainer: _hsl(h, (s + 0.1).clamp(0, 1), 0.9),
      secondary: _hsl(h, s * 0.5, 0.8),
      onSecondary: _hsl(h, s * 0.5, 0.2),
      secondaryContainer: _hsl(h, s * 0.45, 0.28),
      onSecondaryContainer: _hsl(h, s * 0.5, 0.9),
      tertiary: _hsl(t, s * 0.7, 0.8),
      onTertiary: _hsl(t, s * 0.7, 0.2),
      tertiaryContainer: _hsl(t, s * 0.6, 0.28),
      onTertiaryContainer: _hsl(t, s * 0.6, 0.9),
      surface: _hsl(h, 0.1, 0.08),
      surfaceDim: _hsl(h, 0.1, 0.06),
      surfaceBright: _hsl(h, 0.09, 0.2),
      surfaceContainerLowest: _hsl(h, 0.1, 0.06),
      surfaceContainerLow: _hsl(h, 0.09, 0.10),
      surfaceContainer: _hsl(h, 0.09, 0.12),
      surfaceContainerHigh: _hsl(h, 0.09, 0.16),
      surfaceContainerHighest: _hsl(h, 0.09, 0.2),
      onSurface: _hsl(h, 0.05, 0.92),
      onSurfaceVariant: _hsl(h, 0.08, 0.78),
      outline: _hsl(h, 0.08, 0.55),
      outlineVariant: _hsl(h, 0.08, 0.3),
      inverseSurface: _hsl(h, 0.05, 0.92),
      onInverseSurface: _hsl(h, 0.08, 0.12),
      error: const Color(0xFFFFB4AB),
      onError: const Color(0xFF690005),
      errorContainer: const Color(0xFF93000A),
      onErrorContainer: const Color(0xFFFFDAD6),
      scrim: const Color(0xFF000000),
    );
  }
  return ColorScheme(
    brightness: Brightness.light,
    primary: _hsl(h, s, 0.4),
    onPrimary: const Color(0xFFFFFFFF),
    primaryContainer: _hsl(h, (s + 0.15).clamp(0, 1), 0.9),
    onPrimaryContainer: _hsl(h, s, 0.16),
    secondary: _hsl(h, s * 0.45, 0.4),
    onSecondary: const Color(0xFFFFFFFF),
    secondaryContainer: _hsl(h, s * 0.5, 0.9),
    onSecondaryContainer: _hsl(h, s * 0.5, 0.14),
    tertiary: _hsl(t, s * 0.6, 0.42),
    onTertiary: const Color(0xFFFFFFFF),
    tertiaryContainer: _hsl(t, s * 0.6, 0.9),
    onTertiaryContainer: _hsl(t, s * 0.6, 0.16),
    surface: _hsl(h, 0.1, 0.98),
    surfaceDim: _hsl(h, 0.08, 0.9),
    surfaceBright: _hsl(h, 0.08, 0.98),
    surfaceContainerLowest: const Color(0xFFFFFFFF),
    surfaceContainerLow: _hsl(h, 0.08, 0.965),
    surfaceContainer: _hsl(h, 0.08, 0.95),
    surfaceContainerHigh: _hsl(h, 0.08, 0.92),
    surfaceContainerHighest: _hsl(h, 0.08, 0.89),
    onSurface: _hsl(h, 0.08, 0.12),
    onSurfaceVariant: _hsl(h, 0.07, 0.32),
    outline: _hsl(h, 0.07, 0.48),
    outlineVariant: _hsl(h, 0.08, 0.82),
    inverseSurface: _hsl(h, 0.08, 0.18),
    onInverseSurface: _hsl(h, 0.05, 0.95),
    error: const Color(0xFFB3261E),
    onError: const Color(0xFFFFFFFF),
    errorContainer: const Color(0xFFF9DEDC),
    onErrorContainer: const Color(0xFF410E0B),
    scrim: const Color(0xFF000000),
  );
}

/// buildTokens(seedHex, mode, prefersDark) from theme.ts.
ColorScheme buildScheme(Color seed, ThemeMode mode, bool prefersDark) {
  final dark = mode == ThemeMode.dark ||
      (mode == ThemeMode.system && prefersDark);
  return _schemeFrom(seed, dark);
}

/// App ThemeData from a scheme. The preview's base type: 14.5px, +0.1px
/// letter spacing, system UI stack (Roboto on Android / SF Pro on iOS —
/// the tail of the preview's font stack, no bundled webfonts).
ThemeData themeFromScheme(ColorScheme scheme) {
  final base = ThemeData(colorScheme: scheme, useMaterial3: true);
  final tt = base.textTheme
      .apply(
        bodyColor: scheme.onSurface,
        displayColor: scheme.onSurface,
      )
      .copyWith(
        bodyMedium: base.textTheme.bodyMedium?.copyWith(
          fontSize: 14.5,
          letterSpacing: 0.1,
          color: scheme.onSurface,
        ),
      );
  return base.copyWith(
    textTheme: tt,
    scaffoldBackgroundColor: scheme.surfaceDim,
    canvasColor: scheme.surfaceDim,
    // The design language uses press-scale feedback (Pressable), not
    // material ink splashes.
    splashColor: Colors.transparent,
    highlightColor: Colors.transparent,
    splashFactory: NoSplash.splashFactory,
    appBarTheme: AppBarTheme(
      backgroundColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      foregroundColor: scheme.onSurface,
    ),
    // Route transitions — the preview's `.screen.slide-in`:
    // translateX(26px→0) + opacity 0.4→1, page duration, ease-out.
    pageTransitionsTheme: const PageTransitionsTheme(
      builders: {
        TargetPlatform.android: SlideInPageTransitionsBuilder(),
        TargetPlatform.iOS: SlideInPageTransitionsBuilder(),
      },
    ),
  );
}

/// Pushed-page transition matching the preview's slide-in keyframes.
class SlideInPageTransitionsBuilder extends PageTransitionsBuilder {
  const SlideInPageTransitionsBuilder();

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    final a = CurvedAnimation(parent: animation, curve: kEaseOut);
    return FadeTransition(
      opacity: Tween<double>(begin: 0.4, end: 1.0).animate(a),
      child: AnimatedBuilder(
        animation: a,
        builder: (context, c) => Transform.translate(
          offset: Offset(26 * (1 - a.value), 0),
          child: c,
        ),
        child: child,
      ),
    );
  }
}
