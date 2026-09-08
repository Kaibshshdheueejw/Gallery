import 'dart:async';
import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../design/tokens.dart';
import '../settings/app_settings.dart';

/// Toast model — mirrors the preview store's Toast: a message plus an
/// optional action button. Auto-dismiss: 3.2s plain, 6s with action.
class Toast {
  const Toast({
    required this.id,
    required this.message,
    this.actionLabel,
    this.onAction,
  });

  final int id;
  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;
}

class ToastController extends Notifier<List<Toast>> {
  final Map<int, Timer> _timers = {};
  int _seq = 0;

  @override
  List<Toast> build() {
    ref.onDispose(() {
      for (final t in _timers.values) {
        t.cancel();
      }
    });
    return const [];
  }

  void show(String message, {String? actionLabel, VoidCallback? onAction}) {
    final id = ++_seq;
    state = [...state, Toast(id: id, message: message, actionLabel: actionLabel, onAction: onAction)];
    _timers[id] = Timer(
      Duration(milliseconds: actionLabel != null ? 6000 : 3200),
      () => dismiss(id),
    );
  }

  void dismiss(int id) {
    _timers.remove(id)?.cancel();
    state = [for (final t in state) if (t.id != id) t];
  }
}

final toastControllerProvider =
    NotifierProvider<ToastController, List<Toast>>(ToastController.new);

/// ToastHost — the preview's `.toast-host`: fixed above the floating nav
/// (bottom 112 + safe area), centered column, gap 8, taps pass through
/// everywhere except the toast pills themselves.
class ToastHost extends ConsumerWidget {
  const ToastHost({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final toasts = ref.watch(toastControllerProvider);
    if (toasts.isEmpty) return const SizedBox.shrink();
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    return Positioned(
      left: 0,
      right: 0,
      bottom: 112 + bottomInset,
      // No IgnorePointer: the Column's empty area doesn't absorb hits in
      // Flutter, while the toast pills themselves stay tappable (web:
      // host pointer-events none, .toast auto).
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          for (final t in toasts) ...[
            _ToastCard(toast: t),
            if (t != toasts.last) const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }
}

class _ToastCard extends ConsumerStatefulWidget {
  const _ToastCard({required this.toast});

  final Toast toast;

  @override
  ConsumerState<_ToastCard> createState() => _ToastCardState();
}

class _ToastCardState extends ConsumerState<_ToastCard> {
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
    final scheme = Theme.of(context).colorScheme;
    final screenW = MediaQuery.sizeOf(context).width;
    final useBlur = !settings.reduceTransparency;

    final pill = DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        color: scheme.inverseSurface.withValues(alpha: useBlur ? 0.82 : 0.96),
        border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.4),
            blurRadius: 40,
            offset: const Offset(0, 14),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 13),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Flexible(
              child: Text(
                widget.toast.message,
                style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w500, // ~550
                  color: scheme.inverseOnSurface,
                ),
              ),
            ),
            if (widget.toast.onAction != null) ...[
              const SizedBox(width: 14),
              GestureDetector(
                onTap: () {
                  widget.toast.onAction!();
                  ref.read(toastControllerProvider.notifier).dismiss(widget.toast.id);
                },
                child: Text(
                  widget.toast.actionLabel ?? '',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700, // ~750
                    color: Color.lerp(scheme.primary, Colors.white, 0.4)!,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );

    // bar-rise2: translateY(20px) scale(0.94) opacity 0 → rest, spring.
    return GestureDetector(
      onTap: () => ref.read(toastControllerProvider.notifier).dismiss(widget.toast.id),
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: math.min(540.0, screenW * 0.92)),
        child: TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: _shown ? 1 : 0),
          duration: tokens.durSheet,
          curve: kSpring,
          builder: (context, v, child) => Opacity(
            opacity: v.clamp(0.0, 1.0),
            child: Transform.translate(
              offset: Offset(0, 20 * (1 - v)),
              child: Transform.scale(scale: 0.94 + 0.06 * v, child: child),
            ),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: useBlur
                ? BackdropFilter(
                    filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
                    child: pill,
                  )
                : pill,
          ),
        ),
      ),
    );
  }
}
