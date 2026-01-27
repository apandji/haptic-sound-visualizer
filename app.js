// Simple Haptic Sound Visualizer
let sound = null;
let fft = null;
let isPlaying = false;
let isLooping = true;
let currentFilePath = null;
let filesList = [];
let visualizationMode = 'waveform'; // 'waveform', 'intensity', 'stereo', 'spectrum'

// Load files when page loads
window.addEventListener('DOMContentLoaded', () => {
    loadFileList();
    setupControls();
    setupVizModeSelector();
    setupP5Sketch();
});

// Load file list from server or static JSON file
async function loadFileList() {
    try {
        // Try API endpoint first (for local development)
        let response = await fetch('/api/list-audio-files');
        if (!response.ok) {
            // Fallback to static JSON file (for GitHub Pages)
            response = await fetch('audio-files.json');
            if (!response.ok) {
                throw new Error('Failed to load audio files list');
            }
        }
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

// Setup visualization mode selector
function setupVizModeSelector() {
    const vizModeSelect = document.getElementById('vizMode');
    if (vizModeSelect) {
        vizModeSelect.addEventListener('change', (e) => {
            visualizationMode = e.target.value;
        });
    }
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
            
            // Create separate analyzers for left and right channels
            // These will be set up when audio loads
            window.leftFFT = null;
            window.rightFFT = null;
            
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
                                
                                // Setup stereo analyzers if sound is stereo
                                setupStereoAnalyzers(sound);
                                
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
                // Route to appropriate visualization
                switch(visualizationMode) {
                    case 'intensity':
                        drawIntensityBars(p);
                        break;
                    case 'stereo':
                        drawStereoField(p);
                        break;
                    case 'spectrum':
                        drawFrequencySpectrum(p);
                        break;
                    case 'waveform':
                    default:
                        drawWaveform(p);
                        break;
                }
                
                // Draw playhead - red accent (for all modes)
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
        
        // Original waveform visualization
        function drawWaveform(p) {
            const waveform = fft.waveform();
            
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
        }
        
        // Apple-style intensity bars
        function drawIntensityBars(p) {
            const waveform = fft.waveform();
            const numBars = 100; // Number of bars to display
            const barWidth = p.width / numBars;
            
            // Calculate intensity for each bar
            const samplesPerBar = Math.floor(waveform.length / numBars);
            
            for (let i = 0; i < numBars; i++) {
                let sum = 0;
                let max = 0;
                
                // Calculate average and peak intensity for this bar
                for (let j = 0; j < samplesPerBar; j++) {
                    const idx = i * samplesPerBar + j;
                    if (idx < waveform.length) {
                        const val = Math.abs(waveform[idx]);
                        sum += val;
                        max = Math.max(max, val);
                    }
                }
                
                const avgIntensity = sum / samplesPerBar;
                const barHeight = avgIntensity * p.height * 0.8;
                
                // Color based on intensity (green -> yellow -> red)
                let r, g, b;
                if (avgIntensity < 0.33) {
                    // Green to yellow
                    const t = avgIntensity / 0.33;
                    r = Math.floor(255 * t);
                    g = 255;
                    b = 0;
                } else if (avgIntensity < 0.66) {
                    // Yellow to orange
                    const t = (avgIntensity - 0.33) / 0.33;
                    r = 255;
                    g = Math.floor(255 * (1 - t * 0.5));
                    b = 0;
                } else {
                    // Orange to red
                    const t = (avgIntensity - 0.66) / 0.34;
                    r = 255;
                    g = Math.floor(255 * (0.5 - t * 0.5));
                    b = 0;
                }
                
                p.fill(r, g, b);
                p.noStroke();
                
                const x = i * barWidth;
                const y = p.height / 2 - barHeight / 2;
                
                // Draw bar with rounded corners effect
                p.rect(x + 1, y, barWidth - 2, barHeight);
            }
            
            // Draw center line
            p.stroke(200);
            p.strokeWeight(1);
            p.line(0, p.height / 2, p.width, p.height / 2);
        }
        
        // Setup separate analyzers for left and right channels
        function setupStereoAnalyzers(soundFile) {
            try {
                if (!soundFile || !soundFile.buffer) {
                    window.soundBuffer = null;
                    window.isStereo = false;
                    return;
                }
                
                // Check if stereo
                const numChannels = soundFile.buffer.numberOfChannels;
                if (numChannels >= 2) {
                    window.soundBuffer = soundFile.buffer;
                    window.isStereo = true;
                    console.log('Stereo file detected, will use channel separation');
                } else {
                    window.soundBuffer = null;
                    window.isStereo = false;
                    console.log('Mono file detected');
                }
            } catch (error) {
                console.warn('Could not set up stereo analyzers:', error);
                window.soundBuffer = null;
                window.isStereo = false;
            }
        }
        
        // Abstract L/R positionality visualization
        function drawStereoField(p) {
            const numBars = 80;
            const barWidth = p.width / numBars;
            
            // Use buffer channel data for accurate stereo separation
            if (window.isStereo && sound && sound.buffer && sound.buffer.numberOfChannels >= 2 && sound.isPlaying()) {
                try {
                    drawStereoFromBuffer(p, numBars, barWidth);
                } catch (e) {
                    console.warn('Error drawing stereo from buffer:', e);
                    drawStereoFallback(p, numBars, barWidth);
                }
            } else {
                // Fallback: use mixed waveform (mono or analyzers not available)
                drawStereoFallback(p, numBars, barWidth);
            }
            
            // Draw center line (reference for stereo balance)
            p.stroke(200);
            p.strokeWeight(1);
            p.line(0, p.height / 2, p.width, p.height / 2);
            
            // Draw vertical center line to show stereo field center
            p.stroke(150);
            p.strokeWeight(1);
            p.line(p.width / 2, 0, p.width / 2, p.height);
            
            // Draw minimal legend
            drawStereoLegend(p);
        }
        
        // Minimal legend for stereo field
        function drawStereoLegend(p) {
            const legendX = 12;
            const legendY = p.height - 40;
            const boxSize = 8;
            const spacing = 20;
            
            p.textSize(10);
            p.textAlign(p.LEFT, p.CENTER);
            p.noStroke();
            
            // Left (blue)
            p.fill(50, 100, 200);
            p.rect(legendX, legendY - boxSize / 2, boxSize, boxSize);
            p.fill(100);
            p.text('L', legendX + boxSize + 4, legendY);
            
            // Right (orange)
            p.fill(200, 100, 50);
            p.rect(legendX + spacing + 20, legendY - boxSize / 2, boxSize, boxSize);
            p.fill(100);
            p.text('R', legendX + spacing + 20 + boxSize + 4, legendY);
        }
        
        // Extract stereo from buffer channel data (real-time)
        function drawStereoFromBuffer(p, numBars, barWidth) {
            if (!sound || !sound.buffer || sound.buffer.numberOfChannels < 2) {
                drawStereoFallback(p, numBars, barWidth);
                return;
            }
            
            // Get current playback position
            const currentTime = sound.currentTime();
            const sampleRate = sound.buffer.sampleRate;
            const bufferLength = sound.buffer.length;
            const duration = sound.buffer.duration;
            
            if (currentTime < 0 || currentTime >= duration) return;
            
            // Calculate sample index for current playback position
            const sampleIndex = Math.floor(currentTime * sampleRate);
            const lookaheadSamples = 1024; // Number of samples to analyze ahead
            const samplesPerBar = Math.max(1, Math.floor(lookaheadSamples / numBars));
            
            // Get channel data directly from buffer
            const leftChannel = sound.buffer.getChannelData(0);
            const rightChannel = sound.buffer.getChannelData(1);
            
            for (let i = 0; i < numBars; i++) {
                let leftSum = 0;
                let rightSum = 0;
                let count = 0;
                
                // Sample from current position forward
                for (let j = 0; j < samplesPerBar; j++) {
                    const idx = sampleIndex + (i * samplesPerBar) + j;
                    if (idx >= 0 && idx < bufferLength) {
                        leftSum += Math.abs(leftChannel[idx]);
                        rightSum += Math.abs(rightChannel[idx]);
                        count++;
                    }
                }
                
                const leftAvg = count > 0 ? leftSum / count : 0;
                const rightAvg = count > 0 ? rightSum / count : 0;
                
                // Scale intensities
                const leftIntensity = leftAvg * p.height * 0.45;
                const rightIntensity = rightAvg * p.height * 0.45;
                
                const x = i * barWidth;
                const centerY = p.height / 2;
                
                // Draw left channel (top half, blue tint)
                if (leftIntensity > 0.5) {
                    p.fill(50, 100, 200, 240);
                    p.noStroke();
                    p.rect(x + 1, centerY - leftIntensity, barWidth - 2, leftIntensity);
                }
                
                // Draw right channel (bottom half, orange/red tint)
                if (rightIntensity > 0.5) {
                    p.fill(200, 100, 50, 240);
                    p.noStroke();
                    p.rect(x + 1, centerY, barWidth - 2, rightIntensity);
                }
                
                // Visualize stereo balance with indicator
                const total = leftIntensity + rightIntensity;
                if (total > 1) {
                    const balance = (rightIntensity - leftIntensity) / total; // -1 (left) to +1 (right)
                    
                    // Draw panning indicator dot
                    if (Math.abs(balance) > 0.1) {
                        const panX = x + barWidth / 2;
                        const panY = centerY + balance * Math.min(leftIntensity, rightIntensity) * 0.4;
                        p.fill(0, 180);
                        p.noStroke();
                        p.circle(panX, panY, 4);
                    }
                }
            }
        }
        
        // Fallback visualization using waveform (for mono or when buffer not available)
        function drawStereoFallback(p, numBars, barWidth) {
            const waveform = fft.waveform();
            const samplesPerBar = Math.floor(waveform.length / numBars);
            
            for (let i = 0; i < numBars; i++) {
                let sum = 0;
                let count = 0;
                
                for (let j = 0; j < samplesPerBar; j++) {
                    const idx = i * samplesPerBar + j;
                    if (idx < waveform.length) {
                        sum += Math.abs(waveform[idx]);
                        count++;
                    }
                }
                
                const avg = count > 0 ? sum / count : 0;
                const intensity = avg * p.height * 0.4;
                
                const x = i * barWidth;
                const centerY = p.height / 2;
                
                // Draw as mono (same on both sides)
                if (intensity > 0.5) {
                    p.fill(100, 100, 100, 200);
                    p.noStroke();
                    p.rect(x + 1, centerY - intensity / 2, barWidth - 2, intensity);
                }
            }
        }
        
        // Frequency spectrum with haptic mapping
        function drawFrequencySpectrum(p) {
            const spectrum = fft.analyze();
            const waveform = fft.waveform();
            
            // Calculate overall intensity for haptic mapping
            let totalIntensity = 0;
            for (let i = 0; i < waveform.length; i++) {
                totalIntensity += Math.abs(waveform[i]);
            }
            const avgIntensity = totalIntensity / waveform.length;
            
            const barWidth = p.width / spectrum.length;
            const maxBarHeight = p.height * 0.8;
            
            // Draw frequency bars
            for (let i = 0; i < spectrum.length; i++) {
                const barHeight = p.map(spectrum[i], 0, 255, 0, maxBarHeight);
                const x = i * barWidth;
                const y = p.height - barHeight;
                
                // Color mapping: low freq (blue) -> mid (green) -> high (red)
                const freqRatio = i / spectrum.length;
                let r, g, b;
                
                if (freqRatio < 0.33) {
                    // Low frequencies - blue
                    const t = freqRatio / 0.33;
                    r = Math.floor(50 * t);
                    g = Math.floor(100 * t);
                    b = 255;
                } else if (freqRatio < 0.66) {
                    // Mid frequencies - green to yellow
                    const t = (freqRatio - 0.33) / 0.33;
                    r = Math.floor(50 + 205 * t);
                    g = 255;
                    b = Math.floor(255 * (1 - t));
                } else {
                    // High frequencies - yellow to red
                    const t = (freqRatio - 0.66) / 0.34;
                    r = 255;
                    g = Math.floor(255 * (1 - t));
                    b = 0;
                }
                
                // Intensity affects opacity/brightness
                const intensityFactor = spectrum[i] / 255;
                const alpha = 150 + intensityFactor * 105;
                
                p.fill(r, g, b, alpha);
                p.noStroke();
                p.rect(x, y, barWidth - 1, barHeight);
            }
            
            // Draw intensity overlay (haptic mapping visualization)
            // Show overall intensity as a horizontal bar at the top
            const intensityBarHeight = 8;
            const intensityBarWidth = avgIntensity * p.width;
            
            // Color based on intensity
            let intensityR, intensityG, intensityB;
            if (avgIntensity < 0.33) {
                intensityR = 0;
                intensityG = Math.floor(255 * (avgIntensity / 0.33));
                intensityB = 0;
            } else if (avgIntensity < 0.66) {
                const t = (avgIntensity - 0.33) / 0.33;
                intensityR = Math.floor(255 * t);
                intensityG = 255;
                intensityB = 0;
            } else {
                intensityR = 255;
                intensityG = Math.floor(255 * (1 - (avgIntensity - 0.66) / 0.34));
                intensityB = 0;
            }
            
            p.fill(intensityR, intensityG, intensityB);
            p.noStroke();
            p.rect(0, 0, intensityBarWidth, intensityBarHeight);
            
            // Draw center reference line
            p.stroke(200);
            p.strokeWeight(1);
            p.line(0, p.height / 2, p.width, p.height / 2);
        }
        
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
