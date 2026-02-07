import { ref, computed } from 'vue';

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
        const videoFiles = files.filter((file: File) =>
            file.type.startsWith('video/') ||
            file.name.match(/\.(mp4|webm|ogv|mov|mkv|avi|m4v|flv|wmv)$/i)
        );
        videos.value = videoFiles;
        if (videoFiles.length > 0 && !currentVideo.value) {
            loadVideo(videoFiles[0]);
        }
    };

    const handleDirectoryPicker = async () => {
        if ('showDirectoryPicker' in window) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const directoryHandle = await (window as any).showDirectoryPicker();
                isScanning.value = true;
                const videoFiles: File[] = [];

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                for await (const entry of (directoryHandle as any).values()) {
                    if (entry.kind === 'file') {
                        const file = await entry.getFile();
                        if (file.type.startsWith('video/') || file.name.match(/\.(mp4|webm|ogv|mov|mkv|avi|m4v|flv|wmv)$/i)) {
                            Object.defineProperty(file, 'webkitRelativePath', {
                                value: file.name,
                                writable: false
                            });
                            videoFiles.push(file);
                        }
                    }
                }

                videos.value = videoFiles;
                directoryPath.value = directoryHandle.name;
                if (videoFiles.length > 0 && !currentVideo.value) {
                    loadVideo(videoFiles[0]);
                }
            } catch (err) {
                console.error('Directory picker error:', err);
            } finally {
                isScanning.value = false;
            }
        } else {
            alert('Your browser does not support the File System Access API. Please use Chrome or Edge, or use the file input below.');
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
