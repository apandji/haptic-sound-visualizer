/**
 * AudioPlayer Module
 * 
 * Non-UI module for managing audio playback using p5.SoundFile.
 * Handles loading, playback state, loop control, and provides event callbacks.
 * 
 * Note: Requires a loadSound function (typically provided by Visualizer component
 * which has access to p5.js instance).
 */

class AudioPlayer {
    /**
     * Create an AudioPlayer instance
     * @param {Object} options - Configuration options
     * @param {Function} options.loadSoundFn - Function to load sound: (path, onSuccess, onError) => p5.SoundFile
     * @param {Function} [options.onLoad] - Callback when audio loads: (soundFile) => void
     * @param {Function} [options.onPlay] - Callback when playback starts: () => void
     * @param {Function} [options.onPause] - Callback when playback pauses: () => void
     * @param {Function} [options.onStop] - Callback when playback stops: () => void
     * @param {Function} [options.onEnd] - Callback when playback ends: () => void
     * @param {boolean} [options.defaultLoop=true] - Default loop state
     */
    constructor(options = {}) {
        if (!options.loadSoundFn) {
            throw new Error('AudioPlayer requires loadSoundFn option');
        }

        this.loadSoundFn = options.loadSoundFn;
        this.onLoad = options.onLoad || null;
        this.onPlay = options.onPlay || null;
        this.onPause = options.onPause || null;
        this.onStop = options.onStop || null;
        this.onEnd = options.onEnd || null;

        // State
        this.soundFile = null;
        this.isLooping = options.defaultLoop !== undefined ? options.defaultLoop : true;
        this.currentFilePath = null;
        
        // Loop duration feature (null = disabled, number = seconds to loop)
        this.loopDuration = null; // e.g., 30 for 30-second loop
        this.playStartTime = null; // Timestamp when playback started (for loop duration)
        this.pauseStartTime = null; // Timestamp when paused (for tracking pause duration)
        this.totalPauseDuration = 0; // Total milliseconds paused (accumulated)
        
        // Test mode: 30s baseline (silence) + 30s stimulation (audio)
        this.testMode = false;
        this.testStartTime = null; // When test mode started
        this.testPhase = null; // 'baseline' or 'stimulating'

        // Setup end callback on sound file
        this.setupEndCallback();
    }

    /**
     * Setup callback for when audio ends (if not looping)
     */
    setupEndCallback() {
        // This will be called when we have a soundFile instance
        // We'll set it up in loadFile after sound loads
    }

    /**
     * Load an audio file
     * @param {string} filePath - Path to audio file
     * @returns {Promise<void>}
     */
    loadFile(filePath) {
        return new Promise((resolve, reject) => {
            // Stop current sound if playing
            if (this.soundFile) {
                try {
                    this.soundFile.stop();
                } catch (e) {
                    console.log('Error stopping previous sound:', e);
                }
                this.soundFile = null;
            }

            this.currentFilePath = filePath;

            // Use the provided loadSound function (from Visualizer/p5)
            try {
                this.soundFile = this.loadSoundFn(
                    filePath,
                    () => {
                        // Success callback
                        console.log('Audio loaded successfully:', filePath);
                        
                        // Wait a bit for sound to be fully ready
                        setTimeout(() => {
                            if (this.soundFile && this.soundFile.isLoaded()) {
                                console.log('Sound is loaded, duration:', this.soundFile.duration());
                                
                                // Set loop state
                                this.soundFile.setLoop(this.isLooping);
                                
                                // Ensure volume is set to 1.0 (full volume)
                                try {
                                    const currentVolume = this.soundFile.getVolume();
                                    if (currentVolume === 0 || currentVolume === undefined || currentVolume === null) {
                                        console.log('Setting audio volume to 1.0');
                                        this.soundFile.setVolume(1.0);
                                    } else {
                                        console.log('Audio volume:', currentVolume);
                                    }
                                } catch (e) {
                                    console.warn('Could not set/get volume:', e);
                                }
                                
                                // Ensure sound is connected to output (important for hidden p5 instances)
                                try {
                                    // p5.SoundFile should automatically connect, but let's verify
                                    // by checking if we can access the audio node
                                    if (this.soundFile.output && typeof this.soundFile.output.connect === 'function') {
                                        console.log('Sound file output node available');
                                    }
                                    // Force connection by setting volume again (this can help ensure connection)
                                    this.soundFile.setVolume(this.soundFile.getVolume() || 1.0);
                                } catch (e) {
                                    console.warn('Could not verify audio connection:', e);
                                }
                                
                                // Setup end callback
                                this.attachEndCallback();
                                
                                // Call onLoad callback
                                if (this.onLoad) {
                                    this.onLoad(this.soundFile);
                                }
                                
                                resolve(this.soundFile);
                            } else {
                                const error = new Error('Sound loaded but isLoaded() returns false');
                                console.error(error);
                                reject(error);
                            }
                        }, 100);
                    },
                    (error) => {
                        // Error callback
                        console.error('Error loading audio:', error);
                        this.soundFile = null;
                        this.currentFilePath = null;
                        reject(error);
                    }
                );
            } catch (error) {
                console.error('Exception calling loadSound:', error);
                this.soundFile = null;
                this.currentFilePath = null;
                reject(error);
            }
        });
    }

    /**
     * Attach end callback to sound file
     */
    attachEndCallback() {
        if (!this.soundFile || !this.onEnd) return;

        // p5.SoundFile doesn't have a direct 'onended' event
        // We'll need to check in the draw loop or use a different approach
        // For now, we'll rely on the Visualizer to check if sound ended
        // This is a limitation of p5.sound - we'll handle it in Visualizer
    }

    /**
     * Start or resume playback
     */
    play() {
        if (!this.soundFile || !this.soundFile.isLoaded()) {
            console.warn('Cannot play: sound not loaded');
            return false;
        }

        // Prevent double playback - if already playing, do nothing
        if (this.soundFile.isPlaying()) {
            console.log('Audio already playing, ignoring play() call');
            return true;
        }

        try {
            // Track start time for loop duration feature
            if (this.loopDuration !== null) {
                // If resuming from pause, accumulate pause duration
                if (this.pauseStartTime !== null) {
                    this.totalPauseDuration += Date.now() - this.pauseStartTime;
                    this.pauseStartTime = null;
                } else if (this.playStartTime === null) {
                    // Starting fresh - reset pause tracking
                    this.playStartTime = Date.now();
                    this.totalPauseDuration = 0;
                }
                // If already playing, playStartTime is already set
            }
            
            this.soundFile.play();
            if (this.onPlay) {
                this.onPlay();
            }
            return true;
        } catch (error) {
            console.error('Error playing:', error);
            return false;
        }
    }

    /**
     * Pause playback (keeps position)
     */
    pause() {
        if (!this.soundFile || !this.soundFile.isLoaded()) {
            console.warn('Cannot pause: sound not loaded');
            return false;
        }

        // Prevent double pause - if not playing, do nothing
        if (!this.soundFile.isPlaying()) {
            console.log('Audio not playing, ignoring pause() call');
            return true;
        }

        try {
            this.soundFile.pause();
            // Track pause start time for loop duration feature
            if (this.loopDuration !== null && this.playStartTime !== null) {
                this.pauseStartTime = Date.now();
            }
            if (this.onPause) {
                this.onPause();
            }
            return true;
        } catch (error) {
            console.error('Error pausing:', error);
            return false;
        }
    }

    /**
     * Stop playback (resets to beginning)
     */
    stop() {
        if (!this.soundFile || !this.soundFile.isLoaded()) {
            console.warn('Cannot stop: sound not loaded');
            return false;
        }

        try {
            this.soundFile.stop();
            // Reset loop duration tracking
            this.playStartTime = null;
            this.pauseStartTime = null;
            this.totalPauseDuration = 0;
            if (this.onStop) {
                this.onStop();
            }
            return true;
        } catch (error) {
            console.error('Error stopping:', error);
            return false;
        }
    }

    /**
     * Set loop state
     * @param {boolean} loop - Whether to loop
     */
    setLoop(loop) {
        this.isLooping = loop;
        if (this.soundFile && this.soundFile.isLoaded()) {
            this.soundFile.setLoop(loop);
        }
    }

    /**
     * Set loop duration (play for exactly N seconds, looping audio as needed)
     * @param {number|null} duration - Duration in seconds (null to disable)
     */
    setLoopDuration(duration) {
        this.loopDuration = duration;
        
        // If currently playing and we're setting a duration, reset start time
        if (duration !== null && this.isPlaying()) {
            this.playStartTime = Date.now();
            this.totalPauseDuration = 0;
            this.pauseStartTime = null;
        }
        
        // If disabling duration while playing, don't change anything
        // (let it continue playing normally)
    }

    /**
     * Get loop duration setting
     * @returns {number|null} - Duration in seconds, or null if disabled
     */
    getLoopDuration() {
        return this.loopDuration;
    }

    /**
     * Check if loop duration has been exceeded and stop if needed
     * Should be called periodically (e.g., from Visualizer's draw loop)
     * @returns {boolean} - True if playback was stopped due to duration limit
     */
    checkLoopDuration() {
        if (this.loopDuration === null || !this.isPlaying() || !this.playStartTime) {
            return false;
        }

        // Calculate elapsed time excluding pause duration
        const now = Date.now();
        let currentPauseDuration = 0;
        if (this.pauseStartTime !== null) {
            // Currently paused - include current pause
            currentPauseDuration = now - this.pauseStartTime;
        }
        const totalElapsed = now - this.playStartTime - this.totalPauseDuration - currentPauseDuration;
        const elapsedSeconds = totalElapsed / 1000;
        
        if (elapsedSeconds >= this.loopDuration) {
            // Stop playback after duration
            this.stop();
            if (this.onEnd) {
                this.onEnd();
            }
            return true;
        }
        
        return false;
    }

    /**
     * Get elapsed time since playback started (for loop duration)
     * @returns {number} - Elapsed seconds, or 0 if not tracking
     */
    getElapsedTime() {
        if (!this.playStartTime) {
            return 0;
        }
        // Calculate elapsed time excluding pause duration
        const now = Date.now();
        let currentPauseDuration = 0;
        if (this.pauseStartTime !== null) {
            // Currently paused - include current pause
            currentPauseDuration = now - this.pauseStartTime;
        }
        const totalElapsed = now - this.playStartTime - this.totalPauseDuration - currentPauseDuration;
        return totalElapsed / 1000;
    }

    /**
     * Get remaining time until loop duration ends
     * @returns {number|null} - Remaining seconds, or null if not using loop duration
     */
    getRemainingLoopTime() {
        if (this.loopDuration === null || !this.playStartTime) {
            return null;
        }
        const elapsed = this.getElapsedTime();
        return Math.max(0, this.loopDuration - elapsed);
    }

    /**
     * Enable/disable test mode (30s baseline + 30s stimulation)
     * @param {boolean} enabled - Whether to enable test mode
     */
    setTestMode(enabled) {
        this.testMode = enabled;
        if (enabled) {
            this.testStartTime = Date.now();
            this.testPhase = 'baseline';
            // Reset audio to beginning and stop - wait for stimulation phase
            if (this.soundFile && this.soundFile.isLoaded()) {
                if (this.soundFile.isPlaying()) {
                    this.soundFile.stop(); // Stop and reset to beginning
                } else {
                    // If paused, also reset to beginning
                    this.soundFile.stop();
                }
            }
        } else {
            this.testStartTime = null;
            this.testPhase = null;
        }
    }

    /**
     * Get test mode state
     * @returns {boolean}
     */
    getTestMode() {
        return this.testMode;
    }

    /**
     * Get elapsed time since test mode started
     * @returns {number} - Elapsed seconds, or 0 if not in test mode
     */
    getTestElapsedTime() {
        if (!this.testMode || !this.testStartTime) {
            return 0;
        }
        return (Date.now() - this.testStartTime) / 1000;
    }

    /**
     * Get current test phase
     * @returns {string|null} - 'baseline', 'stimulating', or null if not in test mode
     */
    getTestPhase() {
        return this.testPhase;
    }

    /**
     * Check test mode timing and handle phase transitions
     * Should be called periodically (e.g., from draw loop)
     * @returns {boolean} - True if test completed and was stopped
     */
    checkTestMode() {
        if (!this.testMode || !this.testStartTime) {
            return false;
        }

        const elapsed = this.getTestElapsedTime();

        // Phase 1: Baseline (0-30s) - no audio
        if (elapsed < 30) {
            if (this.testPhase !== 'baseline') {
                this.testPhase = 'baseline';
                // Ensure audio is not playing during baseline
                if (this.soundFile && this.soundFile.isPlaying()) {
                    this.soundFile.pause();
                }
            }
            return false;
        }

        // Phase 2: Stimulation (30-60s) - play audio
        if (elapsed < 60) {
            if (this.testPhase !== 'stimulating') {
                this.testPhase = 'stimulating';
                // Start playing audio from the beginning for stimulation phase
                if (this.soundFile && this.soundFile.isLoaded()) {
                    // Ensure audio is stopped and reset to beginning before starting
                    if (this.soundFile.isPlaying()) {
                        this.soundFile.stop();
                    }
                    this.soundFile.setLoop(true); // Loop during stimulation
                    this.soundFile.play(); // Start from beginning
                    if (this.onPlay) {
                        this.onPlay();
                    }
                }
            }
            return false;
        }

        // Test complete (60s reached)
        this.stop();
        this.setTestMode(false);
        if (this.onEnd) {
            this.onEnd();
        }
        return true;
    }

    /**
     * Get current playback time in seconds
     * @returns {number}
     */
    getCurrentTime() {
        if (!this.soundFile || !this.soundFile.isLoaded()) {
            return 0;
        }
        return this.soundFile.currentTime() || 0;
    }

    /**
     * Get audio duration in seconds
     * @returns {number}
     */
    getDuration() {
        if (!this.soundFile || !this.soundFile.isLoaded()) {
            return 0;
        }
        return this.soundFile.duration() || 0;
    }

    /**
     * Check if audio is currently playing
     * @returns {boolean}
     */
    isPlaying() {
        if (!this.soundFile || !this.soundFile.isLoaded()) {
            return false;
        }
        return this.soundFile.isPlaying() || false;
    }

    /**
     * Check if audio file is loaded
     * @returns {boolean}
     */
    isLoaded() {
        return this.soundFile !== null && this.soundFile.isLoaded() === true;
    }

    /**
     * Get the p5.SoundFile instance
     * @returns {p5.SoundFile|null}
     */
    getSoundFile() {
        return this.soundFile;
    }

    /**
     * Get current file path
     * @returns {string|null}
     */
    getCurrentFilePath() {
        return this.currentFilePath;
    }

    /**
     * Get current loop state
     * @returns {boolean}
     */
    getLoop() {
        return this.isLooping;
    }

    /**
     * Cleanup - stop playback and clear references
     */
    destroy() {
        if (this.soundFile) {
            try {
                this.soundFile.stop();
            } catch (e) {
                console.log('Error stopping sound during destroy:', e);
            }
        }
        
        this.soundFile = null;
        this.currentFilePath = null;
        this.loopDuration = null;
        this.playStartTime = null;
        this.pauseStartTime = null;
        this.totalPauseDuration = 0;
        this.loadSoundFn = null;
        this.onLoad = null;
        this.onPlay = null;
        this.onPause = null;
        this.onStop = null;
        this.onEnd = null;
    }
}
