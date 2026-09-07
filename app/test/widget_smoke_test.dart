import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gallery_app/data/media/media_repository.dart';
import 'package:gallery_app/features/shell/home_shell.dart';
import 'package:gallery_app/l10n/app_localizations.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'helpers/fake_media_source.dart';

/// Widget smoke test (§9): the shell renders all four destinations through
/// the localization delegates, with a fake media source (no device/plugin).
void main() {
  testWidgets('shell shows four localized tabs and switches between them',
      (tester) async {
    SharedPreferences.setMockInitialValues({});

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          mediaSourceProvider.overrideWithValue(FakeMediaSource()),
        ],
        child: MaterialApp(
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: AppLocalizations.supportedLocales,
          home: const HomeShell(),
        ),
      ),
    );
    await tester.pumpAndSettle(const Duration(milliseconds: 100), EnginePhase.sendSemanticsUpdate, const Duration(seconds: 20));

    // Floating capsule nav labels (en locale in tests).
    expect(find.text('For you'), findsOneWidget);
    expect(find.text('Timeline'), findsOneWidget);
    expect(find.text('Albums'), findsOneWidget);
    expect(find.text('Search'), findsOneWidget);

    // Switch to Albums and back — IndexedStack keeps everything alive.
    await tester.tap(find.text('Albums'));
    await tester.pumpAndSettle(const Duration(milliseconds: 100), EnginePhase.sendSemanticsUpdate, const Duration(seconds: 20));
    await tester.tap(find.text('Timeline'));
    await tester.pumpAndSettle(const Duration(milliseconds: 100), EnginePhase.sendSemanticsUpdate, const Duration(seconds: 20));
    expect(tester.takeException(), isNull);
  });
}
