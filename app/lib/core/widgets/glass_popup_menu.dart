import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../design/tokens.dart';
import '../haptics.dart';
import '../settings/app_settings.dart';
import 'glass_material.dart';
import 'svg_icon.dart';

/// One entry in a [showGlassPopupMenu] — mirrors the preview's
/// PopupMenuItem model: svg icon name + label, optional trailing check
/// (radio-style choices), optional hint caption, disabled and danger.
class GlassPopupItem {
  const GlassPopupItem({
    required this.icon,
    required this.label,
    this.onTap,
    this.checked = false,
    this.disabled = false,
    this.hint,
    this.danger = false,
  });

  /// Icon name from the generated preview icon set (assets/icons).
  final String icon;
  final String label;
  final VoidCallback? onTap;
  final bool checked;
  final bool disabled;
  final String? hint;
  final bool danger;
}

/// Shows the Liquid Glass popup menu anchored to [anchorRect] (the
/// trigger's screen-coordinate rect). Exact port of the preview's
/// GlassPopupMenu.tsx + .glass-popup CSS:
///   • scrim rgba(8,6,18,0.28) with a 2px backdrop blur, 140ms fade-in
///   • panel: glass-strong, min-width 230, max-width min(320, vw-24),
///     radius 20, padding 7, rows gap 2, max-height min(70vh, 520)
///   • popup-in: scale 0.82→1 + translateY(-8→0) + fade, hero duration,
///     spring curve, transform-origin top right
///   • positioned right-aligned under the trigger, flipped above when it
///     would overflow (est = items*48 + 30, matching the preview)
///   • outside tap / back gesture dismiss (transparent PopupRoute)
Future<void> showGlassPopupMenu(
  BuildContext context, {
  required Rect anchorRect,
  required List<GlassPopupItem> items,
  String? title,
}) {
  return Navigator.of(context, rootNavigator: true).push(
    _GlassPopupRoute(anchorRect: anchorRect, items: items, title: title),
  );
}

class _GlassPopupRoute extends PopupRoute<void> {
  _GlassPopupRoute({
    required this.anchorRect,
    required this.items,
    this.title,
  });

  final Rect anchorRect;
  final List<GlassPopupItem> items;
  final String? title;

  // The page paints its own blurred scrim (the preview dims with
  // rgba(8,6,18,0.28) + 2px blur); the route barrier stays transparent.
  @override
  Color? get barrierColor => null;

  @override
  bool get barrierDismissible => true;

  @override
  String? get barrierLabel => null;

  @override
  Duration get transitionDuration => const Duration(milliseconds: 1);

  @override
  Widget buildPage(
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
  ) {
    return _GlassPopup(anchorRect: anchorRect, items: items, title: title);
  }
}

class _GlassPopup extends ConsumerStatefulWidget {
  const _GlassPopup({
    required this.anchorRect,
    required this.items,
    this.title,
  });

  final Rect anchorRect;
  final List<GlassPopupItem> items;
  final String? title;

  @override
  ConsumerState<_GlassPopup> createState() => _GlassPopupState();
}

class _GlassPopupState extends ConsumerState<_GlassPopup> {
  bool _shown = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) setState(() => _shown = true);
    });
  }

  @override
  Widget build(BuildContext context) {
    final settings = ref.watch(settingsProvider);
    final tokens = DesignTokens.from(settings);
    final screen = MediaQuery.sizeOf(context);

    // Preview positioning maths (GlassPopupMenu.tsx useLayoutEffect).
    const estRow = 48.0;
    final est = widget.items.length * estRow + 30;
    final right = math.max(10.0, screen.width - widget.anchorRect.right);
    var top = widget.anchorRect.bottom + 10;
    if (top + est > screen.height - 12) {
      top = math.max(12.0, widget.anchorRect.top - est - 10);
    }
    final maxPanelWidth = math.min(320.0, screen.width - 24);
    final maxPanelHeight = math.min(0.70 * screen.height, 520.0);

    return Stack(
      children: [
        // popup-scrim
        Positioned.fill(
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => Navigator.of(context).pop(),
            child: AnimatedOpacity(
              opacity: _shown ? 1 : 0,
              duration: const Duration(milliseconds: 140),
              curve: Curves.easeOut,
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 2, sigmaY: 2),
                child: const ColoredBox(color: Color(0x47080612)),
              ),
            ),
          ),
        ),
        // glass-popup
        Positioned(
          top: top,
          right: right,
          child: ConstrainedBox(
            constraints: BoxConstraints(
              minWidth: math.min(230.0, maxPanelWidth),
              maxWidth: maxPanelWidth,
              maxHeight: maxPanelHeight,
            ),
            // popup-in: scale(0.82→1) + translateY(-8px→0) + fade,
            // hero duration, spring curve, origin top-right.
            child: GestureDetector(
              // absorb panel-background taps (web only closes when the
              // scrim itself is the event target)
              behavior: HitTestBehavior.opaque,
              onTapDown: (_) {},
              child: TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: _shown ? 1 : 0),
              duration: tokens.durHero,
              curve: kSpring,
              builder: (context, v, child) => Opacity(
                opacity: v.clamp(0.0, 1.0),
                child: Transform.translate(
                  offset: Offset(0, -8 * (1 - v)),
                  child: Transform.scale(
                    scale: 0.82 + 0.18 * v,
                    alignment: Alignment.topRight,
                    child: child,
                  ),
                ),
              ),
              child: SingleChildScrollView(
                    padding: EdgeInsets.zero,
                    // width: max-content, clamped by min/max constraints
                    child: IntrinsicWidth(
                      child: Glass(
                        variant: GlassVariant.strong,
                        radius: 20,
                        padding: const EdgeInsets.all(7),
                        child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          if (widget.title != null) ...[
                            Padding(
                              padding: const EdgeInsets.fromLTRB(10, 6, 10, 4),
                              child: Text(
                                widget.title!.toUpperCase(),
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 0.66,
                                  color: Theme.of(context)
                                      .colorScheme
                                      .onSurfaceVariant,
                                ),
                              ),
                            ),
                            const _PopupGap(),
                          ],
                          for (var i = 0; i < widget.items.length; i++) ...[
                            if (i > 0) const _PopupGap(),
                            _PopupRow(item: widget.items[i]),
                          ],
                        ],
                        ),
                      ),
                    ),
                  ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// .glass-popup flex gap: 2px
class _PopupGap extends StatelessWidget {
  const _PopupGap();

  @override
  Widget build(BuildContext context) => const SizedBox(height: 2);
}

class _PopupRow extends ConsumerStatefulWidget {
  const _PopupRow({required this.item});

  final GlassPopupItem item;

  @override
  ConsumerState<_PopupRow> createState() => _PopupRowState();
}

class _PopupRowState extends ConsumerState<_PopupRow> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    final scheme = Theme.of(context).colorScheme;
    final tokens = DesignTokens.from(ref.watch(settingsProvider));
    final accent = item.danger ? scheme.error : scheme.primary;

    return Semantics(
      button: true,
      enabled: !item.disabled,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: item.disabled
            ? null
            : (_) {
                // web: haptic('tap') fires on pointer-down
                Haptics.tap(ref);
                setState(() => _pressed = true);
              },
        onTapCancel: () => setState(() => _pressed = false),
        onTap: item.disabled
            ? null
            : () {
                setState(() => _pressed = false);
                final action = item.onTap;
                Navigator.of(context).pop();
                // Defer so the menu closes before heavy navigation renders
                // (preview: setTimeout(…, 0)).
                if (action != null) {
                  WidgetsBinding.instance.addPostFrameCallback((_) => action());
                }
              },
        child: AnimatedScale(
          scale: _pressed ? 0.97 : 1,
          duration: tokens.durTap,
          curve: kSpring,
          child: Opacity(
            opacity: item.disabled ? 0.4 : 1,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 10),
              child: Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(10),
                      color: accent.withValues(
                        alpha: item.danger ? 0.13 : 0.14,
                      ),
                    ),
                    child: Center(
                      child: SvgIcon(item.icon, size: 18, color: accent),
                    ),
                  ),
                  const SizedBox(width: 11),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          item.label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w600,
                            color: item.danger ? scheme.error : scheme.onSurface,
                          ),
                        ),
                        if (item.hint != null)
                          Text(
                            item.hint!,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w500,
                              color: scheme.onSurfaceVariant,
                            ),
                          ),
                      ],
                    ),
                  ),
                  if (item.checked) ...[
                    const SizedBox(width: 11),
                    SvgIcon('check', size: 16, color: scheme.primary),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
