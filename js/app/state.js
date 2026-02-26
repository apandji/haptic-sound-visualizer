(function initializeHapticAppState() {
    const app = window.HapticApp || (window.HapticApp = {});

    app.state = app.state || {
        allFilesList: [],
        patternMetadata: {},
        visualizer: null,
        audioPlayer: null,
        audioControls: null,
        patternExplorer: null,
        currentFilePath: null,
        mainPlaceholder: null,
        visualizerContainer: null,
        visualizerInitRetries: 0,
        maxVisualizerRetries: 30
    };
})();
