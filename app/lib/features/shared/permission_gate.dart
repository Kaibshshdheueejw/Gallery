import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:photo_manager/photo_manager.dart';

import '../../core/theme/glass_theme.dart';
import '../../core/widgets/glass_surface.dart';
import '../../core/widgets/pressable.dart';
import '../../data/media/media_repository.dart';
import '../../data/media/media_source.dart';
import '../../l10n/app_localizations.dart';

/// Notifier driving the permission flow (§8): honest rationale BEFORE the
/// system prompt, proper handling of Android 14 / iOS limited access, and a
/// route to system settings when denied.
class PermissionFlow extends Notifier<MediaPermission> {
  @override
  MediaPermission build() => MediaPermission.unknown;

  Future<void> request() async {
    final result = await ref.read(mediaRepositoryProvider).requestPermission();
    state = result;
    if (result == MediaPermission.full || result == MediaPermission.limited) {
      ref.read(mediaRepositoryProvider).invalidate();
    }
  }

  Future<void> recheck() async {
    state = await ref.read(mediaRepositoryProvider).checkPermission();
  }

  Future<void> openSystemSettings() => PhotoManager.openSetting();
}

final permissionProvider =
    NotifierProvider<PermissionFlow, MediaPermission>(PermissionFlow.new);

/// Wraps a screen that needs library access. Shows:
///  • rationale + Allow button when not yet requested/denied,
///  • a "limited access" notice (with a button to pick more photos) on
///    iOS/Android 14 partial grants,
///  • a denied state pointing at system settings,
///  • the child once granted.
class PermissionGate extends ConsumerStatefulWidget {
  const PermissionGate({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<PermissionGate> createState() => _PermissionGateState();
}

class _PermissionGateState extends ConsumerState<PermissionGate> {
  @override
  void initState() {
    super.initState();
    // Auto-request on first appearance: the rationale screen IS the first
    // frame the user sees (§8 — rationale shown before the system prompt is
    // handled by [RationaleBody] gating the actual request call).
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final current = ref.read(permissionProvider);
      if (current == MediaPermission.unknown) {
        await ref.read(permissionProvider.notifier).recheck();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final permission = ref.watch(permissionProvider);
    return switch (permission) {
      MediaPermission.full ||
      MediaPermission.limited =>
        Column(
          children: [
            if (permission == MediaPermission.limited) const _LimitedBanner(),
            Expanded(child: widget.child),
          ],
        ),
      MediaPermission.denied ||
      MediaPermission.restricted =>
        const _DeniedBody(),
      MediaPermission.unknown => const RationaleBody(),
    };
  }
}

class RationaleBody extends ConsumerWidget {
  const RationaleBody({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            GlassCard(
              radius: GlassTokens.radiusLg,
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  Icon(Icons.perm_media_rounded, size: 44, color: scheme.primary),
                  const SizedBox(height: 14),
                  Text(
                    l10n.permissionPhotosTitle,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    l10n.permissionPhotosRationale,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: scheme.onSurfaceVariant,
                        ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            Pressable(
              onTap: () => ref.read(permissionProvider.notifier).request(),
              child: GlassCard(
                radius: GlassTokens.radiusPill,
                padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.lock_open_rounded, size: 18, color: scheme.primary),
                    const SizedBox(width: 8),
                    Text(
                      l10n.permissionAllow,
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        color: scheme.primary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DeniedBody extends ConsumerWidget {
  const _DeniedBody();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.no_photography_outlined, size: 40),
            const SizedBox(height: 12),
            Text(l10n.permissionDenied, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            Text(
              l10n.permissionDeniedHelp,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: () =>
                  ref.read(permissionProvider.notifier).openSystemSettings(),
              icon: const Icon(Icons.settings_rounded, size: 18),
              label: Text(l10n.permissionOpenSettings),
            ),
          ],
        ),
      ),
    );
  }
}

class _LimitedBanner extends ConsumerWidget {
  const _LimitedBanner();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    return SafeArea(
      bottom: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
        child: GlassCard(
          radius: GlassTokens.radiusMd,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(
            children: [
              Icon(Icons.filter_alt_rounded, size: 16, color: scheme.primary),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  l10n.permissionLimited,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
              TextButton(
                onPressed: () => ref.read(permissionProvider.notifier).request(),
                child: Text(l10n.actionRetry),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
