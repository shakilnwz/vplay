import { useState, useEffect, useRef, useCallback } from 'react';

export function useAutoHideUI(isPlaying: boolean, timeout: number = 3000) {
    const [isVisible, setIsVisible] = useState(true);
    const timeoutRef = useRef<number | null>(null);

    const showUI = useCallback(() => {
        setIsVisible(true);
        if (timeoutRef.current) {
            window.clearTimeout(timeoutRef.current);
        }
        if (isPlaying) {
            timeoutRef.current = window.setTimeout(() => {
                setIsVisible(false);
            }, timeout);
        }
    }, [isPlaying, timeout]);

    useEffect(() => {
        if (isPlaying) {
            showUI();
        } else {
            setIsVisible(true);
            if (timeoutRef.current) {
                window.clearTimeout(timeoutRef.current);
            }
        }
        return () => {
            if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
        };
    }, [isPlaying, showUI]);

    return { isVisible, showUI };
}
