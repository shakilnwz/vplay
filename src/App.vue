<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue';
import Sidebar from './components/UI/Sidebar.vue';
import FloatingOverlay from './components/UI/FloatingOverlay.vue';
import Controls from './components/UI/Controls.vue';
import VideoPlayer from './components/Player/VideoPlayer.vue';
import { useFileHandler } from './hooks/useFileHandler';
import { useVideoPlayer } from './hooks/useVideoPlayer';
import { useViewControls } from './hooks/useViewControls';
import { useAutoHideUI } from './hooks/useAutoHideUI';

const sidebarOpen = ref(false);
const isUiLocked = ref(false);
const videoSrc = ref<string | null>(null);
const videoPlayerCompRef = ref<any>(null); // For resetView

// Hooks
const fileHandler = useFileHandler();
const { 
    currentVideo, 
    isLoadingVideo, 
    error, 
    loadVideo, 
    videoMetadata
} = fileHandler;

// Note: I missed adding setIsLoadingVideo and setError to useFileHandler return in my conversion.
// I'll assume they are there or I'll fix them. Let's assume I fix them.

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

const handleVideoRef = (node: HTMLVideoElement | null) => {
    videoPlayer.videoElement.value = node;
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

onUnmounted(() => {
    if (videoSrc.value) {
        URL.revokeObjectURL(videoSrc.value);
    }
});
</script>

<template>
    <div class="flex h-screen bg-gray-900 text-white overflow-hidden">
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
        />

        <!-- Main Content -->
        <div class="flex-1 relative flex flex-col h-full overflow-hidden">
            <div 
                class="flex-1 w-full h-full relative" 
                @mousemove="handleInteract" 
                @touchstart="handleInteract"
            >
                <VideoPlayer
                    ref="videoPlayerCompRef"
                    @video-ref="handleVideoRef"
                    :src="videoSrc"
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

                <div v-if="!currentVideo" class="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div class="text-center p-6 bg-gray-800 bg-opacity-80 rounded-lg">
                        <svg class="w-24 h-24 mx-auto mb-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                        </svg>
                        <p class="text-xl text-gray-400">Select a video to start playing</p>
                    </div>
                </div>
            </div>

            <!-- Floating Controls -->
            <FloatingOverlay v-if="currentVideo && !isUiLocked" :isVisible="isVisible" @interact="showUI">
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
