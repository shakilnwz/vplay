import { useState, useEffect } from 'react';

export type ViewMode = 'flat' | '360' | '180' | 'fisheye';
export type SBSFormat = 'horizontal' | 'vertical';

const STORAGE_KEY = 'vr-player-settings';

interface SavedSettings {
    viewMode: ViewMode;
    isSBS: boolean;
    sbsFormat: SBSFormat;
    invertStereo?: boolean;
}

export function useViewControls() {
    // Initialize from localStorage
    const [viewMode, setViewMode] = useState<ViewMode>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved) as SavedSettings;
                return parsed.viewMode || '180';
            }
        } catch (e) {
            console.warn('Failed to load settings:', e);
        }
        return '180'; // Default to 180
    });

    const [isSBS, setIsSBS] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved) as SavedSettings;
                return parsed.isSBS !== undefined ? parsed.isSBS : true;
            }
        } catch (e) { /* ignore */ }
        return true;
    });

    const [sbsFormat, setSbsFormat] = useState<SBSFormat>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved) as SavedSettings;
                return parsed.sbsFormat || 'horizontal';
            }
        } catch (e) { /* ignore */ }
        return 'horizontal';
    });

    const [invertStereo, setInvertStereo] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved) as SavedSettings;
                return parsed.invertStereo || false;
            }
        } catch (e) { /* ignore */ }
        return false;
    });

    const [gyroEnabled, setGyroEnabled] = useState(false);
    const [orientationLocked, setOrientationLocked] = useState(false);

    // Persist settings whenever they change
    useEffect(() => {
        const settings: SavedSettings = {
            viewMode,
            isSBS,
            sbsFormat,
            invertStereo
        };
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        } catch (e) {
            console.warn('Failed to save settings:', e);
        }
    }, [viewMode, isSBS, sbsFormat, invertStereo]);

    // Request gyroscope permission (iOS 13+)
    const enableGyro = async () => {
        if (gyroEnabled) {
            setGyroEnabled(false);
            return;
        }
        if (typeof DeviceOrientationEvent !== 'undefined' &&
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            'requestPermission' in (DeviceOrientationEvent as any)) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const permission = await (DeviceOrientationEvent as any).requestPermission();
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

    // Toggle orientation lock
    const toggleOrientationLock = async () => {
        if ('orientation' in screen) {
            try {
                if (!orientationLocked) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await (screen.orientation as any).lock('landscape');
                    setOrientationLocked(true);
                } else {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await (screen.orientation as any).unlock();
                    setOrientationLocked(false);
                }
            } catch (error) {
                console.log('Orientation lock not supported or denied:', error);
            }
        } else {
            alert('Screen Orientation API is not supported in this browser.');
        }
    };

    return {
        viewMode,
        setViewMode,
        isSBS,
        setIsSBS,
        sbsFormat,
        setSbsFormat,
        invertStereo,
        setInvertStereo,
        gyroEnabled,
        enableGyro,
        orientationLocked,
        toggleOrientationLock
    };
}
