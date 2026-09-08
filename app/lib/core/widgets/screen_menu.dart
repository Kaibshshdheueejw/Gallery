import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../design/tokens.dart';
import '../haptics.dart';
import '../settings/app_settings.dart';
import '../../l10n/app_localizations.dart';
import 'glass_popup_menu.dart';
import 'svg_icon.dart';

/// ScreenMenu — the "…" trigger from the preview's ScreenMenu.tsx:
/// a 42px round icon button (menu icon 21px) that lights up while its
/// popup is open and anchors a GlassPopupMenu to itself.
class ScreenMenu extends ConsumerStatefulWidget {
  const ScreenMenu({super.key, required this.items, this.title});

  final List<GlassPopupItem> items;
  final String? title;

  @override
  ConsumerState<ScreenMenu> createState() => _ScreenMenuState();
}

class _ScreenMenuState extends ConsumerState<ScreenMenu> {
  final GlobalKey _btnKey = GlobalKey();
  bool _open = false;

  Future<void> _toggle() async {
    if (_open) return;
    Haptics.tap(ref);
    setState(() => _open = true);
    final box = _btnKey.currentContext?.findRenderObject() as RenderBox?;
    if (box == null) {
      setState(() => _open = false);
      return;
    }
    final topLeft = box.localToGlobal(Offset.zero);
    await showGlassPopupMenu(
      context,
      anchorRect: topLeft & box.size,
      items: widget.items,
      title: widget.title,
    );
    if (mounted) setState(() => _open = false);
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final tokens = DesignTokens.from(ref.watch(settingsProvider));
    return Semantics(
      button: true,
      label: AppLocalizations.of(context).menuLabel,
      child: GestureDetector(
        key: _btnKey,
        behavior: HitTestBehavior.opaque,
        onTap: _toggle,
        child: AnimatedContainer(
          duration: tokens.durBase,
          curve: kEaseOut,
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: _open ? scheme.primary.withValues(alpha: 0.18) : null,
          ),
          child: Center(
            // .icon-btn base colour
            child: SvgIcon('menu', size: 21, color: scheme.onSurfaceVariant),
          ),
        ),
      ),
    );
  }
}
