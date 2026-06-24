import { store } from './store';
import { SidebarComponent } from './components/Sidebar';
import { ControlsComponent } from './components/Controls';
import { WebGLRenderer } from './renderer/WebGLRenderer';
import { loadVideo, handleDirectoryPicker } from './utils/fileHandler';

// Initialize Persistent Shared Video Element
const video = document.createElement('video');
video.crossOrigin = 'anonymous';
video.playsInline = true;
video.loop = true;
video.autoplay = true;
video.className = 'hidden';
store.videoElement.value = video;

// Sync Video Element DOM events to observable state
video.addEventListener('play', () => store.isPlaying.value = true);
video.addEventListener('pause', () => store.isPlaying.value = false);
video.addEventListener('timeupdate', () => store.currentTime.value = video.currentTime);
video.addEventListener('loadedmetadata', () => {
    store.duration.value = video.duration;
    store.isLoadingVideo.value = false;
    const renderer = (window as unknown as { customWebGLRenderer?: { resetView: () => void } }).customWebGLRenderer;
    if (renderer) renderer.resetView();
});
video.addEventListener('ended', () => store.isPlaying.value = false);
video.addEventListener('error', () => {
    store.isLoadingVideo.value = false;
    store.error.value = video.error?.message || 'Playback failed';
    store.isPlaying.value = false;
});

// Setup Main DOM elements
const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');
root.className = 'flex h-screen bg-gray-900 text-white overflow-hidden relative select-none';

// 1. Instantiate Sidebar Component
const sidebar = new SidebarComponent();
root.appendChild(sidebar.getElement());

// 2. Hidden Video Container for keeping video attached when in VR Mode
const hiddenVideoContainer = document.createElement('div');
hiddenVideoContainer.style.display = 'none';
hiddenVideoContainer.appendChild(video);
root.appendChild(hiddenVideoContainer);

// 3. Main Player Viewport
const mainViewport = document.createElement('div');
mainViewport.className = 'flex-1 relative flex flex-col h-full overflow-hidden';
root.appendChild(mainViewport);

// 4. WebGL VR Canvas
const canvas = document.createElement('canvas');
canvas.className = 'w-full h-full cursor-grab active:cursor-grabbing outline-none block';
mainViewport.appendChild(canvas);

// 5. 2D Portrait Viewport Container
const portraitContainer = document.createElement('div');
portraitContainer.className = 'absolute inset-0 z-10 flex items-center justify-center pointer-events-none transition-all duration-300 ease-out will-change-transform';

const portraitVideoWrapper = document.createElement('div');
portraitVideoWrapper.className = 'w-full h-full flex items-center justify-center';
portraitContainer.appendChild(portraitVideoWrapper);
mainViewport.appendChild(portraitContainer);

// 6. Navigation Buttons Overlay for Portrait Player
const navOverlay = document.createElement('div');
navOverlay.className = 'absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-3.5 z-20 hidden';
navOverlay.innerHTML = `
    <button class="prev-btn w-11 h-11 rounded-full bg-black/40 border border-white/10 hover:bg-blue-600 active:scale-95 text-white backdrop-blur-sm flex items-center justify-center transition cursor-pointer shadow-lg">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" /></svg>
    </button>
    <button class="next-btn w-11 h-11 rounded-full bg-black/40 border border-white/10 hover:bg-blue-600 active:scale-95 text-white backdrop-blur-sm flex items-center justify-center transition cursor-pointer shadow-lg">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
    </button>
`;
const pBtn = navOverlay.querySelector('.prev-btn') as HTMLButtonElement;
const nBtn = navOverlay.querySelector('.next-btn') as HTMLButtonElement;

const loadNext = () => {
    const list = store.videos.value;
    const cur = store.currentVideo.value;
    if (!cur || list.length === 0) return;
    const idx = list.findIndex(v => v.name === cur.name);
    if (idx !== -1 && idx < list.length - 1) {
        loadVideo(list[idx + 1]);
    }
};
const loadPrev = () => {
    const list = store.videos.value;
    const cur = store.currentVideo.value;
    if (!cur || list.length === 0) return;
    const idx = list.findIndex(v => v.name === cur.name);
    if (idx !== -1 && idx > 0) {
        loadVideo(list[idx - 1]);
    }
};
pBtn.onclick = loadPrev;
nBtn.onclick = loadNext;
mainViewport.appendChild(navOverlay);

// Navigation indicator syncing
store.videos.subscribe(list => {
    const show = list.length > 1 && store.playerMode.value === 'portrait' && !store.isUiLocked.value;
    if (show) navOverlay.classList.remove('hidden');
    else navOverlay.classList.add('hidden');
});
store.playerMode.subscribe(mode => {
    const show = store.videos.value.length > 1 && mode === 'portrait' && !store.isUiLocked.value;
    if (show) navOverlay.classList.remove('hidden');
    else navOverlay.classList.add('hidden');
});
store.isUiLocked.subscribe(locked => {
    const show = store.videos.value.length > 1 && store.playerMode.value === 'portrait' && !locked;
    if (show) navOverlay.classList.remove('hidden');
    else navOverlay.classList.add('hidden');
});

// 7. Dynamic Info Indicators
const zoomIndicator = document.createElement('div');
zoomIndicator.className = 'absolute top-4 right-4 px-3 py-1.5 rounded-full bg-black/50 border border-white/5 text-white text-xs font-mono backdrop-blur-sm z-20 hidden';
mainViewport.appendChild(zoomIndicator);

const counterIndicator = document.createElement('div');
counterIndicator.className = 'absolute bottom-4 left-4 px-3 py-1.5 rounded-full bg-black/50 border border-white/5 text-white text-xs font-mono backdrop-blur-sm z-20 hidden';
mainViewport.appendChild(counterIndicator);

// Sync counter
const syncCounter = () => {
    const list = store.videos.value;
    const cur = store.currentVideo.value;
    const pr = store.playerMode.value === 'portrait';
    if (cur && list.length > 0 && pr && !store.isUiLocked.value) {
        counterIndicator.classList.remove('hidden');
        const idx = list.findIndex(v => v.name === cur.name);
        counterIndicator.textContent = `${idx + 1} / ${list.length}`;
    } else {
        counterIndicator.classList.add('hidden');
    }
};
store.videos.subscribe(syncCounter);
store.currentVideo.subscribe(syncCounter);
store.playerMode.subscribe(syncCounter);
store.isUiLocked.subscribe(syncCounter);

// 8. Loader & Error Overlays
const loader = document.createElement('div');
loader.className = 'absolute inset-0 flex items-center justify-center z-25 bg-black/50 pointer-events-none hidden';
loader.innerHTML = '<div class="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>';
mainViewport.appendChild(loader);

store.isLoadingVideo.subscribe(loading => {
    if (loading) loader.classList.remove('hidden');
    else loader.classList.add('hidden');
});

const errorOverlay = document.createElement('div');
errorOverlay.className = 'absolute inset-0 flex items-center justify-center z-25 bg-black/80 hidden';
errorOverlay.innerHTML = `
    <div class="text-center p-6 max-w-md bg-gray-900 border border-white/10 rounded-2xl">
        <div class="text-red-500 text-5xl mb-4">⚠️</div>
        <h3 class="text-xl font-bold text-white mb-2">Error Loading Video</h3>
        <p class="error-msg text-gray-300 mb-6"></p>
        <button class="retry-btn px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium">Retry</button>
    </div>
`;
const retryBtn = errorOverlay.querySelector('.retry-btn') as HTMLButtonElement;
retryBtn.onclick = () => {
    if (store.currentVideo.value) {
        loadVideo(store.currentVideo.value);
    }
};
mainViewport.appendChild(errorOverlay);

store.error.subscribe(err => {
    if (err) {
        errorOverlay.classList.remove('hidden');
        errorOverlay.querySelector('.error-msg')!.textContent = err;
    } else {
        errorOverlay.classList.add('hidden');
    }
});

// 9. Welcoming empty state dashboard
const emptyState = document.createElement('div');
emptyState.className = 'absolute inset-0 flex items-center justify-center bg-gray-950/60 z-15';
emptyState.innerHTML = `
    <div class="text-center p-8 max-w-sm bg-gray-900/80 border border-white/10 rounded-2xl backdrop-blur-md shadow-2xl">
        <svg class="w-16 h-16 mx-auto mb-4 text-gray-600 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
        </svg>
        <h3 class="text-lg font-bold text-white mb-2">Welcome to VPlay</h3>
        <p class="text-xs text-gray-400 leading-relaxed mb-6">Select a folder or drag in videos to start playing high-performance immersive 360°/180° videos.</p>
        <button class="select-btn py-2.5 px-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md transition-all">Choose Folder</button>
    </div>
`;
emptyState.querySelector('.select-btn')!.addEventListener('click', handleDirectoryPicker);
mainViewport.appendChild(emptyState);

store.currentVideo.subscribe(videoFile => {
    if (videoFile) emptyState.classList.add('hidden');
    else emptyState.classList.remove('hidden');
});

// 10. Sidebar Mobile Menu Button & Unlock Button overlays
const sidebarToggle = document.createElement('button');
sidebarToggle.className = 'fixed top-4 left-4 z-50 p-2 bg-blue-600 rounded-xl lg:hidden transition shadow-lg text-white border border-blue-500/25';
sidebarToggle.innerHTML = `
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path class="menu-open-path" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
`;
sidebarToggle.onclick = () => {
    store.sidebarOpen.value = !store.sidebarOpen.value;
};
root.appendChild(sidebarToggle);

store.sidebarOpen.subscribe(open => {
    const path = sidebarToggle.querySelector('.menu-open-path') as SVGPathElement | null;
    if (path) {
        path.setAttribute('d', open ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16');
    }
});

store.isUiLocked.subscribe(locked => {
    if (locked) sidebarToggle.classList.add('hidden');
    else sidebarToggle.classList.remove('hidden');
});

const unlockBtn = document.createElement('button');
unlockBtn.className = 'fixed top-4 right-4 z-50 p-2.5 bg-black/40 border border-white/10 backdrop-blur-md rounded-full text-white shadow-lg cursor-pointer hover:bg-black/60 transition active:scale-95 hidden';
unlockBtn.innerHTML = `<svg class="w-5.5 h-5.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>`;
unlockBtn.onclick = () => {
    store.isUiLocked.value = false;
};
root.appendChild(unlockBtn);

store.isUiLocked.subscribe(locked => {
    if (locked) unlockBtn.classList.remove('hidden');
    else unlockBtn.classList.add('hidden');
});

// 11. Instantiate Controls Component
const controls = new ControlsComponent();
mainViewport.appendChild(controls.getElement());

// Handle dynamic sizing and gestures for 2D Portrait mode view
let transform = { x: 0, y: 0, scale: 1 };
let isDragging = false;
let isPanning = false;
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
let panStartTransformX = 0;

const twoFingerStart = {
    distance: 0,
    centerX: 0,
    centerY: 0,
    transformX: 0,
    transformY: 0,
    scale: 1
};

const updatePortraitTransform = () => {
    portraitVideoWrapper.style.transform = `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`;
    if (transform.scale > 1 && !store.isUiLocked.value) {
        zoomIndicator.classList.remove('hidden');
        zoomIndicator.textContent = `${Math.round(transform.scale * 100)}%`;
    } else {
        zoomIndicator.classList.add('hidden');
    }
};

const resetPortraitTransform = () => {
    transform = { x: 0, y: 0, scale: 1 };
    updatePortraitTransform();
};

store.currentVideo.subscribe(resetPortraitTransform);
store.viewMode.subscribe(resetPortraitTransform);

const calculateMaxPanOffset = () => {
    if (!video || !portraitContainer) return 0;
    if (store.viewMode.value === 'flat') return 0;
    const videoAspect = video.videoWidth / video.videoHeight || 16/9;
    const displayedVideoWidth = portraitContainer.clientHeight * videoAspect;
    const overflowWidth = Math.max(0, displayedVideoWidth - portraitContainer.clientWidth);
    return overflowWidth / 2;
};

// Gesture Listeners for Portrait mode Zoom / Panning
portraitContainer.addEventListener('touchstart', (e: TouchEvent) => {
    store.isUiVisible.value = true;
    if (store.isUiLocked.value) return;

    if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
        isDragging = true;
        isPanning = false;
        panStartTransformX = transform.x;
    } else if (e.touches.length === 2) {
        e.preventDefault();
        isDragging = false;
        
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        twoFingerStart.distance = Math.sqrt(dx * dx + dy * dy);
        
        const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        twoFingerStart.centerX = centerX;
        twoFingerStart.centerY = centerY;
        
        twoFingerStart.transformX = transform.x;
        twoFingerStart.transformY = transform.y;
        twoFingerStart.scale = transform.scale;
    }
}, { passive: false });

portraitContainer.addEventListener('touchmove', (e: TouchEvent) => {
    if (store.isUiLocked.value) return;

    if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const currentDist = Math.sqrt(dx * dx + dy * dy);
        const scaleDelta = currentDist / twoFingerStart.distance;
        const newScale = Math.max(1, Math.min(4, twoFingerStart.scale * scaleDelta));
        
        const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const panX = centerX - twoFingerStart.centerX;
        const panY = centerY - twoFingerStart.centerY;
        
        const baseMax = calculateMaxPanOffset();
        const maxOffset = baseMax * newScale;
        
        transform = {
            x: Math.max(-maxOffset, Math.min(maxOffset, twoFingerStart.transformX + (panX / newScale))),
            y: Math.max(-maxOffset, Math.min(maxOffset, twoFingerStart.transformY + (panY / newScale))),
            scale: newScale
        };
        updatePortraitTransform();
    } else if (e.touches.length === 1 && isDragging) {
        const touch = e.touches[0];
        const deltaX = touch.clientX - touchStartX;
        const deltaY = touch.clientY - touchStartY;
        
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
            isPanning = true;
            e.preventDefault();
            
            const baseMax = calculateMaxPanOffset();
            const maxOffset = baseMax * transform.scale;
            const newX = panStartTransformX + deltaX;
            transform.x = Math.max(-maxOffset, Math.min(maxOffset, newX));
            updatePortraitTransform();
        }
    }
}, { passive: false });

portraitContainer.addEventListener('touchend', (e: TouchEvent) => {
    if (e.touches.length > 0 || !isDragging || store.isUiLocked.value) {
        return;
    }
    isDragging = false;
    
    if (isPanning) {
        isPanning = false;
        return;
    }
    
    // Swipe to change video
    if (e.changedTouches.length === 1) {
        const touch = e.changedTouches[0];
        const deltaY = touchStartY - touch.clientY;
        const deltaX = Math.abs(touchStartX - touch.clientX);
        const deltaTime = Date.now() - touchStartTime;
        const velocity = Math.abs(deltaY) / deltaTime;
        
        const isAtCenter = Math.abs(transform.x) < 20;
        
        if (Math.abs(deltaY) > 80 && 
            Math.abs(deltaY) > deltaX && 
            (Math.abs(deltaY) > 120 || velocity > 0.5) &&
            (transform.scale === 1 || isAtCenter)) {
            if (deltaY > 0) {
                loadNext();
            } else {
                loadPrev();
            }
        }
    }
});

let lastTap = 0;
portraitContainer.addEventListener('click', (e) => {
    if (store.isUiLocked.value) return;
    const now = Date.now();
    if (now - lastTap < 300) {
        e.stopPropagation();
        const curr = store.viewMode.value;
        if (curr === 'flat') {
            store.viewMode.value = '180';
        } else if (curr === '180') {
            store.viewMode.value = '360';
        } else {
            store.viewMode.value = 'flat';
        }
    }
    lastTap = now;
});

// Setup custom WebGLRenderer binding and re-initialization logic
let customWebGLRenderer: WebGLRenderer | null = null;

const reinitRenderer = () => {
    if (customWebGLRenderer) {
        customWebGLRenderer.destroy();
        customWebGLRenderer = null;
    }
    if (store.playerMode.value === 'vr') {
        canvas.style.display = 'block';
        portraitContainer.classList.add('hidden');
        portraitContainer.classList.remove('pointer-events-auto');
        portraitContainer.classList.add('pointer-events-none');
        
        customWebGLRenderer = new WebGLRenderer({
            canvas,
            video,
            viewMode: store.viewMode.value,
            isSBS: store.isSBS.value,
            sbsFormat: store.sbsFormat.value,
            invertStereo: store.invertStereo.value,
            gyroEnabled: store.gyroEnabled.value
        });
        (window as unknown as { customWebGLRenderer: WebGLRenderer | null }).customWebGLRenderer = customWebGLRenderer;
    } else {
        canvas.style.display = 'none';
        portraitContainer.classList.remove('hidden');
        portraitContainer.classList.add('pointer-events-auto');
        portraitContainer.classList.remove('pointer-events-none');
        
        if (!portraitVideoWrapper.contains(video)) {
            portraitVideoWrapper.appendChild(video);
        }
        video.className = 'transition-all duration-300 pointer-events-none';
        
        const updatePortraitClasses = () => {
            const vm = store.viewMode.value;
            video.className = 'transition-all duration-300 pointer-events-none ';
            if (vm === 'flat') {
                video.classList.add('max-w-full', 'max-h-full', 'object-contain');
            } else {
                video.classList.add('h-full', 'w-auto', 'max-w-none', 'object-cover');
            }
        };
        store.viewMode.subscribe(updatePortraitClasses);
    }
};

store.playerMode.subscribe(reinitRenderer);
store.viewMode.subscribe(v => {
    if (customWebGLRenderer) {
        customWebGLRenderer.updateSettings({ viewMode: v });
    }
});
store.isSBS.subscribe(s => {
    if (customWebGLRenderer) {
        customWebGLRenderer.updateSettings({ isSBS: s });
    }
});
store.sbsFormat.subscribe(sf => {
    if (customWebGLRenderer) {
        customWebGLRenderer.updateSettings({ sbsFormat: sf });
    }
});
store.invertStereo.subscribe(is => {
    if (customWebGLRenderer) {
        customWebGLRenderer.updateSettings({ invertStereo: is });
    }
});
store.gyroEnabled.subscribe(ge => {
    if (customWebGLRenderer) {
        customWebGLRenderer.updateSettings({ gyroEnabled: ge });
    }
});

// Watch current video to update source object URL
let videoUrl: string | null = null;
store.currentVideo.subscribe(videoFile => {
    if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
        videoUrl = null;
    }
    if (videoFile) {
        videoUrl = URL.createObjectURL(videoFile);
        video.src = videoUrl;
        
        const meta = store.videoMetadata.value.get(videoFile.name);
        if (meta && customWebGLRenderer) {
            customWebGLRenderer.updateSettings({
                videoWidth: meta.width,
                videoHeight: meta.height
            });
        }
    } else {
        video.src = '';
    }
});

store.videoMetadata.subscribe(metadataMap => {
    const active = store.currentVideo.value;
    if (active && customWebGLRenderer) {
        const meta = metadataMap.get(active.name);
        if (meta) {
            customWebGLRenderer.updateSettings({
                videoWidth: meta.width,
                videoHeight: meta.height
            });
        }
    }
});

// Setup Keyboard shortcut listeners
const SEEK_DELTA = 15;
window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'SELECT') {
        return;
    }

    switch (e.code) {
        case 'Space': {
            e.preventDefault();
            const playing = store.isPlaying.value;
            if (playing) video.pause();
            else video.play();
            store.isPlaying.value = !playing;
            store.isUiVisible.value = true;
            break;
        }
        case 'ArrowLeft': {
            e.preventDefault();
            const tLeft = Math.max(0, video.currentTime - SEEK_DELTA);
            store.currentTime.value = tLeft;
            video.currentTime = tLeft;
            store.isUiVisible.value = true;
            break;
        }
        case 'ArrowRight': {
            e.preventDefault();
            const tRight = Math.min(video.duration || Infinity, video.currentTime + SEEK_DELTA);
            store.currentTime.value = tRight;
            video.currentTime = tRight;
            store.isUiVisible.value = true;
            break;
        }
        case 'ArrowUp': {
            e.preventDefault();
            const vUp = Math.min(1.0, store.volume.value + 0.1);
            store.volume.value = vUp;
            video.volume = vUp;
            store.isUiVisible.value = true;
            break;
        }
        case 'ArrowDown': {
            e.preventDefault();
            const vDown = Math.max(0.0, store.volume.value - 0.1);
            store.volume.value = vDown;
            video.volume = vDown;
            store.isUiVisible.value = true;
            break;
        }
        case 'KeyM':
            e.preventDefault();
            store.isMuted.value = !store.isMuted.value;
            video.muted = store.isMuted.value;
            store.isUiVisible.value = true;
            break;
        case 'KeyF':
            e.preventDefault();
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(err => {
                    console.log('Fullscreen error:', err);
                });
            } else {
                document.exitFullscreen();
            }
            break;
        case 'KeyR':
        case 'KeyC':
            if (store.playerMode.value === 'vr' && customWebGLRenderer) {
                e.preventDefault();
                customWebGLRenderer.resetView();
            }
            break;
    }
});

// Setup Fullscreen State listener
document.addEventListener('fullscreenchange', () => {
    store.isFullscreen.value = !!document.fullscreenElement;
});

// Register PWA Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => {
            console.warn('PWA service worker registration failed: ', err);
        });
    });
}
