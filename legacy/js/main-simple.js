// Simple main file - using p5.SoundFile directly
let soundFile = null;
let currentViz = null;
let vizMode = 'waveform';
let isPlaying = false;
let isLooping = true;

// Initialize when page loads
window.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing simple visualizer...');
    
    // Setup visualization mode selector
    const vizSelect = document.getElementById('vizMode');
    vizSelect.addEventListener('change', (e) => {
        vizMode = e.target.value;
        if (soundFile && soundFile.isLoaded()) {
            switchVisualization(vizMode);
        }
    });
    
    // Setup auto-play and loop checkboxes
    const autoPlayCheckbox = document.getElementById('autoPlay');
    const loopCheckbox = document.getElementById('loop');
    
    loopCheckbox.addEventListener('change', (e) => {
        isLooping = e.target.checked;
        if (soundFile) {
            soundFile.setLoop(isLooping);
        }
    });
    
    // Setup playback controls
    const playBtn = document.getElementById('playPauseBtn');
    const stopBtn = document.getElementById('stopBtn');
    const volumeSlider = document.getElementById('volumeSlider');
    
    playBtn.addEventListener('click', () => {
        if (soundFile && soundFile.isLoaded()) {
            if (isPlaying) {
                soundFile.pause();
                playBtn.textContent = '▶ Play';
                isPlaying = false;
            } else {
                soundFile.play();
                playBtn.textContent = '⏸ Pause';
                isPlaying = true;
            }
        }
    });
    
    stopBtn.addEventListener('click', () => {
        if (soundFile) {
            soundFile.stop();
            playBtn.textContent = '▶ Play';
            isPlaying = false;
        }
    });
    
    volumeSlider.addEventListener('input', (e) => {
        if (soundFile) {
            soundFile.setVolume(e.target.value / 100);
        }
    });
    
    // Load files from directory
    loadFilesFromDirectory();
});

function loadFilesFromDirectory() {
    fetch('/api/list-audio-files')
        .then(response => response.json())
        .then(files => {
            console.log(`Found ${files.length} files`);
            renderFileList(files);
        })
        .catch(error => {
            console.error('Error loading files:', error);
        });
}

function renderFileList(files) {
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = '';
    
    files.forEach((fileInfo, index) => {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.innerHTML = `
            <div class="file-item-name">${fileInfo.name}</div>
            <div class="file-item-meta">${formatFileSize(fileInfo.size)}</div>
        `;
        item.addEventListener('click', () => {
            loadAudioFile(fileInfo.path, fileInfo.name);
            // Highlight selected
            document.querySelectorAll('.file-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
        });
        fileList.appendChild(item);
    });
}

function loadAudioFile(path, name) {
    console.log('Loading:', path);
    
    // Stop current file if playing
    if (soundFile) {
        soundFile.stop();
    }
    
    // Create new sound file
    soundFile = loadSound(path, () => {
        console.log('Audio loaded:', name);
        
        // Update UI
        updateAudioInfo(soundFile);
        
        // Set loop
        soundFile.setLoop(isLooping);
        
        // Create visualization
        switchVisualization(vizMode);
        
        // Auto-play if enabled
        const autoPlayCheckbox = document.getElementById('autoPlay');
        if (autoPlayCheckbox && autoPlayCheckbox.checked) {
            soundFile.play();
            document.getElementById('playPauseBtn').textContent = '⏸ Pause';
            isPlaying = true;
        }
    }, (error) => {
        console.error('Error loading audio:', error);
        document.getElementById('audioInfo').innerHTML = `<p style="color: red;">Error loading file: ${name}</p>`;
    });
}

function switchVisualization(mode) {
    // Remove existing visualization
    if (currentViz) {
        currentViz.remove();
        currentViz = null;
    }
    
    const containerId = 'p5-container';
    
    switch (mode) {
        case 'waveform':
            currentViz = createWaveformVisualization(containerId, soundFile);
            break;
        case 'spectrum':
            currentViz = createSpectrumVisualization(containerId, soundFile);
            break;
        case 'haptic':
            currentViz = createHapticVisualization(containerId, soundFile);
            break;
        case 'spectrogram':
            currentViz = createSpectrogramVisualization(containerId, soundFile);
            break;
    }
}

function updateAudioInfo(file) {
    const infoEl = document.getElementById('audioInfo');
    if (file && file.isLoaded()) {
        const duration = file.duration();
        infoEl.innerHTML = `
            <p><strong>Duration:</strong> ${formatTime(duration)}</p>
            <p><strong>Sample Rate:</strong> ${file.sampleRate()} Hz</p>
        `;
    }
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
