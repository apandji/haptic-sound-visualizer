/**
 * EEGDataCollector Module
 *
 * Handles collection of brainwave readings during test sessions.
 * Connects to eeg_server.py over WebSocket for streaming EEG readings.
 * Use `python eeg_server.py --mock` to stream server-side mock data.
 */

class EEGDataCollector {
    /**
     * Create an EEGDataCollector instance
     * @param {Object} options - Configuration options
     * @param {Function} [options.onReading] - Callback when reading is collected: (reading, meta) => void
     * @param {Function} [options.onConnectionChange] - Callback when connection state changes: (state) => void
     * @param {Function} [options.onError] - Callback when error occurs: (error) => void
     * @param {string} [options.wsUrl='ws://localhost:8765'] - WebSocket server URL for real EEG
     * @param {number} [options.reconnectInterval=3000] - Reconnect interval in ms
     * @param {number} [options.maxReconnectAttempts=5] - Max reconnection attempts
     * @param {number} [options.connectTimeoutMs=5000] - WebSocket connection timeout in ms
     */
    constructor(options = {}) {
        this.onReading = options.onReading || null;
        this.onConnectionChange = options.onConnectionChange || null;
        this.onError = options.onError || null;
        this.wsUrl = options.wsUrl || 'ws://localhost:8765';
        this.reconnectInterval = options.reconnectInterval || 3000;
        this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
        this.connectTimeoutMs = options.connectTimeoutMs || 5000;

        // State
        this.isCollecting = false;
        this.readingCount = 0;
        this.lastPacketReceivedAt = null;
        this.lastAdvancedReadingAt = null;
        this.lastReadingProgressMarker = null;

        // WebSocket state
        this.ws = null;
        this.connectionState = 'disconnected'; // disconnected, connecting, connected, error
        this.reconnectAttempts = 0;
        this.reconnectTimer = null;

        // Context for server
        this.sessionId = null;
        this.trialId = null;
        this.phase = null;
    }

    /**
     * Set the context for EEG readings (session, trial, phase)
     * @param {Object} context - Context object
     * @param {string} [context.sessionId] - Session ID
     * @param {string} [context.trialId] - Trial ID
     * @param {string} [context.phase] - Current phase (calibration, baseline, stimulation, etc.)
     */
    setContext(context) {
        this.sessionId = context.sessionId || null;
        this.trialId = context.trialId || null;
        this.phase = context.phase || null;

        // Send context to server if connected
        if (this.ws && this.connectionState === 'connected') {
            this.sendCommand('set_context', {
                session_id: this.sessionId,
                trial_id: this.trialId,
                phase: this.phase
            });
        }
    }

    /**
     * Connect to the EEG WebSocket server
     * @returns {Promise<boolean>} - Resolves when connected
     */
    connect() {
        return new Promise((resolve, reject) => {
            if (this.ws && this.connectionState === 'connected') {
                resolve(true);
                return;
            }

            this.setConnectionState('connecting');
            let settled = false;
            let opened = false;
            let connectTimeout = null;

            const finish = (handler, value, nextState = null) => {
                if (settled) {
                    return;
                }
                settled = true;
                if (connectTimeout) {
                    clearTimeout(connectTimeout);
                }
                if (nextState) {
                    this.setConnectionState(nextState);
                }
                handler(value);
            };

            try {
                this.ws = new WebSocket(this.wsUrl);
                connectTimeout = setTimeout(() => {
                    const timeoutError = new Error(
                        `WebSocket connection timeout (${this.connectTimeoutMs}ms): ${this.wsUrl}`
                    );
                    try {
                        this.ws.close();
                    } catch (_) {
                        // No-op: we only care about transitioning out of connecting state.
                    }
                    finish(reject, timeoutError, 'error');
                }, this.connectTimeoutMs);

                this.ws.onopen = () => {
                    opened = true;
                    console.log('EEGDataCollector: WebSocket connected');
                    this.setConnectionState('connected');
                    const wasReconnect = this.reconnectAttempts > 0;
                    this.reconnectAttempts = 0;

                    // Re-sync stream state when reconnecting while a session is active.
                    if (this.isCollecting && wasReconnect) {
                        this.syncServerState();
                    }

                    finish(resolve, true);
                };

                this.ws.onmessage = (event) => {
                    this.handleMessage(event.data);
                };

                this.ws.onerror = (event) => {
                    const connectionError = new Error(`WebSocket error while connecting to ${this.wsUrl}`);
                    console.error('EEGDataCollector: WebSocket error', event);
                    if (this.onError) {
                        this.onError(connectionError);
                    }
                    if (!opened) {
                        finish(reject, connectionError, 'error');
                    }
                };

                this.ws.onclose = (event) => {
                    console.log('EEGDataCollector: WebSocket closed', event.code, event.reason);
                    this.setConnectionState('disconnected');

                    if (!opened) {
                        const reason = event.reason ? ` ${event.reason}` : '';
                        const closeError = new Error(`WebSocket closed before open (${event.code})${reason}`);
                        finish(reject, closeError);
                    }

                    // Attempt reconnection if we were collecting
                    if (this.isCollecting && this.reconnectAttempts < this.maxReconnectAttempts) {
                        this.scheduleReconnect();
                    }
                };

            } catch (error) {
                console.error('EEGDataCollector: Failed to create WebSocket', error);
                this.setConnectionState('error');
                reject(error);
            }
        });
    }

    /**
     * Disconnect from the EEG WebSocket server
     */
    disconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        this.setConnectionState('disconnected');
        this.resetReadingProgress();
    }

    /**
     * Schedule a reconnection attempt
     */
    scheduleReconnect() {
        if (this.reconnectTimer) {
            return;
        }

        this.reconnectAttempts++;
        console.log(`EEGDataCollector: Reconnecting in ${this.reconnectInterval}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect().catch(err => {
                console.error('EEGDataCollector: Reconnection failed', err);
            });
        }, this.reconnectInterval);
    }

    /**
     * Set connection state and notify callback
     * @param {string} state - New connection state
     */
    setConnectionState(state) {
        const previousState = this.connectionState;
        this.connectionState = state;

        if (this.onConnectionChange && previousState !== state) {
            this.onConnectionChange(state, previousState);
        }
    }

    /**
     * Clear reading progress markers for a new collection run.
     */
    resetReadingProgress() {
        this.lastPacketReceivedAt = null;
        this.lastAdvancedReadingAt = null;
        this.lastReadingProgressMarker = null;
    }

    /**
     * Derive a monotonic progress marker for a reading.
     * Prefer board-side timestamps so repeated frozen packets are ignored.
     * @param {Object} reading
     * @returns {{type: string, value: number|string}|null}
     */
    getReadingProgressMarker(reading) {
        const boardTime = Number(reading?.bf_time);
        if (Number.isFinite(boardTime)) {
            return { type: 'bf_time', value: boardTime };
        }

        const readingTimestampMs = Number(reading?.timestamp_ms);
        if (Number.isFinite(readingTimestampMs)) {
            return { type: 'timestamp_ms', value: readingTimestampMs };
        }

        try {
            return { type: 'fingerprint', value: JSON.stringify(reading || {}) };
        } catch (_) {
            return null;
        }
    }

    /**
     * Track whether an incoming reading actually advanced the live EEG stream.
     * @param {Object} reading
     * @returns {{didAdvance: boolean, receivedAt: number, advancedAt: number|null}}
     */
    recordReadingProgress(reading) {
        const receivedAt = Date.now();
        const marker = this.getReadingProgressMarker(reading);
        const previousMarker = this.lastReadingProgressMarker;

        this.lastPacketReceivedAt = receivedAt;

        let didAdvance = true;
        if (marker && previousMarker) {
            if (
                marker.type === previousMarker.type &&
                typeof marker.value === 'number' &&
                typeof previousMarker.value === 'number'
            ) {
                didAdvance = marker.value > previousMarker.value;
            } else {
                didAdvance = marker.type !== previousMarker.type || marker.value !== previousMarker.value;
            }
        }

        if (didAdvance) {
            this.lastAdvancedReadingAt = receivedAt;
            this.lastReadingProgressMarker = marker;
        }

        return {
            didAdvance,
            receivedAt,
            advancedAt: this.lastAdvancedReadingAt
        };
    }

    /**
     * Handle incoming WebSocket message
     * @param {string} data - Raw message data
     */
    handleMessage(data) {
        try {
            const message = JSON.parse(data);

            switch (message.type) {
                case 'reading':
                    // Process EEG reading
                    if (this.isCollecting) {
                        const readingMeta = this.recordReadingProgress(message.data);
                        if (this.onReading) {
                            this.onReading(message.data, readingMeta);
                        }
                        if (readingMeta.didAdvance) {
                            this.readingCount++;
                        }
                    }
                    break;

                case 'connected':
                    console.log('EEGDataCollector: Server says:', message.message);
                    console.log('EEGDataCollector: Mock mode:', message.mock_mode);
                    break;

                case 'response':
                    console.log('EEGDataCollector: Command response:', message);
                    break;

                case 'error':
                    console.error('EEGDataCollector: Server error:', message.message);
                    if (this.onError) {
                        this.onError(new Error(message.message));
                    }
                    break;

                case 'pong':
                    // Heartbeat response
                    break;

                default:
                    console.log('EEGDataCollector: Unknown message type:', message.type);
            }
        } catch (error) {
            console.error('EEGDataCollector: Error parsing message', error);
        }
    }

    /**
     * Send a command to the WebSocket server
     * @param {string} command - Command name
     * @param {Object} [params={}] - Additional parameters
     */
    sendCommand(command, params = {}) {
        if (!this.ws || this.connectionState !== 'connected') {
            console.warn('EEGDataCollector: Cannot send command, not connected');
            return false;
        }

        try {
            this.ws.send(JSON.stringify({
                command,
                ...params
            }));
            return true;
        } catch (error) {
            console.error('EEGDataCollector: Error sending command', error);
            return false;
        }
    }

    /**
     * Sync active collection context with the WebSocket server.
     */
    syncServerState() {
        if (!this.ws || this.connectionState !== 'connected') {
            return;
        }

        this.sendCommand('start');

        if (this.sessionId || this.trialId || this.phase) {
            this.sendCommand('set_context', {
                session_id: this.sessionId,
                trial_id: this.trialId,
                phase: this.phase
            });
        }
    }

    /**
     * Start collecting readings
     */
    async start() {
        if (this.isCollecting) {
            console.warn('EEGDataCollector: Already collecting');
            return;
        }

        this.isCollecting = true;
        this.readingCount = 0;
        this.resetReadingProgress();

        // Connect to WebSocket server and start streaming
        try {
            await this.connect();
            this.syncServerState();
        } catch (error) {
            this.isCollecting = false;
            console.error('EEGDataCollector: Failed to start EEG collection', error);
            if (this.onError) {
                this.onError(error);
            }
        }
    }

    /**
     * Stop collecting readings
     */
    stop() {
        if (!this.isCollecting) {
            return;
        }

        this.isCollecting = false;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.ws && this.connectionState === 'connected') {
            this.sendCommand('stop');
        }

        this.resetReadingProgress();
    }

    /**
     * Check if currently collecting
     * @returns {boolean}
     */
    isActive() {
        return this.isCollecting;
    }

    /**
     * Get reading count since last start
     * @returns {number}
     */
    getReadingCount() {
        return this.readingCount;
    }

    /**
     * Get current connection state
     * @returns {string}
     */
    getConnectionState() {
        return this.connectionState;
    }

    /**
     * Check if WebSocket server is available
     * @returns {Promise<boolean>}
     */
    async checkServerAvailable() {
        return new Promise((resolve) => {
            const testWs = new WebSocket(this.wsUrl);
            const timeout = setTimeout(() => {
                testWs.close();
                resolve(false);
            }, 2000);

            testWs.onopen = () => {
                clearTimeout(timeout);
                testWs.close();
                resolve(true);
            };

            testWs.onerror = () => {
                clearTimeout(timeout);
                resolve(false);
            };
        });
    }
}
