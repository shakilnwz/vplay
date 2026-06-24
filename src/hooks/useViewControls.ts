import { ref, watchEffect } from 'vue';

export type ViewMode = 'flat' | '360' | '180' | 'fisheye';
export type SBSFormat = 'horizontal' | 'vertical';
export type PlayerMode = 'vr' | 'portrait';

const STORAGE_KEY = 'vr-player-settings';

interface SavedSettings {
    viewMode: ViewMode;
    isSBS: boolean;
    sbsFormat: SBSFormat;
    invertStereo?: boolean;
    playerMode?: PlayerMode;
}

function getInitialSettings(): SavedSettings {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            return JSON.parse(saved) as SavedSettings;
        }
    } catch (e) {
        console.warn('Failed to load settings:', e);
    }
    return {
        viewMode: '180',
        isSBS: true,
        sbsFormat: 'horizontal',
        invertStereo: false,
        playerMode: 'vr'
    };
}

export function useViewControls() {
    const initial = getInitialSettings();

    const viewMode = ref<ViewMode>(initial.viewMode);
    const isSBS = ref(initial.isSBS);
    const sbsFormat = ref<SBSFormat>(initial.sbsFormat);
    const invertStereo = ref(initial.invertStereo || false);
    const gyroEnabled = ref(false);
    const orientationLocked = ref(false);
    const playerMode = ref<PlayerMode>(initial.playerMode || 'vr');

    // Persist settings whenever they change
    watchEffect(() => {
        const settings: SavedSettings = {
            viewMode: viewMode.value,
            isSBS: isSBS.value,
            sbsFormat: sbsFormat.value,
            invertStereo: invertStereo.value,
            playerMode: playerMode.value
        };
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        } catch (e) {
            console.warn('Failed to save settings:', e);
        }
    });

    // Request gyroscope permission (iOS 13+)
    const enableGyro = async () => {
        if (gyroEnabled.value) {
            gyroEnabled.value = false;
            return;
        }
        if (typeof DeviceOrientationEvent !== 'undefined' &&
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            'requestPermission' in (DeviceOrientationEvent as any)) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const permission = await (DeviceOrientationEvent as any).requestPermission();
                if (permission === 'granted') {
                    gyroEnabled.value = true;
                }
            } catch (error) {
                console.error('Gyroscope permission denied:', error);
            }
        } else {
            // For devices that don't require permission
            gyroEnabled.value = true;
        }
    };

    // Toggle orientation lock
    const toggleOrientationLock = async () => {
        if ('orientation' in screen) {
            try {
                if (!orientationLocked.value) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await (screen.orientation as any).lock('landscape');
                    orientationLocked.value = true;
                } else {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await (screen.orientation as any).unlock();
                    orientationLocked.value = false;
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
        isSBS,
        sbsFormat,
        invertStereo,
        gyroEnabled,
        enableGyro,
        orientationLocked,
        toggleOrientationLock,
        playerMode
    };
}
