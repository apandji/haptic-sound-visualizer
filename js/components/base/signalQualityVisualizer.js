/**
 * SignalQualityVisualizer Component
 * Displays real-time signal quality metrics for OpenBCI Ganglion EEG channels
 * Intercom-style floating widget that appears when device is connected
 * 
 * Version: 2.0 - Added Python script features (data validation, channel config, lifecycle management)
 */
class SignalQualityVisualizer {
    constructor(options = {}) {
        // Container (will be created as floating widget)
        this.containerId = options.containerId || 'signalQualityVisualizer';
        
        // Configuration
        this.updateInterval = options.updateInterval || 1000; // ms (default: 1 second)
        this.windowLength = options.windowLength || 2.0; // seconds for PSD window
        this.useMockData = options.useMockData !== undefined ? options.useMockData : true;
        this.mockDataPath = options.mockDataPath || 'data/ganglion_sample_data.csv';
        this.liveDataTimeoutMs = options.liveDataTimeoutMs || 3000; // max age for last live reading
        
        // Channel configuration (from Python: --quality_channels parameter)
        // null or undefined = use all channels, array = specific channel indices
        this.qualityChannels = options.qualityChannels || null; // e.g., [0, 1, 2, 3] or null for all
        this.allChannels = [0, 1, 2, 3]; // Ganglion has 4 EEG channels
        this.activeChannels = this.qualityChannels || this.allChannels; // Channels to monitor
        
        // Sampling rate (Ganglion default: 200 Hz)
        this.samplingRate = options.samplingRate || 200; // Hz
        
        // Device information
        this.deviceType = options.deviceType || 'ganglionDevice'; // e.g., 'ganglionDevice', 'Cyton', etc.
        this.deviceId = options.deviceId || null; // Optional device ID/serial number
        
        // Callbacks
        this.onQualityChange = options.onQualityChange || null;
        this.onConnectionChange = options.onConnectionChange || null;
        this.onError = options.onError || null;
        
        // State
        this.connectionState = 'disconnected'; // disconnected | preparing | streaming | stopped | released | error
        this.isExpanded = false;
        this.isMonitoring = false;
        this.updateTimer = null;
        this.channelQualities = []; // Array of {channel, rms_uV, quality}
        this.mockData = null; // Loaded CSV data
        this.mockDataIndex = 0; // Current position in mock data
        this.latestReading = null; // Most recent reading pushed from EEGDataCollector
        this.latestReadingTimestamp = null; // Local receive time (Date.now)
        this.lastUpdateTime = null; // Timestamp of last successful update
        this.errorCount = 0; // Track consecutive errors
        
        // Channel labels (generated from active channels)
        this.channelLabels = this.generateChannelLabels();
        this.channelCount = this.activeChannels.length;
        
        // Window size calculation (from Python: n_win = max(8, int(round(args.window_sec * fs)))
        this.windowSize = this.calculateWindowSize();
        
        // DOM references
        this.container = null;
        this.minimizedButton = null;
        this.expandedPanel = null;
        this.qualityTable = null;
        this.connectionStatusEl = null;
        this.statusDotEl = null;
        this.channelsContainerEl = null;
        this.summaryEl = null;
        this.lastUpdateEl = null;
        
        // Initialize
        this.init();
    }
    
    /**
     * Generate channel labels from active channels
     * From Python: quality_labels = [f"CH{idx + 1}" for idx in range(len(quality_ch))]
     */
    generateChannelLabels() {
        return this.activeChannels.map((channelIndex, idx) => `CH${idx + 1}`);
    }
    
    /**
     * Calculate window size from window length and sampling rate
     * From Python: n_win = max(8, int(round(args.window_sec * fs)))
     */
    calculateWindowSize() {
        const windowSize = Math.max(8, Math.round(this.windowLength * this.samplingRate));
        return windowSize;
    }
    
    /**
     * Validate data before processing
     * From Python lines 138-144: data validation checks
     */
    validateData(data, expectedWindowSize) {
        // Check if data is None/null
        if (!data) {
            return { valid: false, reason: 'No data received' };
        }
        
        // Check if data has correct structure (should be channels × samples)
        if (!data.shape || data.shape.length < 2) {
            return { valid: false, reason: 'Invalid data structure' };
        }
        
        // Check minimum samples (80% of window size)
        // From Python: data.shape[1] < int(0.8 * n_win)
        const minSamples = Math.floor(expectedWindowSize * 0.8);
        if (data.shape[1] < minSamples) {
            return { valid: false, reason: `Insufficient samples (got ${data.shape[1]}, need ${minSamples})` };
        }
        
        // Check if we have data for all active channels
        if (data.shape[0] < this.activeChannels.length) {
            return { valid: false, reason: `Insufficient channels (got ${data.shape[0]}, need ${this.activeChannels.length})` };
        }
        
        return { valid: true };
    }
    
    /**
     * Initialize component
     */
    init() {
        // Create floating container
        this.createContainer();
        
        // Load mock data if using mock mode
        if (this.useMockData) {
            this.loadMockData();
        }
        
        // Initially hidden (will show when device connects)
        this.hide();
    }
    
    /**
     * Create floating container (Intercom-style)
     */
    createContainer() {
        // Create main container
        this.container = document.createElement('div');
        this.container.id = this.containerId;
        this.container.className = 'signal-quality-visualizer';
        document.body.appendChild(this.container);
        
        // Create minimized button (always visible when connected)
        this.createMinimizedButton();
        
        // Create expanded panel (shown when expanded)
        this.createExpandedPanel();
    }
    
    /**
     * Create minimized button (Information-dense for researchers)
     */
    createMinimizedButton() {
        this.minimizedButton = document.createElement('button');
        this.minimizedButton.className = 'signal-quality-visualizer__minimized-btn';
        this.minimizedButton.setAttribute('aria-label', 'Show signal quality');
        
        // Container for content
        const content = document.createElement('div');
        content.className = 'signal-quality-visualizer__minimized-content';
        
        // Header: Title + Status dot
        const header = document.createElement('div');
        header.className = 'signal-quality-visualizer__minimized-header';
        
        const title = document.createElement('div');
        title.className = 'signal-quality-visualizer__minimized-title';
        // Show device type (e.g., "Ganglion v4 Signal")
        title.textContent = this.deviceType ? `${this.deviceType} Signal` : 'EEG Signal';
        
        const statusDot = document.createElement('div');
        statusDot.className = 'signal-quality-visualizer__status-dot';
        statusDot.setAttribute('data-status', 'disconnected');
        this.statusDotEl = statusDot;
        
        header.appendChild(title);
        header.appendChild(statusDot);
        
        // Channel indicators (4 channels)
        const channelsContainer = document.createElement('div');
        channelsContainer.className = 'signal-quality-visualizer__minimized-channels';
        this.channelsContainerEl = channelsContainer;
        
        // Create channel indicators
        for (let i = 0; i < this.channelCount; i++) {
            const channelIndicator = document.createElement('div');
            channelIndicator.className = 'signal-quality-visualizer__channel-indicator';
            channelIndicator.dataset.channel = this.channelLabels[i];
            channelIndicator.dataset.index = i;
            
            const channelLabel = document.createElement('div');
            channelLabel.className = 'signal-quality-visualizer__channel-label';
            channelLabel.textContent = this.channelLabels[i];
            
            const channelStatus = document.createElement('div');
            channelStatus.className = 'signal-quality-visualizer__channel-status';
            channelStatus.setAttribute('data-status', 'unknown');
            
            // Create container for value + unit
            const statusContainer = document.createElement('div');
            statusContainer.className = 'signal-quality-visualizer__channel-status-container';
            
            const statusValue = document.createElement('span');
            statusValue.className = 'signal-quality-visualizer__channel-status-value';
            statusValue.textContent = '--';
            
            const statusUnit = document.createElement('span');
            statusUnit.className = 'signal-quality-visualizer__channel-status-unit';
            statusUnit.textContent = 'μV';
            
            statusContainer.appendChild(statusValue);
            statusContainer.appendChild(statusUnit);
            channelStatus.appendChild(statusContainer);
            
            channelStatus.title = 'RMS (μV)'; // Tooltip explaining what the number means
            
            channelIndicator.appendChild(channelLabel);
            channelIndicator.appendChild(channelStatus);
            channelsContainer.appendChild(channelIndicator);
        }
        
        // Summary text (e.g., "3 good, 1 ok")
        const summary = document.createElement('div');
        summary.className = 'signal-quality-visualizer__minimized-summary';
        summary.textContent = '--';
        this.summaryEl = summary;
        
        content.appendChild(header);
        content.appendChild(channelsContainer);
        content.appendChild(summary);
        
        this.minimizedButton.appendChild(content);
        
        this.minimizedButton.addEventListener('click', () => {
            this.toggle();
        });
        
        this.container.appendChild(this.minimizedButton);
    }
    
    /**
     * Create expanded panel
     */
    createExpandedPanel() {
        this.expandedPanel = document.createElement('div');
        this.expandedPanel.className = 'signal-quality-visualizer__panel';
        this.expandedPanel.style.display = 'none';
        
        // Header
        const header = document.createElement('div');
        header.className = 'signal-quality-visualizer__header';
        
        const title = document.createElement('div');
        title.className = 'signal-quality-visualizer__title';
        // Show device type in expanded panel too
        if (this.deviceId) {
            title.textContent = `${this.deviceType} Signal Quality (${this.deviceId})`;
        } else {
            title.textContent = `${this.deviceType} Signal Quality`;
        }
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'signal-quality-visualizer__close-btn';
        closeBtn.innerHTML = '×';
        closeBtn.setAttribute('aria-label', 'Close signal quality panel');
        closeBtn.addEventListener('click', () => {
            this.collapse();
        });
        
        header.appendChild(title);
        header.appendChild(closeBtn);
        
        // Connection status
        const status = document.createElement('div');
        status.className = 'signal-quality-visualizer__status';
        status.textContent = 'Disconnected';
        this.connectionStatusEl = status;
        
        // Last update time
        const lastUpdate = document.createElement('div');
        lastUpdate.className = 'signal-quality-visualizer__last-update';
        lastUpdate.textContent = '';
        this.lastUpdateEl = lastUpdate;
        
        // Quality table
        this.qualityTable = document.createElement('table');
        this.qualityTable.className = 'signal-quality-visualizer__table';
        this.createQualityTable();
        
        this.expandedPanel.appendChild(header);
        this.expandedPanel.appendChild(status);
        this.expandedPanel.appendChild(lastUpdate);
        this.expandedPanel.appendChild(this.qualityTable);
        
        this.container.appendChild(this.expandedPanel);
    }
    
    /**
     * Create quality table structure
     */
    createQualityTable() {
        // Clear existing table
        this.qualityTable.innerHTML = '';
        
        // Table header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = `
            <th>Channel</th>
            <th>RMS (μV)</th>
            <th>Quality</th>
        `;
        thead.appendChild(headerRow);
        
        // Table body
        const tbody = document.createElement('tbody');
        tbody.className = 'signal-quality-visualizer__table-body';
        
        // Create rows for each active channel
        for (let i = 0; i < this.channelCount; i++) {
            const row = document.createElement('tr');
            row.dataset.channel = this.channelLabels[i];
            row.innerHTML = `
                <td class="signal-quality-visualizer__channel">${this.channelLabels[i]}</td>
                <td class="signal-quality-visualizer__rms">--</td>
                <td class="signal-quality-visualizer__quality">
                    <span class="signal-quality-visualizer__quality-badge">--</span>
                </td>
            `;
            tbody.appendChild(row);
        }
        
        this.qualityTable.appendChild(thead);
        this.qualityTable.appendChild(tbody);
    }
    
    /**
     * Load mock data from CSV
     */
    async loadMockData() {
        try {
            const response = await fetch(this.mockDataPath);
            if (!response.ok) {
                console.warn('SignalQualityVisualizer: Could not load mock data, using simulated data');
                this.mockData = null;
                return;
            }
            
            const text = await response.text();
            this.mockData = this.parseCSV(text);
            console.log(`SignalQualityVisualizer: Loaded ${this.mockData.length} rows of mock data`);
        } catch (error) {
            console.warn('SignalQualityVisualizer: Error loading mock data:', error);
            this.mockData = null;
        }
    }
    
    /**
     * Parse CSV data
     */
    parseCSV(text) {
        const lines = text.trim().split('\n');
        const headers = lines[0].split(',');
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            const row = {};
            headers.forEach((header, index) => {
                const val = values[index]?.trim() || '';
                // Try to parse as number
                const numVal = parseFloat(val);
                row[header] = isNaN(numVal) ? val : numVal;
            });
            data.push(row);
        }
        
        return data;
    }

    /**
     * Push one live EEG reading into the visualizer.
     * @param {Object} reading - Reading from EEGDataCollector/eeg_server.py
     */
    ingestReading(reading) {
        if (!reading || typeof reading !== 'object') {
            return;
        }
        this.latestReading = reading;
        this.latestReadingTimestamp = Date.now();
    }

    /**
     * Clear the current live reading and force "waiting for data" state.
     */
    clearLiveReading() {
        this.latestReading = null;
        this.latestReadingTimestamp = null;
    }

    /**
     * Build a fallback total-power estimate when per-channel metrics are unavailable.
     */
    getFallbackTotalPower(reading) {
        const explicitTotal = Number(reading.total_1_45_uV2);
        if (Number.isFinite(explicitTotal) && explicitTotal > 0) {
            return explicitTotal;
        }

        const bands = ['delta_abs', 'theta_abs', 'alpha_abs', 'beta_abs', 'gamma_abs'];
        const summed = bands.reduce((acc, key) => {
            const value = Number(reading[key]);
            return Number.isFinite(value) && value > 0 ? acc + value : acc;
        }, 0);
        return summed > 0 ? summed : 1.0;
    }

    /**
     * Convert a live EEG reading to per-channel quality rows.
     */
    calculateQualityFromLiveReading(reading) {
        if (!reading || typeof reading !== 'object') {
            return [];
        }

        const readingTimestamp = Number(reading.timestamp_ms);
        const timestamp = Number.isFinite(readingTimestamp) ? readingTimestamp : Date.now();
        const rawMetrics = Array.isArray(reading.channel_metrics) ? reading.channel_metrics : [];

        const totalPower = this.getFallbackTotalPower(reading);
        const fallbackRms = Math.max(0.1, Math.sqrt(totalPower));

        return this.activeChannels.map((activeChannel, idx) => {
            const metric = rawMetrics.find((item) => Number(item.channel_index) === activeChannel) || rawMetrics[idx] || null;
            const metricRms = Number(metric?.rms_uV);

            const rms_uV = Number.isFinite(metricRms) ? Math.max(0.1, metricRms) : fallbackRms;

            return {
                channel: this.channelLabels[idx],
                channelIndex: idx,
                rms_uV,
                quality: this.classifyQuality(rms_uV),
                timestamp
            };
        });
    }
    
    /**
     * Calculate signal quality from mock data
     * Each channel gets independent quality - realistic scenario where channels differ
     */
    calculateQualityFromMockData() {
        if (!this.mockData || this.mockData.length === 0) {
            // Fallback: generate simulated data
            return this.generateSimulatedQualities();
        }
        
        // Advance through the mock rows to preserve a time-like progression.
        this.mockDataIndex++;
        
        // Generate independent per-channel RMS values while cycling through the mock rows.
        const qualities = [];
        
        for (let i = 0; i < this.channelCount; i++) {
            const channelSeed = (this.mockDataIndex * 10 + i) % 100;
            const seededFactor = channelSeed / 100;
            let targetQuality;
            const qualityRoll = Math.random();
            if (qualityRoll < 0.6) {
                targetQuality = 'good';
            } else if (qualityRoll < 0.9) {
                targetQuality = 'ok';
            } else {
                targetQuality = 'poor';
            }
            
            let channelRMS;
            
            if (targetQuality === 'good') {
                channelRMS = 15 + (seededFactor * 70);
            } else if (targetQuality === 'ok') {
                channelRMS = 105 + (seededFactor * 40);
            } else {
                if (Math.random() < 0.5) {
                    channelRMS = 160 + (seededFactor * 220);
                } else {
                    channelRMS = 0.5 + (seededFactor * 3.0);
                }
            }
            
            const jitter = targetQuality === 'poor'
                ? (Math.random() - 0.5)
                : (Math.random() - 0.5) * 6;
            channelRMS = Math.max(0.1, channelRMS + jitter);
            const quality = this.classifyQuality(channelRMS);
            
            qualities.push({
                channel: this.channelLabels[i],
                channelIndex: i,
                rms_uV: channelRMS,
                quality: quality,
                timestamp: Date.now()
            });
        }
        
        return qualities;
    }
    
    /**
     * Generate simulated qualities (fallback when no CSV data)
     * Each channel gets independent quality - realistic scenario where channels differ
     */
    generateSimulatedQualities() {
        const qualities = [];
        
        // Realistic distribution: most channels good, some ok, occasionally poor
        // This simulates real-world scenarios where most electrodes work well
        const qualityDistribution = [
            'good', 'good', 'good', 'ok', 'ok', 'poor' // 50% good, 33% ok, 17% poor
        ];
        
        for (let i = 0; i < this.channelCount; i++) {
            // Each channel independently assigned quality state
            // Use deterministic selection based on channel index for consistency
            const qualityIndex = (i + this.mockDataIndex) % qualityDistribution.length;
            const targetState = qualityDistribution[qualityIndex];
            
            // Add some randomness so it's not completely predictable
            let state = targetState;
            const randomRoll = Math.random();
            if (randomRoll < 0.1 && targetState === 'good') {
                // 10% chance good channel becomes ok
                state = 'ok';
            } else if (randomRoll < 0.15 && targetState === 'ok') {
                // 15% chance ok channel becomes poor
                state = 'poor';
            }
            
            let rms_uV;
            
            if (state === 'good') {
                rms_uV = 15 + Math.random() * 75;
            } else if (state === 'ok') {
                rms_uV = 105 + Math.random() * 40;
            } else {
                if (Math.random() < 0.5) {
                    rms_uV = 160 + Math.random() * 220;
                } else {
                    rms_uV = 0.5 + Math.random() * 4.0;
                }
            }
            
            const quality = this.classifyQuality(rms_uV);
            
            qualities.push({
                channel: this.channelLabels[i],
                channelIndex: i,
                rms_uV: rms_uV,
                quality: quality,
                timestamp: Date.now()
            });
        }
        
        return qualities;
    }
    
    classifyQuality(rms_uV) {
        if (rms_uV >= 5.0 && rms_uV <= 100.0) {
            return 'good';
        } else if (rms_uV > 100.0 && rms_uV <= 150.0) {
            return 'ok';
        } else {
            return 'poor';
        }
    }
    
    /**
     * Update quality display
     */
    updateQualityDisplay(qualities) {
        if (!this.qualityTable) return;
        
        const tbody = this.qualityTable.querySelector('.signal-quality-visualizer__table-body');
        if (!tbody) return;
        
        qualities.forEach((q, index) => {
            const row = tbody.querySelector(`tr[data-channel="${q.channel}"]`);
            if (!row) return;
            
            // Update RMS
            const rmsCell = row.querySelector('.signal-quality-visualizer__rms');
            if (rmsCell) {
                rmsCell.textContent = q.rms_uV.toFixed(1);
            }
            
            // Update quality badge
            const qualityBadge = row.querySelector('.signal-quality-visualizer__quality-badge');
            if (qualityBadge) {
                qualityBadge.textContent = q.quality;
                qualityBadge.className = `signal-quality-visualizer__quality-badge signal-quality-visualizer__quality-badge--${q.quality}`;
            }
            
            // Update row class for styling
            row.className = `signal-quality-visualizer__row--${q.quality}`;
        });
        
        // Update minimized button display (if streaming)
        if (this.connectionState === 'streaming') {
            this.updateStatusDot(qualities);
        }
    }
    
    /**
     * Update minimized button display with quality information
     */
    updateStatusDot(qualities) {
        if (!this.minimizedButton || qualities.length === 0) return;
        
        // Update status dot
        if (this.statusDotEl) {
            const worstQuality = qualities.reduce((worst, q) => {
                const order = { 'good': 0, 'ok': 1, 'poor': 2 };
                return order[q.quality] > order[worst] ? q.quality : worst;
            }, 'good');
            this.statusDotEl.setAttribute('data-status', worstQuality);
        }
        
        // Update channel indicators
        if (this.channelsContainerEl) {
            qualities.forEach((q) => {
                const indicator = this.channelsContainerEl.querySelector(
                    `.signal-quality-visualizer__channel-indicator[data-channel="${q.channel}"]`
                );
                if (indicator) {
                    const statusEl = indicator.querySelector('.signal-quality-visualizer__channel-status');
                    if (statusEl) {
                        statusEl.setAttribute('data-status', q.quality);
                        // Update RMS value (unit is already in DOM)
                        const valueEl = statusEl.querySelector('.signal-quality-visualizer__channel-status-value');
                        if (valueEl) {
                            valueEl.textContent = Math.round(q.rms_uV);
                        }
                    }
                    // Update indicator class for styling
                    indicator.setAttribute('data-status', q.quality);
                }
            });
        }
        
        // Update summary text
        if (this.summaryEl) {
            const counts = { good: 0, ok: 0, poor: 0 };
            qualities.forEach(q => {
                counts[q.quality] = (counts[q.quality] || 0) + 1;
            });
            
            const parts = [];
            if (counts.good > 0) parts.push(`${counts.good} good`);
            if (counts.ok > 0) parts.push(`${counts.ok} ok`);
            if (counts.poor > 0) parts.push(`${counts.poor} poor`);
            
            this.summaryEl.textContent = parts.length > 0 ? parts.join(', ') : '--';
        }
    }
    
    /**
     * Update quality metrics (called periodically)
     * Includes data validation (from Python lines 138-144)
     */
    updateQuality() {
        if (!this.isMonitoring || this.connectionState !== 'streaming') return;
        
        try {
            let qualities = [];

            if (this.useMockData) {
                // Simulate data structure for validation (mock mode)
                const mockDataShape = {
                    shape: [this.channelCount, this.windowSize],
                    data: null // Not used for validation
                };

                // Validate data (from Python validation)
                const validation = this.validateData(mockDataShape, this.windowSize);

                if (!validation.valid) {
                    console.warn('SignalQualityVisualizer: Data validation failed:', validation.reason);
                    this.errorCount++;
                    if (this.errorCount >= 3) {
                        this.setConnectionState('error', validation.reason);
                    }
                    this.updateLastUpdateTime(false);
                    return;
                }

                qualities = this.calculateQualityFromMockData();
            } else {
                const now = Date.now();
                const readingIsFresh = (
                    !!this.latestReading &&
                    !!this.latestReadingTimestamp &&
                    (now - this.latestReadingTimestamp) <= this.liveDataTimeoutMs
                );

                if (!readingIsFresh) {
                    this.errorCount++;
                    this.updateLastUpdateTime(false);
                    return;
                }

                qualities = this.calculateQualityFromLiveReading(this.latestReading);
                if (!qualities.length) {
                    this.errorCount++;
                    this.updateLastUpdateTime(false);
                    return;
                }
            }

            // Reset error count on successful update
            this.errorCount = 0;
            this.channelQualities = qualities;
            
            // Update display
            this.updateQualityDisplay(qualities);
            
            // Update last update time
            this.updateLastUpdateTime(true);
            
            // Call callback
            if (this.onQualityChange) {
                this.onQualityChange(qualities);
            }
            
        } catch (error) {
            console.error('SignalQualityVisualizer: Error updating quality:', error);
            this.handleError(error);
        }
    }
    
    /**
     * Update last update time display
     */
    updateLastUpdateTime(success) {
        if (!this.lastUpdateEl) return;
        
        const now = new Date();
        const timeStr = now.toLocaleTimeString();
        
        if (success) {
            this.lastUpdateTime = now;
            this.lastUpdateEl.textContent = `Last update: ${timeStr}`;
            this.lastUpdateEl.className = 'signal-quality-visualizer__last-update signal-quality-visualizer__last-update--active';
        } else {
            // Show stale indicator
            if (this.lastUpdateTime) {
                const secondsAgo = Math.floor((now - this.lastUpdateTime) / 1000);
                this.lastUpdateEl.textContent = `Last update: ${secondsAgo}s ago (waiting for data...)`;
                this.lastUpdateEl.className = 'signal-quality-visualizer__last-update signal-quality-visualizer__last-update--stale';
            } else {
                this.lastUpdateEl.textContent = 'Waiting for data...';
                this.lastUpdateEl.className = 'signal-quality-visualizer__last-update signal-quality-visualizer__last-update--stale';
            }
        }
    }
    
    /**
     * Handle errors gracefully (from Python lines 152-161)
     */
    handleError(error) {
        this.errorCount++;
        this.setConnectionState('error', error.message || 'Unknown error');
        
        if (this.onError) {
            this.onError(error);
        }
        
        // Auto-recover after 5 seconds if in error state
        if (this.errorCount < 10) {
            setTimeout(() => {
                if (this.connectionState === 'error' && this.isMonitoring) {
                    console.log('SignalQualityVisualizer: Attempting recovery...');
                    this.errorCount = 0;
                    this.setConnectionState('streaming');
                }
            }, 5000);
        }
    }
    
    /**
     * Set connection state (matching Python lifecycle)
     */
    setConnectionState(state, message = null) {
        const previousState = this.connectionState;
        this.connectionState = state;
        
        // Update UI
        if (this.connectionStatusEl) {
            let statusText = '';
            let statusClass = 'signal-quality-visualizer__status';
            
            switch (state) {
                case 'disconnected':
                    statusText = 'Disconnected';
                    statusClass += ' signal-quality-visualizer__status--disconnected';
                    break;
                case 'preparing':
                    statusText = 'Preparing session...';
                    statusClass += ' signal-quality-visualizer__status--preparing';
                    break;
                case 'streaming':
                    statusText = `Connected (${this.samplingRate} Hz)`;
                    statusClass += ' signal-quality-visualizer__status--connected';
                    break;
                case 'stopped':
                    statusText = 'Stopped (session prepared)';
                    statusClass += ' signal-quality-visualizer__status--stopped';
                    break;
                case 'released':
                    statusText = 'Session released';
                    statusClass += ' signal-quality-visualizer__status--released';
                    break;
                case 'error':
                    statusText = message || 'Error';
                    statusClass += ' signal-quality-visualizer__status--error';
                    break;
            }
            
            this.connectionStatusEl.textContent = statusText;
            this.connectionStatusEl.className = statusClass;
        }
        
        // Update status dot
        this.updateStatusDotFromState(state);
        
        // Call callback if state changed
        if (previousState !== state && this.onConnectionChange) {
            this.onConnectionChange(state, previousState);
        }
    }
    
    /**
     * Update status dot based on connection state
     */
    updateStatusDotFromState(state) {
        if (!this.statusDotEl) return;
        
        // Map state to status
        let status = 'disconnected';
        if (state === 'streaming') {
            // Use worst quality if available
            if (this.channelQualities.length > 0) {
                const worstQuality = this.channelQualities.reduce((worst, q) => {
                    const order = { 'good': 0, 'ok': 1, 'poor': 2 };
                    return order[q.quality] > order[worst] ? q.quality : worst;
                }, 'good');
                status = worstQuality;
            } else {
                status = 'good'; // Default when streaming but no data yet
            }
        } else if (state === 'error') {
            status = 'poor';
        } else if (state === 'preparing' || state === 'stopped') {
            status = 'ok';
        }
        
        this.statusDotEl.setAttribute('data-status', status);
        
        // Update channel indicators to show "waiting" or "disconnected" state
        if (this.channelsContainerEl) {
            const indicators = this.channelsContainerEl.querySelectorAll('.signal-quality-visualizer__channel-indicator');
            indicators.forEach(indicator => {
                const statusEl = indicator.querySelector('.signal-quality-visualizer__channel-status');
                if (statusEl) {
                    const valueEl = statusEl.querySelector('.signal-quality-visualizer__channel-status-value');
                    if (valueEl) {
                        if (state === 'disconnected' || state === 'released') {
                            statusEl.setAttribute('data-status', 'disconnected');
                            valueEl.textContent = '--';
                        } else if (state === 'preparing' || state === 'stopped') {
                            statusEl.setAttribute('data-status', 'waiting');
                            valueEl.textContent = '...';
                        } else if (state === 'error') {
                            statusEl.setAttribute('data-status', 'error');
                            valueEl.textContent = '!';
                        }
                    }
                    indicator.setAttribute('data-status', state);
                }
            });
        }
        
        // Update summary based on state
        if (this.summaryEl) {
            if (state === 'disconnected' || state === 'released') {
                this.summaryEl.textContent = 'Disconnected';
            } else if (state === 'preparing') {
                this.summaryEl.textContent = 'Preparing...';
            } else if (state === 'stopped') {
                this.summaryEl.textContent = 'Stopped';
            } else if (state === 'error') {
                this.summaryEl.textContent = 'Error';
            }
            // If streaming, summary is updated by updateStatusDot()
        }
    }
    
    /**
     * Prepare session (from Python: board.prepare_session())
     */
    prepare() {
        if (this.connectionState !== 'disconnected' && this.connectionState !== 'released') {
            console.warn('SignalQualityVisualizer: Cannot prepare, already in state:', this.connectionState);
            return;
        }
        
        this.setConnectionState('preparing');
        
        // Simulate preparation delay (in real implementation, this would be async)
        setTimeout(() => {
            if (this.connectionState === 'preparing') {
                // Preparation successful, ready to stream
                console.log('SignalQualityVisualizer: Session prepared');
            }
        }, 500);
    }
    
    /**
     * Start streaming (from Python: board.start_stream())
     */
    startStream() {
        if (this.connectionState === 'streaming') {
            console.warn('SignalQualityVisualizer: Already streaming');
            return;
        }
        
        // If not prepared, prepare first
        if (this.connectionState === 'disconnected' || this.connectionState === 'released') {
            this.prepare();
            // Wait a bit for preparation
            setTimeout(() => {
                this.doStartStream();
            }, 600);
        } else {
            this.doStartStream();
        }
    }
    
    /**
     * Internal: Actually start streaming
     */
    doStartStream() {
        this.isMonitoring = true;
        this.setConnectionState('streaming');
        
        // Show widget
        this.show();
        
        // Reset error count
        this.errorCount = 0;
        
        // Start update loop
        this.updateQuality(); // Initial update
        this.updateTimer = setInterval(() => {
            this.updateQuality();
        }, this.updateInterval);
    }
    
    /**
     * Start monitoring (convenience method - calls prepare + startStream)
     */
    start() {
        this.startStream();
    }
    
    /**
     * Stop streaming (from Python: board.stop_stream())
     */
    stopStream() {
        if (this.connectionState !== 'streaming') {
            return;
        }
        
        // Clear timer
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
        }
        
        this.isMonitoring = false;
        this.setConnectionState('stopped');
    }
    
    /**
     * Release session (from Python: board.release_session())
     */
    release() {
        // Stop streaming first if needed
        if (this.connectionState === 'streaming') {
            this.stopStream();
        }
        
        // Clear timer if still running
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
        }
        
        this.isMonitoring = false;
        this.clearLiveReading();
        this.setConnectionState('released');
        
        // Hide widget
        this.hide();
    }
    
    /**
     * Stop monitoring (convenience method - calls release)
     */
    stop() {
        this.release();
        this.setConnectionState('disconnected');
    }
    
    /**
     * Show widget
     */
    show() {
        if (this.container) {
            this.container.classList.add('signal-quality-visualizer--visible');
        }
    }

    /**
     * Mount widget container to a specific host element.
     * @param {HTMLElement} hostEl
     */
    mountTo(hostEl) {
        if (!this.container || !hostEl || typeof hostEl.appendChild !== 'function') {
            return;
        }

        if (this.container.parentElement !== hostEl) {
            hostEl.appendChild(this.container);
        }
    }

    /**
     * Toggle embedded mode (used during calibration phase inside overlay).
     * @param {boolean} enabled
     */
    setEmbeddedMode(enabled) {
        if (!this.container) {
            return;
        }
        this.container.classList.toggle('signal-quality-visualizer--embedded', Boolean(enabled));
    }
    
    /**
     * Hide widget
     */
    hide() {
        if (this.container) {
            this.container.classList.remove('signal-quality-visualizer--visible');
            this.collapse(); // Also collapse if expanded
        }
    }
    
    /**
     * Expand panel
     */
    expand() {
        this.isExpanded = true;
        if (this.expandedPanel) {
            this.expandedPanel.style.display = 'block';
        }
        if (this.minimizedButton) {
            this.minimizedButton.classList.add('signal-quality-visualizer__minimized-btn--hidden');
        }
    }
    
    /**
     * Collapse panel
     */
    collapse() {
        this.isExpanded = false;
        if (this.expandedPanel) {
            this.expandedPanel.style.display = 'none';
        }
        if (this.minimizedButton) {
            this.minimizedButton.classList.remove('signal-quality-visualizer__minimized-btn--hidden');
        }
    }
    
    /**
     * Toggle expanded/collapsed
     */
    toggle() {
        if (this.isExpanded) {
            this.collapse();
        } else {
            this.expand();
        }
    }
    
    /**
     * Get current quality metrics
     */
    getQualities() {
        return this.channelQualities;
    }
    
    /**
     * Check if connected/streaming
     */
    isDeviceConnected() {
        return this.connectionState === 'streaming';
    }
    
    /**
     * Get current connection state
     */
    getConnectionState() {
        return this.connectionState;
    }
    
    /**
     * Set quality channels (from Python: --quality_channels parameter)
     */
    setQualityChannels(channelIndices) {
        // null or undefined = use all channels
        if (channelIndices === null || channelIndices === undefined) {
            this.qualityChannels = null;
            this.activeChannels = this.allChannels;
        } else {
            // Validate channel indices
            const validChannels = channelIndices.filter(idx => 
                Number.isInteger(idx) && idx >= 0 && idx < this.allChannels.length
            );
            
            if (validChannels.length === 0) {
                console.warn('SignalQualityVisualizer: No valid channels provided, using all channels');
                this.qualityChannels = null;
                this.activeChannels = this.allChannels;
            } else {
                this.qualityChannels = validChannels;
                this.activeChannels = validChannels;
            }
        }
        
        // Regenerate labels and update count
        this.channelLabels = this.generateChannelLabels();
        this.channelCount = this.activeChannels.length;
        
        // Recalculate window size
        this.windowSize = this.calculateWindowSize();
        
        // Recreate channel indicators in minimized button
        if (this.channelsContainerEl) {
            this.channelsContainerEl.innerHTML = '';
            for (let i = 0; i < this.channelCount; i++) {
                const channelIndicator = document.createElement('div');
                channelIndicator.className = 'signal-quality-visualizer__channel-indicator';
                channelIndicator.dataset.channel = this.channelLabels[i];
                channelIndicator.dataset.index = i;
                
                const channelLabel = document.createElement('div');
                channelLabel.className = 'signal-quality-visualizer__channel-label';
                channelLabel.textContent = this.channelLabels[i];
                
                const channelStatus = document.createElement('div');
                channelStatus.className = 'signal-quality-visualizer__channel-status';
                channelStatus.setAttribute('data-status', 'unknown');
                channelStatus.textContent = '--';
                
                channelIndicator.appendChild(channelLabel);
                channelIndicator.appendChild(channelStatus);
                this.channelsContainerEl.appendChild(channelIndicator);
            }
        }
        
        // Recreate table if already rendered
        if (this.qualityTable && this.expandedPanel) {
            // Remove old table
            const oldTable = this.expandedPanel.querySelector('.signal-quality-visualizer__table');
            if (oldTable) {
                oldTable.remove();
            }
            
            // Create new table
            this.qualityTable = document.createElement('table');
            this.qualityTable.className = 'signal-quality-visualizer__table';
            this.createQualityTable();
            
            // Re-append to panel (after status, before end)
            const statusEl = this.expandedPanel.querySelector('.signal-quality-visualizer__status');
            const lastUpdateEl = this.expandedPanel.querySelector('.signal-quality-visualizer__last-update');
            if (lastUpdateEl && lastUpdateEl.nextSibling) {
                this.expandedPanel.insertBefore(this.qualityTable, lastUpdateEl.nextSibling);
            } else if (statusEl) {
                this.expandedPanel.insertBefore(this.qualityTable, statusEl.nextSibling);
            } else {
                this.expandedPanel.appendChild(this.qualityTable);
            }
        }
    }
    
    /**
     * Set sampling rate and recalculate window size
     */
    setSamplingRate(rate) {
        this.samplingRate = rate;
        this.windowSize = this.calculateWindowSize();
        
        // Update status display if streaming
        if (this.connectionState === 'streaming') {
            this.setConnectionState('streaming'); // This will update the status text
        }
    }
    
    /**
     * Set window length and recalculate window size
     */
    setWindowLength(length) {
        this.windowLength = length;
        this.windowSize = this.calculateWindowSize();
    }
    
    /**
     * Set device type and update display
     */
    setDeviceType(deviceType, deviceId = null) {
        this.deviceType = deviceType || 'ganglionDevice';
        this.deviceId = deviceId;
        
        // Update title in minimized button
        const titleEl = this.minimizedButton?.querySelector('.signal-quality-visualizer__minimized-title');
        if (titleEl) {
            titleEl.textContent = this.deviceType ? `${this.deviceType} Signal` : 'EEG Signal';
        }
        
        // Update title in expanded panel
        const expandedTitleEl = this.expandedPanel?.querySelector('.signal-quality-visualizer__title');
        if (expandedTitleEl) {
            if (this.deviceId) {
                expandedTitleEl.textContent = `${this.deviceType} Signal Quality (${this.deviceId})`;
            } else {
                expandedTitleEl.textContent = `${this.deviceType} Signal Quality`;
            }
        }
    }
    
    /**
     * Cleanup (from Python: finally block ensures cleanup)
     */
    destroy() {
        try {
            // Ensure we release session
            if (this.connectionState !== 'disconnected' && this.connectionState !== 'released') {
                this.release();
            }
            
            // Clear any timers
            if (this.updateTimer) {
                clearInterval(this.updateTimer);
                this.updateTimer = null;
            }
            
            // Remove DOM elements
            if (this.container && this.container.parentElement) {
                this.container.parentElement.removeChild(this.container);
            }
            
        } catch (error) {
            console.error('SignalQualityVisualizer: Error during cleanup:', error);
        } finally {
            // Clear references
            this.container = null;
            this.minimizedButton = null;
            this.expandedPanel = null;
            this.qualityTable = null;
            this.connectionStatusEl = null;
            this.lastUpdateEl = null;
            this.statusDotEl = null;
            this.channelsContainerEl = null;
            this.summaryEl = null;
            this.connectionState = 'disconnected';
            this.isMonitoring = false;
        }
    }
}
