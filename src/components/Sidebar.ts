import { store, type PlayerMode } from '../store';
import { handleDirectoryPicker, handleFileSelect, loadVideo } from '../utils/fileHandler';

export class SidebarComponent {
    private element: HTMLDivElement;
    private videosContainer: HTMLDivElement | null = null;
    private dirPathEl: HTMLDivElement | null = null;
    private errorEl: HTMLDivElement | null = null;
    private scanBtn: HTMLButtonElement | null = null;
    private listTitleEl: HTMLHeadingElement | null = null;

    constructor() {
        this.element = document.createElement('div');
        this.buildLayout();
        this.setupSubscriptions();
    }

    public getElement(): HTMLDivElement {
        return this.element;
    }

    private buildLayout() {
        this.element.className = 'fixed inset-y-0 left-0 z-40 lg:static flex w-80 bg-gray-900/80 backdrop-blur-lg border-r border-white/10 p-4 flex-col h-full select-none transform transition-transform duration-300 -translate-x-full lg:translate-x-0';
        
        // Let sidebarOpen observable toggle the translate-x-full class
        store.sidebarOpen.subscribe(open => {
            if (open) {
                this.element.classList.remove('-translate-x-full');
            } else {
                this.element.classList.add('-translate-x-full');
            }
        });

        // 1. Title Header
        const header = document.createElement('div');
        header.className = 'flex items-center justify-between mb-4';
        
        const title = document.createElement('h1');
        title.className = 'text-2xl font-extrabold tracking-tight text-white bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent';
        title.textContent = 'VPlay';
        header.appendChild(title);
        
        // Mobile close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'lg:hidden p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition';
        closeBtn.innerHTML = `
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
        `;
        closeBtn.onclick = () => store.sidebarOpen.value = false;
        header.appendChild(closeBtn);
        this.element.appendChild(header);

        // 2. Player Mode Toggle Pill
        const modeToggle = document.createElement('div');
        modeToggle.className = 'flex gap-2 p-1 bg-white/5 rounded-xl border border-white/10 mb-4 flex-shrink-0';
        
        const vrBtn = document.createElement('button');
        vrBtn.className = 'flex-1 py-1.75 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5';
        vrBtn.innerHTML = `
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            VR Mode
        `;
        
        const prBtn = document.createElement('button');
        prBtn.className = 'flex-1 py-1.75 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5';
        prBtn.innerHTML = `
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Portrait
        `;

        const updateToggleUI = (mode: PlayerMode) => {
            if (mode === 'vr') {
                vrBtn.className = 'flex-1 py-1.75 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 bg-blue-600 text-white shadow';
                prBtn.className = 'flex-1 py-1.75 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 text-gray-400 hover:text-white hover:bg-white/5';
            } else {
                prBtn.className = 'flex-1 py-1.75 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 bg-blue-600 text-white shadow';
                vrBtn.className = 'flex-1 py-1.75 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 text-gray-400 hover:text-white hover:bg-white/5';
            }
        };

        vrBtn.onclick = () => store.playerMode.value = 'vr';
        prBtn.onclick = () => store.playerMode.value = 'portrait';
        store.playerMode.subscribe(updateToggleUI);

        modeToggle.appendChild(vrBtn);
        modeToggle.appendChild(prBtn);
        this.element.appendChild(modeToggle);

        // 3. Scan Folder Button
        const scanBtn = document.createElement('button');
        scanBtn.className = 'w-full mb-4 py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 border border-blue-500/30';
        scanBtn.onclick = handleDirectoryPicker;
        this.scanBtn = scanBtn;
        this.element.appendChild(scanBtn);

        // 4. Directory Display Badge
        const dirPath = document.createElement('div');
        dirPath.className = 'mb-4 p-3 bg-white/5 border border-white/10 rounded-xl hidden';
        dirPath.innerHTML = `
            <div class="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-0.5">Directory</div>
            <div class="text-xs text-white/90 truncate font-mono"></div>
        `;
        this.dirPathEl = dirPath;
        this.element.appendChild(dirPath);

        // 5. Error Alert Box
        const errorBox = document.createElement('div');
        errorBox.className = 'mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs hidden';
        this.errorEl = errorBox;
        this.element.appendChild(errorBox);

        // 6. Traditional File Input Label
        const fileLabel = document.createElement('label');
        fileLabel.className = 'block mb-4 cursor-pointer';
        
        const fileDesc = document.createElement('span');
        fileDesc.className = 'sr-only';
        fileDesc.textContent = 'Choose files';
        fileLabel.appendChild(fileDesc);

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.multiple = true;
        fileInput.accept = 'video/*,.mp4,.webm,.ogv,.mov,.mkv,.avi,.m4v,.flv,.wmv';
        fileInput.className = 'block w-full text-xs text-gray-400 file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border file:border-white/10 file:text-xs file:font-semibold file:bg-white/5 file:text-white hover:file:bg-white/10 file:cursor-pointer cursor-pointer';
        fileInput.onchange = handleFileSelect;
        fileLabel.appendChild(fileInput);
        this.element.appendChild(fileLabel);

        // 7. Search text input
        const searchBox = document.createElement('div');
        searchBox.className = 'mb-3 relative';
        
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Search video list...';
        searchInput.className = 'w-full py-2 pl-3 pr-8 bg-white/5 hover:bg-white/10 focus:bg-white/10 border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-blue-500 transition-all';
        searchInput.oninput = () => store.filterQuery.value = searchInput.value;
        searchBox.appendChild(searchInput);
        this.element.appendChild(searchBox);

        // 8. Sorting Dropdowns
        const sortBox = document.createElement('div');
        sortBox.className = 'flex gap-2 mb-4';

        const selectSort = document.createElement('select');
        selectSort.className = 'flex-1 py-2 px-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white outline-none cursor-pointer hover:bg-white/10 transition';
        selectSort.innerHTML = `
            <option value="name" class="bg-gray-900">Name</option>
            <option value="size" class="bg-gray-900">Size</option>
            <option value="date" class="bg-gray-900">Date</option>
            <option value="duration" class="bg-gray-900">Duration</option>
        `;
        selectSort.value = store.sortOrder.value;
        selectSort.onchange = () => store.sortOrder.value = selectSort.value;
        sortBox.appendChild(selectSort);

        const dirBtn = document.createElement('button');
        dirBtn.className = 'p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 text-white transition text-xs aspect-square flex items-center justify-center';
        dirBtn.textContent = store.sortDirection.value === 'asc' ? '↑' : '↓';
        dirBtn.onclick = () => {
            const next = store.sortDirection.value === 'asc' ? 'desc' : 'asc';
            store.sortDirection.value = next;
            dirBtn.textContent = next === 'asc' ? '↑' : '↓';
        };
        sortBox.appendChild(dirBtn);
        this.element.appendChild(sortBox);

        // 9. Extensions filtering tags row
        const extensions = ['all', 'mp4', 'webm', 'mov', 'mkv', 'avi'];
        const tagBox = document.createElement('div');
        tagBox.className = 'flex gap-1.5 mb-4 flex-wrap flex-shrink-0';
        
        const tagButtons = extensions.map(ext => {
            const btn = document.createElement('button');
            btn.className = 'px-2.5 py-1 rounded-lg text-[10px] font-bold border border-white/5 transition';
            btn.textContent = ext.toUpperCase();
            btn.onclick = () => store.filterExtension.value = ext;
            tagBox.appendChild(btn);
            return { ext, btn };
        });

        const updateTags = (selected: string) => {
            tagButtons.forEach(({ ext, btn }) => {
                if (ext === selected) {
                    btn.className = 'px-2.5 py-1 rounded-lg text-[10px] font-bold border border-blue-500/20 bg-blue-600 text-white shadow';
                } else {
                    btn.className = 'px-2.5 py-1 rounded-lg text-[10px] font-bold border border-white/5 bg-white/5 text-gray-400 hover:text-white hover:bg-white/10';
                }
            });
        };
        store.filterExtension.subscribe(updateTags);
        this.element.appendChild(tagBox);

        // 10. List Container
        const listHeader = document.createElement('h2');
        listHeader.className = 'text-xs font-semibold text-gray-400 mb-2 flex-shrink-0';
        listHeader.textContent = 'Videos (0)';
        this.listTitleEl = listHeader;
        this.element.appendChild(listHeader);

        const listContainer = document.createElement('div');
        listContainer.className = 'space-y-2 flex-1 overflow-y-auto pr-1 no-scrollbar';
        this.videosContainer = listContainer;
        this.element.appendChild(listContainer);
    }

    private setupSubscriptions() {
        // Scanning states
        store.isScanning.subscribe(scanning => {
            if (this.scanBtn) {
                if (scanning) {
                    this.scanBtn.disabled = true;
                    this.scanBtn.innerHTML = `
                        <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Scanning directory...
                    `;
                } else {
                    this.scanBtn.disabled = false;
                    this.scanBtn.innerHTML = `
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                        Open Directory
                    `;
                }
            }
        });

        // Path Display
        store.directoryPath.subscribe(path => {
            if (this.dirPathEl) {
                if (path) {
                    this.dirPathEl.classList.remove('hidden');
                    this.dirPathEl.querySelector('div:last-child')!.textContent = path;
                } else {
                    this.dirPathEl.classList.add('hidden');
                }
            }
        });

        // Error notifications
        store.error.subscribe(err => {
            if (this.errorEl) {
                if (err) {
                    this.errorEl.classList.remove('hidden');
                    this.errorEl.textContent = err;
                } else {
                    this.errorEl.classList.add('hidden');
                }
            }
        });

        // Trigger updates when filtering/sorting/caching values update
        const refreshList = () => this.renderVideoList();
        
        store.videos.subscribe(refreshList);
        store.videoMetadata.subscribe(refreshList);
        store.sortOrder.subscribe(refreshList);
        store.sortDirection.subscribe(refreshList);
        store.filterQuery.subscribe(refreshList);
        store.filterExtension.subscribe(refreshList);
        store.currentVideo.subscribe(refreshList);
    }

    private getProcessedVideos(): File[] {
        let result = [...store.videos.value];
        
        // Filter Query
        const query = store.filterQuery.value.trim().toLowerCase();
        if (query) {
            result = result.filter(file => file.name.toLowerCase().includes(query));
        }
        
        // Extension
        const ext = store.filterExtension.value;
        if (ext !== 'all') {
            result = result.filter(file => file.name.toLowerCase().endsWith('.' + ext.toLowerCase()));
        }
        
        // Sort Order
        result.sort((a, b) => {
            let comp = 0;
            switch (store.sortOrder.value) {
                case 'name':
                    comp = a.name.localeCompare(b.name);
                    break;
                case 'size':
                    comp = a.size - b.size;
                    break;
                case 'date':
                    comp = (a.lastModified || 0) - (b.lastModified || 0);
                    break;
                case 'duration': {
                    const durationA = store.videoMetadata.value.get(a.name)?.duration || 0;
                    const durationB = store.videoMetadata.value.get(b.name)?.duration || 0;
                    comp = durationA - durationB;
                    break;
                }
            }
            return store.sortDirection.value === 'asc' ? comp : -comp;
        });
        
        return result;
    }

    private formatTime(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    private renderVideoList() {
        if (!this.videosContainer || !this.listTitleEl) return;
        
        const processed = this.getProcessedVideos();
        this.listTitleEl.textContent = `Videos (${processed.length})`;
        
        this.videosContainer.innerHTML = '';
        
        if (processed.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'text-center py-6 text-xs text-gray-500 font-medium';
            empty.textContent = 'No videos found';
            this.videosContainer.appendChild(empty);
            return;
        }

        const frag = document.createDocumentFragment();
        
        processed.forEach((video) => {
            const isPlaying = store.currentVideo.value?.name === video.name;
            
            const btn = document.createElement('button');
            btn.className = `w-full text-left p-3 rounded-xl transition flex flex-col gap-1 border border-white/5 active:scale-[0.98] ${
                isPlaying 
                    ? 'bg-blue-600 border-blue-500/30 text-white shadow-lg shadow-blue-600/10 font-semibold' 
                    : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
            }`;
            
            btn.onclick = () => {
                loadVideo(video);
                store.sidebarOpen.value = false; // Auto close on mobile select
            };

            const name = document.createElement('div');
            name.className = 'truncate font-medium text-xs w-full';
            name.textContent = video.name;
            btn.appendChild(name);

            const details = document.createElement('div');
            details.className = `text-[10px] flex justify-between w-full font-mono ${
                isPlaying ? 'text-blue-100' : 'text-gray-500'
            }`;
            
            const sizeSpan = document.createElement('span');
            sizeSpan.textContent = `${(video.size / 1024 / 1024).toFixed(2)} MB`;
            details.appendChild(sizeSpan);

            const meta = store.videoMetadata.value.get(video.name);
            if (meta) {
                const durationSpan = document.createElement('span');
                durationSpan.textContent = this.formatTime(meta.duration);
                details.appendChild(durationSpan);
            }

            btn.appendChild(details);
            frag.appendChild(btn);
        });

        this.videosContainer.appendChild(frag);
    }
}
