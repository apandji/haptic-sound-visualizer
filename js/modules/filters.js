/**
 * Filter Module
 * Pure functions for applying filters to file lists
 * No DOM dependencies - can be tested independently
 */

/**
 * Apply all filters to a file list
 * 
 * @param {Array} files - Array of file objects with at least a `name` property
 * @param {Object} filters - Filter object from FilterPanel
 *   {
 *     search: string,           // Search query (case-insensitive)
 *     rms: [min, max],          // RMS mean range
 *     duration: [min, max],     // Duration range (seconds)
 *     balance: [min, max],      // Stereo balance range
 *     movement: [min, max]      // Stereo movement range
 *   }
 * @param {Object} metadata - Metadata object keyed by filename
 *   {
 *     "filename.mp3": {
 *       rms_mean: number,
 *       duration: number,
 *       stereo_balance: number,
 *       stereo_movement: number
 *     }
 *   }
 * @returns {Array} Filtered array of files
 */
function applyFilters(files, filters, metadata = {}) {
    if (!files || files.length === 0) {
        return [];
    }
    
    // If no filters provided, return all files
    if (!filters) {
        return files;
    }
    
    return files.filter(file => {
        // Search filter (case-insensitive)
        if (filters.search) {
            const searchQuery = filters.search.trim().toLowerCase();
            if (searchQuery && !file.name.toLowerCase().includes(searchQuery)) {
                return false;
            }
        }
        
        // Get metadata for this file
        const fileMetadata = metadata[file.name];
        
        // If no metadata, include file (don't filter it out by metadata filters)
        // This matches the original behavior: files without metadata pass through
        if (!fileMetadata) {
            return true;
        }
        
        // Apply metadata filters (AND logic - all must pass)
        const rmsMatch = filterByRange(
            fileMetadata.rms_mean,
            filters.rms,
            -Infinity,
            Infinity
        );
        
        const durationMatch = filterByRange(
            fileMetadata.duration,
            filters.duration,
            -Infinity,
            Infinity
        );
        
        const balanceMatch = filterByRange(
            fileMetadata.stereo_balance,
            filters.balance,
            -Infinity,
            Infinity
        );
        
        const movementMatch = filterByRange(
            fileMetadata.stereo_movement,
            filters.movement,
            -Infinity,
            Infinity
        );
        
        return rmsMatch && durationMatch && balanceMatch && movementMatch;
    });
}

/**
 * Filter a value by range
 * 
 * @param {number} value - Value to check
 * @param {Array|null|undefined} range - [min, max] range, or null/undefined to skip
 * @param {number} defaultMin - Default min if range not provided
 * @param {number} defaultMax - Default max if range not provided
 * @returns {boolean} True if value is within range
 */
function filterByRange(value, range, defaultMin = -Infinity, defaultMax = Infinity) {
    // If no range filter provided, always pass
    if (!range || !Array.isArray(range) || range.length !== 2) {
        return true;
    }
    
    const [min, max] = range;
    const minValue = min !== null && min !== undefined ? min : defaultMin;
    const maxValue = max !== null && max !== undefined ? max : defaultMax;
    
    return value >= minValue && value <= maxValue;
}

/**
 * Filter files by search query
 * 
 * @param {Array} files - Array of file objects
 * @param {string} searchQuery - Search query (case-insensitive)
 * @returns {Array} Filtered files
 */
function filterBySearch(files, searchQuery) {
    if (!searchQuery || !searchQuery.trim()) {
        return files;
    }
    
    const query = searchQuery.trim().toLowerCase();
    return files.filter(file => 
        file.name.toLowerCase().includes(query)
    );
}

/**
 * Filter files by metadata ranges
 * 
 * @param {Array} files - Array of file objects
 * @param {Object} filters - Filter ranges object
 *   {
 *     rms: [min, max],
 *     duration: [min, max],
 *     balance: [min, max],
 *     movement: [min, max]
 *   }
 * @param {Object} metadata - Metadata object keyed by filename
 * @returns {Array} Filtered files
 */
function filterByMetadata(files, filters, metadata = {}) {
    if (!filters || Object.keys(filters).length === 0) {
        return files;
    }
    
    return files.filter(file => {
        const fileMetadata = metadata[file.name];
        
        // If no metadata, include file (don't filter it out)
        if (!fileMetadata) {
            return true;
        }
        
        // Check all metadata filters (AND logic)
        const checks = [];
        
        if (filters.rms) {
            checks.push(filterByRange(fileMetadata.rms_mean, filters.rms));
        }
        
        if (filters.duration) {
            checks.push(filterByRange(fileMetadata.duration, filters.duration));
        }
        
        if (filters.balance) {
            checks.push(filterByRange(fileMetadata.stereo_balance, filters.balance));
        }
        
        if (filters.movement) {
            checks.push(filterByRange(fileMetadata.stereo_movement, filters.movement));
        }
        
        // All checks must pass (AND logic)
        return checks.length === 0 || checks.every(check => check === true);
    });
}

/**
 * Calculate min/max ranges from metadata
 * 
 * @param {Object} metadata - Metadata object keyed by filename
 * @returns {Object} Ranges object
 *   {
 *     rms: { min: number, max: number },
 *     duration: { min: number, max: number },
 *     balance: { min: number, max: number },
 *     movement: { min: number, max: number }
 *   }
 */
function calculateRanges(metadata = {}) {
    const ranges = {
        rms: { min: Infinity, max: -Infinity },
        duration: { min: Infinity, max: -Infinity },
        balance: { min: Infinity, max: -Infinity },
        movement: { min: Infinity, max: -Infinity }
    };
    
    // If no metadata, return default ranges
    if (!metadata || Object.keys(metadata).length === 0) {
        return {
            rms: { min: 0, max: 1 },
            duration: { min: 0, max: 10 },
            balance: { min: -1, max: 1 },
            movement: { min: 0, max: 1 }
        };
    }
    
    // Calculate min/max for each property
    Object.values(metadata).forEach(fileMetadata => {
        if (fileMetadata.rms_mean !== undefined) {
            ranges.rms.min = Math.min(ranges.rms.min, fileMetadata.rms_mean);
            ranges.rms.max = Math.max(ranges.rms.max, fileMetadata.rms_mean);
        }
        
        if (fileMetadata.duration !== undefined) {
            ranges.duration.min = Math.min(ranges.duration.min, fileMetadata.duration);
            ranges.duration.max = Math.max(ranges.duration.max, fileMetadata.duration);
        }
        
        if (fileMetadata.stereo_balance !== undefined) {
            ranges.balance.min = Math.min(ranges.balance.min, fileMetadata.stereo_balance);
            ranges.balance.max = Math.max(ranges.balance.max, fileMetadata.stereo_balance);
        }
        
        if (fileMetadata.stereo_movement !== undefined) {
            ranges.movement.min = Math.min(ranges.movement.min, fileMetadata.stereo_movement);
            ranges.movement.max = Math.max(ranges.movement.max, fileMetadata.stereo_movement);
        }
    });
    
    // Add padding (1% of range) to min/max
    Object.keys(ranges).forEach(key => {
        const range = ranges[key];
        if (range.min !== Infinity && range.max !== -Infinity) {
            const padding = (range.max - range.min) * 0.01;
            range.min = Math.max(0, range.min - padding); // Don't go below 0 for non-negative values
            range.max = range.max + padding;
        } else {
            // Fallback to defaults if no data
            const defaults = {
                rms: { min: 0, max: 1 },
                duration: { min: 0, max: 10 },
                balance: { min: -1, max: 1 },
                movement: { min: 0, max: 1 }
            };
            ranges[key] = defaults[key] || { min: 0, max: 1 };
        }
    });
    
    return ranges;
}

// Export functions (for use in modules or as global functions)
if (typeof module !== 'undefined' && module.exports) {
    // Node.js/CommonJS
    module.exports = {
        applyFilters,
        filterBySearch,
        filterByMetadata,
        filterByRange,
        calculateRanges
    };
} else {
    // Browser/global scope
    window.Filters = {
        applyFilters,
        filterBySearch,
        filterByMetadata,
        filterByRange,
        calculateRanges
    };
}
