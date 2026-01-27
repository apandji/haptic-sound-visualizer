// Simple Haptic Sound Visualizer
let sound = null;
let fft = null;
let isPlaying = false;
let isLooping = true;
let currentFilePath = null;
let filesList = [];

// Load files when page loads
window.addEventListener('DOMContentLoaded', () => {
    loadFileList();
    setupControls();
    setupP5Sketch();
});

// Load file list from server
async function loadFileList() {
    try {
        const response = await fetch('/api/list-audio-files');
        filesList = await response.json();
        renderFileList(filesList);
    } catch (error) {
        console.error('Error loading files:', error);
        document.getElementById('fileList').innerHTML = '<p style="color: red;">Error loading files</p>';
    }
}

// Render file list
function renderFileList(files) {
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = '';
    
    files.forEach(file => {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.textContent = file.name;
        item.addEventListener('click', () => {
            // Remove active from all
            document.querySelectorAll('.file-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            loadAudio(file.path);
        });
        fileList.appendChild(item);
    });
}

// Load audio file - this will be called from p5 sketch
function loadAudio(path) {
    console.log('loadAudio called with path:', path);
    console.log('window.p5Sketch exists:', !!window.p5Sketch);
    console.log('loadAudioFile function exists:', !!(window.p5Sketch && window.p5Sketch.loadAudioFile));
    
    currentFilePath = path;
    
    // Stop current sound if playing
    if (sound) {
        try {
            sound.stop();
        } catch (e) {
            console.log('Error stopping:', e);
        }
        sound = null;
    }
    
    // Use the stored function reference
    const loadFn = loadAudioFileFunction || window.loadAudioFileFunction;
    
    if (typeof loadFn === 'function') {
        console.log('Calling loadAudioFile function');
        try {
            loadFn(path);
        } catch (error) {
            console.error('Error calling loadAudioFile:', error);
            alert('Error loading file: ' + error.message);
        }
    } else {
        console.error('loadAudioFile function not available yet, waiting...');
        // Retry after a short delay
        setTimeout(() => {
            const retryFn = loadAudioFileFunction || window.loadAudioFileFunction;
            if (typeof retryFn === 'function') {
                console.log('Retrying loadAudioFile');
                retryFn(path);
            } else {
                console.error('loadAudioFile function still not available');
                alert('Error: Audio loading function not ready. Please refresh the page.');
            }
        }, 1000);
    }
}

// Setup controls
function setupControls() {
    const playBtn = document.getElementById('playBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const stopBtn = document.getElementById('stopBtn');
    const loopBtn = document.getElementById('loopBtn');
    
    playBtn.addEventListener('click', () => {
        if (!sound) {
            console.log('No sound loaded');
            return;
        }
        
        if (!sound.isLoaded()) {
            console.log('Sound not loaded yet');
            return;
        }
        
        try {
            sound.play();
            playBtn.style.display = 'none';
            pauseBtn.style.display = 'inline-block';
            isPlaying = true;
        } catch (error) {
            console.error('Error playing:', error);
        }
    });
    
    pauseBtn.addEventListener('click', () => {
        if (sound && sound.isLoaded()) {
            try {
                sound.pause();
                playBtn.style.display = 'inline-block';
                pauseBtn.style.display = 'none';
                isPlaying = false;
            } catch (error) {
                console.error('Error pausing:', error);
            }
        }
    });
    
    stopBtn.addEventListener('click', () => {
        if (sound && sound.isLoaded()) {
            try {
                sound.stop();
                playBtn.style.display = 'inline-block';
                pauseBtn.style.display = 'none';
                isPlaying = false;
            } catch (error) {
                console.error('Error stopping:', error);
            }
        }
    });
    
    loopBtn.addEventListener('click', () => {
        isLooping = !isLooping;
        loopBtn.classList.toggle('active', isLooping);
        
        if (sound && sound.isLoaded()) {
            sound.setLoop(isLooping);
        }
    });
}

// Store reference to load function
let loadAudioFileFunction = null;

// Setup p5.js sketch
function setupP5Sketch() {
    const sketch = function(p) {
        p.setup = function() {
            const container = document.getElementById('p5-container');
            const canvas = p.createCanvas(container.clientWidth, container.clientHeight);
            canvas.parent('p5-container');
            
            fft = new p5.FFT();
            console.log('p5.js sketch setup complete');
        };
        
        // Function to load audio file (called from outside)
        // Store it in a way that's accessible
        const loadAudioFile = function(path) {
            console.log('loadAudioFile called in p5 sketch with path:', path);
            
            const playBtn = document.getElementById('playBtn');
            const pauseBtn = document.getElementById('pauseBtn');
            if (playBtn) {
                playBtn.textContent = '⋯';
                playBtn.disabled = true;
            }
            if (pauseBtn) {
                pauseBtn.style.display = 'none';
            }
            
            // Stop current sound
            if (sound) {
                try {
                    sound.stop();
                } catch (e) {
                    console.log('Error stopping sound:', e);
                }
                sound = null;
            }
            
            console.log('Calling p.loadSound with path:', path);
            
            // Load new sound using p5's loadSound
            try {
                sound = p.loadSound(
                    path,
                    () => {
                        // Success callback
                        console.log('Audio loaded successfully!');
                        console.log('Sound object:', sound);
                        
                        // Wait a bit for sound to be fully ready
                        setTimeout(() => {
                            if (sound && sound.isLoaded()) {
                                console.log('Sound is loaded, duration:', sound.duration());
                                sound.setLoop(isLooping);
                                
                                // Try to play
                                try {
                                    sound.play();
                                    isPlaying = true;
                                    const playBtn = document.getElementById('playBtn');
                                    const pauseBtn = document.getElementById('pauseBtn');
                                    if (playBtn) {
                                        playBtn.style.display = 'none';
                                        playBtn.disabled = false;
                                    }
                                    if (pauseBtn) {
                                        pauseBtn.style.display = 'inline-block';
                                    }
                                    console.log('Audio started playing successfully');
                                } catch (playError) {
                                    console.warn('Autoplay blocked:', playError);
                                    const playBtn = document.getElementById('playBtn');
                                    if (playBtn) {
                                        playBtn.style.display = 'inline-block';
                                        playBtn.disabled = false;
                                    }
                                }
                            } else {
                                console.error('Sound loaded but isLoaded() returns false');
                                const playBtn = document.getElementById('playBtn');
                                if (playBtn) {
                                    playBtn.textContent = '▶';
                                    playBtn.style.display = 'inline-block';
                                    playBtn.disabled = false;
                                }
                            }
                        }, 100);
                    },
                    (error) => {
                        // Error callback
                        console.error('Error loading audio:', error);
                        const playBtn = document.getElementById('playBtn');
                        if (playBtn) {
                            playBtn.textContent = '▶';
                            playBtn.style.display = 'inline-block';
                            playBtn.disabled = false;
                        }
                        alert('Error loading audio file: ' + (error.message || 'Unknown error'));
                    }
                );
                
                console.log('p.loadSound called, sound object:', sound);
            } catch (error) {
                console.error('Exception calling p.loadSound:', error);
                const playBtn = document.getElementById('playBtn');
                if (playBtn) {
                    playBtn.textContent = '▶';
                    playBtn.style.display = 'inline-block';
                    playBtn.disabled = false;
                }
                alert('Error: ' + error.message);
            }
        };
        
        // Make function accessible globally
        loadAudioFileFunction = loadAudioFile;
        window.loadAudioFileFunction = loadAudioFile;
        
        p.draw = function() {
            // Light background
            p.background(250, 250, 250);
            
            if (sound && sound.isLoaded() && sound.isPlaying()) {
                // Get waveform data
                const waveform = fft.waveform();
                
                // Draw waveform - dark on light
                p.stroke(0);
                p.strokeWeight(1.5);
                p.noFill();
                
                p.beginShape();
                for (let i = 0; i < waveform.length; i++) {
                    const x = p.map(i, 0, waveform.length, 0, p.width);
                    const y = p.map(waveform[i], -1, 1, p.height / 2, 0);
                    p.vertex(x, y);
                }
                p.endShape();
                
                // Draw center line - subtle gray
                p.stroke(200);
                p.strokeWeight(1);
                p.line(0, p.height / 2, p.width, p.height / 2);
                
                // Draw playhead - red accent
                if (sound.duration() > 0) {
                    const progress = sound.currentTime() / sound.duration();
                    p.stroke(255, 0, 0);
                    p.strokeWeight(2);
                    p.line(progress * p.width, 0, progress * p.width, p.height);
                }
            } else {
                // Show placeholder - subtle gray text
                p.noStroke();
                p.fill(180);
                p.textAlign(p.CENTER, p.CENTER);
                p.textSize(12);
                p.text('Select a file to play', p.width / 2, p.height / 2);
            }
        };
        
        p.windowResized = function() {
            const container = document.getElementById('p5-container');
            p.resizeCanvas(container.clientWidth, container.clientHeight);
        };
    };
    
    // Create p5 instance
    window.p5Sketch = new p5(sketch);
    console.log('p5.js sketch created');
    
    // Wait a bit for setup to complete and function to be assigned
    setTimeout(() => {
        console.log('loadAudioFileFunction available:', typeof loadAudioFileFunction);
        console.log('window.loadAudioFileFunction available:', typeof window.loadAudioFileFunction);
    }, 500);
}
