import { useState } from 'react';

// Types moved locally or imported if centralized later
export interface VideoMetadata {
    duration: number;
    width: number;
    height: number;
}

export function useFileHandler() {
    const [videos, setVideos] = useState<File[]>([]);
    const [currentVideo, setCurrentVideo] = useState<File | null>(null);
    const [directoryPath, setDirectoryPath] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [sortOrder, setSortOrder] = useState('name');
    const [sortDirection, setSortDirection] = useState('asc');
    const [filterQuery, setFilterQuery] = useState('');
    const [filterExtension, setFilterExtension] = useState('all');
    const [videoMetadata, setVideoMetadata] = useState<Map<string, VideoMetadata>>(new Map());
    const [isLoadingVideo, setIsLoadingVideo] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const extractVideoMetadata = async (file: File): Promise<VideoMetadata | null> => {
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

    const loadVideo = (file: File) => {
        setError(null);
        setIsLoadingVideo(true);
        setCurrentVideo(file);
        extractVideoMetadata(file);
    };

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
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const directoryHandle = await (window as any).showDirectoryPicker();
                setIsScanning(true);
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

    // Derived state
    const processedVideos = filterVideos(sortVideos(videos));

    return {
        videos,
        processedVideos, // Export the processed list directly
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
        setSortOrder,
        setSortDirection,
        setFilterQuery,
        setFilterExtension,
        setIsLoadingVideo,
        setError,
        handleFileSelect,
        handleDirectoryPicker,
        loadVideo
    };
}
