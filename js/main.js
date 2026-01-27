// Main application entry point
let audioProcessor = null;
let currentVisualization = null;
let visualizationMode = 'waveform';
let updateInterval = null;

// Initialize the application
async function init() {
    console.log('Haptic Sound Visualizer initialized');
    
    // Initialize audio processor
    audioProcessor = new AudioProcessor();
    try {
        await audioProcessor.init();
    } catch (error) {
        console.error('Error initializing audio processor:', error);
        alert('Your browser does not support Web Audio API');
        return;
    }
    
    // Setup file manager callbacks
    if (fileManager) {
        fileManager.onFileSelect(async (file) => {
            await loadFile(file);
        });
    }
    
    // Setup playback controls callbacks
    if (playbackControls) {
        playbackControls.onPlay(() => {
            audioProcessor.play();
            startVisualizationUpdate();
        });
        
        playbackControls.onPause(() => {
            audioProcessor.pause();
        });
        
        playbackControls.onStop(() => {
            audioProcessor.stop();
            stopVisualizationUpdate();
        });
        
        playbackControls.onSeek((time) => {
            // Seek functionality would need to be implemented in AudioProcessor
            console.log('Seek to:', time);
        });
        
        playbackControls.onVolumeChange((volume) => {
            audioProcessor.setVolume(volume);
        });
    }
    
    // Setup visualization mode selector
    const vizModeSelect = document.getElementById('vizMode');
    if (vizModeSelect) {
        vizModeSelect.addEventListener('change', (e) => {
            switchVisualization(e.target.value);
        });
    }
    
    // Setup auto-play checkbox
    const autoPlayCheckbox = document.getElementById('autoPlay');
    if (autoPlayCheckbox) {
        // Auto-play will be handled in loadFile
    }
    
    // Setup loop checkbox
    const loopCheckbox = document.getElementById('loop');
    if (loopCheckbox) {
        // Initialize loop state
        audioProcessor.setLoop(loopCheckbox.checked);
        
        loopCheckbox.addEventListener('change', (e) => {
            audioProcessor.setLoop(e.target.checked);
        });
    }
    
    // Initialize with default visualization
    switchVisualization('waveform');
}

async function loadFile(file) {
    try {
        console.log('Loading file:', file);
        const fileInfo = await audioProcessor.loadFile(file);
        console.log('File loaded successfully:', fileInfo);
        
        // Update UI
        if (playbackControls) {
            playbackControls.setDuration(fileInfo.duration);
        }
        
        // Update audio info panel
        updateAudioInfo(fileInfo);
        
        // Set loop setting
        const loopCheckbox = document.getElementById('loop');
        if (loopCheckbox) {
            audioProcessor.setLoop(loopCheckbox.checked);
        }
        
        // Auto-play if enabled
        const autoPlayCheckbox = document.getElementById('autoPlay');
        if (autoPlayCheckbox && autoPlayCheckbox.checked) {
            // Small delay to ensure audio context is ready
            setTimeout(() => {
                try {
                    // Resume audio context if suspended (required for autoplay)
                    if (audioProcessor.audioContext && audioProcessor.audioContext.state === 'suspended') {
                        audioProcessor.audioContext.resume();
                    }
                    
                    // Only play if we have a buffer loaded
                    if (audioProcessor && audioProcessor.buffer) {
                        audioProcessor.play();
                        if (playbackControls) {
                            playbackControls.play();
                        }
                        startVisualizationUpdate();
                    }
                } catch (error) {
                    console.warn('Auto-play failed (may require user interaction):', error);
                }
            }, 200);
        }
        
        console.log('File loaded:', fileInfo);
    } catch (error) {
        console.error('Error loading file:', error);
        // Show error in UI instead of alert
        const audioInfoEl = document.getElementById('audioInfo');
        if (audioInfoEl) {
            audioInfoEl.innerHTML = `<p style="color: #ff6b6b;">Error loading file: ${error.message}</p><p style="color: #999; font-size: 12px;">File: ${file}</p>`;
        }
        
        // Mark file as having an error in file manager
        if (fileManager && fileManager.getCurrentFile) {
            const currentFile = fileManager.getCurrentFile();
            if (currentFile) {
                currentFile.error = error.message;
                fileManager.renderFileList();
            }
        }
        
        // Only show alert for critical errors (not for every failed file)
        if (error.message.includes('decode') || error.message.includes('Failed to load')) {
            // Silent fail for individual files, user can try another
        }
    }
}

function switchVisualization(mode) {
    visualizationMode = mode;
    
    // Remove existing visualization
    if (currentVisualization) {
        currentVisualization.remove();
        currentVisualization = null;
    }
    
    // Create new visualization
    const containerId = 'p5-container';
    
    switch (mode) {
        case 'waveform':
            currentVisualization = createWaveformVisualization(containerId, audioProcessor);
            break;
        case 'spectrum':
            currentVisualization = createSpectrumVisualization(containerId, audioProcessor);
            break;
        case 'haptic':
            currentVisualization = createHapticVisualization(containerId, audioProcessor);
            break;
        case 'spectrogram':
            currentVisualization = createSpectrogramVisualization(containerId, audioProcessor);
            break;
        default:
            currentVisualization = createWaveformVisualization(containerId, audioProcessor);
    }
}

function startVisualizationUpdate() {
    if (updateInterval) return;
    
    updateInterval = setInterval(() => {
        if (audioProcessor && playbackControls) {
            const currentTime = audioProcessor.getCurrentTime();
            const duration = playbackControls.duration;
            
            playbackControls.setCurrentTime(currentTime);
            
            // Update visualization time if it has an updateTime method
            if (currentVisualization && currentVisualization.updateTime) {
                currentVisualization.updateTime(currentTime, duration);
            }
        }
    }, 100); // Update 10 times per second
}

function stopVisualizationUpdate() {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
}

function updateAudioInfo(fileInfo) {
    const audioInfoEl = document.getElementById('audioInfo');
    if (audioInfoEl) {
        audioInfoEl.innerHTML = `
            <p><strong>Duration:</strong> ${formatTime(fileInfo.duration)}</p>
            <p><strong>Sample Rate:</strong> ${fileInfo.sampleRate} Hz</p>
            <p><strong>Channels:</strong> ${fileInfo.numberOfChannels}</p>
            <p><strong>Samples:</strong> ${fileInfo.length.toLocaleString()}</p>
        `;
    }
}

function formatTime(seconds) {
    if (isNaN(seconds) || seconds === 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    // Wait a bit for other scripts to initialize
    setTimeout(init, 100);
}
