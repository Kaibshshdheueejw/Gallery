import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/haptics.dart';
import '../../core/theme/glass_theme.dart';
import '../../core/widgets/floating_nav_bar.dart';
import '../../core/widgets/pressable.dart';
import '../../l10n/app_localizations.dart';
import '../albums/albums_screen.dart';
import '../foryou/foryou_screen.dart';
import '../search/search_screen.dart';
import '../settings/settings_screen.dart';
import '../timeline/timeline_screen.dart';

/// Root shell: the four primary destinations behind the floating glass
/// capsule (§3). Tabs are kept alive in an IndexedStack so grid scroll
/// position and lazy pages survive tab switches.
class HomeShell extends ConsumerStatefulWidget {
  const HomeShell({super.key});

  @override
  ConsumerState<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends ConsumerState<HomeShell> {
  int _tab = 0;

  static const _tabs = <Widget>[
    ForYouScreen(),
    TimelineScreen(),
    AlbumsScreen(),
    SearchScreen(),
  ];

  void _onTab(int index) {
    setState(() => _tab = index);
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
            child: IndexedStack(index: _tab, children: _tabs),
          ),
          // Settings entry: floating glass gear, top-right, hidden on
          // screens that present their own header actions later.
          SafeArea(
            child: Align(
              alignment: Alignment.topRight,
              child: Padding(
                padding: const EdgeInsets.only(right: 12, top: 4),
                child: Pressable(
                  onTap: () {
                    Haptics.light(ref);
                    Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => const SettingsScreen(),
                      ),
                    );
                  },
                  child: const _GlassGear(),
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

class _GlassGear extends StatelessWidget {
  const _GlassGear();

  @override
  Widget build(BuildContext context) {
    return GlassSurfaceCircle(
      child: Icon(Icons.settings_outlined, size: 20, color: Theme.of(context).colorScheme.onSurface),
    );
  }
}

/// Small circular glass button (settings gear, FAB-like surfaces).
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
      ),
    );
  }
}
