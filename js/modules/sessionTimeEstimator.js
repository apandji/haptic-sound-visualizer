/**
 * Session Time Estimator Module
 * Calculates estimated session duration based on pattern count and timing configuration
 * 
 * Configuration is loaded from sessionTimingConfig.json
 * Future improvements:
 * - Load configuration from database/API
 * - Allow per-pattern timing variations based on pattern metadata
 * - Support different timing profiles (e.g., "quick test" vs "full session")
 * - Account for participant-specific factors
 * - Real-time adjustment based on actual trial durations
 */

class SessionTimeEstimator {
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
     * Create instance with config loaded from file
     * @param {string} configPath - Path to configuration JSON file
     * @returns {Promise<SessionTimeEstimator>} Instance with loaded config
     */
    static async create(configPath = 'js/modules/sessionTimingConfig.json') {
        const fileConfig = await SessionTimeEstimator.loadConfig(configPath);
        return new SessionTimeEstimator(fileConfig || {});
    }
    
    /**
     * Calculate estimated session duration in seconds
     * @param {number} patternCount - Number of patterns in the queue
     * @returns {number} Total duration in seconds
     */
    calculateDuration(patternCount) {
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
     * Format duration in seconds to human-readable string
     * @param {number} seconds - Duration in seconds
     * @returns {string} Formatted string (e.g., "5 minutes", "1 hour 15 minutes")
     */
    formatDuration(seconds) {
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        
        if (hours > 0) {
            if (remainingMinutes === 0) {
                return `${hours} hour${hours !== 1 ? 's' : ''}`;
            }
            return `${hours} hour${hours !== 1 ? 's' : ''} ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
        }
        
        if (minutes === 0) {
            return 'less than 1 minute';
        }
        
        return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
    
    /**
     * Get formatted session estimate
     * @param {number} patternCount - Number of patterns in the queue
     * @returns {Object} Object with patternCount, durationSeconds, and formattedDuration
     */
    getEstimate(patternCount) {
        const durationSeconds = this.calculateDuration(patternCount);
        return {
            patternCount,
            durationSeconds,
            formattedDuration: this.formatDuration(durationSeconds)
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
