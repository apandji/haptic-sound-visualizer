/**
 * EEGDataCollector Module
 * 
 * Handles collection of brainwave readings during test sessions.
 * Currently uses dummy/simulated data. Can be swapped for real EEG integration later.
 */

class EEGDataCollector {
    /**
     * Create an EEGDataCollector instance
     * @param {Object} options - Configuration options
     * @param {Function} [options.onReading] - Callback when reading is collected: (reading) => void
     * @param {number} [options.sampleRate=10] - Samples per second (Hz)
     * @param {boolean} [options.useDummyData=true] - Use dummy data (true) or real EEG (false)
     */
    constructor(options = {}) {
        this.onReading = options.onReading || null;
        this.sampleRate = options.sampleRate || 10; // 10 Hz = 10 samples per second
        this.useDummyData = options.useDummyData !== undefined ? options.useDummyData : true;
        
        // State
        this.isCollecting = false;
        this.collectionInterval = null;
        this.readingCount = 0;

        // Dummy data parameters (realistic ranges based on typical EEG)
        this.dummyDataRanges = {
            delta_abs: { min: 0.5, max: 5.0 },
            theta_abs: { min: 1.0, max: 8.0 },
            alpha_abs: { min: 2.0, max: 15.0 },
            beta_abs: { min: 1.0, max: 12.0 },
            gamma_abs: { min: 0.5, max: 6.0 }
        };
    }

    /**
     * Start collecting readings
     */
    start() {
        if (this.isCollecting) {
            console.warn('EEGDataCollector: Already collecting');
            return;
        }

        this.isCollecting = true;
        this.readingCount = 0;

        if (this.useDummyData) {
            this.startDummyCollection();
        } else {
            // TODO: Start real EEG collection
            console.warn('EEGDataCollector: Real EEG integration not yet implemented');
            this.startDummyCollection(); // Fallback to dummy data
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

        if (this.collectionInterval) {
            clearInterval(this.collectionInterval);
            this.collectionInterval = null;
        }

        if (!this.useDummyData) {
            // TODO: Stop real EEG collection
        }
    }

    /**
     * Start dummy data collection
     */
    startDummyCollection() {
        const intervalMs = 1000 / this.sampleRate; // Convert Hz to milliseconds

        this.collectionInterval = setInterval(() => {
            if (!this.isCollecting) {
                return;
            }

            const reading = this.generateDummyReading();
            
            if (this.onReading) {
                this.onReading(reading);
            }

            this.readingCount++;
        }, intervalMs);
    }

    /**
     * Generate a dummy brainwave reading
     * @returns {Object} Brainwave reading object
     */
    generateDummyReading() {
        const ranges = this.dummyDataRanges;
        
        // Generate absolute values with some variation
        const delta_abs = this.randomInRange(ranges.delta_abs.min, ranges.delta_abs.max);
        const theta_abs = this.randomInRange(ranges.theta_abs.min, ranges.theta_abs.max);
        const alpha_abs = this.randomInRange(ranges.alpha_abs.min, ranges.alpha_abs.max);
        const beta_abs = this.randomInRange(ranges.beta_abs.min, ranges.beta_abs.max);
        const gamma_abs = this.randomInRange(ranges.gamma_abs.min, ranges.gamma_abs.max);

        // Calculate total for relative values
        const total = delta_abs + theta_abs + alpha_abs + beta_abs + gamma_abs;

        // Calculate relative values (proportions)
        const delta_rel = delta_abs / total;
        const theta_rel = theta_abs / total;
        const alpha_rel = alpha_abs / total;
        const beta_rel = beta_abs / total;
        const gamma_rel = gamma_abs / total;

        return {
            timestamp_ms: Date.now(),
            delta_abs: parseFloat(delta_abs.toFixed(6)),
            theta_abs: parseFloat(theta_abs.toFixed(6)),
            alpha_abs: parseFloat(alpha_abs.toFixed(6)),
            beta_abs: parseFloat(beta_abs.toFixed(6)),
            gamma_abs: parseFloat(gamma_abs.toFixed(6)),
            delta_rel: parseFloat(delta_rel.toFixed(5)),
            theta_rel: parseFloat(theta_rel.toFixed(5)),
            alpha_rel: parseFloat(alpha_rel.toFixed(5)),
            beta_rel: parseFloat(beta_rel.toFixed(5)),
            gamma_rel: parseFloat(gamma_rel.toFixed(5))
        };
    }

    /**
     * Generate random number in range
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number}
     */
    randomInRange(min, max) {
        return Math.random() * (max - min) + min;
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
     * Set sample rate
     * @param {number} rate - Samples per second (Hz)
     */
    setSampleRate(rate) {
        if (rate <= 0) {
            console.warn('EEGDataCollector: Invalid sample rate');
            return;
        }

        const wasCollecting = this.isCollecting;
        if (wasCollecting) {
            this.stop();
        }

        this.sampleRate = rate;

        if (wasCollecting) {
            this.start();
        }
    }
}
