import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../haptics.dart';
import '../theme/glass_theme.dart';
import 'glass_surface.dart';

/// One entry in a [showGlassPopupMenu]. Mirrors the web GlassPopupMenu item
/// model: icon + label, optional trailing check (radio-style choices),
/// optional hint caption, disabled and destructive (danger) variants.
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

  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final bool checked;
  final bool disabled;
  final String? hint;
  final bool danger;
}

/// Shows the anchored glass popup menu below (or above, when there is no
/// room) [anchorRect] — the screen-coordinate rect of the trigger widget.
///
/// Animation matches the web menu: scale 0.92 → 1 with a slight upward
/// slide and fade, ~180 ms ease-out; barrier tap dismisses. Rendered in a
/// transparent [PopupRoute] so the system back gesture closes it.
Future<void> showGlassPopupMenu(
  BuildContext context, {
  required Rect anchorRect,
  required List<GlassPopupItem> items,
}) {
  return Navigator.of(context, rootNavigator: true).push(
    _GlassPopupRoute(anchorRect: anchorRect, items: items),
  );
}

class _GlassPopupRoute extends PopupRoute<void> {
  _GlassPopupRoute({required this.anchorRect, required this.items});

  final Rect anchorRect;
  final List<GlassPopupItem> items;

  @override
  Color? get barrierColor => Colors.black.withValues(alpha: 0.12);

  @override
  bool get barrierDismissible => true;

  // null → platform default semantics; keeps §11 (no hardcoded strings).
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
    return _GlassPopup(anchorRect: anchorRect, items: items);
  }

  @override
  Widget buildTransitions(
    BuildContext context,
    Animation<double> animation,
    Alignment? alignment,
    Widget child,
  ) =>
      child;
}

class _GlassPopup extends StatefulWidget {
  const _GlassPopup({required this.anchorRect, required this.items});

  final Rect anchorRect;
  final List<GlassPopupItem> items;

  @override
  State<_GlassPopup> createState() => _GlassPopupState();
}

class _GlassPopupState extends State<_GlassPopup> {
  static const double _width = 236;
  static const double _rowHeight = 46;

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
    final screen = MediaQuery.sizeOf(context);
    final padding = MediaQuery.viewInsetsOf(context);
    final estimatedHeight =
        widget.items.length * _rowHeight + 24; // rows + vertical padding

    // Right-align under the trigger; flip above it when there is no room.
    var top = widget.anchorRect.bottom + 8;
    if (top + estimatedHeight > screen.height - padding.bottom - 8) {
      top = widget.anchorRect.top - 8 - estimatedHeight;
    }
    top = top.clamp(8.0, screen.height - estimatedHeight - 8);
    final right = (screen.width - widget.anchorRect.right).clamp(8.0, 1e6);

    return Stack(
      children: [
        Positioned(
          top: top,
          right: right,
          width: _width,
          child: AnimatedScale(
            scale: _shown ? 1 : 0.92,
            alignment: Alignment.topRight,
            duration: const Duration(milliseconds: 180),
            curve: Curves.easeOutCubic,
            child: AnimatedOpacity(
              opacity: _shown ? 1 : 0,
              duration: const Duration(milliseconds: 180),
              curve: Curves.easeOut,
              child: AnimatedSlide(
                offset: _shown ? Offset.zero : const Offset(0, -0.04),
                duration: const Duration(milliseconds: 180),
                curve: Curves.easeOutCubic,
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    maxHeight: (screen.height - 32)
                        .clamp(120.0, screen.height - 32),
                  ),
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: GlassSurface(
                      radius: GlassTokens.radiusMd,
                      blur: GlassTokens.blurStrong,
                      specular: false,
                      parallax: false,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          for (final item in widget.items)
                            _MenuRow(item: item),
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

class _MenuRow extends ConsumerWidget {
  const _MenuRow({required this.item});

  final GlassPopupItem item;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    final baseColor = item.danger
        ? scheme.error
        : item.disabled
            ? scheme.onSurface.withValues(alpha: 0.38)
            : scheme.onSurface;

    return Semantics(
      button: true,
      enabled: !item.disabled,
      child: InkWell(
        onTap: item.disabled || item.onTap == null
            ? null
            : () {
                Haptics.light(ref);
                final action = item.onTap!;
                Navigator.of(context).pop();
                action();
              },
        child: SizedBox(
          height: 46,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: Row(
              children: [
                Icon(item.icon, size: 18, color: baseColor),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight:
                              item.checked ? FontWeight.w700 : FontWeight.w500,
                          color: baseColor,
                        ),
                      ),
                      if (item.hint != null)
                        Text(
                          item.hint!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 10.5,
                            color: baseColor.withValues(alpha: 0.6),
                          ),
                        ),
                    ],
                  ),
                ),
                if (item.checked)
                  Padding(
                    padding: const EdgeInsets.only(left: 8),
                    child: Icon(Icons.check_rounded,
                        size: 17, color: scheme.primary),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
