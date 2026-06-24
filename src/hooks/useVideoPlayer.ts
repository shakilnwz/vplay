import { ref, watch, onUnmounted } from 'vue';

interface UseVideoPlayerProps {
    onLoad?: () => void;
    onError?: (error: string) => void;
}

export function useVideoPlayer({ onLoad, onError }: UseVideoPlayerProps = {}) {
    const videoElement = ref<HTMLVideoElement | null>(null);
    const isPlaying = ref(false);
    const volume = ref(1);
    const currentTime = ref(0);
    const duration = ref(0);
    const playbackSpeed = ref(1);
    const isMuted = ref(false);

    const togglePlay = () => {
        if (videoElement.value) {
            if (isPlaying.value) {
                videoElement.value.pause();
            } else {
                videoElement.value.play();
            }
            isPlaying.value = !isPlaying.value;
        }
    };

    const handleVolumeChange = (newVolume: number) => {
        volume.value = newVolume;
        if (videoElement.value) {
            videoElement.value.volume = newVolume;
            // Unmute automatically if user adjusts volume up
            if (newVolume > 0 && isMuted.value) {
                isMuted.value = false;
                videoElement.value.muted = false;
            }
        }
    };

    const toggleMute = () => {
        isMuted.value = !isMuted.value;
        if (videoElement.value) {
            videoElement.value.muted = isMuted.value;
        }
    };

    const handleSeek = (newTime: number) => {
        currentTime.value = newTime;
        if (videoElement.value) {
            videoElement.value.currentTime = newTime;
        }
    };

    const handlePlaybackSpeedChange = (speed: number) => {
        playbackSpeed.value = speed;
        if (videoElement.value) {
            videoElement.value.playbackRate = speed;
        }
    };

    const handleTimeUpdate = () => {
        if (videoElement.value) {
            currentTime.value = videoElement.value.currentTime;
        }
    };

    const handleLoadedMetadata = () => {
        if (videoElement.value) {
            duration.value = videoElement.value.duration;
            if (onLoad) onLoad();
        }
    };

    const handleEnded = () => {
        isPlaying.value = false;
    };

    const handleError = () => {
        if (videoElement.value && videoElement.value.error && onError) {
            onError(videoElement.value.error.message || 'Video playback error');
        }
        isPlaying.value = false;
    };

    watch(videoElement, (newEl, oldEl) => {
        if (oldEl) {
            oldEl.removeEventListener('timeupdate', handleTimeUpdate);
            oldEl.removeEventListener('loadedmetadata', handleLoadedMetadata);
            oldEl.removeEventListener('ended', handleEnded);
            oldEl.removeEventListener('error', handleError);
        }
        if (newEl) {
            newEl.volume = volume.value;
            newEl.playbackRate = playbackSpeed.value;
            newEl.muted = isMuted.value;
            newEl.addEventListener('timeupdate', handleTimeUpdate);
            newEl.addEventListener('loadedmetadata', handleLoadedMetadata);
            newEl.addEventListener('ended', handleEnded);
            newEl.addEventListener('error', handleError);
        }
    });

    onUnmounted(() => {
        if (videoElement.value) {
            videoElement.value.removeEventListener('timeupdate', handleTimeUpdate);
            videoElement.value.removeEventListener('loadedmetadata', handleLoadedMetadata);
            videoElement.value.removeEventListener('ended', handleEnded);
            videoElement.value.removeEventListener('error', handleError);
        }
    });

    return {
        videoElement, // Explicitly return the ref for binding
        isPlaying,
        volume,
        currentTime,
        duration,
        playbackSpeed,
        isMuted,
        togglePlay,
        handleVolumeChange,
        toggleMute,
        handleSeek,
        handlePlaybackSpeedChange
    };
}
