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
     * @param {Function} [options.onPlayCalibrationTest] - Callback to play a short (~2s) calibration sound sample: () => void
     */
    constructor(options = {}) {
        this.containerId = options.containerId || 'testExecutionOverlay';
        this.container = document.getElementById(this.containerId);
        this.onAbort = options.onAbort || null;
        this.onManualStartCalibration = options.onManualStartCalibration || null;
        this.onPlayCalibrationTest = options.onPlayCalibrationTest || null;
        this.onAddTesterNote = options.onAddTesterNote || null;
        this.onAddTesterEvent = options.onAddTesterEvent || null;

        // State
        this.isVisible = false;
        this.currentPhase = null;
        this.countdown = 0;
        this.countdownInterval = null;
        this.testerSignal = { label: 'Signal: --', tone: 'neutral' };
        this.testerMetrics = { completedTrials: 0, totalTrials: 0, markerCount: 0 };
        this.testerPanelCollapsed = false;
        this.liveSignalBuffer = [];
        this.liveSignalBufferMax = 80;
        this.lastMarkerLabel = null;

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

        // Tester info bar (for experimenter; subject does not see screen)
        this.testerBar = document.createElement('div');
        this.testerBar.className = 'test-execution-overlay__tester-bar';
        this.testerBar.setAttribute('aria-label', 'Tester information');
        this.testerBar.innerHTML = `
            <div class="test-execution-overlay__tester-section">
                <div class="test-execution-overlay__tester-progress-row">
                    <div class="test-execution-overlay__tester-step" id="testerStepLabel"></div>
                    <div class="test-execution-overlay__tester-progress-meta" id="testerProgressMeta"></div>
                </div>
                <div class="test-execution-overlay__tester-step-progress" id="testerStepProgress"></div>
                <div class="test-execution-overlay__tester-trial-meta">
                    <span class="test-execution-overlay__trial-badge" id="testerTrialBadge"></span>
                </div>
                <div class="test-execution-overlay__tester-eta" id="testerEta">ETA remaining: --:--</div>
                <div class="test-execution-overlay__tester-trial-rail" id="testerTrialRail"></div>
                <div class="test-execution-overlay__tester-phase-sequence" id="testerPhaseSequence"></div>
                <div class="test-execution-overlay__tester-next" id="testerNextStep"></div>
                <div class="test-execution-overlay__tester-instruction" id="testerInstruction"></div>
            </div>

            <div class="test-execution-overlay__tester-section">
                <div class="test-execution-overlay__tester-section-title">Note Taking</div>
                <div class="test-execution-overlay__tester-markers" id="testerMarkers">
                    <button type="button" data-marker="movement">Mark Movement</button>
                    <button type="button" data-marker="noise">Mark Noise</button>
                    <button type="button" data-marker="distraction">Mark Distraction</button>
                </div>
                <div class="test-execution-overlay__tester-note-row">
                    <input id="testerNoteInput" type="text" maxlength="200" placeholder="Add tester note..." />
                    <button type="button" id="testerNoteAddBtn">Add</button>
                </div>
            </div>

            <div class="test-execution-overlay__tester-section">
                <div class="test-execution-overlay__tester-section-title">BCI Telemetry</div>
                <div class="test-execution-overlay__tester-signal" id="testerSignalBadge">Signal: --</div>
                <div class="test-execution-overlay__tester-metrics" id="testerMetrics"></div>
                <canvas class="test-execution-overlay__tester-live-canvas" id="testerLiveSignalCanvas" width="360" height="96" aria-label="Live BCI trend"></canvas>
                <div class="test-execution-overlay__tester-telemetry-slot" id="testerTelemetryContainer"></div>
            </div>

            <div class="test-execution-overlay__tester-footer" id="testerFooterActions"></div>
        `;
        this.container.appendChild(this.testerBar);
        this.bindTesterPanelEvents();
        this.testerPanelToggle = document.createElement('button');
        this.testerPanelToggle.className = 'test-execution-overlay__tester-toggle-btn';
        this.testerPanelToggle.type = 'button';
        this.testerPanelToggle.textContent = '❯';
        this.testerPanelToggle.setAttribute('aria-expanded', 'true');
        this.testerPanelToggle.addEventListener('click', () => {
            this.setTesterPanelCollapsed(!this.testerPanelCollapsed);
        });
        this.container.appendChild(this.testerPanelToggle);
        requestAnimationFrame(() => {
            this.drawLiveSignalSparkline();
        });

        // Create top-right button container
        this.topRightButtons = document.createElement('div');
        this.topRightButtons.className = 'test-execution-overlay__top-right-buttons';
        this.container.appendChild(this.topRightButtons);

        // Create abort button (now in tester panel footer)
        this.abortButton = document.createElement('button');
        this.abortButton.className = 'test-execution-overlay__abort-btn';
        this.abortButton.textContent = 'ABORT';
        this.abortButton.addEventListener('click', () => {
            if (this.onAbort) {
                this.onAbort();
            }
        });
        const testerFooterActions = this.testerBar.querySelector('#testerFooterActions');
        if (testerFooterActions) {
            testerFooterActions.appendChild(this.abortButton);
        }

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
     * Update tester info bar (for experimenter; subject does not see screen).
     * @param {string} stepLabel - Current step e.g. "Calibration" or "Trial 2 of 5 · Baseline"
     * @param {string} nextStep - What comes next e.g. "Stimulation (30s)" or "Select tags then Next"
     * @param {string} instruction - Short instruction for tester
     */
    updateTesterBar(stepLabel, nextStep, instruction, progress = null) {
        if (!this.testerBar) return;
        const stepEl = this.testerBar.querySelector('#testerStepLabel');
        const progressMetaEl = this.testerBar.querySelector('#testerProgressMeta');
        const trialBadgeEl = this.testerBar.querySelector('#testerTrialBadge');
        const etaEl = this.testerBar.querySelector('#testerEta');
        const nextEl = this.testerBar.querySelector('#testerNextStep');
        const instEl = this.testerBar.querySelector('#testerInstruction');
        if (stepEl) stepEl.textContent = stepLabel;
        if (this.testerBar) {
            this.testerBar.classList.toggle('test-execution-overlay__tester-bar--compact', Boolean(progress?.compactMode));
        }
        if (progressMetaEl) {
            const stepIndex = progress?.stepIndex || null;
            const totalSteps = progress?.totalSteps || null;
            progressMetaEl.textContent = stepIndex && totalSteps
                ? `Step ${stepIndex}/${totalSteps}`
                : '';
        }
        if (trialBadgeEl) {
            const trialNumber = progress?.trialNumber || '-';
            const totalTrials = progress?.totalTrials || '-';
            trialBadgeEl.textContent = `Trial ${trialNumber}/${totalTrials}`;
        }
        if (etaEl) {
            etaEl.textContent = `ETA remaining: ${progress?.estimatedRemainingLabel || '--:--'}`;
        }
        if (nextEl) nextEl.textContent = nextStep ? `Next: ${nextStep}` : '';
        if (instEl) instEl.textContent = instruction || '';
        const stepProgressEl = this.testerBar.querySelector('#testerStepProgress');
        if (stepProgressEl) {
            const stepIndex = Number(progress?.stepIndex) || 0;
            const totalSteps = Number(progress?.totalSteps) || 0;
            if (stepIndex > 0 && totalSteps > 0) {
                const pct = Math.max(0, Math.min(100, Math.round((stepIndex / totalSteps) * 100)));
                stepProgressEl.textContent = `Progress ${pct}%`;
            } else {
                stepProgressEl.textContent = '';
            }
        }
        this.renderTrialRail(progress);
        this.renderPhaseSequence(progress);
        this.showTesterBar();
    }

    /**
     * Render compact trial progression rail.
     * @param {Object|null} progress
     */
    renderTrialRail(progress) {
        const railEl = this.testerBar ? this.testerBar.querySelector('#testerTrialRail') : null;
        if (!railEl) return;
        const totalTrials = Number(progress?.totalTrials) || 0;
        const trialNumber = Number(progress?.trialNumber) || 0;
        if (totalTrials <= 0) {
            railEl.innerHTML = '';
            return;
        }
        const segments = [];
        for (let idx = 1; idx <= totalTrials; idx++) {
            let cls = 'pending';
            if (idx < trialNumber) cls = 'done';
            if (idx === trialNumber) cls = 'active';
            segments.push(`<span class="test-execution-overlay__trial-segment test-execution-overlay__trial-segment--${cls}" title="Trial ${idx}"></span>`);
        }
        const completed = Math.max(0, trialNumber - 1);
        railEl.innerHTML = `<div class="test-execution-overlay__trial-rail-label">Trials (${completed}/${totalTrials} complete)</div><div class="test-execution-overlay__trial-rail-track">${segments.join('')}</div>`;
    }

    /**
     * Render phase chips for current trial section.
     * @param {Object|null} progress
     */
    renderPhaseSequence(progress) {
        const sequenceEl = this.testerBar ? this.testerBar.querySelector('#testerPhaseSequence') : null;
        if (!sequenceEl) return;
        const sequence = Array.isArray(progress?.phaseSequence) ? progress.phaseSequence : [];
        if (sequence.length === 0) {
            sequenceEl.innerHTML = '';
            return;
        }
        const activeChipLabel = progress?.activePhaseChipLabel || '';
        const activeIndex = sequence.findIndex((item) => item.label === activeChipLabel);
        const chips = sequence.map((phaseItem, index) => {
            const isActive = phaseItem.label === activeChipLabel;
            const isDone = activeIndex > -1 && index < activeIndex;
            return `<span class="test-execution-overlay__phase-chip ${isDone ? 'test-execution-overlay__phase-chip--done' : ''} ${isActive ? 'test-execution-overlay__phase-chip--active' : ''}">${phaseItem.label}</span>`;
        });
        sequenceEl.innerHTML = `<div class="test-execution-overlay__phase-sequence-label">Current Trial</div><div class="test-execution-overlay__phase-chip-row">${chips.join('')}</div>`;
    }

    /**
     * Update tester panel signal quality chip.
     * @param {string} label
     * @param {string} tone
     */
    setTesterSignal(label, tone = 'neutral') {
        this.testerSignal = {
            label: label || 'Signal: --',
            tone: tone || 'neutral'
        };
        const signalEl = this.testerBar ? this.testerBar.querySelector('#testerSignalBadge') : null;
        if (!signalEl) return;
        signalEl.textContent = this.testerSignal.label;
        signalEl.classList.remove(
            'test-execution-overlay__tester-signal--good',
            'test-execution-overlay__tester-signal--ok',
            'test-execution-overlay__tester-signal--poor'
        );
        if (this.testerSignal.tone === 'good') signalEl.classList.add('test-execution-overlay__tester-signal--good');
        if (this.testerSignal.tone === 'ok') signalEl.classList.add('test-execution-overlay__tester-signal--ok');
        if (this.testerSignal.tone === 'poor') signalEl.classList.add('test-execution-overlay__tester-signal--poor');
    }

    /**
     * Update tester panel metrics block.
     * @param {Object} metrics
     */
    setTesterMetrics(metrics = {}) {
        this.testerMetrics = {
            ...this.testerMetrics,
            ...metrics
        };
        const metricsEl = this.testerBar ? this.testerBar.querySelector('#testerMetrics') : null;
        if (!metricsEl) return;
        const { completedTrials, totalTrials, markerCount } = this.testerMetrics;
        const markerLabel = this.lastMarkerLabel ? ` | Last marker: ${this.lastMarkerLabel}` : '';
        metricsEl.textContent = `Completed: ${completedTrials}/${totalTrials || 0} | Markers: ${markerCount || 0}${markerLabel}`;
    }

    /**
     * Wire tester note and marker interactions.
     */
    bindTesterPanelEvents() {
        if (!this.testerBar) return;
        const markersEl = this.testerBar.querySelector('#testerMarkers');
        const noteInput = this.testerBar.querySelector('#testerNoteInput');
        const noteBtn = this.testerBar.querySelector('#testerNoteAddBtn');

        if (markersEl) {
            markersEl.addEventListener('click', (event) => {
                const markerBtn = event.target.closest('button[data-marker]');
                if (!markerBtn || !this.onAddTesterEvent) return;
                const markerType = markerBtn.getAttribute('data-marker');
                this.lastMarkerLabel = markerType;
                markerBtn.classList.add('test-execution-overlay__tester-marker--pulse');
                setTimeout(() => markerBtn.classList.remove('test-execution-overlay__tester-marker--pulse'), 180);
                this.onAddTesterEvent(markerType);
                this.setTesterMetrics();
            });
        }

        const submitNote = () => {
            if (!this.onAddTesterNote || !noteInput) return;
            const text = noteInput.value.trim();
            if (!text) return;
            this.onAddTesterNote(text);
            noteInput.value = '';
        };

        if (noteBtn) {
            noteBtn.addEventListener('click', submitNote);
        }
        if (noteInput) {
            noteInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    submitNote();
                }
            });
        }
    }

    /**
     * Hide tester info bar (e.g. on complete/aborted screens).
     */
    hideTesterBar() {
        if (this.testerBar) {
            this.testerBar.classList.add('test-execution-overlay__tester-bar--hidden');
        }
        if (this.testerPanelToggle) {
            this.testerPanelToggle.classList.add('test-execution-overlay__tester-toggle-btn--hidden');
        }
        this.syncOverlayLayoutState();
    }

    /**
     * Show tester panel and toggle.
     */
    showTesterBar() {
        if (this.testerBar) {
            this.testerBar.classList.remove('test-execution-overlay__tester-bar--hidden');
        }
        if (this.testerPanelToggle) {
            this.testerPanelToggle.classList.remove('test-execution-overlay__tester-toggle-btn--hidden');
        }
        this.syncOverlayLayoutState();
        this.drawLiveSignalSparkline();
    }

    /**
     * Collapse or expand tester panel.
     * @param {boolean} collapsed
     */
    setTesterPanelCollapsed(collapsed) {
        this.testerPanelCollapsed = Boolean(collapsed);
        if (this.testerBar) {
            this.testerBar.classList.toggle('test-execution-overlay__tester-bar--collapsed', this.testerPanelCollapsed);
        }
        if (this.testerPanelToggle) {
            this.testerPanelToggle.textContent = this.testerPanelCollapsed ? '❮' : '❯';
            this.testerPanelToggle.setAttribute('aria-expanded', this.testerPanelCollapsed ? 'false' : 'true');
        }
        this.syncOverlayLayoutState();
    }

    /**
     * Explicitly hide/show tester panel by phase.
     * @param {boolean} visible
     */
    setTesterPanelVisible(visible) {
        if (visible) {
            this.showTesterBar();
            return;
        }
        this.hideTesterBar();
    }

    /**
     * Keep content offset in sync with tester panel visibility/collapse state.
     */
    syncOverlayLayoutState() {
        if (!this.container || !this.testerBar) return;
        const hidden = this.testerBar.classList.contains('test-execution-overlay__tester-bar--hidden');
        this.container.classList.toggle('test-execution-overlay--with-tester-panel', !hidden);
        this.container.classList.toggle('test-execution-overlay--with-collapsed-tester-panel', !hidden && this.testerPanelCollapsed);
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

        const goodN = this.calibrationRequiredGoodChannels;
        const totalN = this.calibrationRequiredChannels;
        this.contentContainer.innerHTML = `
            <div class="test-execution-overlay__phase test-execution-overlay__phase--calibration">
                <div class="test-execution-overlay__calibration-flightlist" aria-label="Pre-flight checklist">
                    <h2 class="test-execution-overlay__calibration-flightlist-title">Pre-flight checklist</h2>
                    <ol class="test-execution-overlay__calibration-checklist">
                        <li class="test-execution-overlay__calibration-checklist-item">Get the participant into the testing setup (Woojer vest, hat).</li>
                        <li class="test-execution-overlay__calibration-checklist-item">Ensure that the hat is secure on the participant. A good fit.</li>
                        <li class="test-execution-overlay__calibration-checklist-item">
                            <span>Test to make sure sound is working.</span>
                            <button type="button" class="test-execution-overlay__calibration-test-btn" id="calibrationTestSoundBtn">Test</button>
                        </li>
                        <li class="test-execution-overlay__calibration-checklist-item">Ask the participant if they feel anything when you click Test.</li>
                        <li class="test-execution-overlay__calibration-checklist-item">Start test when at least ${goodN} of ${totalN} channels are good and showing green. You can also manually start the test.</li>
                    </ol>
                    <div class="test-execution-overlay__calibration-widget-slot" id="calibrationWidgetContainer"></div>
                    <div class="test-execution-overlay__calibration-gate" id="calibrationGateStatus">Waiting for channel readings...</div>
                </div>
                <div class="test-execution-overlay__calibration-main">
                    <button type="button" class="test-execution-overlay__calibration-start-circle" id="calibrationManualStartBtn" aria-label="Start test">
                        <span class="test-execution-overlay__calibration-start-circle-text">Start Test</span>
                    </button>
                    <button type="button" class="test-execution-overlay__calibration-exit-btn" id="calibrationAbortBtn">Exit</button>
                </div>
            </div>
        `;

        const exitBtn = this.contentContainer.querySelector('#calibrationAbortBtn');
        if (exitBtn) {
            exitBtn.addEventListener('click', () => {
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

        const testSoundBtn = this.contentContainer.querySelector('#calibrationTestSoundBtn');
        if (testSoundBtn && this.onPlayCalibrationTest) {
            testSoundBtn.addEventListener('click', () => {
                this.onPlayCalibrationTest();
            });
        }

        this.updateCalibrationGateStatus({
            pass: false,
            goodChannels: 0,
            totalChannels: 0,
            requiredGoodChannels: this.calibrationRequiredGoodChannels,
            requiredChannels: this.calibrationRequiredChannels
        });

        this.hideTesterBar();
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
        this.setTesterPanelVisible(true);
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

        const duration = data.duration || 30;
        const displayPhase = data.progress?.displayPhase || (data.collectingData === false ? 'Rest' : 'Baseline');
        const baselineNextStep = data.progress?.nextStepLabel || `Stimulation (${duration}s)`;
        this.updateTesterBar(
            `Trial ${patternNumber} of ${totalPatterns} · ${displayPhase}`,
            baselineNextStep,
            'Subject at rest. No action needed.',
            data.progress
        );
        this.setTesterMetrics({ totalTrials: totalPatterns });
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
        this.setTesterPanelVisible(true);
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

        this.updateTesterBar(
            `Trial ${patternNumber} of ${totalPatterns} · ${data.progress?.displayPhase || 'Stimulate'}`,
            data.progress?.nextStepLabel || 'Survey (tag this trial, then Next or Finish)',
            'Audio playing. No action needed.',
            data.progress
        );
        this.setTesterMetrics({ totalTrials: totalPatterns });
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
        this.setTesterPanelVisible(true);
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

        const patternNumber = data.patternNumber || 1;
        const totalPatterns = data.totalPatterns || 1;
        const isLast = patternNumber >= totalPatterns;
        this.updateTesterBar(
            `Trial ${patternNumber} of ${totalPatterns} · ${data.progress?.displayPhase || 'Survey'}`,
            data.progress?.nextStepLabel || (isLast ? 'Finish session (click Finish)' : 'Next trial (click Next)'),
            'Complete the survey for this trial, then click Next or Finish.',
            data.progress
        );
        this.setTesterMetrics({ totalTrials: totalPatterns });
    }

    /**
     * Show session complete
     */
    showComplete() {
        this.currentPhase = 'complete';
        this.show();
        this.stopCountdown();
        this.hideTesterBar();
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
        this.hideTesterBar();
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

        const needMore = Math.max(0, requiredGoodChannels - goodChannels);
        gateStatusEl.textContent = `${goodChannels}/${requiredChannels} channels are good. Need ${needMore} more good channel${needMore === 1 ? '' : 's'} before recommended start.`;
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

    /**
     * Get tester telemetry mount container for BCI widget.
     * @returns {HTMLElement|null}
     */
    getTesterTelemetryContainer() {
        return document.getElementById('testerTelemetryContainer');
    }

    /**
     * Append a point to the lightweight live telemetry sparkline.
     * @param {Object} reading
     */
    pushLiveSignalReading(reading) {
        const value = this.getLiveSignalValue(reading);
        if (Number.isFinite(value)) {
            this.liveSignalBuffer.push(value);
            if (this.liveSignalBuffer.length > this.liveSignalBufferMax) {
                this.liveSignalBuffer.shift();
            }
        }
        this.drawLiveSignalSparkline();
    }

    /**
     * Convert reading object into a single scalar signal for trend drawing.
     * Uses alpha+beta absolute power when available, otherwise signal_quality.
     * @param {Object} reading
     * @returns {number|null}
     */
    getLiveSignalValue(reading) {
        if (!reading || typeof reading !== 'object') return null;
        const alpha = Number(reading.alpha_abs);
        const beta = Number(reading.beta_abs);
        if (Number.isFinite(alpha) && Number.isFinite(beta)) {
            return alpha + beta;
        }
        const signalQuality = Number(reading.signal_quality);
        if (Number.isFinite(signalQuality)) {
            return signalQuality;
        }
        return null;
    }

    /**
     * Draw sparkline inside telemetry canvas.
     */
    drawLiveSignalSparkline() {
        const canvas = this.testerBar ? this.testerBar.querySelector('#testerLiveSignalCanvas') : null;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Keep canvas internal resolution aligned with rendered size.
        const displayWidth = Math.max(120, Math.floor(canvas.clientWidth || canvas.width));
        const displayHeight = Math.max(72, Math.floor(canvas.clientHeight || canvas.height));
        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
            canvas.width = displayWidth;
            canvas.height = displayHeight;
        }

        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#fbfdff';
        ctx.fillRect(0, 0, width, height);

        // Grid baseline for easier trend reading.
        ctx.strokeStyle = '#e5ebf2';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, height - 1);
        ctx.lineTo(width, height - 1);
        ctx.stroke();

        if (this.liveSignalBuffer.length < 2) {
            ctx.fillStyle = '#7a8695';
            ctx.font = '12px sans-serif';
            ctx.fillText('Waiting for live telemetry...', 10, Math.floor(height / 2));
            return;
        }

        const min = Math.min(...this.liveSignalBuffer);
        const max = Math.max(...this.liveSignalBuffer);
        const range = Math.max(1e-6, max - min);

        ctx.strokeStyle = '#2b5f94';
        ctx.lineWidth = 2;
        ctx.beginPath();
        this.liveSignalBuffer.forEach((value, index) => {
            const x = (index / (this.liveSignalBuffer.length - 1)) * (width - 1);
            const normalized = (value - min) / range;
            const y = (height - 6) - (normalized * (height - 12));
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();
    }
}

// Expose for non-module script usage (testExecution.js)
if (typeof window !== 'undefined') {
    window.TestExecutionOverlay = TestExecutionOverlay;
}
