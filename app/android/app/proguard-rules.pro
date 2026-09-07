# Flutter engine defaults are applied automatically; these keeps protect
# plugin reflection surfaces used at runtime.
# ⚠ Version note (§11): revisit on every plugin major bump.

# photo_manager (com.fluttercandies)
-keep class com.fluttercandies.photo_manager.** { *; }
-dontwarn com.fluttercandies.photo_manager.**

# Keep line numbers for readable crash reports.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
