# VR Player: Dual-Platform (Go/Gio Native Android + Web) Implementation Plan

## Project Overview

Build and maintain a high-performance, mobile-friendly 3D to 2D VR video player supporting SBS (Side-by-Side) 360°, 180°, and flat videos across two complementary platforms:

1. **Android Native App (`android/`)**: Built in **Go** using **Gio UI (`gioui.org`)**, compiled and packaged via **`gogio` (`gioui.org/cmd/gogio`)**. Delivers hardware-accelerated video decoding (4K/8K 60fps via Android MediaCodec + `SurfaceTexture`), zero-latency head tracking (NDK `ASensorManager`), native Storage Access Framework (SAF) folder browsing, and an immediate-mode GPU user interface.
2. **Web App (`src/`)**: Built with **Vue 3 + TypeScript + Three.js + Tailwind CSS + Vite**. Provides instant browser playback, desktop support, WebXR compatibility, and zero-install link sharing.

---

## Architecture & Subsystems

```
vr-player/
├── android/                         # Go + Gio Native Android App
│   ├── cmd/
│   │   └── vrplayer/                # Main entrypoint for gogio
│   │       ├── main.go              # Gio window loop & event orchestration
│   │       ├── appicon.png          # App icon
│   │       └── AndroidManifest.xml  # Manifest overrides (GLES 3.0, WAKE_LOCK)
│   ├── pkg/
│   │   ├── appstate/                # Playback status, settings persistence
│   │   ├── ui/                      # Gio immediate-mode UI (controls, playlist, theme)
│   │   ├── render/                  # 3D Sphere, 180° Dome, Flat Plane, MVP matrix
│   │   ├── shader/                  # GLES 3.0 SBS shader (OES external texture)
│   │   ├── video/                   # Hardware MediaCodec / SurfaceTexture bridge
│   │   ├── sensor/                  # NDK ASensorManager rotation vector (Cgo)
│   │   └── storage/                 # Storage Access Framework (SAF) folder picker
│   ├── go.mod
│   └── go.sum
├── src/                             # Web App (Vue 3 + Three.js)
│   ├── App.vue
│   ├── components/
│   │   ├── Player/                  # VideoPlayer.vue, PortraitPlayer.vue
│   │   └── UI/                      # Controls.vue, Sidebar.vue, FloatingOverlay.vue
│   └── hooks/                       # useFileHandler.ts, useVideoPlayer.ts, useViewControls.ts
├── public/                          # Web assets
├── NATIVE_ANDROID_CONVERSION_PLAN.md # Detailed Android Native Technical Specification
└── package.json                     # Web app dependencies & scripts
```

---

## Dual-Platform Feature Parity

| Feature | Android Native (Go + Gio) | Web App (Vue 3 + Three.js) |
| :--- | :--- | :--- |
| **Video Decoding** | Hardware MediaCodec (`SurfaceTexture`) | HTML5 `<video>` / browser engine |
| **3D Rendering** | Custom GLES 3.0 (Sphere/Dome/Plane) | Three.js WebGL (Sphere/Plane) |
| **SBS Modes** | Horizontal, Vertical, Invert Eye | Horizontal, Vertical, Invert Eye |
| **View Modes** | 360° Sphere, 180° Dome, Flat 2D, Portrait | 360° Sphere, 180° Dome, Flat 2D, Portrait |
| **Orientation / Gyro** | NDK `ASensorManager` (Rotation Vector) | Web `DeviceOrientationEvent` |
| **Touch Controls** | Gio `pointer.InputOp` (drag, pinch, double-tap) | Touch & pointer event listeners |
| **File Access** | SAF `ACTION_OPEN_DOCUMENT_TREE` | File System Access API + `webkitdirectory` |
| **UI Design** | Dark theme immediate-mode Gio widgets | Tailwind CSS responsive dark UI |
| **Packaging** | `gogio` APK / AAB | Vite static build (`yarn build`) / PWA |

---

## Phased Implementation Roadmap

### Phase 1: Go & Gio Android Project Foundation
- [x] Initialize `android/` Go module (`go.mod`).
- [x] Install and verify `gogio` (`go install gioui.org/cmd/gogio@latest`).
- [x] Scaffold `android/cmd/vrplayer/main.go` with minimal Gio `app.NewWindow` event loop.
- [x] Configure `AndroidManifest.xml` with required OpenGL ES 3.0 features and storage permissions.
- [x] Validate compilation with `gogio -target android -appid com.lerd.vrplayer -o test.apk ./android/cmd/vrplayer`.

### Phase 2: Hardware Video Decoding & GLES 3.0 Pipeline (Android)
- [x] Implement `android/pkg/video`: Android `SurfaceTexture` creation and JNI/Cgo bridge to `MediaPlayer` / `MediaCodec`.
- [x] Implement `android/pkg/render/glengine.go`: Setup OpenGL ES 3.0 context within Gio's rendering surface.
- [x] Implement GLSL ES 3.0 vertex & fragment shaders with `#extension GL_OES_EGL_image_external_essl3 : require`.
- [x] Implement SBS uniform logic (Horizontal SBS, Vertical SBS, stereo inversion, standard mono).
- [x] Connect `SurfaceTexture.updateTexImage()` to the render loop for zero-copy 60fps frame streaming.

### Phase 3: 3D Geometries & Camera Navigation (Android)
- [x] Implement `android/pkg/render/mesh.go`:
  - 360° Equirectangular sphere mesh (inward normals, UV coordinates).
  - 180° Dome mesh (front hemisphere).
  - 2D Flat plane mesh (with aspect-ratio matching).
- [x] Implement `android/pkg/render/matrix.go`: MVP matrix stack, Euler angles, quaternion camera rotations.
- [x] Implement MX Player gesture engine in `android/pkg/ui/gestures.go`:
  - Single-finger drag (in VR 360°/180°): Full 360° panoramic camera navigation (pitch/yaw look-around) with inertia damping.
  - Left 15% margin vertical swipe: Screen Brightness HUD (0% - 100%).
  - Right 15% margin vertical swipe: Media Volume HUD (0 - 15 + MX 200% boost).
  - Center 50% horizontal swipe (in 2D Flat mode): Fast-forward / Rewind seek preview `[+Δt (target)]`.
  - Seeking in 360° VR mode: Handled via double-tap zones (+/- 10s) and timeline scrubber so 360° drag viewing never accidentally seeks.
  - Two-finger pinch: Smooth zoom/pan in 2D Flat mode; Camera FOV adjustment (45° - 110°) in VR mode.
  - Double-tap left/right 20%: YouTube/MX style animated ripple seek (+/- 10s).
  - Double-tap center: Play / Pause toggle.
  - Long-press hold: Instant 2x fast-forward preview.

### Phase 4: Head Tracking & Sensor Fusion (Android)
- [x] Implement `android/pkg/sensor/sensor_android.go`: Cgo integration with NDK `<android/sensor.h>`.
- [x] Subscribe to `ASENSOR_TYPE_ROTATION_VECTOR` at 100Hz without Java GC pauses.
- [x] Implement sensor offset calibration (reference point reset when user touches screen or presses "Reset View").
- [x] Implement quaternion slerp/damping filter to eliminate jitter.
- [x] Handle orientation locking via JNI call to `Activity.setRequestedOrientation`.

### Phase 5: Direct MX Player UI & Gesture Engine (No Throwaway UI)
- [x] Implement cinema dark theme and custom Gio immediate-mode widgets in `android/pkg/ui/theme.go`.
- [x] Build MX Player OSD (`pkg/ui/overlay.go`) directly in final form (3.5s auto-hide fade):
  - **Top Bar**: Back button, Marquee auto-scrolling title, `[HW]` decoder badge, Audio track popup, Subtitle selector, Screen Lock toggle, Settings gear.
  - **Tactile Scrubber**: Thin timeline expanding on touch, buffered range indicator, draggable thumb with timestamp preview bubble, elapsed time vs remaining countdown.
  - **Transport**: Prev, -10s, Large Center Play/Pause, +10s, Next, Repeat mode.
  - **Utility Bar**: Aspect ratio cycler (`Fit`, `Stretch`, `Crop`, `100%`), Playback speed popup (`0.5x` - `2.0x`), Fullscreen toggle.
- [x] Implement MX Player Screen Lock (`pkg/ui/lock.go`):
  - Complete gesture & touch isolation during viewing.
  - Subtle floating lock badge with double-tap unlock security.
- [x] Build Floating VR & Stereoscopic Quick-Bar (`pkg/ui/vrbar.go`):
  - One-tap toggle between MX 2D Flat mode, 360° Sphere, 180° Dome, and Curved Cinema.
  - Stereoscopic chips: Mono 2D, SBS Horizontal, SBS Vertical, Swap Eyes (Invert).
  - Recenter View button (`🎯`) to instantly realign VR camera heading.

### Phase 6: SAF & MX Player Folder Explorer (`pkg/ui/explorer.go` + `pkg/storage/`)
- [x] Implement `android/pkg/storage/saf_android.go`: Launch `ACTION_OPEN_DOCUMENT_TREE` with `FLAG_GRANT_PERSISTABLE_URI_PERMISSION`.
- [x] Traverse directory tree with `DocumentsContract` to index video files.
- [x] Extract duration, resolution, and thumbnail frames using `MediaMetadataRetriever`.
- [x] Build MX Player Folder Explorer (`pkg/ui/explorer.go`):
  - **Folder-First View**: Directories with video counts and `[NEW]` badges.
  - **Inside Folder View**: Video cards with thumbnails, duration pills, specs badges (`4K`, `60fps`, `SBS`), and watched progress lines.
  - **Resume Dialog**: "Resume playback from 14:32? [Resume] [Start Over]" with position persistence in config.
  - Real-time debounced search and sorting (Name, Date, Length, Size).
- [x] Pass file descriptors (`ParcelFileDescriptor.getFd()`) directly to hardware decoder.

### Phase 7: Web Application Maintenance & File Selection Fix
- [x] Fix file input in `src/hooks/useFileHandler.ts`:
  - Implement modern `showDirectoryPicker()` (Chrome/Edge/Brave).
  - Enhance fallback for `<input type="file" webkitdirectory>` with proper video MIME filtering.
  - Add text input option for local paths if running in local server mode.
- [x] Verify SBS shader parity with native shaders (ensure identical stereo offset logic).
- [x] Verify mobile drawer and touch controls on mobile browsers.

### Phase 8: Testing, Verification & Release
- [x] Validate `gogio` APK packaging for ARM64 and ARMv7 architectures.
- [x] Test playback on physical Android phones and VR headsets (Oculus Quest / Pico via ADB).
- [x] Verify 4K 60fps HEVC SBS video performance (frame drops, battery, thermals).
- [x] Test web app deployment to GitHub Pages / static CDN.

---

## Tooling & Environment Setup

### Android Native Build Prerequisites
```bash
# Go installation (already installed: Go 1.27.3)
go version

# Install gogio CLI tool
go install gioui.org/cmd/gogio@latest

# Ensure Android SDK and NDK are installed and environment variables set
export ANDROID_HOME=~/Android/Sdk
export ANDROID_NDK_HOME=$ANDROID_HOME/ndk/<version>
export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin

# Build Android APK
cd android
gogio -target android -appid com.lerd.vrplayer -minsdk 24 -targetsdk 34 -o vrplayer.apk ./cmd/vrplayer
```

### Web App Development
```bash
# Run web development server
yarn dev

# Build web application for production
yarn build
```
