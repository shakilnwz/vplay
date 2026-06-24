import { store, type VideoMetadata } from '../store';

const VIDEO_EXTENSIONS = /\.(mp4|webm|ogv|mov|mkv|avi|m4v|flv|wmv)$/i;
const MAX_VIDEO_FILES = 500;

function isVideoFile(file: File): boolean {
    return file.type.startsWith('video/') || VIDEO_EXTENSIONS.test(file.name);
}

// IndexedDB Caching configuration
const DB_NAME = 'vplay-metadata-cache';
const STORE_NAME = 'metadata';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function getCachedMetadata(key: string): Promise<VideoMetadata | null> {
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => resolve(null);
        });
    } catch {
        return null;
    }
}

async function setCachedMetadata(key: string, value: VideoMetadata): Promise<void> {
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.put(value, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
        });
    } catch {
        // Ignore database errors
    }
}

const getCacheKey = (file: File) => `${file.name}-${file.size}-${file.lastModified}`;

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
                    // Skip unreadable files
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

let currentScanTaskId = 0;

export const extractVideoMetadata = async (file: File): Promise<VideoMetadata | null> => {
    const cacheKey = getCacheKey(file);

    // 1. Check in-memory map
    const cached = store.videoMetadata.value.get(file.name);
    if (cached) return cached;

    // 2. Check IndexedDB
    const dbCached = await getCachedMetadata(cacheKey);
    if (dbCached) {
        store.videoMetadata.value.set(file.name, dbCached);
        store.videoMetadata.trigger();
        return dbCached;
    }

    // 3. Extract metadata using dummy element
    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
            const metadata = {
                duration: video.duration,
                width: video.videoWidth,
                height: video.videoHeight
            };
            store.videoMetadata.value.set(file.name, metadata);
            store.videoMetadata.trigger();
            setCachedMetadata(cacheKey, metadata);
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

export const startBackgroundMetadataScan = async (filesToScan: File[]) => {
    const taskId = ++currentScanTaskId;
    const concurrency = 2;
    let index = 0;

    const worker = async () => {
        while (index < filesToScan.length) {
            if (taskId !== currentScanTaskId) break; // Cancel old scan

            const file = filesToScan[index++];
            if (!store.videoMetadata.value.has(file.name)) {
                await extractVideoMetadata(file);
                // Yield CPU briefly
                await new Promise(r => setTimeout(r, 45));
            }
        }
    };

    const workers = Array(concurrency).fill(null).map(() => worker());
    await Promise.all(workers);
};

export const loadVideo = (file: File) => {
    store.error.value = null;
    store.isLoadingVideo.value = true;
    store.currentVideo.value = file;
    extractVideoMetadata(file);
};

export const handleFileSelect = async (event: Event) => {
    const target = event.target as HTMLInputElement;
    const files = Array.from(target.files || []);
    const videoFiles = files.filter((file: File) => isVideoFile(file));
    store.error.value = null;
    store.videos.value = videoFiles;
    if (videoFiles.length > 0 && !store.currentVideo.value) {
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
        store.videos.value = videoFiles;
        store.error.value = null;
        store.directoryPath.value = videoFiles[0]?.webkitRelativePath?.split('/')[0] || 'Selected folder';
        if (videoFiles.length > 0 && !store.currentVideo.value) {
            loadVideo(videoFiles[0]);
        }
        if (videoFiles.length === 0) {
            store.error.value = 'No video files found in this directory.';
        }
    });
    input.click();
};

export const handleDirectoryPicker = async () => {
    const isAndroid = /Android/i.test(navigator.userAgent);

    if ('showDirectoryPicker' in window) {
        try {
            store.error.value = null;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const directoryHandle = await (window as any).showDirectoryPicker();
            store.isScanning.value = true;

            const fileCount = { value: 0 };
            const videoFiles = await getVideoFiles(
                directoryHandle,
                directoryHandle.name,
                fileCount
            );

            store.videos.value = videoFiles;
            store.directoryPath.value = directoryHandle.name;
            if (videoFiles.length > 0 && !store.currentVideo.value) {
                loadVideo(videoFiles[0]);
            }
            if (videoFiles.length === 0) {
                store.error.value = 'No video files found in this directory.';
                if (isAndroid) {
                    triggerWebkitDirectoryFallback();
                }
            }
        } catch (err) {
            const errorObj = err as Error;
            if (errorObj.name !== 'AbortError') {
                store.error.value = 'Failed to open directory. Try the file input below.';
                console.error('Directory picker error:', err);
                if (isAndroid) {
                    triggerWebkitDirectoryFallback();
                }
            }
        } finally {
            store.isScanning.value = false;
        }
    } else {
        store.error.value = 'Directory picker not supported. Use the file input below.';
        triggerWebkitDirectoryFallback();
    }
};

// Wire up videos observer to kick off scan automatically
store.videos.subscribe((newVideos) => {
    if (newVideos.length > 0) {
        startBackgroundMetadataScan(newVideos);
    }
});
