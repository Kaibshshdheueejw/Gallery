import 'package:flutter/animation.dart';

import '../settings/app_settings.dart';

/// ─────────────────────────────────────────────────────────────────────────
/// Design system tokens — a faithful port of the sandbox preview's
/// `web/src/core/design.ts`. Every surface, motion curve and material in
/// the app derives from here so the Liquid-Glass language stays consistent
/// and tunable from Settings → Appearance.
/// ─────────────────────────────────────────────────────────────────────────

/* motion ─────────────────────────────────────────────────────────────── */

/// Gentle overshoot spring — CSS cubic-bezier(0.34, 1.46, 0.44, 1).
const Cubic kSpring = Cubic(0.34, 1.46, 0.44, 1);

/// Softer spring — CSS cubic-bezier(0.3, 1.28, 0.44, 1).
const Cubic kSpringSoft = Cubic(0.3, 1.28, 0.44, 1);

/// CSS cubic-bezier(0.22, 0.9, 0.3, 1).
const Cubic kEaseOut = Cubic(0.22, 0.9, 0.3, 1);

/// CSS cubic-bezier(0.6, 0.05, 0.28, 0.95).
const Cubic kEaseInOut = Cubic(0.6, 0.05, 0.28, 0.95);

/// Clock-hand sweep curve — CSS cubic-bezier(0.22, 1.3, 0.36, 1).
const Cubic kClockSweep = Cubic(0.22, 1.3, 0.36, 1);

/// Base durations (ms) at animSpeed 'standard'.
abstract final class Dur {
  static const int tap = 140;
  static const int base = 220;
  static const int sheet = 320;
  static const int page = 260;
  static const int hero = 420;
}

/// radii / spacing scale (design.ts).
abstract final class Radii {
  static const double sm = 10;
  static const double md = 16;
  static const double lg = 22;
  static const double xl = 30;
  static const double capsule = 999;
}

/// SPACE[0..7] from design.ts.
const List<double> kSpace = [0, 4, 8, 12, 16, 22, 30, 42];

/// ─────────────────────────────────────────────────────────────────────────
/// Resolved tokens for the active settings (motion speed, layout density,
/// glass material). Screens read this instead of raw settings so every
/// derived value matches the preview's CSS-variable pipeline exactly.
/// ─────────────────────────────────────────────────────────────────────────
class DesignTokens {
  const DesignTokens({
    required this.speedFactor,
    required this.layoutFactor,
    required this.animationsEnabled,
    required this.glass,
  });

  final double speedFactor;
  final double layoutFactor;
  final bool animationsEnabled;
  final GlassParams glass;

  factory DesignTokens.from(AppSettings s) {
    final speed = !s.animations
        ? 0.0
        : switch (s.animSpeed) {
            AnimSpeed.relaxed => 1.35,
            AnimSpeed.standard => 1.0,
            AnimSpeed.fast => 0.68,
          };
    final layout = switch (s.layout) {
      LayoutDensity.comfortable => 1.14,
      LayoutDensity.standard => 1.0,
      LayoutDensity.compact => 0.86,
    };
    return DesignTokens(
      speedFactor: speed,
      layoutFactor: layout,
      animationsEnabled: s.animations,
      glass: GlassParams.from(s.glass),
    );
  }

  /// When animations are off the speed factor is 0; durations collapse to
  /// a single frame instead of zero (keeps AnimationControllers legal).
  Duration dur(int baseMs) => Duration(
        milliseconds: animationsEnabled
            ? (baseMs * speedFactor).round().clamp(1, 4000)
            : 1,
      );

  Duration get durTap => dur(Dur.tap);
  Duration get durBase => dur(Dur.base);
  Duration get durSheet => dur(Dur.sheet);
  Duration get durPage => dur(Dur.page);
  Duration get durHero => dur(Dur.hero);

  double space(int index) =>
      (kSpace[index.clamp(0, kSpace.length - 1)] * layoutFactor).roundToDouble();

  /// --radius-lg: round(22 * (0.9 + lf * 0.1)).
  double get radiusLg => (Radii.lg * (0.9 + layoutFactor * 0.1)).roundToDouble();
}

/// ─────────────────────────────────────────────────────────────────────────
/// Glass material maths (design.ts applyDesignVars):
///   --glass-blur      = round(5 + blur * 0.3) px
///   --glass-saturate  = round(120 + intensity * 0.7) %
///   --glass-alpha     = 0.86 - (transparency / 100) * 0.58
///   --glass-hi        = 0.1 + (intensity / 100) * 0.42
///   --glass-shadow    = 0.1 + (intensity / 100) * 0.3
/// ─────────────────────────────────────────────────────────────────────────
class GlassParams {
  const GlassParams({
    required this.blurPx,
    required this.saturation,
    required this.alpha,
    required this.hi,
    required this.shadow,
  });

  factory GlassParams.from(GlassSettings g) => GlassParams(
        blurPx: (5 + g.blur * 0.3).roundToDouble(),
        saturation: (120 + g.intensity * 0.7).roundToDouble() / 100.0,
        alpha: 0.86 - (g.transparency / 100) * 0.58,
        hi: 0.1 + (g.intensity / 100) * 0.42,
        shadow: 0.1 + (g.intensity / 100) * 0.3,
      );

  /// Backdrop blur in CSS px (≈ Flutter sigma).
  final double blurPx;

  /// backdrop-filter saturate() as a factor (1.2 … 1.9).
  final double saturation;

  /// Surface colour alpha (0.28 … 0.86).
  final double alpha;

  /// Highlight / border strength factor (0.1 … 0.52).
  final double hi;

  /// Shadow strength factor (0.1 … 0.4).
  final double shadow;
}
