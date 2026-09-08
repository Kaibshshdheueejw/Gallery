import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// SvgIcon — renders one of the preview's hand-drawn 24px stroke icons.
///
/// The SVG assets in `assets/icons/` were generated verbatim from the
/// sandbox preview's icon table (`web/src/core/icons.tsx`), so shapes are
/// pixel-identical. `<name>.svg` is the stroke variant (fill none, stroke
/// 1.8, round caps/joins); `<name>_f.svg` is the filled variant (the
/// preview's `filled` prop: fill + 0.6 stroke). Colour is applied with a
/// srcIn ColorFilter, mirroring SVG `currentColor`.
class SvgIcon extends StatelessWidget {
  const SvgIcon(
    this.name, {
    super.key,
    this.size = 22,
    this.color,
    this.filled = false,
  });

  final String name;
  final double size;
  final Color? color;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    final effective = color ??
        IconTheme.of(context).color ??
        Theme.of(context).colorScheme.onSurface;
    return SvgPicture.asset(
      'assets/icons/${filled ? '${name}_f' : name}.svg',
      width: size,
      height: size,
      colorFilter: ColorFilter.mode(effective, BlendMode.srcIn),
      excludeFromSemantics: true,
    );
  }
}
