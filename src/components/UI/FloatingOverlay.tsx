import React from 'react';

interface FloatingOverlayProps {
    children: React.ReactNode;
    isVisible: boolean;
    onInteract: () => void;
}

export function FloatingOverlay({ children, isVisible, onInteract }: FloatingOverlayProps) {
    return (
        <div
            className="fixed inset-x-0 bottom-0 z-30 flex flex-col justify-end pointer-events-none"
            style={{ height: '30%' }} // Hotspot area
        >
            {/* Interactive Hotspot */}
            <div
                className="absolute inset-0 z-40 pointer-events-auto"
                onMouseEnter={onInteract}
                onTouchStart={onInteract}
                onMouseMove={onInteract}
            />

            <div
                className={`z-50 transition-opacity duration-500 pointer-events-auto ${isVisible ? 'opacity-100' : 'opacity-0'}`}
                onMouseEnter={onInteract}
                onTouchStart={onInteract}
                onMouseMove={onInteract}
            >
                {children}
            </div>
        </div>
    );
}
