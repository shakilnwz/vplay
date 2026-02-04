import { useState, useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three';

function App() {
    const [videos, setVideos] = useState<File[]>([]);
    const [currentVideo, setCurrentVideo] = useState<File | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [gyroEnabled, setGyroEnabled] = useState(false);
    const [viewMode, setViewMode] = useState('360');
    const [volume, setVolume] = useState(1);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [directoryPath, setDirectoryPath] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [orientationLocked, setOrientationLocked] = useState(false);
    const [sortOrder, setSortOrder] = useState('name');
    const [sortDirection, setSortDirection] = useState('asc');
    const [filterQuery, setFilterQuery] = useState('');
    const [filterExtension, setFilterExtension] = useState('all');
    const [videoMetadata, setVideoMetadata] = useState<Map<string, { duration: number; width: number; height: number }>>(new Map());
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [isLoadingVideo, setIsLoadingVideo] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sbsFormat, setSbsFormat] = useState<'horizontal' | 'vertical'>('horizontal');
    const [isSBS, setIsSBS] = useState(true);

    const containerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sphereRef = useRef<THREE.Mesh | null>(null);
    const materialRef = useRef<THREE.ShaderMaterial | null>(null);
    const animationIdRef = useRef<number | null>(null);
    const isDraggingRef = useRef(false);
    const previousMousePositionRef = useRef({ x: 0, y: 0 });
    const rotationRef = useRef({ x: 0, y: 0 });

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []);
        const videoFiles = files.filter((file: File) =>
            file.type.startsWith('video/') ||
            file.name.match(/\.(mp4|webm|ogv|mov|mkv|avi|m4v|flv|wmv)$/i)
        );
        setVideos(videoFiles);
        if (videoFiles.length > 0 && !currentVideo) {
            loadVideo(videoFiles[0]);
        }
    };

    const handleDirectoryPicker = async () => {
        if ('showDirectoryPicker' in window) {
            try {
                const directoryHandle = await (window as Window & { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker();
                setIsScanning(true);
                const videoFiles: File[] = [];

                for await (const entry of (directoryHandle as unknown as { values: () => AsyncIterable<FileSystemHandle> }).values()) {
                    if ((entry as { kind: string }).kind === 'file') {
                        const file = await (entry as FileSystemFileHandle).getFile();
                        if (file.type.startsWith('video/') || file.name.match(/\.(mp4|webm|ogv|mov|mkv|avi|m4v|flv|wmv)$/i)) {
                            Object.defineProperty(file, 'webkitRelativePath', {
                                value: file.name,
                                writable: false
                            });
                            videoFiles.push(file);
                        }
                    }
                }

                setVideos(videoFiles);
                setDirectoryPath(directoryHandle.name);
                if (videoFiles.length > 0 && !currentVideo) {
                    loadVideo(videoFiles[0]);
                }
            } catch (error) {
                console.error('Directory picker error:', error);
            } finally {
                setIsScanning(false);
            }
        } else {
            alert('Your browser does not support the File System Access API. Please use Chrome or Edge, or use the file input below.');
        }
    };

    const loadVideo = (file: File) => {
        setError(null);
        setIsLoadingVideo(true);
        setCurrentVideo(file);
        const url = URL.createObjectURL(file);
        if (videoRef.current) {
            videoRef.current.src = url;
            videoRef.current.load();
        }
        extractVideoMetadata(file);
    };

    const handleVideoError = () => {
        setError('Failed to load video. Please try another file.');
        setIsLoadingVideo(false);
        setIsPlaying(false);
    };

    const handlePlaybackSpeedChange = (speed: number) => {
        setPlaybackSpeed(speed);
        if (videoRef.current) {
            videoRef.current.playbackRate = speed;
        }
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

    const extractVideoMetadata = async (file: File): Promise<{ duration: number; width: number; height: number } | null> => {
        const cached = videoMetadata.get(file.name);
        if (cached) return cached;

        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.onloadedmetadata = () => {
                const metadata = {
                    duration: video.duration,
                    width: video.videoWidth,
                    height: video.videoHeight
                };
                setVideoMetadata(prev => new Map(prev.set(file.name, metadata)));
                URL.revokeObjectURL(video.src);
                resolve(metadata);
            };
            video.onerror = () => {
                URL.revokeObjectURL(video.src);
                resolve(null);
            };
            video.src = URL.createObjectURL(file);
        });
    };

    const sortVideos = (videoList: File[]): File[] => {
        return [...videoList].sort((a, b) => {
            let comparison = 0;
            switch (sortOrder) {
                case 'name':
                    comparison = a.name.localeCompare(b.name);
                    break;
                case 'size':
                    comparison = a.size - b.size;
                    break;
                case 'date':
                    comparison = (a.lastModified || 0) - (b.lastModified || 0);
                    break;
                case 'duration': {
                    const metaA = videoMetadata.get(a.name);
                    const metaB = videoMetadata.get(b.name);
                    comparison = (metaA?.duration || 0) - (metaB?.duration || 0);
                    break;
                }
                default:
                    comparison = 0;
            }
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    };

    const filterVideos = (videoList: File[]): File[] => {
        let filtered = videoList;
        
        if (filterQuery) {
            const query = filterQuery.toLowerCase();
            filtered = filtered.filter(file => file.name.toLowerCase().includes(query));
        }
        
        if (filterExtension !== 'all') {
            filtered = filtered.filter(file => file.name.toLowerCase().endsWith(`.${filterExtension.toLowerCase()}`));
        }
        
        return filtered;
    };

    // Detect orientation and adjust camera FOV
    useEffect(() => {
        const checkOrientation = () => {
            const isLandscape = window.innerWidth > window.innerHeight;

            if (cameraRef.current) {
                cameraRef.current.fov = isLandscape ? 75 : 90;
                cameraRef.current.updateProjectionMatrix();
            }
        };

        checkOrientation();
        window.addEventListener('resize', checkOrientation);
        window.addEventListener('orientationchange', checkOrientation);

        return () => {
            window.removeEventListener('resize', checkOrientation);
            window.removeEventListener('orientationchange', checkOrientation);
        };
    }, []);

    // Toggle orientation lock
    const toggleOrientationLock = async () => {
        if ('orientation' in screen) {
            try {
                if (!orientationLocked) {
                    await (screen.orientation as ScreenOrientation & { lock: (orientation: string) => Promise<void> }).lock('landscape');
                    setOrientationLocked(true);
                } else {
                    await (screen.orientation as ScreenOrientation & { unlock: () => Promise<void> }).unlock();
                    setOrientationLocked(false);
                }
            } catch (error) {
                console.log('Orientation lock not supported or denied:', error);
            }
        } else {
            alert('Screen Orientation API is not supported in this browser.');
        }
    };

    // Initialize Three.js scene for 360 viewing
    useEffect(() => {
        const container = containerRef.current;
        if (!container || !videoRef.current) return;

        // Scene setup
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(
            75,
            container.clientWidth / container.clientHeight,
            0.1,
            1000
        );
        camera.position.set(0, 0, 0.1);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(renderer.domElement);

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
                isSBS: { value: 1.0 },
                sbsFormat: { value: 0.0 }
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
uniform float sbsFormat;
varying vec2 vUv;

void main() {
    vec2 uv = vUv;
    if (isSBS > 0.5) {
        if (sbsFormat < 0.5) {
            uv.x = uv.x * 0.5;
        } else {
            uv.y = uv.y * 0.5;
        }
    }
    gl_FragColor = texture2D(map, uv);
}
`
        });

        materialRef.current = material;
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
            const width = container.clientWidth;
            const height = container.clientHeight;
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
            if (container && renderer.domElement) {
                container.removeChild(renderer.domElement);
            }
            geometry.dispose();
            if (materialRef.current) {
                materialRef.current.dispose();
            }
            renderer.dispose();
        };
    }, []);

    // Update view mode (360 vs flat)
    useEffect(() => {
        if (!sphereRef.current || !materialRef.current) return;

        const mesh = sphereRef.current;
        const material = materialRef.current;

        if (viewMode === 'flat') {
            mesh.geometry.dispose();
            mesh.geometry = new THREE.PlaneGeometry(16, 9, 1, 1);
            material.uniforms.isSBS.value = 0.0;
        } else {
            mesh.geometry.dispose();
            mesh.geometry = new THREE.SphereGeometry(500, 60, 40);
            mesh.geometry.scale(-1, 1, 1);
            material.uniforms.isSBS.value = isSBS ? 1.0 : 0.0;
        }
    }, [viewMode, isSBS]);

    // Update SBS format (horizontal vs vertical)
    useEffect(() => {
        if (!materialRef.current) return;
        materialRef.current.uniforms.sbsFormat.value = sbsFormat === 'horizontal' ? 0.0 : 1.0;
    }, [sbsFormat]);

    // Mouse drag controls
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleMouseDown = (e: MouseEvent) => {
            isDraggingRef.current = true;
            previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
        };

        const handleMouseMove = (e: MouseEvent) => {
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

        const handleTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 1) {
                isDraggingRef.current = true;
                previousMousePositionRef.current = {
                    x: e.touches[0].clientX,
                    y: e.touches[0].clientY
                };
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
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

        const handleOrientation = (event: DeviceOrientationEvent) => {
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
            'requestPermission' in DeviceOrientationEvent) {
            try {
                const permission = await (DeviceOrientationEvent as unknown as { requestPermission: () => Promise<PermissionState> }).requestPermission();
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
    const togglePlay = useCallback(() => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    }, [isPlaying]);

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        if (videoRef.current) {
            videoRef.current.volume = newVolume;
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newTime = parseFloat(e.target.value);
        setCurrentTime(newTime);
        if (videoRef.current) {
            videoRef.current.currentTime = newTime;
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Video event listeners
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleTimeUpdate = () => setCurrentTime(video.currentTime);
        const handleLoadedMetadata = () => {
            setDuration(video.duration);
            setIsLoadingVideo(false);
        };
        const handleEnded = () => setIsPlaying(false);
        const handleError = handleVideoError;

        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        video.addEventListener('ended', handleEnded);
        video.addEventListener('error', handleError);

        return () => {
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            video.removeEventListener('ended', handleEnded);
            video.removeEventListener('error', handleError);
        };
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            switch (e.key.toLowerCase()) {
                case ' ': {
                    e.preventDefault();
                    togglePlay();
                    break;
                }
                case 'arrowleft': {
                    e.preventDefault();
                    if (videoRef.current) {
                        videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
                    }
                    break;
                }
                case 'arrowright': {
                    e.preventDefault();
                    if (videoRef.current) {
                        videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 5);
                    }
                    break;
                }
                case 'm': {
                    e.preventDefault();
                    if (videoRef.current) {
                        videoRef.current.muted = !videoRef.current.muted;
                        setVolume(videoRef.current.muted ? 0 : 1);
                    }
                    break;
                }
                case 'f': {
                    e.preventDefault();
                    handleFullscreen();
                    break;
                }
                case 's': {
                    e.preventDefault();
                    setViewMode(prev => prev === '360' ? 'flat' : '360');
                    break;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [duration, togglePlay, handleFullscreen]);

    return (
        <div className="flex h-screen bg-gray-900 text-white">
            {/* Mobile Sidebar Toggle */}
            <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="fixed top-4 left-4 z-50 p-2 bg-blue-600 rounded-lg lg:hidden"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {sidebarOpen ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    )}
                </svg>
            </button>

            {/* Sidebar - Video List */}
            <div className={`${sidebarOpen ? 'fixed inset-0 z-40 lg:static' : 'hidden'} lg:flex w-80 bg-gray-800 p-4 overflow-y-auto flex-col`}>
                <h1 className="text-2xl font-bold mb-4">3D SBS Video Player</h1>

                {/* Directory Picker */}
                <button
                    onClick={handleDirectoryPicker}
                    disabled={isScanning}
                    className="w-full mb-4 p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg transition flex items-center justify-center gap-2"
                >
                    {isScanning ? (
                        <>
                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Scanning...
                        </>
                    ) : (
                        <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                            Open Directory
                        </>
                    )}
                </button>

                {/* Directory Path Display */}
                {directoryPath && (
                    <div className="mb-4 p-3 bg-gray-700 rounded-lg">
                        <div className="text-xs text-gray-400">Directory:</div>
                        <div className="text-sm truncate">{directoryPath}</div>
                    </div>
                )}

                {/* Alternative File Input */}
                <label className="block mb-4">
                    <span className="sr-only">Choose video files</span>
                    <input
                        type="file"
                        multiple
                        accept="video/*,.mp4,.webm,.ogv,.mov,.mkv,.avi,.m4v,.flv,.wmv"
                        onChange={handleFileSelect}
                        className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-gray-700 file:text-white hover:file:bg-gray-600 cursor-pointer"
                    />
                </label>

                {/* Search Filter */}
                <div className="mb-4">
                    <input
                        type="text"
                        placeholder="Search videos..."
                        value={filterQuery}
                        onChange={(e) => setFilterQuery(e.target.value)}
                        className="w-full p-2 bg-gray-700 rounded-lg text-sm"
                    />
                </div>

                {/* Sort and Filter Controls */}
                <div className="flex gap-2 mb-4">
                    <select
                        value={sortOrder}
                        onChange={(e) => setSortOrder(e.target.value)}
                        className="flex-1 p-2 bg-gray-700 rounded-lg text-sm"
                    >
                        <option value="name">Sort by Name</option>
                        <option value="size">Sort by Size</option>
                        <option value="date">Sort by Date</option>
                        <option value="duration">Sort by Duration</option>
                    </select>
                    <button
                        onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
                        className="p-2 bg-gray-700 rounded-lg"
                    >
                        {sortDirection === 'asc' ? '↑' : '↓'}
                    </button>
                </div>

                {/* Extension Filter */}
                <div className="flex gap-2 mb-4 flex-wrap">
                    {['all', 'mp4', 'webm', 'mov', 'mkv', 'avi'].map(ext => (
                        <button
                            key={ext}
                            onClick={() => setFilterExtension(ext)}
                            className={`px-3 py-1 rounded-lg text-sm ${
                                filterExtension === ext ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
                            }`}
                        >
                            {ext.toUpperCase()}
                        </button>
                    ))}
                </div>

                <div className="space-y-2">
                    <h2 className="text-lg font-semibold mb-2">
                        Videos ({filterVideos(sortVideos(videos)).length})
                    </h2>
                    {filterVideos(sortVideos(videos)).map((video, index) => {
                        const metadata = videoMetadata.get(video.name);
                        return (
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
                                <div className="text-xs text-gray-400 flex justify-between">
                                    <span>{(video.size / 1024 / 1024).toFixed(2)} MB</span>
                                    {metadata && (
                                        <span>{formatTime(metadata.duration)}</span>
                                    )}
                                </div>
                            </button>
                        );
                    })}
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

                    {/* Loading State */}
                    {isLoadingVideo && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 z-10">
                            <svg className="animate-spin h-12 w-12 text-blue-600" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        </div>
                    )}

                    {/* Error State */}
                    {error && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 z-10">
                            <div className="text-center p-6 bg-gray-800 rounded-lg max-w-md">
                                <svg className="w-12 h-12 mx-auto mb-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-lg mb-4">{error}</p>
                                <button
                                    onClick={() => {
                                        setError(null);
                                        if (currentVideo) loadVideo(currentVideo);
                                    }}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition"
                                >
                                    Retry
                                </button>
                            </div>
                        </div>
                    )}

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

                        {/* Control Buttons - Top Row */}
                        <div className="flex items-center justify-between flex-wrap gap-2">
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

                                {/* Playback Speed */}
                                <select
                                    value={playbackSpeed}
                                    onChange={(e) => handlePlaybackSpeedChange(parseFloat(e.target.value))}
                                    className="p-2 bg-gray-700 rounded-lg text-sm"
                                >
                                    <option value="0.25">0.25x</option>
                                    <option value="0.5">0.5x</option>
                                    <option value="0.75">0.75x</option>
                                    <option value="1">1x</option>
                                    <option value="1.25">1.25x</option>
                                    <option value="1.5">1.5x</option>
                                    <option value="2">2x</option>
                                </select>
                            </div>

                            <div className="flex items-center space-x-2">
                                {/* View Mode Toggle */}
                                <button
                                    onClick={() => setViewMode(prev => prev === '360' ? 'flat' : '360')}
                                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition text-sm"
                                >
                                    {viewMode === '360' ? '🔄 360°' : '▦ Flat'}
                                </button>

                                {/* Fullscreen */}
                                <button
                                    onClick={handleFullscreen}
                                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                    </svg>
                                </button>

                                {/* Orientation Lock (Mobile) */}
                                <button
                                    onClick={toggleOrientationLock}
                                    className={`hidden sm:block px-4 py-2 rounded transition text-sm ${
                                        orientationLocked
                                            ? 'bg-green-600 hover:bg-green-700'
                                            : 'bg-gray-700 hover:bg-gray-600'
                                    }`}
                                >
                                    {orientationLocked ? '🔒 Locked' : '🔓 Lock'}
                                </button>

                                {/* SBS Toggle */}
                                {viewMode === '360' && (
                                    <button
                                        onClick={() => setIsSBS(prev => !prev)}
                                        className={`hidden sm:block px-4 py-2 rounded transition text-sm ${
                                            isSBS
                                                ? 'bg-blue-600 hover:bg-blue-700'
                                                : 'bg-gray-700 hover:bg-gray-600'
                                        }`}
                                    >
                                        {isSBS ? 'SBS: ON' : 'SBS: OFF'}
                                    </button>
                                )}

                                {/* SBS Format Toggle */}
                                {isSBS && viewMode === '360' && (
                                    <button
                                        onClick={() => setSbsFormat(prev => prev === 'horizontal' ? 'vertical' : 'horizontal')}
                                        className="hidden sm:block px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition text-sm"
                                    >
                                        {sbsFormat === 'horizontal' ? '⬅️➡️ Horizontal' : '⬆️⬇️ Vertical'}
                                    </button>
                                )}

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
                        </div>

                        {/* Info */}
                        <div className="text-sm text-gray-400 text-center">
                            Drag to look around • Space: Play/Pause • F: Fullscreen • Arrow keys: Seek • M: Mute • S: Toggle view
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default App
