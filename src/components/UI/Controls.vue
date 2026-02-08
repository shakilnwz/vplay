<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import type { useVideoPlayer } from '../../hooks/useVideoPlayer';
import type { useViewControls } from '../../hooks/useViewControls';

const props = defineProps<{
    videoPlayer: ReturnType<typeof useVideoPlayer>;
    viewControls: ReturnType<typeof useViewControls>;
    currentVideo: File | null;
    invertStereo: boolean;
}>();

const emit = defineEmits<{
    (e: 'lock'): void;
    (e: 'recenter'): void;
    (e: 'toggleInvertStereo'): void;
}>();

const {
    isPlaying,
    volume,
    currentTime,
    duration,
    playbackSpeed,
    togglePlay,
    handleVolumeChange,
    handleSeek,
    handlePlaybackSpeedChange
} = props.videoPlayer;

const {
    viewMode,
    isSBS,
    sbsFormat,
    gyroEnabled,
    enableGyro,
    orientationLocked,
    toggleOrientationLock
} = props.viewControls;

const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Accordion: starts expanded, auto-collapses after 4s of playback
const expanded = ref(true);
const AUTO_COLLAPSE_MS = 4000;
let autoCollapseTimer: ReturnType<typeof setTimeout> | null = null;

const toggleAccordion = () => {
    expanded.value = !expanded.value;
};

const clearAutoCollapseTimer = () => {
    if (autoCollapseTimer) {
        clearTimeout(autoCollapseTimer);
        autoCollapseTimer = null;
    }
};

watch(() => props.videoPlayer.isPlaying.value, (isPlaying) => {
    clearAutoCollapseTimer();
    if (isPlaying) {
        autoCollapseTimer = setTimeout(() => {
            expanded.value = false;
            autoCollapseTimer = null;
        }, AUTO_COLLAPSE_MS);
    }
});

watch(() => props.currentVideo, () => {
    expanded.value = true;
});

onMounted(() => {
    if (props.videoPlayer.isPlaying.value) {
        autoCollapseTimer = setTimeout(() => {
            expanded.value = false;
            autoCollapseTimer = null;
        }, AUTO_COLLAPSE_MS);
    }
});

onUnmounted(clearAutoCollapseTimer);

const handleFullscreen = () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.log('Fullscreen error:', err);
        });
    } else {
        document.exitFullscreen();
    }
};

// Unified Button Styles
const buttonBaseClass = "flex items-center justify-center p-2 sm:p-2.5 rounded-lg border border-white/20 transition-all duration-200 font-medium text-xs sm:text-sm h-full grow whitespace-nowrap w-max";
const buttonActive = "bg-blue-600 text-white hover:bg-blue-500";
const buttonInactive = "bg-white/10 text-white hover:bg-white/20";

// Select Style
const selectClass = "p-2 sm:p-2.5 bg-white/10 rounded-lg text-xs sm:text-sm text-white border border-white/5 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer hover:bg-white/20 transition-all min-w-20 flex-shrink grow w-max block";
</script>

<template>
    <div v-if="currentVideo" :class="['p-2 flex flex-col gap-2 m-4 rounded-xl border ', expanded ? 'bg-black/60 border-white/20' : 'bg-black/10 border-white/10']">
        <div class="flex items-center gap-2">


            <!-- Compact Row: Play/Pause + Accordion Toggle (always visible) -->
            <button 
            @click="togglePlay" 
            :class="[
                'p-1.5 rounded-full transition-all duration-200 text-white border border-white/20 flex-shrink-0',
                isPlaying ? 'bg-blue-600 hover:bg-blue-500' : 'bg-white/10 hover:bg-white/20'
            ]">
                <svg v-if="isPlaying" class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                        clip-rule="evenodd" />
                </svg>
                <svg v-else class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                        clip-rule="evenodd" />
                </svg>
            </button>

        <!-- Progress Bar - always visible -->
            <div class="flex items-center space-x-3 px-1 grow">
                <span class="text-xs font-mono text-gray-400 w-10 text-right">{{ formatTime(currentTime) }}</span>
                <input type="range" min="0" :max="duration || 0" :value="currentTime"
                    @input="handleSeek(parseFloat(($event.target as HTMLInputElement).value))"
                    class="flex-1 h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 transition-all" />
                <span class="text-xs font-mono text-gray-400 w-10">{{ formatTime(duration) }}</span>
            </div>


            <button 
                @click="toggleAccordion" 
                class="p-1.5 rounded-full transition-all duration-200 text-white border border-white/20 flex-shrink-0 bg-white/10 hover:bg-white/20"
                :title="expanded ? 'Collapse controls' : 'Expand controls'">
                <svg class="w-5 h-5 transition-transform duration-200" :class="{ 'rotate-180': expanded }" fill="none"
                    stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
            </button>
        </div>

        <!-- Accordion: Expanded content -->
        <Transition
            enter-active-class="transition-all duration-300 ease-out overflow-hidden"
            enter-from-class="opacity-0 max-h-0"
            enter-to-class="opacity-100 max-h-[600px]"
            leave-active-class="transition-all duration-300 ease-in overflow-hidden"
            leave-from-class="opacity-100 max-h-[600px]"
            leave-to-class="opacity-0 max-h-0"
        >
            <div v-show="expanded" class="space-y-2 overflow-hidden">
                <!-- Video Title -->
                <div class="text-lg font-bold truncate text-white/90 drop-shadow-sm px-1">{{ currentVideo.name }}</div>

                <div class="flex items-center justify-between flex-wrap gap-2 w-full">
                    <div class="flex items-center gap-2 overflow-x-auto no-scrollbar w-full whitespace-nowrap [&:-webkit-scrollbar]:w-0 [&:-webkit-scrollbar]:h-0">
                        <!-- Volume -->
                        <div class="flex items-center space-x-2 bg-white/5 p-1.75 rounded-lg px-3 flex-shrink-0 h-full">
                            <svg class="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clip-rule="evenodd" />
                            </svg>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                :value="volume"
                                @input="handleVolumeChange(parseFloat(($event.target as HTMLInputElement).value))"
                                class="w-25 h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400"
                            />
                        </div>

                        <!-- Playback Speed -->
                        <select
                            v-model="playbackSpeed"
                            @change="handlePlaybackSpeedChange(parseFloat(($event.target as HTMLSelectElement).value))"
                            :class="selectClass"
                        >
                            <option :value="0.25" class="bg-gray-800">0.25x</option>
                            <option :value="0.5" class="bg-gray-800">0.5x</option>
                            <option :value="0.75" class="bg-gray-800">0.75x</option>
                            <option :value="1.0" class="bg-gray-800">1x</option>
                            <option :value="1.25" class="bg-gray-800">1.25x</option>
                            <option :value="1.5" class="bg-gray-800">1.5x</option>
                            <option :value="2.0" class="bg-gray-800">2x</option>
                        </select>

                        <!-- View Mode -->
                        <select
                            v-model="viewMode"
                            :class="selectClass"
                        >
                            <option value="360" class="bg-gray-800">🔄</option>
                            <option value="180" class="bg-gray-800">🌐</option>
                            <option value="flat" class="bg-gray-800">▦</option>
                        </select>

                        <!-- Recenter -->
                        <button
                            @click="$emit('recenter')"
                            :class="[buttonBaseClass, buttonInactive]"
                            title="Recenter View"
                        >
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>

                        <!-- SBS Toggle -->
                        <button
                            v-if="viewMode === '360' || viewMode === '180'"
                            @click="isSBS = !isSBS"
                            :class="[buttonBaseClass, isSBS ? buttonActive : buttonInactive]"
                        >
                            {{ isSBS ? 'SBS: ON' : 'SBS: OFF' }}
                        </button>

                        <!-- SBS Format Toggle -->
                        <button
                            v-if="isSBS && (viewMode === '360' || viewMode === '180')"
                            @click="sbsFormat = sbsFormat === 'horizontal' ? 'vertical' : 'horizontal'"
                            :class="[buttonBaseClass, buttonInactive]"
                        >
                            {{ sbsFormat === 'horizontal' ? '⬅️➡️ H' : '⬆️⬇️ V' }}
                        </button>

                        <!-- Eye Swap / Invert Stereo -->
                        <button
                            v-if="isSBS && (viewMode === '360' || viewMode === '180')"
                            @click="$emit('toggleInvertStereo')"
                            :class="[buttonBaseClass, invertStereo ? buttonActive : buttonInactive]"
                            title="Swap Eyes (Invert Stereo)"
                        >
                            {{ invertStereo ? '👁️↔️ Swapped' : '👁️↔️ Swap' }}
                        </button>

                        <!-- Orientation Lock (Mobile) -->
                        <button
                            @click="toggleOrientationLock"
                            :class="[buttonBaseClass, orientationLocked ? buttonActive : buttonInactive]"
                        >
                            {{ orientationLocked ? '🔒 Locked' : '🔓 Lock' }}
                        </button>

                        <!-- Gyroscope Toggle -->
                        <button
                            @click="enableGyro"
                            :class="[buttonBaseClass, gyroEnabled ? buttonActive : buttonInactive]"
                        >
                            {{ gyroEnabled ? '🎯 Gyro' : '📱 Gyro' }}
                        </button>

                        <!-- Fullscreen -->
                        <button
                            @click="handleFullscreen"
                            :class="[buttonBaseClass, buttonInactive]"
                            title="Fullscreen (F)"
                        >
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                            </svg>
                        </button>

                        <!-- UI Lock -->
                        <button
                            @click="$emit('lock')"
                            :class="[buttonBaseClass, buttonInactive]"
                            title="Lock Controls"
                        >
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div class="text-xs font-medium text-gray-400/80 text-center hidden sm:block pt-1">
                    Drag to look around • Space: Play/Pause • F: Fullscreen • Arrow keys: Seek • M: Mute
                </div>
            </div>
        </Transition>
    </div>
</template>
