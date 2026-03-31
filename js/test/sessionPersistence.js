async function saveSessionData() {
            if (!testSession) return;

            const sessionData = testSession.getSessionData();

            // Prepare full session data
            const fullSessionData = {
                ...sessionData.sessionData,
                sessionId: sessionData.sessionId,
                trials: sessionData.trials,
                calibrationReadings: [],
                isAborted: sessionData.isAborted,
                abortReason: sessionData.abortReason,
                completedAt: sessionData.completedAt,
                startedAt: sessionData.sessionData.startedAt || new Date().toISOString()
            };

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
            const existingMsg = document.getElementById('dbSaveMessage');
            if (existingMsg) {
                existingMsg.remove();
            }

            const msg = document.createElement('div');
            msg.id = 'dbSaveMessage';
            msg.className = `export-message export-message--${type === 'warning' ? 'error' : type}`;

            let detailsText = '';
            if (details && type === 'success') {
                detailsText = ` | Trials: ${details.trials_saved}, Readings: ${details.readings_saved}, Responses: ${details.tags_saved}`;
            }

            msg.textContent = message + detailsText;

            const sessionSidebar = document.querySelector('.session-sidebar');
            if (sessionSidebar) {
                sessionSidebar.insertBefore(msg, sessionSidebar.firstChild);
                setTimeout(() => {
                    if (msg.parentElement) {
                        msg.remove();
                    }
                }, 5000);
            }
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
            const existingMsg = document.getElementById('exportMessage');
            if (existingMsg) {
                existingMsg.remove();
            }
            
            const msg = document.createElement('div');
            msg.id = 'exportMessage';
            msg.className = `export-message export-message--${type}`;
            msg.textContent = message;
            
            const sessionSidebar = document.querySelector('.session-sidebar');
            if (sessionSidebar) {
                sessionSidebar.insertBefore(msg, sessionSidebar.firstChild);
                setTimeout(() => {
                    if (msg.parentElement) {
                        msg.remove();
                    }
                }, 3000);
            }
        }
        
        // Show session start success message
        function showSessionStartMessage(sessionId, patternCount) {
            // Remove any existing message
            const existingMessage = document.getElementById('sessionStartMessage');
            if (existingMessage) {
                existingMessage.remove();
            }
            
            // Create message element
            const message = document.createElement('div');
            message.id = 'sessionStartMessage';
            message.className = 'session-start-message';
            message.innerHTML = `
                <div class="session-start-message__content">
                    <div class="session-start-message__icon">✓</div>
                    <div class="session-start-message__text">
                        <strong>Session ${sessionId} started</strong>
                        <span>${patternCount} ${patternCount === 1 ? 'pattern' : 'patterns'} in queue</span>
                    </div>
                    <button class="session-start-message__close" onclick="this.parentElement.parentElement.remove()">×</button>
                </div>
            `;
            
            // Append to body so it overlays everything
            document.body.appendChild(message);
            
            // Auto-remove after 5 seconds
            setTimeout(() => {
                if (message.parentElement) {
                    message.style.opacity = '0';
                    message.style.transform = 'translateY(-10px)';
                    setTimeout(() => {
                        if (message.parentElement) {
                            message.remove();
                        }
                    }, 300);
                }
            }, 5000);
        }
