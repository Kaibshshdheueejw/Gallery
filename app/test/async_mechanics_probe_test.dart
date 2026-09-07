@Timeout(Duration(seconds: 20))
library;

import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';

/// Regression probes for the async mechanics ThumbCache relies on. These
/// pin down the exact pattern that deadlocked under fake-async zones:
/// self-removal chained via whenComplete on an awaited map-stored future.
void main() {
  testWidgets('probe: plain await chain completes', (tester) async {
    Future<String> inner() async => await Future.value('x');
    debugPrint('probe1: before');
    expect(await inner(), 'x');
    debugPrint('probe1: after');
  });

  testWidgets('probe: completer-backed in-flight dedup completes', (tester) async {
    final map = <String, Future<int>>{};
    Future<int> load(String key) async {
      final existing = map[key];
      if (existing != null) return existing;
      final c = Completer<int>();
      map[key] = c.future;
      Future.microtask(() {
        c.complete(42);
        map.remove(key);
      });
      return c.future;
    }
    debugPrint('probe2: before');
    expect(await load('k'), 42);
    expect(await load('k'), 42);
    debugPrint('probe2: after');
  });
}
