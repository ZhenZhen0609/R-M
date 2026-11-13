#!/usr/bin/env bash
# Builds a signed release APK into dist/ and writes dist/version.json for in-app updates.
# Version number and release notes come from www/js/version.js — bump them there before building.
# Android's build tools fail on the "&" in this folder's name, so the project is
# copied to a staging folder with a plain path and built there.
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
TOOLS="/c/Users/zhenz/android-dev"
STAGE="$TOOLS/build/rmlist"

export JAVA_HOME="C:\\Users\\zhenz\\android-dev\\jdk21"
export ANDROID_HOME="C:\\Users\\zhenz\\android-dev\\sdk"

cd "$SRC"
# Read version from www/js/version.js and stamp it into the Android build.
read -r VERSION CODE < <(node -e '
  global.window = {}; require("./www/js/version.js");
  const v = window.RM_VERSION; console.log(v.version, v.code);')
sed -i -E "s/versionCode [0-9]+/versionCode $CODE/; s/versionName \"[^\"]*\"/versionName \"$VERSION\"/" android/app/build.gradle
echo "Building R&M $VERSION (code $CODE)"

echo "Syncing web files into the Android project..."
node node_modules/@capacitor/cli/bin/capacitor sync android > /dev/null

echo "Staging project..."
rm -rf "$STAGE"
mkdir -p "$STAGE"
cp -r www node_modules package.json capacitor.config.json "$STAGE/"
mkdir -p "$STAGE/android"
find android -mindepth 1 -maxdepth 1 ! -name build ! -name .gradle ! -name build-log.txt \
  -exec cp -r {} "$STAGE/android/" \;
rm -rf "$STAGE/android/app/build" "$STAGE/android/capacitor-cordova-android-plugins/build"

echo "Building APK (takes a few minutes)..."
cd "$STAGE/android"
LOG="$SRC/build-log.txt"
"$TOOLS/jdk21/bin/java" -Dfile.encoding=UTF-8 -Dorg.gradle.appname=gradlew \
  -classpath gradle/wrapper/gradle-wrapper.jar org.gradle.wrapper.GradleWrapperMain \
  assembleRelease --console=plain > "$LOG" 2>&1 || {
    echo "Build failed. Last lines of the log:"; grep -vE "^> Task|^$" "$LOG" | tail -25; exit 1; }

APK="RM-$VERSION.apk"
mkdir -p "$SRC/dist"
cp app/build/outputs/apk/release/app-release.apk "$SRC/dist/$APK"
rm -f "$LOG"

# Update manifest read by the app's "check for updates".
cd "$SRC"
node -e '
  global.window = {}; require("./www/js/version.js");
  const v = window.RM_VERSION, r = v.releases[0] || { notes: [] };
  require("fs").writeFileSync("dist/version.json",
    JSON.stringify({ version: v.version, code: v.code, apk: process.argv[1], notes: r.notes }, null, 2) + "\n");
' "$APK"
echo "Done: dist/$APK"
echo "To update your phone: run  node tools/update-server.js  and tap 'check for updates' in the app."
