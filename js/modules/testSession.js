/**
 * TestSession Module
 * 
 * Manages the state and execution flow of a test session.
 * Handles phase transitions, trial management, and data collection coordination.
 */

class TestSession {
    /**
     * Create a TestSession instance
     * @param {Object} options - Configuration options
     * @param {string} options.sessionId - Unique session ID
     * @param {Array} options.queue - Array of pattern files to test
     * @param {Object} options.sessionData - Session metadata (participant, location, etc.)
     * @param {Function} [options.onPhaseChange] - Callback when phase changes: (phase, data) => void
     * @param {Function} [options.onTrialComplete] - Callback when trial completes: (trialData) => void
     * @param {Function} [options.onSessionComplete] - Callback when session completes: (sessionData) => void
     * @param {Function} [options.onError] - Callback on error: (error) => void
     * @param {Object} [options.timing] - Timing configuration (overrides config file)
     * @param {number} [options.timing.calibrationDuration] - Calibration duration in seconds
     * @param {number} [options.timing.baselineDuration] - Baseline duration in seconds
     * @param {number} [options.timing.stimulationDuration] - Stimulation duration in seconds
     * @param {string} [options.timingConfigPath='js/modules/sessionTimingConfig.json'] - Path to timing config file
     */
    constructor(options = {}) {
        if (!options.sessionId || !options.queue || !options.sessionData) {
            throw new Error('TestSession requires sessionId, queue, and sessionData');
        }

        this.sessionId = options.sessionId;
        this.queue = [...options.queue]; // Immutable copy
        this.sessionData = options.sessionData;
        
        // Callbacks
        this.onPhaseChange = options.onPhaseChange || null;
        this.onTrialComplete = options.onTrialComplete || null;
        this.onSessionComplete = options.onSessionComplete || null;
        this.onError = options.onError || null;

        // State
        this.currentPhase = null; // 'calibration' | 'baseline' | 'stimulation' | 'survey' | 'complete' | 'aborted'
        this.currentTrialIndex = -1; // -1 = calibration, 0+ = trial index
        this.isActive = false;
        this.isPaused = false;
        this.isAborted = false;
        this.abortReason = null;

        // Timing configuration
        this.timingConfigPath = options.timingConfigPath || 'js/modules/sessionTimingConfig.json';
        this.timingConfigLoaded = false;
        
        // Default timing values (will be overridden by config file or options)
        this.calibrationDuration = options.timing?.calibrationDuration || 20; // seconds
        this.baselineDuration = options.timing?.baselineDuration || 30; // seconds
        this.stimulationDuration = options.timing?.stimulationDuration || 30; // seconds
        this.surveyDurationEstimate = options.timing?.surveyDurationEstimate || options.timing?.taggingDuration || 20; // seconds
        this.collectBaselineOnlyOnFirstTrial = options.collectBaselineOnlyOnFirstTrial !== false;

        // Timing
        this.phaseStartTime = null;

        // Data collection
        this.calibrationReadings = [];
        this.trials = []; // Array of trial data objects

        // Current trial data (built as we progress)
        this.currentTrial = null;

        // Load timing configuration asynchronously (non-blocking)
        this.loadTimingConfig();
    }

    /**
     * Load timing configuration from JSON file
     * Falls back to defaults if file doesn't exist or fails to load
     */
    async loadTimingConfig() {
        try {
            const response = await fetch(this.timingConfigPath);
            if (!response.ok) {
                console.warn(`TestSession: Could not load timing config from ${this.timingConfigPath}, using defaults`);
                return;
            }
            const config = await response.json();
            
            // Remove comment fields
            const { _comment, ...cleanConfig } = config;
            
            // Update durations from config (only if not explicitly provided in constructor)
            if (!this.timingConfigLoaded) {
                if (cleanConfig.calibrationDuration !== undefined) {
                    this.calibrationDuration = cleanConfig.calibrationDuration;
                }
                if (cleanConfig.baselineDuration !== undefined) {
                    this.baselineDuration = cleanConfig.baselineDuration;
                }
                if (cleanConfig.stimulationDuration !== undefined) {
                    this.stimulationDuration = cleanConfig.stimulationDuration;
                }
                if (cleanConfig.surveyDurationEstimate !== undefined) {
                    this.surveyDurationEstimate = cleanConfig.surveyDurationEstimate;
                } else if (cleanConfig.taggingDuration !== undefined) {
                    this.surveyDurationEstimate = cleanConfig.taggingDuration;
                }
                this.timingConfigLoaded = true;
                console.log('TestSession: Loaded timing config:', {
                    calibration: this.calibrationDuration,
                    baseline: this.baselineDuration,
                    stimulation: this.stimulationDuration,
                    surveyEstimate: this.surveyDurationEstimate
                });
            }
        } catch (error) {
            console.warn('TestSession: Error loading timing config:', error);
            // Continue with defaults
        }
    }

    /**
     * Start the test session
     */
    start() {
        if (this.isActive) {
            console.warn('TestSession: Session already active');
            return;
        }

        if (this.queue.length === 0) {
            const error = new Error('Cannot start session: queue is empty');
            if (this.onError) this.onError(error);
            return;
        }

        this.isActive = true;
        this.isPaused = false;
        this.isAborted = false;
        this.abortReason = null;
        this.currentTrialIndex = -1; // Start with calibration

        // Initialize trials array
        this.trials = this.queue.map((pattern, index) => ({
            trialId: this.generateTrialId(index),
            pattern: pattern,
            trialOrder: index + 1,
            startTime: null,
            endTime: null,
            baselineReadings: [],
            stimulationReadings: [],
            audioTimeOffset: null,
            selectedTags: [],
            testerNotes: [],
            testerEvents: [],
            status: 'pending' // 'pending' | 'in_progress' | 'completed' | 'aborted' | 'skipped'
        }));

        // Start calibration phase
        this.startCalibration();
    }

    /**
     * Start calibration phase
     */
    startCalibration() {
        this.currentPhase = 'calibration';
        this.phaseStartTime = Date.now();
        this.calibrationReadings = [];

        if (this.onPhaseChange) {
            const payload = {
                duration: this.calibrationDuration,
                startTime: this.phaseStartTime
            };
            this.onPhaseChange('calibration', this.buildPhasePayload('calibration', payload));
        }
    }

    /**
     * Complete calibration and start first trial
     */
    completeCalibration() {
        if (this.currentPhase !== 'calibration') {
            console.warn('TestSession: Not in calibration phase');
            return;
        }

        // Move to first trial
        this.currentTrialIndex = 0;
        this.startTrial();
    }

    /**
     * Start a trial (baseline phase)
     */
    startTrial() {
        if (this.currentTrialIndex < 0 || this.currentTrialIndex >= this.trials.length) {
            console.warn('TestSession: Invalid trial index');
            return;
        }

        const trial = this.trials[this.currentTrialIndex];
        trial.status = 'in_progress';
        trial.startTime = new Date().toISOString();
        this.currentTrial = trial;

        // Start baseline phase
        this.startBaseline();
    }

    /**
     * Start baseline phase
     */
    startBaseline() {
        this.currentPhase = 'baseline';
        this.phaseStartTime = Date.now();
        this.currentTrial.baselineReadings = [];
        const collectsBaseline = this.shouldCollectBaselineInCurrentTrial();

        if (this.onPhaseChange) {
            const payload = {
                patternIndex: this.currentTrialIndex,
                patternNumber: this.currentTrialIndex + 1,
                totalPatterns: this.trials.length,
                pattern: this.currentTrial.pattern,
                duration: this.baselineDuration,
                startTime: this.phaseStartTime,
                collectingData: collectsBaseline
            };
            this.onPhaseChange('baseline', this.buildPhasePayload('baseline', payload));
        }
    }

    /**
     * Complete baseline and start stimulation phase
     */
    completeBaseline() {
        if (this.currentPhase !== 'baseline') {
            console.warn('TestSession: Not in baseline phase');
            return;
        }

        this.startStimulation();
    }

    /**
     * Start stimulation phase
     */
    startStimulation() {
        this.currentPhase = 'stimulation';
        this.phaseStartTime = Date.now();
        this.currentTrial.stimulationReadings = [];
        this.currentTrial.audioTimeOffset = null; // Will be set when audio actually starts

        if (this.onPhaseChange) {
            const payload = {
                patternIndex: this.currentTrialIndex,
                patternNumber: this.currentTrialIndex + 1,
                totalPatterns: this.trials.length,
                pattern: this.currentTrial.pattern,
                duration: this.stimulationDuration,
                startTime: this.phaseStartTime
            };
            this.onPhaseChange('stimulation', this.buildPhasePayload('stimulation', payload));
        }
    }

    /**
     * Record audio start time (for audio_time_offset calculation)
     */
    recordAudioStart() {
        if (this.currentPhase === 'stimulation' && this.currentTrial) {
            const audioStartTime = Date.now();
            this.currentTrial.audioTimeOffset = audioStartTime - this.phaseStartTime;
        }
    }

    /**
     * Complete stimulation phase and move to survey
     */
    completeStimulation() {
        if (this.currentPhase !== 'stimulation') {
            console.warn('TestSession: Not in stimulation phase');
            return;
        }

        this.startSurvey();
    }

    /**
     * Start survey phase
     */
    startSurvey() {
        this.currentPhase = 'survey';

        if (this.onPhaseChange) {
            const payload = {
                patternIndex: this.currentTrialIndex,
                patternNumber: this.currentTrialIndex + 1,
                totalPatterns: this.trials.length,
                pattern: this.currentTrial.pattern
            };
            this.onPhaseChange('survey', this.buildPhasePayload('survey', payload));
        }
    }

    /**
     * Complete survey and continue to next pattern (or complete session)
     */
    completeSurvey(selectedTags) {
        if (this.currentPhase !== 'survey') {
            console.warn('TestSession: Not in survey phase');
            return;
        }

        // Save selected tags
        this.currentTrial.selectedTags = selectedTags || [];

        // Complete current trial
        this.currentTrial.endTime = new Date().toISOString();
        this.currentTrial.status = 'completed';

        if (this.onTrialComplete) {
            this.onTrialComplete({
                ...this.currentTrial,
                baselineReadings: [...this.currentTrial.baselineReadings],
                stimulationReadings: [...this.currentTrial.stimulationReadings]
            });
        }

        // Move directly to next pattern or complete session
        this.currentTrialIndex++;
        
        if (this.currentTrialIndex >= this.trials.length) {
            // All patterns complete
            this.completeSession();
        } else {
            // Start next pattern
            this.startTrial();
        }
    }

    /**
     * Complete the entire session
     */
    completeSession() {
        this.currentPhase = 'complete';
        this.isActive = false;

        const sessionData = {
            sessionId: this.sessionId,
            sessionData: this.sessionData,
            calibrationReadings: [],
            trials: this.trials.map(trial => ({
                ...trial,
                baselineReadings: [...trial.baselineReadings],
                stimulationReadings: [...trial.stimulationReadings]
            })),
            completedAt: new Date().toISOString()
        };

        if (this.onSessionComplete) {
            this.onSessionComplete(sessionData);
        }
    }

    /**
     * Abort the session
     */
    abort(reason = null) {
        this.isAborted = true;
        this.isActive = false;
        this.isPaused = false;
        this.abortReason = reason || this.abortReason || 'Session aborted';

        // Mark current trial as aborted if in progress
        if (this.currentTrial && this.currentTrial.status === 'in_progress') {
            this.currentTrial.status = 'aborted';
            this.currentTrial.endTime = new Date().toISOString();
        }

        // Mark pending trials as aborted
        for (let i = this.currentTrialIndex + 1; i < this.trials.length; i++) {
            if (this.trials[i].status === 'pending') {
                this.trials[i].status = 'aborted';
            }
        }

        if (this.onPhaseChange) {
            const payload = {
                abortedAt: new Date().toISOString(),
                currentTrialIndex: this.currentTrialIndex,
                reason: this.abortReason
            };
            this.onPhaseChange('aborted', this.buildPhasePayload('aborted', payload));
        }
    }

    /**
     * Build a normalized phase payload for all phase-change callbacks.
     * This keeps progress and breadcrumb metadata consistent across UI surfaces.
     * @param {string} phase
     * @param {Object} payload
     * @returns {Object}
     */
    buildPhasePayload(phase, payload = {}) {
        return {
            ...payload,
            progress: this.getProgressContract(phase, payload)
        };
    }

    /**
     * Compute normalized progress/breadcrumb metadata for the current phase.
     * @param {string} phase
     * @param {Object} payload
     * @returns {Object}
     */
    getProgressContract(phase, payload = {}) {
        const totalTrials = this.trials.length;
        const trialIndex = payload.patternIndex ?? this.currentTrialIndex;
        const trialNumber = Number.isInteger(trialIndex) && trialIndex >= 0 ? trialIndex + 1 : null;
        const collectsBaseline = Boolean(payload.collectingData);
        const displayPhase = this.getDisplayPhaseLabel(phase, collectsBaseline, trialIndex);
        const totalSteps = 1 + (totalTrials * 3); // calibration + 3 steps per trial
        let stepIndex = 1; // calibration by default
        let nextStepLabel = '';

        if (phase === 'calibration') {
            nextStepLabel = totalTrials > 0 ? 'Trial 1: Baseline' : '';
        } else if (trialNumber !== null) {
            const stepOffsetByPhase = {
                baseline: 1,
                stimulation: 2,
                survey: 3
            };
            const offset = stepOffsetByPhase[phase] || 1;
            stepIndex = 1 + (trialIndex * 3) + offset;
            nextStepLabel = this.getNextStepLabel(phase, trialIndex);
        }

        return {
            phase,
            displayPhase,
            trialIndex,
            trialNumber,
            totalTrials,
            stepIndex,
            totalSteps,
            compactMode: totalTrials >= 30,
            nextStepLabel,
            phaseSequence: this.getTrialPhaseSequence(trialIndex, collectsBaseline),
            activePhaseChipLabel: this.getActivePhaseChipLabel(phase, collectsBaseline, trialIndex),
            estimatedRemainingSeconds: this.getEstimatedRemainingSeconds(phase, trialIndex),
            estimatedRemainingLabel: this.formatDuration(this.getEstimatedRemainingSeconds(phase, trialIndex))
        };
    }

    /**
     * Get phase sequence labels for the active trial.
     * @param {number|null} trialIndex
     * @param {boolean} collectingData
     * @returns {Array<{id: string, label: string}>}
     */
    getTrialPhaseSequence(trialIndex, collectingData = false) {
        if (trialIndex === null || trialIndex < 0) {
            return [{ id: 'calibration', label: 'Calibration' }];
        }
        return [
            { id: 'baseline', label: 'Baseline' },
            { id: 'stimulation', label: 'Stimulate' },
            { id: 'survey', label: 'Survey' },
            { id: 'rest', label: 'Rest' }
        ];
    }

    /**
     * Determine which phase chip is active for current state.
     * @param {string} phase
     * @param {boolean} collectingData
     * @param {number|null} trialIndex
     * @returns {string}
     */
    getActivePhaseChipLabel(phase, collectingData = false, trialIndex = null) {
        if (phase === 'baseline') {
            return this.getDisplayPhaseLabel('baseline', collectingData, trialIndex);
        }
        if (phase === 'stimulation') return 'Stimulate';
        if (phase === 'survey') return 'Survey';
        if (phase === 'calibration') return 'Calibration';
        return '';
    }

    /**
     * Estimate remaining session time in seconds.
     * @param {string} phase
     * @param {number|null} trialIndex
     * @returns {number}
     */
    getEstimatedRemainingSeconds(phase, trialIndex) {
        const trialBlock = this.baselineDuration + this.stimulationDuration + this.surveyDurationEstimate;
        const safeTrialIndex = Number.isInteger(trialIndex) ? trialIndex : -1;
        const elapsedSec = Math.max(0, Math.floor(this.getPhaseElapsedTime() / 1000));
        const calibrationRemaining = Math.max(0, this.calibrationDuration - elapsedSec);

        if (phase === 'calibration') {
            return calibrationRemaining + (this.trials.length * trialBlock);
        }

        if (safeTrialIndex < 0 || safeTrialIndex >= this.trials.length) {
            return 0;
        }

        const remainingTrialsAfterCurrent = Math.max(0, this.trials.length - safeTrialIndex - 1);
        let currentTrialRemaining = 0;
        if (phase === 'baseline') {
            currentTrialRemaining = Math.max(0, this.baselineDuration - elapsedSec) + this.stimulationDuration + this.surveyDurationEstimate;
        } else if (phase === 'stimulation') {
            currentTrialRemaining = Math.max(0, this.stimulationDuration - elapsedSec) + this.surveyDurationEstimate;
        } else if (phase === 'survey') {
            currentTrialRemaining = Math.max(0, this.surveyDurationEstimate - elapsedSec);
        }

        return currentTrialRemaining + (remainingTrialsAfterCurrent * trialBlock);
    }

    /**
     * Format seconds to MM:SS / HH:MM:SS.
     * @param {number} totalSeconds
     * @returns {string}
     */
    formatDuration(totalSeconds) {
        const seconds = Math.max(0, Number(totalSeconds) || 0);
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        const two = (value) => String(value).padStart(2, '0');
        if (hrs > 0) return `${two(hrs)}:${two(mins)}:${two(secs)}`;
        return `${two(mins)}:${two(secs)}`;
    }

    /**
     * Map internal phases to user-facing display labels.
     * @param {string} phase
     * @param {boolean} collectingData
     * @param {number|null} trialIndex
     * @returns {string}
     */
    getDisplayPhaseLabel(phase, collectingData = false, trialIndex = null) {
        if (phase === 'baseline') {
            const isFirstTrial = trialIndex === 0;
            return collectingData || isFirstTrial ? 'Baseline' : 'Rest';
        }
        if (phase === 'stimulation') return 'Stimulate';
        if (phase === 'survey') return 'Survey';
        if (phase === 'calibration') return 'Calibration';
        if (phase === 'complete') return 'Complete';
        if (phase === 'aborted') return 'Aborted';
        return phase;
    }

    /**
     * Get the expected next display step for current trial/phase.
     * @param {string} phase
     * @param {number} trialIndex
     * @returns {string}
     */
    getNextStepLabel(phase, trialIndex) {
        const hasNextTrial = trialIndex + 1 < this.trials.length;
        if (phase === 'baseline') return 'Stimulate';
        if (phase === 'stimulation') return 'Survey';
        if (phase === 'survey') {
            if (!hasNextTrial) return 'Complete Session';
            return 'Rest';
        }
        return '';
    }

    /**
     * Attach a tester note to a trial.
     * @param {number} trialIndex
     * @param {string} text
     * @param {Object} metadata
     */
    addTesterNote(trialIndex, text, metadata = {}) {
        const trial = this.trials[trialIndex];
        if (!trial || !text || !String(text).trim()) return;
        trial.testerNotes.push({
            text: String(text).trim(),
            createdAt: new Date().toISOString(),
            phase: metadata.phase || this.currentPhase,
            timestampMs: Number.isFinite(metadata.timestampMs) ? metadata.timestampMs : Date.now()
        });
    }

    /**
     * Attach a tester event marker to a trial.
     * @param {number} trialIndex
     * @param {string} eventType
     * @param {Object} metadata
     */
    addTesterEvent(trialIndex, eventType, metadata = {}) {
        const trial = this.trials[trialIndex];
        if (!trial || !eventType) return;
        trial.testerEvents.push({
            type: String(eventType),
            createdAt: new Date().toISOString(),
            phase: metadata.phase || this.currentPhase,
            timestampMs: Number.isFinite(metadata.timestampMs) ? metadata.timestampMs : Date.now(),
            details: metadata.details || null
        });
    }

    /**
     * Add brainwave reading
     * @param {Object} reading - Brainwave reading object
     */
    addReading(reading) {
        if (!this.isActive) return;

        const phase = this.currentPhase;
        if (!phase) return;

        // Add phase and timestamp to reading
        const enrichedReading = {
            ...reading,
            phase: phase,
            timestamp_ms: Date.now()
        };

        if (phase === 'baseline' && this.currentTrial) {
            if (this.shouldCollectBaselineInCurrentTrial()) {
                this.currentTrial.baselineReadings.push(enrichedReading);
            }
        } else if (phase === 'stimulation' && this.currentTrial) {
            // Add audio_time_offset if available
            if (this.currentTrial.audioTimeOffset !== null) {
                enrichedReading.audioTimeOffset = this.currentTrial.audioTimeOffset;
            }
            this.currentTrial.stimulationReadings.push(enrichedReading);
        }
    }
    /**
     * Check whether baseline readings should be collected for current trial.
     * @returns {boolean}
     */
    shouldCollectBaselineInCurrentTrial() {
        if (!this.currentTrial) return false;
        if (!this.collectBaselineOnlyOnFirstTrial) return true;
        return this.currentTrialIndex === 0;
    }

    /**
     * Get current phase info
     * @returns {Object} Phase information
     */
    getCurrentPhaseInfo() {
        return {
            phase: this.currentPhase,
            patternIndex: this.currentTrialIndex,
            patternNumber: this.currentTrialIndex >= 0 ? this.currentTrialIndex + 1 : null,
            totalPatterns: this.trials.length,
            currentTrial: this.currentTrial,
            phaseStartTime: this.phaseStartTime,
            isActive: this.isActive,
            isPaused: this.isPaused,
            isAborted: this.isAborted
        };
    }

    /**
     * Get elapsed time in current phase (milliseconds)
     * @returns {number}
     */
    getPhaseElapsedTime() {
        if (!this.phaseStartTime) return 0;
        return Date.now() - this.phaseStartTime;
    }

    /**
     * Get remaining time in current phase (milliseconds)
     * @returns {number}
     */
    getPhaseRemainingTime() {
        if (!this.phaseStartTime) return 0;

        let phaseDuration = 0;
        if (this.currentPhase === 'calibration') {
            phaseDuration = this.calibrationDuration * 1000;
        } else if (this.currentPhase === 'baseline') {
            phaseDuration = this.baselineDuration * 1000;
        } else if (this.currentPhase === 'stimulation') {
            phaseDuration = this.stimulationDuration * 1000;
        }

        const elapsed = this.getPhaseElapsedTime();
        return Math.max(0, phaseDuration - elapsed);
    }

    /**
     * Generate unique trial ID
     * @param {number} index - Trial index
     * @returns {string}
     */
    generateTrialId(index) {
        return `${this.sessionId}_trial_${index + 1}`;
    }

    /**
     * Get session data for saving
     * @returns {Object}
     */
    getSessionData() {
        return {
            sessionId: this.sessionId,
            sessionData: this.sessionData,
            calibrationReadings: [],
            trials: this.trials.map(trial => ({
                ...trial,
                baselineReadings: [...trial.baselineReadings],
                stimulationReadings: [...trial.stimulationReadings]
            })),
            isAborted: this.isAborted,
            abortReason: this.abortReason,
            completedAt: this.isAborted ? null : new Date().toISOString()
        };
    }
}
