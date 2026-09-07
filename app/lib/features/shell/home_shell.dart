import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:photo_manager/photo_manager.dart';

import '../../core/haptics.dart';
import '../../core/theme/glass_theme.dart';
import '../../core/widgets/floating_nav_bar.dart';
import '../../core/widgets/glass_surface.dart';
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
///
/// Gated behind a photo/video permission check — nothing in the tab
/// content is built until PhotoManager confirms access, since the tabs
/// call PhotoManager.getAssetPathList() directly and will otherwise just
/// silently return zero results instead of prompting the user.
class HomeShell extends ConsumerStatefulWidget {
  const HomeShell({super.key});

  @override
  ConsumerState<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends ConsumerState<HomeShell> with WidgetsBindingObserver {
  int _tab = 0;
  PermissionState? _permission;

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
    _checkPermission();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Re-check when the app resumes — covers the case where the user
    // granted access from system Settings and comes back to the app.
    if (state == AppLifecycleState.resumed) {
      _checkPermission();
    }
  }

  Future<void> _checkPermission() async {
    final ps = await PhotoManager.requestPermissionExtend();
    if (mounted) setState(() => _permission = ps);
  }

  void _onTab(int index) {
    setState(() => _tab = index);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    // Still checking on first launch.
    if (_permission == null) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    // Denied, or not yet decided (e.g. Android "limited" state with no
    // access at all). isAuth = full access. hasAccess also covers
    // Android 14+ partial/user-selected access.
    if (!_permission!.isAuth && !_permission!.hasAccess) {
      return _PermissionRequiredScreen(onRetry: _checkPermission);
    }

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

/// Shown when photo/video permission has not been granted (or was denied).
/// Explains why access is needed and offers a retry, falling back to the
/// system app-settings screen for the case where Android will no longer
/// show its own permission dialog after a prior denial.
class _PermissionRequiredScreen extends StatelessWidget {
  const _PermissionRequiredScreen({required this.onRetry});

  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.photo_library_outlined,
                size: 64,
                color: scheme.primary,
              ),
              const SizedBox(height: 24),
              Text(
                'Gallery needs access to your photos and videos',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 12),
              Text(
                'All processing happens on your device. Nothing is '
                'uploaded unless you turn on cloud backup in Settings.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: scheme.onSurfaceVariant,
                    ),
              ),
              const SizedBox(height: 32),
              FilledButton(
                onPressed: onRetry,
                child: const Text('Grant access'),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => PhotoManager.openSetting(),
                child: const Text('Open app settings'),
              ),
            ],
          ),
        ),
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
