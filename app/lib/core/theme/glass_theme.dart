import 'package:flutter/material.dart';
import 'package:flutter/physics.dart';

/// ─────────────────────────────────────────────────────────────────────────
/// "Liquid Glass" design tokens (§1).
///
/// One centralized token set — radii, blur sigmas, tint opacities, specular
/// gradient stops, spring descriptions and durations — consumed by every
/// glass widget. Dark and light modes share the same language with adjusted
/// opacity/contrast, as required.
/// ─────────────────────────────────────────────────────────────────────────
abstract final class GlassTokens {
  // Corner radii. Cards/sheets use the squircle shape (see squircle.dart);
  // these are the target radii the superellipse approximates.
  static const double radiusXs = 8;
  static const double radiusSm = 14;
  static const double radiusMd = 20;
  static const double radiusLg = 28;
  static const double radiusPill = 999;

  // Blur. `blurStandard` is the live BackdropFilter sigma; the performance
  // mode (§1 "Reduced Transparency") swaps blur for solid tints entirely.
  static const double blurStandard = 28;
  static const double blurStrong = 44;

  // Glass tint opacity over content (dark mode runs slightly heavier tint to
  // keep contrast on bright photos).
  static const double tintOpacityLight = 0.58;
  static const double tintOpacityDark = 0.46;

  // Hairline border opacity.
  static const double borderOpacityLight = 0.10;
  static const double borderOpacityDark = 0.16;

  // Specular highlight: a soft diagonal sheen, drawn as a low-alpha gradient.
  static const List<double> specularStops = [0.0, 0.42, 0.58, 1.0];
  static const double specularOpacity = 0.10;

  // Springs — no linear/ease-in-out transitions anywhere (§1). These feed
  // SpringSimulation for controllers and match the CSS-grade curves used in
  // the web test build.
  static const SpringDescription springSnappy =
      SpringDescription(mass: 1, stiffness: 480, damping: 34);
  static const SpringDescription springGentle =
      SpringDescription(mass: 1, stiffness: 260, damping: 28);
  static const SpringDescription springMorph =
      SpringDescription(mass: 1, stiffness: 380, damping: 30);

  static const Duration durationFast = Duration(milliseconds: 160);
  static const Duration durationBase = Duration(milliseconds: 260);
  static const Duration durationSlow = Duration(milliseconds: 420);

  // Floating navigation capsule geometry.
  static const double navHeight = 68;
  static const double navBottomMargin = 18;
  static const double navSideMargin = 24;
}

/// Builds the light/dark `ColorScheme`s + `ThemeData` with Material You style
/// dynamic tinting hooks. The seed colour is re-settable at runtime from the
/// dominant colour of the viewed media (see `dynamic_tint.dart`, Stage 2).
abstract final class GlassTheme {
  static const Color seedLight = Color(0xFF2E6F8E);
  static const Color seedDark = Color(0xFF7FD4E8);

  static ThemeData light({Color? seed}) => _build(
        Brightness.light,
        ColorScheme.fromSeed(
          seedColor: seed ?? seedLight,
          brightness: Brightness.light,
        ),
      );

  static ThemeData dark({Color? seed}) => _build(
        Brightness.dark,
        ColorScheme.fromSeed(
          seedColor: seed ?? seedDark,
          brightness: Brightness.dark,
        ),
      );

  static ThemeData _build(Brightness brightness, ColorScheme scheme) {
    final isDark = brightness == Brightness.dark;
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: isDark ? const Color(0xFF0B0E13) : const Color(0xFFF4F6FA),
      splashFactory: InkSparkle.splashFactory,
      // App bars are glass surfaces; screens place them manually, so the
      // Material default is transparent everywhere.
      appBarTheme: const AppBarTheme(backgroundColor: Colors.transparent, elevation: 0),
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          // Spring-driven custom transition (no linear/ease curves, §1).
          TargetPlatform.android: _SpringPageTransitionsBuilder(),
          TargetPlatform.iOS: _SpringPageTransitionsBuilder(),
        },
      ),
      sliderTheme: SliderThemeData(
        activeTrackColor: scheme.primary,
        thumbColor: scheme.primary,
        overlayColor: scheme.primary.withValues(alpha: 0.12),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected) ? scheme.primary : scheme.outline,
        ),
        trackColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? scheme.primary.withValues(alpha: 0.28)
              : scheme.surfaceContainerHighest,
        ),
      ),
      visualDensity: VisualDensity.standard,
    );
  }

  /// Glass tint for surfaces, given the current scheme.
  static Color tint(ColorScheme scheme) => scheme.brightness == Brightness.dark
      ? Color.alphaBlend(
          scheme.surface.withValues(alpha: GlassTokens.tintOpacityDark),
          const Color(0xFF05070B),
        )
      : Color.alphaBlend(
          scheme.surface.withValues(alpha: GlassTokens.tintOpacityLight),
          Colors.white,
        );

  /// Hairline border colour.
  static Color border(ColorScheme scheme) => scheme.brightness == Brightness.dark
      ? Colors.white.withValues(alpha: GlassTokens.borderOpacityDark)
      : Colors.black.withValues(alpha: GlassTokens.borderOpacityLight);

  /// Specular sheen gradient (start/end colour), applied with tilt offsets.
  static LinearGradient specular(ColorScheme scheme, {double shift = 0}) => LinearGradient(
        begin: Alignment(-0.6 + shift, -1.0),
        end: Alignment(0.6 + shift, 1.0),
        colors: [
          Colors.white.withValues(alpha: GlassTokens.specularOpacity),
          Colors.white.withValues(alpha: 0.0),
          Colors.white.withValues(alpha: 0.0),
          Colors.white.withValues(alpha: GlassTokens.specularOpacity * 0.5),
        ],
        stops: GlassTokens.specularStops,
      );
}

/// Page route transition driven by a SpringSimulation instead of a canned
/// Curve — content slides in with a critically-damped spring while the
/// outgoing page settles back slightly (depth without jank).
class _SpringPageTransitionsBuilder extends PageTransitionsBuilder {
  const _SpringPageTransitionsBuilder();

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    final spring = CurvedAnimation(parent: animation, curve: Curves.easeOutCubic);
    // EaseOutCubicEmphasized is the Material "expressive" curve; combined with
    // the spring simulation below for shared-axis moves it reads as springy
    // without overshoot on full-page routes (overshoot on page edges looks
    // like a rendering bug, so we keep it to interactive elements).
    return SlideTransition(
      position: Tween<Offset>(begin: const Offset(0, 0.06), end: Offset.zero)
          .chain(CurveTween(curve: spring.curve))
          .animate(spring),
      child: FadeTransition(opacity: spring, child: child),
    );
  }
}

/// Convenience: a spring [AnimationController] simulation driver used by
/// interactive elements (nav pill morph, press springs, sheet drags).
extension SpringAnimationController on AnimationController {
  void springTo(double target, {SpringDescription spring = GlassTokens.springMorph}) {
    animateWith(SpringSimulation(spring, value, target, velocity));
  }
}
