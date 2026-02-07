import { ref, onUnmounted, watch } from 'vue';

export function useAutoHideUI(isPlayingRef: { value: boolean }, timeout: number = 3000) {
    const isVisible = ref(true);
    let timeoutId: number | null = null;

    const showUI = () => {
        isVisible.value = true;
        if (timeoutId) {
            window.clearTimeout(timeoutId);
        }
        if (isPlayingRef.value) {
            timeoutId = window.setTimeout(() => {
                isVisible.value = false;
            }, timeout);
        }
    };

    watch(() => isPlayingRef.value, (playing) => {
        if (playing) {
            showUI();
        } else {
            isVisible.value = true;
            if (timeoutId) {
                window.clearTimeout(timeoutId);
            }
        }
    }, { immediate: true });

    onUnmounted(() => {
        if (timeoutId) window.clearTimeout(timeoutId);
    });

    return { isVisible, showUI };
}
