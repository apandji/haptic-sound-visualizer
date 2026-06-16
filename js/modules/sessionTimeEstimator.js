/**
 * Session Time Estimator Module
 * Calculates estimated session duration based on pattern count.
 *
 * Two sources, in order of preference:
 * 1. Empirical stats from GET /api/timing-stats (median + IQR of recorded
 *    trial cycles and session setup time). Used when enough trials exist.
 * 2. Static configuration from sessionTimingConfig.json (fallback for
 *    static hosting, missing DB, or sparse data).
 *
 * Empirical estimates are shown as a range (p25–p75 per trial, scaled by
 * pattern count) so the UI communicates uncertainty instead of a falsely
 * precise single number.
 */

class SessionTimeEstimator {
    // Below this many recorded trials, fall back to config-based estimates.
    static MIN_EMPIRICAL_TRIALS = 8;

    constructor(config = {}) {
        // Load default config from JSON file (will be loaded asynchronously if needed)
        this.defaultConfig = {
            calibrationDuration: 60,
            baselineDuration: 30,
            stimulationDuration: 30,
            taggingDuration: 10
        };

        // Timing configuration (in seconds)
        // Config can be provided directly, or will use defaults
        this.config = {
            calibrationDuration: config.calibrationDuration || this.defaultConfig.calibrationDuration,
            baselineDuration: config.baselineDuration || this.defaultConfig.baselineDuration,
            stimulationDuration: config.stimulationDuration || this.defaultConfig.stimulationDuration,
            taggingDuration: config.taggingDuration || config.surveyDurationEstimate || this.defaultConfig.taggingDuration,
        };

        this.empiricalStats = null;
    }

    /**
     * Load configuration from JSON file
     * @param {string} configPath - Path to configuration JSON file
     * @returns {Promise<Object>} Configuration object
     */
    static async loadConfig(configPath = 'js/modules/sessionTimingConfig.json') {
        try {
            const response = await fetch(configPath);
            if (!response.ok) {
                throw new Error(`Failed to load config: ${response.statusText}`);
            }
            const config = await response.json();
            // Remove comment fields
            const { _comment, ...cleanConfig } = config;
            return cleanConfig;
        } catch (error) {
            console.warn(`SessionTimeEstimator: Could not load config from ${configPath}, using defaults:`, error);
            return null;
        }
    }

    /**
     * Load empirical timing stats from the API.
     * Returns null when the API is unavailable (e.g. static hosting).
     * @param {string} statsUrl
     * @returns {Promise<Object|null>}
     */
    static async loadEmpiricalStats(statsUrl = '/api/timing-stats') {
        try {
            const response = await fetch(statsUrl);
            if (!response.ok) {
                throw new Error(`Failed to load timing stats: ${response.statusText}`);
            }
            const stats = await response.json();
            if (stats && stats.trial && typeof stats.trial.medianSec === 'number') {
                return stats;
            }
            return null;
        } catch (error) {
            console.warn('SessionTimeEstimator: Empirical timing stats unavailable, using config estimates:', error);
            return null;
        }
    }

    /**
     * Create instance with config loaded from file and empirical stats from the API.
     * @param {string} configPath - Path to configuration JSON file
     * @param {string} statsUrl - Timing stats API endpoint
     * @returns {Promise<SessionTimeEstimator>} Instance with loaded config
     */
    static async create(configPath = 'js/modules/sessionTimingConfig.json', statsUrl = '/api/timing-stats') {
        const [fileConfig, empiricalStats] = await Promise.all([
            SessionTimeEstimator.loadConfig(configPath),
            SessionTimeEstimator.loadEmpiricalStats(statsUrl)
        ]);
        const estimator = new SessionTimeEstimator(fileConfig || {});
        estimator.setEmpiricalStats(empiricalStats);
        return estimator;
    }

    /**
     * Attach empirical timing stats (shape returned by /api/timing-stats).
     * @param {Object|null} stats
     */
    setEmpiricalStats(stats) {
        this.empiricalStats = stats || null;
    }

    /**
     * Whether enough recorded trials exist to trust empirical estimates.
     * @returns {boolean}
     */
    hasEmpiricalData() {
        const n = this.empiricalStats?.trial?.n || 0;
        return n >= SessionTimeEstimator.MIN_EMPIRICAL_TRIALS;
    }

    /**
     * Median setup time (session start to first trial). Falls back to the
     * configured calibration duration when there is no usable setup sample.
     * @returns {number} seconds
     */
    getSetupSeconds() {
        const setup = this.empiricalStats?.setup;
        if (setup && setup.n > 0 && typeof setup.medianSec === 'number') {
            return setup.medianSec;
        }
        return this.config.calibrationDuration;
    }

    /**
     * Calculate estimated session duration in seconds
     * @param {number} patternCount - Number of patterns in the queue
     * @returns {number} Total duration in seconds
     */
    calculateDuration(patternCount) {
        if (this.hasEmpiricalData()) {
            if (patternCount === 0) {
                return this.getSetupSeconds();
            }
            return this.getSetupSeconds() + (patternCount * this.empiricalStats.trial.medianSec);
        }

        if (patternCount === 0) {
            return this.config.calibrationDuration;
        }

        // Calibration + (baseline + stimulation + tagging) per pattern
        const perPatternDuration =
            this.config.baselineDuration +
            this.config.stimulationDuration +
            this.config.taggingDuration;

        return this.config.calibrationDuration + (patternCount * perPatternDuration);
    }

    /**
     * Calculate an uncertainty range for the session duration.
     * Uses per-trial p25/p75 scaled by pattern count. Only available when
     * empirical data exists; returns null otherwise.
     * @param {number} patternCount
     * @returns {{lowSeconds: number, highSeconds: number}|null}
     */
    calculateRange(patternCount) {
        if (!this.hasEmpiricalData() || patternCount === 0) {
            return null;
        }
        const setup = this.getSetupSeconds();
        const trial = this.empiricalStats.trial;
        return {
            lowSeconds: setup + (patternCount * trial.p25Sec),
            highSeconds: setup + (patternCount * trial.p75Sec)
        };
    }

    /**
     * Format duration in seconds to human-readable string
     * @param {number} seconds - Duration in seconds
     * @returns {string} Formatted string (e.g., "5 minutes", "1 hour 15 minutes")
     */
    formatDuration(seconds) {
        const minutes = Math.floor(seconds / 60);

        if (minutes === 0) {
            return 'less than 1 minute';
        }

        return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }

    /**
     * Compact duration format for ranges (e.g. "8 min", "66 min").
     * @param {number} seconds
     * @returns {string}
     */
    formatShortDuration(seconds) {
        const totalMinutes = Math.round(seconds / 60);
        if (totalMinutes < 1) {
            return '<1 min';
        }
        return `${totalMinutes} min`;
    }

    /**
     * Format an uncertainty range (e.g. "8–11 min", "55 min – 1 hr 10 min").
     * @param {number} lowSeconds
     * @param {number} highSeconds
     * @returns {string}
     */
    formatRange(lowSeconds, highSeconds) {
        const lowMinutes = Math.round(lowSeconds / 60);
        const highMinutes = Math.round(highSeconds / 60);

        if (lowMinutes === highMinutes) {
            return `~${this.formatShortDuration(highSeconds)}`;
        }
        return `${lowMinutes}–${highMinutes} min`;
    }

    /**
     * Get formatted session estimate.
     * When empirical data is available, `formattedDuration` is a range and
     * `source` is "empirical"; otherwise it is a single config-based value.
     * @param {number} patternCount - Number of patterns in the queue
     * @returns {Object} Estimate with durations, formatted label, and provenance
     */
    getEstimate(patternCount) {
        const durationSeconds = this.calculateDuration(patternCount);
        const range = this.calculateRange(patternCount);

        if (range) {
            const trialN = this.empiricalStats.trial.n;
            const maxObservedQueue = this.empiricalStats.maxObservedQueue || 0;
            const extrapolated = maxObservedQueue > 0 && patternCount > maxObservedQueue;
            let basisLabel = `Based on ${trialN} recorded trials (middle 50% of trial times).`;
            if (extrapolated) {
                basisLabel += ` Longest recorded session had ${maxObservedQueue} patterns; longer queues are extrapolated.`;
            }
            return {
                patternCount,
                durationSeconds,
                lowSeconds: range.lowSeconds,
                highSeconds: range.highSeconds,
                formattedDuration: this.formatRange(range.lowSeconds, range.highSeconds),
                source: 'empirical',
                extrapolated,
                basisLabel
            };
        }

        return {
            patternCount,
            durationSeconds,
            lowSeconds: durationSeconds,
            highSeconds: durationSeconds,
            formattedDuration: this.formatDuration(durationSeconds),
            source: 'config',
            extrapolated: false,
            basisLabel: 'Based on configured phase durations (no recorded trial data yet).'
        };
    }

    /**
     * Update configuration
     * @param {Object} newConfig - Partial configuration object
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Get current configuration
     * @returns {Object} Current configuration
     */
    getConfig() {
        return { ...this.config };
    }
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SessionTimeEstimator;
}
