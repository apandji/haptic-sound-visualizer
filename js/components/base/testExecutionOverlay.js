/**
 * TestExecutionOverlay Component
 * 
 * Full-screen overlay for test execution flow.
 * Handles calibration, baseline, stimulation, checkpoint, and survey phases.
 */

class TestExecutionOverlay {
    /**
     * Create a TestExecutionOverlay instance
     * @param {Object} options - Configuration options
     * @param {string} [options.containerId='testExecutionOverlay'] - Container ID
     * @param {Function} [options.onAbort] - Callback when session is aborted: () => void
     * @param {Function} [options.onManualStartCalibration] - Callback to start test manually during calibration: () => void
     */
    constructor(options = {}) {
        this.containerId = options.containerId || 'testExecutionOverlay';
        this.container = document.getElementById(this.containerId);
        this.onAbort = options.onAbort || null;
        this.onManualStartCalibration = options.onManualStartCalibration || null;

        // State
        this.isVisible = false;
        this.currentPhase = null;
        this.countdown = 0;
        this.countdownInterval = null;

        if (!this.container) {
            console.error(`TestExecutionOverlay: Container #${this.containerId} not found`);
            // Try to create container if it doesn't exist
            this.container = document.createElement('div');
            this.container.id = this.containerId;
            document.body.appendChild(this.container);
            console.log(`TestExecutionOverlay: Created container #${this.containerId}`);
        }

        this.init();
    }

    /**
     * Initialize the overlay
     */
    init() {
        this.container.innerHTML = '';
        this.container.className = 'test-execution-overlay';
        
        // Create main content container
        this.contentContainer = document.createElement('div');
        this.contentContainer.className = 'test-execution-overlay__content';
        this.container.appendChild(this.contentContainer);

        // Create top-right button container
        this.topRightButtons = document.createElement('div');
        this.topRightButtons.className = 'test-execution-overlay__top-right-buttons';
        this.container.appendChild(this.topRightButtons);

        // Create abort button (always visible, destructive) - on LEFT
        this.abortButton = document.createElement('button');
        this.abortButton.className = 'test-execution-overlay__abort-btn';
        this.abortButton.textContent = 'ABORT';
        this.abortButton.addEventListener('click', () => {
            if (this.onAbort) {
                this.onAbort();
            }
        });
        this.topRightButtons.appendChild(this.abortButton);

        // Create NEXT button (shown conditionally) - on RIGHT
        this.nextButton = document.createElement('button');
        this.nextButton.className = 'test-execution-overlay__next-btn';
        this.nextButton.textContent = 'NEXT';
        this.nextButton.style.display = 'none'; // Hidden by default
        this.nextButton.addEventListener('click', () => {
            this.handleNext();
        });
        this.topRightButtons.appendChild(this.nextButton);

        // Initially hidden
        this.hide();
    }

    /**
     * Show the overlay
     */
    show() {
        if (!this.container) {
            console.error('TestExecutionOverlay: Cannot show - container not found');
            return;
        }
        // Trigger reflow for smooth transition
        this.container.style.display = 'flex';
        this.container.offsetHeight; // Force reflow
        this.container.classList.add('active');
        this.isVisible = true;
    }

    /**
     * Hide the overlay
     */
    hide() {
        if (!this.container) {
            return;
        }
        this.container.classList.remove('active');
        this.isVisible = false;
        this.stopCountdown();
        this.currentPhase = null;
        // Wait for transition before hiding display
        setTimeout(() => {
            if (!this.isVisible) {
                this.container.style.display = 'none';
            }
        }, 300);
    }

    /**
     * Show calibration phase
     * @param {Object} data - Phase data
     * @param {number} data.requiredChannels - Total channels required for gate (typically 4)
     * @param {number} data.requiredGoodChannels - Good channels required to mark ready (typically 3)
     */
    showCalibration(data) {
        this.currentPhase = 'calibration';
        this.calibrationRequiredChannels = Number(data.requiredChannels) || 4;
        this.calibrationRequiredGoodChannels = Number(data.requiredGoodChannels) || 3;
        this.show();
        this.stopCountdown();
        this.showNextButton(false);
        // Hide top ABORT button in calibration (dedicated calibration controls are shown in content)
        if (this.abortButton) {
            this.abortButton.style.display = 'none';
        }

        this.contentContainer.innerHTML = `
            <div class="test-execution-overlay__phase test-execution-overlay__phase--calibration">
                <div class="test-execution-overlay__phase-label">CALIBRATION CHECK</div>
                <div class="test-execution-overlay__calibration-instructions">
                    Continue when at least ${this.calibrationRequiredGoodChannels} of ${this.calibrationRequiredChannels} channels are <strong>good</strong>,
                    or use manual start.
                </div>
                <div class="test-execution-overlay__calibration-gate" id="calibrationGateStatus">
                    Waiting for channel readings...
                </div>
                <div class="test-execution-overlay__calibration-widget-slot" id="calibrationWidgetContainer"></div>
                <div class="test-execution-overlay__calibration-actions">
                    <button class="test-execution-overlay__calibration-btn test-execution-overlay__calibration-btn--abort" id="calibrationAbortBtn">
                        Abort Test
                    </button>
                    <button class="test-execution-overlay__calibration-btn test-execution-overlay__calibration-btn--start" id="calibrationManualStartBtn">
                        Start Test
                    </button>
                </div>
            </div>
        `;

        const abortBtn = this.contentContainer.querySelector('#calibrationAbortBtn');
        if (abortBtn) {
            abortBtn.addEventListener('click', () => {
                if (this.onAbort) {
                    this.onAbort();
                }
            });
        }

        const manualStartBtn = this.contentContainer.querySelector('#calibrationManualStartBtn');
        if (manualStartBtn) {
            manualStartBtn.addEventListener('click', () => {
                if (this.onManualStartCalibration) {
                    this.onManualStartCalibration();
                }
            });
        }

        this.updateCalibrationGateStatus({
            pass: false,
            goodChannels: 0,
            totalChannels: 0,
            requiredGoodChannels: this.calibrationRequiredGoodChannels,
            requiredChannels: this.calibrationRequiredChannels
        });
    }

    /**
     * Show baseline phase
     * @param {Object} data - Phase data
     * @param {number} data.duration - Duration in seconds
     * @param {number} data.patternNumber - Current pattern number
     * @param {number} data.totalPatterns - Total number of patterns
     * @param {Object} data.pattern - Pattern file object
     */
    showBaseline(data) {
        this.currentPhase = 'baseline';
        this.show();
        this.showNextButton(false); // Hide NEXT during countdown phases
        // Show ABORT button during active phases
        if (this.abortButton) {
            this.abortButton.style.display = 'block';
        }
        this.startCountdown(data.duration, () => {
            // Countdown complete - baseline done
        });

        // Ensure we have valid data
        const patternNumber = data.patternNumber || (data.patternIndex !== undefined ? data.patternIndex + 1 : 1);
        const totalPatterns = data.totalPatterns || (data.trials ? data.trials.length : 1);
        const patternName = data.pattern ? data.pattern.name : 'Unknown';
        const phaseLabel = data.collectingData === false ? 'REST' : 'BASELINE';

        this.contentContainer.innerHTML = `
            <div class="test-execution-overlay__phase test-execution-overlay__phase--baseline">
                <div class="test-execution-overlay__phase-label">${phaseLabel}</div>
                <div class="test-execution-overlay__countdown" id="baselineCountdown">${data.duration}</div>
                <div class="test-execution-overlay__pattern-info">
                    Pattern ${patternNumber} of ${totalPatterns}
                </div>
                <div class="test-execution-overlay__pattern-name">${patternName}</div>
            </div>
        `;
    }

    /**
     * Show stimulation phase
     * @param {Object} data - Phase data
     * @param {number} data.duration - Duration in seconds
     * @param {number} data.patternNumber - Current pattern number
     * @param {number} data.totalPatterns - Total number of patterns
     * @param {Object} data.pattern - Pattern file object
     */
    showStimulation(data) {
        this.currentPhase = 'stimulation';
        this.show();
        // Show ABORT button during active phases
        if (this.abortButton) {
            this.abortButton.style.display = 'block';
        }
        this.startCountdown(data.duration, () => {
            // Countdown complete - stimulation done
        });

        // Ensure we have valid data
        const patternNumber = data.patternNumber || (data.patternIndex !== undefined ? data.patternIndex + 1 : 1);
        const totalPatterns = data.totalPatterns || (data.trials ? data.trials.length : 1);
        const patternName = data.pattern ? data.pattern.name : 'Unknown';

        this.contentContainer.innerHTML = `
            <div class="test-execution-overlay__phase test-execution-overlay__phase--stimulation">
                <div class="test-execution-overlay__phase-label">STIMULATION</div>
                <div class="test-execution-overlay__countdown" id="stimulationCountdown">${data.duration}</div>
                <div class="test-execution-overlay__pattern-info">
                    Pattern ${patternNumber} of ${totalPatterns}
                </div>
                <div class="test-execution-overlay__pattern-name">${patternName}</div>
            </div>
        `;
    }

    // Pattern-complete checkpoint removed - survey now goes directly to next pattern

    /**
     * Show/hide NEXT button
     * @param {boolean} show - Whether to show the button
     * @param {boolean} isLastPattern - Whether this is the last pattern (shows "FINISH" instead)
     */
    showNextButton(show, isLastPattern = false) {
        if (this.nextButton) {
            this.nextButton.style.display = show ? 'block' : 'none';
            this.nextButton.textContent = isLastPattern ? 'FINISH' : 'NEXT';
            this.isLastPattern = isLastPattern;
        }
    }

    /**
     * Handle NEXT button click
     */
    handleNext() {
        if (this.currentPhase === 'survey') {
            // Trigger survey submission
            // This will call testSession.completeSurvey() which handles the flow:
            // - If more patterns: starts next trial
            // - If last pattern: calls completeSession() -> shows "Session Complete" screen
            if (window.currentTrialTagsSurvey) {
                window.currentTrialTagsSurvey.submit();
            }
        }
    }

    /**
     * Show survey phase
     * @param {Object} data - Phase data
     * @param {number} data.patternNumber - Current pattern number
     * @param {number} data.totalPatterns - Total number of patterns
     * @param {Object} data.pattern - Pattern file object
     */
    showSurvey(data) {
        this.currentPhase = 'survey';
        this.show();
        this.stopCountdown();

        // Check if this is the last pattern
        const isLastPattern = data.patternNumber >= data.totalPatterns;
        this.showNextButton(true, isLastPattern); // Show NEXT or FINISH button

        // Show ABORT button during active phases
        if (this.abortButton) {
            this.abortButton.style.display = 'block';
        }

        // Clear any existing survey instance
        if (window.currentTrialTagsSurvey) {
            try {
                window.currentTrialTagsSurvey.reset();
            } catch (e) {
                // Ignore errors
            }
        }

        // Survey will be rendered by TrialTagsSurvey component
        // This overlay just provides the container
        this.contentContainer.innerHTML = `
            <div class="test-execution-overlay__phase test-execution-overlay__phase--survey">
                <div class="test-execution-overlay__survey-container" id="surveyContainer">
                    <!-- Survey will be rendered here by TrialTagsSurvey component -->
                </div>
            </div>
        `;
    }

    /**
     * Show session complete
     */
    showComplete() {
        this.currentPhase = 'complete';
        this.show();
        this.stopCountdown();
        this.showNextButton(false); // Hide NEXT on complete screen
        // Hide ABORT button on complete screen
        if (this.abortButton) {
            this.abortButton.style.display = 'none';
        }

        this.contentContainer.innerHTML = `
            <div class="test-execution-overlay__phase test-execution-overlay__phase--complete">
                <div class="test-execution-overlay__complete-content">
                    <div class="test-execution-overlay__complete-title">Session Complete</div>
                    <div class="test-execution-overlay__complete-message">
                        All patterns have been completed successfully.
                    </div>
                    <button class="test-execution-overlay__close-btn" id="completeCloseBtn">
                        Return to Setup
                    </button>
                </div>
            </div>
        `;

        const closeBtn = document.getElementById('completeCloseBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hide();
                // Reload page to return to setup
                window.location.reload();
            });
        }
    }

    /**
     * Show aborted state
     */
    showAborted(reason = null) {
        this.currentPhase = 'aborted';
        this.show();
        this.stopCountdown();
        this.showNextButton(false); // Hide NEXT button
        // Hide ABORT button on aborted screen
        if (this.abortButton) {
            this.abortButton.style.display = 'none';
        }

        const abortMessage = reason
            ? `The session has been aborted. ${reason}`
            : 'The session has been aborted. Partial data may have been saved.';

        this.contentContainer.innerHTML = `
            <div class="test-execution-overlay__phase test-execution-overlay__phase--aborted">
                <div class="test-execution-overlay__aborted-content">
                    <div class="test-execution-overlay__aborted-title">Session Aborted</div>
                    <div class="test-execution-overlay__aborted-message">
                        ${abortMessage}
                    </div>
                    <button class="test-execution-overlay__close-btn" id="abortedCloseBtn">
                        Return to Setup
                    </button>
                </div>
            </div>
        `;

        const closeBtn = document.getElementById('abortedCloseBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hide();
                // Reload page to return to setup
                window.location.reload();
            });
        }
    }

    /**
     * Start countdown timer
     * @param {number} duration - Duration in seconds
     * @param {Function} onComplete - Callback when countdown completes
     */
    startCountdown(duration, onComplete) {
        this.stopCountdown();
        this.countdown = duration;

        const updateCountdown = () => {
            const countdownEl = this.contentContainer.querySelector('.test-execution-overlay__countdown');
            if (countdownEl) {
                countdownEl.textContent = this.countdown;
                
                // Add urgency classes for visual feedback
                countdownEl.classList.remove('urgent', 'critical');
                if (this.countdown <= 5) {
                    countdownEl.classList.add('critical');
                } else if (this.countdown <= 10) {
                    countdownEl.classList.add('urgent');
                }
            }

            if (this.countdown <= 0) {
                this.stopCountdown();
                if (onComplete) {
                    onComplete();
                }
            } else {
                this.countdown--;
            }
        };

        // Update immediately
        updateCountdown();

        // Then update every second
        this.countdownInterval = setInterval(updateCountdown, 1000);
    }

    /**
     * Stop countdown timer
     */
    stopCountdown() {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        this.countdown = 0;
    }

    /**
     * Update countdown display (for external control)
     * @param {number} seconds - Remaining seconds
     */
    updateCountdown(seconds) {
        this.countdown = seconds;
        const countdownEl = this.contentContainer.querySelector('.test-execution-overlay__countdown');
        if (countdownEl) {
            countdownEl.textContent = seconds;
        }
    }

    /**
     * Update calibration gate status text (e.g. "2/4 good, need 3")
     * @param {Object} gate
     * @param {boolean} gate.pass
     * @param {number} gate.goodChannels
     * @param {number} gate.totalChannels
     * @param {number} gate.requiredGoodChannels
     * @param {number} gate.requiredChannels
     */
    updateCalibrationGateStatus(gate = {}) {
        if (this.currentPhase !== 'calibration') {
            return;
        }

        const gateStatusEl = this.contentContainer.querySelector('#calibrationGateStatus');
        if (!gateStatusEl) {
            return;
        }

        const requiredChannels = Number(gate.requiredChannels) || this.calibrationRequiredChannels || 4;
        const requiredGoodChannels = Number(gate.requiredGoodChannels) || this.calibrationRequiredGoodChannels || 3;
        const totalChannels = Number(gate.totalChannels) || 0;
        const goodChannels = Number(gate.goodChannels) || 0;
        const hasFullReading = totalChannels >= requiredChannels;
        const isReady = Boolean(gate.pass);

        gateStatusEl.classList.remove('test-execution-overlay__calibration-gate--ready');
        gateStatusEl.classList.remove('test-execution-overlay__calibration-gate--waiting');

        if (!hasFullReading) {
            gateStatusEl.textContent = `Reading channels... (${totalChannels}/${requiredChannels} available)`;
            gateStatusEl.classList.add('test-execution-overlay__calibration-gate--waiting');
            return;
        }

        if (isReady) {
            gateStatusEl.textContent = `Ready: ${goodChannels}/${requiredChannels} channels are good. Press Start Test to continue.`;
            gateStatusEl.classList.add('test-execution-overlay__calibration-gate--ready');
            const manualStartBtn = this.contentContainer.querySelector('#calibrationManualStartBtn');
            if (manualStartBtn) {
                manualStartBtn.disabled = false;
            }
            return;
        }

        gateStatusEl.textContent = `${goodChannels}/${requiredChannels} channels are good (need ${requiredGoodChannels}/${requiredChannels})`;
        gateStatusEl.classList.add('test-execution-overlay__calibration-gate--waiting');
    }

    /**
     * Mark calibration as manually started.
     */
    setCalibrationGateReadyManually() {
        if (this.currentPhase !== 'calibration') {
            return;
        }

        const gateStatusEl = this.contentContainer.querySelector('#calibrationGateStatus');
        if (gateStatusEl) {
            gateStatusEl.textContent = 'Manual start selected. Starting test...';
            gateStatusEl.classList.remove('test-execution-overlay__calibration-gate--waiting');
            gateStatusEl.classList.add('test-execution-overlay__calibration-gate--ready');
        }

        const manualStartBtn = this.contentContainer.querySelector('#calibrationManualStartBtn');
        if (manualStartBtn) {
            manualStartBtn.disabled = true;
        }
    }

    /**
     * Get calibration widget slot for mounting SignalQualityVisualizer.
     * @returns {HTMLElement|null}
     */
    getCalibrationWidgetContainer() {
        return document.getElementById('calibrationWidgetContainer');
    }

    /**
     * Get survey container element
     * @returns {HTMLElement|null}
     */
    getSurveyContainer() {
        return document.getElementById('surveyContainer');
    }
}
