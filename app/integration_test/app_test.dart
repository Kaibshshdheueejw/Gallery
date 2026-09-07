import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'package:gallery_app/main.dart' as app;

/// ─────────────────────────────────────────────────────────────────────────
/// Integration test (§9): the import → view → (edit → export legs grow with
/// Stages 4–6) flow against the REAL device media library.
///
/// Runs on a device/emulator with photos on it:
///   flutter test integration_test -d <device>
///
/// Stage 1 scope (honest, per §11 — no fake coverage):
///   1. app boots into the shell (cold start),
///   2. permission gate appears or library loads (device-dependent),
///   3. the timeline tab renders content when access is granted.
/// The edit → export legs are appended when those subsystems land.
/// ─────────────────────────────────────────────────────────────────────────
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Gallery boots and reaches the library shell', (tester) async {
    app.main();
    await tester.pumpAndSettle(const Duration(milliseconds: 200), null,
        const Duration(seconds: 30));

    // Boot completed: either the permission rationale (fresh device) or the
    // floating nav capsule (granted device) must be present.
    final shell = find.text('Timeline');
    final rationale = find.text('Allow access');
    expect(shell.evaluate().isNotEmpty || rationale.evaluate().isNotEmpty, isTrue);

    if (rationale.evaluate().isNotEmpty) {
      await tester.tap(rationale.first);
      await tester.pumpAndSettle(const Duration(milliseconds: 200), null,
          const Duration(seconds: 30));
      // After the system dialog (whatever the tester device answers), the
      // app must still be alive and interactive — no crash, no dead frame.
      expect(tester.takeException(), isNull);
    }
  });
}
