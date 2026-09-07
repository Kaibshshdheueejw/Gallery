import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/constants.dart';
import '../../core/theme/glass_theme.dart';
import '../../core/widgets/glass_surface.dart';
import '../../data/media/media_repository.dart';
import '../../data/media/media_source.dart';
import '../../domain/models/media_item.dart';
import '../../l10n/app_localizations.dart';
import '../shared/asset_thumb.dart';
import '../shared/permission_gate.dart';
import '../viewer/media_viewer.dart';

/// ─────────────────────────────────────────────────────────────────────────
/// Search (Stage 0 scope, §2): title/file-name matching, type filter
/// (All/Photos/Videos), date queries via locale-aware parsing ("July 2026",
/// "2026-07"), album-name matching, and persisted recent searches.
/// OCR/natural-language smart search lands with the on-device AI stage and
/// plugs into the same `SearchQuery` structure (§3 requires the parser be
/// extensible — it is: [SearchQuery.parse] tokenizes into typed criteria).
/// ─────────────────────────────────────────────────────────────────────────

enum SearchTypeFilter { all, photos, videos }

/// Parsed query: typed criteria the (future) NL engine will also fill.
class SearchQuery {
  const SearchQuery({
    this.text = '',
    this.month,
    this.year,
    this.type = SearchTypeFilter.all,
  });

  final String text;
  final DateTime? month; // first-of-month
  final int? year;
  final SearchTypeFilter type;

  bool get isEmpty => text.isEmpty && month == null && year == null;

  /// Locale-aware parse: ISO dates (2026-07, 2026-07-14), "July 2026"-style
  /// month names in the active locale, bare years, free text otherwise.
  static SearchQuery parse(String raw, String locale, SearchTypeFilter type) {
    final text = raw.trim();
    if (text.isEmpty) return SearchQuery(type: type);

    // ISO-ish: 2026 / 2026-07 / 2026-07-14
    final iso = RegExp(r'^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$').firstMatch(text);
    if (iso != null) {
      final year = int.parse(iso.group(1)!);
      final month = iso.group(2) == null ? null : int.parse(iso.group(2)!);
      if (month != null && month >= 1 && month <= 12) {
        return SearchQuery(
          text: text,
          month: DateTime(year, month),
          year: year,
          type: type,
        );
      }
      return SearchQuery(text: text, year: year, type: type);
    }

    // "July 2026" in the active locale (DateFormat understands its own output).
    for (final pattern in ['yMMMM', 'MMMM yyyy', 'yMMM', 'MMM yyyy']) {
      try {
        final fmt = DateFormat(pattern, locale);
        final parsed = fmt.parseStrict(text, false);
        return SearchQuery(
          text: text,
          month: DateTime(parsed.year, parsed.month),
          year: parsed.year,
          type: type,
        );
      } catch (_) {
        // Try next pattern.
      }
    }

    return SearchQuery(text: text, type: type);
  }

  bool matches(MediaItem item, List<AlbumInfo> albums) {
    if (type == SearchTypeFilter.photos && item.isVideo) return false;
    if (type == SearchTypeFilter.videos && !item.isVideo) return false;
    final monthMatch = month == null ||
        (item.createdAt.year == month!.year && item.createdAt.month == month!.month);
    final yearMatch = year == null || month != null || item.createdAt.year == year;
    if (!monthMatch || !yearMatch) return false;
    final q = text.toLowerCase();
    if (q.isEmpty) return true;
    if (item.title.toLowerCase().contains(q)) return true;
    if (item.albumName.toLowerCase().contains(q)) return true;
    if (item.relativePath.toLowerCase().contains(q)) return true;
    return false;
  }
}

/// Recent searches, persisted (§2 search bar with recent searches).
class RecentSearchesController extends Notifier<List<String>> {
  static const _key = '${AppConstants.prefsKeyPrefix}recentSearches';

  @override
  List<String> build() => const [];

  Future<void> hydrate() async {
    final prefs = await SharedPreferences.getInstance();
    state = prefs.getStringList(_key) ?? const [];
  }

  Future<void> push(String query) async {
    final trimmed = query.trim();
    if (trimmed.isEmpty) return;
    final next = [trimmed, ...state.where((s) => s != trimmed)].take(12).toList();
    state = next;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_key, next);
  }

  Future<void> clear() async {
    state = const [];
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key);
  }
}

final recentSearchesProvider =
    NotifierProvider<RecentSearchesController, List<String>>(
        RecentSearchesController.new);

class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final TextEditingController _controller = TextEditingController();
  SearchTypeFilter _type = SearchTypeFilter.all;
  List<MediaItem> _results = [];
  List<AlbumInfo> _albums = [];
  bool _searched = false;
  bool _searching = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await ref.read(recentSearchesProvider.notifier).hydrate();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _runSearch() async {
    final permission = ref.read(permissionProvider);
    if (permission != MediaPermission.full && permission != MediaPermission.limited) {
      return;
    }
    setState(() => _searching = true);
    final repo = ref.read(mediaRepositoryProvider);
    if (_albums.isEmpty) {
      _albums = await repo.albums();
    }
    final locale = Localizations.localeOf(context).toString();
    final query = SearchQuery.parse(_controller.text, locale, _type);
    final items = <MediaItem>[];
    // Stage 0 scans the cached page window (same honest bound as memories);
    // the AI stage replaces this with indexed metadata search.
    for (var page = 0; page < 8; page++) {
      items.addAll(await repo.page(page));
    }
    final matches = query.isEmpty
        ? const <MediaItem>[]
        : items.where((i) => query.matches(i, _albums)).toList();
    if (!mounted) return;
    setState(() {
      _results = matches;
      _searched = true;
      _searching = false;
    });
    if (!query.isEmpty && _controller.text.trim().isNotEmpty) {
      await ref.read(recentSearchesProvider.notifier).push(_controller.text.trim());
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final permission = ref.watch(permissionProvider);
    if (permission != MediaPermission.full && permission != MediaPermission.limited) {
      return const PermissionGate(child: SizedBox.shrink());
    }
    final scheme = Theme.of(context).colorScheme;
    final recents = ref.watch(recentSearchesProvider);

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Column(
        children: [
          // Floating glass search field.
          GlassSurface.pill(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            child: Row(
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Icon(Icons.search_rounded, color: scheme.onSurfaceVariant),
                ),
                Expanded(
                  child: TextField(
                    controller: _controller,
                    textInputAction: TextInputAction.search,
                    onSubmitted: (_) => _runSearch(),
                    decoration: InputDecoration(
                      hintText: l10n.searchHint,
                      border: InputBorder.none,
                      isDense: true,
                    ),
                  ),
                ),
                if (_controller.text.isNotEmpty)
                  IconButton(
                    icon: const Icon(Icons.close_rounded, size: 18),
                    onPressed: () {
                      _controller.clear();
                      setState(() {
                        _results = [];
                        _searched = false;
                      });
                    },
                  ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          // Type filter chips (All / Photos / Videos).
          Row(
            children: [
              for (final filter in SearchTypeFilter.values)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: _FilterChip(
                    label: switch (filter) {
                      SearchTypeFilter.all => l10n.filterAll,
                      SearchTypeFilter.photos => l10n.filterPhotos,
                      SearchTypeFilter.videos => l10n.filterVideos,
                    },
                    selected: _type == filter,
                    onTap: () {
                      setState(() => _type = filter);
                      if (_searched) _runSearch();
                    },
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Expanded(
            child: !_searched
                ? _RecentsPanel(recents: recents, onPick: (q) {
                    _controller.text = q;
                    _runSearch();
                  })
                : _searching
                    ? const Center(child: CircularProgressIndicator())
                    : _results.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.travel_explore_outlined,
                                    size: 40, color: scheme.outline),
                                const SizedBox(height: 8),
                                Text(l10n.searchNoResults),
                                const SizedBox(height: 4),
                                Text(
                                  l10n.searchNoResultsHint,
                                  style: Theme.of(context).textTheme.bodySmall,
                                  textAlign: TextAlign.center,
                                ),
                              ],
                            ),
                          )
                        : GridView.builder(
                            padding: const EdgeInsets.only(bottom: 120),
                            gridDelegate:
                                const SliverGridDelegateWithFixedCrossAxisCount(
                              crossAxisCount: 4,
                              crossAxisSpacing: 2.5,
                              mainAxisSpacing: 2.5,
                            ),
                            itemCount: _results.length,
                            itemBuilder: (context, i) => GestureDetector(
                              onTap: () => Navigator.of(context).push(
                                MaterialPageRoute<void>(
                                  builder: (_) => MediaViewer(
                                    items: _results,
                                    initialIndex: i,
                                  ),
                                ),
                              ),
                              child: AssetThumb(item: _results[i], size: 360),
                            ),
                          ),
          ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: GlassTokens.durationFast,
        curve: Curves.easeOutCubic,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: selected
              ? scheme.primary.withValues(alpha: 0.16)
              : scheme.surfaceContainerHighest.withValues(alpha: 0.5),
          borderRadius: BorderRadius.circular(GlassTokens.radiusPill),
          border: Border.all(
            color: selected
                ? scheme.primary.withValues(alpha: 0.35)
                : Colors.transparent,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12.5,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            color: selected ? scheme.primary : scheme.onSurfaceVariant,
          ),
        ),
      ),
    );
  }
}

class _RecentsPanel extends ConsumerWidget {
  const _RecentsPanel({required this.recents, required this.onPick});

  final List<String> recents;
  final ValueChanged<String> onPick;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    if (recents.isEmpty) {
      return const SizedBox.shrink();
    }
    return ListView(
      padding: const EdgeInsets.only(bottom: 120),
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                l10n.searchRecent,
                style: Theme.of(context).textTheme.titleSmall,
              ),
            ),
            TextButton(
              onPressed: () => ref.read(recentSearchesProvider.notifier).clear(),
              child: Text(l10n.searchClear),
            ),
          ],
        ),
        for (final r in recents)
          ListTile(
            dense: true,
            leading: const Icon(Icons.history_rounded, size: 18),
            title: Text(r),
            onTap: () => onPick(r),
          ),
      ],
    );
  }
}
