import 'package:flutter/material.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/settings/app_settings.dart';
import 'core/theme/glass_theme.dart';
import 'core/widgets/glass_surface.dart';
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
      return const MaterialApp(
        debugShowCheckedModeBanner: false,
        home: Scaffold(body: Center(child: CircularProgressIndicator())),
      );
    }
    final settings = ref.watch(settingsProvider);
    return MaterialApp(
      onGenerateTitle: (context) => AppLocalizations.of(context).appName,
      debugShowCheckedModeBanner: false,
      themeMode: settings.themeMode,
      theme: GlassTheme.light(seed: settings.seedColor),
      darkTheme: GlassTheme.dark(seed: settings.seedColor),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      locale: settings.localeOverride, // null → follow system locale (§7)
      home: const HomeShell(),
      builder: (context, child) {
        // Keep text scaling bounded so glass pills never clip labels.
        final mq = MediaQuery.of(context);
        return MediaQuery(
          data: mq.copyWith(
            textScaler: mq.textScaler
                .clamp(minScaleFactor: 0.85, maxScaleFactor: 1.3),
          ),
          child: child ?? const SizedBox.shrink(),
        );
      },
    );
  }
}
