import { useEffect, useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import Hls from 'hls.js';
import type { DecoderMode } from '../../App';
import { YUVParser } from '../../utils/yuvParser';
import { yuvShaders } from '../../utils/yuvShaders';

export interface VideoPlayerProps {
    videoRef: (node: HTMLVideoElement | null) => void;
    viewMode: 'flat' | '360' | '180' | 'fisheye';
    isSBS: boolean;
    sbsFormat: 'horizontal' | 'vertical';
    gyroEnabled: boolean;
    isLoading: boolean;
    error: string | null;
    onRetry: () => void;
    src: string | null;
    width?: number;
    height?: number;
    invertStereo?: boolean;
    decoderMode: DecoderMode;
    yuvMetadata?: { width: number, height: number, fps: number, pixelFormat: 'yuv420p' };
    currentFile?: File | null;
}

export interface VideoPlayerHandle {
    resetView: () => void;
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(({
    videoRef,
    viewMode,
    isSBS,
    sbsFormat,
    gyroEnabled,
    isLoading,
    error,
    onRetry,
    src,
    width = 16,
    height = 9,
    invertStereo = false,
    decoderMode,
    yuvMetadata,
    currentFile
}, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sphereRef = useRef<THREE.Mesh | null>(null);
    const materialRef = useRef<THREE.ShaderMaterial | null>(null);
    const animationIdRef = useRef<number | null>(null);
    const isDraggingRef = useRef(false);
    const previousMousePositionRef = useRef({ x: 0, y: 0 });
    const rotationRef = useRef({ x: 0, y: 0, z: 0 }); // Current smoothed rotation
    const targetRotationRef = useRef({ x: 0, y: 0, z: 0 }); // Target rotation from inputs
    const touchStartDistanceRef = useRef<number | null>(null);
    const touchStartAngleRef = useRef<number | null>(null);
    const initialFovRef = useRef(75);
    const initialRollRef = useRef(0);
    const lastTimeRef = useRef(0);

    const gyroOffsetRef = useRef({ x: 0, y: 0, z: 0 });
    const gyroBaseRef = useRef({ x: 0, y: 0, z: 0 });
    const gyroInitializedRef = useRef(false);

    const internalVideoRef = useRef<HTMLVideoElement | null>(null);
    const hlsRef = useRef<Hls | null>(null);

    // YUV Decoder Refs
    const yuvCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const yuvContextRef = useRef<WebGLRenderingContext | null>(null);
    const yuvTexturesRef = useRef<{ y: WebGLTexture, u: WebGLTexture, v: WebGLTexture } | null>(null);
    const yuvProgramRef = useRef<WebGLProgram | null>(null);
    const yuvBufferRef = useRef<ArrayBuffer | null>(null);
    const yuvParserRef = useRef<YUVParser | null>(null);
    const yuvFrameRequestRef = useRef<number | null>(null);
    const yuvCurrentFrameRef = useRef<number>(0);
    const yuvLastFrameTimeRef = useRef<number>(0);

    // YUV Decoder Logic
    useEffect(() => {
        if (decoderMode !== 'yuv' || !currentFile || !yuvMetadata) {
            // Cleanup
            if (yuvFrameRequestRef.current) {
                cancelAnimationFrame(yuvFrameRequestRef.current);
                yuvFrameRequestRef.current = null;
            }
            yuvBufferRef.current = null;
            return;
        }

        const setupYUV = async () => {
            // 1. Read file as ArrayBuffer
            try {
                const buffer = await currentFile.arrayBuffer();
                yuvBufferRef.current = buffer;
                yuvParserRef.current = new YUVParser(yuvMetadata);
                yuvCurrentFrameRef.current = 0;
                yuvLastFrameTimeRef.current = performance.now();
            } catch (err) {
                console.error('Error reading YUV file:', err);
                return;
            }

            // 2. Setup Offscreen Canvas & WebGL
            if (!yuvCanvasRef.current) {
                yuvCanvasRef.current = document.createElement('canvas');
            }
            const canvas = yuvCanvasRef.current;
            canvas.width = yuvMetadata.width;
            canvas.height = yuvMetadata.height;

            const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });
            if (!gl) {
                console.error('WebGL not supported for YUV decoder');
                return;
            }
            yuvContextRef.current = gl;

            // 3. Create WebGL Program
            const createShader = (type: number, source: string) => {
                const shader = gl.createShader(type)!;
                gl.shaderSource(shader, source);
                gl.compileShader(shader);
                return shader;
            };

            const program = gl.createProgram()!;
            gl.attachShader(program, createShader(gl.VERTEX_SHADER, yuvShaders.vertexShader));
            gl.attachShader(program, createShader(gl.FRAGMENT_SHADER, yuvShaders.fragmentShader));
            gl.linkProgram(program);
            gl.useProgram(program);
            yuvProgramRef.current = program;

            // 4. Setup Buffers (Quad)
            const positionBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
            const posAttrib = gl.getAttribLocation(program, 'position');
            gl.enableVertexAttribArray(posAttrib);
            gl.vertexAttribPointer(posAttrib, 2, gl.FLOAT, false, 0, 0);

            const texCoordBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0]), gl.STATIC_DRAW);
            const uvAttrib = gl.getAttribLocation(program, 'uv');
            gl.enableVertexAttribArray(uvAttrib);
            gl.vertexAttribPointer(uvAttrib, 2, gl.FLOAT, false, 0, 0);

            // 5. Create Textures
            const createTexture = () => {
                const tex = gl.createTexture()!;
                gl.bindTexture(gl.TEXTURE_2D, tex);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                return tex;
            };

            yuvTexturesRef.current = {
                y: createTexture(),
                u: createTexture(),
                v: createTexture()
            };

            // 6. Playback Loop
            const renderFrame = () => {
                const now = performance.now();
                const interval = 1000 / yuvMetadata.fps;

                if (now - yuvLastFrameTimeRef.current >= interval) {
                    const parser = yuvParserRef.current;
                    const buffer = yuvBufferRef.current;

                    if (parser && buffer) {
                        const frame = parser.getFrame(buffer, yuvCurrentFrameRef.current);
                        if (frame) {
                            // Upload Y, U, V planes to textures
                            gl.activeTexture(gl.TEXTURE0);
                            gl.bindTexture(gl.TEXTURE_2D, yuvTexturesRef.current!.y);
                            gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, yuvMetadata.width, yuvMetadata.height, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, frame.y);
                            gl.uniform1i(gl.getUniformLocation(program, 'yTexture'), 0);

                            gl.activeTexture(gl.TEXTURE1);
                            gl.bindTexture(gl.TEXTURE_2D, yuvTexturesRef.current!.u);
                            gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, yuvMetadata.width / 2, yuvMetadata.height / 2, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, frame.u);
                            gl.uniform1i(gl.getUniformLocation(program, 'uTexture'), 1);

                            gl.activeTexture(gl.TEXTURE2);
                            gl.bindTexture(gl.TEXTURE_2D, yuvTexturesRef.current!.v);
                            gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, yuvMetadata.width / 2, yuvMetadata.height / 2, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, frame.v);
                            gl.uniform1i(gl.getUniformLocation(program, 'vTexture'), 2);

                            gl.drawArrays(gl.TRIANGLES, 0, 6);

                            // Advance frame
                            yuvCurrentFrameRef.current = (yuvCurrentFrameRef.current + 1) % parser.getTotalFrames(buffer);
                        }
                    }
                    yuvLastFrameTimeRef.current = now;
                }

                yuvFrameRequestRef.current = requestAnimationFrame(renderFrame);
            };

            renderFrame();
        };

        setupYUV();

        return () => {
            if (yuvFrameRequestRef.current) {
                cancelAnimationFrame(yuvFrameRequestRef.current);
            }
        };
    }, [decoderMode, currentFile, yuvMetadata]);

    // HLS.js Integration Effect
    useEffect(() => {
        const video = internalVideoRef.current;
        if (!video || !src || decoderMode === 'yuv') return;

        // Clean up existing hls instance
        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }

        // Check if the source is an HLS stream or a regular video file
        const isHlsStream = src.includes('.m3u8') || src.includes('m3u8');

        if (decoderMode === 'hls' && Hls.isSupported()) {
            if (isHlsStream) {
                // Use HLS.js for HLS streams
                const hls = new Hls({
                    enableWorker: true,  // Enable software decoding
                    lowLatencyMode: false,
                    backBufferLength: 90,
                });

                hls.loadSource(src);
                hls.attachMedia(video);

                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    console.log('HLS.js: Manifest parsed, video ready');
                });

                hls.on(Hls.Events.ERROR, (_event, data) => {
                    console.error('HLS.js error:', data);
                    if (data.fatal) {
                        switch (data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                console.error('Fatal network error, trying to recover');
                                hls.startLoad();
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                console.error('Fatal media error, trying to recover');
                                hls.recoverMediaError();
                                break;
                            default:
                                console.error('Fatal error, cannot recover');
                                hls.destroy();
                                break;
                        }
                    }
                });

                hlsRef.current = hls;
            } else {
                // For regular video files (MP4, WebM, etc.), use native playback with MSE
                // This provides software decoding path through the browser's MSE implementation
                console.log('HLS.js mode: Using native MSE for non-HLS video file');
                // The video element will use its src attribute directly
            }
        } else {
            // Use native HTML5 video (hardware decoding)
            // The video element will use its src attribute directly
        }

        return () => {
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
        };
    }, [src, decoderMode]);

    // Expose resetView method
    useImperativeHandle(ref, () => ({
        resetView: () => {
            // Reset Rotation only
            rotationRef.current = { x: 0, y: 0, z: 0 };
            targetRotationRef.current = { x: 0, y: 0, z: 0 };
        }
    }));

    // ... (Shader definition remains same) ...
    const shader = useMemo(() => ({
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
            uniform float invertStereo;
            varying vec2 vUv;
            void main() {
                vec2 uv = vUv;
                if (isSBS > 0.5) {
                    float offset = invertStereo > 0.5 ? 0.5 : 0.0;
                    if (sbsFormat < 0.5) {
                        // Horizontal: left is 0-0.5, right is 0.5-1.0
                        // Default: uv.x * 0.5 gives left. +0.5 gives right.
                        // If invertStereo: start with right (add 0.5) or left (add 0.0)
                        
                        // Let's analyze: 
                        // Normal: Left eye sees first half.
                        // We map 0..1 to 0..0.5.
                        // Eye swap: We want to map 0..1 to 0.5..1.0
                        
                        uv.x = uv.x * 0.5 + offset;
                    } else {
                        // Vertical: Top is 0.5-1.0, Bottom is 0.0-0.5 usually?
                        // Or Bottom 0.0-0.5.
                        // Standard top-bottom: Top image is y 0.5-1.0
                        // uv.y * 0.5 maps to 0.0-0.5 (Bottom).
                        
                        uv.y = uv.y * 0.5 + offset;
                    }
                }
                gl_FragColor = texture2D(map, uv);
            }
        `
    }), []);

    // Initialize Three.js
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(
            75,
            container.clientWidth / container.clientHeight,
            0.1,
            1000
        );
        camera.position.set(0, 0, 0.1);

        const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance", });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio); // Quality Fix
        // renderer.toneMapping = THREE.NoToneMapping;
        container.appendChild(renderer.domElement);

        const geometry = new THREE.SphereGeometry(500, 60, 40);
        geometry.scale(-1, 1, 1);

        const initialMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const sphere = new THREE.Mesh(geometry, initialMaterial);
        scene.add(sphere);

        sceneRef.current = scene;
        cameraRef.current = camera;
        rendererRef.current = renderer;
        sphereRef.current = sphere;

        const animate = (time: number) => {
            animationIdRef.current = requestAnimationFrame(animate);

            const delta = Math.min((time - lastTimeRef.current) / 1000, 0.1); // Cap delta to avoid jumps
            lastTimeRef.current = time;

            // Apply damping (Momentum)
            const dampingFactor = 10.0 * delta; // Adjust for speed

            // Linear interpolation for smooth movement
            // Lerp from current to target
            rotationRef.current.x += (targetRotationRef.current.x - rotationRef.current.x) * dampingFactor;
            rotationRef.current.y += (targetRotationRef.current.y - rotationRef.current.y) * dampingFactor;
            rotationRef.current.z += (targetRotationRef.current.z - rotationRef.current.z) * dampingFactor;

            if (cameraRef.current) {
                cameraRef.current.rotation.y = rotationRef.current.y;
                cameraRef.current.rotation.x = Math.max(
                    -Math.PI / 2,
                    Math.min(Math.PI / 2, rotationRef.current.x)
                );
                cameraRef.current.rotation.z = rotationRef.current.z; // Apply roll
            }

            renderer.render(scene, camera);
        };
        requestAnimationFrame(animate);

        const handleResize = () => {
            const width = container.clientWidth;
            const height = container.clientHeight;
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
            if (container && renderer.domElement) container.removeChild(renderer.domElement);
            geometry.dispose();
            renderer.dispose();
        };
    }, []);

    // ... (Texture Update and Geometry Update remain mostly same, just confirming I'm not overwriting them) ...
    // Note: I will only replace the Input Handling section primarily, but I needed to update `rotationRef` init 
    // and `renderer.setPixelRatio` in the init effect. 
    // Since this file is large, I'll use multi_replace for safer partial edits if possible or just replace the blocks logic.

    // I will use replace_file_content but carefully target the init logic and input handling.
    // Actually, I am providing a large chunk here covering init to animate loop.

    // Let me split this into smaller reliable chunks.
    // 1. Init state & refs
    // 2. Init useEffect (setPixelRatio and rotation.z)
    // 3. Input Handling useEffect (Gestures)

    // This tool call is for the State & Init Effect.

    // ... (rest of the file content for context matching) ...


    // Update Texture
    useEffect(() => {
        const video = internalVideoRef.current;
        const sphere = sphereRef.current;
        if (!sphere) return;

        let texture: THREE.Texture;

        if (decoderMode === 'yuv' && yuvCanvasRef.current) {
            texture = new THREE.CanvasTexture(yuvCanvasRef.current);
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.format = THREE.RGBAFormat;
        } else if (video) {
            texture = new THREE.VideoTexture(video);
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.format = THREE.RGBAFormat;
        } else {
            return;
        }

        const material = new THREE.ShaderMaterial({
            uniforms: {
                map: { value: texture },
                isSBS: { value: isSBS ? 1.0 : 0.0 },
                sbsFormat: { value: sbsFormat === 'horizontal' ? 0.0 : 1.0 },
                invertStereo: { value: invertStereo ? 1.0 : 0.0 }
            },
            vertexShader: shader.vertexShader,
            fragmentShader: shader.fragmentShader,
            side: THREE.DoubleSide
        });

        if (sphere.material) {
            const materials = Array.isArray(sphere.material) ? sphere.material : [sphere.material];
            materials.forEach(m => m.dispose());
        }
        sphere.material = material;
        materialRef.current = material;

        // Frame update loop for YUV texture (signals Three.js that the canvas changed)
        let frameAnimId: number;
        const onFrame = () => {
            if (decoderMode === 'yuv' && texture instanceof THREE.CanvasTexture) {
                texture.needsUpdate = true;
            }
            frameAnimId = requestAnimationFrame(onFrame);
        };

        if (decoderMode === 'yuv') {
            onFrame();
        }

        return () => {
            if (frameAnimId) cancelAnimationFrame(frameAnimId);
            texture.dispose();
            if (materialRef.current) {
                materialRef.current.dispose();
                materialRef.current = null;
            }
        };
    }, [isSBS, sbsFormat, decoderMode, invertStereo, shader, yuvMetadata]);

    // Update Geometry based on ViewMode and Aspect Ratio
    useEffect(() => {
        if (!sphereRef.current || !materialRef.current) return;

        const mesh = sphereRef.current;
        const material = materialRef.current;

        mesh.geometry.dispose();

        if (viewMode === 'flat') {
            const aspect = (width && height) ? width / height : 16 / 9;
            // Base height 9, width scaled by aspect
            mesh.geometry = new THREE.PlaneGeometry(9 * aspect, 9, 1, 1);
            mesh.position.set(0, 0, -10);
            mesh.scale.set(1, 1, 1);
            material.uniforms.isSBS.value = 0.0;
        } else if (viewMode === '180') {
            mesh.geometry = new THREE.SphereGeometry(500, 60, 40, Math.PI, Math.PI, 0, Math.PI);
            mesh.position.set(0, 0, 0);
            mesh.scale.set(-1, 1, 1);
            material.uniforms.isSBS.value = isSBS ? 1.0 : 0.0;
        } else {
            mesh.geometry = new THREE.SphereGeometry(500, 60, 40);
            mesh.position.set(0, 0, 0);
            mesh.scale.set(-1, 1, 1);
            material.uniforms.isSBS.value = isSBS ? 1.0 : 0.0;
        }
    }, [viewMode, isSBS, width, height]);

    // Note: SBS Format & Invert updates are handled by the main material effect above


    // Input Handling
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleMouseDown = (e: MouseEvent) => {
            isDraggingRef.current = true;
            previousMousePositionRef.current = { x: e.clientX, y: e.clientY };

            gyroBaseRef.current = { ...targetRotationRef.current };
            gyroInitializedRef.current = false;
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (!isDraggingRef.current) return;
            const deltaX = e.clientX - previousMousePositionRef.current.x;
            const deltaY = e.clientY - previousMousePositionRef.current.y;
            targetRotationRef.current.y += deltaX * 0.005;
            targetRotationRef.current.x += deltaY * 0.005;
            previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
        };

        const handleMouseUp = () => { isDraggingRef.current = false; };

        // Helper to get distance between two touches
        const getTouchDistance = (t1: Touch, t2: Touch) => {
            const dx = t1.clientX - t2.clientX;
            const dy = t1.clientY - t2.clientY;
            return Math.sqrt(dx * dx + dy * dy);
        };

        // Helper to get angle between two touches
        const getTouchAngle = (t1: Touch, t2: Touch) => {
            return Math.atan2(t1.clientY - t2.clientY, t1.clientX - t2.clientX);
        };

        const handleTouchStart = (e: TouchEvent) => {
            // Prevent default to stop browser zoom/scroll
            e.preventDefault();

            if (e.touches.length === 1) {
                isDraggingRef.current = true;
                previousMousePositionRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                gyroBaseRef.current = { ...targetRotationRef.current };
                gyroInitializedRef.current = false;
            } else if (e.touches.length === 2) {
                isDraggingRef.current = false; // Stop rotating via single finger logic
                touchStartDistanceRef.current = getTouchDistance(e.touches[0], e.touches[1]);
                touchStartAngleRef.current = getTouchAngle(e.touches[0], e.touches[1]);
                if (cameraRef.current) {
                    initialFovRef.current = cameraRef.current.fov;
                    initialRollRef.current = targetRotationRef.current.z;
                }
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            e.preventDefault();

            if (e.touches.length === 1 && isDraggingRef.current) {
                const deltaX = e.touches[0].clientX - previousMousePositionRef.current.x;
                const deltaY = e.touches[0].clientY - previousMousePositionRef.current.y;
                targetRotationRef.current.y += deltaX * 0.005;
                targetRotationRef.current.x += deltaY * 0.005;
                previousMousePositionRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            } else if (e.touches.length === 2) {
                // Handle Pinch (Zoom)
                const currentDist = getTouchDistance(e.touches[0], e.touches[1]);
                if (touchStartDistanceRef.current && cameraRef.current) {
                    const scale = touchStartDistanceRef.current / currentDist;
                    const newFov = Math.max(30, Math.min(110, initialFovRef.current * scale));
                    cameraRef.current.fov = newFov;
                    cameraRef.current.updateProjectionMatrix();
                }

                // Handle Twist (Rotate Z)
                const currentAngle = getTouchAngle(e.touches[0], e.touches[1]);
                if (touchStartAngleRef.current !== null) {
                    const deltaAngle = currentAngle - touchStartAngleRef.current;
                    targetRotationRef.current.z = initialRollRef.current + deltaAngle;
                }
            }
        };

        const handleTouchEnd = () => {
            isDraggingRef.current = false;
            touchStartDistanceRef.current = null;
            touchStartAngleRef.current = null;
        };

        const handleOrientation = (event: DeviceOrientationEvent) => {
            if (!gyroEnabled || isDraggingRef.current) return;

            const alpha = event.alpha ? THREE.MathUtils.degToRad(event.alpha) : 0; // Z
            const beta = event.beta ? THREE.MathUtils.degToRad(event.beta) : 0; // X
            const gamma = event.gamma ? THREE.MathUtils.degToRad(event.gamma) : 0; // Y
            const orient = window.screen.orientation ? THREE.MathUtils.degToRad(window.screen.orientation.angle) : 0;

            const q = new THREE.Quaternion();
            const zee = new THREE.Vector3(0, 0, 1);
            const euler = new THREE.Euler();
            const q0 = new THREE.Quaternion();
            const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // - PI/2 around X

            euler.set(beta, alpha, -gamma, 'YXZ');
            q.setFromEuler(euler);
            q.multiply(q1);
            q.multiply(q0.setFromAxisAngle(zee, -orient));

            const newEuler = new THREE.Euler().setFromQuaternion(q, 'YXZ');
            if (!gyroInitializedRef.current) {
                gyroOffsetRef.current = {
                    x: newEuler.x,
                    y: newEuler.y,
                    z: newEuler.z
                };
                gyroInitializedRef.current = true;
                return;
            }

            // // Update target refs for smoothing
            // targetRotationRef.current.x = newEuler.x;
            // targetRotationRef.current.y = newEuler.y;
            // targetRotationRef.current.z = newEuler.z;
            // Gyro delta relative to start
            const dx = newEuler.x - gyroOffsetRef.current.x;
            const dy = newEuler.y - gyroOffsetRef.current.y;
            const dz = newEuler.z - gyroOffsetRef.current.z;

            // Apply gyro as an ADDITIVE offset
            targetRotationRef.current.x = gyroBaseRef.current.x + dx;
            targetRotationRef.current.y = gyroBaseRef.current.y + dy;
            targetRotationRef.current.z = gyroBaseRef.current.z + dz;
        };

        container.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        // Use { passive: false } to allow preventDefault
        container.addEventListener('touchstart', handleTouchStart, { passive: false });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd);
        window.addEventListener('deviceorientation', handleOrientation);

        return () => {
            container.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
            window.removeEventListener('deviceorientation', handleOrientation);
        };
    }, [gyroEnabled]);

    return (
        <div ref={containerRef} className="flex-1 bg-black relative cursor-grab active:cursor-grabbing h-full w-full overflow-hidden touch-none">
            <video
                ref={(node) => {
                    videoRef(node);
                    internalVideoRef.current = node;
                }}
                src={
                    decoderMode === 'native' ||
                        (decoderMode === 'hls' && src && !(src.includes('.m3u8') || src.includes('m3u8')))
                        ? (src || undefined)
                        : undefined
                }
                className="hidden"
                playsInline
                crossOrigin="anonymous"
                loop
            />
            {/* Loading Overlay */}
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center z-10 bg-black bg-opacity-50 pointer-events-none">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
                </div>
            )}
            {/* Error Overlay */}
            {error && (
                <div className="absolute inset-0 flex items-center justify-center z-20 bg-black bg-opacity-80">
                    <div className="text-center p-6 max-w-md">
                        <div className="text-red-500 text-5xl mb-4">⚠️</div>
                        <h3 className="text-xl font-bold text-white mb-2">Error Loading Video</h3>
                        <p className="text-gray-300 mb-6">{error}</p>
                        <button
                            onClick={onRetry}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
});
