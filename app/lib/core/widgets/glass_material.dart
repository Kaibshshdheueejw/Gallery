import 'dart:typed_data';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../design/tokens.dart';
import '../settings/app_settings.dart';
import 'pressable.dart';

/// The four glass materials from the preview's styles.css:
///   .glass          → base    (surface @ alpha, blur, saturate, 1px border,
///                               inset top highlight, drop shadow)
///   .glass-subtle   → subtle  (62% alpha, 60% blur, softer highlight)
///   .glass-strong   → strong  (alpha+0.16 capped .92, 135% blur, +20%
///                               saturate, diagonal specular sheen ::before)
///   .glass-raised   → raised  (base material, bigger shadow)
enum GlassVariant { base, subtle, strong, raised }

/// Saturation matrix for backdrop-filter: saturate(f) — the standard
/// luminance-preserving scale used by CSS/SVG filters.
///
/// ImageFilter.matrix takes a 4×4 matrix in COLUMN-major order (engine:
/// DlMatrix::MakeColumn) — no SVG 5th translate column.
///   R' = (r+(1-r)f)·R + g(1-f)·G + b(1-f)·B   (row 0)
///   G' = r(1-f)·R + (g+(1-g)f)·G + b(1-f)·B   (row 1)
///   B' = r(1-f)·R + g(1-f)·G + (b+(1-b)f)·B   (row 2)
///   A' = A                                     (row 3)
ImageFilter _saturate(double f) {
  const r = 0.2126, g = 0.7152, b = 0.0722;
  return ImageFilter.matrix(Float64List.fromList(<double>[
    r + (1 - r) * f, r - r * f, r - r * f, 0, // column 0
    g - g * f, g + (1 - g) * f, g - g * f, 0, // column 1
    b - b * f, b - b * f, b + (1 - b) * f, 0, // column 2
    0, 0, 0, 1, // column 3 (alpha passthrough)
  ]));
}

/// Liquid Glass surface. Blur is a single BackdropFilter (GPU-friendly) and
/// is skipped entirely when the device-tier monitor asked for reduced
/// transparency — the surface then falls back to a solid tint, matching the
/// performance rules (§ no expensive effects rendered unnecessarily).
class Glass extends ConsumerWidget {
  const Glass({
    super.key,
    required this.child,
    this.variant = GlassVariant.base,
    this.radius,
    this.padding,
    this.onTap,
    this.border = true,
  });

  /// Convenience constructor for pill surfaces (nav, chips, bars).
  const Glass.pill({
    super.key,
    required this.child,
    this.variant = GlassVariant.base,
    this.padding,
    this.onTap,
    this.border = true,
  }) : radius = 999;

  final Widget child;
  final GlassVariant variant;
  final double? radius;
  final EdgeInsetsGeometry? padding;
  final VoidCallback? onTap;
  final bool border;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(settingsProvider);
    final tokens = DesignTokens.from(settings);
    final gp = tokens.glass;
    final scheme = Theme.of(context).colorScheme;

    // Material maths (styles.css .glass / .glass-subtle / .glass-strong).
    final double bgAlpha;
    final double blurPx;
    final double saturate;
    final double hiHighlight; // inset top line strength factor
    switch (variant) {
      case GlassVariant.base:
        bgAlpha = gp.alpha;
        blurPx = gp.blurPx;
        saturate = gp.saturation;
        hiHighlight = 0.55;
      case GlassVariant.raised:
        bgAlpha = gp.alpha;
        blurPx = gp.blurPx;
        saturate = gp.saturation;
        hiHighlight = 0.60; // .glass-raised inset @ hi*60%
      case GlassVariant.subtle:
        bgAlpha = gp.alpha * 0.62;
        blurPx = gp.blurPx * 0.6;
        saturate = gp.saturation;
        hiHighlight = 0.34;
      case GlassVariant.strong:
        bgAlpha = (gp.alpha + 0.16).clamp(0.0, 0.92);
        blurPx = gp.blurPx * 1.35;
        saturate = gp.saturation + 0.20;
        hiHighlight = 0.55;
    }

    final effectiveRadius = BorderRadius.circular(
      radius == null ? tokens.radiusLg : (radius! >= 999 ? 999 : radius!),
    );
    final useBlur = !settings.reduceTransparency && blurPx > 0.5;
    // Solid fallback keeps content readable without the blur pass.
    final fallbackAlpha = useBlur ? bgAlpha : (bgAlpha + 0.30).clamp(0.0, 1.0);

    // .glass-subtle overrides box-shadow entirely → inset line only, NO
    // outer drop shadow (CSS cascade: later rule replaces the property).
    final boxShadow = switch (variant) {
      // .glass: 0 10px 34px rgba(0,0,0,shadow*0.55)
      GlassVariant.base || GlassVariant.strong => [
        BoxShadow(
          color: Colors.black.withValues(alpha: gp.shadow * 0.55),
          blurRadius: 34,
          offset: const Offset(0, 10),
        ),
      ],
      GlassVariant.subtle => const <BoxShadow>[],
      // .glass-raised: 0 18px 48px rgba(0,0,0,shadow*0.8)
      GlassVariant.raised => [
        BoxShadow(
          color: Colors.black.withValues(alpha: gp.shadow * 0.8),
          blurRadius: 48,
          offset: const Offset(0, 18),
        ),
      ],
    };

    Widget surface = DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: effectiveRadius,
        border: border
            ? Border.all(
                color: scheme.onSurface.withValues(alpha: gp.hi * 0.26),
                width: 1,
              )
            : null,
        boxShadow: boxShadow,
      ),
      child: ClipRRect(
        borderRadius: effectiveRadius,
        child: Stack(
          fit: StackFit.passthrough,
          children: [
            if (useBlur)
              Positioned.fill(
                child: BackdropFilter(
                  filter: ImageFilter.compose(
                    outer: _saturate(saturate),
                    inner: ImageFilter.blur(sigmaX: blurPx, sigmaY: blurPx),
                  ),
                  child: const SizedBox.shrink(),
                ),
              ),
            // Surface tint — painted OVER the blurred backdrop (CSS order:
            // backdrop-filter result, then the element's own background).
            Positioned.fill(
              child: IgnorePointer(
                child: ColoredBox(
                  color: scheme.surface.withValues(alpha: fallbackAlpha),
                ),
              ),
            ),
            Padding(
              padding: padding ?? EdgeInsets.zero,
              child: child,
            ),
            // inset 0 1px 0 white @ hi*strength — the top glass edge.
            Positioned(
              left: 0,
              right: 0,
              top: 0,
              height: 1,
              child: IgnorePointer(
                child: ColoredBox(
                  color: Colors.white.withValues(alpha: gp.hi * hiHighlight),
                ),
              ),
            ),
            // .glass-strong::before — diagonal specular sheen (118deg,
            // white @ hi*0.30 → transparent at 42%).
            if (variant == GlassVariant.strong)
              Positioned.fill(
                child: IgnorePointer(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      borderRadius: effectiveRadius,
                      gradient: LinearGradient(
                        begin: const Alignment(-0.88, -0.47),
                        end: const Alignment(0.88, 0.47),
                        colors: [
                          Colors.white.withValues(alpha: gp.hi * 0.30),
                          Colors.white.withValues(alpha: 0),
                        ],
                        stops: const [0, 0.42],
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );

    if (onTap != null) {
      surface = Pressable(onTap: onTap!, child: surface);
    }
    return surface;
  }
}
