import { useState } from 'react';

interface YUVMetadata {
    width: number;
    height: number;
    fps: number;
    pixelFormat: 'yuv420p';
}

interface YUVMetadataDialogProps {
    filename: string;
    onSubmit: (metadata: YUVMetadata) => void;
    onCancel: () => void;
}

export function YUVMetadataDialog({ filename, onSubmit, onCancel }: YUVMetadataDialogProps) {
    const [width, setWidth] = useState(1920);
    const [height, setHeight] = useState(1080);
    const [fps, setFps] = useState(30);

    const commonResolutions = [
        { label: '360p', w: 640, h: 360 },
        { label: '720p', w: 1280, h: 720 },
        { label: '1080p', w: 1920, h: 1080 },
        { label: '4K', w: 3840, h: 2160 },
    ];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
                <h3 className="text-xl font-bold mb-2">RAW YUV Metadata</h3>
                <p className="text-sm text-gray-400 mb-6 truncate">File: {filename}</p>

                <div className="space-y-4">
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-xs text-gray-400 mb-1">Width</label>
                            <input
                                type="number"
                                value={width}
                                onChange={(e) => setWidth(parseInt(e.target.value))}
                                className="w-full bg-gray-700 rounded-lg p-2 text-sm"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs text-gray-400 mb-1">Height</label>
                            <input
                                type="number"
                                value={height}
                                onChange={(e) => setHeight(parseInt(e.target.value))}
                                className="w-full bg-gray-700 rounded-lg p-2 text-sm"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs text-gray-400 mb-1">FPS (Framerate)</label>
                        <input
                            type="number"
                            value={fps}
                            onChange={(e) => setFps(parseInt(e.target.value))}
                            className="w-full bg-gray-700 rounded-lg p-2 text-sm"
                        />
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {commonResolutions.map((res) => (
                            <button
                                key={res.label}
                                onClick={() => { setWidth(res.w); setHeight(res.h); }}
                                className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition"
                            >
                                {res.label}
                            </button>
                        ))}
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            onClick={onCancel}
                            className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition text-sm font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => onSubmit({ width, height, fps, pixelFormat: 'yuv420p' })}
                            className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition text-sm font-medium"
                        >
                            Open Video
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
