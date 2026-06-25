(function registerExplorerBindings() {
    const app = window.HapticApp || (window.HapticApp = {});
    const state = app.state;

    app.handleFileClick = function handleFileClick(file) {
        if (state.previewMode === 'multi') {
            app.assignFileToActiveMultiSlot(file);
            return;
        }

        const filePath = file.path || `audio_files/${file.name}`;

        if (state.currentFilePath === filePath) {
            app.unloadCurrentFile();
            return;
        }

        if (state.audioControls && state.audioControls.getLoopMode() === 'test') {
            state.audioControls.setLoopMode('off');
        }

        if (state.audioPlayer && state.audioPlayer.isPlaying()) {
            state.audioPlayer.stop();
        }

        app.loadAndPlayFile(file);
    };

    app.handleFilePreview = function handleFilePreview(file) {
        if (state.previewMode === 'multi') {
            app.assignFileToActiveMultiSlot(file);
            return;
        }

        const filePath = file.path || `audio_files/${file.name}`;

        if (state.currentFilePath === filePath) {
            app.togglePlayPause();
            return;
        }

        app.handleFileClick(file);
    };

    app.initializeComponent = function initializeComponent() {
        const fileListEl = document.getElementById('fileList');
        if (window.AppUI) {
            AppUI.clearBusy(fileListEl);
        }

        state.patternExplorer = new PatternExplorerWithFilters({
            containerId: 'fileList',
            filterContainerId: 'filterPanel',
            files: state.allFilesList,
            metadata: state.patternMetadata,
            onFileClick: (file) => {
                app.handleFileClick(file);
            },
            onFileHover: (file, metadata, event) => {},
            onFilePreview: (file) => {
                app.handleFilePreview(file);
            },
            onPlayStateChange: (file, isPlaying) => {
                if (!state.audioPlayer || !state.audioPlayer.isLoaded()) {
                    return;
                }

                const filePath = file.path || `audio_files/${file.name}`;
                if (state.currentFilePath !== filePath) {
                    return;
                }

                if (isPlaying) {
                    if (state.visualizer) {
                        state.visualizer.ensureAudioContextStarted();
                    }
                    state.audioPlayer.play();
                } else {
                    state.audioPlayer.pause();
                }
            }
        });

        app.syncPatternLibraryDrag?.();
    };
})();
