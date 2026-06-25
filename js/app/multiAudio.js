(function registerMultiAudioExplore() {
    const app = window.HapticApp || (window.HapticApp = {});
    const state = app.state;

    const STORAGE_MODE = 'explorePreviewMode';
    const STORAGE_ASSIGNMENTS = 'exploreMultiAssignments';
    const STORAGE_BLEND_STRATEGY = 'exploreBlendStrategy';
    const STORAGE_MIX_POSITION = 'exploreMultiMixPosition';

    const SINGLE_MODES = window.VisualizationModes?.getSingleModeOptions?.() || [
        { value: 'waveform', label: 'Waveform' },
        { value: 'intensity', label: 'Intensity Bars' },
        { value: 'stereo', label: 'Stereo Field' },
        { value: 'spectrum', label: 'Frequency Spectrum' },
        { value: 'pulses', label: 'Directional Pulses' },
        { value: 'blob', label: 'Liquid Blob' },
        { value: 'particles', label: 'Particle Swarm' },
        { value: 'landscape', label: 'Frequency Terrain' }
    ];

    function blendStrategyModes() {
        return window.VisualizationModes?.getMultiBlendModeOptions?.() || [];
    }

    function readStoredMode() {
        const stored = sessionStorage.getItem(STORAGE_MODE);
        return stored === 'multi' ? 'multi' : 'single';
    }

    function readStoredAssignments() {
        try {
            const raw = sessionStorage.getItem(STORAGE_ASSIGNMENTS);
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            return null;
        }
    }

    function readStoredBlendStrategy() {
        return sessionStorage.getItem(STORAGE_BLEND_STRATEGY) || 'layered';
    }

    function readStoredMixPosition() {
        const raw = sessionStorage.getItem(STORAGE_MIX_POSITION);
        const value = Number(raw);
        if (!Number.isFinite(value)) return 0.5;
        return Math.max(0, Math.min(1, value));
    }

    function getCurrentMixPosition() {
        return state.multiAudioMixer?.getMixPosition()
            ?? state.multiAudioPanel?.mixPosition
            ?? readStoredMixPosition();
    }

    function persistMultiState() {
        sessionStorage.setItem(STORAGE_MODE, state.previewMode);
        sessionStorage.setItem(STORAGE_ASSIGNMENTS, JSON.stringify(state.multiAudioMixer?.getSlotAssignments() || []));
        sessionStorage.setItem(STORAGE_BLEND_STRATEGY, state.blendStrategyId || 'layered');
        sessionStorage.setItem(STORAGE_MIX_POSITION, String(getCurrentMixPosition()));
    }

    function ensureMultiAudioMixer() {
        if (state.multiAudioMixer || !state.visualizer?.loadSoundFn) {
            return Boolean(state.multiAudioMixer);
        }

        state.multiAudioMixer = new MultiAudioMixer({
            loadSoundFn: state.visualizer.loadSoundFn,
            defaultLoop: true,
            onPlayStateChange: (isPlaying) => {
                if (state.audioControls) {
                    state.audioControls.updatePlayPauseState(isPlaying);
                }
            }
        });

        const storedAssignments = readStoredAssignments();
        if (storedAssignments) {
            state.multiAudioMixer.setSlotAssignments(storedAssignments);
        }

        state.multiAudioMixer.setMixPosition(getCurrentMixPosition());
        return true;
    }

    function hasMultiAssignments() {
        const assignments = state.multiAudioMixer?.getSlotAssignments()
            || state.multiAudioPanel?.assignments
            || [];
        if (window.MultiAudioPathGains?.hasAudibleAssignments) {
            return window.MultiAudioPathGains.hasAudibleAssignments(assignments);
        }
        return assignments.some((slot) => Boolean(slot?.path));
    }

    function setPreviewModeToggleActive(mode) {
        const toggle = document.getElementById('previewModeToggle');
        if (!toggle) return;

        const tabs = toggle.querySelectorAll('[data-preview-mode]');
        let activeTab = null;

        tabs.forEach((tab) => {
            const isActive = tab.dataset.previewMode === mode;
            tab.classList.toggle('segmented-control__item--active', isActive);
            tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
            tab.tabIndex = isActive ? 0 : -1;
            if (isActive) activeTab = tab;
        });

        if (state.previewModeTabControls && activeTab) {
            state.previewModeTabControls.syncTabIndex(activeTab);
        }
    }

    function updateMultiExploreLayout() {
        const isMulti = state.previewMode === 'multi';
        const multiMount = document.getElementById('multiAudioPanelMount');

        if (multiMount) {
            multiMount.classList.toggle('hidden', !isMulti);
        }

        if (!isMulti) {
            if (!state.currentFilePath) {
                app.hideVisualizer();
            }
            return;
        }

        initMultiAudioPanel();

        if (state.visualizer) {
            state.visualizer.setVisualizationSource('multi');
            state.visualizer.setBlendStrategyId(state.blendStrategyId || 'layered');
            state.visualizer.setMixPosition(getCurrentMixPosition());
        }

        if (hasMultiAssignments()) {
            app.showVisualizer();
            if (!state.visualizer) {
                app.initializeVisualizer();
            }
            requestAnimationFrame(() => {
                if (!state.visualizer) {
                    app.initializeVisualizer();
                }
                ensureMultiAudioMixer();
                configureAudioControlsForMode();
            });
        } else {
            app.hideVisualizer();
        }
    }

    function syncPatternLibraryDrag() {
        const explorer = state.patternExplorer?.patternExplorer;
        if (explorer?.setFileDragEnabled) {
            explorer.setFileDragEnabled(state.previewMode === 'multi');
        }
    }

    function ensureMultiAudioReadyForAssignment() {
        app.showVisualizer();
        state.visualizerInitRetries = 0;

        return new Promise((resolve) => {
            let retries = 0;
            const maxRetries = 150;

            const tick = () => {
                if (!state.visualizer) {
                    app.initializeVisualizer();
                }
                if (ensureMultiAudioMixer()) {
                    resolve(true);
                    return;
                }
                retries += 1;
                if (retries >= maxRetries) {
                    console.error('Multi-audio: could not initialize mixer for slot assignment');
                    resolve(false);
                    return;
                }
                setTimeout(tick, 50);
            };

            requestAnimationFrame(() => {
                requestAnimationFrame(tick);
            });
        });
    }

    function configureAudioControlsForMode() {
        if (!state.audioControls) return;

        const isMulti = state.previewMode === 'multi';

        if (isMulti) {
            state.audioControls.applyMultiProfile({
                modes: blendStrategyModes(),
                currentMode: state.blendStrategyId || 'layered',
                canPlayCheck: () => Boolean(state.multiAudioMixer?.hasAssignments())
            });
            state.audioControls.onPlayPause = async (shouldPlay) => {
                if (!ensureMultiAudioMixer()) return;
                if (state.visualizer) {
                    await state.visualizer.ensureAudioContextStarted();
                }
                if (shouldPlay) {
                    await state.multiAudioMixer.play();
                } else {
                    state.multiAudioMixer.pause();
                }
            };
            state.audioControls.onStop = () => {
                state.multiAudioMixer?.stop();
            };
            state.audioControls.onModeChange = (strategyId) => {
                state.blendStrategyId = strategyId;
                if (state.visualizer) {
                    state.visualizer.setBlendStrategyId(strategyId);
                }
                persistMultiState();
            };
        } else {
            const vizMode = state.visualizer?.currentMode || state.visualizer?.mode || 'waveform';
            state.audioControls.applySingleProfile({
                modes: SINGLE_MODES,
                currentMode: vizMode
            });
            state.audioControls.onPlayPause = (isPlaying) => {
                app.updatePlayState(isPlaying);
            };
            state.audioControls.onStop = () => {
                app.unloadCurrentFile();
            };
            state.audioControls.onModeChange = (mode) => {
                if (state.visualizer) {
                    state.visualizer.setMode(mode);
                }
            };
        }
    }

    function initMultiAudioPanel() {
        const mount = document.getElementById('multiAudioPanelMount');
        if (!mount || state.multiAudioPanel) return;

        state.multiAudioPanel = new MultiAudioPanel({
            containerId: 'multiAudioPanelMount',
            activeSlotIndex: state.activeMultiSlotIndex ?? 2,
            mixPosition: readStoredMixPosition(),
            onActiveSlotChange: (index) => {
                state.activeMultiSlotIndex = index;
            },
            onAssignmentChange: (assignments) => {
                if (!state.multiAudioMixer) ensureMultiAudioMixer();
                state.multiAudioMixer?.setSlotAssignments(assignments);
                persistMultiState();
                updateMultiExploreLayout();
            },
            onMixPositionChange: (position) => {
                state.multiAudioMixer?.setMixPosition(position);
                if (state.visualizer) {
                    state.visualizer.setMixPosition(position);
                }
                persistMultiState();
            },
            onFileDrop: (slotIndex, file) => {
                app.assignFileToMultiSlot(file, slotIndex);
            }
        });

        const storedAssignments = readStoredAssignments();
        if (storedAssignments) {
            state.multiAudioPanel.setAssignments(storedAssignments);
        }
    }

    function initPreviewModeToggle() {
        const mount = document.getElementById('previewModeToggle');
        if (!mount || mount.dataset.bound === 'true') return;
        mount.dataset.bound = 'true';

        mount.className = 'explore-mode-toggle';
        const initialMode = state.previewMode || 'single';

        mount.innerHTML = `
            <div class="segmented-control segmented-control--sm explore-mode-toggle__tabs" id="explorePreviewModeTablist" role="tablist" aria-label="Preview audio mode">
                <button type="button" class="segmented-control__item ${initialMode === 'single' ? 'segmented-control__item--active' : ''}" data-preview-mode="single" role="tab" aria-selected="${initialMode === 'single'}" aria-controls="main-content">Single</button>
                <button type="button" class="segmented-control__item ${initialMode === 'multi' ? 'segmented-control__item--active' : ''}" data-preview-mode="multi" role="tab" aria-selected="${initialMode === 'multi'}" aria-controls="main-content" tabindex="${initialMode === 'multi' ? '0' : '-1'}">Multi</button>
            </div>
        `;

        const tablist = mount.querySelector('[role="tablist"]');

        mount.querySelectorAll('[data-preview-mode]').forEach((button) => {
            button.addEventListener('click', () => {
                app.setPreviewMode(button.dataset.previewMode);
            });
        });

        if (window.AppUI?.bindSegmentedTabs) {
            state.previewModeTabControls = AppUI.bindSegmentedTabs(tablist, {
                getValue: (tab) => tab.dataset.previewMode,
                onSelect: (mode) => {
                    app.setPreviewMode(mode);
                }
            });
        }
    }

    function applyPreviewModeUi() {
        setPreviewModeToggleActive(state.previewMode);

        if (state.visualizer) {
            state.visualizer.setVisualizationSource(state.previewMode === 'multi' ? 'multi' : 'single');
        }

        configureAudioControlsForMode();
        updateMultiExploreLayout();
        syncPatternLibraryDrag();

        if (state.previewMode === 'multi') {
            ensureMultiAudioMixer();
            if (state.multiAudioPanel && state.multiAudioMixer) {
                state.multiAudioPanel.setAssignments(state.multiAudioMixer.getSlotAssignments());
                const mixPosition = getCurrentMixPosition();
                state.multiAudioPanel.setMixPosition(mixPosition);
                state.multiAudioMixer.setMixPosition(mixPosition);
                if (state.visualizer) {
                    state.visualizer.setMixPosition(mixPosition);
                }
            }
        }
    }

    app.setPreviewMode = function setPreviewMode(mode) {
        const nextMode = mode === 'multi' ? 'multi' : 'single';
        if (nextMode === state.previewMode) return;

        if (state.previewMode === 'multi') {
            state.multiAudioMixer?.stop();
        } else {
            state.audioPlayer?.stop();
            if (!state.currentFilePath) {
                app.hideVisualizer();
            }
        }

        state.previewMode = nextMode;
        persistMultiState();
        applyPreviewModeUi();
    };

    app.getMultiMixVizState = function getMultiMixVizState() {
        if (!state.multiAudioMixer) {
            return {
                sources: [],
                mixPosition: getCurrentMixPosition(),
                blendStrategyId: state.blendStrategyId || 'layered',
                patternMetadata: state.patternMetadata || {}
            };
        }
        return {
            sources: state.multiAudioMixer.getMixVisualizationState(),
            mixPosition: state.multiAudioMixer.getMixPosition(),
            blendStrategyId: state.blendStrategyId || 'layered',
            patternMetadata: state.patternMetadata || {}
        };
    };

    app.assignFileToMultiSlot = function assignFileToMultiSlot(file, slotIndex) {
        if (!file) return;

        const assignments = state.multiAudioPanel?.assignments
            || state.multiAudioMixer?.getSlotAssignments()
            || [];
        if (window.MultiAudioPathGains?.validateSlotAssignment) {
            const check = window.MultiAudioPathGains.validateSlotAssignment(assignments, slotIndex, file);
            if (!check.ok) {
                window.AppUI?.showToast?.(check.reason, { variant: 'warning' });
                return;
            }
        }

        state.activeMultiSlotIndex = slotIndex;
        initMultiAudioPanel();
        state.multiAudioPanel?.setActiveSlotIndex(slotIndex);

        const path = window.MultiAudioConstants?.normalizeMultiAudioPath(
            file.path || `audio_files/${file.name}`
        );
        const nextAssignments = window.MultiAudioPathGains?.sanitizeSlotAssignments
            ? window.MultiAudioPathGains.sanitizeSlotAssignments(assignments)
            : [...assignments];
        while (nextAssignments.length < 5) nextAssignments.push(null);
        nextAssignments[slotIndex] = { name: file.name, path };
        state.multiAudioPanel?.setAssignments(nextAssignments);

        ensureMultiAudioReadyForAssignment().then((ready) => {
            if (!ready) return;
            state.multiAudioMixer.setSlotAssignment(slotIndex, file).then(() => {
                const assignments = state.multiAudioMixer.getSlotAssignments();
                state.multiAudioPanel?.setAssignments(assignments);
                persistMultiState();
                updateMultiExploreLayout();
            });
        });
    };

    app.assignFileToActiveMultiSlot = function assignFileToActiveMultiSlot(file) {
        app.assignFileToMultiSlot(file, state.activeMultiSlotIndex ?? 2);
    };

    app.toggleMultiPlayPause = function toggleMultiPlayPause() {
        if (!state.audioControls) return;
        state.audioControls.handlePlayPause();
    };

    app.initExploreMultiAudio = function initExploreMultiAudio() {
        state.previewMode = readStoredMode();
        state.blendStrategyId = readStoredBlendStrategy();
        state.activeMultiSlotIndex = 2;

        initPreviewModeToggle();
        initMultiAudioPanel();
        applyPreviewModeUi();
    };

    app.syncPatternLibraryDrag = syncPatternLibraryDrag;

    const originalInitVisualizer = app.initializeVisualizer;
    app.initializeVisualizer = function initializeVisualizerWithMulti() {
        originalInitVisualizer();
        if (state.visualizer && state.previewMode === 'multi') {
            ensureMultiAudioMixer();
        }
        configureAudioControlsForMode();
    };

    const originalInitAudioPlayer = app.initializeAudioPlayer;
    app.initializeAudioPlayer = function initializeAudioPlayerWithMulti(loadSoundFn) {
        originalInitAudioPlayer(loadSoundFn);
        if (state.previewMode === 'multi') {
            ensureMultiAudioMixer();
        }
        configureAudioControlsForMode();
    };

    const originalInitAudioControls = app.initializeAudioControls;
    app.initializeAudioControls = function initializeAudioControlsWithMulti() {
        originalInitAudioControls();
        configureAudioControlsForMode();
    };
})();
