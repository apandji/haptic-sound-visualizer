(function bootstrapHapticApp() {
    const app = window.HapticApp || (window.HapticApp = {});
    const state = app.state;

    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();

            if (state.audioPlayer && state.audioPlayer.isLoaded()) {
                if (state.audioPlayer.isPlaying()) {
                    state.audioPlayer.pause();
                } else {
                    if (state.visualizer) {
                        state.visualizer.ensureAudioContextStarted();
                    }
                    state.audioPlayer.play();
                }
            }
        }
    });

    window.addEventListener('DOMContentLoaded', async () => {
        state.mainPlaceholder = document.getElementById('mainPlaceholder');
        state.visualizerContainer = document.getElementById('visualizerContainer');

        await app.loadPatternMetadata();
        await app.loadFileList();
    });
})();
