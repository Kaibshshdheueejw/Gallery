import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../design/tokens.dart';
import '../settings/app_settings.dart';
import '../../l10n/app_localizations.dart';
import 'glass_material.dart';
import 'svg_icon.dart';

/// PageHead — the preview's sticky `.page-head`:
///   flex row gap 10, padding (space4 + safeTop, space4, space2),
///   background surfaceDim @72% + blur(glass*0.8),
///   h1 27px/700/ls-0.4 with optional 12px sub caption,
///   bar-actions right-aligned (gap 4).
/// `onBack` switches to the `.with-back` layout: padding-left space2 and a
/// 40px round glass-subtle back button before the title.
class PageHead extends ConsumerWidget {
  const PageHead({
    super.key,
    required this.title,
    this.sub,
    this.actions = const [],
    this.onBack,
  });

  final String title;
  final String? sub;
  final List<Widget> actions;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(settingsProvider);
    final tokens = DesignTokens.from(settings);
    final scheme = Theme.of(context).colorScheme;
    final blur = tokens.glass.blurPx * 0.8;
    final useBlur = !settings.reduceTransparency && blur > 0.5;

    Widget head = DecoratedBox(
      decoration: BoxDecoration(
        color: scheme.surfaceDim.withValues(alpha: useBlur ? 0.72 : 0.94),
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: EdgeInsets.fromLTRB(
            onBack != null ? tokens.space(2) : tokens.space(4),
            tokens.space(4),
            tokens.space(4),
            tokens.space(2),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              if (onBack != null) ...[
                Semantics(
                  button: true,
                  label: AppLocalizations.of(context).backLabel,
                  child: Glass.pill(
                    variant: GlassVariant.subtle,
                    onTap: onBack,
                    child: SizedBox(
                      width: 40,
                      height: 40,
                      child: Center(
                        child: SvgIcon('back', size: 20, color: scheme.onSurface),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10), // .page-head flex gap
              ],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 27,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.4,
                        height: 1.15,
                      ),
                    ),
                    if (sub != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 1),
                        child: Text(
                          sub!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 12,
                            color: scheme.onSurfaceVariant,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              if (actions.isNotEmpty) ...[
                const SizedBox(width: 10), // .page-head flex gap
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    for (var i = 0; i < actions.length; i++) ...[
                      if (i > 0) const SizedBox(width: 4), // .bar-actions gap
                      actions[i],
                    ],
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
    if (useBlur) {
      head = ClipRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: blur, sigmaY: blur),
          child: head,
        ),
      );
    }
    return head;
  }
}

/// `.icon-btn` — 42px round button, onSurfaceVariant glyph (20-21px),
/// active = primary glyph on primary@14%, disabled = 35% opacity.
class IconHeadButton extends ConsumerWidget {
  const IconHeadButton({
    super.key,
    required this.icon,
    required this.onTap,
    this.size = 21,
    this.active = false,
    this.enabled = true,
    this.tooltip,
  });

  final String icon;
  final VoidCallback? onTap;
  final double size;
  final bool active;
  final bool enabled;
  final String? tooltip;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    final tokens = DesignTokens.from(ref.watch(settingsProvider));
    final color = active ? scheme.primary : scheme.onSurfaceVariant;
    final btn = GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: enabled ? onTap : null,
      child: AnimatedContainer(
        duration: tokens.durBase,
        curve: kEaseOut,
        width: 42,
        height: 42,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: active ? scheme.primary.withValues(alpha: 0.14) : null,
        ),
        child: Opacity(
          opacity: enabled ? 1 : 0.35,
          child: Center(child: SvgIcon(icon, size: size, color: color)),
        ),
      ),
    );
    if (tooltip != null) {
      return Tooltip(message: tooltip!, child: btn);
    }
    return btn;
  }
}
