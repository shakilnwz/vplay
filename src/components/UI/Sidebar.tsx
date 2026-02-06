import { useFileHandler } from '../../hooks/useFileHandler';

interface SidebarProps {
    isOpen: boolean;
    fileHandler: ReturnType<typeof useFileHandler>;
}

export function Sidebar({ isOpen, fileHandler }: SidebarProps) {
    const {
        processedVideos,
        currentVideo,
        directoryPath,
        isScanning,
        sortOrder,
        sortDirection,
        filterQuery,
        filterExtension,
        videoMetadata,
        setSortOrder,
        setSortDirection,
        setFilterQuery,
        setFilterExtension,
        handleFileSelect,
        handleDirectoryPicker,
        loadVideo
    } = fileHandler;

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className={`${isOpen ? 'fixed inset-0 z-40 lg:static' : 'hidden'} lg:flex w-80 bg-gray-800 p-4 overflow-y-auto flex-col h-full border-r border-gray-700`}>
            <h1 className="text-2xl font-bold mb-4 w-full text-center">VR Player</h1>

            {/* Directory Picker */}
            <button
                onClick={handleDirectoryPicker}
                disabled={isScanning}
                className="w-full mb-4 p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg transition flex items-center justify-center gap-2"
            >
                {isScanning ? (
                    <>
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Scanning...
                    </>
                ) : (
                    <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                        Open Directory
                    </>
                )}
            </button>

            {/* Directory Path Display */}
            {directoryPath && (
                <div className="mb-4 p-3 bg-gray-700 rounded-lg">
                    <div className="text-xs text-gray-400">Directory:</div>
                    <div className="text-sm truncate">{directoryPath}</div>
                </div>
            )}

            {/* Alternative File Input */}
            <label className="block mb-4">
                <span className="sr-only">Choose video files</span>
                <input
                    type="file"
                    multiple
                    accept="video/*,.mp4,.webm,.ogv,.mov,.mkv,.avi,.m4v,.flv,.wmv"
                    onChange={handleFileSelect}
                    className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-gray-700 file:text-white hover:file:bg-gray-600 cursor-pointer"
                />
            </label>

            {/* Search Filter */}
            <div className="mb-4">
                <input
                    type="text"
                    placeholder="Search videos..."
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    className="w-full p-2 bg-gray-700 rounded-lg text-sm"
                />
            </div>

            {/* Sort and Filter Controls */}
            <div className="flex gap-2 mb-4">
                <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="flex-1 p-2 bg-gray-700 rounded-lg text-sm"
                >
                    <option value="name">Sort by Name</option>
                    <option value="size">Sort by Size</option>
                    <option value="date">Sort by Date</option>
                    <option value="duration">Sort by Duration</option>
                </select>
                <button
                    onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="p-2 bg-gray-700 rounded-lg"
                >
                    {sortDirection === 'asc' ? '↑' : '↓'}
                </button>
            </div>

            {/* Extension Filter */}
            <div className="flex gap-2 mb-4 flex-wrap">
                {['all', 'mp4', 'webm', 'mov', 'mkv', 'avi'].map(ext => (
                    <button
                        key={ext}
                        onClick={() => setFilterExtension(ext)}
                        className={`px-3 py-1 rounded-lg text-sm ${filterExtension === ext ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
                            }`}
                    >
                        {ext.toUpperCase()}
                    </button>
                ))}
            </div>

            <div className="space-y-2 flex-1 overflow-y-auto">
                <h2 className="text-lg font-semibold mb-2">
                    Videos ({processedVideos.length})
                </h2>
                {processedVideos.map((video, index) => {
                    const metadata = videoMetadata.get(video.name);
                    return (
                        <button
                            key={index}
                            onClick={() => loadVideo(video)}
                            className={`w-full text-left p-3 rounded transition ${currentVideo === video
                                ? 'bg-blue-600'
                                : 'bg-gray-700 hover:bg-gray-600'
                                }`}
                        >
                            <div className="truncate font-medium">{video.name}</div>
                            <div className="text-xs text-gray-400 flex justify-between">
                                <span>{(video.size / 1024 / 1024).toFixed(2)} MB</span>
                                {metadata && (
                                    <span>{formatTime(metadata.duration)}</span>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
