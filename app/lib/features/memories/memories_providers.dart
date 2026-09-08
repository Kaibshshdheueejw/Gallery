import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/media/media_repository.dart';
import '../../domain/models/media_item.dart';
import '../../domain/usecases/memory_engine.dart';

/// Shared sample of the library for memory computation: the most recent
/// pages already cached by the repository (up to [MemoryEngine.maxPages]
/// pages ≈ 960 items). Used by both For You and the Memories screen.
final memoryItemsProvider = FutureProvider<List<MediaItem>>((ref) async {
  final repo = ref.read(mediaRepositoryProvider);
  final items = <MediaItem>[];
  for (var page = 0; page < MemoryEngine.maxPages; page++) {
    final loaded = await repo.page(page);
    items.addAll(loaded);
    if (loaded.length < MediaRepository.pageSize) break;
  }
  return items;
});
