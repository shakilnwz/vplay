#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

echo "==> Building VR Player Android APK using gogio..."

# Locate JDK (Prefer Java 17/21 from mise or environment, fallback to system)
if [ -d "$HOME/.local/share/mise/installs/java/zulu-17.70.113.0" ]; then
    export JAVA_HOME="$HOME/.local/share/mise/installs/java/zulu-17.70.113.0"
elif command -v mise >/dev/null 2>&1 && mise where java >/dev/null 2>&1; then
    export JAVA_HOME="$(mise where java)"
else
    export JAVA_HOME="${JAVA_HOME:-/opt/phpstorm/jbr}"
fi

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

GOGIO_BIN="$(which gogio 2>/dev/null || echo "$HOME/.local/share/mise/installs/go/1.27.3/bin/gogio")"

if [ ! -x "$GOGIO_BIN" ]; then
    echo "Error: 'gogio' tool not found. Run 'go install gioui.org/cmd/gogio@latest'"
    exit 1
fi

echo "Using gogio: $GOGIO_BIN"
echo "Using JAVA_HOME: $JAVA_HOME ($( "$JAVA_HOME/bin/java" -version 2>&1 | head -n 1 ))"
echo "Using ANDROID_HOME: $ANDROID_HOME"

OUT="${1:-vrplayer.apk}"
ARCH="${ARCH:-arm64}"

ARCH_ARG=()
if [ "$ARCH" != "all" ]; then
    ARCH_ARG=(-arch "$ARCH")
fi

echo "Target architecture: $ARCH"

KEYSTORE_ARG=()
if [ -f "debug.keystore" ]; then
    KEYSTORE_ARG=(-signkey "debug.keystore" -signpass "android")
fi

"$GOGIO_BIN" -target android \
    -appid com.lerd.vrplayer \
    "${ARCH_ARG[@]}" \
    "${KEYSTORE_ARG[@]}" \
    -minsdk 24 \
    -targetsdk 32 \
    -o "$OUT" \
    ./cmd/vrplayer

echo "✓ Successfully built $OUT"
ls -lh "$OUT"
