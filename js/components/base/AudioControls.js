/**
 * AudioControls Component
 * 
 * Control bar with stop button, loop mode selector, visualization mode selector,
 * and progress bar. Play/Pause is handled separately by PatternExplorer.
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

        // Loop modes: 'off', 'loop', 'loop30s'
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
                        <div class="audio-controls__progress-audio-marker"></div>
                        <div class="audio-controls__progress-ticks"></div>
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
        this.modeSelector = this.container.querySelector('.audio-controls__mode-selector');
        this.progressBar = this.container.querySelector('.audio-controls__progress-bar');
        this.progressFill = this.container.querySelector('.audio-controls__progress-fill');
        this.progressAudioMarker = this.container.querySelector('.audio-controls__progress-audio-marker');
        this.progressTicks = this.container.querySelector('.audio-controls__progress-ticks');
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
        this.loopOffBtn.addEventListener('click', this.boundHandlers.loopOffClick);
        this.loopBtn.addEventListener('click', this.boundHandlers.loopClick);
        this.loop30sBtn.addEventListener('click', this.boundHandlers.loop30sClick);

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
        
        // Force reset progress display
        this.resetProgressDisplay();
        
        if (this.onStop) {
            this.onStop();
        }
    }

    /**
     * Reset progress bar display to beginning
     */
    resetProgressDisplay() {
        this.progressFill.style.width = '0%';
        this.progressAudioMarker.style.left = '0%';
        this.timeCurrent.textContent = '0:00';
        
        if (this.loopMode === 'loop30s') {
            this.timeTotal.textContent = '0:30';
        } else if (this.audioPlayer && this.audioPlayer.isLoaded()) {
            this.timeTotal.textContent = this.formatTime(this.audioPlayer.getDuration());
        } else {
            this.timeTotal.textContent = '0:00';
        }
    }

    /**
     * Handle loop mode change
     * @param {string} mode - 'off', 'loop', or 'loop30s'
     */
    handleLoopModeChange(mode) {
        this.loopMode = mode;
        
        // Update UI
        this.loopOffBtn.classList.toggle('active', mode === 'off');
        this.loopBtn.classList.toggle('active', mode === 'loop');
        this.loop30sBtn.classList.toggle('active', mode === 'loop30s');

        // Clear 30s mode elements immediately when switching away
        if (mode !== 'loop30s') {
            this.progressAudioMarker.style.display = 'none';
            this.progressTicks.innerHTML = '';
            this.progressTicks.dataset.tickKey = ''; // Clear cache so ticks re-render when switching back
        }

        // Apply to AudioPlayer
        this.applyLoopMode();

        // Update progress immediately
        this.updateProgress();

        // Call callback
        if (this.onLoopModeChange) {
            const duration = mode === 'loop30s' ? 30 : null;
            this.onLoopModeChange(mode, duration);
        }
    }

    /**
     * Apply current loop mode to AudioPlayer
     */
    applyLoopMode() {
        if (!this.audioPlayer) return;

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
            this.progressAudioMarker.style.display = 'none';
            this.progressTicks.innerHTML = '';
            this.timeCurrent.textContent = '0:00';
            this.timeTotal.textContent = '0:00';
            return;
        }

        const currentTime = this.audioPlayer.getCurrentTime();
        const duration = this.audioPlayer.getDuration();
        const isPlaying = this.audioPlayer.isPlaying();
        
        // If stopped (not playing and at beginning), keep progress at 0
        if (!isPlaying && currentTime < 0.1) {
            this.progressFill.style.width = '0%';
            this.progressAudioMarker.style.left = '0%';
            this.timeCurrent.textContent = '0:00';
            if (this.loopMode === 'loop30s') {
                this.timeTotal.textContent = '0:30';
                // Still show tick marks in 30s mode
                this.progressAudioMarker.style.display = 'block';
                this.updateTickMarks(duration, 30);
            } else {
                this.timeTotal.textContent = this.formatTime(duration);
                this.progressAudioMarker.style.display = 'none';
                this.progressTicks.innerHTML = '';
                this.progressTicks.dataset.tickKey = '';
            }
            return;
        }
        
        if (this.loopMode === 'loop30s') {
            // 30s mode: Show progress relative to 30 seconds
            const loopDuration = 30;
            const elapsed = this.audioPlayer.getElapsedTime();
            
            // Progress fill shows elapsed time out of 30s
            const percentage = Math.min((elapsed / loopDuration) * 100, 100);
            this.progressFill.style.width = `${percentage}%`;
            
            // Show audio file marker (current position within current loop)
            const audioPercentage = (currentTime / loopDuration) * 100;
            this.progressAudioMarker.style.display = 'block';
            this.progressAudioMarker.style.left = `${audioPercentage}%`;
            
            // Show tick marks for each audio file boundary
            this.updateTickMarks(duration, loopDuration);
            
            // Time display
            this.timeCurrent.textContent = this.formatTime(elapsed);
            this.timeTotal.textContent = '0:30';
        } else {
            // Normal mode: Show progress relative to audio duration
            const percentage = duration > 0 ? (currentTime / duration) * 100 : 0;
            this.progressFill.style.width = `${percentage}%`;
            
            // Hide 30s mode elements
            this.progressAudioMarker.style.display = 'none';
            this.progressTicks.innerHTML = '';
            this.progressTicks.dataset.tickKey = ''; // Clear cache
            
            // Time display
            this.timeCurrent.textContent = this.formatTime(currentTime);
            this.timeTotal.textContent = this.formatTime(duration);
        }
    }

    /**
     * Update tick marks showing audio file boundaries in 30s mode
     * @param {number} audioDuration - Duration of audio file
     * @param {number} loopDuration - Total loop duration (30s)
     */
    updateTickMarks(audioDuration, loopDuration) {
        if (audioDuration <= 0 || audioDuration >= loopDuration) {
            this.progressTicks.innerHTML = '';
            return;
        }

        // Calculate positions where audio file loops
        const tickPositions = [];
        let pos = audioDuration;
        while (pos < loopDuration) {
            tickPositions.push((pos / loopDuration) * 100);
            pos += audioDuration;
        }

        // Only update if tick positions changed
        const tickKey = tickPositions.join(',');
        if (this.progressTicks.dataset.tickKey === tickKey) {
            return;
        }
        this.progressTicks.dataset.tickKey = tickKey;

        // Render tick marks
        this.progressTicks.innerHTML = tickPositions.map(p => 
            `<div class="audio-controls__tick" style="left: ${p}%"></div>`
        ).join('');
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
     * @param {string} mode - 'off', 'loop', or 'loop30s'
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

        // Clear references
        this.audioPlayer = null;
        this.visualizer = null;
        this.stopBtn = null;
        this.loopOffBtn = null;
        this.loopBtn = null;
        this.loop30sBtn = null;
        this.modeSelector = null;
        this.progressBar = null;
        this.progressFill = null;
        this.timeCurrent = null;
        this.timeTotal = null;
        this.boundHandlers = {};
    }
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioControls;
}
