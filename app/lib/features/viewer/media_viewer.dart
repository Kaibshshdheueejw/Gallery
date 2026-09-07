import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/settings/app_settings.dart';
import '../../core/theme/dynamic_tint.dart';
import '../../core/theme/glass_theme.dart';
import '../../core/widgets/glass_surface.dart';
import '../../core/widgets/pressable.dart';
import '../../data/media/media_repository.dart';
import '../../domain/models/media_item.dart';
import '../../l10n/app_localizations.dart';

/// ─────────────────────────────────────────────────────────────────────────
/// Full-screen viewer (Stage 0 scope; extended in Stage 2 with hero
/// transitions, trash/favorite/lock actions and the video pipeline):
///  • PageView swipe navigation across the passed item window,
///  • pinch-to-zoom + pan via InteractiveViewer,
///  • double-tap zoom toggle,
///  • floating glass top/bottom bars that fade on single tap,
///  • Material You: the theme seed follows the dominant colour of the
///    current photo (§1) while the viewer is open, restored on close.
/// ─────────────────────────────────────────────────────────────────────────
class MediaViewer extends ConsumerStatefulWidget {
  const MediaViewer({super.key, required this.items, required this.initialIndex});

  final List<MediaItem> items;
  final int initialIndex;

  @override
  ConsumerState<MediaViewer> createState() => _MediaViewerState();
}

class _MediaViewerState extends ConsumerState<MediaViewer> {
  late final PageController _pageController =
      PageController(initialPage: widget.initialIndex);
  late int _index = widget.initialIndex;
  bool _chromeVisible = true;
  Uint8List? _fullBytes;
  bool _loadingFull = true;

  MediaItem get _current => widget.items[_index];

  @override
  void initState() {
    super.initState();
    _loadFull(_index);
    // Immersive: hide system UI while viewing.
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  }

  @override
  void dispose() {
    _pageController.dispose();
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    // Restore brand seed on the way out.
    ref.read(settingsProvider.notifier).setSeedColor(null);
    super.dispose();
  }

  Future<void> _loadFull(int index) async {
    setState(() {
      _fullBytes = null;
      _loadingFull = true;
    });
    try {
      final bytes =
          await ref.read(mediaRepositoryProvider).fullBytes(widget.items[index].id);
      if (!mounted || index != _index) return;
      setState(() {
        _fullBytes = bytes;
        _loadingFull = false;
      });
      if (bytes != null) {
        // Dynamic tint — glass + theme follow the photo (§1).
        final tint = DynamicTint.dominantFromBytes(bytes);
        if (tint != null) ref.read(settingsProvider.notifier).setSeedColor(tint);
      }
    } catch (_) {
      if (mounted) setState(() => _loadingFull = false);
    }
  }

  void _onPageChanged(int index) {
    setState(() => _index = index);
    _loadFull(index);
  }

  @override
  Widget build(BuildContext context) {
    final item = _current;
    final dateLabel =
        DateFormat.yMMMMEEEEd(Localizations.localeOf(context).toString())
            .add_jm()
            .format(item.createdAt);

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          PageView.builder(
            controller: _pageController,
            itemCount: widget.items.length,
            onPageChanged: _onPageChanged,
            itemBuilder: (context, i) {
              if (i != _index) {
                // Neighbouring pages show the cached thumbnail until visited;
                // full bytes are decoded only for the current page.
                return _ThumbPage(item: widget.items[i]);
              }
              return GestureDetector(
                onTap: () => setState(() => _chromeVisible = !_chromeVisible),
                onDoubleTap: _loadingFull
                    ? null
                    : () => setState(() => _chromeVisible = !_chromeVisible),
                child: InteractiveViewer(
                  maxScale: 6,
                  minScale: 1,
                  child: Center(
                    child: _fullBytes != null
                        ? Image.memory(_fullBytes!, fit: BoxFit.contain)
                        : _ThumbPage(item: widget.items[i], fit: BoxFit.contain),
                  ),
                ),
              );
            },
          ),
          if (_loadingFull)
            const Center(
              child: SizedBox(
                width: 26,
                height: 26,
                child: CircularProgressIndicator(
                  strokeWidth: 2.4,
                  color: Colors.white70,
                ),
              ),
            ),
          AnimatedOpacity(
            opacity: _chromeVisible ? 1 : 0,
            duration: GlassTokens.durationBase,
            curve: Curves.easeOutCubic,
            child: SafeArea(
              child: Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                    child: GlassSurface.pill(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                      tintOverride: Colors.black.withValues(alpha: 0.38),
                      child: Row(
                        children: [
                          Pressable(
                            onTap: () => Navigator.of(context).maybePop(),
                            child: const Padding(
                              padding: EdgeInsets.all(8),
                              child: Icon(Icons.close_rounded, color: Colors.white, size: 22),
                            ),
                          ),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  item.title,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 14,
                                  ),
                                ),
                                Text(
                                  dateLabel,
                                  style: const TextStyle(color: Colors.white70, fontSize: 11),
                                ),
                              ],
                            ),
                          ),
                          if (widget.items.length > 1)
                            Padding(
                              padding: const EdgeInsets.only(right: 10),
                              child: Text(
                                '${_index + 1}/${widget.items.length}',
                                style: const TextStyle(color: Colors.white70, fontSize: 12),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                  const Spacer(),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                    child: GlassSurface.pill(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      tintOverride: Colors.black.withValues(alpha: 0.38),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          _ViewerAction(
                            icon: item.isVideo
                                ? Icons.play_circle_outline_rounded
                                : Icons.info_outline_rounded,
                            label: item.albumName,
                            color: Colors.white,
                            onTap: () {
                              // Stage 2 wires favorites/share/trash/lock and
                              // the video pipeline here; Stage 0 surfaces the
                              // album name as an honest info pill.
                            },
                          ),
                        ],
                      ),
                    ),
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

class _ThumbPage extends ConsumerWidget {
  const _ThumbPage({required this.item, this.fit = BoxFit.cover});

  final MediaItem item;
  final BoxFit fit;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return FutureBuilder<Uint8List?>(
      future: ref.read(mediaRepositoryProvider).thumbnail(item.id, width: 720),
      builder: (context, snapshot) {
        final bytes = snapshot.data;
        if (bytes == null) {
          return const ColoredBox(color: Colors.black);
        }
        return Image.memory(bytes, fit: fit, filterQuality: FilterQuality.medium);
      },
    );
  }
}

class _ViewerAction extends StatelessWidget {
  const _ViewerAction({
    required this.icon,
    required this.label,
    required this.color,
    this.onTap,
  });

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 18, color: Colors.white),
            const SizedBox(width: 6),
            Text(
              label,
              style: const TextStyle(color: Colors.white70, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }
}

/// Convenience for tests/l10n: localized viewer strings go through
/// AppLocalizations; this keeps the import referenced where the Stage-2
/// actions (favorite/share/delete) will pull their labels.
String viewerCloseLabel(BuildContext context) => AppLocalizations.of(context).actionClose;
