import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/settings/app_settings.dart';
import 'core/theme/seed_theme.dart';
import 'core/widgets/glass_surface.dart';
import 'core/widgets/svg_icon.dart';
import 'features/shell/home_shell.dart';
import 'l10n/app_localizations.dart';

/// Entry point. Settings are hydrated BEFORE first frame (no theme flash),
/// the frame-tier monitor starts sampling for Performance Mode auto-detect,
/// and the app runs fully edge-to-edge behind the floating glass capsule.
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Locale-aware date symbols for timeline headers / search date parsing (§7).
  await initializeDateFormatting();

  final container = ProviderContainer();
  // Kick off hydration; await so the first frame already knows user prefs.
  final settingsFuture = container.read(settingsProvider.notifier).hydrate();

  runApp(
    UncontrolledProviderScope(
      container: container,
      child: _Bootstrap(settingsFuture: settingsFuture),
    ),
  );
}

class _Bootstrap extends ConsumerStatefulWidget {
  const _Bootstrap({required this.settingsFuture});

  final Future<void> settingsFuture;

  @override
  ConsumerState<_Bootstrap> createState() => _BootstrapState();
}

class _BootstrapState extends ConsumerState<_Bootstrap> {
  bool _ready = false;

  @override
  void initState() {
    super.initState();
    widget.settingsFuture.whenComplete(() {
      if (mounted) setState(() => _ready = true);
      // Start device-tier frame sampling (§1 Performance Mode auto-detect).
      ref.read(frameTierMonitorProvider);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (!_ready) {
      // Sub-2s cold start target (§9): the splash is a single composited
      // frame — no async work besides prefs hydration blocks first paint.
      // Preview parity (.boot): surfaceDim backdrop, 46px slowly spinning
      // sparkle in primary, app name 22px/750 below it (gap 16).
      const defaults = AppSettings();
      return MaterialApp(
        debugShowCheckedModeBanner: false,
        themeMode: defaults.mode,
        theme: themeFromScheme(
          buildScheme(defaults.effectiveSeedColor, ThemeMode.light, false),
        ),
        darkTheme: themeFromScheme(
          buildScheme(defaults.effectiveSeedColor, ThemeMode.dark, true),
        ),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: const _BootSplash(),
      );
    }
    final settings = ref.watch(settingsProvider);
    // Preview-parity theming: seed → full HCT-free HSL scheme recipe from
    // theme.ts (seed_theme.dart), wallpaper-tinted when dynamic colour is
    // on. MaterialApp resolves ThemeMode.system against platform brightness.
    final seed = settings.effectiveSeedColor;
    return MaterialApp(
      onGenerateTitle: (context) => AppLocalizations.of(context).appName,
      debugShowCheckedModeBanner: false,
      themeMode: settings.mode,
      theme: themeFromScheme(buildScheme(seed, ThemeMode.light, false)),
      darkTheme: themeFromScheme(buildScheme(seed, ThemeMode.dark, true)),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      locale: settings.localeOverride, // null → follow system locale (§7)
      home: const HomeShell(),
      builder: (context, child) {
        // Edge-to-edge (§4): transparent system bars with icon contrast
        // following the resolved theme brightness (status bar + Android
        // 3-button nav). The preview draws under the browser chrome; the
        // real app draws under the status bar behind the page-head blur.
        final dark = Theme.of(context).brightness == Brightness.dark;
        // Keep text scaling bounded so glass pills never clip labels.
        final mq = MediaQuery.of(context);
        return AnnotatedRegion<SystemUiOverlayStyle>(
          value: SystemUiOverlayStyle(
            statusBarColor: Colors.transparent,
            statusBarIconBrightness: dark ? Brightness.light : Brightness.dark,
            statusBarBrightness: dark ? Brightness.dark : Brightness.light,
            systemNavigationBarColor: Colors.transparent,
            systemNavigationBarDividerColor: Colors.transparent,
            systemNavigationBarIconBrightness:
                dark ? Brightness.light : Brightness.dark,
          ),
          child: MediaQuery(
            data: mq.copyWith(
              textScaler: mq.textScaler
                  .clamp(minScaleFactor: 0.85, maxScaleFactor: 1.3),
            ),
            child: child ?? const SizedBox.shrink(),
          ),
        );
      },
    );
  }
}

/// The preview's `.boot` splash — shown only while settings hydrate.
class _BootSplash extends StatefulWidget {
  const _BootSplash();

  @override
  State<_BootSplash> createState() => _BootSplashState();
}

class _BootSplashState extends State<_BootSplash>
    with SingleTickerProviderStateMixin {
  late final AnimationController _spin = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2400), // .spin-slow
  )..repeat();

  @override
  void dispose() {
    _spin.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            RotationTransition(
              turns: _spin,
              child: SvgIcon('sparkle', size: 46, color: scheme.primary),
            ),
            const SizedBox(height: 16),
            Text(
              AppLocalizations.of(context).appName,
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w700, // ~750
                letterSpacing: -0.3,
                color: scheme.onSurface,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
