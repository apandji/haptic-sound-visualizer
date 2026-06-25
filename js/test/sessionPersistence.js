function isPersistableTrial(trial) {
            return Boolean(
                trial &&
                trial.status === 'completed' &&
                trial.startTime &&
                trial.endTime &&
                trial.surveyResponse &&
                typeof trial.surveyResponse === 'object'
            );
        }

        function getLatestPersistedTrialEndTime(trials) {
            const completedEndTimes = (trials || [])
                .map(trial => trial?.endTime)
                .filter(Boolean)
                .sort();

            return completedEndTimes.length > 0 ? completedEndTimes[completedEndTimes.length - 1] : null;
        }

        const CHECKPOINT_KEY = 'testSession_checkpoint';

        /** Snapshot in-progress session data so a tab crash doesn't lose completed trials. */
        function checkpointActiveSession() {
            if (!testSession || !testSession.isActive) return;
            try {
                const payload = typeof testSession.exportCheckpoint === 'function'
                    ? testSession.exportCheckpoint()
                    : testSession.getSessionData();
                localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(payload));
            } catch (error) {
                console.warn('Could not checkpoint active session:', error);
            }
        }

        function readSessionCheckpoint() {
            try {
                const raw = localStorage.getItem(CHECKPOINT_KEY);
                return raw ? JSON.parse(raw) : null;
            } catch (error) {
                console.warn('Could not read session checkpoint:', error);
                return null;
            }
        }

        function offerCheckpointRestoreIfPresent() {
            const checkpoint = readSessionCheckpoint();
            if (!checkpoint || !checkpoint.isActive || checkpoint.isAborted) return;

            const completed = (checkpoint.trials || []).filter(isPersistableTrial).length;
            const savedAt = checkpoint.savedAt
                ? new Date(checkpoint.savedAt).toLocaleString()
                : 'recently';

            const interruptedDuringSurvey = checkpoint.currentPhase === 'survey';
            const resumeHint = interruptedDuringSurvey
                ? 'Survey will continue for the current pattern.'
                : 'The current pattern will restart from baseline.';

            window.AppUI?.showBanner?.({
                type: 'warning',
                message: `Interrupted test session from ${savedAt} (${completed} completed trial${completed === 1 ? '' : 's'}). ${resumeHint}`,
                actionLabel: 'Resume',
                onAction: () => {
                    if (typeof window.resumeTestSessionFromCheckpoint === 'function') {
                        window.resumeTestSessionFromCheckpoint(checkpoint);
                    }
                },
                secondaryActionLabel: 'Discard',
                onSecondaryAction: clearSessionCheckpoint,
                onDismiss: clearSessionCheckpoint
            });
        }

        window.offerCheckpointRestoreIfPresent = offerCheckpointRestoreIfPresent;

        function clearSessionCheckpoint() {
            try {
                localStorage.removeItem(CHECKPOINT_KEY);
            } catch (error) {
                console.warn('Could not clear session checkpoint:', error);
            }
        }

        function buildPersistableSessionData(sessionData) {
            if (!sessionData) return null;

            const validTrials = (sessionData.trials || []).filter(isPersistableTrial);
            if (validTrials.length === 0) {
                return null;
            }

            return {
                ...(sessionData.sessionData || {}),
                sessionId: sessionData.sessionId,
                trials: validTrials,
                calibrationReadings: [],
                isAborted: sessionData.isAborted,
                abortReason: sessionData.abortReason,
                completedAt: sessionData.completedAt || getLatestPersistedTrialEndTime(validTrials),
                startedAt: sessionData.sessionData?.startedAt || new Date().toISOString()
            };
        }

        async function saveSessionData() {
            if (!testSession) return;

            const sessionData = testSession.getSessionData();
            const fullSessionData = buildPersistableSessionData(sessionData);

            if (!fullSessionData) {
                showDatabaseSaveMessage(
                    'No completed trials with participant feedback to save.',
                    'warning'
                );
                return;
            }

            // Save to localStorage (backup)
            try {
                const sessions = JSON.parse(localStorage.getItem('sessions') || '[]');
                sessions.push(fullSessionData);
                localStorage.setItem('sessions', JSON.stringify(sessions));
                console.log('Session data saved to localStorage');
            } catch (error) {
                console.error('Error saving session to localStorage:', error);
            }

            // Save to database via API
            try {
                const response = await fetch('/api/session', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(fullSessionData)
                });

                const result = await response.json();

                if (result.success) {
                    console.log('Session saved to database:', result);
                    clearSessionCheckpoint();
                    showDatabaseSaveMessage(
                        `Session saved to database (ID: ${result.session_id})`,
                        'success',
                        result
                    );
                } else {
                    console.error('Database save failed:', result);
                    showDatabaseSaveMessage(
                        'Failed to save to database. Data saved locally.',
                        'error',
                        result
                    );
                }
            } catch (error) {
                console.error('Error saving to database:', error);
                showDatabaseSaveMessage(
                    'Could not connect to server. Data saved locally.',
                    'warning'
                );
            }

            // Enable export button
            if (sessionInfo && sessionInfo.exportButton) {
                sessionInfo.exportButton.disabled = false;
            }
        }

        /**
         * Show database save status message
         */
        function showDatabaseSaveMessage(message, type, details = null) {
            let detailsText = '';
            if (details && type === 'success') {
                detailsText = `Trials: ${details.trials_saved}, Readings: ${details.readings_saved}, Responses: ${details.tags_saved}`;
            }

            const toastType = type === 'warning' ? 'warning' : type;
            window.AppUI?.showToast({
                id: 'dbSaveMessage',
                type: toastType,
                title: message,
                message: detailsText || undefined,
                duration: 5000,
            });
        }
        
        // Export sessions to JSON file
        function exportSessionsToJSON() {
            try {
                const sessions = JSON.parse(localStorage.getItem('sessions') || '[]');
                if (sessions.length === 0) {
                    showExportMessage('No sessions to export', 'error');
                    return;
                }
                
                const dataStr = JSON.stringify(sessions, null, 2);
                const dataBlob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(dataBlob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `sessions_${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                
                showExportMessage(`Exported ${sessions.length} session(s)`, 'success');
            } catch (error) {
                console.error('Error exporting sessions:', error);
                showExportMessage('Error exporting sessions', 'error');
            }
        }
        
        // Show export message
        function showExportMessage(message, type) {
            window.AppUI?.showToast({
                id: 'exportMessage',
                type,
                title: message,
                duration: 3000,
            });
        }
        
        // Show session start success message
        function showSessionStartMessage(sessionId, patternCount) {
            window.AppUI?.showToast({
                id: 'sessionStartMessage',
                type: 'success',
                title: `Session ${sessionId} started`,
                message: `${patternCount} ${patternCount === 1 ? 'pattern' : 'patterns'} in queue`,
                duration: 5000,
            });
        }
