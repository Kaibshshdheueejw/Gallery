import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image/image.dart' as img;

/// ─────────────────────────────────────────────────────────────────────────
/// Material You dynamic tinting (§1): extract the dominant colour from the
/// currently viewed photo/video frame and feed it as the glass/theme seed.
///
/// Implementation: decode a tiny (16×16) version of the bytes on the calling
/// isolate — at that size decode is ~1 ms, safe during a hero transition.
/// Callers pass thumbnail bytes (already in memory from the grid cache), so
/// this never triggers extra I/O. Quantisation is a coarse 4-bit-per-channel
/// histogram; saturation/value filters keep greys from winning.
/// ─────────────────────────────────────────────────────────────────────────
abstract final class DynamicTint {
  static Color? dominantFromBytes(Uint8List bytes) {
    try {
      final decoded = img.decodeImage(bytes);
      if (decoded == null) return null;
      final small = img.copyResize(decoded, width: 16, height: 16);
      return dominantFromImage(small);
    } catch (_) {
      return null; // Unsupported/corrupt bytes → caller keeps current seed.
    }
  }

  static Color? dominantFromImage(img.Image image) {
    final counts = <int, int>{};
    for (final p in image) {
      final r = p.r.toInt(), g = p.g.toInt(), b = p.b.toInt();
      final hsv = HSVColor.fromColor(Color.fromARGB(255, r, g, b));
      // Skip near-black/white/transparent-ish pixels; they are rarely the
      // "mood" colour of a photo.
      if (hsv.value < 0.12 || hsv.saturation < 0.10) continue;
      // 4-bit-per-channel bucket.
      final key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    if (counts.isEmpty) return null;
    final winner = counts.entries.reduce((a, b) => a.value >= b.value ? a : b).key;
    final r = ((winner >> 8) & 0xF) * 17;
    final g = ((winner >> 4) & 0xF) * 17;
    final b = (winner & 0xF) * 17;
    // Lift saturation slightly so the tint reads on glass panels.
    final hsv = HSVColor.fromColor(Color.fromARGB(255, r, g, b));
    return hsv.withSaturation((hsv.saturation * 1.25).clamp(0.35, 0.9)).toColor();
  }
}
