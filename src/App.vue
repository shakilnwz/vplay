<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import Sidebar from './components/UI/Sidebar.vue';
import FloatingOverlay from './components/UI/FloatingOverlay.vue';
import Controls from './components/UI/Controls.vue';
import VideoPlayer from './components/Player/VideoPlayer.vue';
import PortraitPlayer from './components/Player/PortraitPlayer.vue';
import { useFileHandler } from './hooks/useFileHandler';
import { useVideoPlayer } from './hooks/useVideoPlayer';
import { useViewControls } from './hooks/useViewControls';
import { useAutoHideUI } from './hooks/useAutoHideUI';

const sidebarOpen = ref(false);
const isUiLocked = ref(false);
const videoSrc = ref<string | null>(null);
const videoPlayerCompRef = ref<any>(null); // For resetView
const videoContainerRef = ref<HTMLElement | null>(null);
const sharedVideoRef = ref<HTMLVideoElement | null>(null);
const hiddenVideoContainerRef = ref<HTMLDivElement | null>(null);

// Hooks
const fileHandler = useFileHandler();
const { 
    currentVideo, 
    isLoadingVideo, 
    error, 
    loadVideo, 
    videoMetadata,
    videos
} = fileHandler;

const videoPlayer = useVideoPlayer({
    onLoad: () => { isLoadingVideo.value = false; },
    onError: (msg) => {
        isLoadingVideo.value = false;
        error.value = msg;
    }
});

const viewControls = useViewControls();
const { isVisible, showUI } = useAutoHideUI(videoPlayer.isPlaying);

const handleInteract = () => {
    if (!isUiLocked.value) {
        showUI();
    }
};

const handleRecenter = () => {
    if (videoPlayerCompRef.value) {
        videoPlayerCompRef.value.resetView();
    }
};

const SEEK_DELTA = 15;
const DOUBLE_TAP_MS = 300;
let lastTapTime = 0;
let lastTapSide: 'left' | 'right' | null = null;

const handleSeekByDelta = (delta: number) => {
    const t = videoPlayer.currentTime.value + delta;
    const dur = videoPlayer.duration.value || Infinity;
    videoPlayer.handleSeek(Math.max(0, Math.min(t, dur)));
};

const handleTouchStart = (e: TouchEvent) => {
    handleInteract();
    if (!currentVideo.value || !e.touches.length || !videoContainerRef.value) return;
    const rect = videoContainerRef.value.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    const relativeX = x / rect.width;
    // Only handle double-tap in left 15% or right 15% of screen
    if (relativeX > 0.15 && relativeX < 0.85) return;
    const side: 'left' | 'right' = relativeX <= 0.15 ? 'left' : 'right';
    const now = Date.now();
    if (now - lastTapTime < DOUBLE_TAP_MS && lastTapSide === side) {
        handleSeekByDelta(side === 'left' ? -SEEK_DELTA : SEEK_DELTA);
        lastTapTime = now - DOUBLE_TAP_MS;
        lastTapSide = null;
    } else {
        lastTapTime = now;
        lastTapSide = side;
    }
};

const handleDblClick = (e: MouseEvent) => {
    if (!currentVideo.value) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const relativeX = (e.clientX - rect.left) / rect.width;
    // Only handle double-click in left 15% or right 15% of screen
    if (relativeX > 0.15 && relativeX < 0.85) return;
    const side = relativeX <= 0.15 ? 'left' : 'right';
    handleSeekByDelta(side === 'left' ? -SEEK_DELTA : SEEK_DELTA);
};

// Keyboard shortcuts
const handleKeyDown = (e: KeyboardEvent) => {
    if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'SELECT') {
        return;
    }

    switch (e.code) {
        case 'Space':
            e.preventDefault();
            videoPlayer.togglePlay();
            handleInteract();
            break;
        case 'ArrowLeft':
            e.preventDefault();
            handleSeekByDelta(-SEEK_DELTA);
            handleInteract();
            break;
        case 'ArrowRight':
            e.preventDefault();
            handleSeekByDelta(SEEK_DELTA);
            handleInteract();
            break;
        case 'ArrowUp':
            e.preventDefault();
            videoPlayer.handleVolumeChange(Math.min(1, videoPlayer.volume.value + 0.1));
            handleInteract();
            break;
        case 'ArrowDown':
            e.preventDefault();
            videoPlayer.handleVolumeChange(Math.max(0, videoPlayer.volume.value - 0.1));
            handleInteract();
            break;
        case 'KeyM':
            e.preventDefault();
            videoPlayer.toggleMute();
            handleInteract();
            break;
        case 'KeyF':
            e.preventDefault();
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => console.log(err));
            } else {
                document.exitFullscreen();
            }
            handleInteract();
            break;
        case 'KeyR':
        case 'KeyC':
            if (viewControls.playerMode.value === 'vr') {
                e.preventDefault();
                handleRecenter();
            }
            break;
    }
};

// Watch current video to create blob URL
watch(currentVideo, (newVideo) => {
    if (videoSrc.value) {
        URL.revokeObjectURL(videoSrc.value);
    }
    if (newVideo) {
        videoSrc.value = URL.createObjectURL(newVideo);
    } else {
        videoSrc.value = null;
    }
});

// Watch playerMode to return video element to hidden container if switching to VR
watch(viewControls.playerMode, (mode) => {
    if (mode === 'vr' && sharedVideoRef.value && hiddenVideoContainerRef.value) {
        if (!hiddenVideoContainerRef.value.contains(sharedVideoRef.value)) {
            hiddenVideoContainerRef.value.appendChild(sharedVideoRef.value);
        }
    }
});

onMounted(() => {
    window.addEventListener('keydown', handleKeyDown);
    if (sharedVideoRef.value) {
        videoPlayer.videoElement.value = sharedVideoRef.value;
    }
});

onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown);
    if (videoSrc.value) {
        URL.revokeObjectURL(videoSrc.value);
    }
});
</script>

<template>
    <div class="flex h-screen bg-gray-900 text-white overflow-hidden">
        <!-- Persistent Hidden Container for Shared Video Element -->
        <div v-show="false" ref="hiddenVideoContainerRef">
            <video
                ref="sharedVideoRef"
                :src="videoSrc || undefined"
                class="hidden"
                playsinline
                crossorigin="anonymous"
                loop
                autoplay
            />
        </div>

        <!-- Mobile Sidebar Toggle -->
        <button
            v-if="!isUiLocked"
            @click="sidebarOpen = !sidebarOpen; showUI()"
            :class="[
                'fixed top-4 left-4 z-50 p-2 bg-blue-600 rounded-lg lg:hidden transition-opacity duration-500',
                isVisible || sidebarOpen ? 'opacity-100' : 'opacity-0'
            ]"
        >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path v-if="sidebarOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
        </button>

        <!-- Unlock Button (Visible only when locked) -->
        <button
            v-if="isUiLocked"
            @click="isUiLocked = false"
            class="fixed top-4 right-4 z-50 p-2 bg-black/20 backdrop-blur-sm ring-1 ring-white/50 rounded-full border border-white/20 hover:bg-black/30 transition-all"
        >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
        </button>

        <!-- Sidebar - Video List -->
        <Sidebar
            :isOpen="sidebarOpen && !isUiLocked"
            :fileHandler="fileHandler"
            v-model:playerMode="viewControls.playerMode.value"
            @close="sidebarOpen = false"
        />

        <!-- Main Content -->
        <div class="flex-1 relative flex flex-col h-full overflow-hidden">
            <div
                ref="videoContainerRef"
                class="flex-1 w-full h-full relative"
                @mousemove="handleInteract"
                @touchstart="handleTouchStart"
                @dblclick="handleDblClick"
            >
                <!-- VR Mode Player -->
                <VideoPlayer
                    v-if="viewControls.playerMode.value === 'vr'"
                    ref="videoPlayerCompRef"
                    :videoElement="sharedVideoRef"
                    :viewMode="viewControls.viewMode.value"
                    :isSBS="viewControls.isSBS.value"
                    :sbsFormat="viewControls.sbsFormat.value"
                    :invertStereo="viewControls.invertStereo.value"
                    :gyroEnabled="viewControls.gyroEnabled.value"
                    :isLoading="isLoadingVideo"
                    :error="error"
                    @retry="currentVideo && loadVideo(currentVideo)"
                    :width="currentVideo ? videoMetadata.get(currentVideo.name)?.width : undefined"
                    :height="currentVideo ? videoMetadata.get(currentVideo.name)?.height : undefined"
                />

                <!-- Portrait Mode Player -->
                <PortraitPlayer
                    v-else
                    :videoElement="sharedVideoRef"
                    :videoPlayer="videoPlayer"
                    :isLoading="isLoadingVideo"
                    :error="error"
                    :currentVideo="currentVideo"
                    :videos="videos"
                    :isUiLocked="isUiLocked"
                    @retry="currentVideo && loadVideo(currentVideo)"
                    @load-video="loadVideo"
                    @interact="handleInteract"
                    @ui-lock-change="(locked: boolean) => isUiLocked = locked"
                />
            </div>

            <!-- Floating Controls (VR mode only, always shown when video playing so double-tap seek works; controls hidden when locked) -->
            <FloatingOverlay
              v-if="currentVideo && viewControls.playerMode.value === 'vr'"
              :isVisible="isVisible && !isUiLocked"
              @interact="showUI"
              @seek="handleSeekByDelta"
            >
                <Controls
                    :videoPlayer="videoPlayer"
                    :viewControls="viewControls"
                    :currentVideo="currentVideo"
                    @lock="isUiLocked = true"
                    @recenter="handleRecenter"
                    :invertStereo="viewControls.invertStereo.value"
                    @toggle-invert-stereo="viewControls.invertStereo.value = !viewControls.invertStereo.value"
                />
            </FloatingOverlay>
        </div>
    </div>
</template>
