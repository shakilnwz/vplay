import { ref, computed } from 'vue';

const VIDEO_EXTENSIONS = /\.(mp4|webm|ogv|mov|mkv|avi|m4v|flv|wmv)$/i;
const MAX_VIDEO_FILES = 500; // Prevent hangs on large directories (e.g. DCIM on Android)

function isVideoFile(file: File): boolean {
    return file.type.startsWith('video/') || VIDEO_EXTENSIONS.test(file.name);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getVideoFiles(dirHandle: any, path: string, fileCount: { value: number }): Promise<File[]> {
    const videoFiles: File[] = [];
    try {
        for await (const entry of dirHandle.values()) {
            if (fileCount.value >= MAX_VIDEO_FILES) break;
            const nestedPath = `${path}/${entry.name}`;
            if (entry.kind === 'file') {
                try {
                    const file = await entry.getFile();
                    if (isVideoFile(file)) {
                        Object.defineProperty(file, 'webkitRelativePath', {
                            value: nestedPath,
                            writable: false
                        });
                        videoFiles.push(file);
                        fileCount.value++;
                    }
                } catch {
                    // Skip files that can't be read (permission, etc.)
                }
            } else if (entry.kind === 'directory') {
                const subFiles = await getVideoFiles(entry, nestedPath, fileCount);
                videoFiles.push(...subFiles);
            }
        }
    } catch {
        // Skip directories that can't be read
    }
    return videoFiles;
}

export interface VideoMetadata {
    duration: number;
    width: number;
    height: number;
}

export function useFileHandler() {
    const videos = ref<File[]>([]);
    const currentVideo = ref<File | null>(null);
    const directoryPath = ref('');
    const isScanning = ref(false);
    const sortOrder = ref('name');
    const sortDirection = ref('asc');
    const filterQuery = ref('');
    const filterExtension = ref('all');
    const videoMetadata = ref<Map<string, VideoMetadata>>(new Map());
    const isLoadingVideo = ref(false);
    const error = ref<string | null>(null);

    const extractVideoMetadata = async (file: File): Promise<VideoMetadata | null> => {
        const cached = videoMetadata.value.get(file.name);
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
                videoMetadata.value.set(file.name, metadata);
                // Trigger reactivity for Map if needed, but in Vue 3 Map is reactive if ref'd
                // videoMetadata.value = new Map(videoMetadata.value); 
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

    const loadVideo = (file: File) => {
        error.value = null;
        isLoadingVideo.value = true;
        currentVideo.value = file;
        extractVideoMetadata(file);
    };

    const handleFileSelect = async (event: Event) => {
        const target = event.target as HTMLInputElement;
        const files = Array.from(target.files || []);
        const videoFiles = files.filter((file: File) => isVideoFile(file));
        error.value = null;
        videos.value = videoFiles;
        if (videoFiles.length > 0 && !currentVideo.value) {
            loadVideo(videoFiles[0]);
        }
    };

    const triggerWebkitDirectoryFallback = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.webkitdirectory = true;
        input.multiple = true;
        input.accept = 'video/*,.mp4,.webm,.ogv,.mov,.mkv,.avi,.m4v,.flv,.wmv';
        input.addEventListener('change', (event: Event) => {
            const target = event.target as HTMLInputElement;
            const files = Array.from(target.files || []);
            const videoFiles = files.filter((file: File) => isVideoFile(file));
            videos.value = videoFiles;
            error.value = null;
            directoryPath.value = videoFiles[0]?.webkitRelativePath?.split('/')[0] || 'Selected folder';
            if (videoFiles.length > 0 && !currentVideo.value) {
                loadVideo(videoFiles[0]);
            }
            if (videoFiles.length === 0) {
                error.value = 'No video files found in this directory.';
            }
        });
        input.click();
    };

    const handleDirectoryPicker = async () => {
        const isAndroid = /Android/i.test(navigator.userAgent);

        if ('showDirectoryPicker' in window) {
            try {
                error.value = null;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const directoryHandle = await (window as any).showDirectoryPicker();
                isScanning.value = true;

                const fileCount = { value: 0 };
                const videoFiles = await getVideoFiles(
                    directoryHandle,
                    directoryHandle.name,
                    fileCount
                );

                videos.value = videoFiles;
                directoryPath.value = directoryHandle.name;
                if (videoFiles.length > 0 && !currentVideo.value) {
                    loadVideo(videoFiles[0]);
                }
                if (videoFiles.length === 0) {
                    error.value = 'No video files found in this directory.';
                    if (isAndroid) {
                        triggerWebkitDirectoryFallback();
                    }
                }
            } catch (err) {
                const errorObj = err as Error;
                if (errorObj.name !== 'AbortError') {
                    error.value = 'Failed to open directory. Try the file input below.';
                    console.error('Directory picker error:', err);
                    if (isAndroid) {
                        triggerWebkitDirectoryFallback();
                    }
                }
            } finally {
                isScanning.value = false;
            }
        } else {
            error.value = 'Directory picker not supported. Use the file input below.';
            triggerWebkitDirectoryFallback();
        }
    };

    const processedVideos = computed(() => {
        let result = [...videos.value];

        // Filter
        if (filterQuery.value) {
            const query = filterQuery.value.toLowerCase();
            result = result.filter(file => file.name.toLowerCase().includes(query));
        }

        if (filterExtension.value !== 'all') {
            result = result.filter(file => file.name.toLowerCase().endsWith(`.${filterExtension.value.toLowerCase()}`));
        }

        // Sort
        result.sort((a, b) => {
            let comparison = 0;
            switch (sortOrder.value) {
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
                    const metaA = videoMetadata.value.get(a.name);
                    const metaB = videoMetadata.value.get(b.name);
                    comparison = (metaA?.duration || 0) - (metaB?.duration || 0);
                    break;
                }
                default:
                    comparison = 0;
            }
            return sortDirection.value === 'asc' ? comparison : -comparison;
        });

        return result;
    });

    return {
        videos,
        processedVideos,
        currentVideo,
        directoryPath,
        isScanning,
        sortOrder,
        sortDirection,
        filterQuery,
        filterExtension,
        videoMetadata,
        isLoadingVideo,
        error,
        handleFileSelect,
        handleDirectoryPicker,
        loadVideo
    };
}
