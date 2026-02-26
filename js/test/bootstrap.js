// Initialize on page load
        window.addEventListener('DOMContentLoaded', async () => {
            // Initialize audio preview
            setupAudioPreview();
            
            // Initialize signal quality visualizer
            initializeSignalQualityVisualizer();
            
            await loadPatternMetadata();
            await loadFileList();
        });
