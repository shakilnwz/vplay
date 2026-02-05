import { useCallback } from 'react';
import { useVideoPlayer } from '../../hooks/useVideoPlayer';
import { useViewControls } from '../../hooks/useViewControls';

interface ControlsProps {
    videoPlayer: ReturnType<typeof useVideoPlayer>;
    viewControls: ReturnType<typeof useViewControls>;
    currentVideo: File | null;
    onLock: () => void;
    onRecenter: () => void;
    invertStereo: boolean;
    toggleInvertStereo: () => void;
}

// Removed duplicate
export function Controls({ videoPlayer, viewControls, currentVideo, onLock, onRecenter, invertStereo, toggleInvertStereo }: ControlsProps) {
    const {
        isPlaying,
        volume,
        // ... (rest is same until button group)

        // I will just replace the Props interface and the last button group part to be safe and efficient.
        // Wait, replace_file_content needs contiguous block. 
        // I'll replace the Interface & Function Signature first, then the Button Group.

        // Actually, I'll do it in two chunks or one large if safe. The file is small enough.
        // Let's do two chunks for clarity.

        currentTime,
        duration,
        playbackSpeed,
        togglePlay,
        handleVolumeChange,
        handleSeek,
        handlePlaybackSpeedChange
    } = videoPlayer;

    const {
        viewMode,
        setViewMode,
        isSBS,
        setIsSBS,
        sbsFormat,
        setSbsFormat,
        gyroEnabled,
        enableGyro,
        orientationLocked,
        toggleOrientationLock
    } = viewControls;

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.log('Fullscreen error:', err);
            });
        } else {
            document.exitFullscreen();
        }
    }, []);

    if (!currentVideo) return null;

    // Unified Button Styles
    const buttonBaseClass = "flex items-center justify-center p-2 sm:p-2.5 rounded-lg transition-all duration-200 font-medium text-xs sm:text-sm h-full grow";
    const buttonActive = "bg-blue-600 text-white shadow-lg shadow-blue-500/30 hover:bg-blue-500";
    const buttonInactive = "bg-white/10 text-white hover:bg-white/20 backdrop-blur-md";

    // Select Style
    const selectClass = "p-2 sm:p-2.5 bg-white/10 rounded-lg text-xs sm:text-sm text-white border border-white/5 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer backdrop-blur-md hover:bg-white/20 transition-all min-w-0 flex-shrink grow w-max block";

    return (
        <div className="bg-black/40 backdrop-blur-sm p-2 space-y-2 m-4 rounded-2xl border border-white/10 shadow-2xl">
            {/* Video Title */}
            <div className="text-lg font-bold truncate text-white/90 drop-shadow-sm px-1">{currentVideo.name}</div>

            {/* Progress Bar */}
            <div className="flex items-center space-x-3 px-1">
                <span className="text-xs font-mono text-gray-400 w-10 text-right">{formatTime(currentTime)}</span>
                <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    value={currentTime}
                    onChange={(e) => handleSeek(parseFloat(e.target.value))}
                    className="flex-1 h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 transition-all"
                />
                <span className="text-xs font-mono text-gray-400 w-10">{formatTime(duration)}</span>
            </div>

            {/* Control Buttons - Top Row */}
            <div className="flex items-center justify-between flex-wrap gap-2 w-full">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full">
                    {/* Play/Pause */}
                    <button
                        onClick={togglePlay}
                        className={`p-1.75 rounded-full transition-all duration-200 text-white shadow-lg flex-shrink-0 ${isPlaying
                            ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/30'
                            : 'bg-white/10 hover:bg-white/20'}`}
                    >
                        {isPlaying ? (
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                        ) : (
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                            </svg>
                        )}
                    </button>

                    {/* Volume */}
                    <div className="flex items-center space-x-2 bg-white/5 p-1.5 rounded-lg px-3 flex-shrink-0">
                        <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                        </svg>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={volume}
                            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                            className="w-20 h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400"
                        />
                    </div>

                    {/* Playback Speed */}
                    <select
                        value={playbackSpeed}
                        onChange={(e) => handlePlaybackSpeedChange(parseFloat(e.target.value))}
                        className={selectClass}
                    >
                        <option value="0.25" className="bg-gray-800">0.25x</option>
                        <option value="0.5" className="bg-gray-800">0.5x</option>
                        <option value="0.75" className="bg-gray-800">0.75x</option>
                        <option value="1" className="bg-gray-800">1x</option>
                        <option value="1.25" className="bg-gray-800">1.25x</option>
                        <option value="1.5" className="bg-gray-800">1.5x</option>
                        <option value="2" className="bg-gray-800">2x</option>
                    </select>

                    {/* View Mode */}
                    <select
                        value={viewMode}
                        onChange={(e) => setViewMode(e.target.value as any)}
                        className={selectClass}
                    >
                        <option value="360" className="bg-gray-800">🔄</option>
                        <option value="180" className="bg-gray-800">🌐</option>
                        <option value="flat" className="bg-gray-800">▦</option>
                    </select>
                </div>

                <div className="flex items-center gap-2 flex-wrap justify-between">
                    {/* Recenter */}
                    <button
                        onClick={onRecenter}
                        className={`${buttonBaseClass} ${buttonInactive}`}
                        title="Recenter View"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>

                    {/* SBS Toggle */}
                    {(viewMode === '360' || viewMode === '180') && (
                        <button
                            onClick={() => setIsSBS(prev => !prev)}
                            className={`${buttonBaseClass} ${isSBS ? buttonActive : buttonInactive}`}
                        >
                            {isSBS ? 'SBS: ON' : 'SBS: OFF'}
                        </button>
                    )}

                    {/* SBS Format Toggle */}
                    {isSBS && (viewMode === '360' || viewMode === '180') && (
                        <button
                            onClick={() => setSbsFormat(prev => prev === 'horizontal' ? 'vertical' : 'horizontal')}
                            className={`${buttonBaseClass} ${buttonInactive}`}
                        >
                            {sbsFormat === 'horizontal' ? '⬅️➡️ H' : '⬆️⬇️ V'}
                        </button>
                    )}

                    {/* Eye Swap / Invert Stereo */}
                    {isSBS && (viewMode === '360' || viewMode === '180') && (
                        <button
                            onClick={toggleInvertStereo}
                            className={`${buttonBaseClass} ${invertStereo ? buttonActive : buttonInactive}`}
                            title="Swap Eyes (Invert Stereo)"
                        >
                            {invertStereo ? '👁️↔️ Swapped' : '👁️↔️ Swap'}
                        </button>
                    )}

                    {/* Orientation Lock (Mobile) */}
                    <button
                        onClick={toggleOrientationLock}
                        className={`${buttonBaseClass} ${orientationLocked ? buttonActive : buttonInactive}`}
                    >
                        {orientationLocked ? '🔒 Locked' : '🔓 Lock'}
                    </button>

                    {/* Gyroscope Toggle */}
                    <button
                        onClick={enableGyro}
                        className={`${buttonBaseClass} ${gyroEnabled ? buttonActive : buttonInactive}`}
                    >
                        {gyroEnabled ? '🎯 Gyro' : '📱 Gyro'}
                    </button>

                    {/* Fullscreen */}
                    <button
                        onClick={handleFullscreen}
                        className={`${buttonBaseClass} ${buttonInactive}`}
                        title="Fullscreen (F)"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        </svg>
                    </button>

                    {/* UI Lock */}
                    <button
                        onClick={onLock}
                        className={`${buttonBaseClass} ${buttonInactive}`}
                        title="Lock Controls"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </button>
                </div>
            </div>

            <div className="text-xs font-medium text-gray-400/80 text-center hidden sm:block pt-1">
                Drag to look around • Space: Play/Pause • F: Fullscreen • Arrow keys: Seek • M: Mute
            </div>
        </div>
    );
}
