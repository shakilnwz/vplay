# Mobile-Friendly 3D to 2D Video Player - Implementation Plan

## Project Overview
Build a mobile-friendly 3D to 2D video player that supports SBS (Side-by-Side) 360° videos with directory-based file selection, touch controls, and gyroscope integration.

## Current State Analysis

### Existing Features
- ✅ Three.js 360° video rendering with sphere geometry
- ✅ SBS to equirectangular shader conversion (left eye only)
- ✅ Touch controls for mobile swipe navigation
- ✅ Gyroscope controls with iOS 13+ permission handling
- ✅ Mouse drag controls for desktop
- ✅ Basic video playback controls (play/pause, volume, seek)
- ✅ Responsive layout with Tailwind CSS
- ✅ File input with webkitdirectory attribute (but not working)

### Current Issues
- ❌ File chooser with `webkitdirectory` is not functioning properly
- ❌ No directory path input capability
- ❌ Limited file listing (no sorting/filtering)
- ❌ Auto-detect orientation not implemented
- ❌ No mobile-specific optimizations (orientation locking)

## Implementation Plan

### Phase 1: Fix File Selection Issues

#### Task 1.1: Fix File Input with Directory Support
**File:** `src/App.tsx:334-342`

**Current Issue:**
- File input uses `webkitdirectory` but it's not working reliably
- The `accept="all"` attribute is too broad

**Actions:**
- Replace single file input with dual approach:
  1. Directory picker using `webkitdirectory` attribute with proper event handling
  2. Alternative file picker for individual video files
- Add proper error handling for file access permissions
- Add loading state during file scanning

**Code Changes:**
```tsx
// Replace current handleFileSelect with directory-aware handler
const handleDirectorySelect = async (event) => {
    const files = Array.from(event.target.files);
    const videoFiles = files.filter(file => 
        file.type.startsWith('video/') || 
        file.name.match(/\.(mp4|webm|ogv|mov|mkv)$/i)
    );
    setVideos(videoFiles);
    if (videoFiles.length > 0 && !currentVideo) {
        loadVideo(videoFiles[0]);
    }
};
```

#### Task 1.2: Add Directory Path Input Field
**File:** `src/App.tsx` (add new state and UI)

**Actions:**
- Add text input for manual directory path entry
- Add "Scan Directory" button
- Implement file system API to read directory contents (Web File System Access API)

**New State:**
```tsx
const [directoryPath, setDirectoryPath] = useState('');
const [isScanning, setIsScanning] = useState(false);
```

**API Considerations:**
- Use `window.showDirectoryPicker()` for modern browsers (Chrome/Edge)
- Fallback to traditional file input with directory support for Firefox/Safari
- Note: File System Access API is Chrome-only, need graceful degradation

### Phase 2: Enhanced File Management

#### Task 2.1: Implement File Sorting
**File:** `src/App.tsx` (new state and functions)

**Actions:**
- Add sort state: `sortOrder` ('name', 'size', 'date', 'duration')
- Add sort direction: `sortDirection` ('asc', 'desc')
- Create `sortVideos` utility function

**Code Structure:**
```tsx
const [sortOrder, setSortOrder] = useState('name');
const [sortDirection, setSortDirection] = useState('asc');

const sortVideos = (videos, order, direction) => {
    return [...videos].sort((a, b) => {
        // Sort logic based on order
    });
};
```

#### Task 2.2: Implement File Filtering
**File:** `src/App.tsx` (new state and functions)

**Actions:**
- Add filter state: `filterQuery` (search string)
- Add extension filter: `filterExtension` ('all', 'mp4', 'webm', etc.)
- Create `filterVideos` utility function

**New State:**
```tsx
const [filterQuery, setFilterQuery] = useState('');
const [filterExtension, setFilterExtension] = useState('all');
```

#### Task 2.3: Add File Metadata Extraction
**File:** `src/App.tsx` (new utility)

**Actions:**
- Extract video duration on load
- Extract video resolution
- Cache metadata for better performance

**Code:**
```tsx
const extractVideoMetadata = async (file) => {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
            resolve({
                duration: video.duration,
                width: video.videoWidth,
                height: video.videoHeight
            });
            URL.revokeObjectURL(video.src);
        };
        video.src = URL.createObjectURL(file);
    });
};
```

### Phase 3: Mobile Optimization

#### Task 3.1: Auto-Detect Device Orientation
**File:** `src/App.tsx` (new state and useEffect)

**Actions:**
- Add state to track current orientation
- Listen to `resize` and `orientationchange` events
- Adjust camera FOV and sphere radius based on orientation
- Optimize touch interaction areas

**Code Structure:**
```tsx
const [orientation, setOrientation] = useState('portrait');

useEffect(() => {
    const updateOrientation = () => {
        setOrientation(window.innerWidth > window.innerHeight ? 'landscape' : 'portrait');
    };
    
    updateOrientation();
    window.addEventListener('resize', updateOrientation);
    window.addEventListener('orientationchange', updateOrientation);
    
    return () => {
        window.removeEventListener('resize', updateOrientation);
        window.removeEventListener('orientationchange', updateOrientation);
    };
}, []);
```

#### Task 3.2: Add Orientation Lock Option
**File:** `src/App.tsx` (new button and Screen Orientation API)

**Actions:**
- Add toggle button for orientation lock
- Use Screen Orientation API (`screen.orientation.lock()`)
- Handle API not supported (fallback to CSS transform)

**Code:**
```tsx
const toggleOrientationLock = async () => {
    try {
        await screen.orientation.lock('landscape');
    } catch (error) {
        console.log('Orientation lock not supported or denied');
    }
};
```

#### Task 3.3: Mobile UI Enhancements
**File:** `src/App.tsx` (CSS and layout changes)

**Actions:**
- Make sidebar collapsible on mobile (drawer pattern)
- Increase touch target sizes (minimum 44x44px)
- Add mobile-specific control bar at bottom
- Hide non-essential controls on small screens
- Add gesture hints overlay

**Layout Changes:**
```tsx
// Mobile-responsive sidebar
<div className={`${isMobile ? 'fixed inset-0 z-50 transform' : 'w-80'} ...`}>
```

### Phase 4: Video Player Enhancements

#### Task 4.1: Improve SBS Shader
**File:** `src/App.tsx:73-100` (ShaderMaterial)

**Current Issue:**
- Only extracts left eye
- No support for different SBS formats (horizontal vs vertical)
- No aspect ratio correction

**Actions:**
- Add uniform for SBS format (horizontal vs vertical)
- Add aspect ratio correction
- Improve edge handling

**Enhanced Shader:**
```glsl
uniform sampler2D map;
uniform float isSBS;
uniform float sbsFormat; // 0 = horizontal, 1 = vertical
varying vec2 vUv;

void main() {
    vec2 uv = vUv;
    if (isSBS > 0.5) {
        if (sbsFormat < 0.5) {
            // Horizontal SBS - take left half
            uv.x = uv.x * 0.5;
        } else {
            // Vertical SBS - take top half
            uv.y = uv.y * 0.5;
        }
    }
    gl_FragColor = texture2D(map, uv);
}
```

#### Task 4.2: Add View Mode Toggle
**File:** `src/App.tsx` (already has `viewMode` state, needs implementation)

**Actions:**
- Implement 'flat' mode (2D view)
- Switch between 360° sphere and flat video plane
- Add UI toggle button

**Code Structure:**
```tsx
// Update sphere geometry based on view mode
useEffect(() => {
    if (viewMode === 'flat' && sphereRef.current) {
        // Switch to plane geometry
    } else {
        // Use sphere geometry
    }
}, [viewMode]);
```

#### Task 4.3: Add Playback Speed Control
**File:** `src/App.tsx` (new state and controls)

**Actions:**
- Add playback speed state: `playbackSpeed` (0.25, 0.5, 0.75, 1, 1.25, 1.5, 2)
- Add speed control UI (dropdown or buttons)
- Update video element playbackRate

### Phase 5: Performance & UX Improvements

#### Task 5.1: Add Loading States
**File:** `src/App.tsx` (new state and UI)

**Actions:**
- Add `isLoadingVideo` state
- Show spinner overlay during video loading
- Add progress indicator for directory scanning

#### Task 5.2: Add Error Handling
**File:** `src/App.tsx` (new state and error UI)

**Actions:**
- Add `error` state
- Catch video loading errors
- Display user-friendly error messages
- Add retry button

**Code:**
```tsx
const [error, setError] = useState(null);

const handleVideoError = (e) => {
    setError('Failed to load video. Please try another file.');
    setIsPlaying(false);
};
```

#### Task 5.3: Add Keyboard Shortcuts
**File:** `src/App.tsx` (new useEffect)

**Actions:**
- Space: Play/Pause
- Arrow keys: Seek
- M: Mute/Unmute
- F: Fullscreen
- S: Toggle view mode (360/flat)

#### Task 5.4: Add Fullscreen Support
**File:** `src/App.tsx` (new button and API)

**Actions:**
- Add fullscreen button
- Use Fullscreen API
- Handle fullscreen change events

### Phase 6: Testing & Refinement

#### Task 6.1: Test on Different Devices
- Desktop browsers: Chrome, Firefox, Safari, Edge
- Mobile browsers: Chrome Mobile, Safari iOS, Samsung Internet
- Test touch interactions
- Test gyroscope permissions on iOS

#### Task 6.2: Test Video Formats
- Test various SBS videos (different resolutions)
- Test large video files
- Test video files with different codecs

#### Task 6.3: Performance Optimization
- Profile Three.js rendering
- Optimize sphere geometry segment count based on device capability
- Implement LOD (Level of Detail) if needed

#### Task 6.4: Accessibility
- Add ARIA labels to controls
- Ensure keyboard navigation works
- Add screen reader support for video list

## File Structure After Implementation

```
src/
├── components/
│   ├── VideoPlayer.tsx      # Extract video player logic
│   ├── VideoList.tsx        # File list component
│   ├── Controls.tsx         # Playback controls
│   └── Sidebar.tsx          # Collapsible sidebar
├── utils/
│   ├── fileUtils.ts         # File handling utilities
│   ├── videoUtils.ts        # Video metadata extraction
│   └── sortUtils.ts         # Sorting/filtering logic
├── hooks/
│   ├── useGyroscope.ts      # Gyroscope hook
│   ├── useVideoControls.ts  # Video controls hook
│   └── useFilePicker.ts     # File picker hook
├── types/
│   └── index.ts             # TypeScript definitions
├── App.tsx                  # Main app (simplified)
├── main.tsx
└── index.css
```

## Dependencies to Consider Adding

- `file-saver` - For saving preferences/settings
- `idb` - IndexedDB wrapper for caching video metadata
- `use-gesture` - Advanced gesture handling (optional)

## Browser Compatibility Notes

### File System Access API
- ✅ Chrome 86+, Edge 86+
- ❌ Firefox (not supported, use fallback)
- ❌ Safari (not supported, use fallback)

### Screen Orientation API
- ✅ Chrome 38+, Edge 38+
- ⚠️ Safari 16.4+ (partial support)
- ❌ Firefox (no support on mobile)

### DeviceOrientation API
- ⚠️ Requires HTTPS
- ⚠️ iOS 13+ requires user permission trigger
- ✅ Most modern mobile browsers support

## Known Limitations

1. **File System Access API** is Chrome-only - graceful degradation required
2. **Gyroscope** requires HTTPS on production
3. **Large video files** may cause memory issues on mobile devices
4. **iOS** has strict autoplay policies - user interaction required first
5. **Directory scanning** can be slow for directories with many files

## Success Criteria

- ✅ User can select a directory and see all video files listed
- ✅ File list is sortable by name, size, and date
- ✅ File list is filterable by name and extension
- ✅ Video plays correctly in 360° SBS mode
- ✅ Touch controls work smoothly on mobile
- ✅ Gyroscope controls work on supported devices
- ✅ Player auto-adapts to portrait/landscape orientation
- ✅ UI is mobile-friendly with appropriate touch targets
- ✅ Error handling is robust and user-friendly
- ✅ Performance is acceptable on mid-range mobile devices

## Estimated Effort

- Phase 1: 4-6 hours
- Phase 2: 3-4 hours
- Phase 3: 4-5 hours
- Phase 4: 3-4 hours
- Phase 5: 2-3 hours
- Phase 6: 2-3 hours

**Total: 18-25 hours**

## Next Steps

1. Review and approve this plan
2. Start with Phase 1 (File Selection Fix)
3. Test each phase before moving to the next
4. Iterate based on user feedback
