import 'package:flutter/material.dart';
import 'package:flutter/physics.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../haptics.dart';
import '../theme/glass_theme.dart';

/// Press-scale wrapper with spring physics (§1/§5). Everything tappable in
/// the app goes through this: scale 0.96 on press-down, spring-back on
/// release, selection haptic. Replaces Material's rectangular ink for the
/// glass aesthetic while InkWell users keep [GlassSurface.onTap].
class Pressable extends ConsumerStatefulWidget {
  const Pressable({
    super.key,
    required this.child,
    this.onTap,
    this.onLongPress,
    this.scale = 0.965,
    this.spring = GlassTokens.springSnappy,
    this.haptic = true,
  });

  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final double scale;
  final SpringDescription spring;
  final bool haptic;

  @override
  ConsumerState<Pressable> createState() => _PressableState();
}

class _PressableState extends ConsumerState<Pressable>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController.unbounded(
    vsync: this,
    value: 1,
  );

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _to(double value) {
    _controller.animateWith(
      SpringSimulation(widget.spring, _controller.value, value, _controller.velocity),
    );
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) {
        _to(widget.scale);
        if (widget.haptic) Haptics.tap(ref);
      },
      onTapCancel: () => _to(1),
      onTapUp: (_) {
        _to(1);
        widget.onTap?.call();
      },
      onLongPress: widget.onLongPress,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, child) =>
            Transform.scale(scale: _controller.value, child: child),
        child: widget.child,
      ),
    );
  }
}
