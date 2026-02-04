import { useState, useEffect, useRef } from 'react'
import * as THREE from 'three';

function App() {
    const [videos, setVideos] = useState([]);
    const [currentVideo, setCurrentVideo] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [gyroEnabled, setGyroEnabled] = useState(false);
    const [viewMode, setViewMode] = useState('360'); // '360' or 'flat'
    const [volume, setVolume] = useState(1);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    const containerRef = useRef(null);
    const videoRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const rendererRef = useRef(null);
    const sphereRef = useRef(null);
    const animationIdRef = useRef(null);
    const isDraggingRef = useRef(false);
    const previousMousePositionRef = useRef({ x: 0, y: 0 });
    const rotationRef = useRef({ x: 0, y: 0 });

    // Handle file selection from device
    const handleFileSelect = (event) => {
        const files = Array.from(event.target.files).filter(file => 
            file.type.startsWith('video/')
        );
        setVideos(files);
        if (files.length > 0 && !currentVideo) {
            loadVideo(files[0]);
        }
    };

    // Load and play video
    const loadVideo = (file) => {
        setCurrentVideo(file);
        const url = URL.createObjectURL(file);
        if (videoRef.current) {
            videoRef.current.src = url;
            videoRef.current.load();
        }
    };

    // Initialize Three.js scene for 360 viewing
    useEffect(() => {
        if (!containerRef.current || !videoRef.current) return;

        // Scene setup
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(
            75,
            containerRef.current.clientWidth / containerRef.current.clientHeight,
            0.1,
            1000
        );
        camera.position.set(0, 0, 0.1);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        containerRef.current.appendChild(renderer.domElement);

        // Create sphere geometry for 360 video
        const geometry = new THREE.SphereGeometry(500, 60, 40);
        geometry.scale(-1, 1, 1); // Invert sphere to see from inside

        // Video texture
        const videoTexture = new THREE.VideoTexture(videoRef.current);
        videoTexture.minFilter = THREE.LinearFilter;
        videoTexture.magFilter = THREE.LinearFilter;

        // Create custom shader for SBS to equirectangular conversion
        const material = new THREE.ShaderMaterial({
            uniforms: {
                map: { value: videoTexture },
                isSBS: { value: 1.0 }
            },
            vertexShader: `
varying vec2 vUv;
void main() {
vUv = uv;
gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,
            fragmentShader: `
uniform sampler2D map;
uniform float isSBS;
varying vec2 vUv;

void main() {
vec2 uv = vUv;
// For SBS format, take only the left eye (first half)
if (isSBS > 0.5) {
uv.x = uv.x * 0.5;
}
gl_FragColor = texture2D(map, uv);
}
`
        });

        const sphere = new THREE.Mesh(geometry, material);
        scene.add(sphere);

        sceneRef.current = scene;
        cameraRef.current = camera;
        rendererRef.current = renderer;
        sphereRef.current = sphere;

        // Animation loop
        const animate = () => {
            animationIdRef.current = requestAnimationFrame(animate);

            if (cameraRef.current) {
                cameraRef.current.rotation.y = rotationRef.current.y;
                cameraRef.current.rotation.x = Math.max(
                    -Math.PI / 2,
                    Math.min(Math.PI / 2, rotationRef.current.x)
                );
            }

            renderer.render(scene, camera);
        };
        animate();

        // Handle window resize
        const handleResize = () => {
            if (!containerRef.current) return;
            const width = containerRef.current.clientWidth;
            const height = containerRef.current.clientHeight;
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
        };
        window.addEventListener('resize', handleResize);

        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
            if (animationIdRef.current) {
                cancelAnimationFrame(animationIdRef.current);
            }
            if (containerRef.current && renderer.domElement) {
                containerRef.current.removeChild(renderer.domElement);
            }
            geometry.dispose();
            material.dispose();
            renderer.dispose();
        };
    }, []);

    // Mouse drag controls
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleMouseDown = (e) => {
            isDraggingRef.current = true;
            previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
        };

        const handleMouseMove = (e) => {
            if (!isDraggingRef.current) return;

            const deltaX = e.clientX - previousMousePositionRef.current.x;
            const deltaY = e.clientY - previousMousePositionRef.current.y;

            rotationRef.current.y += deltaX * 0.005;
            rotationRef.current.x += deltaY * 0.005;

            previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
        };

        const handleMouseUp = () => {
            isDraggingRef.current = false;
        };

        container.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            container.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    // Touch controls for mobile
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleTouchStart = (e) => {
            if (e.touches.length === 1) {
                isDraggingRef.current = true;
                previousMousePositionRef.current = {
                    x: e.touches[0].clientX,
                    y: e.touches[0].clientY
                };
            }
        };

        const handleTouchMove = (e) => {
            if (!isDraggingRef.current || e.touches.length !== 1) return;

            const deltaX = e.touches[0].clientX - previousMousePositionRef.current.x;
            const deltaY = e.touches[0].clientY - previousMousePositionRef.current.y;

            rotationRef.current.y += deltaX * 0.005;
            rotationRef.current.x += deltaY * 0.005;

            previousMousePositionRef.current = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY
            };
        };

        const handleTouchEnd = () => {
            isDraggingRef.current = false;
        };

        container.addEventListener('touchstart', handleTouchStart);
        container.addEventListener('touchmove', handleTouchMove);
        container.addEventListener('touchend', handleTouchEnd);

        return () => {
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
        };
    }, []);

    // Gyroscope controls
    useEffect(() => {
        if (!gyroEnabled) return;

        const handleOrientation = (event) => {
            if (event.beta !== null && event.gamma !== null) {
                // Beta: front-to-back tilt (-180 to 180)
                // Gamma: left-to-right tilt (-90 to 90)
                rotationRef.current.x = (event.beta - 90) * (Math.PI / 180);
                rotationRef.current.y = event.gamma * (Math.PI / 180);
            }
        };

        window.addEventListener('deviceorientation', handleOrientation);

        return () => {
            window.removeEventListener('deviceorientation', handleOrientation);
        };
    }, [gyroEnabled]);

    // Request gyroscope permission (iOS 13+)
    const enableGyro = async () => {
        if (typeof DeviceOrientationEvent !== 'undefined' && 
            typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const permission = await DeviceOrientationEvent.requestPermission();
                if (permission === 'granted') {
                    setGyroEnabled(true);
                }
            } catch (error) {
                console.error('Gyroscope permission denied:', error);
            }
        } else {
            // For devices that don't require permission
            setGyroEnabled(true);
        }
    };

    // Video controls
    const togglePlay = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleVolumeChange = (e) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        if (videoRef.current) {
            videoRef.current.volume = newVolume;
        }
    };

    const handleSeek = (e) => {
        const newTime = parseFloat(e.target.value);
        setCurrentTime(newTime);
        if (videoRef.current) {
            videoRef.current.currentTime = newTime;
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Video event listeners
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleTimeUpdate = () => setCurrentTime(video.currentTime);
        const handleLoadedMetadata = () => setDuration(video.duration);
        const handleEnded = () => setIsPlaying(false);

        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        video.addEventListener('ended', handleEnded);

        return () => {
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            video.removeEventListener('ended', handleEnded);
        };
    }, []);

    return (
        <div className="flex h-screen bg-gray-900 text-white">
            {/* Sidebar - Video List */}
            <div className="w-80 bg-gray-800 p-4 overflow-y-auto">
                <h1 className="text-2xl font-bold mb-4">3D SBS Video Player</h1>

                <label className="block mb-4">
                    <span className="sr-only">Choose video files</span>
                    <input
                        type="file"
                        multiple
                        accept="all"
                        onChange={handleFileSelect}
                        className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                        webkitdirectory=""
                    />
                </label>

                <div className="space-y-2">
                    <h2 className="text-lg font-semibold mb-2">Videos ({videos.length})</h2>
                    {videos.map((video, index) => (
                        <button
                            key={index}
                            onClick={() => loadVideo(video)}
                            className={`w-full text-left p-3 rounded transition ${
currentVideo === video
? 'bg-blue-600'
: 'bg-gray-700 hover:bg-gray-600'
}`}
                        >
                            <div className="truncate font-medium">{video.name}</div>
                            <div className="text-xs text-gray-400">
                                {(video.size / 1024 / 1024).toFixed(2)} MB
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Video Player */}
            <div className="flex-1 flex flex-col">
                {/* Video Container */}
                <div 
                    ref={containerRef}
                    className="flex-1 bg-black relative cursor-grab active:cursor-grabbing"
                >
                    <video
                        ref={videoRef}
                        className="hidden"
                        crossOrigin="anonymous"
                        loop
                    />

                    {!currentVideo && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                                <svg className="w-24 h-24 mx-auto mb-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                                </svg>
                                <p className="text-xl text-gray-400">Select a video to start playing</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Controls */}
                {currentVideo && (
                    <div className="bg-gray-800 p-4 space-y-3">
                        {/* Video Title */}
                        <div className="text-lg font-semibold truncate">{currentVideo.name}</div>

                        {/* Progress Bar */}
                        <div className="flex items-center space-x-3">
                            <span className="text-sm text-gray-400 w-12">{formatTime(currentTime)}</span>
                            <input
                                type="range"
                                min="0"
                                max={duration || 0}
                                value={currentTime}
                                onChange={handleSeek}
                                className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                            <span className="text-sm text-gray-400 w-12">{formatTime(duration)}</span>
                        </div>

                        {/* Control Buttons */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                {/* Play/Pause */}
                                <button
                                    onClick={togglePlay}
                                    className="p-3 bg-blue-600 hover:bg-blue-700 rounded-full transition"
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
                                <div className="flex items-center space-x-2">
                                    <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                                    </svg>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.1"
                                        value={volume}
                                        onChange={handleVolumeChange}
                                        className="w-24 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                            </div>

                            {/* Gyroscope Toggle */}
                            <button
                                onClick={enableGyro}
                                className={`px-4 py-2 rounded transition ${
gyroEnabled
? 'bg-green-600 hover:bg-green-700'
: 'bg-gray-700 hover:bg-gray-600'
}`}
                            >
                                {gyroEnabled ? '🎯 Gyro ON' : '📱 Enable Gyro'}
                            </button>
                        </div>

                        {/* Info */}
                        <div className="text-sm text-gray-400 text-center">
                            Drag to look around • Use gyroscope on mobile • Playing SBS format (left eye)
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default App
