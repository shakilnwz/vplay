import { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/UI/Sidebar';
import { FloatingOverlay } from './components/UI/FloatingOverlay';
import { Controls } from './components/UI/Controls';
import { VideoPlayer } from './components/Player/VideoPlayer';
import type { VideoPlayerHandle } from './components/Player/VideoPlayer';
import { useFileHandler } from './hooks/useFileHandler';
import { useVideoPlayer } from './hooks/useVideoPlayer';
import { useViewControls } from './hooks/useViewControls';
import { useAutoHideUI } from './hooks/useAutoHideUI';

function App() {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Hooks
    const fileHandler = useFileHandler();
    const { setIsLoadingVideo, setError } = fileHandler;

    const videoPlayer = useVideoPlayer({
        onLoad: () => setIsLoadingVideo(false),
        onError: (msg) => {
            setIsLoadingVideo(false);
            setError(msg);
        }
    });

    const viewControls = useViewControls();

    const { currentVideo, isLoadingVideo, error, loadVideo, videoMetadata } = fileHandler;
    const { videoRef, isPlaying } = videoPlayer;
    const { viewMode, isSBS, sbsFormat, gyroEnabled, invertStereo, setInvertStereo } = viewControls;

    const { isVisible, showUI } = useAutoHideUI(isPlaying);

    const [videoSrc, setVideoSrc] = useState<string | null>(null);
    const [isUiLocked, setIsUiLocked] = useState(false);

    // Ref to access VideoPlayer methods
    const videoPlayerRef = useRef<VideoPlayerHandle>(null);

    // Create URL for video file
    useEffect(() => {
        if (currentVideo) {
            const url = URL.createObjectURL(currentVideo);
            setVideoSrc(url);
            return () => URL.revokeObjectURL(url);
        } else {
            setVideoSrc(null);
        }
    }, [currentVideo]);

    // Removed handleRetry as it is defined inline

    const handleInteract = () => {
        if (!isUiLocked) {
            showUI();
        }
    };

    const handleRecenter = () => {
        if (videoPlayerRef.current) {
            videoPlayerRef.current.resetView();
        }
    };

    return (
        <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
            {/* Mobile Sidebar Toggle */}
            {!isUiLocked && (
                <button
                    onClick={() => {
                        setSidebarOpen(!sidebarOpen);
                        showUI();
                    }}
                    className={`fixed top-4 left-4 z-50 p-2 bg-blue-600 rounded-lg lg:hidden transition-opacity duration-500 ${isVisible || sidebarOpen ? 'opacity-100' : 'opacity-0'}`}
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {sidebarOpen ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        )}
                    </svg>
                </button>
            )}

            {/* Unlock Button (Visible only when locked) */}
            {isUiLocked && (
                <button
                    onClick={() => setIsUiLocked(false)}
                    className="fixed top-4 right-4 z-50 p-3 bg-black bg-opacity-50 rounded-full border border-white/20 hover:bg-opacity-70 transition-all"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                </button>
            )}

            {/* Sidebar - Video List */}
            <Sidebar
                isOpen={sidebarOpen && !isUiLocked}
                fileHandler={fileHandler}
            />

            {/* Main Content */}
            <div className="flex-1 relative flex flex-col h-full overflow-hidden">
                <div className="flex-1 w-full h-full relative" onMouseMove={handleInteract} onTouchStart={handleInteract}>
                    <VideoPlayer
                        ref={videoPlayerRef}
                        videoRef={videoRef}
                        src={videoSrc}
                        viewMode={viewMode}
                        isSBS={isSBS}
                        sbsFormat={sbsFormat}
                        invertStereo={invertStereo}
                        gyroEnabled={gyroEnabled}
                        isLoading={isLoadingVideo}
                        error={error}
                        onRetry={() => currentVideo && loadVideo(currentVideo)}
                        width={videoMetadata.get(currentVideo?.name || '')?.width}
                        height={videoMetadata.get(currentVideo?.name || '')?.height}
                    />

                    {!currentVideo && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="text-center p-6 bg-gray-800 bg-opacity-80 rounded-lg">
                                <svg className="w-24 h-24 mx-auto mb-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                                </svg>
                                <p className="text-xl text-gray-400">Select a video to start playing</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Floating Controls */}
                {currentVideo && !isUiLocked && (
                    <FloatingOverlay isVisible={isVisible} onInteract={showUI}>
                        <Controls
                            videoPlayer={videoPlayer}
                            viewControls={viewControls}
                            currentVideo={currentVideo}
                            onLock={() => setIsUiLocked(true)}
                            onRecenter={handleRecenter}
                            invertStereo={invertStereo}
                            toggleInvertStereo={() => setInvertStereo(prev => !prev)}
                        />
                    </FloatingOverlay>
                )}
            </div>
        </div>
    );
}

export default App;
