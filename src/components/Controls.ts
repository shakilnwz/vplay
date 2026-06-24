import { store, type SBSFormat } from '../store';
import type { ViewMode } from '../renderer/WebGLRenderer';

export class ControlsComponent {
    private element: HTMLDivElement;
    private accordionOpen = true;
    private hideTimeout: number | null = null;
    private HIDE_DELAY = 3000;

    constructor() {
        this.element = document.createElement('div');
        this.element.className = 'absolute bottom-0 inset-x-0 z-30 pointer-events-none select-none flex flex-col justify-end';
        
        this.setupStateTracking();
        this.render();
    }

    public getElement(): HTMLDivElement {
        return this.element;
    }

    private setupStateTracking() {
        // Re-render when player mode switches
        store.playerMode.subscribe(() => this.render());
        
        // Re-render when selected video changes (e.g. hides controls if no video loaded)
        store.currentVideo.subscribe(() => this.render());

        // Handle auto-hide logic
        const triggerAutoHide = () => {
            if (this.hideTimeout) window.clearTimeout(this.hideTimeout);
            
            if (store.isPlaying.value && !store.isUiLocked.value) {
                store.isUiVisible.value = true;
                this.hideTimeout = window.setTimeout(() => {
                    store.isUiVisible.value = false;
                }, this.HIDE_DELAY);
            } else {
                store.isUiVisible.value = true;
            }
        };

        store.isPlaying.subscribe(triggerAutoHide);
        store.isUiLocked.subscribe(locked => {
            if (locked) {
                store.isUiVisible.value = false;
            } else {
                store.isUiVisible.value = true;
                triggerAutoHide();
            }
        });
        
        // Listen to visibility updates to toggle CSS opacity classes
        store.isUiVisible.subscribe(visible => {
            const inner = this.element.querySelector('.controls-panel-inner') as HTMLElement | null;
            if (inner) {
                if (visible) {
                    inner.classList.remove('opacity-0', 'pointer-events-none');
                    inner.classList.add('opacity-100', 'pointer-events-auto');
                } else {
                    inner.classList.add('opacity-0', 'pointer-events-none');
                    inner.classList.remove('opacity-100', 'pointer-events-auto');
                }
            }
        });
    }


    private renderSubscriptions: (() => void)[] = [];

    private sub<T>(obs: { subscribe: (l: (v: T) => void) => () => void }, listener: (val: T) => void) {
        this.renderSubscriptions.push(obs.subscribe(listener));
    }

    private cleanupRenderSubscriptions() {
        this.renderSubscriptions.forEach(unsub => unsub());
        this.renderSubscriptions = [];
    }

    private formatTime(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    private handleSeekDelta(delta: number) {
        const t = store.currentTime.value + delta;
        const dur = store.duration.value || Infinity;
        const next = Math.max(0, Math.min(t, dur));
        store.currentTime.value = next;
        
        const video = store.videoElement.value;
        if (video) video.currentTime = next;
        store.isUiVisible.value = true;
    }

    private render() {
        this.cleanupRenderSubscriptions();
        this.element.innerHTML = '';
        const videoFile = store.currentVideo.value;
        if (!videoFile) return;

        const playerMode = store.playerMode.value;

        // Container card (Glassmorphism backdrop)
        const inner = document.createElement('div');
        inner.className = 'controls-panel-inner m-4 p-3 rounded-2xl bg-black/60 border border-white/10 backdrop-blur-md shadow-2xl transition-all duration-500 pointer-events-auto flex flex-col gap-2.5';
        
        // Double-tap margins to seek on mobile/desktop
        const seekOverlayLeft = document.createElement('div');
        seekOverlayLeft.className = 'absolute bottom-[30%] left-0 top-0 w-[15%] pointer-events-auto cursor-pointer z-10';
        seekOverlayLeft.ondblclick = (e) => {
            e.stopPropagation();
            this.handleSeekDelta(-15);
        };
        
        const seekOverlayRight = document.createElement('div');
        seekOverlayRight.className = 'absolute bottom-[30%] right-0 top-0 w-[15%] pointer-events-auto cursor-pointer z-10';
        seekOverlayRight.ondblclick = (e) => {
            e.stopPropagation();
            this.handleSeekDelta(15);
        };
        
        this.element.appendChild(seekOverlayLeft);
        this.element.appendChild(seekOverlayRight);

        if (playerMode === 'vr') {
            this.renderVRControls(inner);
        } else {
            this.renderPortraitControls(inner);
        }

        this.element.appendChild(inner);
    }

    private renderVRControls(container: HTMLDivElement) {
        // Scrubber Row
        const scrubberRow = document.createElement('div');
        scrubberRow.className = 'flex items-center gap-3 w-full';

        const playBtn = document.createElement('button');
        playBtn.className = 'p-2 rounded-full border border-white/10 bg-white/5 hover:bg-blue-600 hover:text-white transition-all duration-200 text-white flex-shrink-0';
        
        const updatePlayIcon = (playing: boolean) => {
            playBtn.innerHTML = playing
                ? `<svg class="w-4.5 h-4.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>`
                : `<svg class="w-4.5 h-4.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" /></svg>`;
        };
        this.sub(store.isPlaying, updatePlayIcon);
        playBtn.onclick = () => {
            const video = store.videoElement.value;
            if (video) {
                if (store.isPlaying.value) video.pause();
                else video.play();
                store.isPlaying.value = !store.isPlaying.value;
            }
        };
        scrubberRow.appendChild(playBtn);

        // Progress bar
        const timeStart = document.createElement('span');
        timeStart.className = 'text-[10px] font-mono text-gray-400 w-10 text-right';
        scrubberRow.appendChild(timeStart);

        const progressInput = document.createElement('input');
        progressInput.type = 'range';
        progressInput.min = '0';
        progressInput.step = '0.1';
        progressInput.className = 'flex-1 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 transition';
        
        this.sub(store.currentTime, t => {
            progressInput.value = t.toString();
            timeStart.textContent = this.formatTime(t);
        });
        
        this.sub(store.duration, d => {
            progressInput.max = d.toString();
        });

        progressInput.oninput = () => {
            const val = parseFloat(progressInput.value);
            store.currentTime.value = val;
            const video = store.videoElement.value;
            if (video) video.currentTime = val;
        };
        scrubberRow.appendChild(progressInput);

        const timeEnd = document.createElement('span');
        timeEnd.className = 'text-[10px] font-mono text-gray-400 w-10';
        this.sub(store.duration, d => timeEnd.textContent = this.formatTime(d));
        scrubberRow.appendChild(timeEnd);

        // Accordion toggle button
        const accBtn = document.createElement('button');
        accBtn.className = 'p-1.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition flex-shrink-0';
        accBtn.innerHTML = `<svg class="w-4 h-4 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>`;
        
        const accordionContent = document.createElement('div');
        accordionContent.className = 'space-y-2.5 overflow-hidden transition-all duration-300';
        
        const toggleAccordion = () => {
            this.accordionOpen = !this.accordionOpen;
            const svg = accBtn.querySelector('svg');
            if (svg) {
                if (this.accordionOpen) {
                    svg.classList.remove('rotate-180');
                    accordionContent.style.maxHeight = '300px';
                    accordionContent.style.opacity = '1';
                } else {
                    svg.classList.add('rotate-180');
                    accordionContent.style.maxHeight = '0px';
                    accordionContent.style.opacity = '0';
                }
            }
        };
        accBtn.onclick = toggleAccordion;
        scrubberRow.appendChild(accBtn);
        container.appendChild(scrubberRow);

        // Video Title & Options Grid
        const title = document.createElement('div');
        title.className = 'text-sm font-bold text-white/95 truncate px-1';
        this.sub(store.currentVideo, f => title.textContent = f?.name || '');
        accordionContent.appendChild(title);

        const optionsGrid = document.createElement('div');
        optionsGrid.className = 'flex items-center gap-2 overflow-x-auto w-full whitespace-nowrap scrollbar-hide py-1';
        
        const btnClass = 'flex items-center justify-center p-2 rounded-xl border border-white/10 transition-all font-semibold text-[11px] h-8 whitespace-nowrap bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white cursor-pointer';
        const activeClass = 'bg-blue-600 text-white border-blue-500/20 shadow-md shadow-blue-600/10 hover:bg-blue-500';

        // 1. Mute + Volume
        const volContainer = document.createElement('div');
        volContainer.className = 'flex items-center gap-2 bg-white/5 p-1 px-3 rounded-xl border border-white/10 h-8 flex-shrink-0';
        
        const muteBtn = document.createElement('button');
        muteBtn.className = 'text-gray-400 hover:text-white transition';
        muteBtn.onclick = () => {
            const video = store.videoElement.value;
            if (video) {
                store.isMuted.value = !store.isMuted.value;
                video.muted = store.isMuted.value;
            }
        };

        const updateMuteBtn = (muted: boolean) => {
            muteBtn.className = muted ? 'text-blue-400 hover:text-blue-300 transition' : 'text-gray-400 hover:text-white transition';
            muteBtn.innerHTML = muted
                ? `<svg class="w-4.5 h-4.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>`
                : `<svg class="w-4.5 h-4.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clip-rule="evenodd" /></svg>`;
        };
        this.sub(store.isMuted, updateMuteBtn);
        volContainer.appendChild(muteBtn);

        const volInput = document.createElement('input');
        volInput.type = 'range';
        volInput.min = '0';
        volInput.max = '1';
        volInput.step = '0.1';
        volInput.className = 'w-18 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-blue-500';
        
        const updateVolInput = () => {
            volInput.value = (store.isMuted.value ? 0 : store.volume.value).toString();
        };
        this.sub(store.volume, v => {
            const video = store.videoElement.value;
            if (video) video.volume = v;
            updateVolInput();
        });
        this.sub(store.isMuted, updateVolInput);
        
        volInput.oninput = () => {
            const v = parseFloat(volInput.value);
            store.volume.value = v;
            if (v > 0 && store.isMuted.value) {
                store.isMuted.value = false;
                const video = store.videoElement.value;
                if (video) video.muted = false;
            }
        };
        volContainer.appendChild(volInput);
        optionsGrid.appendChild(volContainer);

        // 2. Playback Speed Selector
        const speedSel = document.createElement('select');
        speedSel.className = 'py-1 px-2.5 bg-white/5 border border-white/10 rounded-xl text-[11px] text-white outline-none cursor-pointer hover:bg-white/10 transition h-8 font-semibold';
        speedSel.innerHTML = `
            <option value="0.25" class="bg-gray-900">0.25x</option>
            <option value="0.5" class="bg-gray-900">0.5x</option>
            <option value="0.75" class="bg-gray-900">0.75x</option>
            <option value="1.0" class="bg-gray-900">1x</option>
            <option value="1.25" class="bg-gray-900">1.25x</option>
            <option value="1.5" class="bg-gray-900">1.5x</option>
            <option value="2.0" class="bg-gray-900">2x</option>
        `;
        this.sub(store.playbackSpeed, s => {
            speedSel.value = s.toString();
            const video = store.videoElement.value;
            if (video) video.playbackRate = s;
        });
        speedSel.onchange = () => {
            store.playbackSpeed.value = parseFloat(speedSel.value);
        };
        optionsGrid.appendChild(speedSel);

        // 3. View Mode Dropdown
        const viewSel = document.createElement('select');
        viewSel.className = 'py-1 px-2.5 bg-white/5 border border-white/10 rounded-xl text-[11px] text-white outline-none cursor-pointer hover:bg-white/10 transition h-8 font-semibold';
        viewSel.innerHTML = `
            <option value="360" class="bg-gray-900">🔄 360°</option>
            <option value="180" class="bg-gray-900">🌐 180°</option>
            <option value="flat" class="bg-gray-900">▦ Flat</option>
        `;
        this.sub(store.viewMode, v => viewSel.value = v);
        viewSel.onchange = () => {
            store.viewMode.value = viewSel.value as ViewMode;
        };
        optionsGrid.appendChild(viewSel);

        // 4. Recenter Button
        const recenterBtn = document.createElement('button');
        recenterBtn.className = btnClass;
        recenterBtn.title = 'Recenter (R)';
        recenterBtn.innerHTML = `<svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>`;
        recenterBtn.onclick = () => {
            const customRenderer = (window as unknown as { customWebGLRenderer?: { resetView: () => void } }).customWebGLRenderer;
            if (customRenderer) customRenderer.resetView();
        };
        optionsGrid.appendChild(recenterBtn);

        // 5. SBS Toggle Button
        const sbsBtn = document.createElement('button');
        sbsBtn.className = btnClass;
        
        const updateSbsBtn = (isSBS: boolean) => {
            sbsBtn.textContent = isSBS ? 'SBS: ON' : 'SBS: OFF';
            if (isSBS) sbsBtn.classList.add(...activeClass.split(' '));
            else sbsBtn.classList.remove(...activeClass.split(' '));
        };
        this.sub(store.isSBS, updateSbsBtn);
        sbsBtn.onclick = () => store.isSBS.value = !store.isSBS.value;
        optionsGrid.appendChild(sbsBtn);

        // 6. SBS Layout Format
        const sbsFormatBtn = document.createElement('button');
        sbsFormatBtn.className = btnClass;
        
        const updateSbsFormatBtn = (format: SBSFormat) => {
            sbsFormatBtn.textContent = format === 'horizontal' ? '⬅️➡️ H' : '⬆️⬇️ V';
        };
        this.sub(store.sbsFormat, updateSbsFormatBtn);
        sbsFormatBtn.onclick = () => {
            store.sbsFormat.value = store.sbsFormat.value === 'horizontal' ? 'vertical' : 'horizontal';
        };
        
        // Hide format toggle if SBS is disabled or flat mode is active
        this.sub(store.isSBS, sbs => {
            if (sbs) sbsFormatBtn.classList.remove('hidden');
            else sbsFormatBtn.classList.add('hidden');
        });
        optionsGrid.appendChild(sbsFormatBtn);

        // 7. Eye swap
        const swapBtn = document.createElement('button');
        swapBtn.className = btnClass;
        
        const updateSwapBtn = (invert: boolean) => {
            swapBtn.textContent = invert ? '👁️↔️ Swapped' : '👁️↔️ Swap';
            if (invert) swapBtn.classList.add(...activeClass.split(' '));
            else swapBtn.classList.remove(...activeClass.split(' '));
        };
        this.sub(store.invertStereo, updateSwapBtn);
        swapBtn.onclick = () => store.invertStereo.value = !store.invertStereo.value;
        
        this.sub(store.isSBS, sbs => {
            if (sbs) swapBtn.classList.remove('hidden');
            else swapBtn.classList.add('hidden');
        });
        optionsGrid.appendChild(swapBtn);

        // 8. Orientation Lock
        const orientBtn = document.createElement('button');
        orientBtn.className = btnClass;
        
        const updateOrientBtn = (locked: boolean) => {
            orientBtn.textContent = locked ? '🔒 Locked' : '🔓 Lock';
            if (locked) orientBtn.classList.add(...activeClass.split(' '));
            else orientBtn.classList.remove(...activeClass.split(' '));
        };
        this.sub(store.orientationLocked, updateOrientBtn);
        orientBtn.onclick = async () => {
            if ('orientation' in screen) {
                try {
                    if (!store.orientationLocked.value) {
                        await (screen.orientation as unknown as { lock: (type: string) => Promise<void> }).lock('landscape');
                        store.orientationLocked.value = true;
                    } else {
                        await (screen.orientation as unknown as { unlock: () => void }).unlock();
                        store.orientationLocked.value = false;
                    }
                } catch (e) {
                    console.log('Orientation lock not supported/denied', e);
                }
            } else {
                alert('Orientation locking not supported in this browser.');
            }
        };
        optionsGrid.appendChild(orientBtn);

        // 9. Gyroscope Toggle
        const gyroBtn = document.createElement('button');
        gyroBtn.className = btnClass;
        
        const updateGyroBtn = (enabled: boolean) => {
            gyroBtn.textContent = enabled ? '🎯 Gyro' : '📱 Gyro';
            if (enabled) gyroBtn.classList.add(...activeClass.split(' '));
            else gyroBtn.classList.remove(...activeClass.split(' '));
        };
        this.sub(store.gyroEnabled, updateGyroBtn);
        gyroBtn.onclick = async () => {
            if (store.gyroEnabled.value) {
                store.gyroEnabled.value = false;
                return;
            }
            if (typeof DeviceOrientationEvent !== 'undefined' &&
                'requestPermission' in (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> })) {
                try {
                    const permission = await (DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission();
                    if (permission === 'granted') {
                        store.gyroEnabled.value = true;
                    }
                } catch (e) {
                    console.error('Gyroscope permission denied', e);
                }
            } else {
                store.gyroEnabled.value = true;
            }
        };
        optionsGrid.appendChild(gyroBtn);

        // 10. Immersive Fullscreen Button
        const fsBtn = document.createElement('button');
        fsBtn.className = btnClass;
        fsBtn.title = 'Fullscreen (F)';
        fsBtn.innerHTML = `<svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>`;
        fsBtn.onclick = () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(err => {
                    console.log('Fullscreen error:', err);
                });
            } else {
                document.exitFullscreen();
            }
        };
        optionsGrid.appendChild(fsBtn);

        // 11. Lock Interface Controls Button
        const lockBtn = document.createElement('button');
        lockBtn.className = btnClass;
        lockBtn.title = 'Lock Interface';
        lockBtn.innerHTML = `<svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>`;
        lockBtn.onclick = () => {
            store.isUiLocked.value = true;
        };
        optionsGrid.appendChild(lockBtn);

        accordionContent.appendChild(optionsGrid);
        
        // Setup visual hint
        const hint = document.createElement('div');
        hint.className = 'text-[10px] font-medium text-gray-500 text-center select-none pt-0.5';
        hint.textContent = 'Drag canvas to look around • Space: Play/Pause • F: Fullscreen • Arrow keys: Seek • M: Mute';
        accordionContent.appendChild(hint);
        
        container.appendChild(accordionContent);
        
        // Trigger initial accordion layout styles
        accordionContent.style.maxHeight = '300px';
        accordionContent.style.opacity = '1';
    }

    private renderPortraitControls(container: HTMLDivElement) {
        // 1. Scrubber Row
        const scrubberRow = document.createElement('div');
        scrubberRow.className = 'flex items-center gap-3 w-full';

        const timeStart = document.createElement('span');
        timeStart.className = 'text-[10px] font-mono text-gray-300 w-10 text-right';
        scrubberRow.appendChild(timeStart);

        const progressInput = document.createElement('input');
        progressInput.type = 'range';
        progressInput.min = '0';
        progressInput.step = '0.1';
        progressInput.className = 'flex-1 h-1 bg-white/30 rounded-full appearance-none cursor-pointer accent-blue-500';
        
        this.sub(store.currentTime, t => {
            progressInput.value = t.toString();
            timeStart.textContent = this.formatTime(t);
        });
        
        this.sub(store.duration, d => {
            progressInput.max = d.toString();
        });

        progressInput.oninput = () => {
            const val = parseFloat(progressInput.value);
            store.currentTime.value = val;
            const video = store.videoElement.value;
            if (video) video.currentTime = val;
        };
        scrubberRow.appendChild(progressInput);

        const timeEnd = document.createElement('span');
        timeEnd.className = 'text-[10px] font-mono text-gray-300 w-10';
        this.sub(store.duration, d => timeEnd.textContent = this.formatTime(d));
        scrubberRow.appendChild(timeEnd);
        container.appendChild(scrubberRow);

        // 2. Portrait Control Buttons Row
        const controlsRow = document.createElement('div');
        controlsRow.className = 'flex items-center justify-center gap-4';

        // Play/Pause Button
        const playBtn = document.createElement('button');
        playBtn.className = 'p-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white transition shadow-md active:scale-95';
        
        const updatePlayIcon = (playing: boolean) => {
            playBtn.innerHTML = playing
                ? `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>`
                : `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" /></svg>`;
        };
        this.sub(store.isPlaying, updatePlayIcon);
        playBtn.onclick = () => {
            const video = store.videoElement.value;
            if (video) {
                if (store.isPlaying.value) video.pause();
                else video.play();
                store.isPlaying.value = !store.isPlaying.value;
            }
        };
        controlsRow.appendChild(playBtn);

        // Mute & Volume Controller Pill
        const volContainer = document.createElement('div');
        volContainer.className = 'flex items-center gap-2 bg-white/10 hover:bg-white/15 px-3 py-1.5 rounded-full transition border border-white/5';
        
        const muteBtn = document.createElement('button');
        muteBtn.className = 'text-white hover:text-blue-400 transition';
        muteBtn.onclick = () => {
            const video = store.videoElement.value;
            if (video) {
                store.isMuted.value = !store.isMuted.value;
                video.muted = store.isMuted.value;
            }
        };

        const updateMuteIcon = (muted: boolean) => {
            muteBtn.className = muted ? 'text-blue-400 hover:text-blue-300 transition' : 'text-white hover:text-blue-400 transition';
            muteBtn.innerHTML = muted
                ? `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>`
                : `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clip-rule="evenodd" /></svg>`;
        };
        this.sub(store.isMuted, updateMuteIcon);
        volContainer.appendChild(muteBtn);

        const volInput = document.createElement('input');
        volInput.type = 'range';
        volInput.min = '0';
        volInput.max = '1';
        volInput.step = '0.1';
        volInput.className = 'w-16 sm:w-20 h-1 bg-white/30 rounded-full appearance-none cursor-pointer accent-blue-500';
        
        const updateVolInput = () => {
            volInput.value = (store.isMuted.value ? 0 : store.volume.value).toString();
        };
        this.sub(store.volume, v => {
            const video = store.videoElement.value;
            if (video) video.volume = v;
            updateVolInput();
        });
        this.sub(store.isMuted, updateVolInput);
        
        volInput.oninput = () => {
            const v = parseFloat(volInput.value);
            store.volume.value = v;
            if (v > 0 && store.isMuted.value) {
                store.isMuted.value = false;
                const video = store.videoElement.value;
                if (video) video.muted = false;
            }
        };
        volContainer.appendChild(volInput);
        controlsRow.appendChild(volContainer);

        // Aspect View Mode Reset Cycle Button
        const viewModeCycleBtn = document.createElement('button');
        viewModeCycleBtn.className = 'p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition active:scale-95';
        
        const updateViewCycleIcon = (mode: ViewMode) => {
            if (mode === 'flat') {
                viewModeCycleBtn.title = 'Fit Height (Click to cycle)';
                viewModeCycleBtn.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="8" y="2" width="8" height="20" rx="1" stroke-width="2" /></svg>`;
            } else if (mode === '180') {
                viewModeCycleBtn.title = 'Fit Screen (Click to cycle)';
                viewModeCycleBtn.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="1" stroke-width="2" /></svg>`;
            } else {
                viewModeCycleBtn.title = 'Center Focus (Click to cycle)';
                viewModeCycleBtn.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>`;
            }
        };
        
        // Note: Portrait mode uses viewMode locally as aspect sizing settings
        this.sub(store.viewMode, updateViewCycleIcon);
        
        viewModeCycleBtn.onclick = () => {
            const curr = store.viewMode.value;
            if (curr === 'flat') {
                store.viewMode.value = '180';
            } else if (curr === '180') {
                store.viewMode.value = '360';
            } else {
                store.viewMode.value = 'flat';
            }
        };
        controlsRow.appendChild(viewModeCycleBtn);

        // Immersive Fullscreen Button
        const fsBtn = document.createElement('button');
        fsBtn.className = 'p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition active:scale-95';
        
        const updateFsIcon = (fullscreen: boolean) => {
            fsBtn.title = fullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen';
            fsBtn.className = fullscreen 
                ? 'p-3 rounded-full bg-blue-600 text-white transition shadow active:scale-95'
                : 'p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition active:scale-95';
            fsBtn.innerHTML = fullscreen
                ? `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 10h6V4m0 6l-7-7m17 7h-6V4m0 6l7-7M4 14h6v6m0-6l-7 7m17-7h-6v6m0-6l7 7" /></svg>`
                : `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>`;
        };
        this.sub(store.isFullscreen, updateFsIcon);
        
        fsBtn.onclick = () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(err => {
                    console.log('Fullscreen error:', err);
                });
            } else {
                document.exitFullscreen();
            }
        };
        controlsRow.appendChild(fsBtn);

        // Lock UI button
        const lockBtn = document.createElement('button');
        lockBtn.className = 'p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition active:scale-95';
        lockBtn.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>`;
        lockBtn.onclick = () => {
            store.isUiLocked.value = true;
        };
        controlsRow.appendChild(lockBtn);

        container.appendChild(controlsRow);
    }
}
