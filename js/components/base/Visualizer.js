/**
 * Visualizer Component
 * 
 * Wraps p5.js sketch with visualization mode selection.
 * Provides all 8 visualization modes from index.html.
 * 
 * Requires AudioPlayer module to get p5.SoundFile instance.
 */

class Visualizer {
    /**
     * Create a Visualizer instance
     * @param {Object} options - Configuration options
     * @param {string} options.containerId - ID of container div for p5.js sketch
     * @param {AudioPlayer} [options.audioPlayer] - AudioPlayer instance (can be set later)
     * @param {string} [options.defaultMode='waveform'] - Default visualization mode
     * @param {Function} [options.onModeChange] - Callback when mode changes: (mode) => void
     * @param {Function} [options.onReady] - Callback when p5.js sketch is ready: (loadSoundFn) => void
     */
    constructor(options = {}) {
        if (!options.containerId) {
            throw new Error('Visualizer requires containerId option');
        }

        this.containerId = options.containerId;
        this.currentMode = options.defaultMode || 'waveform';
        this.onModeChange = options.onModeChange || null;
        this.onReady = options.onReady || null;
        
        // Set audio player if provided (this will also setup callbacks)
        if (options.audioPlayer) {
            this.audioPlayer = options.audioPlayer;
            // Setup stereo analyzers callback
            this.setupAudioPlayerCallbacks();
        } else {
            this.audioPlayer = null;
        }

        // p5.js instance
        this.p5Instance = null;
        this.fft = null;
        this.p5Context = null; // Store p5 instance for FFT
        this.loadSoundFn = null; // Store loadSound function from p5 instance

        // State for visualizations
        this.activePulses = [];
        this.particles = [];
        this.blobVertices = [];

        // Stereo analysis state
        this.isStereo = false;
        this.soundBuffer = null;

        // Pause state - stores last FFT data to show frozen visualization
        this.isPaused = false;
        this.lastWaveform = null;
        this.lastSpectrum = null;
        this.lastSoundTime = 0;
        this.lastSoundDuration = 0;

        // Initialize p5.js sketch
        this.initSketch();
    }

    /**
     * Initialize p5.js sketch
     */
    initSketch() {
        const self = this; // Store reference to Visualizer instance
        
        // Check if p5 is available
        if (typeof p5 === 'undefined') {
            console.error('p5.js is not loaded!');
            return;
        }
        
        const sketch = (p) => {
            p.setup = () => {
                const container = document.getElementById(self.containerId);
                if (!container) {
                    console.error(`Container ${self.containerId} not found`);
                    return;
                }

                const canvas = p.createCanvas(container.clientWidth, container.clientHeight);
                canvas.parent(self.containerId);

                // Store p5 instance reference
                self.p5Context = p;

                // Initialize FFT analyzer (needs p5 instance)
                self.fft = new p5.FFT();

                // Create loadSound function from this p5 instance
                self.loadSoundFn = function(path, onSuccess, onError) {
                    return p.loadSound(path, onSuccess, onError);
                };

                // Store p5 instance for audio context access
                self.p5InstanceForAudio = p;

                // Initialize stereo analysis state
                self.isStereo = false;
                self.soundBuffer = null;

                // Notify that Visualizer is ready (loadSoundFn is available)
                if (self.onReady) {
                    self.onReady(self.loadSoundFn);
                }
            };

            p.draw = () => {
                // Light background
                p.background(250, 250, 250);

                // Check if FFT is initialized
                if (!self.fft) {
                    // Show placeholder while FFT initializes
                    p.noStroke();
                    p.fill(180);
                    p.textAlign(p.CENTER, p.CENTER);
                    p.textSize(12);
                    p.text('Initializing...', p.width / 2, p.height / 2);
                    return;
                }

                const soundFile = self.getSoundFile();
                
                // Check both soundFile and AudioPlayer state
                const audioPlayerIsPlaying = self.audioPlayer ? self.audioPlayer.isPlaying() : false;
                const soundFileIsLoaded = soundFile && soundFile.isLoaded();
                const soundFileIsPlaying = soundFile && soundFile.isPlaying();
                
                // Detect pause state changes
                const wasPlaying = self._wasPlaying || false;
                const isNowPlaying = soundFileIsPlaying || audioPlayerIsPlaying;
                
                // Track if we just paused (was playing, now not playing, but file is still loaded)
                if (wasPlaying && !isNowPlaying && soundFileIsLoaded) {
                    self.isPaused = true;
                    // Store current FFT data for frozen display
                    if (self.fft) {
                        self.lastWaveform = self.fft.waveform().slice();
                        self.lastSpectrum = self.fft.analyze().slice();
                    }
                    if (soundFile) {
                        self.lastSoundTime = soundFile.currentTime();
                        self.lastSoundDuration = soundFile.duration();
                    }
                }
                
                // Clear pause state when we start playing again
                if (isNowPlaying) {
                    self.isPaused = false;
                }
                
                self._wasPlaying = isNowPlaying;
                
                // Debug: Log state once when audio starts playing
                if (soundFileIsPlaying && !self._loggedPlayingState) {
                    self._loggedPlayingState = true;
                    console.log('Visualizer - Audio started playing, FFT connected:', !!self.fft);
                } else if (!soundFileIsPlaying && self._loggedPlayingState) {
                    self._loggedPlayingState = false;
                }
                
                // Show visualization if:
                // 1. Sound is loaded and playing, OR
                // 2. Sound is paused (show frozen visualization)
                let shouldShowVisualization = soundFileIsLoaded && (soundFileIsPlaying || audioPlayerIsPlaying || self.isPaused);
                
                // Fallback: If audio is loaded but not playing, check if FFT has meaningful data
                // This helps cases where audio might be playing but isPlaying() returns false
                if (!shouldShowVisualization && soundFileIsLoaded && self.fft && !self.isPaused) {
                    try {
                        const waveform = self.fft.waveform();
                        const maxWaveform = Math.max(...waveform.map(Math.abs));
                        // If FFT has meaningful data (above noise threshold), show visualization anyway
                        if (maxWaveform > 0.01) {
                            shouldShowVisualization = true;
                        }
                    } catch (e) {
                        // Ignore errors in fallback check
                    }
                }
                
                if (shouldShowVisualization) {
                    try {
                        // Route to appropriate visualization
                        switch (self.currentMode) {
                            case 'intensity':
                                self.drawIntensityBars(p);
                                break;
                            case 'stereo':
                                self.drawStereoField(p);
                                break;
                            case 'spectrum':
                                self.drawFrequencySpectrum(p);
                                break;
                            case 'pulses':
                                self.drawDirectionalPulses(p);
                                break;
                            case 'blob':
                                self.drawLiquidBlob(p);
                                break;
                            case 'particles':
                                self.drawParticleSwarm(p);
                                break;
                            case 'landscape':
                                self.draw3DLandscape(p);
                                break;
                            case 'waveform':
                            default:
                                self.drawWaveform(p);
                                break;
                        }

                        // Draw playhead - red accent (for all modes)
                        // Use cached values when paused
                        let playheadTime, playheadDuration;
                        if (self.isPaused) {
                            playheadTime = self.lastSoundTime;
                            playheadDuration = self.lastSoundDuration;
                        } else if (soundFile) {
                            playheadTime = soundFile.currentTime();
                            playheadDuration = soundFile.duration();
                        }
                        
                        if (playheadDuration > 0) {
                            const progress = playheadTime / playheadDuration;
                            p.stroke(255, 0, 0);
                            p.strokeWeight(2);
                            p.line(progress * p.width, 0, progress * p.width, p.height);
                        }
                    } catch (error) {
                        console.error('Error drawing visualization:', error);
                        console.error('Error stack:', error.stack);
                        // Show error message
                        p.noStroke();
                        p.fill(255, 0, 0);
                        p.textAlign(p.CENTER, p.CENTER);
                        p.textSize(12);
                        p.text('Error: ' + error.message, p.width / 2, p.height / 2);
                    }
                } else {
                    // Show placeholder - subtle gray text
                    p.noStroke();
                    p.fill(180);
                    p.textAlign(p.CENTER, p.CENTER);
                    p.textSize(12);
                    let statusText = 'Select a file to play';
                    if (soundFileIsLoaded && !soundFileIsPlaying && !audioPlayerIsPlaying) {
                        statusText = 'Click play to start visualization';
                    } else if (soundFile && !soundFileIsLoaded) {
                        statusText = 'Loading audio...';
                    } else if (soundFileIsLoaded && (soundFileIsPlaying || audioPlayerIsPlaying)) {
                        // This shouldn't happen, but just in case
                        statusText = 'Ready to visualize...';
                    }
                    p.text(statusText, p.width / 2, p.height / 2);
                }
            };

            p.windowResized = () => {
                const container = document.getElementById(self.containerId);
                if (container) {
                    p.resizeCanvas(container.clientWidth, container.clientHeight);
                }
            };
        };

        // Create p5 instance
        // Force synchronous layout calculation first
        const container = document.getElementById(this.containerId);
        if (container) {
            void container.offsetHeight;
        }
        
        this.p5Instance = new p5(sketch);
        
        // p5.js instance mode sometimes fails to call setup() automatically
        // Poll and manually trigger if needed (500ms total wait)
        let setupCheckAttempts = 0;
        const maxAttempts = 10; // 500ms total (10 x 50ms)
        
        const checkSetupCalled = () => {
            setupCheckAttempts++;
            
            if (this.p5Context) {
                return; // Setup was called successfully
            }
            
            if (setupCheckAttempts >= maxAttempts) {
                // Try manually calling setup if p5 instance exists
                if (this.p5Instance && this.p5Instance.setup) {
                    try {
                        this.p5Instance.setup();
                    } catch (e) {
                        console.error('Visualizer manual setup failed:', e);
                    }
                }
                return;
            }
            
            setTimeout(checkSetupCalled, 50);
        };
        
        setTimeout(checkSetupCalled, 50);
    }

    /**
     * Get loadSound function from Visualizer's p5 instance
     * This ensures audio loads in the same p5 instance as FFT
     * @returns {Function|null} - loadSound function: (path, onSuccess, onError) => p5.SoundFile
     */
    getLoadSoundFn() {
        return this.loadSoundFn;
    }

    /**
     * Get p5.SoundFile instance from AudioPlayer
     * @returns {p5.SoundFile|null}
     */
    getSoundFile() {
        if (!this.audioPlayer) {
            return null;
        }
        return this.audioPlayer.getSoundFile();
    }

    /**
     * Setup stereo analyzers for a sound file
     * @param {p5.SoundFile} soundFile
     */
    setupStereoAnalyzers(soundFile) {
        try {
            if (!soundFile || !soundFile.buffer) {
                this.soundBuffer = null;
                this.isStereo = false;
                return;
            }

            // IMPORTANT: Connect FFT to the sound file
            // This tells the FFT analyzer to analyze this specific sound source
            if (this.fft && soundFile) {
                this.fft.setInput(soundFile);
                console.log('Visualizer - FFT input set to soundFile');
            }

            const numChannels = soundFile.buffer.numberOfChannels;
            if (numChannels >= 2) {
                this.soundBuffer = soundFile.buffer;
                this.isStereo = true;
                console.log('Stereo file detected');
            } else {
                this.soundBuffer = null;
                this.isStereo = false;
                console.log('Mono file detected');
            }
        } catch (error) {
            console.warn('Could not set up stereo analyzers:', error);
            this.soundBuffer = null;
            this.isStereo = false;
        }
    }

    /**
     * Set visualization mode
     * @param {string} mode - Mode name: 'waveform', 'intensity', 'stereo', etc.
     */
    setMode(mode) {
        const validModes = ['waveform', 'intensity', 'stereo', 'spectrum', 'pulses', 'blob', 'particles', 'landscape'];
        if (!validModes.includes(mode)) {
            console.warn(`Invalid mode: ${mode}, defaulting to 'waveform'`);
            mode = 'waveform';
        }
        this.currentMode = mode;
        if (this.onModeChange) {
            this.onModeChange(mode);
        }
    }

    /**
     * Get current visualization mode
     * @returns {string}
     */
    getMode() {
        return this.currentMode;
    }

    /**
     * Setup callbacks for AudioPlayer
     */
    setupAudioPlayerCallbacks() {
        if (!this.audioPlayer) return;
        
        // Setup stereo analyzers when audio loads
        const originalOnLoad = this.audioPlayer.onLoad;
        this.audioPlayer.onLoad = (soundFile) => {
            // Ensure audio context is started (required for FFT)
            this.ensureAudioContextStarted();
            
            // Setup stereo analyzers and connect FFT
            this.setupStereoAnalyzers(soundFile);
            
            if (originalOnLoad) {
                originalOnLoad(soundFile);
            }
        };
    }

    /**
     * Set AudioPlayer instance
     * @param {AudioPlayer} audioPlayer
     */
    setAudioPlayer(audioPlayer) {
        this.audioPlayer = audioPlayer;
        this.setupAudioPlayerCallbacks();
    }

    /**
     * Clear pause state (call when stopping or unloading audio)
     */
    clearPauseState() {
        this.isPaused = false;
        this.lastWaveform = null;
        this.lastSpectrum = null;
        this.lastSoundTime = 0;
        this.lastSoundDuration = 0;
        this._wasPlaying = false;
    }

    /**
     * Ensure p5 audio context is started (call this on user interaction like play button click)
     * This is required for FFT analysis in some browsers
     * @returns {Promise<boolean>} - Resolves to true if context is running
     */
    ensureAudioContextStarted() {
        if (!this.p5InstanceForAudio) {
            return Promise.resolve(false);
        }
        
        return new Promise((resolve) => {
            try {
                const audioContext = this.p5InstanceForAudio.getAudioContext();
                if (!audioContext) {
                    resolve(false);
                    return;
                }
                
                if (audioContext.state === 'running') {
                    resolve(true);
                    return;
                }
                
                // Try userStartAudio (requires user gesture)
                this.p5InstanceForAudio.userStartAudio().then(() => {
                    console.log('Audio context started');
                    resolve(true);
                }).catch(() => {
                    // Try resuming directly as fallback
                    if (audioContext.state === 'suspended') {
                        audioContext.resume().then(() => {
                            console.log('Audio context resumed');
                            resolve(true);
                        }).catch(() => resolve(false));
                    } else {
                        resolve(false);
                    }
                });
            } catch (e) {
                resolve(false);
            }
        });
    }

    /**
     * Get waveform data - returns cached data if paused
     * @returns {Float32Array|Array}
     */
    getWaveformData() {
        if (this.isPaused && this.lastWaveform) {
            return this.lastWaveform;
        }
        return this.fft ? this.fft.waveform() : [];
    }

    /**
     * Get spectrum data - returns cached data if paused
     * @returns {Uint8Array|Array}
     */
    getSpectrumData() {
        if (this.isPaused && this.lastSpectrum) {
            return this.lastSpectrum;
        }
        return this.fft ? this.fft.analyze() : [];
    }

    /**
     * Draw waveform visualization
     */
    drawWaveform(p) {
        if (!this.fft && !this.isPaused) return;
        
        const waveform = this.getWaveformData();

        p.stroke(0);
        p.strokeWeight(1.5);
        p.noFill();

        p.beginShape();
        for (let i = 0; i < waveform.length; i++) {
            const x = p.map(i, 0, waveform.length, 0, p.width);
            // Map waveform from -1 to 1, to canvas height
            // Center is at p.height/2, positive values go up, negative go down
            const y = p.map(waveform[i], -1, 1, p.height, 0);
            p.vertex(x, y);
        }
        p.endShape();

        // Draw center line - subtle gray
        p.stroke(200);
        p.strokeWeight(1);
        p.line(0, p.height / 2, p.width, p.height / 2);
    }

    /**
     * Draw intensity bars visualization
     */
    drawIntensityBars(p) {
        if (!this.fft && !this.isPaused) return;
        const waveform = this.getWaveformData();
        const numBars = 100;
        const barWidth = p.width / numBars;
        const samplesPerBar = Math.floor(waveform.length / numBars);

        for (let i = 0; i < numBars; i++) {
            let sum = 0;
            let max = 0;

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
                const t = avgIntensity / 0.33;
                r = Math.floor(255 * t);
                g = 255;
                b = 0;
            } else if (avgIntensity < 0.66) {
                const t = (avgIntensity - 0.33) / 0.33;
                r = 255;
                g = Math.floor(255 * (1 - t * 0.5));
                b = 0;
            } else {
                const t = (avgIntensity - 0.66) / 0.34;
                r = 255;
                g = Math.floor(255 * (0.5 - t * 0.5));
                b = 0;
            }

            p.fill(r, g, b);
            p.noStroke();

            const x = i * barWidth;
            const y = p.height / 2 - barHeight / 2;
            p.rect(x + 1, y, barWidth - 2, barHeight);
        }

        // Draw center line
        p.stroke(200);
        p.strokeWeight(1);
        p.line(0, p.height / 2, p.width, p.height / 2);
    }

    /**
     * Draw stereo field visualization
     */
    drawStereoField(p) {
        const numBars = 80;
        const barWidth = p.width / numBars;
        const soundFile = this.getSoundFile();

        if (this.isStereo && soundFile && soundFile.buffer && soundFile.buffer.numberOfChannels >= 2 && soundFile.isPlaying()) {
            try {
                this.drawStereoFromBuffer(p, numBars, barWidth);
            } catch (e) {
                console.warn('Error drawing stereo from buffer:', e);
                this.drawStereoFallback(p, numBars, barWidth);
            }
        } else {
            this.drawStereoFallback(p, numBars, barWidth);
        }

        // Draw center lines
        p.stroke(200);
        p.strokeWeight(1);
        p.line(0, p.height / 2, p.width, p.height / 2);
        p.stroke(150);
        p.line(p.width / 2, 0, p.width / 2, p.height);

        // Draw legend
        this.drawStereoLegend(p);
    }

    /**
     * Draw stereo from buffer channel data
     */
    drawStereoFromBuffer(p, numBars, barWidth) {
        const soundFile = this.getSoundFile();
        if (!soundFile || !soundFile.buffer || soundFile.buffer.numberOfChannels < 2) {
            this.drawStereoFallback(p, numBars, barWidth);
            return;
        }

        const currentTime = soundFile.currentTime();
        const sampleRate = soundFile.buffer.sampleRate;
        const bufferLength = soundFile.buffer.length;
        const duration = soundFile.buffer.duration;

        if (currentTime < 0 || currentTime >= duration) return;

        const sampleIndex = Math.floor(currentTime * sampleRate);
        const lookaheadSamples = 1024;
        const samplesPerBar = Math.max(1, Math.floor(lookaheadSamples / numBars));

        const leftChannel = soundFile.buffer.getChannelData(0);
        const rightChannel = soundFile.buffer.getChannelData(1);

        for (let i = 0; i < numBars; i++) {
            let leftSum = 0;
            let rightSum = 0;
            let count = 0;

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

            const leftIntensity = leftAvg * p.height * 0.45;
            const rightIntensity = rightAvg * p.height * 0.45;

            const x = i * barWidth;
            const centerY = p.height / 2;

            if (leftIntensity > 0.5) {
                p.fill(50, 100, 200, 240);
                p.noStroke();
                p.rect(x + 1, centerY - leftIntensity, barWidth - 2, leftIntensity);
            }

            if (rightIntensity > 0.5) {
                p.fill(200, 100, 50, 240);
                p.noStroke();
                p.rect(x + 1, centerY, barWidth - 2, rightIntensity);
            }

            const total = leftIntensity + rightIntensity;
            if (total > 1) {
                const balance = (rightIntensity - leftIntensity) / total;
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

    /**
     * Draw stereo fallback (mono visualization)
     */
    drawStereoFallback(p, numBars, barWidth) {
        if (!this.fft && !this.isPaused) return;
        const waveform = this.getWaveformData();
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

            if (intensity > 0.5) {
                p.fill(100, 100, 100, 200);
                p.noStroke();
                p.rect(x + 1, centerY - intensity / 2, barWidth - 2, intensity);
            }
        }
    }

    /**
     * Draw stereo legend
     */
    drawStereoLegend(p) {
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

    /**
     * Draw frequency spectrum visualization
     */
    drawFrequencySpectrum(p) {
        if (!this.fft && !this.isPaused) return;
        const spectrum = this.getSpectrumData();
        const waveform = this.getWaveformData();

        let totalIntensity = 0;
        for (let i = 0; i < waveform.length; i++) {
            totalIntensity += Math.abs(waveform[i]);
        }
        const avgIntensity = totalIntensity / waveform.length;

        const barWidth = p.width / spectrum.length;
        const maxBarHeight = p.height * 0.8;

        for (let i = 0; i < spectrum.length; i++) {
            const barHeight = p.map(spectrum[i], 0, 255, 0, maxBarHeight);
            const x = i * barWidth;
            const y = p.height - barHeight;

            const freqRatio = i / spectrum.length;
            let r, g, b;

            if (freqRatio < 0.33) {
                const t = freqRatio / 0.33;
                r = Math.floor(30 * t);
                g = Math.floor(100 + 155 * t);
                b = 255;
            } else if (freqRatio < 0.66) {
                const t = (freqRatio - 0.33) / 0.33;
                r = Math.floor(30 + 225 * t);
                g = 255;
                b = Math.floor(255 * (1 - t * 0.8));
            } else {
                const t = (freqRatio - 0.66) / 0.34;
                r = 255;
                g = Math.floor(255 * (1 - t));
                b = Math.floor(50 * (1 - t));
            }

            const intensityFactor = spectrum[i] / 255;
            const brightnessBoost = 0.8 + intensityFactor * 0.2;
            r = Math.min(255, Math.floor(r * brightnessBoost));
            g = Math.min(255, Math.floor(g * brightnessBoost));
            b = Math.min(255, Math.floor(b * brightnessBoost));

            const alpha = 200 + intensityFactor * 55;
            p.fill(r, g, b, alpha);
            p.stroke(r * 0.7, g * 0.7, b * 0.7, alpha * 0.8);
            p.strokeWeight(0.5);
            p.rect(x, y, barWidth - 1, barHeight);
        }

        // Draw intensity overlay
        const intensityBarHeight = 8;
        const intensityBarWidth = avgIntensity * p.width;

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

    /**
     * Draw directional pulses visualization
     * Note: This is a simplified version. Full implementation would require
     * more complex pulse tracking logic from app.js lines 1626-1877
     */
    drawDirectionalPulses(p) {
        // Get stereo channel intensities
        let leftIntensity = 0;
        let rightIntensity = 0;
        let leftSharpness = 0;
        let rightSharpness = 0;

        const soundFile = this.getSoundFile();
        if (this.isStereo && soundFile && soundFile.buffer && soundFile.buffer.numberOfChannels >= 2 && soundFile.isPlaying()) {
            try {
                const currentTime = soundFile.currentTime();
                const sampleRate = soundFile.buffer.sampleRate;
                const bufferLength = soundFile.buffer.length;
                const sampleIndex = Math.floor(currentTime * sampleRate);

                const leftChannel = soundFile.buffer.getChannelData(0);
                const rightChannel = soundFile.buffer.getChannelData(1);

                const sampleWindow = 512;
                let leftSum = 0, rightSum = 0, leftMaxChange = 0, rightMaxChange = 0;
                let prevLeft = 0, prevRight = 0;
                let count = 0;

                for (let i = 0; i < sampleWindow; i++) {
                    const idx = sampleIndex - sampleWindow + i;
                    if (idx >= 0 && idx < bufferLength) {
                        const leftVal = Math.abs(leftChannel[idx]);
                        const rightVal = Math.abs(rightChannel[idx]);
                        leftSum += leftVal;
                        rightSum += rightVal;

                        if (i > 0) {
                            leftMaxChange = Math.max(leftMaxChange, Math.abs(leftVal - prevLeft));
                            rightMaxChange = Math.max(rightMaxChange, Math.abs(rightVal - prevRight));
                        }
                        prevLeft = leftVal;
                        prevRight = rightVal;
                        count++;
                    }
                }

                leftIntensity = count > 0 ? leftSum / count : 0;
                rightIntensity = count > 0 ? rightSum / count : 0;
                leftSharpness = leftMaxChange;
                rightSharpness = rightMaxChange;
            } catch (e) {
                console.warn('Error getting stereo data for pulses:', e);
            }
        } else {
            if (!this.fft && !this.isPaused) return;
            const waveform = this.getWaveformData();
            let sum = 0, maxChange = 0, prev = 0;
            for (let i = 0; i < waveform.length; i++) {
                const val = Math.abs(waveform[i]);
                sum += val;
                maxChange = Math.max(maxChange, Math.abs(val - prev));
                prev = val;
            }
            const avg = sum / waveform.length;
            leftIntensity = avg;
            rightIntensity = avg;
            leftSharpness = maxChange;
            rightSharpness = maxChange;
        }

        const pulseThreshold = 0.03;
        const currentFrame = p.frameCount;
        const minVisibleIntensity = 0.15;
        const scaledLeftIntensity = Math.max(leftIntensity, minVisibleIntensity * 0.3);
        const scaledRightIntensity = Math.max(rightIntensity, minVisibleIntensity * 0.3);

        // Create pulses
        const timeSinceLastLeft = this.activePulses.filter(p => p.side === 'left').length > 0
            ? currentFrame - Math.max(...this.activePulses.filter(p => p.side === 'left').map(p => p.frame))
            : 999;
        const timeSinceLastRight = this.activePulses.filter(p => p.side === 'right').length > 0
            ? currentFrame - Math.max(...this.activePulses.filter(p => p.side === 'right').map(p => p.frame))
            : 999;

        if (leftIntensity > pulseThreshold || (leftIntensity > 0 && timeSinceLastLeft > 60)) {
            const recentLeftPulses = this.activePulses.filter(pulse =>
                pulse.side === 'left' && currentFrame - pulse.frame < 40
            );
            if (recentLeftPulses.length < 5) {
                this.activePulses.push({
                    side: 'left',
                    intensity: Math.max(scaledLeftIntensity, minVisibleIntensity),
                    sharpness: leftSharpness,
                    radius: 0,
                    frame: currentFrame,
                    maxRadius: Math.min(p.width, p.height) * 0.95
                });
            }
        }

        if (rightIntensity > pulseThreshold || (rightIntensity > 0 && timeSinceLastRight > 60)) {
            const recentRightPulses = this.activePulses.filter(pulse =>
                pulse.side === 'right' && currentFrame - pulse.frame < 40
            );
            if (recentRightPulses.length < 5) {
                this.activePulses.push({
                    side: 'right',
                    intensity: Math.max(scaledRightIntensity, minVisibleIntensity),
                    sharpness: rightSharpness,
                    radius: 0,
                    frame: currentFrame,
                    maxRadius: Math.min(p.width, p.height) * 0.95
                });
            }
        }

        // Update and draw pulses
        p.noFill();
        const centerY = p.height / 2;

        for (let i = this.activePulses.length - 1; i >= 0; i--) {
            const pulse = this.activePulses[i];
            const age = currentFrame - pulse.frame;
            const speed = 6 + pulse.intensity * 12;
            pulse.radius += speed;

            const progress = pulse.radius / pulse.maxRadius;
            const baseOpacity = 255 * (1 - progress * 0.8) * Math.max(pulse.intensity, 0.3);

            if (pulse.radius > pulse.maxRadius || baseOpacity < 15) {
                this.activePulses.splice(i, 1);
                continue;
            }

            const intensityNorm = Math.min(pulse.intensity * 1.5, 1);
            let r, g, b;

            if (intensityNorm < 0.33) {
                const t = intensityNorm / 0.33;
                r = Math.floor(50 + 100 * t);
                g = 255;
                b = Math.floor(50 * (1 - t));
            } else if (intensityNorm < 0.66) {
                const t = (intensityNorm - 0.33) / 0.33;
                r = Math.floor(150 + 105 * t);
                g = 255;
                b = Math.floor(50 * (1 - t));
            } else {
                const t = (intensityNorm - 0.66) / 0.34;
                r = 255;
                g = Math.floor(255 * (1 - t));
                b = 0;
            }

            const sharpnessNorm = Math.min(pulse.sharpness * 10, 1);
            const opacity = Math.max(baseOpacity * (0.8 + 0.2 * sharpnessNorm), 80);

            const pulseX = pulse.side === 'left' ? 0 : p.width;
            p.stroke(r, g, b, opacity);
            p.strokeWeight(3 + pulse.intensity * 5);
            p.circle(pulseX, centerY, pulse.radius * 2);

            if (pulse.radius > 20) {
                p.stroke(r, g, b, opacity * 0.6);
                p.strokeWeight(2 + pulse.intensity * 3);
                p.circle(pulseX, centerY, pulse.radius * 1.5);
            }

            if (sharpnessNorm > 0.2) {
                const innerRadius = pulse.radius * 0.5;
                const sharpOpacity = opacity * sharpnessNorm * 0.8;
                p.stroke(r, g, b, sharpOpacity);
                p.strokeWeight(2 + sharpnessNorm * 3);
                p.circle(pulseX, centerY, innerRadius * 2);

                if (sharpnessNorm > 0.5) {
                    p.stroke(r, g, b, sharpOpacity);
                    p.strokeWeight(2);
                    const sparkLength = pulse.radius * 0.4;
                    const numSparks = 12;
                    for (let s = 0; s < numSparks; s++) {
                        const angle = (s / numSparks) * p.TWO_PI;
                        const startX = pulseX + Math.cos(angle) * innerRadius;
                        const startY = centerY + Math.sin(angle) * innerRadius;
                        const endX = pulseX + Math.cos(angle) * (innerRadius + sparkLength);
                        const endY = centerY + Math.sin(angle) * (innerRadius + sparkLength);
                        p.line(startX, startY, endX, endY);
                    }
                }
            }

            if (pulse.intensity > 0.4) {
                p.stroke(r, g, b, opacity * 0.3);
                p.strokeWeight(1);
                p.circle(pulseX, centerY, pulse.radius * 2.2);
            }
        }

        if (this.activePulses.length === 0 && soundFile && soundFile.isPlaying()) {
            const fallbackIntensity = Math.max(leftIntensity, rightIntensity, 0.2);
            if (fallbackIntensity > 0) {
                const side = leftIntensity > rightIntensity ? 'left' : 'right';
                this.activePulses.push({
                    side: side,
                    intensity: fallbackIntensity,
                    sharpness: Math.max(leftSharpness, rightSharpness),
                    radius: 0,
                    frame: currentFrame,
                    maxRadius: Math.min(p.width, p.height) * 0.9
                });
            }
        }

        p.stroke(200);
        p.strokeWeight(1);
        p.line(0, centerY, p.width, centerY);
    }

    /**
     * Draw liquid blob visualization
     * Note: This is a simplified version. Full implementation would require
     * more complex blob morphing logic from app.js lines 1879-2135
     */
    drawLiquidBlob(p) {
        if (!this.fft && !this.isPaused) return;
        const spectrum = this.getSpectrumData();
        const waveform = this.getWaveformData();

        let totalIntensity = 0;
        for (let i = 0; i < waveform.length; i++) {
            totalIntensity += Math.abs(waveform[i]);
        }
        const avgIntensity = totalIntensity / waveform.length;

        let leftIntensity = avgIntensity;
        let rightIntensity = avgIntensity;
        let leftSharpness = 0;
        let rightSharpness = 0;

        const soundFile = this.getSoundFile();
        if (this.isStereo && soundFile && soundFile.buffer && soundFile.buffer.numberOfChannels >= 2) {
            try {
                const currentTime = soundFile.currentTime();
                const sampleRate = soundFile.buffer.sampleRate;
                const sampleIndex = Math.floor(currentTime * sampleRate);
                const leftChannel = soundFile.buffer.getChannelData(0);
                const rightChannel = soundFile.buffer.getChannelData(1);

                let leftSum = 0, rightSum = 0, leftMaxChange = 0, rightMaxChange = 0;
                let prevLeft = 0, prevRight = 0;
                const windowSize = 256;

                for (let i = 0; i < windowSize; i++) {
                    const idx = sampleIndex - windowSize + i;
                    if (idx >= 0 && idx < leftChannel.length) {
                        const l = Math.abs(leftChannel[idx]);
                        const r = Math.abs(rightChannel[idx]);
                        leftSum += l;
                        rightSum += r;

                        if (i > 0) {
                            leftMaxChange = Math.max(leftMaxChange, Math.abs(l - prevLeft));
                            rightMaxChange = Math.max(rightMaxChange, Math.abs(r - prevRight));
                        }
                        prevLeft = l;
                        prevRight = r;
                    }
                }

                leftIntensity = leftSum / windowSize;
                rightIntensity = rightSum / windowSize;
                leftSharpness = leftMaxChange;
                rightSharpness = rightMaxChange;
            } catch (e) {}
        }

        const baseRadius = 100 + avgIntensity * 300;
        const centerX = p.width / 2;
        const centerY = p.height / 2;
        const numPoints = 80;

        if (this.blobVertices.length !== numPoints) {
            this.blobVertices = [];
            for (let i = 0; i < numPoints; i++) {
                this.blobVertices.push({ angle: 0, radius: baseRadius });
            }
        }

        const time = p.frameCount * 0.02;
        const maxSharpness = Math.max(leftSharpness, rightSharpness);

        for (let i = 0; i < numPoints; i++) {
            const angle = (i / numPoints) * p.TWO_PI;

            const noiseX1 = Math.cos(angle) * 1.5 + time * 0.5;
            const noiseY1 = Math.sin(angle) * 1.5 + time * 0.5;
            const noiseX2 = Math.cos(angle) * 3.0 + time * 0.3;
            const noiseY2 = Math.sin(angle) * 3.0 + time * 0.3;
            const noiseX3 = Math.cos(angle) * 0.8 + time * 0.7;
            const noiseY3 = Math.sin(angle) * 0.8 + time * 0.7;

            const noise1 = p.noise(noiseX1, noiseY1);
            const noise2 = p.noise(noiseX2, noiseY2) * 0.6;
            const noise3 = p.noise(noiseX3, noiseY3) * 0.4;
            const combinedNoise = (noise1 + noise2 + noise3) / 2;

            let radius = baseRadius + combinedNoise * 50;

            const freqBand = Math.floor((i / numPoints) * spectrum.length);
            const freqIntensity = spectrum[freqBand] / 255;
            radius += freqIntensity * 100;

            const sharpness = (leftSharpness + rightSharpness) / 2;
            if (sharpness > 0.05) {
                const spikeAngle = Math.atan2(Math.sin(angle), Math.cos(angle));
                const leftSpike = Math.abs(spikeAngle) < p.PI / 2 ? leftSharpness : 0;
                const rightSpike = Math.abs(spikeAngle) > p.PI / 2 ? rightSharpness : 0;
                const spikeShape = Math.sin(angle * 2) * 0.5 + 0.5;
                const spikeIntensity = (leftSpike + rightSpike) * 150 * spikeShape;
                radius += spikeIntensity;

                if (maxSharpness > 0.2) {
                    radius += maxSharpness * 100 * spikeShape;
                }
            }

            const lrWave = Math.sin(angle);
            if (lrWave > 0) {
                radius += (leftIntensity - rightIntensity) * 80 * lrWave;
            } else {
                radius += (rightIntensity - leftIntensity) * 80 * Math.abs(lrWave);
            }

            const pulse = Math.sin(p.frameCount * 0.08 + angle * 2) * avgIntensity * 25;
            radius += pulse;

            const secondaryWave = Math.sin(p.frameCount * 0.12 + angle * 3) * avgIntensity * 15;
            radius += secondaryWave;

            this.blobVertices[i].angle = angle;
            this.blobVertices[i].radius = radius;
        }

        const dominantFreq = spectrum.indexOf(Math.max(...spectrum));
        const freqRatio = dominantFreq / spectrum.length;

        let r, g, b;
        if (freqRatio < 0.2) {
            r = 30;
            g = 100 + avgIntensity * 100;
            b = 200 + avgIntensity * 55;
        } else if (freqRatio < 0.4) {
            r = 30 + avgIntensity * 50;
            g = 200 + avgIntensity * 55;
            b = 255;
        } else if (freqRatio < 0.6) {
            r = 50 + avgIntensity * 100;
            g = 255;
            b = 100 + avgIntensity * 50;
        } else if (freqRatio < 0.8) {
            r = 200 + avgIntensity * 55;
            g = 255;
            b = 50;
        } else {
            r = 255;
            g = 150 + avgIntensity * 50;
            b = 30;
        }

        const brightnessBoost = 0.7 + avgIntensity * 0.3;
        r = Math.min(255, Math.floor(r * brightnessBoost));
        g = Math.min(255, Math.floor(g * brightnessBoost));
        b = Math.min(255, Math.floor(b * brightnessBoost));

        p.fill(r, g, b, 180);
        p.stroke(r * 0.7, g * 0.7, b * 0.7, 200);
        p.strokeWeight(2.5);

        p.beginShape();
        for (let i = 0; i < this.blobVertices.length; i++) {
            const vCurr = this.blobVertices[i];
            const nextIdx = (i + 1) % this.blobVertices.length;
            const prevIdx = (i - 1 + this.blobVertices.length) % this.blobVertices.length;
            const vNext = this.blobVertices[nextIdx];
            const vPrev = this.blobVertices[prevIdx];

            const x = centerX + Math.cos(vCurr.angle) * vCurr.radius;
            const y = centerY + Math.sin(vCurr.angle) * vCurr.radius;

            if (i === 0) {
                p.vertex(x, y);
            } else {
                const prevX = centerX + Math.cos(vPrev.angle) * vPrev.radius;
                const prevY = centerY + Math.sin(vPrev.angle) * vPrev.radius;
                const nextX = centerX + Math.cos(vNext.angle) * vNext.radius;
                const nextY = centerY + Math.sin(vNext.angle) * vNext.radius;

                const cp1x = x + (nextX - x) * 0.3;
                const cp1y = y + (nextY - y) * 0.3;

                p.bezierVertex(cp1x, cp1y, cp1x, cp1y, x, y);
            }
        }
        p.endShape(p.CLOSE);

        if (avgIntensity > 0.2) {
            p.fill(r + 30, g + 30, b + 30, 100);
            p.noStroke();
            p.beginShape();
            for (let i = 0; i < this.blobVertices.length; i++) {
                const v = this.blobVertices[i];
                const x = centerX + Math.cos(v.angle) * v.radius * 0.7;
                const y = centerY + Math.sin(v.angle) * v.radius * 0.7;
                p.curveVertex(x, y);
            }
            p.endShape(p.CLOSE);
        }

        if (avgIntensity > 0.15) {
            p.noFill();
            const numRipples = Math.floor(avgIntensity * 3) + 1;
            for (let ripple = 0; ripple < numRipples; ripple++) {
                const rippleProgress = (ripple + 1) / (numRipples + 1);
                const rippleRadius = baseRadius * 0.5 * rippleProgress;
                const rippleAlpha = 150 * (1 - rippleProgress) * avgIntensity;
                p.stroke(r, g, b, rippleAlpha);
                p.strokeWeight(2);
                p.circle(centerX, centerY, rippleRadius * 2);
            }
        }

        if (avgIntensity > 0.3) {
            p.noFill();
            p.stroke(r, g, b, 80);
            p.strokeWeight(1);
            const glowRadius = baseRadius * 1.2;
            p.circle(centerX, centerY, glowRadius * 2);
        }
    }

    /**
     * Draw particle swarm visualization
     * Note: This is a simplified version. Full implementation would require
     * more complex particle physics from app.js lines 2137-2350
     */
    drawParticleSwarm(p) {
        if (!this.fft && !this.isPaused) return;
        const spectrum = this.getSpectrumData();
        const waveform = this.getWaveformData();

        let totalIntensity = 0;
        for (let i = 0; i < waveform.length; i++) {
            totalIntensity += Math.abs(waveform[i]);
        }
        const avgIntensity = totalIntensity / waveform.length;

        let leftIntensity = avgIntensity;
        let rightIntensity = avgIntensity;
        let leftSharpness = 0;
        let rightSharpness = 0;

        const soundFile = this.getSoundFile();
        if (this.isStereo && soundFile && soundFile.buffer && soundFile.buffer.numberOfChannels >= 2) {
            try {
                const currentTime = soundFile.currentTime();
                const sampleRate = soundFile.buffer.sampleRate;
                const sampleIndex = Math.floor(currentTime * sampleRate);
                const leftChannel = soundFile.buffer.getChannelData(0);
                const rightChannel = soundFile.buffer.getChannelData(1);

                let leftSum = 0, rightSum = 0, leftMaxChange = 0, rightMaxChange = 0;
                let prevLeft = 0, prevRight = 0;
                const windowSize = 256;

                for (let i = 0; i < windowSize; i++) {
                    const idx = sampleIndex - windowSize + i;
                    if (idx >= 0 && idx < leftChannel.length) {
                        const l = Math.abs(leftChannel[idx]);
                        const r = Math.abs(rightChannel[idx]);
                        leftSum += l;
                        rightSum += r;

                        if (i > 0) {
                            leftMaxChange = Math.max(leftMaxChange, Math.abs(l - prevLeft));
                            rightMaxChange = Math.max(rightMaxChange, Math.abs(r - prevRight));
                        }
                        prevLeft = l;
                        prevRight = r;
                    }
                }

                leftIntensity = leftSum / windowSize;
                rightIntensity = rightSum / windowSize;
                leftSharpness = leftMaxChange;
                rightSharpness = rightMaxChange;
            } catch (e) {}
        }

        const targetParticleCount = 100 + Math.floor(avgIntensity * 400);

        while (this.particles.length < targetParticleCount) {
            const sideProb = leftIntensity / (leftIntensity + rightIntensity + 0.001);
            const side = p.random() < sideProb ? 'left' : 'right';

            let spawnX;
            if (side === 'left') {
                spawnX = p.random(0, p.width * 0.4);
            } else {
                spawnX = p.random(p.width * 0.6, p.width);
            }

            this.particles.push({
                x: spawnX,
                y: p.random(p.height),
                vx: p.random(-2, 2),
                vy: p.random(-2, 2),
                size: p.random(3, 8),
                freqBand: Math.floor(p.random(spectrum.length)),
                side: side
            });
        }

        while (this.particles.length > targetParticleCount) {
            this.particles.pop();
        }

        const centerX = p.width / 2;
        const centerY = p.height / 2;
        const leftTargetX = p.width * 0.25;
        const rightTargetX = p.width * 0.75;

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            const freqIntensity = spectrum[particle.freqBand] / 255;

            let targetX;
            let channelIntensity;

            if (particle.side === 'left') {
                targetX = leftTargetX;
                channelIntensity = leftIntensity;
                const dx = targetX - particle.x;
                const attraction = 0.05 + leftIntensity * 0.1;
                particle.vx += dx * attraction;

                if (particle.x > centerX) {
                    particle.vx -= (rightIntensity * 0.15);
                }
            } else {
                targetX = rightTargetX;
                channelIntensity = rightIntensity;
                const dx = targetX - particle.x;
                const attraction = 0.05 + rightIntensity * 0.1;
                particle.vx += dx * attraction;

                if (particle.x < centerX) {
                    particle.vx += (leftIntensity * 0.15);
                }
            }

            const dy = centerY - particle.y;
            particle.vy += dy * 0.01;

            const sharpness = particle.side === 'left' ? leftSharpness : rightSharpness;
            if (sharpness > 0.1) {
                const angle = p.random(p.TWO_PI);
                const burstForce = sharpness * 5;
                particle.vx += Math.cos(angle) * burstForce;
                particle.vy += Math.sin(angle) * burstForce;
            }

            const distFromTarget = Math.abs(targetX - particle.x) + Math.abs(centerY - particle.y);
            if (distFromTarget < 5 && Math.abs(particle.vx) < 0.1 && Math.abs(particle.vy) < 0.1) {
                particle.vx += p.random(-0.5, 0.5);
                particle.vy += p.random(-0.5, 0.5);
            }

            const intensityBoost = channelIntensity * 2;
            particle.vx *= (1 + intensityBoost * 0.01);
            particle.vy *= (1 + intensityBoost * 0.01);

            if (Math.abs(particle.vx) < 0.05 && Math.abs(particle.vy) < 0.05) {
                particle.vx += p.random(-0.2, 0.2);
                particle.vy += p.random(-0.2, 0.2);
            }

            particle.x += particle.vx;
            particle.y += particle.vy;

            if (particle.x < 0) {
                particle.x = 0;
                particle.vx *= -0.5;
            }
            if (particle.x > p.width) {
                particle.x = p.width;
                particle.vx *= -0.5;
            }
            if (particle.y < 0) {
                particle.y = 0;
                particle.vy *= -0.5;
            }
            if (particle.y > p.height) {
                particle.y = p.height;
                particle.vy *= -0.5;
            }

            particle.vx *= 0.96;
            particle.vy *= 0.96;

            const hue = p.map(particle.freqBand, 0, spectrum.length, 180, 360);
            const brightness = 60 + freqIntensity * 195 + channelIntensity * 100;
            const alpha = 180 + freqIntensity * 75;

            p.fill(hue, 100, brightness, alpha);
            p.noStroke();
            const particleSize = particle.size * (1 + freqIntensity * 0.5 + channelIntensity * 0.3);
            p.circle(particle.x, particle.y, particleSize);

            if (channelIntensity > 0.3) {
                p.fill(hue, 100, brightness, alpha * 0.3);
                p.circle(particle.x, particle.y, particleSize * 2);
            }
        }

        p.stroke(200, 50);
        p.strokeWeight(1);
        p.line(centerX, 0, centerX, p.height);
    }

    /**
     * Draw 3D landscape visualization
     */
    draw3DLandscape(p) {
        if (!this.fft && !this.isPaused) return;
        const spectrum = this.getSpectrumData();
        const waveform = this.getWaveformData();

        let totalIntensity = 0;
        for (let i = 0; i < waveform.length; i++) {
            totalIntensity += Math.abs(waveform[i]);
        }
        const avgIntensity = totalIntensity / waveform.length;

        let leftIntensity = avgIntensity;
        let rightIntensity = avgIntensity;

        const soundFile = this.getSoundFile();
        if (this.isStereo && soundFile && soundFile.buffer && soundFile.buffer.numberOfChannels >= 2) {
            try {
                const currentTime = soundFile.currentTime();
                const sampleRate = soundFile.buffer.sampleRate;
                const sampleIndex = Math.floor(currentTime * sampleRate);
                const leftChannel = soundFile.buffer.getChannelData(0);
                const rightChannel = soundFile.buffer.getChannelData(1);

                let leftSum = 0, rightSum = 0;
                const windowSize = 256;

                for (let i = 0; i < windowSize; i++) {
                    const idx = sampleIndex - windowSize + i;
                    if (idx >= 0 && idx < leftChannel.length) {
                        leftSum += Math.abs(leftChannel[idx]);
                        rightSum += Math.abs(rightChannel[idx]);
                    }
                }

                leftIntensity = leftSum / windowSize;
                rightIntensity = rightSum / windowSize;
            } catch (e) {}
        }

        const cols = spectrum.length;
        const baseY = p.height * 0.8;
        const maxHeight = p.height * 0.6;

        p.beginShape();
        p.fill(100, 150, 200, 200);
        p.stroke(80, 120, 180, 255);
        p.strokeWeight(2);

        p.vertex(0, p.height);

        for (let i = 0; i < cols; i++) {
            const freqValue = spectrum[i] / 255;
            let height = freqValue * maxHeight;
            height += avgIntensity * maxHeight * 0.5;

            const xRatio = i / cols;
            if (xRatio < 0.5) {
                height += (leftIntensity - rightIntensity) * maxHeight * 0.3;
            } else {
                height += (rightIntensity - leftIntensity) * maxHeight * 0.3;
            }

            height += p.noise(i * 0.1, p.frameCount * 0.01) * maxHeight * 0.2;

            const x = p.map(i, 0, cols, 0, p.width);
            const y = baseY - height;

            const hue = p.map(i, 0, cols, 200, 300);
            const brightness = 50 + freqValue * 200;

            p.fill(hue, 100, brightness, 220);
            p.noStroke();
            const barWidth = p.width / cols;
            p.rect(x, y, barWidth, p.height - y);

            p.vertex(x, y);
        }

        p.vertex(p.width, p.height);
        p.endShape(p.CLOSE);

        p.stroke(150, 200, 255, 200);
        p.strokeWeight(2);
        p.noFill();
        p.beginShape();
        for (let i = 0; i < cols; i++) {
            const freqValue = spectrum[i] / 255;
            let height = freqValue * maxHeight;
            height += avgIntensity * maxHeight * 0.5;

            const xRatio = i / cols;
            if (xRatio < 0.5) {
                height += (leftIntensity - rightIntensity) * maxHeight * 0.3;
            } else {
                height += (rightIntensity - leftIntensity) * maxHeight * 0.3;
            }
            height += p.noise(i * 0.1, p.frameCount * 0.01) * maxHeight * 0.2;

            const x = p.map(i, 0, cols, 0, p.width);
            const y = baseY - height;
            p.vertex(x, y);
        }
        p.endShape();
    }

    /**
     * Cleanup - remove p5.js sketch and clear references
     */
    destroy() {
        if (this.p5Instance) {
            this.p5Instance.remove();
            this.p5Instance = null;
        }

        this.fft = null;
        this.audioPlayer = null;
        this.activePulses = [];
        this.particles = [];
        this.blobVertices = [];
        this.isStereo = false;
        this.soundBuffer = null;
    }
}
