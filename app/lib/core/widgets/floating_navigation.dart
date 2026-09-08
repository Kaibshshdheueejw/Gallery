import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../design/tokens.dart';
import '../haptics.dart';
import '../settings/app_settings.dart';
import '../../l10n/app_localizations.dart';
import 'glass_material.dart';
import 'svg_icon.dart';

/// ─────────────────────────────────────────────────────────────────────────
/// FloatingNavigation — the capsule nav from the preview
/// (web/src/components/glass.tsx + NavIcons.tsx), ported 1:1:
///   • glass-strong capsule, 6px padding, bottom 18 + safe area, centered,
///     top gloss sheen (left/right 8%, height 42%, white @ hi*26%)
///   • sliding primary pill (17% fill, 30% border, inner top highlight),
///     spring-animated position & width on tab change
///   • each tab icon has its OWN tap animation (§17): sparkle bloom with
///     delayed glints, clock-hand 360° sweep, folder photo-pop, search
///     lens-swell + handle sway — transform/opacity only, replayed on
///     every tap via a pulse counter (even on the already-active tab)
///   • compact nav style hides labels (56px min width, 11/16 padding)
/// ─────────────────────────────────────────────────────────────────────────
class FloatingNavigation extends ConsumerStatefulWidget {
  const FloatingNavigation({
    super.key,
    required this.activeTab,
    required this.onTabSelected,
  });

  final TabId activeTab;
  final ValueChanged<TabId> onTabSelected;

  @override
  ConsumerState<FloatingNavigation> createState() => _FloatingNavigationState();
}

class _FloatingNavigationState extends ConsumerState<FloatingNavigation>
    with WidgetsBindingObserver {
  final Map<TabId, GlobalKey> _btnKeys = {
    for (final t in TabId.values) t: GlobalKey(),
  };
  final GlobalKey _navKey = GlobalKey();
  final Map<TabId, int> _pulses = {for (final t in TabId.values) t: 0};

  Rect? _pill;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _measure());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeMetrics() => _measure();

  @override
  void didUpdateWidget(FloatingNavigation oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.activeTab != widget.activeTab) _measure();
  }

  void _measure() {
    if (!mounted) return;
    final navBox = _navKey.currentContext?.findRenderObject() as RenderBox?;
    final btnBox =
        _btnKeys[widget.activeTab]?.currentContext?.findRenderObject() as RenderBox?;
    if (navBox == null || btnBox == null) return;
    final navOrigin = navBox.localToGlobal(Offset.zero);
    final btnOrigin = btnBox.localToGlobal(Offset.zero);
    final rect = Rect.fromLTWH(
      btnOrigin.dx - navOrigin.dx,
      btnOrigin.dy - navOrigin.dy,
      btnBox.size.width,
      btnBox.size.height,
    );
    if (rect != _pill) setState(() => _pill = rect);
  }

  void _onTapDown() {
    // web: haptic('select') fires on pointer-down
    Haptics.light(ref);
  }

  void _onTap(TabId tab) {
    setState(() => _pulses[tab] = (_pulses[tab] ?? 0) + 1);
    widget.onTabSelected(tab);
    // Tab switch may change label widths → re-measure after the frame.
    WidgetsBinding.instance.addPostFrameCallback((_) => _measure());
  }

  @override
  Widget build(BuildContext context) {
    final settings = ref.watch(settingsProvider);
    final tokens = DesignTokens.from(settings);
    final scheme = Theme.of(context).colorScheme;
    final compact = settings.navStyle == NavStyle.compact;
    // Re-measure after any rebuild (tab order, nav style, label locale).
    WidgetsBinding.instance.addPostFrameCallback((_) => _measure());

    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.only(bottom: 18),
        child: Center(
          child: ConstrainedBox(
            constraints: BoxConstraints(
              maxWidth: MediaQuery.sizeOf(context).width - 28,
            ),
            child: Glass.pill(
              key: _navKey,
              variant: GlassVariant.strong,
              padding: const EdgeInsets.all(6),
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  // sliding active pill
                  if (_pill != null)
                    AnimatedPositioned(
                      duration: tokens.durSheet,
                      curve: kSpring,
                      left: _pill!.left,
                      top: 0,
                      width: _pill!.width,
                      height: _pill!.height,
                      child: _NavPill(hi: tokens.glass.hi, scheme: scheme),
                    ),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      for (final tab in settings.tabOrder)
                        _NavButton(
                          key: _btnKeys[tab],
                          tab: tab,
                          active: tab == widget.activeTab,
                          compact: compact,
                          pulse: _pulses[tab] ?? 0,
                          animate: settings.animations,
                          tokens: tokens,
                          onTapDown: _onTapDown,
                          onTap: () => _onTap(tab),
                        ),
                    ],
                  ),
                  // .float-nav::after — top gloss sheen (top: 1px)
                  Positioned.fill(
                    child: IgnorePointer(
                      child: Padding(
                        padding: const EdgeInsets.only(top: 1),
                        child: FractionallySizedBox(
                        alignment: Alignment.topCenter,
                        widthFactor: 0.84,
                        heightFactor: 0.42,
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(999),
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [
                                Colors.white
                                    .withValues(alpha: tokens.glass.hi * 0.26),
                                Colors.white.withValues(alpha: 0),
                              ],
                            ),
                          ),
                        ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _NavPill extends StatelessWidget {
  const _NavPill({required this.hi, required this.scheme});

  final double hi;
  final ColorScheme scheme;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        color: scheme.primary.withValues(alpha: 0.17),
        border: Border.all(color: scheme.primary.withValues(alpha: 0.30)),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(999),
        child: Align(
          alignment: Alignment.topCenter,
          heightFactor: null,
          child: SizedBox(
            height: 1,
            width: double.infinity,
            child: ColoredBox(color: Colors.white.withValues(alpha: hi * 0.40)),
          ),
        ),
      ),
    );
  }
}

class _NavButton extends StatelessWidget {
  const _NavButton({
    super.key,
    required this.tab,
    required this.active,
    required this.compact,
    required this.pulse,
    required this.animate,
    required this.tokens,
    required this.onTapDown,
    required this.onTap,
  });

  final TabId tab;
  final bool active;
  final bool compact;
  final int pulse;
  final bool animate;
  final DesignTokens tokens;
  final VoidCallback onTapDown;
  final VoidCallback onTap;

  String _label(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return switch (tab) {
      TabId.foryou => l10n.tabForYou,
      TabId.timeline => l10n.tabTimeline,
      TabId.albums => l10n.tabAlbums,
      TabId.search => l10n.tabSearch,
    };
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final iconColor = active ? scheme.primary : scheme.onSurfaceVariant;
    final labelColor = active ? scheme.primary : scheme.onSurfaceVariant;

    return Semantics(
      button: true,
      selected: active,
      label: _label(context),
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => onTapDown(),
        onTap: onTap,
        child: AnimatedContainer(
          duration: tokens.durBase,
          curve: kEaseOut,
          constraints: BoxConstraints(minWidth: compact ? 56 : 74),
          padding: compact
              ? const EdgeInsets.fromLTRB(16, 11, 16, 11)
              : const EdgeInsets.fromLTRB(18, 8, 18, 7),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // .nav-btn.on .nav-ico → translateY(-1.5px) scale(1.1)
              AnimatedSlide(
                duration: tokens.durSheet,
                curve: kSpring,
                offset: active ? const Offset(0, -0.0714) : Offset.zero,
                child: AnimatedScale(
                  duration: tokens.durSheet,
                  curve: kSpring,
                  scale: active ? 1.1 : 1.0,
                  child: SizedBox(
                    width: 21,
                    height: 21,
                    child: TweenAnimationBuilder<Color?>(
                      tween: ColorTween(end: iconColor),
                      duration: tokens.durBase,
                      curve: kEaseOut,
                      builder: (context, maybe, _) => animate
                          ? _NavIconArt(
                              tab: tab,
                              pulse: pulse,
                              color: maybe ?? iconColor,
                              tokens: tokens,
                            )
                          : SvgIcon(_staticIconName(tab),
                              size: 21, color: maybe ?? iconColor),
                    ),
                  ),
                ),
              ),
              if (!compact) ...[
                const SizedBox(height: 2),
                AnimatedDefaultTextStyle(
                  duration: tokens.durBase,
                  curve: kEaseOut,
                  style: TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w600, // ~650
                    letterSpacing: 0.2,
                    color: labelColor,
                    height: 1.2,
                  ),
                  child: Text(_label(context)),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  static String _staticIconName(TabId tab) => switch (tab) {
        TabId.foryou => 'sparkle',
        TabId.timeline => 'clock',
        TabId.albums => 'folder',
        TabId.search => 'search',
      };
}

/* ═══════════════════════════════════════════════════════════════════════
   Animated icon art — the four unique tap animations (§17), transcribed
   from NavIcons.tsx keyframes. All motion is transform/opacity only.
   ═══════════════════════════════════════════════════════════════════════ */

class _NavIconArt extends StatefulWidget {
  const _NavIconArt({
    required this.tab,
    required this.pulse,
    required this.color,
    required this.tokens,
  });

  final TabId tab;
  final int pulse;
  final Color color;
  final DesignTokens tokens;

  /// Full keyframe timeline per icon (ms) — covers the longest delay+duration.
  static int totalMs(TabId tab) => switch (tab) {
        TabId.foryou => 950, // glint3: 330 + 620
        TabId.timeline => 720, // clock sweep
        TabId.albums => 780, // photo2: 140 + 640
        TabId.search => 760, // glint: 120 + 640
      };

  @override
  State<_NavIconArt> createState() => _NavIconArtState();
}

class _NavIconArtState extends State<_NavIconArt>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl = AnimationController(
    vsync: this,
    duration: Duration(milliseconds: _NavIconArt.totalMs(widget.tab)),
    value: 1, // resting state = final keyframes
  );

  @override
  void didUpdateWidget(_NavIconArt oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.pulse != widget.pulse) {
      if (widget.tokens.animationsEnabled) {
        _ctrl.duration = Duration(milliseconds: _NavIconArt.totalMs(widget.tab));
        _ctrl.forward(from: 0);
      }
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: const Size(21, 21),
      painter: _NavPainter(
        tab: widget.tab,
        color: widget.color,
        animation: _ctrl,
      ),
    );
  }
}

/// Piecewise-linear keyframe interpolation (CSS @keyframes stops).
double _kf(double u, List<double> ts, List<double> vs) {
  if (u <= ts.first) return vs.first;
  if (u >= ts.last) return vs.last;
  for (var i = 1; i < ts.length; i++) {
    if (u <= ts[i]) {
      final span = ts[i] - ts[i - 1];
      final local = span <= 0 ? 1 : (u - ts[i - 1]) / span;
      return vs[i - 1] + (vs[i] - vs[i - 1]) * local;
    }
  }
  return vs.last;
}

/// Eased progress of a sub-animation window [startMs, startMs+durMs] inside
/// a master timeline of [totalMs], with the CSS animation's own curve.
double _window(
  double t,
  double startMs,
  double durMs,
  double totalMs,
  Curve curve,
) {
  final a = startMs / totalMs;
  final b = (startMs + durMs) / totalMs;
  if (t <= a) return 0;
  if (t >= b) return 1;
  return curve.transform((t - a) / (b - a));
}

class _NavPainter extends CustomPainter {
  _NavPainter({required this.tab, required this.color, required this.animation})
      : super(repaint: animation);

  final TabId tab;
  final Color color;
  final Animation<double> animation;

  static const double _view = 24;

  @override
  void paint(Canvas canvas, Size size) {
    final k = size.width / _view;
    final t = animation.value;
    final total = _NavIconArt.totalMs(tab).toDouble();
    switch (tab) {
      case TabId.foryou:
        _paintSparkle(canvas, k, t, total);
      case TabId.timeline:
        _paintClock(canvas, k, t, total);
      case TabId.albums:
        _paintAlbums(canvas, k, t, total);
      case TabId.search:
        _paintSearch(canvas, k, t, total);
    }
  }

  Paint _stroke(double k, {double width = 1.8, double opacity = 1}) => Paint()
    ..style = PaintingStyle.stroke
    ..strokeWidth = width * k
    ..strokeCap = StrokeCap.round
    ..strokeJoin = StrokeJoin.round
    ..color = color.withValues(alpha: opacity.clamp(0.0, 1.0));

  Paint _fill({double opacity = 1}) =>
      Paint()..color = color.withValues(alpha: opacity.clamp(0.0, 1.0));

  /* ── For You: sparkle bloom + mini pop + three glints ── */
  void _paintSparkle(Canvas canvas, double k, double t, double total) {
    // sparkle-bloom 560ms spring, origin (12, 11)
    final bloom = _window(t, 0, 560, total, kSpring);
    final bScale = _kf(bloom, const [0, 0.55, 1], const [0.6, 1.16, 1]);
    final bRot = _kf(bloom, const [0, 0.55, 1], const [-24, 6, 0]);
    final bOp = _kf(bloom, const [0, 0.55, 1], const [0.4, 1, 1]);

    canvas.save();
    canvas.translate(12 * k, 11 * k);
    canvas.scale(bScale, bScale);
    canvas.rotate(bRot * math.pi / 180);
    canvas.translate(-12 * k, -11 * k);

    // main star
    final star = Path()
      ..moveTo(12 * k, 3 * k)
      ..lineTo(13.9 * k, 8.1 * k)
      ..lineTo(19 * k, 10 * k)
      ..lineTo(13.9 * k, 11.9 * k)
      ..lineTo(12 * k, 17 * k)
      ..lineTo(10.1 * k, 11.9 * k)
      ..lineTo(5 * k, 10 * k)
      ..lineTo(10.1 * k, 8.1 * k)
      ..close();
    canvas.drawPath(star, _stroke(k, opacity: bOp));

    // mini star — mini-pop 620ms spring, 90ms delay, origin (19.6, 17.6)
    final mini = _window(t, 90, 620, total, kSpring);
    final mScale = _kf(mini, const [0, 0.6, 1], const [0, 1.3, 1]);
    final mOp = _kf(mini, const [0, 0.6, 1], const [0, 1, 1]) * bOp;
    canvas.save();
    canvas.translate(19.6 * k, 17.6 * k);
    canvas.scale(mScale, mScale);
    canvas.translate(-19.6 * k, -17.6 * k);
    final miniStar = Path()
      ..moveTo(18.5 * k, 15.5 * k)
      ..lineTo(19.3 * k, 17.7 * k)
      ..lineTo(21.5 * k, 18.5 * k)
      ..lineTo(19.3 * k, 19.3 * k)
      ..lineTo(18.5 * k, 21.5 * k)
      ..lineTo(17.7 * k, 19.3 * k)
      ..lineTo(15.5 * k, 18.5 * k)
      ..lineTo(17.7 * k, 17.7 * k)
      ..close();
    canvas.drawPath(miniStar, _stroke(k, opacity: mOp));
    canvas.restore();

    // glints — glint-pop 620ms ease-out, delays 140/240/330
    const glints = [(6.5, 5.0, 0.9, 140.0), (19.5, 6.5, 0.7, 240.0), (5.0, 15.5, 0.6, 330.0)];
    for (final (gx, gy, gr, delay) in glints) {
      final g = _window(t, delay, 620, total, Curves.easeOut);
      final gOp = _kf(g, const [0, 0.45, 1], const [0, 1, 0]);
      final gScale = _kf(g, const [0, 0.45, 1], const [0, 1.5, 0.4]);
      if (gOp <= 0.01) continue;
      canvas.drawCircle(
        Offset(gx * k, gy * k),
        gr * gScale * k,
        _fill(opacity: gOp * bOp),
      );
    }
    canvas.restore();
  }

  /* ── Timeline: clock-hand sweep ── */
  void _paintClock(Canvas canvas, double k, double t, double total) {
    canvas.drawCircle(Offset(12 * k, 12 * k), 8.5 * k, _stroke(k));
    // clock-sweep 720ms cubic-bezier(0.22,1.3,0.36,1), origin (12,12)
    final sweep = _window(t, 0, 720, total, kClockSweep);
    final rot = _kf(sweep, const [0, 1], const [0, 360]);
    canvas.save();
    canvas.translate(12 * k, 12 * k);
    canvas.rotate(rot * math.pi / 180);
    canvas.translate(-12 * k, -12 * k);
    final hands = Path()
      ..moveTo(12 * k, 7.5 * k)
      ..lineTo(12 * k, 12 * k)
      ..lineTo(15 * k, 14 * k);
    canvas.drawPath(hands, _stroke(k));
    canvas.restore();
  }

  /* ── Albums: folder breathe + two photo cards popping out ── */
  void _paintAlbums(Canvas canvas, double k, double t, double total) {
    // photo-pop 640ms spring; p1 delay 60 origin (11,8); p2 delay 140 origin (14,8)
    void photo(double delay, double ox, double oy, double opacity, Rect r, double radius) {
      final p = _window(t, delay, 640, total, kSpring);
      final ty = _kf(p, const [0, 0.55, 1], const [7, -3, 0]);
      final s = _kf(p, const [0, 0.55, 1], const [0.6, 1.06, 1]);
      final op = _kf(p, const [0, 0.55, 1], const [0, 1, 1]) * opacity;
      canvas.save();
      canvas.translate(ox * k, oy * k);
      canvas.translate(0, ty * k);
      canvas.scale(s, s);
      canvas.translate(-ox * k, -oy * k);
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(r.left * k, r.top * k, r.width * k, r.height * k),
          Radius.circular(radius * k),
        ),
        _fill(opacity: op),
      );
      canvas.restore();
    }

    photo(60, 11, 8, 0.9, const Rect.fromLTWH(8.6, 4.2, 6.4, 5.2), 0.9);
    photo(140, 14, 8, 0.55, const Rect.fromLTWH(11.2, 5, 5.6, 4.6), 0.9);

    // folder-breathe 560ms spring, origin (12,19)
    final f = _window(t, 0, 560, total, kSpring);
    final sy = _kf(f, const [0, 0.38, 1], const [1, 0.86, 1]);
    final sx = _kf(f, const [0, 0.38, 1], const [1, 1.04, 1]);
    canvas.save();
    canvas.translate(12 * k, 19 * k);
    canvas.scale(sx, sy);
    canvas.translate(-12 * k, -19 * k);
    final folder = Path()
      ..moveTo(3.5 * k, 6.5 * k)
      ..arcToPoint(Offset(5.5 * k, 4.5 * k),
          radius: Radius.circular(2 * k), clockwise: true)
      ..lineTo(9.5 * k, 4.5 * k)
      ..lineTo(11.5 * k, 7 * k)
      ..lineTo(18.5 * k, 7 * k)
      ..arcToPoint(Offset(20.5 * k, 9 * k),
          radius: Radius.circular(2 * k), clockwise: true)
      ..lineTo(20.5 * k, 17.5 * k)
      ..arcToPoint(Offset(18.5 * k, 19.5 * k),
          radius: Radius.circular(2 * k), clockwise: true)
      ..lineTo(5.5 * k, 19.5 * k)
      ..arcToPoint(Offset(3.5 * k, 17.5 * k),
          radius: Radius.circular(2 * k), clockwise: true)
      ..close();
    canvas.drawPath(folder, _stroke(k));
    canvas.restore();
  }

  /* ── Search: lens swell + glass glint + handle sway ── */
  void _paintSearch(Canvas canvas, double k, double t, double total) {
    // lens-swell 560ms spring, origin (10.5,10.5)
    final swell = _window(t, 0, 560, total, kSpring);
    final s = _kf(swell, const [0, 0.45, 1], const [1, 1.18, 1]);
    canvas.save();
    canvas.translate(10.5 * k, 10.5 * k);
    canvas.scale(s, s);
    canvas.translate(-10.5 * k, -10.5 * k);
    canvas.drawCircle(Offset(10.5 * k, 10.5 * k), 6.5 * k, _stroke(k));
    // lens-glint 640ms ease-out, 120ms delay — arc M7.4 8.2 a4.2…
    final g = _window(t, 120, 640, total, Curves.easeOut);
    final gOp = _kf(g, const [0, 0.4, 1], const [0, 1, 0]);
    if (gOp > 0.01) {
      final glint = Path()
        ..moveTo(7.4 * k, 8.2 * k)
        ..arcToPoint(Offset(10 * k, 6.6 * k),
            radius: Radius.circular(4.2 * k), clockwise: true);
      canvas.drawPath(glint, _stroke(k, width: 1.4, opacity: gOp));
    }
    canvas.restore();

    // handle-sway 640ms ease-in-out, origin (15.5,15.5)
    final sway = _window(t, 0, 640, total, Curves.easeInOut);
    final rot = _kf(sway, const [0, 0.4, 0.75, 1], const [0, 12, -4, 0]);
    canvas.save();
    canvas.translate(15.5 * k, 15.5 * k);
    canvas.rotate(rot * math.pi / 180);
    canvas.translate(-15.5 * k, -15.5 * k);
    final handle = Path()
      ..moveTo(15.5 * k, 15.5 * k)
      ..lineTo(21 * k, 21 * k);
    canvas.drawPath(handle, _stroke(k));
    canvas.restore();
  }

  @override
  bool shouldRepaint(_NavPainter oldDelegate) =>
      oldDelegate.color != color || oldDelegate.tab != tab;
}
