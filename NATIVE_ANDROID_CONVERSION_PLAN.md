# Native Android VR Video Player (Go + Gio UI) Specification & Plan

## Architecture Overview: Dual-Platform Strategy

This project delivers a **high-performance, mobile-friendly 3D/2D VR video player** across two complementary platforms:

1. **Android Native Application (`android/`)**: Built in **Go** using **Gio UI (`gioui.org`)**, compiled and packaged via **`gogio` (`gioui.org/cmd/gogio`)**. Delivers hardware-accelerated 4K/8K 60fps video decoding via Android MediaCodec/SurfaceTexture, zero-GC-lag head tracking via NDK `ASensorManager`, native Storage Access Framework (SAF) folder browsing, and an immediate-mode GPU user interface.
2. **Web Application (`src/`)**: Built with **Vue 3 + Vite + Three.js + Tailwind CSS**. Provides instant browser access, WebXR compatibility, desktop support, and link sharing without installation.

> **Implementation Principle — Direct MX Player UI**: 
> The UI is built **directly** as the full MX Player-grade interface from day one. There is no intermediate "barebones" UI phase; all gestures, OSD controls, screen lock, folder explorer, and VR quick-switchers are implemented in their final MX Player form.

---

## 1. Subsystems Mapping: Web vs. Android Native

| Subsystem | Web App (Existing) | Android Native (Go + Gio + NDK) |
| :--- | :--- | :--- |
| **UI Framework** | Vue 3 SFC + Tailwind CSS | **Gio UI (`gioui.org`)** immediate-mode widgets (`layout.Context`, `material`, `op.Ops`) |
| **UX / Controls Model**| Web media controls & pointer events | **MX Player Gesture & OSD Engine** (Brightness, Volume 200%, Scrub HUD, Kid Lock) |
| **Media Library** | File System Access API / `<input webkitdirectory>` | **MX Player Folder-First Explorer** (SAF `ACTION_OPEN_DOCUMENT_TREE`, counts, progress lines) |
| **Graphics / 3D** | Three.js (WebGL 2.0 / Canvas) | **OpenGL ES 3.0** via Gio window context + custom sphere/dome/plane VBOs |
| **Video Decoding** | HTML5 `<video>` element | **Hardware `MediaCodec` / `MediaPlayer`** (4K/8K 60fps HEVC/H.264) |
| **Video Texture** | Three.js `VideoTexture` | **`SurfaceTexture`** bound to **`GL_TEXTURE_EXTERNAL_OES`** (zero-copy GPU buffer) |
| **SBS Shaders** | Three.js `ShaderMaterial` | **GLSL ES 3.0** shader with `#extension GL_OES_EGL_image_external_essl3 : require` |
| **Sensors / Gyro** | Web `DeviceOrientationEvent` | NDK **`<android/sensor.h>`** (`ASENSOR_TYPE_ROTATION_VECTOR`) via Cgo |
| **Settings Storage** | `localStorage` (JSON) | Persistent JSON config in app data directory (`os.UserConfigDir()`) |
| **Screen / Window** | Fullscreen API + Screen Orientation API | Android **`WindowInsets` / Immersive Mode** + `setRequestedOrientation` |
| **Packaging & Build** | Vite (`yarn build`) -> Static hosting | **`gogio`** (`gogio -target android -appid com.lerd.vrplayer`) |

---

## 2. Project Directory Structure

```
vr-player/
├── android/                         # Go + Gio Native Android App
│   ├── cmd/
│   │   └── vrplayer/
│   │       ├── main.go              # Gio app loop (app.NewWindow, event dispatch)
│   │       ├── appicon.png          # App icon for gogio packaging
│   │       └── AndroidManifest.xml  # Custom manifest overrides (permissions, GLES 3.0)
│   ├── pkg/
│   │   ├── appstate/                # Playback status, settings, resume positions schema
│   │   ├── ui/                      # Direct MX Player Immediate-Mode UI Layer
│   │   │   ├── theme.go             # Cinema dark palette, styling, typography
│   │   │   ├── overlay.go           # MX Player OSD: top bar, tactile scrubber, utility bar
│   │   │   ├── gestures.go          # MX Player gestures: brightness, volume 200%, scrub preview, pinch zoom
│   │   │   ├── vrbar.go             # Floating VR & Stereoscopic Quick Switcher
│   │   │   ├── lock.go              # MX Player Screen Lock (Kid Lock with double-tap unlock)
│   │   │   └── explorer.go          # MX Player folder-first library & video cards with progress lines
│   │   ├── render/                  # 3D Geometry and Math
│   │   │   ├── mesh.go              # 360° Sphere, 180° Dome, and Flat Plane vertex arrays
│   │   │   ├── matrix.go            # Perspective projection, LookAt, Euler & Quaternion math
│   │   │   └── glengine.go          # GLES 3.0 program compilation, VBO/VAO, render passes
│   │   ├── shader/
│   │   │   ├── sbs.vert             # Vertex shader (MVP matrix transform)
│   │   │   └── sbs.frag             # Fragment shader (OES external sampler + SBS math)
│   │   ├── video/                   # Hardware Video Playback Subsystem
│   │   │   ├── player.go            # Play, Pause, Seek, Speed, Duration, Position interface
│   │   │   ├── bridge_android.go    # JNI / Cgo binding to MediaCodec / MediaPlayer
│   │   │   └── texture_android.go   # SurfaceTexture creation & updateTexImage loop
│   │   ├── sensor/                  # Gyroscope & Motion Tracking
│   │   │   ├── sensor_android.go    # NDK ASensorManager rotation vector listener (Cgo)
│   │   │   └── tracker.go           # Quaternion smoothing, offset calibration, reset view
│   │   └── storage/                 # Storage Access Framework & File Listing
│   │       ├── saf_android.go       # SAF Intent launcher & persistable URI management
│   │       ├── scanner.go           # Recursive directory tree traversal for video files
│   │       └── metadata.go          # MediaMetadataRetriever JNI bridge (duration, resolution)
│   ├── go.mod
│   └── go.sum
├── src/                             # Web App (Vue 3 + Three.js + Tailwind)
├── AGENTS.md                        # Master Implementation Roadmap
└── package.json                     # Web app dependencies & scripts
```

---

## 3. MX Player UI & Gesture Engine Specification

The UI is built directly following MX Player's design system:

```
┌────────────────────────────────────────────────────────────────────────┐
│ [< Back]  Big_Buck_Bunny_4K_60fps.mp4      [HW]  [Audio]  [Sub]  [🔒]  │ Top Bar
├───────────────┬────────────────────────────────────────┬───────────────┤
│               │                                        │               │
│   LEFT ZONE   │              CENTER ZONE               │  RIGHT ZONE   │
│   (Left 25%)  │              (Center 50%)              │  (Right 25%)  │
│               │                                        │               │
│  ▲ Swipe Up:  │  ◄► Swipe Horizontally:                │  ▲ Swipe Up:  │
│    BRIGHTNESS │     PRECISION SEEK PREVIEW             │    VOLUME +   │
│    (0% - 100%)│     [+0:20 (04:15)]                    │    (0 - 15)   │
│               │                                        │    Boost 200% │
│  ▼ Swipe Down:│  🤏 Two-Finger Pinch:                  │               │
│    BRIGHTNESS │     ZOOM & PAN (Flat) / FOV (VR)       │  ▼ Swipe Down:│
│               │                                        │    VOLUME -   │
│               │  Double-Tap: Play / Pause              │               │
│               │  Long-Press: 2x Speed Preview          │               │
├───────────────┴────────────────────────────────────────┴───────────────┤
│   [ 360° Sphere ]    [ SBS 3D ]    [ Swap Eyes ]    [ Recenter 🎯 ]     │ VR Quick-Bar
├────────────────────────────────────────────────────────────────────────┤
│  04:15 ━━━━━━━●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 28:50 (-24:35) │ Scrubber
│                                                                        │
│  [⏮ Prev]   [⏪ -10s]   [ ▶ PLAY / PAUSE ]   [⏩ +10s]   [⏭ Next]   [🔁] │ Transport
│                                                                        │
│  [📁 Folders]    [Speed: 1.0x]    [Aspect: Fit]    [Lock]    [⛶ Full]  │ Utility
└────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Mode-Aware Gesture Controls (`pkg/ui/gestures.go`)

To preserve fluid **360° pan/tilt camera navigation** while retaining the MX Player gesture feel, gestures are mode-aware:

#### In 360° / 180° VR Mode:
- **Single-Finger Drag (Anywhere in Viewport)**: **Primary 360° Panoramic Look-Around**. Smoothly rotates camera pitch (tilt up/down) and yaw (pan 360° around) with inertia damping.
- **Left Edge (15% Margin) Vertical Swipe**: Screen Brightness HUD slider (`☀ 75%`).
- **Right Edge (15% Margin) Vertical Swipe**: Media Volume HUD slider (`🔊 12`) with MX **200% software volume boost**.
- **Seeking in 360° Mode**: Dedicated to **Double-Tap Left/Right (10s ripple seek)** and the **Tactile Timeline Scrubber**. This ensures single-finger drag is 100% reserved for 360° camera viewing without accidental seek jumps while exploring the scene!
- **Two-Finger Pinch**: Dynamic camera **Field of View (FOV)** adjustment (45° to 110° zoom in/out).
- **Double-Tap Center**: Instant Play / Pause toggle.
- **Long-Press & Hold**: Instant 2x fast-forward speed boost (reverts to 1x on release).

#### In 2D Flat Mode (Standard MX Player Behavior):
- **Horizontal Swipe across Center**: Classic MX Player precision seek preview badge: `[ +0:45 ] 14:20 / 45:30`.
- **Single-Finger Drag**: Panning the zoomed video frame.
- **Two-Finger Pinch**: Video frame scaling (50% to 400%). Double-tap cycles `Fit`, `Crop`, `100%`, `Stretch`.

### 3.2 OSD & HUD Layout (`pkg/ui/overlay.go`)
- **Auto-Hide Engine**: Smooth alpha fade out after **3.5 seconds** of inactivity; pauses while dragging.
- **Top Bar**:
  - Back navigation button `<`.
  - Marquee video title with smooth auto-scrolling for long filenames.
  - `[HW]` hardware decoder pill (MediaCodec active).
  - Audio track selector popup.
  - Subtitle selector popup (`[Sub]`).
  - Screen Lock button (`[🔒]`).
  - Settings gear (`[⚙]`).
- **Tactile Scrubber**:
  - Thin timeline expanding into a thick draggable bar on touch.
  - White buffered cache range bar + blue playback progress bar.
  - Drag thumb with floating timestamp preview bubble.
  - Current elapsed time on left, remaining countdown on right (`-24:35`).
- **Transport Bar**:
  - Prev, -10s, Large Center Play/Pause (64×64dp), +10s, Next, Repeat mode.
- **Bottom Utility Bar**:
  - Folder Explorer button (`📁`).
  - Playback Speed chip (`0.5x`, `0.75x`, `1.0x`, `1.25x`, `1.5x`, `2.0x`).
  - Aspect Ratio cycler (`Fit`, `Stretch`, `Crop`, `100%`).
  - Fullscreen immersive toggle (`IMMERSIVE_STICKY`).

### 3.3 Screen Lock (Kid Lock) (`pkg/ui/lock.go`)
- Engaged via the lock icon (`🔒`).
- Disables all gestures and touch inputs during viewing.
- Displays a subtle floating lock badge upon touch; double-tap on the lock badge unlocks the player.

### 3.4 Floating VR Quick-Bar (`pkg/ui/vrbar.go`)
A single-tap floating bar positioned above the scrubber:
- **Projection Modes**: `Flat 2D` | `360° Sphere` | `180° Dome` | `Curved Cinema`.
- **Stereo Formats**: `Mono 2D` | `SBS Horizontal` | `Top/Bottom` | `Swap Eyes (Invert)`.
- **Recenter View (🎯)**: Re-aligns camera yaw/pitch heading to current physical posture.

### 3.5 MX Player Folder & Media Explorer (`pkg/ui/explorer.go`)
- **Folder-First Navigation**:
  ```
  📁 Camera (24)
  📁 Downloads (8)
  📁 VR 360 Experiences (15)  [NEW]
  📁 3D Movies (4)
  ```
- **Folder Cards**: Video counts and highlighted `[NEW]` badge on folders with unplayed content.
- **Inside Folders**: Video cards with extracted thumbnails, duration pills (`08:42`), specs badges (`4K`, `60fps`, `SBS`), and **blue watched progress lines**.
- **Resume Dialog**:
  > *"Resume from 14:32?"*
  > `[ RESUME ]`    `[ START OVER ]`
- **Real-Time Search & Sorting**: Instant search filter; sort by Name, Date, Duration, or Size.

---

## 4. Hardware Video Decoding & Rendering Engine

VR videos (4K/8K 60fps) are decoded directly on dedicated hardware DSPs and streamed to the GPU without CPU copying:

```
[ Local File / SAF URI ]
           │
           ▼
[ Android MediaCodec / MediaPlayer ] (Hardware Video Decoder)
           │
           ▼
 [ Android Surface / SurfaceTexture ]
           │
           ▼
[ SurfaceTexture.updateTexImage() ]
           │
           ▼
[ GL_TEXTURE_EXTERNAL_OES ] (Zero-Copy GPU Buffer)
           │
           ▼
[ GLES 3.0 Fragment Shader ] (SBS Eye Splitting + Equirectangular mapping)
           │
           ▼
[ 3D Sphere / Dome / Flat Mesh ]
```

### 4.1 Fragment Shader (GLSL ES 3.0 with OES Extension)
```glsl
#version 300 es
#extension GL_OES_EGL_image_external_essl3 : require

precision highp float;

uniform samplerExternalOES uTexture;
uniform float uIsSBS;         // 1.0 = SBS enabled, 0.0 = standard mono
uniform float uSBSFormat;      // 0.0 = Horizontal (Left/Right), 1.0 = Vertical (Top/Bottom)
uniform float uInvertStereo;   // 0.0 = Left Eye, 1.0 = Right Eye

in vec2 vUv;
out vec4 fragColor;

void main() {
    vec2 uv = vUv;
    if (uIsSBS > 0.5) {
        float offset = uInvertStereo > 0.5 ? 0.5 : 0.0;
        if (uSBSFormat < 0.5) {
            uv.x = uv.x * 0.5 + offset;
        } else {
            uv.y = uv.y * 0.5 + offset;
        }
    }
    fragColor = texture(uTexture, uv);
}
```

### 4.2 Vertex Shader (GLSL ES 3.0)
```glsl
#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec2 aTexCoord;

uniform mat4 uMVPMatrix;
out vec2 vUv;

void main() {
    vUv = aTexCoord;
    gl_Position = uMVPMatrix * vec4(aPosition, 1.0);
}
```

---

## 5. Motion Tracking & Sensor Fusion (NDK Cgo)

Direct NDK integration with `<android/sensor.h>` provides 100–200Hz orientation tracking with zero Java garbage collection pauses:

```go
package sensor

/*
#cgo LDFLAGS: -landroid
#include <android/sensor.h>
#include <stdlib.h>

static ASensorEventQueue* setupSensorQueue(ALooper* looper, int ident) {
    ASensorManager* sm = ASensorManager_getInstance();
    const ASensor* sensor = ASensorManager_getDefaultSensor(sm, ASENSOR_TYPE_ROTATION_VECTOR);
    if (!sensor) return NULL;
    ASensorEventQueue* queue = ASensorManager_createEventQueue(sm, looper, ident, NULL, NULL);
    ASensorEventQueue_enableSensor(queue, sensor);
    ASensorEventQueue_setEventRate(queue, sensor, 10000); // 100Hz
    return queue;
}
*/
import "C"
```

---

## 6. Storage Access Framework (SAF)

- Launch `Intent.ACTION_OPEN_DOCUMENT_TREE` with `FLAG_GRANT_PERSISTABLE_URI_PERMISSION`.
- Store persistable URI in config (`takePersistableUriPermission`).
- Walk directory tree using `DocumentsContract` to extract video files.
- Query duration and resolution using `MediaMetadataRetriever`.
- Pass file descriptors (`ParcelFileDescriptor.getFd()`) to MediaCodec.

---

## 7. Packaging & Distribution with `gogio`

```bash
# Compile and package native Android APK
gogio -target android \
      -appid com.lerd.vrplayer \
      -minsdk 24 \
      -targetsdk 34 \
      -arch arm64,arm \
      -o vrplayer.apk \
      ./android/cmd/vrplayer

# Install and launch via ADB
adb install -r vrplayer.apk
adb shell am start -n com.lerd.vrplayer/org.gioui.GioActivity
```

---

## 8. Web Application Parity (`src/`)

The web app is aligned to the identical MX Player UI and gesture model:
- Implement `showDirectoryPicker()` with `<input webkitdirectory>` fallback.
- MX Player-style touch gestures in Vue (brightness, volume, horizontal scrub preview).
- Shared SBS shader math and dark cinema aesthetic.
