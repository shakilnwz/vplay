import { useState, useCallback, useEffect } from 'react';

interface UseVideoPlayerProps {
    onLoad?: () => void;
    onError?: (error: string) => void;
}

export function useVideoPlayer({ onLoad, onError }: UseVideoPlayerProps = {}) {
    const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(1);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);

    // Callback ref to capture the video element
    const videoRef = useCallback((node: HTMLVideoElement | null) => {
        if (node) {
            setVideoElement(node);
        }
    }, []);

    const togglePlay = useCallback(() => {
        if (videoElement) {
            if (isPlaying) {
                videoElement.pause();
            } else {
                videoElement.play();
            }
            setIsPlaying(!isPlaying);
        }
    }, [isPlaying, videoElement]);

    const handleVolumeChange = (newVolume: number) => {
        setVolume(newVolume);
        if (videoElement) {
            videoElement.volume = newVolume;
        }
    };

    const handleSeek = (newTime: number) => {
        setCurrentTime(newTime);
        if (videoElement) {
            videoElement.currentTime = newTime;
        }
    };

    const handlePlaybackSpeedChange = (speed: number) => {
        setPlaybackSpeed(speed);
        if (videoElement) {
            videoElement.playbackRate = speed;
        }
    };

    useEffect(() => {
        if (!videoElement) return;

        const handleTimeUpdate = () => setCurrentTime(videoElement.currentTime);
        const handleLoadedMetadata = () => {
            setDuration(videoElement.duration);
            if (onLoad) onLoad();
        };
        const handleEnded = () => setIsPlaying(false);
        const handleError = () => {
            // Basic error handling
            if (videoElement.error && onError) {
                onError(videoElement.error.message || 'Video playback error');
            }
            setIsPlaying(false);
        };

        // Re-apply states if element changes
        videoElement.volume = volume;
        videoElement.playbackRate = playbackSpeed;

        videoElement.addEventListener('timeupdate', handleTimeUpdate);
        videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
        videoElement.addEventListener('ended', handleEnded);
        videoElement.addEventListener('error', handleError);

        return () => {
            videoElement.removeEventListener('timeupdate', handleTimeUpdate);
            videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
            videoElement.removeEventListener('ended', handleEnded);
            videoElement.removeEventListener('error', handleError);
        };
    }, [videoElement, onLoad, onError]); // volume/speed not deps as they are set on change but initialized here

    return {
        videoRef, // Pass this to the <video> element
        videoElement, // Access the element if needed
        isPlaying,
        volume,
        currentTime,
        duration,
        playbackSpeed,
        togglePlay,
        handleVolumeChange,
        handleSeek,
        handlePlaybackSpeedChange,
        setIsPlaying
    };
}
