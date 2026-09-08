import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/design/tokens.dart';
import '../../core/settings/app_settings.dart';
import '../../core/widgets/floating_navigation.dart';
import '../../core/widgets/glass_popup_menu.dart';
import '../../core/widgets/screen_menu.dart';
import '../../core/widgets/toast.dart';
import '../../l10n/app_localizations.dart';
import '../albums/albums_screen.dart';
import '../foryou/foryou_screen.dart';
import '../memories/memories_screen.dart';
import '../search/search_screen.dart';
import '../settings/settings_screen.dart';
import '../shared/permission_gate.dart';
import '../timeline/timeline_screen.dart';

/// Root shell — the Flutter twin of the preview's App.tsx:
///   • ambient radial-wash background (`.app-root`, three gradients over
///     surfaceDim, painted once, zero per-frame cost)
///   • content column capped at 1180 logical px (`.content`), gated by
///     [PermissionGate]
///   • tab switches REMOUNT the screen behind a page-in transition
///     (scale .975 → 1, translateY 10 → 0, fade, hero duration, spring) —
///     exactly like the preview's routeKey'd `.page-anim` wrapper
///   • floating capsule navigation in the preview's tab order
///   • toast host above the nav
///
/// The top-right ScreenMenu is TEMPORARY: Stage B gives every screen its
/// own PageHead + ScreenMenu (web parity), after which this global one is
/// removed. It mirrors the preview's Timeline menu for the items that
/// exist today (Settings, Memories, sort, grouping, zoom).
class HomeShell extends ConsumerStatefulWidget {
  const HomeShell({super.key});

  @override
  ConsumerState<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends ConsumerState<HomeShell>
    with WidgetsBindingObserver {
  TabId _tab = TabId.foryou;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // Web parity (store.initApp): boot into the configured default tab.
    // Settings hydrate before HomeShell is built (main awaits hydrate()).
    final initial = ref.read(settingsProvider).defaultTab;
    if (initial != _tab) _tab = initial;
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

  Widget _screenFor(TabId tab) => switch (tab) {
        TabId.foryou => const ForYouScreen(),
        TabId.timeline => const TimelineScreen(),
        TabId.albums => const AlbumsScreen(),
        TabId.search => const SearchScreen(),
      };

  List<GlassPopupItem> _menuItems(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final settings = ref.watch(settingsProvider);
    final controller = ref.read(settingsProvider.notifier);
    final nav = Navigator.of(context);
    return [
      GlassPopupItem(
        icon: 'settings',
        label: l10n.settings,
        onTap: () => nav.push(
          MaterialPageRoute<void>(builder: (_) => const SettingsScreen()),
        ),
      ),
      GlassPopupItem(
        icon: 'memories',
        label: l10n.memoriesTitle,
        onTap: () => nav.push(
          MaterialPageRoute<void>(builder: (_) => const MemoriesScreen()),
        ),
      ),
      if (_tab == TabId.timeline) ...[
        GlassPopupItem(
          icon: 'sort',
          label: l10n.sortNewest,
          checked: settings.sortOrder == SortOrder.newest,
          onTap: () => controller.setSortOrder(SortOrder.newest),
        ),
        GlassPopupItem(
          icon: 'sort',
          label: l10n.sortOldest,
          checked: settings.sortOrder == SortOrder.oldest,
          onTap: () => controller.setSortOrder(SortOrder.oldest),
        ),
        // Grouping (web: day = level ≥ 2, month = 1, year = 0)
        GlassPopupItem(
          icon: 'grid',
          label: l10n.timelineGroupDay,
          checked: settings.gridLevel >= 2,
          onTap: () => controller.setGridLevel(3),
        ),
        GlassPopupItem(
          icon: 'grid',
          label: l10n.timelineGroupMonth,
          checked: settings.gridLevel == 1,
          onTap: () => controller.setGridLevel(1),
        ),
        GlassPopupItem(
          icon: 'grid',
          label: l10n.timelineGroupYear,
          checked: settings.gridLevel == 0,
          onTap: () => controller.setGridLevel(0),
        ),
        GlassPopupItem(
          icon: 'zoomIn',
          label: l10n.timelineZoomIn,
          disabled: settings.gridLevel >= 5,
          onTap: () => controller.setGridLevel(settings.gridLevel + 1),
        ),
        GlassPopupItem(
          icon: 'zoomOut',
          label: l10n.timelineZoomOut,
          disabled: settings.gridLevel <= 0,
          onTap: () => controller.setGridLevel(settings.gridLevel - 1),
        ),
      ],
    ];
  }

  @override
  Widget build(BuildContext context) {
    final settings = ref.watch(settingsProvider);
    final tokens = DesignTokens.from(settings);

    return Scaffold(
      extendBody: true, // content flows under the floating capsule
      body: Stack(
        children: [
          const Positioned.fill(child: _AmbientBackground()),
          Positioned.fill(
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 1180),
                child: PermissionGate(
                  child: AnimatedSwitcher(
                    duration: tokens.animationsEnabled
                        ? tokens.durHero
                        : Duration.zero,
                    switchInCurve: kSpring,
                    layoutBuilder: (currentChild, previousChildren) =>
                        // Web parity: re-keying unmounts the old screen
                        // immediately — only the incoming page animates.
                        Stack(
                          fit: StackFit.expand,
                          children: [if (currentChild != null) currentChild],
                        ),
                    transitionBuilder: (child, animation) {
                      final a = CurvedAnimation(
                        parent: animation,
                        curve: kSpring,
                      );
                      // One spring drives opacity + transform (CSS
                      // animation semantics); CSS clamps opacity >1
                      // implicitly, so clamp here too.
                      return AnimatedBuilder(
                        animation: a,
                        builder: (context, c) => Opacity(
                          opacity: a.value.clamp(0.0, 1.0),
                          child: Transform.translate(
                            offset: Offset(0, 10 * (1 - a.value)),
                            child: Transform.scale(
                              scale: 0.975 + 0.025 * a.value,
                              child: c,
                            ),
                          ),
                        ),
                        child: child,
                      );
                    },
                    child: KeyedSubtree(
                      key: ValueKey(_tab),
                      child: _screenFor(_tab),
                    ),
                  ),
                ),
              ),
            ),
          ),
          // TEMPORARY global screen menu (see class doc).
          SafeArea(
            child: Align(
              alignment: Alignment.topRight,
              child: Padding(
                padding: const EdgeInsets.only(right: 12, top: 4),
                child: ScreenMenu(items: _menuItems(context)),
              ),
            ),
          ),
          Align(
            alignment: Alignment.bottomCenter,
            child: FloatingNavigation(
              activeTab: _tab,
              onTabSelected: (tab) => setState(() => _tab = tab),
            ),
          ),
          const ToastHost(),
        ],
      ),
    );
  }
}

/// `.app-root` background — three soft radial washes over surfaceDim:
///   900×480 @ (12%, -8%)  primary @22% → transparent 68%
///   760×420 @ (92%, 4%)   tertiary @16% → transparent 66%
///   1000×600 @ (50%, 108%) secondary @14% → transparent 70%
/// Painted once per theme/size change, no animation loop (§25).
class _AmbientBackground extends StatelessWidget {
  const _AmbientBackground();

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return CustomPaint(
      painter: _AmbientPainter(scheme),
      size: Size.infinite,
    );
  }
}

class _AmbientPainter extends CustomPainter {
  const _AmbientPainter(this.scheme);

  final ColorScheme scheme;

  void _wash(
    Canvas canvas,
    Size size,
    double px,
    double py,
    double rx,
    double ry,
    Color color,
    double stop,
  ) {
    final shader = RadialGradient(
      colors: [color, color.withValues(alpha: 0)],
      stops: [0, stop],
    ).createShader(Rect.fromCircle(center: Offset.zero, radius: ry));
    canvas.save();
    canvas.clipRect(Offset.zero & size);
    canvas.translate(size.width * px, size.height * py);
    canvas.scale(rx / ry, 1);
    canvas.drawRect(
      Rect.fromCenter(center: Offset.zero, width: ry * 2, height: ry * 2),
      Paint()..shader = shader,
    );
    canvas.restore();
  }

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(
      Offset.zero & size,
      Paint()..color = scheme.surfaceDim,
    );
    _wash(canvas, size, 0.12, -0.08, 900, 480,
        scheme.primary.withValues(alpha: 0.22), 0.68);
    _wash(canvas, size, 0.92, 0.04, 760, 420,
        scheme.tertiary.withValues(alpha: 0.16), 0.66);
    _wash(canvas, size, 0.50, 1.08, 1000, 600,
        scheme.secondary.withValues(alpha: 0.14), 0.70);
  }

  @override
  bool shouldRepaint(_AmbientPainter oldDelegate) =>
      oldDelegate.scheme != scheme;
}
