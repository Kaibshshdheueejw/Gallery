import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/constants.dart';
import '../../core/settings/app_settings.dart';
import '../../core/theme/glass_theme.dart';
import '../../core/widgets/glass_surface.dart';
import '../../data/media/media_source.dart';
import '../../l10n/app_localizations.dart';
import '../shared/permission_gate.dart';

/// Settings — Stage 0 ships the appearance/performance/language/privacy
/// sections that already control real behavior (§1, §7, §8). The full
/// category hub (Gallery/Playback/Storage/Backup/AI/Permissions pages)
/// grows as those subsystems land — every row below does something real
/// today; there are no inert stubs (§1).
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  /// Locales the app ships translations for. Grows to the full §7 list with
  /// the localization stage; gen-l10n only generates what has ARB files.
  static const List<Locale> availableLocales = [
    Locale('en'),
    Locale('es'),
    Locale('hi'),
    Locale('bn'),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final settings = ref.watch(settingsProvider);
    final controller = ref.read(settingsProvider.notifier);
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.settings, style: const TextStyle(fontWeight: FontWeight.w800)),
        centerTitle: false,
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 40),
        children: [
          _SectionCard(
            title: l10n.settingsAppearance,
            children: [
              _LabelRow(label: l10n.settingsTheme),
              SegmentedButton<ThemeMode>(
                segments: [
                  ButtonSegment(value: ThemeMode.system, label: Text(l10n.settingsThemeSystem)),
                  ButtonSegment(value: ThemeMode.light, label: Text(l10n.settingsThemeLight)),
                  ButtonSegment(value: ThemeMode.dark, label: Text(l10n.settingsThemeDark)),
                ],
                selected: {settings.themeMode},
                onSelectionChanged: (s) => controller.setThemeMode(s.first),
              ),
              const SizedBox(height: 10),
              _LabelRow(label: l10n.settingsGridDensity),
              Slider(
                value: settings.gridColumns.toDouble(),
                min: 2,
                max: 8,
                divisions: 6,
                label: '${settings.gridColumns}',
                onChanged: (v) => controller.setGridColumns(v.round()),
              ),
              const SizedBox(height: 4),
              _LabelRow(label: l10n.settingsLanguage),
              DropdownButton<String>(
                isExpanded: true,
                value: settings.localeOverride?.languageCode ?? '',
                items: [
                  DropdownMenuItem(
                    value: '',
                    child: Text(l10n.settingsLanguageSystem),
                  ),
                  for (final locale in availableLocales)
                    DropdownMenuItem(
                      value: locale.languageCode,
                      child: Text(_localeName(locale.languageCode)),
                    ),
                ],
                onChanged: (code) => controller.setLocale(
                  code == null || code.isEmpty ? null : Locale(code),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          _SectionCard(
            title: l10n.settingsPerformanceMode,
            subtitle: l10n.settingsPerformanceModeDesc,
            children: [
              SegmentedButton<PerformanceMode>(
                segments: [
                  ButtonSegment(value: PerformanceMode.auto, label: Text(l10n.settingsPerfAuto)),
                  ButtonSegment(value: PerformanceMode.off, label: Text(l10n.settingsPerfOff)),
                  ButtonSegment(value: PerformanceMode.on, label: Text(l10n.settingsPerfOn)),
                ],
                selected: {settings.performanceMode},
                onSelectionChanged: (s) => controller.setPerformanceMode(s.first),
              ),
              if (settings.performanceMode == PerformanceMode.auto &&
                  settings.autoDetectedLowTier)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    // Honest status of the auto-detection (frame-timing based).
                    l10n.settingsPerfAutoLowTier,
                    style: TextStyle(fontSize: 12, color: scheme.primary),
                  ),
                ),
              const SizedBox(height: 8),
              SwitchListTile.adaptive(
                contentPadding: EdgeInsets.zero,
                title: Text(l10n.settingsParallax),
                subtitle: Text(l10n.settingsParallaxDesc),
                value: settings.parallaxEnabled,
                onChanged: controller.setParallax,
              ),
              SwitchListTile.adaptive(
                contentPadding: EdgeInsets.zero,
                title: Text(l10n.settingsHaptics),
                value: settings.hapticsEnabled,
                onChanged: controller.setHaptics,
              ),
            ],
          ),
          const SizedBox(height: 14),
          _SectionCard(
            title: l10n.settingsPrivacy,
            subtitle: l10n.settingsPrivacyDesc,
            children: [
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.verified_user_outlined),
                title: Text(l10n.settingsPermissions),
                subtitle: Text(_permissionLabel(context, ref.watch(permissionProvider))),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: () =>
                    ref.read(permissionProvider.notifier).openSystemSettings(),
              ),
            ],
          ),
          const SizedBox(height: 14),
          _SectionCard(
            title: l10n.settingsAbout,
            children: [
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.photo_library_rounded),
                title: const Text(AppConstants.appName),
                subtitle: Text('${l10n.settingsVersion} ${AppConstants.appVersion}'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  static String _localeName(String code) => switch (code) {
        'en' => 'English',
        'es' => 'Español',
        'hi' => 'हिन्दी',
        'bn' => 'বাংলা',
        _ => code,
      };

  static String _permissionLabel(BuildContext context, MediaPermission p) {
    final l10n = AppLocalizations.of(context);
    return switch (p) {
      MediaPermission.full => l10n.permissionAllow,
      MediaPermission.limited => l10n.permissionLimited,
      MediaPermission.denied => l10n.permissionDenied,
      MediaPermission.restricted => l10n.permissionDenied,
      MediaPermission.unknown => l10n.permissionAllow,
    };
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.children, this.subtitle});

  final String title;
  final String? subtitle;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      radius: GlassTokens.radiusLg,
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(fontWeight: FontWeight.w800),
          ),
          if (subtitle != null) ...[
            const SizedBox(height: 2),
            Text(
              subtitle!,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
          ],
          const SizedBox(height: 10),
          ...children,
        ],
      ),
    );
  }
}

class _LabelRow extends StatelessWidget {
  const _LabelRow({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text(
          label,
          style: Theme.of(context).textTheme.labelLarge,
        ),
      );
}
