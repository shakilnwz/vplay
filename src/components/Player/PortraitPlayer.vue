<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';

const props = defineProps<{
    videoElement: HTMLVideoElement | null;
    videoPlayer: any;
    isLoading: boolean;
    error: string | null;
    currentVideo: File | null;
    videos: File[];
    isUiLocked: boolean;
}>();

const emit = defineEmits<{
    (e: 'retry'): void;
    (e: 'load-video', file: File): void;
    (e: 'interact'): void;
    (e: 'ui-lock-change', locked: boolean): void;
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const videoContainerRef = ref<HTMLDivElement | null>(null);

// Transform state for pan/zoom
const transform = ref({ x: 0, y: 0, scale: 1 });
const isDragging = ref(false);
const touchStartPos = { x: 0, y: 0 };
const transformStart = { x: 0, y: 0, scale: 1 };

// Swipe detection
const SWIPE_THRESHOLD = 80;
const SWIPE_VELOCITY_THRESHOLD = 0.5;
let touchStartY = 0;
let touchStartX = 0;
let touchStartTime = 0;

// Two-finger gesture state
const twoFingerStart = {
    distance: 0,
    centerX: 0,
    centerY: 0,
    transformX: 0,
    transformY: 0,
    scale: 1
};

const currentVideoIndex = computed(() => {
    if (!props.currentVideo || props.videos.length === 0) return -1;
    return props.videos.findIndex(v => v.name === props.currentVideo!.name);
});

const hasNext = computed(() => currentVideoIndex.value < props.videos.length - 1);
const hasPrev = computed(() => currentVideoIndex.value > 0);

const loadNext = () => {
    if (hasNext.value) {
        const nextIndex = currentVideoIndex.value + 1;
        emit('load-video', props.videos[nextIndex]);
        // Reset to default mode when changing videos
        currentViewMode.value = 'fit-height';
        transform.value = { x: 0, y: 0, scale: 1 };
    }
};

const loadPrev = () => {
    if (hasPrev.value) {
        const prevIndex = currentVideoIndex.value - 1;
        emit('load-video', props.videos[prevIndex]);
        // Reset to default mode when changing videos
        currentViewMode.value = 'fit-height';
        transform.value = { x: 0, y: 0, scale: 1 };
    }
};

// View modes for the reset button cycle
type ViewMode = 'fit-height' | 'fit-screen' | 'keep-zoom-center';
const currentViewMode = ref<ViewMode>('fit-height');

const cycleViewMode = () => {
    showUI();
    
    // Cycle through modes: fit-height -> fit-screen -> keep-zoom-center -> fit-height
    if (currentViewMode.value === 'fit-height') {
        currentViewMode.value = 'fit-screen';
        transform.value = { x: 0, y: 0, scale: 1 };
    } else if (currentViewMode.value === 'fit-screen') {
        currentViewMode.value = 'keep-zoom-center';
        // Keep current scale but center
        transform.value.x = 0;
        transform.value.y = 0;
    } else {
        currentViewMode.value = 'fit-height';
        transform.value = { x: 0, y: 0, scale: 1 };
    }
};

const resetTransform = () => {
    cycleViewMode();
};

// Calculate max pan offset based on video and container dimensions
const calculateMaxPanOffset = () => {
    if (!props.videoElement || !containerRef.value) return 0;
    
    // In fit-screen mode, no panning needed as video fits entirely
    if (currentViewMode.value === 'fit-screen') return 0;
    
    const video = props.videoElement;
    const container = containerRef.value;
    
    // Get video display dimensions
    const videoAspect = video.videoWidth / video.videoHeight;
    const containerAspect = container.clientWidth / container.clientHeight;
    
    // Calculate displayed video width when fitting to container height
    const displayedVideoWidth = container.clientHeight * videoAspect;
    
    // Calculate how much of the video extends beyond the container
    const overflowWidth = Math.max(0, displayedVideoWidth - container.clientWidth);
    
    // Return half the overflow (can pan left/right by this amount)
    return overflowWidth / 2;
};

// Get distance between two touch points
const getTouchDistance = (touches: TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
};

// Get center point between two touches
const getTouchCenter = (touches: TouchList) => {
    return {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2
    };
};

// Single finger drag state
let isPanning = false;
let panStartX = 0;
let panStartTransformX = 0;

const handleTouchStart = (e: TouchEvent) => {
    emit('interact');
    showUI();
    
    if (e.touches.length === 1) {
        // Single finger - for swipe or pan
        touchStartY = e.touches[0].clientY;
        touchStartX = e.touches[0].clientX;
        touchStartTime = Date.now();
        isDragging.value = true;
        
        // Initialize pan state
        isPanning = false;
        panStartX = e.touches[0].clientX;
        panStartTransformX = transform.value.x;
    } else if (e.touches.length === 2) {
        // Two fingers - for pan/zoom
        e.preventDefault();
        isDragging.value = false; // Cancel single finger drag
        
        twoFingerStart.distance = getTouchDistance(e.touches);
        const center = getTouchCenter(e.touches);
        twoFingerStart.centerX = center.x;
        twoFingerStart.centerY = center.y;
        twoFingerStart.transformX = transform.value.x;
        twoFingerStart.transformY = transform.value.y;
        twoFingerStart.scale = transform.value.scale;
    }
};

const handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 2) {
        e.preventDefault();
        
        // Calculate new scale
        const currentDistance = getTouchDistance(e.touches);
        const scaleDelta = currentDistance / twoFingerStart.distance;
        const newScale = Math.max(1, Math.min(4, twoFingerStart.scale * scaleDelta));
        
        // Calculate pan delta
        const center = getTouchCenter(e.touches);
        const panX = center.x - twoFingerStart.centerX;
        const panY = center.y - twoFingerStart.centerY;
        
        // Calculate effective pan considering scale
        const effectivePanX = panX / newScale;
        const effectivePanY = panY / newScale;
        
        // Update transform with dynamic bounds based on video dimensions
        const baseMaxOffset = calculateMaxPanOffset();
        const maxOffset = baseMaxOffset * newScale;
        transform.value = {
            x: Math.max(-maxOffset, Math.min(maxOffset, twoFingerStart.transformX + effectivePanX)),
            y: Math.max(-maxOffset, Math.min(maxOffset, twoFingerStart.transformY + effectivePanY)),
            scale: newScale
        };
    } else if (e.touches.length === 1 && isDragging.value) {
        // Single finger horizontal panning for landscape videos
        const touch = e.touches[0];
        const deltaX = touch.clientX - touchStartX;
        const deltaY = touch.clientY - touchStartY;
        
        // Check if horizontal movement dominates and we've moved enough to start panning
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
            isPanning = true;
            e.preventDefault();
            
            // Calculate smooth pan with damping
            const dampingFactor = 1.0;
            const newX = panStartTransformX + (deltaX / dampingFactor);
            
            // Apply dynamic bounds based on video dimensions
            const baseMaxOffset = calculateMaxPanOffset();
            const maxOffset = baseMaxOffset * transform.value.scale;
            transform.value.x = Math.max(-maxOffset, Math.min(maxOffset, newX));
        }
    }
};

const handleTouchEnd = (e: TouchEvent) => {
    if (e.touches.length > 0) {
        // Still have fingers down (transitioning from 2 to 1 finger)
        return;
    }
    
    if (!isDragging.value) return;
    
    isDragging.value = false;
    
    // If user was panning horizontally, don't trigger video change
    if (isPanning) {
        isPanning = false;
        return;
    }
    
    // Only handle swipe if it was a single finger gesture
    if (e.changedTouches.length === 1) {
        const touch = e.changedTouches[0];
        const deltaY = touchStartY - touch.clientY;
        const deltaX = Math.abs(touchStartX - touch.clientX);
        const deltaTime = Date.now() - touchStartTime;
        const velocity = Math.abs(deltaY) / deltaTime;
        
        // Only trigger swipe if:
        // 1. Vertical movement is significant
        // 2. Vertical movement is greater than horizontal
        // 3. Either movement is large enough or velocity is high
        // 4. When zoomed in, only swipe if at the edge of pan (x is near 0)
        const isAtHorizontalCenter = Math.abs(transform.value.x) < 20;
        
        if (Math.abs(deltaY) > SWIPE_THRESHOLD && 
            Math.abs(deltaY) > deltaX &&
            (Math.abs(deltaY) > SWIPE_THRESHOLD * 1.5 || velocity > SWIPE_VELOCITY_THRESHOLD) &&
            (transform.value.scale === 1 || isAtHorizontalCenter)) {
            
            if (deltaY > 0 && hasNext.value) {
                loadNext();
            } else if (deltaY < 0 && hasPrev.value) {
                loadPrev();
            }
        }
    }
};

const handleWheel = (e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(1, Math.min(4, transform.value.scale * delta));
        transform.value.scale = newScale;
        if (newScale === 1) {
            transform.value.x = 0;
            transform.value.y = 0;
        }
    }
};

// Handle double tap to reset zoom
let lastTap = 0;
const handleTap = () => {
    const now = Date.now();
    if (now - lastTap < 300) {
        resetTransform();
    }
    lastTap = now;
};

// Video controls binding from parent
const {
    isPlaying,
    volume,
    currentTime,
    duration,
    isMuted
} = props.videoPlayer;

// UI visibility and locking
const isUiVisible = ref(true);
let uiHideTimeout: number | null = null;
const UI_HIDE_DELAY = 3000;

// Fullscreen State and Handlers
const isFullscreen = ref(false);

const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(err => {
            console.log('Fullscreen error:', err);
        });
    } else {
        document.exitFullscreen().catch(err => {
            console.log('Exit fullscreen error:', err);
        });
    }
    showUI();
};

const handleFullscreenChange = () => {
    isFullscreen.value = !!document.fullscreenElement;
};

// Show UI and reset auto-hide timer
const showUI = (force = false) => {
    if (props.isUiLocked && !force) return;

    isUiVisible.value = true;

    if (uiHideTimeout) {
        window.clearTimeout(uiHideTimeout);
    }

    if (isPlaying.value) {
        uiHideTimeout = window.setTimeout(() => {
            isUiVisible.value = false;
        }, UI_HIDE_DELAY);
    }
};

// Toggle UI lock
const toggleUiLock = () => {
    const newLockState = !props.isUiLocked;
    // When unlocking, ensure UI is visible before the element re-renders
    if (!newLockState) {
        isUiVisible.value = true;
    }
    emit('ui-lock-change', newLockState);
};

const handleTogglePlay = () => {
    props.videoPlayer.togglePlay();
    showUI();
};

const handleSeekTime = (newTime: number) => {
    props.videoPlayer.handleSeek(newTime);
    showUI();
};

const handleToggleMute = () => {
    props.videoPlayer.toggleMute();
    showUI();
};

const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Mount video element inside zoom container and manage dynamic classes
watch([() => props.videoElement, videoContainerRef, currentViewMode], () => {
    const video = props.videoElement;
    const container = videoContainerRef.value;
    if (!video || !container) return;
    
    if (!container.contains(video)) {
        container.appendChild(video);
    }
    
    // Setup classes
    video.className = ""; // clear
    video.classList.add('transition-all', 'duration-300');
    if (currentViewMode.value === 'fit-screen') {
        video.classList.add('max-w-full', 'max-h-full', 'object-contain');
    } else {
        video.classList.add('h-full', 'w-auto', 'max-w-none', 'object-cover');
    }
}, { immediate: true });

// Watch current video to reset state on load
watch(() => props.currentVideo, () => {
    currentViewMode.value = 'fit-height';
    transform.value = { x: 0, y: 0, scale: 1 };
});

onMounted(() => {
    if (containerRef.value) {
        containerRef.value.addEventListener('wheel', handleWheel, { passive: false });
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange);
});

onUnmounted(() => {
    if (containerRef.value) {
        containerRef.value.removeEventListener('wheel', handleWheel);
    }
    if (uiHideTimeout) {
        window.clearTimeout(uiHideTimeout);
    }
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
    // Return video element to parent's body or let App.vue handle it
    if (props.videoElement && videoContainerRef.value?.contains(props.videoElement)) {
        videoContainerRef.value.removeChild(props.videoElement);
    }
});
</script>

<template>
    <div 
        ref="containerRef"
        class="relative w-full h-full bg-black overflow-hidden"
        @touchstart="handleTouchStart"
        @touchmove="handleTouchMove"
        @touchend="handleTouchEnd"
        @click="handleTap"
    >
        <!-- Video Container with transform -->
        <div 
            class="w-full h-full flex items-center justify-center will-change-transform"
            :class="isDragging ? 'transition-none' : 'transition-transform duration-300 ease-out'"
            :style="{
                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`
            }"
        >
            <!-- DOM node for shared persistent video element is appended here -->
            <div ref="videoContainerRef" class="w-full h-full flex items-center justify-center pointer-events-none" />
        </div>

        <!-- Loading Overlay -->
        <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center z-10 bg-black bg-opacity-50 pointer-events-none">
            <div class="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
        </div>

        <!-- Error Overlay -->
        <div v-if="error" class="absolute inset-0 flex items-center justify-center z-20 bg-black bg-opacity-80">
            <div class="text-center p-6 max-w-md">
                <div class="text-red-500 text-5xl mb-4">⚠️</div>
                <h3 class="text-xl font-bold text-white mb-2">Error Loading Video</h3>
                <p class="text-gray-300 mb-6">{{ error }}</p>
                <button
                    @click="$emit('retry')"
                    class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                >
                    Retry
                </button>
            </div>
        </div>

        <!-- Navigation Buttons (Interactive & Clickable) -->
        <div v-if="videos.length > 1 && !props.isUiLocked" class="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-10">
            <button 
                v-if="hasPrev"
                @click.stop="loadPrev"
                class="w-11 h-11 rounded-full bg-black/40 border border-white/10 hover:bg-blue-600 active:scale-95 text-white backdrop-blur-sm flex items-center justify-center transition cursor-pointer shadow-lg"
                title="Previous Video"
            >
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                </svg>
            </button>
            <button 
                v-if="hasNext"
                @click.stop="loadNext"
                class="w-11 h-11 rounded-full bg-black/40 border border-white/10 hover:bg-blue-600 active:scale-95 text-white backdrop-blur-sm flex items-center justify-center transition cursor-pointer shadow-lg"
                title="Next Video"
            >
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
            </button>
        </div>

        <!-- Zoom indicator -->
        <div 
            v-if="transform.scale > 1 && !props.isUiLocked" 
            class="absolute top-4 right-4 px-3 py-1 rounded-full bg-black/50 backdrop-blur-sm text-white text-sm z-10"
        >
            {{ Math.round(transform.scale * 100) }}%
        </div>

        <!-- Video counter -->
        <div 
            v-if="videos.length > 0 && !props.isUiLocked"
            class="absolute bottom-4 left-4 px-3 py-1 rounded-full bg-black/50 backdrop-blur-sm text-white text-sm z-10"
        >
            {{ currentVideoIndex + 1 }} / {{ videos.length }}
        </div>

        <!-- Empty state -->
        <div v-if="!currentVideo" class="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div class="text-center p-6 bg-gray-800 bg-opacity-80 rounded-lg">
                <svg class="w-24 h-24 mx-auto mb-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                </svg>
                <p class="text-xl text-gray-400">Select a video to start playing</p>
            </div>
        </div>

        <!-- Portrait Mode Controls -->
        <div
            v-if="currentVideo"
            class="absolute bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-black/80 to-transparent p-4 transition-all duration-500"
            :class="{
                'opacity-0 pointer-events-none': !isUiVisible || props.isUiLocked,
                'opacity-100': isUiVisible && !props.isUiLocked
            }"
        >
            <!-- Progress Bar -->
            <div class="flex items-center space-x-3 mb-3">
                <span class="text-xs font-mono text-gray-300 w-10 text-right">{{ formatTime(currentTime) }}</span>
                <input 
                    type="range" 
                    min="0" 
                    :max="duration || 0" 
                    :value="currentTime"
                    @input="handleSeekTime(parseFloat(($event.target as HTMLInputElement).value))"
                    class="flex-1 h-1.5 bg-white/30 rounded-full appearance-none cursor-pointer accent-blue-500"
                />
                <span class="text-xs font-mono text-gray-300 w-10">{{ formatTime(duration) }}</span>
            </div>

            <!-- Control Buttons -->
            <div class="flex items-center justify-center gap-4">
                <!-- Play/Pause -->
                <button 
                    @click="handleTogglePlay"
                    class="p-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                >
                    <svg v-if="isPlaying" class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                    <svg v-else class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
                    </svg>
                </button>

                <!-- Mute & Volume Controller Pill -->
                <div class="flex items-center gap-2 bg-white/10 hover:bg-white/15 px-3 py-1.5 rounded-full transition">
                    <button 
                        @click="handleToggleMute"
                        class="text-white hover:text-blue-400 transition-colors"
                        :class="{ 'text-blue-500': isMuted }"
                        title="Toggle Mute"
                    >
                        <svg v-if="!isMuted" class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clip-rule="evenodd" />
                        </svg>
                        <svg v-else class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clip-rule="evenodd" />
                        </svg>
                    </button>
                    <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.1" 
                        :value="isMuted ? 0 : volume"
                        @input="props.videoPlayer.handleVolumeChange(parseFloat(($event.target as HTMLInputElement).value))"
                        class="w-16 sm:w-20 h-1 bg-white/30 rounded-full appearance-none cursor-pointer accent-blue-500"
                    />
                </div>

                <!-- Reset View -->
                <button 
                    @click="resetTransform"
                    class="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                    :title="currentViewMode === 'fit-height' ? 'Fit Height (Click to cycle)' : currentViewMode === 'fit-screen' ? 'Fit Screen (Click to cycle)' : 'Center Focus (Click to cycle)'"
                >
                    <!-- Mode 1: Fit Height - 9/16 Portrait Rectangle -->
                    <svg v-if="currentViewMode === 'fit-height'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <rect x="8" y="2" width="8" height="20" rx="1" stroke-width="2" />
                    </svg>
                    
                    <!-- Mode 2: Fit Screen - 16/9 Landscape Rectangle -->
                    <svg v-else-if="currentViewMode === 'fit-screen'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <rect x="2" y="6" width="20" height="12" rx="1" stroke-width="2" />
                    </svg>
                    
                    <!-- Mode 3: Keep Zoom Center - Reset Icon -->
                    <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>

                <!-- Fullscreen Toggle -->
                <button 
                    @click="toggleFullscreen"
                    class="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                    :class="{ 'bg-blue-600 hover:bg-blue-500': isFullscreen }"
                    :title="isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'"
                >
                    <svg v-if="!isFullscreen" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                    <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 10h6V4m0 6l-7-7m17 7h-6V4m0 6l7-7M4 14h6v6m0-6l-7 7m17-7h-6v6m0-6l7 7" />
                    </svg>
                </button>

                <!-- Lock UI -->
                <button 
                    @click="toggleUiLock"
                    class="p-3 rounded-full transition-colors"
                    :class="props.isUiLocked ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white'"
                    :title="props.isUiLocked ? 'Unlock Controls' : 'Lock Controls'"
                >
                    <svg v-if="props.isUiLocked" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Prevent default touch actions */
video {
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
}
</style>
