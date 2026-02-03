/**
 * AudioControls Component
 * 
 * Provides audio playback controls: stop, loop modes (OFF/LOOP/30s), 
 * visualization mode selector, and progress bar with seeking.
 * 
 * Requires AudioPlayer module and Visualizer component.
 */

class AudioControls {
    /**
     * Create an AudioControls instance
     * @param {Object} options - Configuration options
     * @param {string} options.containerId - ID of container element
     * @param {AudioPlayer} [options.audioPlayer] - AudioPlayer instance (can be set later)
     * @param {Visualizer} [options.visualizer] - Visualizer instance (can be set later)
     * @param {string} [options.defaultLoopMode='loop'] - Default loop mode: 'off', 'loop', 'loop30s'
     * @param {string} [options.defaultMode='waveform'] - Default visualization mode
     * @param {Array} [options.modes] - Available visualization modes
     * @param {Function} [options.onLoopModeChange] - Callback when loop mode changes: (mode, duration) => void
     * @param {Function} [options.onModeChange] - Callback when viz mode changes: (mode) => void
     * @param {Function} [options.onStop] - Callback when stop is clicked: () => void
     * @param {Function} [options.onSeek] - Callback when user seeks: (time) => void
     */
    constructor(options = {}) {
        if (!options.containerId) {
            throw new Error('AudioControls requires containerId option');
        }

        this.containerId = options.containerId;
        this.container = document.getElementById(this.containerId);
        
        if (!this.container) {
            throw new Error(`AudioControls: Container #${this.containerId} not found`);
        }

        // References to other components (can be set later)
        this.audioPlayer = options.audioPlayer || null;
        this.visualizer = options.visualizer || null;

        // Loop modes: 'off', 'loop', 'loop30s', 'test'
        this.loopMode = options.defaultLoopMode || 'loop';
        this.currentMode = options.defaultMode || 'waveform';

        // Visualization modes
        this.modes = options.modes || [
            { value: 'waveform', label: 'Waveform' },
            { value: 'intensity', label: 'Intensity Bars' },
            { value: 'stereo', label: 'Stereo Field' },
            { value: 'spectrum', label: 'Frequency Spectrum' },
            { value: 'pulses', label: 'Directional Pulses' },
            { value: 'blob', label: 'Liquid Blob' },
            { value: 'particles', label: 'Particle Swarm' },
            { value: 'landscape', label: 'Frequency Terrain' }
        ];

        // Callbacks
        this.onLoopModeChange = options.onLoopModeChange || null;
        this.onModeChange = options.onModeChange || null;
        this.onStop = options.onStop || null;
        this.onSeek = options.onSeek || null;

        // DOM element references
        this.stopBtn = null;
        this.loopOffBtn = null;
        this.loopBtn = null;
        this.loop30sBtn = null;
        this.testBtn = null;
        this.phaseIndicator = null;
        this.modeSelector = null;
        this.progressBar = null;
        this.progressFill = null;
        this.progressTime = null;

        // Animation frame for progress updates
        this.progressAnimationId = null;

        // Bound event handlers (for cleanup)
        this.boundHandlers = {};

        // Initialize
        this.render();
        this.setupEventListeners();
        this.applyLoopMode();
    }

    /**
     * Render the controls UI
     */
    render() {
        this.container.innerHTML = `
            <div class="audio-controls">
                <div class="audio-controls__row">
                    <button class="audio-controls__btn audio-controls__stop-btn" title="Stop">STOP</button>
                    <div class="audio-controls__loop-group">
                        <button class="audio-controls__btn audio-controls__loop-off-btn ${this.loopMode === 'off' ? 'active' : ''}" title="No Loop" data-mode="off">OFF</button>
                        <button class="audio-controls__btn audio-controls__loop-btn ${this.loopMode === 'loop' ? 'active' : ''}" title="Loop Infinitely" data-mode="loop">LOOP</button>
                        <button class="audio-controls__btn audio-controls__loop-30s-btn ${this.loopMode === 'loop30s' ? 'active' : ''}" title="Loop for 30 seconds" data-mode="loop30s">30s</button>
                        <button class="audio-controls__btn audio-controls__test-btn ${this.loopMode === 'test' ? 'active' : ''}" title="Manual Test: 30s baseline + 30s audio" data-mode="test">TEST</button>
                    </div>
                    <div class="audio-controls__phase-indicator" style="display: none;">
                        <span class="audio-controls__phase-label"></span>
                    </div>
                    <select class="audio-controls__mode-selector" title="Visualization Mode">
                        ${this.modes.map(mode => 
                            `<option value="${mode.value}" ${mode.value === this.currentMode ? 'selected' : ''}>${mode.label}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="audio-controls__progress">
                    <div class="audio-controls__progress-bar">
                        <div class="audio-controls__progress-fill"></div>
                        <div class="audio-controls__progress-ticks"></div>
                        <div class="audio-controls__progress-marker"></div>
                    </div>
                    <div class="audio-controls__progress-time">
                        <span class="audio-controls__time-current">0:00</span>
                        <span class="audio-controls__time-separator">/</span>
                        <span class="audio-controls__time-total">0:00</span>
                    </div>
                </div>
            </div>
        `;

        // Store references
        this.stopBtn = this.container.querySelector('.audio-controls__stop-btn');
        this.loopOffBtn = this.container.querySelector('.audio-controls__loop-off-btn');
        this.loopBtn = this.container.querySelector('.audio-controls__loop-btn');
        this.loop30sBtn = this.container.querySelector('.audio-controls__loop-30s-btn');
        this.testBtn = this.container.querySelector('.audio-controls__test-btn');
        this.phaseIndicator = this.container.querySelector('.audio-controls__phase-indicator');
        this.phaseLabel = this.container.querySelector('.audio-controls__phase-label');
        this.modeSelector = this.container.querySelector('.audio-controls__mode-selector');
        this.progressBar = this.container.querySelector('.audio-controls__progress-bar');
        this.progressFill = this.container.querySelector('.audio-controls__progress-fill');
        this.progressTicks = this.container.querySelector('.audio-controls__progress-ticks');
        this.progressMarker = this.container.querySelector('.audio-controls__progress-marker');
        this.timeCurrent = this.container.querySelector('.audio-controls__time-current');
        this.timeTotal = this.container.querySelector('.audio-controls__time-total');
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Stop button
        this.boundHandlers.stopClick = () => this.handleStop();
        this.stopBtn.addEventListener('click', this.boundHandlers.stopClick);

        // Loop mode buttons
        this.boundHandlers.loopOffClick = () => this.handleLoopModeChange('off');
        this.boundHandlers.loopClick = () => this.handleLoopModeChange('loop');
        this.boundHandlers.loop30sClick = () => this.handleLoopModeChange('loop30s');
        this.boundHandlers.testClick = () => this.handleLoopModeChange('test');
        this.loopOffBtn.addEventListener('click', this.boundHandlers.loopOffClick);
        this.loopBtn.addEventListener('click', this.boundHandlers.loopClick);
        this.loop30sBtn.addEventListener('click', this.boundHandlers.loop30sClick);
        this.testBtn.addEventListener('click', this.boundHandlers.testClick);

        // Mode selector
        this.boundHandlers.modeChange = (e) => this.handleModeChange(e.target.value);
        this.modeSelector.addEventListener('change', this.boundHandlers.modeChange);

        // Progress bar click to seek
        this.boundHandlers.progressClick = (e) => this.handleProgressClick(e);
        this.progressBar.addEventListener('click', this.boundHandlers.progressClick);

        // Start progress animation
        this.startProgressAnimation();
    }

    /**
     * Handle stop button click
     */
    handleStop() {
        if (this.audioPlayer) {
            this.audioPlayer.stop();
        }
        this.updateProgress();
        if (this.onStop) {
            this.onStop();
        }
    }

    /**
     * Handle loop mode change
     * @param {string} mode - 'off', 'loop', 'loop30s', or 'test'
     */
    handleLoopModeChange(mode) {
        this.loopMode = mode;
        
        // Update UI
        this.loopOffBtn.classList.toggle('active', mode === 'off');
        this.loopBtn.classList.toggle('active', mode === 'loop');
        this.loop30sBtn.classList.toggle('active', mode === 'loop30s');
        this.testBtn.classList.toggle('active', mode === 'test');
        
        // Show/hide phase indicator for test mode
        if (this.phaseIndicator) {
            this.phaseIndicator.style.display = mode === 'test' ? 'block' : 'none';
        }

        // Apply to AudioPlayer
        this.applyLoopMode();

        // Call callback
        if (this.onLoopModeChange) {
            const duration = mode === 'loop30s' ? 30 : (mode === 'test' ? 60 : null);
            this.onLoopModeChange(mode, duration);
        }
    }

    /**
     * Apply current loop mode to AudioPlayer
     */
    applyLoopMode() {
        if (!this.audioPlayer) return;

        // First disable test mode if switching away from it
        if (this.loopMode !== 'test' && this.audioPlayer.getTestMode()) {
            this.audioPlayer.setTestMode(false);
        }

        switch (this.loopMode) {
            case 'off':
                this.audioPlayer.setLoop(false);
                this.audioPlayer.setLoopDuration(null);
                break;
            case 'loop':
                this.audioPlayer.setLoop(true);
                this.audioPlayer.setLoopDuration(null);
                break;
            case 'loop30s':
                this.audioPlayer.setLoop(true);
                this.audioPlayer.setLoopDuration(30);
                break;
            case 'test':
                this.audioPlayer.setLoop(true);
                this.audioPlayer.setLoopDuration(null); // Test mode handles its own timing
                this.audioPlayer.setTestMode(true);
                break;
        }
    }

    /**
     * Handle visualization mode change
     * @param {string} mode - Visualization mode
     */
    handleModeChange(mode) {
        this.currentMode = mode;

        if (this.visualizer) {
            this.visualizer.setMode(mode);
        }

        if (this.onModeChange) {
            this.onModeChange(mode);
        }
    }

    /**
     * Handle progress bar click for seeking
     * @param {MouseEvent} e
     */
    handleProgressClick(e) {
        if (!this.audioPlayer || !this.audioPlayer.isLoaded()) return;

        const rect = this.progressBar.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = clickX / rect.width;
        const duration = this.audioPlayer.getDuration();
        const seekTime = percentage * duration;

        // Seek in audio (p5.SoundFile uses jump())
        const soundFile = this.audioPlayer.getSoundFile();
        if (soundFile) {
            soundFile.jump(seekTime);
        }

        if (this.onSeek) {
            this.onSeek(seekTime);
        }

        this.updateProgress();
    }

    /**
     * Start progress bar animation loop
     */
    startProgressAnimation() {
        const animate = () => {
            this.updateProgress();
            
            // Check loop duration if applicable
            if (this.audioPlayer && this.loopMode === 'loop30s') {
                this.audioPlayer.checkLoopDuration();
            }
            
            // Check test mode timing
            if (this.audioPlayer && this.loopMode === 'test') {
                this.audioPlayer.checkTestMode();
                this.updatePhaseIndicator();
            }
            
            this.progressAnimationId = requestAnimationFrame(animate);
        };
        animate();
    }

    /**
     * Update progress bar and time display
     */
    updateProgress() {
        if (!this.audioPlayer || !this.audioPlayer.isLoaded()) {
            this.progressFill.style.width = '0%';
            this.progressMarker.style.display = 'none';
            this.progressTicks.innerHTML = '';
            this.timeCurrent.textContent = '0:00';
            this.timeTotal.textContent = '0:00';
            return;
        }

        const currentTime = this.audioPlayer.getCurrentTime();
        const audioDuration = this.audioPlayer.getDuration();
        
        // Handle test mode (30s baseline + 30s stimulation = 60s total)
        if (this.loopMode === 'test') {
            const testDuration = 60;
            const elapsed = this.audioPlayer.getTestElapsedTime() || 0;
            const phase = this.audioPlayer.getTestPhase();
            
            // Progress fill shows elapsed time out of 60s
            const fillPercentage = Math.min((elapsed / testDuration) * 100, 100);
            this.progressFill.style.width = `${fillPercentage}%`;
            
            // Red marker at 30s boundary (phase transition)
            this.progressMarker.style.display = 'block';
            this.progressMarker.style.left = '50%'; // 30s mark = 50% of 60s
            
            // Clear loop tick marks (not applicable in test mode)
            this.progressTicks.innerHTML = '';
            
            // Time display shows elapsed / 60s
            this.timeCurrent.textContent = this.formatTime(elapsed);
            this.timeTotal.textContent = '1:00';
        }
        // Handle 30s loop mode differently
        else if (this.loopMode === 'loop30s') {
            const loopDuration = 30;
            const elapsed = this.audioPlayer.getElapsedTime() || 0;
            
            // Progress fill shows elapsed time out of 30s
            const fillPercentage = Math.min((elapsed / loopDuration) * 100, 100);
            this.progressFill.style.width = `${fillPercentage}%`;
            
            // Red marker tracks the same elapsed time (should match black bar)
            this.progressMarker.style.display = 'block';
            this.progressMarker.style.left = `${fillPercentage}%`;
            
            // Update tick marks for loop boundaries
            this.updateTickMarks(audioDuration, loopDuration);
            
            // Time display shows elapsed / 30s
            this.timeCurrent.textContent = this.formatTime(elapsed);
            this.timeTotal.textContent = '0:30';
        } else {
            // Normal mode - progress shows audio position
            const percentage = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;
            this.progressFill.style.width = `${percentage}%`;
            
            // Hide marker and ticks in normal mode
            this.progressMarker.style.display = 'none';
            this.progressTicks.innerHTML = '';
            
            // Normal time display
            this.timeCurrent.textContent = this.formatTime(currentTime);
            this.timeTotal.textContent = this.formatTime(audioDuration);
        }
    }

    /**
     * Update tick marks showing audio loop boundaries in 30s mode
     * @param {number} audioDuration - Duration of audio file in seconds
     * @param {number} loopDuration - Total loop duration (30s)
     */
    updateTickMarks(audioDuration, loopDuration) {
        if (!audioDuration || audioDuration <= 0) {
            this.progressTicks.innerHTML = '';
            return;
        }

        // Calculate how many complete loops fit in 30s
        // floor gives us complete plays, and we need (complete plays - 1) restart ticks
        const numCompleteLoops = Math.floor(loopDuration / audioDuration);
        
        // Only show tick marks if audio loops at least once
        if (numCompleteLoops < 1) {
            this.progressTicks.innerHTML = '';
            return;
        }

        // Create tick marks at each loop restart point
        let ticksHtml = '';
        for (let i = 1; i <= numCompleteLoops; i++) {
            const tickTime = i * audioDuration;
            if (tickTime < loopDuration) {
                const tickPercentage = (tickTime / loopDuration) * 100;
                ticksHtml += `<div class="audio-controls__tick" style="left: ${tickPercentage}%"></div>`;
            }
        }
        
        this.progressTicks.innerHTML = ticksHtml;
    }

    /**
     * Update phase indicator for test mode
     */
    updatePhaseIndicator() {
        if (!this.phaseIndicator || !this.phaseLabel || !this.audioPlayer) return;
        
        const phase = this.audioPlayer.getTestPhase();
        const elapsed = this.audioPlayer.getTestElapsedTime();
        
        if (phase === 'baseline') {
            const remaining = Math.ceil(30 - elapsed);
            this.phaseLabel.textContent = `BASELINE (${remaining}s)`;
            this.phaseIndicator.classList.remove('stimulating');
            this.phaseIndicator.classList.add('baseline');
        } else if (phase === 'stimulating') {
            const remaining = Math.ceil(60 - elapsed);
            this.phaseLabel.textContent = `STIMULATING (${remaining}s)`;
            this.phaseIndicator.classList.remove('baseline');
            this.phaseIndicator.classList.add('stimulating');
        } else {
            this.phaseLabel.textContent = '';
            this.phaseIndicator.classList.remove('baseline', 'stimulating');
        }
    }

    /**
     * Format time in seconds to M:SS format
     * @param {number} seconds
     * @returns {string}
     */
    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Set loop mode programmatically
     * @param {string} mode - 'off', 'loop', 'loop30s', or 'test'
     */
    setLoopMode(mode) {
        this.handleLoopModeChange(mode);
    }

    /**
     * Get current loop mode
     * @returns {string}
     */
    getLoopMode() {
        return this.loopMode;
    }

    /**
     * Set visualization mode programmatically
     * @param {string} mode - Visualization mode
     */
    setMode(mode) {
        this.currentMode = mode;
        this.modeSelector.value = mode;

        if (this.visualizer) {
            this.visualizer.setMode(mode);
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
     * Set AudioPlayer reference
     * @param {AudioPlayer} audioPlayer - AudioPlayer instance
     */
    setAudioPlayer(audioPlayer) {
        this.audioPlayer = audioPlayer;
        this.applyLoopMode();
    }

    /**
     * Set Visualizer reference
     * @param {Visualizer} visualizer - Visualizer instance
     */
    setVisualizer(visualizer) {
        this.visualizer = visualizer;
        
        if (this.visualizer) {
            this.visualizer.setMode(this.currentMode);
        }
    }

    /**
     * Enable/disable controls
     * @param {boolean} disabled - Whether controls should be disabled
     */
    setDisabled(disabled) {
        this.stopBtn.disabled = disabled;
        this.loopOffBtn.disabled = disabled;
        this.loopBtn.disabled = disabled;
        this.loop30sBtn.disabled = disabled;
        this.testBtn.disabled = disabled;
        this.modeSelector.disabled = disabled;
    }

    /**
     * Cleanup - remove event listeners and stop animation
     */
    destroy() {
        // Stop animation
        if (this.progressAnimationId) {
            cancelAnimationFrame(this.progressAnimationId);
        }

        // Remove event listeners
        if (this.stopBtn && this.boundHandlers.stopClick) {
            this.stopBtn.removeEventListener('click', this.boundHandlers.stopClick);
        }
        if (this.loopOffBtn && this.boundHandlers.loopOffClick) {
            this.loopOffBtn.removeEventListener('click', this.boundHandlers.loopOffClick);
        }
        if (this.loopBtn && this.boundHandlers.loopClick) {
            this.loopBtn.removeEventListener('click', this.boundHandlers.loopClick);
        }
        if (this.loop30sBtn && this.boundHandlers.loop30sClick) {
            this.loop30sBtn.removeEventListener('click', this.boundHandlers.loop30sClick);
        }
        if (this.testBtn && this.boundHandlers.testClick) {
            this.testBtn.removeEventListener('click', this.boundHandlers.testClick);
        }
        if (this.modeSelector && this.boundHandlers.modeChange) {
            this.modeSelector.removeEventListener('change', this.boundHandlers.modeChange);
        }
        if (this.progressBar && this.boundHandlers.progressClick) {
            this.progressBar.removeEventListener('click', this.boundHandlers.progressClick);
        }

        // Clear container
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}
