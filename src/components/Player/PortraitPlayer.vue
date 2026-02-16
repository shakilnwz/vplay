<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';

const props = defineProps<{
    src: string | null;
    isLoading: boolean;
    error: string | null;
    currentVideo: File | null;
    videos: File[];
}>();

const emit = defineEmits<{
    (e: 'retry'): void;
    (e: 'video-ref', node: HTMLVideoElement | null): void;
    (e: 'load-video', file: File): void;
    (e: 'interact'): void;
}>();

const videoRef = ref<HTMLVideoElement | null>(null);
const containerRef = ref<HTMLDivElement | null>(null);

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
        resetTransform();
    }
};

const loadPrev = () => {
    if (hasPrev.value) {
        const prevIndex = currentVideoIndex.value - 1;
        emit('load-video', props.videos[prevIndex]);
        resetTransform();
    }
};

const resetTransform = () => {
    transform.value = { x: 0, y: 0, scale: 1 };
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

const handleTouchStart = (e: TouchEvent) => {
    emit('interact');
    
    if (e.touches.length === 1) {
        // Single finger - for swipe
        touchStartY = e.touches[0].clientY;
        touchStartX = e.touches[0].clientX;
        touchStartTime = Date.now();
        isDragging.value = true;
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
        
        // Update transform with bounds
        const maxOffset = 50 * newScale;
        transform.value = {
            x: Math.max(-maxOffset, Math.min(maxOffset, twoFingerStart.transformX + effectivePanX)),
            y: Math.max(-maxOffset, Math.min(maxOffset, twoFingerStart.transformY + effectivePanY)),
            scale: newScale
        };
    }
};

    const handleTouchEnd = (e: TouchEvent) => {
    if (e.touches.length > 0) {
        // Still have fingers down (transitioning from 2 to 1 finger)
        return;
    }
    
    if (!isDragging.value) return;
    
    isDragging.value = false;
    
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

// Watch video ref for parent
watch(videoRef, (newVal) => {
    emit('video-ref', newVal);
});

// Handle double tap to reset zoom
let lastTap = 0;
const handleTap = () => {
    const now = Date.now();
    if (now - lastTap < 300) {
        resetTransform();
    }
    lastTap = now;
};

onMounted(() => {
    if (containerRef.value) {
        containerRef.value.addEventListener('wheel', handleWheel, { passive: false });
    }
});

onUnmounted(() => {
    if (containerRef.value) {
        containerRef.value.removeEventListener('wheel', handleWheel);
    }
});

// Video controls for portrait mode
const isPlaying = ref(false);
const currentTime = ref(0);
const duration = ref(0);
const volume = ref(1);

const togglePlay = () => {
    if (videoRef.value) {
        if (isPlaying.value) {
            videoRef.value.pause();
        } else {
            videoRef.value.play();
        }
    }
};

const handleSeek = (newTime: number) => {
    currentTime.value = newTime;
    if (videoRef.value) {
        videoRef.value.currentTime = newTime;
    }
};

const handleVolumeChange = (newVolume: number) => {
    volume.value = newVolume;
    if (videoRef.value) {
        videoRef.value.volume = newVolume;
    }
};

const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Watch video element for events
watch(videoRef, (newVal) => {
    if (newVal) {
        newVal.addEventListener('play', () => isPlaying.value = true);
        newVal.addEventListener('pause', () => isPlaying.value = false);
        newVal.addEventListener('timeupdate', () => currentTime.value = newVal.currentTime);
        newVal.addEventListener('loadedmetadata', () => duration.value = newVal.duration);
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
            class="w-full h-full flex items-center justify-center transition-transform duration-100 ease-out"
            :style="{
                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`
            }"
        >
            <video
                ref="videoRef"
                :src="src || undefined"
                class="h-full w-auto max-w-none object-cover"
                playsinline
                autoplay
                loop
            />
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

        <!-- Navigation Hints -->
        <div v-if="videos.length > 1" class="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-10 pointer-events-none">
            <div 
                v-if="hasPrev"
                class="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center"
            >
                <svg class="w-6 h-6 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                </svg>
            </div>
            <div 
                v-if="hasNext"
                class="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center"
            >
                <svg class="w-6 h-6 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
            </div>
        </div>

        <!-- Zoom indicator -->
        <div 
            v-if="transform.scale > 1" 
            class="absolute top-4 right-4 px-3 py-1 rounded-full bg-black/50 backdrop-blur-sm text-white text-sm z-10"
        >
            {{ Math.round(transform.scale * 100) }}%
        </div>

        <!-- Video counter -->
        <div 
            v-if="videos.length > 0"
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
            class="absolute bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-black/80 to-transparent p-4"
        >
            <!-- Progress Bar -->
            <div class="flex items-center space-x-3 mb-3">
                <span class="text-xs font-mono text-gray-300 w-10 text-right">{{ formatTime(currentTime) }}</span>
                <input 
                    type="range" 
                    min="0" 
                    :max="duration || 0" 
                    :value="currentTime"
                    @input="handleSeek(parseFloat(($event.target as HTMLInputElement).value))"
                    class="flex-1 h-1.5 bg-white/30 rounded-full appearance-none cursor-pointer accent-blue-500"
                />
                <span class="text-xs font-mono text-gray-300 w-10">{{ formatTime(duration) }}</span>
            </div>

            <!-- Control Buttons -->
            <div class="flex items-center justify-center gap-4">
                <!-- Play/Pause -->
                <button 
                    @click="togglePlay"
                    class="p-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                >
                    <svg v-if="isPlaying" class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                    <svg v-else class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
                    </svg>
                </button>

                <!-- Volume -->
                <div class="flex items-center space-x-2 bg-white/10 rounded-full px-3 py-2">
                    <svg class="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clip-rule="evenodd" />
                    </svg>
                    <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.1" 
                        :value="volume"
                        @input="handleVolumeChange(parseFloat(($event.target as HTMLInputElement).value))"
                        class="w-20 h-1 bg-gray-500 rounded-full appearance-none cursor-pointer accent-blue-500"
                    />
                </div>

                <!-- Reset View -->
                <button 
                    @click="resetTransform"
                    class="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                    title="Reset View"
                >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
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
