# Android Native App (Go + Gio) - Tool Installation & Setup Guide

This guide covers setting up the development and build environment for compiling the **Go + Gio (`gioui.org`)** native Android application using **`gogio`**.

---

## 1. Prerequisites (Available on this machine)

- **Go**: `1.27.3` (installed via mise at `~/.local/share/mise/installs/go/1.27.3/bin/go`)
- **mise**: `/usr/bin/mise` (v2026.9.14)
- **Java (JDK)**: `/opt/phpstorm/jbr/bin/java` (or OpenJDK)
- **adb**: `/usr/bin/adb`
- **curl, git, unzip**: installed

---

## 2. Tooling Installation

### 2.1 Install `gogio`
`gogio` is the Gio packaging tool that compiles Go code and packages it into Android APKs/AABs or AAR libraries.

```bash
go install gioui.org/cmd/gogio@latest
```
Ensure `~/go/bin` is in your `PATH`:
```bash
export PATH=$PATH:$(go env GOPATH)/bin
```

### 2.2 Install Android SDK & NDK
Gio builds native shared libraries (`.so`) for Android via Cgo, requiring both the Android SDK and the Android NDK.

Option A: Via `mise`
```bash
mise plugin install android-sdk
mise install android-sdk@latest
```

Option B: Using `sdkmanager` (or existing Android Studio / Arch packages)
```bash
# Set Android SDK path
export ANDROID_HOME=~/Android/Sdk
export ANDROID_SDK_ROOT=$ANDROID_HOME

# Install required components
sdkmanager --licenses
sdkmanager "platform-tools"
sdkmanager "platforms;android-34"
sdkmanager "build-tools;35.0.0"
sdkmanager "ndk;26.1.10909125"  # NDK is required for gogio Cgo cross-compilation

export ANDROID_NDK_HOME=$ANDROID_HOME/ndk/26.1.10909125
```

---

## 3. Environment Variables Configuration

Add the following to your `~/.bashrc` or `~/.zshrc`:

```bash
# Go Path
export GOPATH=$(go env GOPATH)
export PATH=$PATH:$GOPATH/bin

# Android SDK & NDK
export ANDROID_HOME=~/Android/Sdk
export ANDROID_SDK_ROOT=$ANDROID_HOME
export ANDROID_NDK_HOME=$ANDROID_HOME/ndk/26.1.10909125

export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
```

---

## 4. Verification

Verify that all tools are operational:

```bash
# Check Go & gogio
go version
gogio -help

# Check Android SDK & NDK
adb version
echo $ANDROID_HOME
echo $ANDROID_NDK_HOME
```

---

## 5. Building the Native App

Once the Go code is set up in `android/`:

```bash
cd android

# Build debug APK for Android (ARM64 and ARMv7)
gogio -target android \
      -appid com.lerd.vrplayer \
      -minsdk 24 \
      -targetsdk 34 \
      -arch arm64,arm \
      -o vrplayer.apk \
      ./cmd/vrplayer

# Install onto connected phone or VR headset
adb install -r vrplayer.apk

# Launch app
adb shell am start -n com.lerd.vrplayer/org.gioui.GioActivity
```
