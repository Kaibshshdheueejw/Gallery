import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/haptics.dart';
import '../../core/settings/app_settings.dart';
import '../../core/theme/glass_theme.dart';
import '../../core/widgets/glass_surface.dart';
import '../../data/media/media_repository.dart';
import '../../data/media/media_source.dart';
import '../../domain/models/media_item.dart';
import '../../domain/usecases/group_timeline.dart';
import '../../l10n/app_localizations.dart';
import '../shared/asset_thumb.dart';
import '../shared/permission_gate.dart';
import '../viewer/media_viewer.dart';

/// ─────────────────────────────────────────────────────────────────────────
/// Timeline (§2): high-performance virtualized media grid, sticky glass date
/// headers, pinch-to-zoom grid density, and a Google-Photos-style side
/// scrubber rendered as a floating glass overlay.
/// ─────────────────────────────────────────────────────────────────────────
class TimelineScreen extends ConsumerStatefulWidget {
  const TimelineScreen({super.key, this.initialAlbumId});

  /// When set, the timeline shows one album's items (used by Albums detail).
  final String? initialAlbumId;

  @override
  ConsumerState<TimelineScreen> createState() => _TimelineScreenState();
}

class _TimelineScreenState extends ConsumerState<TimelineScreen> {
  final ScrollController _scrollController = ScrollController();
  final List<MediaItem> _items = [];
  int _pagesLoaded = 0;
  bool _loading = false;
  bool _exhausted = false;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadNextPage());
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >
        _scrollController.position.maxScrollExtent - 1200) {
      _loadNextPage();
    }
  }

  Future<void> _loadNextPage() async {
    if (_loading || _exhausted) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = ref.read(mediaRepositoryProvider);
      final albumId = widget.initialAlbumId;
      final page = albumId == null
          ? await repo.page(_pagesLoaded)
          : await repo.albumItems(albumId, page: _pagesLoaded);
      if (!mounted) return;
      setState(() {
        if (page.isEmpty) {
          _exhausted = true;
        } else {
          _items.addAll(page);
          _pagesLoaded++;
        }
        _loading = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = e;
        });
      }
    }
  }

  void _openViewer(int index) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => MediaViewer(items: _items, initialIndex: index),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final permission = ref.watch(permissionProvider);
    if (permission != MediaPermission.full && permission != MediaPermission.limited) {
      return const PermissionGate(child: SizedBox.shrink());
    }

    final settings = ref.watch(settingsProvider);
    final locale = Localizations.localeOf(context).toString();
    final grouping =
        TimelineGrouping.values[settings.timelineGrouping.clamp(0, 2)];
    final sections = GroupTimeline.call(
      _items,
      grouping: grouping,
      locale: locale,
    );
    final indexOf = <String, int>{
      for (var i = 0; i < _items.length; i++) _items[i].id: i,
    };

    if (_items.isEmpty && _error == null) {
      return _loading
          ? Center(child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const CircularProgressIndicator(),
                const SizedBox(height: 12),
                Text(l10n.loadingLibrary),
              ],
            ))
          : const _EmptyState();
    }
    if (_error != null && _items.isEmpty) {
      return _ErrorState(message: l10n.errorLibraryLoad, onRetry: _loadNextPage);
    }

    final columns = settings.gridColumns;
    return Stack(
      children: [
        _PinchDensityLayer(
          columns: columns,
          onColumns: (next) {
            if (next == columns) return;
            ref.read(settingsProvider.notifier).setGridColumns(next);
            Haptics.light(ref);
          },
          child: CustomScrollView(
          controller: _scrollController,
          // Gesture scale (pinch) changes grid density live (§2).
          physics: const BouncingScrollPhysics(),
          slivers: [
            const SliverToBoxAdapter(child: SizedBox(height: 8)),
            for (final section in sections) ...[
              SliverPersistentHeader(
                pinned: true,
                delegate: _StickyHeaderDelegate(
                  label: _resolveHeader(section.header, l10n),
                  count: section.items.length,
                ),
              ),
              SliverGrid(
                gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: columns,
                  crossAxisSpacing: 2.5,
                  mainAxisSpacing: 2.5,
                  childAspectRatio: 1,
                ),
                delegate: SliverChildBuilderDelegate(
                  childCount: section.items.length,
                  (context, i) {
                    final item = section.items[i];
                    final globalIndex = indexOf[item.id] ?? i;
                    return GestureDetector(
                      onTap: () => _openViewer(globalIndex),
                      onLongPress: () {
                        Haptics.medium(ref);
                        // Multi-select batch mode lands in Stage 2 (viewer &
                        // selection). Long-press already gives haptic ack.
                      },
                      child: AssetThumb(item: item, size: 360),
                    );
                  },
                ),
              ),
              const SliverToBoxAdapter(child: SizedBox(height: 10)),
            ],
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.only(bottom: 110),
                child: _loading
                    ? const Center(
                        child: Padding(
                          padding: EdgeInsets.all(12),
                          child: CircularProgressIndicator(),
                        ),
                      )
                    : const SizedBox.shrink(),
              ),
            ),
            ],
          ),
        ),
        if (sections.length > 2)
          _ScrubberOverlay(
            sections: sections,
            onJump: (fraction) {
              if (!_scrollController.hasClients) return;
              final target =
                  fraction * _scrollController.position.maxScrollExtent;
              _scrollController.animateTo(
                target,
                duration: GlassTokens.durationSlow,
                curve: Curves.easeOutCubic,
              );
            },
          ),
      ],
    );
  }

  static String _resolveHeader(String header, AppLocalizations l10n) {
    if (header == GroupTimeline.todayToken) return l10n.today;
    if (header == GroupTimeline.yesterdayToken) return l10n.yesterday;
    return header;
  }
}

/// Sticky glass pill header (pinned sliver).
class _StickyHeaderDelegate extends SliverPersistentHeaderDelegate {
  const _StickyHeaderDelegate({required this.label, required this.count});

  final String label;
  final int count;

  @override
  double get minExtent => 44;
  @override
  double get maxExtent => 44;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 6, 12, 6),
      child: Align(
        alignment: Alignment.centerLeft,
        child: GlassSurface.pill(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          blur: GlassTokens.blurStrong,
          specular: false,
          parallax: false,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
              ),
              const SizedBox(width: 6),
              Text(
                '$count',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  bool shouldRebuild(_StickyHeaderDelegate oldDelegate) =>
      oldDelegate.label != label || oldDelegate.count != count;
}

/// Floating side scrubber (§2) — glass rail with month bubble while dragging.
class _ScrubberOverlay extends StatefulWidget {
  const _ScrubberOverlay({required this.sections, required this.onJump});

  final List<TimelineSection> sections;
  final ValueChanged<double> onJump;

  @override
  State<_ScrubberOverlay> createState() => _ScrubberOverlayState();
}

class _ScrubberOverlayState extends State<_ScrubberOverlay> {
  bool _dragging = false;
  double _fraction = 0;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final labelIndex =
        ((_fraction * (widget.sections.length - 1)).round()).clamp(0, widget.sections.length - 1);
    final label = widget.sections.isEmpty ? '' : widget.sections[labelIndex].header;
    return Positioned(
      right: 2,
      top: 60,
      bottom: 110,
      child: Row(
        children: [
          if (_dragging)
            Consumer(
              builder: (context, ref, _) => Padding(
                padding: const EdgeInsets.only(right: 6),
                child: GlassSurface.pill(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  child: Text(
                    label,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: scheme.onSurface,
                    ),
                  ),
                ),
              ),
            ),
          GestureDetector(
            behavior: HitTestBehavior.translucent,
            onVerticalDragStart: (d) {
              setState(() => _dragging = true);
              _update(d.globalPosition.dy, context);
            },
            onVerticalDragUpdate: (d) => _update(d.globalPosition.dy, context),
            onVerticalDragEnd: (_) => setState(() => _dragging = false),
            child: SizedBox(
              width: 18,
              child: CustomPaint(
                painter: _ScrubberPainter(
                  color: scheme.onSurfaceVariant.withValues(alpha: _dragging ? 0.7 : 0.25),
                  fraction: _dragging ? _fraction : null,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _update(double globalY, BuildContext context) {
    final box = context.findRenderObject() as RenderBox?;
    if (box == null) return;
    final local = box.globalToLocal(Offset(0, globalY)).dy;
    final size = box.size.height;
    final f = (local / size).clamp(0.0, 1.0);
    setState(() => _fraction = f);
    widget.onJump(f);
  }
}

class _ScrubberPainter extends CustomPainter {
  const _ScrubberPainter({required this.color, this.fraction});

  final Color color;
  final double? fraction;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = color;
    final track = RRect.fromRectAndRadius(
      Rect.fromCenter(
        center: Offset(size.width - 5, size.height / 2),
        width: 3.5,
        height: size.height * 0.92,
      ),
      const Radius.circular(2),
    );
    canvas.drawRRect(track, paint);
    final f = fraction;
    if (f != null) {
      final knob = Offset(
        size.width - 5,
        size.height * 0.04 + f * size.height * 0.92,
      );
      canvas.drawCircle(knob, 6, paint);
    }
  }

  @override
  bool shouldRepaint(_ScrubberPainter oldDelegate) =>
      oldDelegate.color != color || oldDelegate.fraction != fraction;
}

/// Two-finger pinch over the grid changes column count live (§2).
/// Implemented with a [Listener] (pointer events) rather than a
/// GestureDetector so single-finger scroll and cell taps are never stolen
/// from the arena — only true 2+ pointer gestures affect density.
class _PinchDensityLayer extends StatefulWidget {
  const _PinchDensityLayer({
    required this.columns,
    required this.onColumns,
    required this.child,
  });

  final int columns;
  final ValueChanged<int> onColumns;
  final Widget child;

  @override
  State<_PinchDensityLayer> createState() => _PinchDensityLayerState();
}

class _PinchDensityLayerState extends State<_PinchDensityLayer> {
  final Map<int, Offset> _pointers = {};
  double? _startDistance;
  int? _startColumns;

  @override
  Widget build(BuildContext context) {
    return Listener(
      behavior: HitTestBehavior.translucent,
      onPointerDown: (e) {
        _pointers[e.pointer] = e.position;
        if (_pointers.length == 2) {
          _startDistance = _distance();
          _startColumns = widget.columns;
        }
      },
      onPointerMove: (e) {
        if (!_pointers.containsKey(e.pointer)) return;
        _pointers[e.pointer] = e.position;
        final start = _startDistance;
        final baseCols = _startColumns;
        if (_pointers.length == 2 && start != null && start > 30 && baseCols != null) {
          final scale = _distance() / start;
          final next = (baseCols * scale).round().clamp(2, 8);
          if (next != widget.columns) widget.onColumns(next);
        }
      },
      onPointerUp: (e) {
        _pointers.remove(e.pointer);
        if (_pointers.length < 2) {
          _startDistance = null;
          _startColumns = null;
        }
      },
      onPointerCancel: (e) => _pointers.remove(e.pointer),
      child: widget.child,
    );
  }

  double _distance() {
    final pts = _pointers.values.toList();
    return (pts[0] - pts[1]).distance;
  }
}

class _EmptyState extends ConsumerWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.photo_library_outlined, size: 44),
          const SizedBox(height: 10),
          Text(l10n.emptyLibrary, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 4),
          Text(l10n.emptyLibraryHint, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, this.onRetry});

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline, size: 40),
          const SizedBox(height: 8),
          Text(message),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh_rounded, size: 18),
            label: Text(l10n.actionRetry),
          ),
        ],
      ),
    );
  }
}
