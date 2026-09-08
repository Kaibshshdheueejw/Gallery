import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/widgets/glass_surface.dart';
import '../../data/media/media_source.dart';
import '../../domain/usecases/memory_engine.dart';
import '../../l10n/app_localizations.dart';
import '../shared/permission_gate.dart';
import 'memory_card.dart';
import 'memories_providers.dart';

/// ─────────────────────────────────────────────────────────────────────────
/// Memories — dedicated screen reached from the Timeline hamburger menu
/// (web parity: memories live here, NOT on For You). Everything is derived
/// on-device from real library dates: On this day, the recent highlight
/// and day-cluster memories from the last year. Tapping a card opens the
/// full-screen viewer scoped to that memory.
/// ─────────────────────────────────────────────────────────────────────────
class MemoriesScreen extends ConsumerWidget {
  const MemoriesScreen({super.key});

  static const MemoryEngine _engine = MemoryEngine();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final permission = ref.watch(permissionProvider);
    if (permission != MediaPermission.full &&
        permission != MediaPermission.limited) {
      return const PermissionGate(child: SizedBox.shrink());
    }

    final locale = Localizations.localeOf(context).toString();
    final itemsAsync = ref.watch(memoryItemsProvider);
    final now = DateTime.now();

    return Scaffold(
      appBar: AppBar(
        title: Text(
          l10n.memoriesTitle,
          style: const TextStyle(fontWeight: FontWeight.w800),
        ),
        centerTitle: false,
      ),
      body: itemsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(l10n.errorLibraryLoad),
          ),
        ),
        data: (items) {
          final headline = _engine.compute(
            items,
            now,
            (key) => switch (key) {
              'memoryOnThisDay' => l10n.memoryOnThisDay,
              'memoryRecentHighlight' => l10n.memoryRecentHighlight,
              _ => key,
            },
            (date) => l10n.memoryBestDayDesc(
              DateFormat.yMMMMEEEEd(locale).format(date),
            ),
            (date) => DateFormat.yMMMM(locale).format(date),
          );
          final clusters = _engine.dayMemories(
            items,
            now,
            dateLabel: (d) => DateFormat.yMMMMEEEEd(locale).format(d),
          );
          final all = [...headline, ...clusters];

          if (all.isEmpty) {
            return ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
              children: [
                GlassCard(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      Icon(Icons.auto_awesome_outlined,
                          color: Theme.of(context).colorScheme.primary),
                      const SizedBox(width: 10),
                      Expanded(child: Text(l10n.memoryOnThisDayEmpty)),
                    ],
                  ),
                ),
              ],
            );
          }

          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 40),
            itemCount: all.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, i) {
              final isHeadline = i < headline.length;
              return MemoryCard(
                memory: all[i],
                heroWidth: 0, // full-width rows; height governs the layout
                height: isHeadline ? 200 : 156,
              );
            },
          );
        },
      ),
    );
  }
}
