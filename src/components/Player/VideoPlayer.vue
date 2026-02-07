<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as THREE from 'three';

const props = defineProps<{
    viewMode: 'flat' | '360' | '180' | 'fisheye';
    isSBS: boolean;
    sbsFormat: 'horizontal' | 'vertical';
    gyroEnabled: boolean;
    isLoading: boolean;
    error: string | null;
    src: string | null;
    width?: number;
    height?: number;
    invertStereo?: boolean;
}>();

const emit = defineEmits<{
    (e: 'retry'): void;
    (e: 'video-ref', node: HTMLVideoElement | null): void;
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const videoRef = ref<HTMLVideoElement | null>(null);

const sceneRef = ref<THREE.Scene | null>(null);
const cameraRef = ref<THREE.PerspectiveCamera | null>(null);
const rendererRef = ref<THREE.WebGLRenderer | null>(null);
const sphereRef = ref<THREE.Mesh | null>(null);
const materialRef = ref<THREE.ShaderMaterial | null>(null);

const rotation = { x: 0, y: 0, z: 0 };
const targetRotation = { x: 0, y: 0, z: 0 };
const isDragging = ref(false);
const previousMousePosition = { x: 0, y: 0 };
const touchStartDistance = ref<number | null>(null);
const touchStartAngle = ref<number | null>(null);
const initialFov = ref(75);
const initialRoll = ref(0);
let lastTime = 0;
let animationId: number | null = null;

const gyroOffset = { x: 0, y: 0, z: 0 };
const gyroBase = { x: 0, y: 0, z: 0 };
const gyroInitialized = ref(false);

const shader = {
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
                    uv.x = uv.x * 0.5 + offset;
                } else {
                    uv.y = uv.y * 0.5 + offset;
                }
            }
            gl_FragColor = texture2D(map, uv);
        }
    `
};

const resetView = () => {
    rotation.x = 0; rotation.y = 0; rotation.z = 0;
    targetRotation.x = 0; targetRotation.y = 0; targetRotation.z = 0;
};

defineExpose({ resetView });

onMounted(() => {
    const container = containerRef.value;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 0.1);

    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    const geometry = new THREE.SphereGeometry(500, 60, 40);
    geometry.scale(-1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    sceneRef.value = scene;
    cameraRef.value = camera;
    rendererRef.value = renderer;
    sphereRef.value = sphere;

    const animate = (time: number) => {
        animationId = requestAnimationFrame(animate);
        const delta = Math.min((time - lastTime) / 1000, 0.1);
        lastTime = time;

        const dampingFactor = 10.0 * delta;
        rotation.x += (targetRotation.x - rotation.x) * dampingFactor;
        rotation.y += (targetRotation.y - rotation.y) * dampingFactor;
        rotation.z += (targetRotation.z - rotation.z) * dampingFactor;

        if (cameraRef.value) {
            cameraRef.value.rotation.y = rotation.y;
            cameraRef.value.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotation.x));
            cameraRef.value.rotation.z = rotation.z;
        }
        renderer.render(scene, camera);
    };
    animationId = requestAnimationFrame(animate);

    const handleResize = () => {
        const width = container.clientWidth;
        const height = container.clientHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    // Input Handling Setup
    setupInputHandling();

    onUnmounted(() => {
        window.removeEventListener('resize', handleResize);
        if (animationId) cancelAnimationFrame(animationId);
        if (container && renderer.domElement) container.removeChild(renderer.domElement);
        geometry.dispose();
        renderer.dispose();
        cleanupInputHandling();
    });
});

const setupInputHandling = () => {
    const container = containerRef.value;
    if (!container) return;

    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('deviceorientation', handleOrientation);
};

const cleanupInputHandling = () => {
    const container = containerRef.value;
    if (!container) return;

    container.removeEventListener('mousedown', handleMouseDown);
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
    container.removeEventListener('touchstart', handleTouchStart);
    container.removeEventListener('touchmove', handleTouchMove);
    container.removeEventListener('touchend', handleTouchEnd);
    window.removeEventListener('deviceorientation', handleOrientation);
};

const handleMouseDown = (e: MouseEvent) => {
    isDragging.value = true;
    previousMousePosition.x = e.clientX;
    previousMousePosition.y = e.clientY;
    gyroBase.x = targetRotation.x;
    gyroBase.y = targetRotation.y;
    gyroBase.z = targetRotation.z;
    gyroInitialized.value = false;
};

const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.value) return;
    const deltaX = e.clientX - previousMousePosition.x;
    const deltaY = e.clientY - previousMousePosition.y;
    targetRotation.y += deltaX * 0.005;
    targetRotation.x += deltaY * 0.005;
    previousMousePosition.x = e.clientX;
    previousMousePosition.y = e.clientY;
};

const handleMouseUp = () => { isDragging.value = false; };

const handleTouchStart = (e: TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1) {
        isDragging.value = true;
        previousMousePosition.x = e.touches[0].clientX;
        previousMousePosition.y = e.touches[0].clientY;
        gyroBase.x = targetRotation.x;
        gyroBase.y = targetRotation.y;
        gyroBase.z = targetRotation.z;
        gyroInitialized.value = false;
    } else if (e.touches.length === 2) {
        isDragging.value = false;
        touchStartDistance.value = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        touchStartAngle.value = Math.atan2(e.touches[0].clientY - e.touches[1].clientY, e.touches[0].clientX - e.touches[1].clientX);
        if (cameraRef.value) {
            initialFov.value = cameraRef.value.fov;
            initialRoll.value = targetRotation.z;
        }
    }
};

const handleTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1 && isDragging.value) {
        const deltaX = e.touches[0].clientX - previousMousePosition.x;
        const deltaY = e.touches[0].clientY - previousMousePosition.y;
        targetRotation.y += deltaX * 0.005;
        targetRotation.x += deltaY * 0.005;
        previousMousePosition.x = e.touches[0].clientX;
        previousMousePosition.y = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
        const currentDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        if (touchStartDistance.value && cameraRef.value) {
            const scale = touchStartDistance.value / currentDist;
            cameraRef.value.fov = Math.max(30, Math.min(110, initialFov.value * scale));
            cameraRef.value.updateProjectionMatrix();
        }
        const currentAngle = Math.atan2(e.touches[0].clientY - e.touches[1].clientY, e.touches[0].clientX - e.touches[1].clientX);
        if (touchStartAngle.value !== null) {
            targetRotation.z = initialRoll.value + (currentAngle - touchStartAngle.value);
        }
    }
};

const handleTouchEnd = () => {
    isDragging.value = false;
    touchStartDistance.value = null;
    touchStartAngle.value = null;
};

const handleOrientation = (event: DeviceOrientationEvent) => {
    if (!props.gyroEnabled || isDragging.value) return;

    const alpha = event.alpha ? THREE.MathUtils.degToRad(event.alpha) : 0;
    const beta = event.beta ? THREE.MathUtils.degToRad(event.beta) : 0;
    const gamma = event.gamma ? THREE.MathUtils.degToRad(event.gamma) : 0;
    const orient = window.screen.orientation ? THREE.MathUtils.degToRad(window.screen.orientation.angle) : 0;

    const q = new THREE.Quaternion();
    const zee = new THREE.Vector3(0, 0, 1);
    const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
    const euler = new THREE.Euler(beta, alpha, -gamma, 'YXZ');

    q.setFromEuler(euler);
    q.multiply(q1);
    q.multiply(new THREE.Quaternion().setFromAxisAngle(zee, -orient));

    const newEuler = new THREE.Euler().setFromQuaternion(q, 'YXZ');
    if (!gyroInitialized.value) {
        gyroOffset.x = newEuler.x; gyroOffset.y = newEuler.y; gyroOffset.z = newEuler.z;
        gyroInitialized.value = true;
        return;
    }

    targetRotation.x = gyroBase.x + (newEuler.x - gyroOffset.x);
    targetRotation.y = gyroBase.y + (newEuler.y - gyroOffset.y);
    targetRotation.z = gyroBase.z + (newEuler.z - gyroOffset.z);
};

// Update Texture Effect
watch([videoRef, sphereRef, () => props.isSBS, () => props.sbsFormat, () => props.invertStereo], () => {
    const video = videoRef.value;
    const sphere = sphereRef.value;
    if (!video || !sphere) return;

    const videoTexture = new THREE.VideoTexture(video);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    
    const material = new THREE.ShaderMaterial({
        uniforms: {
            map: { value: videoTexture },
            isSBS: { value: props.isSBS ? 1.0 : 0.0 },
            sbsFormat: { value: props.sbsFormat === 'horizontal' ? 0.0 : 1.0 },
            invertStereo: { value: props.invertStereo ? 1.0 : 0.0 }
        },
        vertexShader: shader.vertexShader,
        fragmentShader: shader.fragmentShader,
        side: THREE.DoubleSide
    });

    if (sphere.material) {
        (Array.isArray(sphere.material) ? sphere.material : [sphere.material]).forEach(m => m.dispose());
    }
    sphere.material = material;
    materialRef.value = material;
}, { immediate: true });

// Update Geometry Effect
watch([sphereRef, materialRef, () => props.viewMode, () => props.width, () => props.height, () => props.isSBS], () => {
    if (!sphereRef.value || !materialRef.value) return;
    const mesh = sphereRef.value;
    const material = materialRef.value;
    mesh.geometry.dispose();

    if (props.viewMode === 'flat') {
        const aspect = (props.width && props.height) ? props.width / props.height : 16 / 9;
        mesh.geometry = new THREE.PlaneGeometry(9 * aspect, 9, 1, 1);
        mesh.position.set(0, 0, -10);
        mesh.scale.set(1, 1, 1);
        material.uniforms.isSBS.value = 0.0;
    } else if (props.viewMode === '180') {
        mesh.geometry = new THREE.SphereGeometry(500, 60, 40, Math.PI, Math.PI, 0, Math.PI);
        mesh.position.set(0, 0, 0);
        mesh.scale.set(-1, 1, 1);
        material.uniforms.isSBS.value = props.isSBS ? 1.0 : 0.0;
    } else {
        mesh.geometry = new THREE.SphereGeometry(500, 60, 40);
        mesh.position.set(0, 0, 0);
        mesh.scale.set(-1, 1, 1);
        material.uniforms.isSBS.value = props.isSBS ? 1.0 : 0.0;
    }
}, { immediate: true });

// Watch video ref for parents
watch(videoRef, (newVal) => {
    emit('video-ref', newVal);
});
</script>

<template>
    <div ref="containerRef" class="flex-1 bg-black relative cursor-grab active:cursor-grabbing h-full w-full overflow-hidden touch-none">
        <video
            ref="videoRef"
            :src="src || undefined"
            class="hidden"
            playsinline
            crossorigin="anonymous"
            loop
        />
        <!-- Loading Overlay -->
        <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center z-10 bg-black bg-opacity-50 pointer-events-none">
            <div class="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
        </div>
        <!-- Error Overlay -->
        <div v-if="error" class="absolute inset-0 flex items-center justify-center z-20 bg-black bg-opacity-80">
            <div class="text-center p-6 max-w-md">
                <div class="text-red-500 text-5xl mb-4">⚠️</div>
                <h3 class="text-xl font-bold text-white mb-2">Error Loading Video</h3>
                <p class="text-gray-300 mb-6">{{ error }}</p>
                <button
                    @click="$emit('retry')"
                    class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                >
                    Retry
                </button>
            </div>
        </div>
    </div>
</template>
