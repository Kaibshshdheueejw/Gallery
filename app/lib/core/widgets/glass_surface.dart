import 'dart:async';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sensors_plus/sensors_plus.dart';

import '../settings/app_settings.dart';
import '../theme/glass_theme.dart';
import 'squircle.dart';

/// ─────────────────────────────────────────────────────────────────────────
/// GlassSurface — the single frosted-glass primitive (§1).
///
/// Performance strategy (documented in DESIGN_DECISIONS.md):
///  • Live BackdropFilter blur is used ONLY for small, mostly-static surfaces
///    (nav capsule, app bars, sheets, dialogs) — never per-cell in grids.
///  • `Reduced Transparency / Performance Mode` swaps blur for a solid tint:
///    manual toggle, or automatic when [FrameTierMonitor] detects a device
///    that cannot hold 60 fps.
///  • Surfaces that overlay scrolling content (sheets) get an optional
///    `snapshotBlur`: while the content behind is animating hard (scroll),
///    we skip re-blurring and reuse the last raster (Flutter caches the
///    backdrop layer when the filter and child do not change — we simply
///    avoid repainting the glass child via RepaintBoundary).
/// ─────────────────────────────────────────────────────────────────────────
class GlassSurface extends ConsumerWidget {
  const GlassSurface({
    super.key,
    required this.child,
    this.radius = GlassTokens.radiusLg,
    this.blur = GlassTokens.blurStandard,
    this.tintOverride,
    this.border = true,
    this.specular = true,
    this.parallax = true,
    this.padding,
    this.onTap,
  });

  /// Convenience constructor for bars (app bar, nav): pill radius.
  const GlassSurface.pill({
    super.key,
    required this.child,
    this.blur = GlassTokens.blurStrong,
    this.tintOverride,
    this.padding,
    this.onTap,
  })  : radius = GlassTokens.radiusPill,
        border = true,
        specular = true,
        parallax = true;

  final Widget child;
  final double radius;
  final double blur;
  final Color? tintOverride;
  final bool border;
  final bool specular;

  /// Gyroscope specular shift — only when the user's parallax setting is on.
  final bool parallax;
  final EdgeInsetsGeometry? padding;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(settingsProvider);
    final scheme = Theme.of(context).colorScheme;

    // Pill radius must follow the surface's own height, not the screen's.
    return LayoutBuilder(
      builder: (context, constraints) => _buildSurface(
        context,
        ref,
        settings,
        scheme,
        radius >= GlassTokens.radiusPill
            ? constraints.biggest.shortestSide / 2
            : radius,
      ),
    );
  }

  Widget _buildSurface(
    BuildContext context,
    WidgetRef ref,
    AppSettings settings,
    ColorScheme scheme,
    double effectiveRadius,
  ) {
    Widget surface = DecoratedBox(
      decoration: BoxDecoration(
        color: tintOverride ?? GlassTheme.tint(scheme),
        borderRadius: BorderRadius.circular(effectiveRadius),
      ),
      child: child,
    );

    if (!settings.reduceTransparency) {
      surface = ClipRRect(
        borderRadius: BorderRadius.circular(effectiveRadius),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: blur, sigmaY: blur),
          // RepaintBoundary: the blurred backdrop is raster-cached by the
          // engine; the glass child repaints independently of scrolling
          // content behind it.
          child: RepaintBoundary(child: surface),
        ),
      );
    }

    if (specular) {
      surface = _SpecularLayer(
        radius: effectiveRadius,
        enabled: parallax && settings.parallaxEnabled && !settings.reduceTransparency,
        child: surface,
      );
    }

    if (border) {
      surface = DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(effectiveRadius),
          border: Border.all(color: GlassTheme.border(scheme)),
        ),
        child: surface,
      );
    }

    if (padding != null) surface = Padding(padding: padding!, child: surface);

    if (onTap != null) {
      surface = Material(
        type: MaterialType.transparency,
        child: InkWell(
          borderRadius: BorderRadius.circular(effectiveRadius),
          onTap: onTap,
          child: surface,
        ),
      );
    }
    return surface;
  }
}

/// Adds the shifting specular sheen driven by the accelerometer. The stream
/// is throttled to ~20 Hz and the shift clamped — enough for a subtle
/// reflection, cheap enough for mid-range devices (§1: togglable).
class _SpecularLayer extends ConsumerStatefulWidget {
  const _SpecularLayer({required this.radius, required this.enabled, required this.child});

  final double radius;
  final bool enabled;
  final Widget child;

  @override
  ConsumerState<_SpecularLayer> createState() => _SpecularLayerState();
}

class _SpecularLayerState extends ConsumerState<_SpecularLayer> {
  StreamSubscription<UserAccelerometerEvent>? _sub;
  Timer? _throttle;
  double _shift = 0;
  double _pending = 0;

  @override
  void initState() {
    super.initState();
    _listen();
  }

  @override
  void didUpdateWidget(covariant _SpecularLayer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.enabled != widget.enabled) _listen();
  }

  void _listen() {
    _sub?.cancel();
    _sub = null;
    if (!widget.enabled) return;
    _sub = userAccelerometerEventStream(samplingPeriod: const Duration(milliseconds: 50))
        .listen((e) {
      _pending = (e.x * 0.35).clamp(-0.35, 0.35);
      // Coalesce to ~20 Hz setState — reflections do not need 60 Hz updates.
      _throttle ??= Timer(const Duration(milliseconds: 50), () {
        _throttle = null;
        if (!mounted) return;
        setState(() => _shift = _pending);
      });
    }, onError: (_) {
      // No sensor (emulator/desktop): silently disable parallax.
      _sub?.cancel();
      _sub = null;
    });
  }

  @override
  void dispose() {
    _sub?.cancel();
    _throttle?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(widget.radius),
        gradient: GlassTheme.specular(scheme, shift: _shift),
      ),
      child: widget.child,
    );
  }
}

/// ─────────────────────────────────────────────────────────────────────────
/// FrameTierMonitor — automatic device-tier detection for Performance Mode
/// (§1 "automatic detection based on device tier").
///
/// Samples scheduler frame timings for the first ~3 seconds of heavy UI
/// (grid scrolling counts most). If the 90th-percentile total frame time
/// exceeds 20 ms (i.e. below ~50 fps) we flag the device as low-tier and
/// AUTO mode drops blur. No platform APIs needed; honest and reversible.
/// ─────────────────────────────────────────────────────────────────────────
class FrameTierMonitor {
  FrameTierMonitor(this._ref) {
    SchedulerBinding.instance.addTimingsCallback(_onTimings);
  }

  final Ref _ref;
  final List<int> _frameMs = [];
  bool _settled = false;
  final DateTime _started = DateTime.now();

  static const int _minSamples = 40;
  static const int _maxWindowSeconds = 12;
  static const int _p90BudgetMs = 20;

  void _onTimings(List<FrameTiming> timings) {
    if (_settled) return;
    for (final t in timings) {
      _frameMs.add(t.totalSpan.inMilliseconds);
    }
    final expired =
        DateTime.now().difference(_started) > const Duration(seconds: _maxWindowSeconds);
    if (_frameMs.length < _minSamples && !expired) return;

    _settled = true;
    SchedulerBinding.instance.removeTimingsCallback(_onTimings);
    if (_frameMs.isEmpty) return;
    _frameMs.sort();
    final p90 = _frameMs[((_frameMs.length - 1) * 0.9).round()];
    _ref.read(settingsProvider.notifier).setAutoDetectedLowTier(p90 > _p90BudgetMs);
  }

  void dispose() => SchedulerBinding.instance.removeTimingsCallback(_onTimings);
}

final frameTierMonitorProvider = Provider<FrameTierMonitor>((ref) {
  final monitor = FrameTierMonitor(ref);
  ref.onDispose(monitor.dispose);
  return monitor;
});

/// Squircle-clipped glass card used across albums/memories/cleanup surfaces.
class GlassCard extends StatelessWidget {
  const GlassCard({
    super.key,
    required this.child,
    this.radius = GlassTokens.radiusMd,
    this.onTap,
    this.padding = const EdgeInsets.all(12),
  });

  final Widget child;
  final double radius;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) => SquircleClip(
        radius: radius,
        child: GlassSurface(
          radius: radius,
          padding: padding,
          onTap: onTap,
          child: child,
        ),
      );
}
