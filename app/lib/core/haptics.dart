import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'settings/app_settings.dart';

/// Central haptics helper (§1/§13). Every call is a no-op when the user has
/// disabled haptic feedback in Settings.
abstract final class Haptics {
  static void tap(WidgetRef ref) {
    if (!_on(ref)) return;
    HapticFeedback.selectionClick();
  }

  static void light(WidgetRef ref) {
    if (!_on(ref)) return;
    HapticFeedback.lightImpact();
  }

  static void medium(WidgetRef ref) {
    if (!_on(ref)) return;
    HapticFeedback.mediumImpact();
  }

  /// For destructive confirmations (empty trash, delete).
  static void heavy(WidgetRef ref) {
    if (!_on(ref)) return;
    HapticFeedback.heavyImpact();
  }

  static bool _on(WidgetRef ref) => ref.read(settingsProvider).hapticsEnabled;
}
