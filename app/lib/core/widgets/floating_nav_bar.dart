import 'package:flutter/material.dart';
import 'package:flutter/physics.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../haptics.dart';
import '../theme/glass_theme.dart';
import 'glass_surface.dart';

/// ─────────────────────────────────────────────────────────────────────────
/// FloatingNavigation — the detached glass capsule bottom nav (§3).
///
/// The active highlight is ONE pill that spring-morphs between items
/// (measured item rects + SpringSimulation on left/width — never a hard
/// cut, §4). Icons/labels animate with a subtle lift + scale + opacity.
/// ─────────────────────────────────────────────────────────────────────────
class FloatingNavItem {
  const FloatingNavItem({
    required this.icon,
    required this.activeIcon,
    required this.labelBuilder,
  });

  final IconData icon;
  final IconData activeIcon;

  /// Label comes from localization at build time (never hardcoded, §11).
  final String Function(BuildContext context) labelBuilder;
}

class FloatingNavBar extends ConsumerStatefulWidget {
  const FloatingNavBar({
    super.key,
    required this.items,
    required this.currentIndex,
    required this.onSelected,
  });

  final List<FloatingNavItem> items;
  final int currentIndex;
  final ValueChanged<int> onSelected;

  @override
  ConsumerState<FloatingNavBar> createState() => _FloatingNavBarState();
}

class _FloatingNavBarState extends ConsumerState<FloatingNavBar>
    with TickerProviderStateMixin {
  final List<GlobalKey> _itemKeys = [];

  /// Morphing pill: one unbounded spring controller drives t∈[0,1] between
  /// the previous and current item rects.
  late final AnimationController _morph =
      AnimationController.unbounded(vsync: this, value: 1);
  Rect _from = Rect.zero;
  Rect _to = Rect.zero;
  int _previousIndex = 0;

  @override
  void initState() {
    super.initState();
    _itemKeys.addAll(List.generate(widget.items.length, (_) => GlobalKey()));
    WidgetsBinding.instance.addPostFrameCallback((_) => _snapToCurrent(animate: false));
  }

  @override
  void didUpdateWidget(covariant FloatingNavBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.currentIndex != widget.currentIndex) {
      _previousIndex = oldWidget.currentIndex;
      _snapToCurrent(animate: true);
    }
  }

  @override
  void dispose() {
    _morph.dispose();
    super.dispose();
  }

  Rect? _rectOf(int index) {
    final ctx = _itemKeys[index].currentContext;
    if (ctx == null) return null;
    final box = ctx.findRenderObject() as RenderBox?;
    final navBox = context.findRenderObject() as RenderBox?;
    if (box == null || navBox == null) return null;
    final local = box.localToGlobal(Offset.zero, ancestor: navBox);
    return local & box.size;
  }

  void _snapToCurrent({required bool animate}) {
    final target = _rectOf(widget.currentIndex);
    if (target == null) return;
    if (!animate) {
      _from = target;
      _to = target;
      _morph.value = 1;
      setState(() {});
      return;
    }
    setState(() {
      _from = _rectOf(_previousIndex) ?? target;
      _to = target;
    });
    _morph.animateWith(
      SpringSimulation(GlassTokens.springMorph, _morph.value == 1 ? 0 : _morph.value, 1, 0),
    );
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        GlassTokens.navSideMargin,
        0,
        GlassTokens.navSideMargin,
        GlassTokens.navBottomMargin,
      ),
      child: GlassSurface.pill(
        child: SizedBox(
          height: GlassTokens.navHeight,
          child: AnimatedBuilder(
            animation: _morph,
            builder: (context, row) {
              final t = _morph.value.clamp(0.0, 1.0);
              final pill = Rect.lerp(_from, _to, t) ?? _to;
              return Stack(
                children: [
                  if (pill != Rect.zero)
                    Positioned.fromRect(
                      rect: pill.deflate(5),
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          color: scheme.primary.withValues(alpha: 0.18),
                          borderRadius:
                              BorderRadius.circular(GlassTokens.radiusPill),
                          border: Border.all(
                            color: scheme.primary.withValues(alpha: 0.22),
                          ),
                        ),
                      ),
                    ),
                  row!,
                ],
              );
            },
            child: Row(
              children: [
                for (var i = 0; i < widget.items.length; i++)
                  Expanded(
                    child: _NavItem(
                      key: _itemKeys[i],
                      item: widget.items[i],
                      active: i == widget.currentIndex,
                      onTap: () {
                        if (i == widget.currentIndex) return;
                        Haptics.light(ref);
                        widget.onSelected(i);
                      },
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({super.key, required this.item, required this.active, required this.onTap});

  final FloatingNavItem item;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final label = item.labelBuilder(context);
    return Semantics(
      button: true,
      selected: active,
      label: label,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: AnimatedContainer(
          duration: GlassTokens.durationFast,
          curve: Curves.easeOutCubic,
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              AnimatedScale(
                scale: active ? 1.08 : 1.0,
                duration: GlassTokens.durationFast,
                curve: Curves.easeOutBack,
                child: Icon(
                  active ? item.activeIcon : item.icon,
                  size: 22,
                  color: active ? scheme.primary : scheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 3),
              AnimatedDefaultTextStyle(
                duration: GlassTokens.durationFast,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: active ? FontWeight.w600 : FontWeight.w500,
                  color: active ? scheme.primary : scheme.onSurfaceVariant,
                ),
                child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
