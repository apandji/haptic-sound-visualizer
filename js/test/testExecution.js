// Test execution state
        let testSession = null;
        let testExecutionOverlay = null;
        let eegDataCollector = null;
        let trialTagsSurvey = null;
        let testAudioPlayer = null;
        let baselineTimer = null;
        let stimulationTimer = null;
        let calibrationTestTimeout = null;
        let calibrationPhaseCompleted = false;
        let completedTrialCount = 0;
        let testerMarkerCount = 0;
        let abortInProgress = false;
        const calibrationGateConfig = {
            requiredChannels: 4,
            requiredGoodChannels: 3
        };

        function getChannelQuality(metric) {
            if (!metric || typeof metric !== 'object') {
                return null;
            }

            if (typeof metric.quality === 'string') {
                return metric.quality.toLowerCase();
            }

            const rms_uV = Number(metric.rms_uV);
            if (!Number.isFinite(rms_uV)) {
                return null;
            }

            if (rms_uV >= 5.0 && rms_uV <= 100.0) {
                return 'good';
            }
            if (rms_uV > 100.0 && rms_uV <= 150.0) {
                return 'ok';
            }
            return 'poor';
        }

        function evaluateCalibrationReading(reading) {
            const evaluation = {
                pass: false,
                goodChannels: 0,
                totalChannels: 0,
                requiredGoodChannels: calibrationGateConfig.requiredGoodChannels,
                requiredChannels: calibrationGateConfig.requiredChannels
            };

            if (!reading || typeof reading !== 'object') {
                return evaluation;
            }

            const channelMetrics = Array.isArray(reading.channel_metrics) ? reading.channel_metrics : [];
            const normalizedChannels = channelMetrics
                .filter((metric) => metric && typeof metric === 'object')
                .sort((a, b) => Number(a.channel_index) - Number(b.channel_index))
                .slice(0, calibrationGateConfig.requiredChannels);

            evaluation.totalChannels = normalizedChannels.length;
            evaluation.goodChannels = normalizedChannels.reduce((count, metric) => {
                return getChannelQuality(metric) === 'good' ? count + 1 : count;
            }, 0);

            evaluation.pass = (
                evaluation.totalChannels >= calibrationGateConfig.requiredChannels &&
                evaluation.goodChannels >= calibrationGateConfig.requiredGoodChannels
            );

            return evaluation;
        }

        function undockSignalQualityWidget() {
            if (!signalQualityVisualizer) {
                return;
            }
            signalQualityVisualizer.setEmbeddedMode(false);
            signalQualityVisualizer.mountTo(document.body);
            signalQualityVisualizer.collapse();
        }

        function dockSignalQualityWidgetInCalibration() {
            if (!signalQualityVisualizer || !testExecutionOverlay) {
                return;
            }

            const widgetHost = testExecutionOverlay.getCalibrationWidgetContainer();
            if (!widgetHost) {
                return;
            }

            signalQualityVisualizer.mountTo(widgetHost);
            signalQualityVisualizer.setEmbeddedMode(true);
            signalQualityVisualizer.show();
            signalQualityVisualizer.expand();
        }

        function dockSignalQualityWidgetInTesterPanel() {
            if (!signalQualityVisualizer || !testExecutionOverlay) {
                return;
            }
            const telemetryHost = testExecutionOverlay.getTesterTelemetryContainer();
            if (!telemetryHost) {
                return;
            }
            signalQualityVisualizer.mountTo(telemetryHost);
            signalQualityVisualizer.setEmbeddedMode(true);
            signalQualityVisualizer.show();
            signalQualityVisualizer.expand();
        }

        function updateCalibrationGateFromReading(reading) {
            if (!testSession || testSession.currentPhase !== 'calibration' || calibrationPhaseCompleted) {
                return;
            }

            const gate = evaluateCalibrationReading(reading);
            if (testExecutionOverlay) {
                testExecutionOverlay.updateCalibrationGateStatus(gate);
            }
        }

        function updateTesterSignalFromReading(reading) {
            if (!testExecutionOverlay) {
                return;
            }
            const channelMetrics = Array.isArray(reading?.channel_metrics) ? reading.channel_metrics : [];
            const normalizedChannels = channelMetrics
                .filter((metric) => metric && typeof metric === 'object')
                .sort((a, b) => Number(a.channel_index) - Number(b.channel_index))
                .slice(0, calibrationGateConfig.requiredChannels);

            if (normalizedChannels.length === 0) {
                testExecutionOverlay.setTesterSignal('Signal: waiting for channels', 'neutral');
                return;
            }

            const goodChannels = normalizedChannels.reduce((count, metric) => {
                return getChannelQuality(metric) === 'good' ? count + 1 : count;
            }, 0);
            const ratio = goodChannels / calibrationGateConfig.requiredChannels;
            const tone = ratio >= 0.75 ? 'good' : ratio >= 0.5 ? 'ok' : 'poor';
            testExecutionOverlay.setTesterSignal(
                `Signal: ${goodChannels}/${calibrationGateConfig.requiredChannels} channels good`,
                tone
            );
        }

        function handleManualCalibrationStart() {
            if (!testSession || testSession.currentPhase !== 'calibration' || calibrationPhaseCompleted) {
                return;
            }

            calibrationPhaseCompleted = true;
            if (testExecutionOverlay) {
                testExecutionOverlay.setCalibrationGateReadyManually();
            }
            testSession.completeCalibration();
        }

        // Handle session start - now starts test execution flow
        function handleSessionStart(sessionData) {
            // Get queue items
            const queueItems = queue ? queue.getItems() : [];
            
            if (queueItems.length === 0) {
                console.error('Cannot start session: queue is empty');
                return;
            }

            // Stop any preview audio
            if (audioPlayerInstance) {
                audioPlayerInstance.stop();
            }
            pauseAudioPlayback();

            // Initialize test execution components
            initializeTestExecution(sessionData, queueItems);
        }

        /**
         * Initialize test execution flow
         */
        function initializeTestExecution(sessionData, queueItems) {
            abortInProgress = false;
            // Get participant and location details from sessionInfo
            const participant = sessionInfo.participants.find(p => p.participant_id === sessionData.data.participant_id);
            const location = sessionInfo.locations.find(l => l.location_id === sessionData.data.location_id);

            // Prepare full session data structure
            const fullSessionData = {
                sessionId: sessionData.sessionId,
                // Session fields
                participant_id: sessionData.data.participant_id,
                location_id: sessionData.data.location_id,
                equipment_info: sessionData.data.equipment_info || '',
                experimenter: sessionData.data.experimenter || '',
                notes: sessionData.data.notes || '',
                // Participant details (for database)
                participant_code: participant?.participant_code || `P${sessionData.data.participant_id}`,
                participant_age: participant?.age || null,
                participant_gender: participant?.gender || null,
                participant_handedness: participant?.handedness || null,
                participant_notes: participant?.notes || null,
                // Location details
                location_name: location?.name || `Location ${sessionData.data.location_id}`,
                // Timestamps
                startedAt: new Date().toISOString(),
                // Queue info
                queueItems: queueItems.map((item, index) => ({
                    name: item.name,
                    path: item.path,
                    order: index + 1
                })),
                queueItemCount: queueItems.length,
                // Browser/screen info (metadata, not for equipment_info)
                browserInfo: {
                    userAgent: navigator.userAgent,
                    platform: navigator.platform,
                    language: navigator.language
                },
                screenInfo: {
                    width: screen.width,
                    height: screen.height,
                    availWidth: screen.availWidth,
                    availHeight: screen.availHeight
                }
            };

            // Create TestSession
            testSession = new TestSession({
                sessionId: sessionData.sessionId,
                queue: queueItems,
                sessionData: fullSessionData,
                onPhaseChange: handlePhaseChange,
                onTrialComplete: handleTrialComplete,
                onSessionComplete: handleSessionComplete,
                onError: handleTestError
            });

            // Create TestExecutionOverlay (requires testExecutionOverlay.js to load before this script in test.html)
            if (typeof window.TestExecutionOverlay === 'undefined') {
                console.error('TestExecutionOverlay not loaded. Ensure js/components/base/testExecutionOverlay.js is loaded before js/test/testExecution.js in test.html.');
                if (typeof sessionInfo !== 'undefined') {
                    sessionInfo.isSessionStarted = false;
                    if (sessionInfo.updateStartButton) sessionInfo.updateStartButton();
                    if (sessionInfo.showValidationError) {
                        sessionInfo.showValidationError('Cannot start test: overlay script failed to load. Refresh the page or check the browser console.');
                    }
                }
                return;
            }
            testExecutionOverlay = new window.TestExecutionOverlay({
                containerId: 'testExecutionOverlay',
                onAbort: handleTestAbort,
                onManualStartCalibration: handleManualCalibrationStart,
                onPlayCalibrationTest: playCalibrationTestSample,
                onAddTesterNote: handleTesterNoteAdded,
                onAddTesterEvent: handleTesterEventAdded
            });

            // Create EEGDataCollector
            eegDataCollector = new EEGDataCollector({
                wsUrl: 'ws://localhost:8765',
                onReading: (reading) => {
                    if (testSession) {
                        testSession.addReading(reading);
                    }
                    if (testExecutionOverlay) {
                        testExecutionOverlay.pushLiveSignalReading(reading);
                    }
                    if (signalQualityVisualizer) {
                        signalQualityVisualizer.ingestReading(reading);
                    }
                    updateCalibrationGateFromReading(reading);
                    updateTesterSignalFromReading(reading);
                },
                onConnectionChange: (state, previousState) => {
                    console.log('EEG connection:', previousState, '→', state);
                    if (!signalQualityVisualizer) {
                        return;
                    }
                    if (state === 'connected') {
                        if (signalQualityVisualizer.getConnectionState() !== 'streaming') {
                            signalQualityVisualizer.start();
                        }
                    } else {
                        signalQualityVisualizer.clearLiveReading();
                        signalQualityVisualizer.stop();
                    }
                }
            });

            // Create test audio player (separate from preview player)
            testAudioPlayer = new AudioPlayer({
                loadSoundFn: window.loadSoundFn,
                defaultLoop: true,
                onEnd: () => {
                    // Update survey play button state if survey is active
                    if (window.currentTrialTagsSurvey) {
                        window.currentTrialTagsSurvey.setPlayingState(false);
                    }
                },
                onStop: () => {
                    // Update survey play button state if survey is active
                    if (window.currentTrialTagsSurvey) {
                        window.currentTrialTagsSurvey.setPlayingState(false);
                    }
                }
            });

            // Start the session
            testSession.start();
        }

        /**
         * Handle phase changes from TestSession
         */
        function handlePhaseChange(phase, data) {
            console.log('Phase change:', phase, data);

            // Stop any existing timers
            clearTimers();

            // Stop audio if needed
            if (phase !== 'survey' && testAudioPlayer && testAudioPlayer.isPlaying()) {
                testAudioPlayer.stop();
            }

            // Stop EEG collection during transitions
            if (eegDataCollector && eegDataCollector.isActive()) {
                eegDataCollector.stop();
            }

            if (phase !== 'calibration') {
                undockSignalQualityWidget();
            }

            switch (phase) {
                case 'calibration':
                    calibrationPhaseCompleted = false;
                    testExecutionOverlay.showCalibration({
                        ...data,
                        requiredChannels: calibrationGateConfig.requiredChannels,
                        requiredGoodChannels: calibrationGateConfig.requiredGoodChannels,
                        totalPatterns: testSession && testSession.trials ? testSession.trials.length : 0
                    });
                    dockSignalQualityWidgetInCalibration();
                    eegDataCollector.start();
                    break;

                case 'baseline':
                    testExecutionOverlay.showBaseline(data);
                    dockSignalQualityWidgetInTesterPanel();
                    testExecutionOverlay.setTesterMetrics({
                        completedTrials: completedTrialCount,
                        totalTrials: data.totalPatterns || 0,
                        markerCount: testerMarkerCount
                    });
                    eegDataCollector.start();
                    // Start baseline timer
                    baselineTimer = setTimeout(() => {
                        testSession.completeBaseline();
                    }, data.duration * 1000);
                    break;

                case 'stimulation':
                    testExecutionOverlay.showStimulation(data);
                    dockSignalQualityWidgetInTesterPanel();
                    testExecutionOverlay.setTesterMetrics({
                        completedTrials: completedTrialCount,
                        totalTrials: data.totalPatterns || 0,
                        markerCount: testerMarkerCount
                    });
                    eegDataCollector.start();
                    // Load and play audio
                    playTestAudio(data.pattern, () => {
                        // Audio started - record offset
                        testSession.recordAudioStart();
                    });
                    // Start stimulation timer
                    stimulationTimer = setTimeout(() => {
                        testSession.completeStimulation();
                    }, data.duration * 1000);
                    break;

                case 'survey':
                    testExecutionOverlay.showSurvey(data);
                    dockSignalQualityWidgetInTesterPanel();
                    testExecutionOverlay.setTesterMetrics({
                        completedTrials: completedTrialCount,
                        totalTrials: data.totalPatterns || 0,
                        markerCount: testerMarkerCount
                    });
                    // Initialize survey component
                    const surveyContainer = testExecutionOverlay.getSurveyContainer();
                    if (surveyContainer) {
                        // Store reference globally so we can clear it later
                        window.currentTrialTagsSurvey = new TrialTagsSurvey({
                            container: surveyContainer,
                            pattern: data.pattern,
                            onPlayAudio: (pattern) => {
                                // Stop any currently playing audio first
                                if (testAudioPlayer && testAudioPlayer.isPlaying()) {
                                    testAudioPlayer.stop();
                                    if (window.currentTrialTagsSurvey) {
                                        window.currentTrialTagsSurvey.setPlayingState(false);
                                    }
                                }
                                // Play audio using test audio player
                                playTestAudio(pattern, () => {
                                    console.log('Audio playing for survey preview');
                                    if (window.currentTrialTagsSurvey) {
                                        window.currentTrialTagsSurvey.setPlayingState(true);
                                    }
                                });
                            },
                            onPauseAudio: () => {
                                // Stop audio when pause is clicked
                                if (testAudioPlayer && testAudioPlayer.isPlaying()) {
                                    testAudioPlayer.stop();
                                }
                            },
                            onComplete: (surveyData) => {
                                // Stop audio when survey is completed
                                if (testAudioPlayer && testAudioPlayer.isPlaying()) {
                                    testAudioPlayer.stop();
                                }
                                testSession.completeSurvey(surveyData);
                                // Clear survey reference after completion
                                window.currentTrialTagsSurvey = null;
                            }
                        });
                        trialTagsSurvey = window.currentTrialTagsSurvey;
                        if (window.currentTrialTagsSurvey && testAudioPlayer && testAudioPlayer.isPlaying()) {
                            window.currentTrialTagsSurvey.setPlayingState(true);
                        }
                        
                        // Connect survey to overlay's NEXT button
                        const overlayNextBtn = document.querySelector('.test-execution-overlay__next-btn');
                        if (overlayNextBtn && window.currentTrialTagsSurvey) {
                            window.currentTrialTagsSurvey.setOverlayNextButton(overlayNextBtn);
                        }
                        
                        // Listen for audio end to update button state
                        if (testAudioPlayer) {
                            // Store original onEnd callback
                            const originalOnEnd = testAudioPlayer.onEnd;
                            testAudioPlayer.onEnd = () => {
                                if (originalOnEnd) originalOnEnd();
                                if (window.currentTrialTagsSurvey) {
                                    window.currentTrialTagsSurvey.setPlayingState(false);
                                }
                            };
                        }
                    }
                    break;

                // Pattern-complete phase removed - survey now goes directly to next pattern

                case 'complete':
                    testExecutionOverlay.showComplete();
                    saveSessionData();
                    break;

                case 'aborted':
                    testExecutionOverlay.showAborted(data?.reason);
                    saveSessionData();
                    break;
            }
        }

        /**
         * Play audio for test stimulation phase
         */
        function playTestAudio(pattern, onStart) {
            if (!testAudioPlayer || !window.loadSoundFn) {
                console.error('Test audio player not initialized');
                return;
            }

            // Get pattern duration from metadata
            const patternMeta = patternMetadata[pattern.name] || {};
            const duration = patternMeta.duration || 0; // in seconds

            // Load and play audio
            testAudioPlayer.loadFile(pattern.path).then(() => {
                // Determine if we need looping or fade-out
                if (duration < 30) {
                    // Pattern < 30s: loop seamlessly
                    testAudioPlayer.setLoop(true);
                } else {
                    // Pattern > 30s: will fade out at 25s, cut at 30s
                    testAudioPlayer.setLoop(false);
                    // TODO: Implement fade-out logic
                }

                // Start audio context if needed
                if (window.p5Instance) {
                    window.p5Instance.userStartAudio();
                }

                // Play with a small delay to ensure readiness
                setTimeout(() => {
                    testAudioPlayer.play();
                    if (onStart) {
                        onStart();
                    }
                }, 100);
            }).catch(error => {
                console.error('Error loading test audio:', error);
                // Retry logic could go here
            });
        }

        // Pattern complete checkpoint removed - survey now goes directly to next pattern

        /**
         * Handle trial complete
         */
        function handleTrialComplete(trialData) {
            console.log('Trial complete:', trialData);
            completedTrialCount += 1;
            if (testExecutionOverlay && testSession) {
                testExecutionOverlay.setTesterMetrics({
                    completedTrials: completedTrialCount,
                    totalTrials: testSession.trials.length,
                    markerCount: testerMarkerCount
                });
            }
            // Trial data is already stored in testSession
            // We'll save everything when session completes
        }

        function handleTesterNoteAdded(text) {
            if (!testSession || testSession.currentTrialIndex < 0) {
                return;
            }
            testSession.addTesterNote(testSession.currentTrialIndex, text, {
                phase: testSession.currentPhase
            });
        }

        function handleTesterEventAdded(eventType) {
            if (!testSession || testSession.currentTrialIndex < 0) {
                return;
            }
            testSession.addTesterEvent(testSession.currentTrialIndex, eventType, {
                phase: testSession.currentPhase
            });
            testerMarkerCount += 1;
            if (testExecutionOverlay && testSession) {
                testExecutionOverlay.setTesterMetrics({
                    completedTrials: completedTrialCount,
                    totalTrials: testSession.trials.length,
                    markerCount: testerMarkerCount
                });
            }
        }

        /**
         * Handle session complete
         */
        function handleSessionComplete(sessionData) {
            console.log('Session complete:', sessionData);
            saveSessionData();
            // Show the "Session Complete" screen
            if (testExecutionOverlay) {
                testExecutionOverlay.showComplete();
            }
        }

        /**
         * Handle test error
         */
        function handleTestError(error) {
            console.error('Test error:', error);
            // Could show error UI here
        }

        /**
         * Custom confirmation dialog (replaces browser confirm)
         */
        function showCustomConfirm(message, title = 'Confirm Action', confirmText = 'Confirm', cancelText = 'Cancel') {
            return new Promise((resolve) => {
                const overlay = document.getElementById('customConfirmOverlay');
                const titleEl = document.getElementById('customConfirmTitle');
                const messageEl = document.getElementById('customConfirmMessage');
                const confirmBtn = document.getElementById('customConfirmConfirm');
                const cancelBtn = document.getElementById('customConfirmCancel');
                
                // Set content
                titleEl.textContent = title;
                messageEl.textContent = message;
                confirmBtn.textContent = confirmText;
                cancelBtn.textContent = cancelText;
                
                // Show overlay
                overlay.classList.add('show');
                
                // Handle confirm
                const handleConfirm = () => {
                    overlay.classList.remove('show');
                    cleanup();
                    resolve(true);
                };
                
                // Handle cancel
                const handleCancel = () => {
                    overlay.classList.remove('show');
                    cleanup();
                    resolve(false);
                };
                
                // Handle escape key
                const handleEscape = (e) => {
                    if (e.key === 'Escape') {
                        handleCancel();
                    }
                };
                
                // Cleanup function
                const cleanup = () => {
                    confirmBtn.removeEventListener('click', handleConfirm);
                    cancelBtn.removeEventListener('click', handleCancel);
                    document.removeEventListener('keydown', handleEscape);
                };
                
                // Add event listeners
                confirmBtn.addEventListener('click', handleConfirm);
                cancelBtn.addEventListener('click', handleCancel);
                document.addEventListener('keydown', handleEscape);
            });
        }
        
        /**
         * Handle test abort
         */
        async function handleTestAbort() {
            if (abortInProgress) {
                return;
            }
            const currentPhase = testSession?.currentPhase || 'unknown phase';
            const trialLabel = testSession && testSession.currentTrialIndex >= 0
                ? `trial ${testSession.currentTrialIndex + 1}`
                : 'calibration';
            const confirmed = await showCustomConfirm(
                `Abort now during ${currentPhase} (${trialLabel})? Partial data will be saved.`,
                'Abort Session',
                'Abort',
                'Cancel'
            );

            if (!confirmed) {
                return;
            }

            if (currentPhase === 'stimulation') {
                const secondConfirm = await showCustomConfirm(
                    'Stimulation is active. Confirm abort to end the run immediately.',
                    'Confirm Immediate Abort',
                    'Abort Now',
                    'Go Back'
                );
                if (!secondConfirm) {
                    return;
                }
            }

            abortInProgress = true;
            const abortBtn = document.querySelector('.test-execution-overlay__abort-btn');
            if (abortBtn) {
                abortBtn.disabled = true;
                abortBtn.textContent = 'ABORTING...';
            }
            if (testSession) {
                testSession.abort('Manual abort by researcher.');
            }
            clearTimers();
            if (testAudioPlayer) {
                testAudioPlayer.stop();
            }
            if (eegDataCollector) {
                eegDataCollector.stop();
            }
        }

        /**
         * Clear all timers
         */
        function clearTimers() {
            if (baselineTimer) {
                clearTimeout(baselineTimer);
                baselineTimer = null;
            }
            if (stimulationTimer) {
                clearTimeout(stimulationTimer);
                stimulationTimer = null;
            }
            if (calibrationTestTimeout) {
                clearTimeout(calibrationTestTimeout);
                calibrationTestTimeout = null;
            }
        }

        /**
         * Play a short (~2s) calibration sound sample from the first queue item (for "Test" button).
         */
        function playCalibrationTestSample() {
            const items = queue ? queue.getItems() : [];
            if (items.length === 0 || !testAudioPlayer) {
                return;
            }
            const pattern = items[0];
            testAudioPlayer.loadFile(pattern.path).then(() => {
                testAudioPlayer.setLoop(false);
                if (window.p5Instance) {
                    window.p5Instance.userStartAudio();
                }
                testAudioPlayer.play();
                calibrationTestTimeout = setTimeout(() => {
                    testAudioPlayer.stop();
                    calibrationTestTimeout = null;
                }, 2000);
            }).catch(err => {
                console.warn('Calibration test sample failed to load:', err);
            });
        }

        /**
         * Save session data to localStorage and database
         */
