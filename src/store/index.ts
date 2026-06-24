import type { ViewMode } from '../renderer/WebGLRenderer';

export type PlayerMode = 'vr' | 'portrait';
export type SBSFormat = 'horizontal' | 'vertical';

export interface VideoMetadata {
    duration: number;
    width: number;
    height: number;
}

type Listener<T> = (val: T) => void;

export class Observable<T> {
    private _val: T;
    private listeners: Set<Listener<T>> = new Set();
    
    constructor(initial: T) {
        this._val = initial;
    }
    
    get value(): T {
        return this._val;
    }
    
    set value(v: T) {
        if (this._val !== v) {
            this._val = v;
            this.listeners.forEach(l => l(v));
        }
    }
    
    public trigger() {
        this.listeners.forEach(l => l(this._val));
    }
    
    subscribe(l: Listener<T>): () => void {
        this.listeners.add(l);
        l(this._val);
        return () => this.listeners.delete(l);
    }
}

const STORAGE_KEY = 'vplay-settings';

interface SavedSettings {
    viewMode: ViewMode;
    isSBS: boolean;
    sbsFormat: SBSFormat;
    invertStereo: boolean;
    playerMode: PlayerMode;
    volume: number;
}

function getInitialSettings(): SavedSettings {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            return {
                viewMode: '180',
                isSBS: true,
                sbsFormat: 'horizontal',
                invertStereo: false,
                playerMode: 'vr',
                volume: 1.0,
                ...JSON.parse(saved)
            };
        }
    } catch (e) {
        console.warn('Failed to load settings:', e);
    }
    return {
        viewMode: '180',
        isSBS: true,
        sbsFormat: 'horizontal',
        invertStereo: false,
        playerMode: 'vr',
        volume: 1.0
    };
}

export class AppStore {
    private initial = getInitialSettings();

    // Video List & Directory State
    public videos = new Observable<File[]>([]);
    public currentVideo = new Observable<File | null>(null);
    public directoryPath = new Observable<string>('');
    public isScanning = new Observable<boolean>(false);
    public videoElement = new Observable<HTMLVideoElement | null>(null);
    
    // Filtering & Sorting State
    public sortOrder = new Observable<string>('name');
    public sortDirection = new Observable<string>('asc');
    public filterQuery = new Observable<string>('');
    public filterExtension = new Observable<string>('all');
    public videoMetadata = new Observable<Map<string, VideoMetadata>>(new Map());

    // Playback Loading State
    public isLoadingVideo = new Observable<boolean>(false);
    public error = new Observable<string | null>(null);

    // Settings (Saved)
    public viewMode = new Observable<ViewMode>(this.initial.viewMode);
    public isSBS = new Observable<boolean>(this.initial.isSBS);
    public sbsFormat = new Observable<SBSFormat>(this.initial.sbsFormat);
    public invertStereo = new Observable<boolean>(this.initial.invertStereo);
    public playerMode = new Observable<PlayerMode>(this.initial.playerMode);
    public volume = new Observable<number>(this.initial.volume);

    // Playback Session State
    public isPlaying = new Observable<boolean>(false);
    public currentTime = new Observable<number>(0);
    public duration = new Observable<number>(0);
    public playbackSpeed = new Observable<number>(1.0);
    public isMuted = new Observable<boolean>(false);
    
    // UI controls locking & visibility
    public isUiLocked = new Observable<boolean>(false);
    public sidebarOpen = new Observable<boolean>(false);
    public isUiVisible = new Observable<boolean>(true);
    public isFullscreen = new Observable<boolean>(false);
    
    // Device sensors
    public gyroEnabled = new Observable<boolean>(false);
    public orientationLocked = new Observable<boolean>(false);

    constructor() {
        // Auto persist settings on changes
        const persist = () => {
            const settings: SavedSettings = {
                viewMode: this.viewMode.value,
                isSBS: this.isSBS.value,
                sbsFormat: this.sbsFormat.value,
                invertStereo: this.invertStereo.value,
                playerMode: this.playerMode.value,
                volume: this.volume.value
            };
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
            } catch (e) {
                console.warn('Failed to save settings:', e);
            }
        };

        this.viewMode.subscribe(persist);
        this.isSBS.subscribe(persist);
        this.sbsFormat.subscribe(persist);
        this.invertStereo.subscribe(persist);
        this.playerMode.subscribe(persist);
        this.volume.subscribe(persist);
    }
}

export const store = new AppStore();
