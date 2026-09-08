import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/haptics.dart';
import '../../core/settings/app_settings.dart';
import '../../core/theme/glass_theme.dart';
import '../../core/widgets/floating_nav_bar.dart';
import '../../core/widgets/glass_popup_menu.dart';
import '../../core/widgets/glass_surface.dart';
import '../../core/widgets/pressable.dart';
import '../../l10n/app_localizations.dart';
import '../albums/albums_screen.dart';
import '../foryou/foryou_screen.dart';
import '../memories/memories_screen.dart';
import '../search/search_screen.dart';
import '../settings/settings_screen.dart';
import '../shared/permission_gate.dart';
import '../timeline/timeline_screen.dart';

/// Root shell: the four primary destinations behind the floating glass
/// capsule (§3). Tabs are kept alive in an IndexedStack so grid scroll
/// position and lazy pages survive tab switches.
///
/// Library access is gated through [PermissionGate] — nothing in the tab
/// content is built until photo_manager confirms access, and the system
/// prompt is only fired from the rationale screen (never on cold start).
/// The gate also owns the Android 14 / iOS limited-access banner with a
/// "Select more photos" action (presentLimited).
class HomeShell extends ConsumerStatefulWidget {
  const HomeShell({super.key});

  @override
  ConsumerState<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends ConsumerState<HomeShell>
    with WidgetsBindingObserver {
  int _tab = 0;
  final GlobalKey _menuAnchorKey = GlobalKey();

  static const _tabs = <Widget>[
    ForYouScreen(),
    TimelineScreen(),
    AlbumsScreen(),
    SearchScreen(),
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Silent re-check when the app resumes — covers the case where the
    // user granted access from system Settings and comes back to the app.
    // Never prompts: getPermissionState only reads the current status.
    if (state == AppLifecycleState.resumed) {
      ref.read(permissionProvider.notifier).recheck();
    }
  }

  void _onTab(int index) {
    setState(() => _tab = index);
  }

  /// Hamburger menu (web parity: Settings first, then per-tab contextual
  /// actions). Timeline gets grouping + zoom-density controls; every tab
  /// gets Settings and the dedicated Memories screen.
  void _openMenu() {
    final box =
        _menuAnchorKey.currentContext?.findRenderObject() as RenderBox?;
    if (box == null) return;
    final anchor = box.localToGlobal(Offset.zero) & box.size;
    final l10n = AppLocalizations.of(context);
    final settings = ref.read(settingsProvider);
    final controller = ref.read(settingsProvider.notifier);
    final nav = Navigator.of(context);
    Haptics.light(ref);

    showGlassPopupMenu(
      context,
      anchorRect: anchor,
      items: [
        GlassPopupItem(
          icon: Icons.settings_outlined,
          label: l10n.settings,
          onTap: () => nav.push(
            MaterialPageRoute<void>(builder: (_) => const SettingsScreen()),
          ),
        ),
        GlassPopupItem(
          icon: Icons.collections_outlined,
          label: l10n.memoriesTitle,
          onTap: () => nav.push(
            MaterialPageRoute<void>(builder: (_) => const MemoriesScreen()),
          ),
        ),
        if (_tab == 1) ...[
          for (final (index, entry) in [
            (Icons.calendar_view_day_rounded, l10n.timelineGroupDay),
            (Icons.calendar_view_week_rounded, l10n.timelineGroupMonth),
            (Icons.calendar_view_month_rounded, l10n.timelineGroupYear),
          ].indexed)
            GlassPopupItem(
              icon: entry.$1,
              label: entry.$2,
              checked: settings.timelineGrouping == index,
              onTap: () => controller.setTimelineGrouping(index),
            ),
          GlassPopupItem(
            icon: Icons.zoom_in_rounded,
            label: l10n.timelineZoomIn,
            disabled: settings.gridColumns >= 8,
            onTap: () => controller.setGridColumns(settings.gridColumns + 1),
          ),
          GlassPopupItem(
            icon: Icons.zoom_out_rounded,
            label: l10n.timelineZoomOut,
            disabled: settings.gridColumns <= 2,
            onTap: () => controller.setGridColumns(settings.gridColumns - 1),
          ),
        ],
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    return Scaffold(
      extendBody: true, // content flows under the floating capsule
      body: Stack(
        children: [
          // Ambient aurora background — two soft radial washes behind
          // everything; cheap (no blur), gives glass something to refract.
          const Positioned.fill(child: _AmbientBackground()),
          Positioned.fill(
            child: PermissionGate(
              child: IndexedStack(index: _tab, children: _tabs),
            ),
          ),
          // Hamburger menu: floating glass button, top-right (web parity —
          // every tab opens the same anchored popup, Settings first).
          SafeArea(
            child: Align(
              alignment: Alignment.topRight,
              child: Padding(
                padding: const EdgeInsets.only(right: 12, top: 4),
                child: Pressable(
                  onTap: _openMenu,
                  child: GlassSurfaceCircle(
                    key: _menuAnchorKey,
                    child: Icon(Icons.menu_rounded,
                        size: 20, color: Theme.of(context).colorScheme.onSurface),
                  ),
                ),
              ),
            ),
          ),
          Align(
            alignment: Alignment.bottomCenter,
            child: SafeArea(
              top: false,
              child: FloatingNavBar(
                currentIndex: _tab,
                onSelected: _onTab,
                items: [
                  FloatingNavItem(
                    icon: Icons.auto_awesome_outlined,
                    activeIcon: Icons.auto_awesome_rounded,
                    labelBuilder: (_) => l10n.tabForYou,
                  ),
                  FloatingNavItem(
                    icon: Icons.photo_library_outlined,
                    activeIcon: Icons.photo_library_rounded,
                    labelBuilder: (_) => l10n.tabTimeline,
                  ),
                  FloatingNavItem(
                    icon: Icons.grid_view_outlined,
                    activeIcon: Icons.grid_view_rounded,
                    labelBuilder: (_) => l10n.tabAlbums,
                  ),
                  FloatingNavItem(
                    icon: Icons.search_rounded,
                    activeIcon: Icons.search_rounded,
                    labelBuilder: (_) => l10n.tabSearch,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Small circular glass button (hamburger trigger, FAB-like surfaces).
class GlassSurfaceCircle extends StatelessWidget {
  const GlassSurfaceCircle({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 42,
      height: 42,
      child: GlassSurface(
        radius: GlassTokens.radiusPill,
        specular: false,
        parallax: false,
        child: Center(child: child),
      ),
    );
  }
}

/// Two radial colour washes (theme-tinted, dark-mode aware). Painted once,
/// no animation loop → zero per-frame cost (§12 performance).
class _AmbientBackground extends StatelessWidget {
  const _AmbientBackground();

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final isDark = scheme.brightness == Brightness.dark;
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: RadialGradient(
          center: const Alignment(-0.85, -1.0),
          radius: 1.4,
          colors: [
            scheme.primary.withValues(alpha: isDark ? 0.16 : 0.10),
            Colors.transparent,
          ],
        ),
      ),
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: RadialGradient(
            center: const Alignment(1.0, 1.1),
            radius: 1.3,
            colors: [
              scheme.tertiary.withValues(alpha: isDark ? 0.12 : 0.08),
              Colors.transparent,
            ],
          ),
        ),
        child: const SizedBox.expand(),
      ),
    );
  }
}
