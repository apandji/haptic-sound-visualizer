(function registerAudioLifecycle() {
    const app = window.HapticApp || (window.HapticApp = {});
    const state = app.state;

    app.initializeVisualizer = function initializeVisualizer() {
        if (state.visualizer) {
            return;
        }

        const container = document.getElementById('p5-container');
        if (!container) {
            return;
        }

        const rect = container.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            state.visualizerInitRetries += 1;
            if (state.visualizerInitRetries < state.maxVisualizerRetries) {
                requestAnimationFrame(app.initializeVisualizer);
            } else {
                console.error('Visualizer container has no dimensions');
                state.visualizerInitRetries = 0;
            }
            return;
        }

        state.visualizerInitRetries = 0;
        state.visualizer = new Visualizer({
            containerId: 'p5-container',
            defaultMode: 'waveform',
            onReady: (loadSoundFn) => {
                app.initializeAudioPlayer(loadSoundFn);
            }
        });
    };

    app.initializeAudioPlayer = function initializeAudioPlayer(loadSoundFn) {
        if (state.audioPlayer) {
            return;
        }

        state.audioPlayer = new AudioPlayer({
            loadSoundFn: loadSoundFn,
            defaultLoop: true,
            onPlay: () => {
                app.updatePlayState(true);
            },
            onPause: () => {
                app.updatePlayState(false);
            },
            onStop: () => {
                app.updatePlayState(false);
            },
            onEnd: () => {
                app.updatePlayState(false);
            }
        });

        if (state.visualizer) {
            state.visualizer.setAudioPlayer(state.audioPlayer);
        }

        app.initializeAudioControls();
    };

    app.initializeAudioControls = function initializeAudioControls() {
        if (state.audioControls) {
            return;
        }

        state.audioControls = new AudioControls({
            containerId: 'audioControlsContainer',
            audioPlayer: state.audioPlayer,
            visualizer: state.visualizer,
            defaultLoopMode: 'loop',
            defaultMode: 'waveform',
            onLoopModeChange: (mode, duration) => {
                console.log('Loop mode changed:', mode);
            },
            onModeChange: (mode) => {
                console.log('Visualization mode changed:', mode);
            },
            onStop: () => {
                app.unloadCurrentFile();
            },
            onPlayPause: (isPlaying) => {
                app.updatePlayState(isPlaying);
            }
        });
    };

    app.updatePlayState = function updatePlayState(isPlaying) {
        if (state.patternExplorer && state.patternExplorer.patternExplorer) {
            state.patternExplorer.patternExplorer.setPlayingFile(state.currentFilePath, isPlaying);
        }

        if (state.audioControls && typeof state.audioControls.updatePlayPauseState === 'function') {
            state.audioControls.updatePlayPauseState(isPlaying);
        }
    };

    app.showVisualizer = function showVisualizer() {
        if (state.mainPlaceholder) {
            state.mainPlaceholder.classList.add('hidden');
        }
        if (state.visualizerContainer) {
            state.visualizerContainer.classList.add('active');
        }
    };

    app.hideVisualizer = function hideVisualizer() {
        if (state.mainPlaceholder) {
            state.mainPlaceholder.classList.remove('hidden');
        }
        if (state.visualizerContainer) {
            state.visualizerContainer.classList.remove('active');
        }
    };

    app.loadAndPlayFile = function loadAndPlayFile(file) {
        const originalPath = file.path || `audio_files/${file.name}`;
        let audioUrl = originalPath;
        if (audioUrl.startsWith('/')) {
            audioUrl = audioUrl.substring(1);
        }

        app.showVisualizer();

        if (state.patternExplorer && state.patternExplorer.patternExplorer) {
            state.patternExplorer.patternExplorer.setActiveFile(originalPath);
        }

        state.currentFilePath = originalPath;

        if (typeof userStartAudio === 'function') {
            userStartAudio().catch(() => {});
        }

        if (!state.visualizer) {
            app.initializeVisualizer();
        }

        let loadRetries = 0;
        const maxLoadRetries = 60;

        const tryLoadAndPlay = () => {
            if (!state.audioPlayer) {
                loadRetries += 1;
                if (loadRetries < maxLoadRetries) {
                    setTimeout(tryLoadAndPlay, 50);
                } else {
                    console.error('AudioPlayer not ready');
                    app.hideVisualizer();
                }
                return;
            }

            const startContext = state.visualizer
                ? state.visualizer.ensureAudioContextStarted()
                : Promise.resolve(true);

            startContext
                .then(() => state.audioPlayer.loadFile(audioUrl))
                .then(() => {
                    state.audioPlayer.play();
                })
                .catch((error) => {
                    console.error('Error loading file:', error);
                    state.currentFilePath = null;
                    app.hideVisualizer();
                    if (state.patternExplorer && state.patternExplorer.patternExplorer) {
                        state.patternExplorer.patternExplorer.setActiveFile(null);
                    }
                });
        };

        tryLoadAndPlay();
    };

    app.unloadCurrentFile = function unloadCurrentFile() {
        if (state.audioPlayer) {
            state.audioPlayer.stop();
        }
        state.currentFilePath = null;

        if (state.visualizer) {
            state.visualizer.clearPauseState();
        }

        window._pendingFileToLoad = null;
        window._pendingFilePath = null;
        window._pendingAudioUrl = null;

        app.hideVisualizer();

        if (state.patternExplorer && state.patternExplorer.patternExplorer) {
            state.patternExplorer.patternExplorer.setActiveFile(null);
            state.patternExplorer.patternExplorer.setPlayingFile(null, false);
        }
    };

    app.togglePlayPause = function togglePlayPause() {
        if (!state.audioPlayer || !state.audioPlayer.isLoaded()) {
            return;
        }

        if (state.audioPlayer.isPlaying()) {
            state.audioPlayer.pause();
        } else {
            if (state.visualizer) {
                state.visualizer.ensureAudioContextStarted();
            }
            state.audioPlayer.play();
        }
    };
})();
