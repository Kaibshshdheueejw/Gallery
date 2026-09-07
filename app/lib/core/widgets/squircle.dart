import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/material.dart';

/// ─────────────────────────────────────────────────────────────────────────
/// Continuous-corner ("squircle") shape (§1 — not simple borderRadius).
///
/// Draws a superellipse  |x/a|^n + |y/b|^n = 1  with n ≈ 5, which matches the
/// iOS-style continuous curvature that Flutter's RoundedRectangleBorder only
/// approximates with circular arcs. Used for cards, sheets, buttons and the
/// navigation capsule.
/// ─────────────────────────────────────────────────────────────────────────
class SquircleBorder extends ShapeBorder {
  const SquircleBorder({required this.radius, this.side = BorderSide.none});

  final double radius;
  final BorderSide side;

  /// Superellipse exponent. 2 == circle, 4 == squircle (Apple-ish), higher
  /// approaches a rounded rect. 5 is the sweet spot for card radii ≤ 32.
  static const double _n = 5.0;

  @override
  EdgeInsetsGeometry get dimensions => EdgeInsets.all(side.width);

  @override
  ShapeBorder scale(double t) => SquircleBorder(radius: radius * t, side: side.scale(t));

  @override
  Path getInnerPath(Rect rect, {TextDirection? textDirection}) =>
      getOuterPath(rect.deflate(side.width), textDirection: textDirection);

  @override
  Path getOuterPath(Rect rect, {TextDirection? textDirection}) =>
      squirclePath(rect, math.min(radius, rect.shortestSide / 2));

  @override
  void paint(Canvas canvas, Rect rect, {TextDirection? textDirection}) {
    if (side.style == BorderSide.none || side.width == 0) return;
    final paint = Paint()
      ..color = side.color
      ..style = PaintingStyle.stroke
      ..strokeWidth = side.width;
    canvas.drawPath(getOuterPath(rect.deflate(side.width / 2)), paint);
  }

  @override
  bool operator ==(Object other) =>
      other is SquircleBorder && other.radius == radius && other.side == side;

  @override
  int get hashCode => Object.hash(radius, side);

  /// Builds the superellipse path for [rect] with corner radius [r].
  /// The path is composed of 4 corner arcs + straight edges, where each corner
  /// arc samples the superellipse so curvature is continuous at tangency.
  static Path squirclePath(Rect rect, double r) {
    final path = Path();
    if (r <= 0) {
      path.addRect(rect);
      return path;
    }
    const samples = 12; // per corner — cheap, smooth at these radii
    final n = _n;

    void corner(double cx, double cy, double startAngle) {
      for (var i = 0; i <= samples; i++) {
        final t = startAngle + (math.pi / 2) * (i / samples);
        // Superellipse in polar-ish form: point on |x|^n+|y|^n = r^n
        final c = math.cos(t);
        final s = math.sin(t);
        final x = cx + r * _signedPow(c.abs(), 2 / n) * (c.isNegative ? -1 : 1);
        final y = cy + r * _signedPow(s.abs(), 2 / n) * (s.isNegative ? -1 : 1);
        path.lineTo(x, y);
      }
    }

    // Walk clockwise from top-left tangency point.
    path.moveTo(rect.left + r, rect.top);
    path.lineTo(rect.right - r, rect.top);
    corner(rect.right - r, rect.top + r, -math.pi / 2);
    path.lineTo(rect.right, rect.bottom - r);
    corner(rect.right - r, rect.bottom - r, 0);
    path.lineTo(rect.left + r, rect.bottom);
    corner(rect.left + r, rect.bottom - r, math.pi / 2);
    path.lineTo(rect.left, rect.top + r);
    corner(rect.left + r, rect.top + r, math.pi);
    path.close();
    return path;
  }

  static double _signedPow(double base, double exp) => math.pow(base, exp).toDouble();
}

/// Filled squircle clip for arbitrary children (thumbnails, hero images).
class SquircleClip extends StatelessWidget {
  const SquircleClip({super.key, required this.radius, required this.child});

  final double radius;
  final Widget child;

  @override
  Widget build(BuildContext context) => ClipPath(
        clipper: _SquircleClipper(radius),
        clipBehavior: Clip.antiAlias,
        child: child,
      );
}

class _SquircleClipper extends CustomClipper<Path> {
  const _SquircleClipper(this.radius);
  final double radius;

  @override
  Path getClip(Size size) =>
      SquircleBorder.squirclePath(Offset.zero & size, radius);

  @override
  bool shouldReclip(_SquircleClipper oldClipper) => oldClipper.radius != radius;
}
