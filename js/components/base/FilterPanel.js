/**
 * FilterPanel Component
 * Search box + multiple dual sliders for filtering audio files
 */
class FilterPanel {
    constructor(options = {}) {
        // Required options
        this.containerId = options.containerId || 'filterPanel';
        this.container = document.getElementById(this.containerId);
        
        if (!this.container) {
            console.error(`FilterPanel: Container #${this.containerId} not found`);
            return;
        }
        
        // Configuration
        this.metadata = options.metadata || {};
        this.filters = options.filters || this.getDefaultFilters();
        this.compact = options.compact || false; // Compact mode for PatternExplorer
        this.collapsible = options.collapsible || false; // Collapsible/expandable filters
        this.defaultCollapsed = options.defaultCollapsed !== undefined ? options.defaultCollapsed : (this.collapsible ? true : false);
        this.searchPlaceholder = options.searchPlaceholder || (this.compact ? 'Search patterns...' : 'Search files...');
        this.includeSearch = options.includeSearch !== undefined ? options.includeSearch : true; // Whether to include search box in FilterPanel
        
        // Callbacks
        this.onFilterChange = options.onFilterChange || null;
        this.onReset = options.onReset || null;
        this.onToggle = options.onToggle || null; // Called when collapsed/expanded
        
        // Calculate ranges from metadata if provided
        this.ranges = this.calculateRanges(this.metadata);
        
        // State
        this.searchQuery = '';
        this.sliders = {}; // Store DualSlider instances
        this.isCollapsed = this.defaultCollapsed;
        
        // Load saved state from localStorage if collapsible
        if (this.collapsible) {
            const savedState = localStorage.getItem(`filterPanel_${this.containerId}_collapsed`);
            if (savedState !== null) {
                this.isCollapsed = savedState === 'true';
            }
        }
        
        // Initialize
        this.init();
    }
    
    /**
     * Get default filter configuration
     */
    getDefaultFilters() {
        return {
            rms: {
                min: 0,
                max: 1,
                step: 0.001,
                label: 'RMS',
                tooltip: 'RMS Mean: Average Root Mean Square amplitude. Measures overall loudness/intensity of the audio. Higher values indicate louder audio.',
                formatValue: (val) => val.toFixed(3),
                metadataKey: 'rms_mean'
            },
            duration: {
                min: 0,
                max: 50,
                step: 0.1,
                label: 'Duration',
                tooltip: 'Duration: Length of the audio file in seconds.',
                formatValue: (val) => val.toFixed(1) + 's',
                metadataKey: 'duration'
            },
            balance: {
                min: -1,
                max: 1,
                step: 0.01,
                label: 'Balance',
                tooltip: 'Stereo Balance: Left/right channel balance. Range: -1.0 (fully left) to 1.0 (fully right). 0.0 = centered/mono.',
                formatValue: (val) => val.toFixed(2),
                metadataKey: 'stereo_balance'
            },
            movement: {
                min: 0,
                max: 1,
                step: 0.01,
                label: 'Movement',
                tooltip: 'Stereo Movement: How much the stereo field changes over time. Range: 0.0 (no movement) to ~0.86 (high movement). Measures variance in stereo positioning.',
                formatValue: (val) => val.toFixed(2),
                metadataKey: 'stereo_movement'
            }
        };
    }
    
    /**
     * Calculate min/max ranges from metadata
     */
    calculateRanges(metadata) {
        const ranges = {};
        
        Object.keys(this.filters).forEach(filterKey => {
            const filter = this.filters[filterKey];
            const metadataKey = filter.metadataKey || filterKey;
            
            // Default to filter's min/max
            let min = filter.min;
            let max = filter.max;
            
            // Calculate from metadata if available
            if (metadata && Object.keys(metadata).length > 0) {
                const values = [];
                Object.values(metadata).forEach(fileMetadata => {
                    if (fileMetadata[metadataKey] !== undefined) {
                        values.push(fileMetadata[metadataKey]);
                    }
                });
                
                if (values.length > 0) {
                    min = Math.min(...values);
                    max = Math.max(...values);
                    // Add small padding
                    const padding = (max - min) * 0.01;
                    min = Math.max(filter.min, min - padding);
                    max = Math.min(filter.max, max + padding);
                }
            }
            
            ranges[filterKey] = { min, max };
        });
        
        return ranges;
    }
    
    /**
     * Initialize the filter panel
     */
    init() {
        this.createHTML();
        this.createSliders();
        this.setupEventListeners();
        
        // Set initial collapsed state
        if (this.collapsible) {
            this.updateCollapsedState();
        }
        
        // Update RESET button initial state (after sliders are created)
        setTimeout(() => {
            this.updateResetButtonState(this.getFilters());
        }, 0);
    }
    
    /**
     * Create HTML structure
     */
    createHTML() {
        // Add compact class if in compact mode
        if (this.compact) {
            this.container.classList.add('filter-panel--compact');
        }
        
        // Add collapsible class if collapsible
        if (this.collapsible) {
            this.container.classList.add('filter-panel--collapsible');
            if (this.isCollapsed) {
                this.container.classList.add('filter-panel--collapsed');
            }
        }
        
        // Create collapsible header if needed
        let headerHTML = '';
        if (this.collapsible) {
            // Brutalistic icon: use + / - instead of arrows
            const icon = this.isCollapsed ? '+' : '−';
            headerHTML = `
                <button class="filter-panel__toggle" id="${this.containerId}_toggle" aria-expanded="${!this.isCollapsed}">
                    <span class="filter-panel__toggle-icon">${icon}</span>
                    <span class="filter-panel__toggle-label">FILTERS</span>
                </button>
            `;
        }
        
        // Only include search if includeSearch is true
        const searchHTML = this.includeSearch ? `
            <div class="filter-panel__search">
                <input type="text" 
                       class="filter-panel__search-input" 
                       id="${this.containerId}_search" 
                       placeholder="${this.searchPlaceholder}" 
                       autocomplete="off">
            </div>
        ` : '';
        
        this.container.innerHTML = `
            ${headerHTML}
            <div class="filter-panel__content" id="${this.containerId}_content">
                ${searchHTML}
                <div class="filter-panel__sliders" id="${this.containerId}_sliders"></div>
                <button class="filter-panel__reset" id="${this.containerId}_reset">RESET</button>
            </div>
        `;
    }
    
    /**
     * Create DualSlider instances
     */
    createSliders() {
        const slidersContainer = document.getElementById(`${this.containerId}_sliders`);
        
        Object.keys(this.filters).forEach(filterKey => {
            const filter = this.filters[filterKey];
            const range = this.ranges[filterKey];
            
            // Create filter group
            const group = document.createElement('div');
            group.className = 'filter-panel__group';
            
            // Create label with tooltip
            const label = document.createElement('label');
            label.className = 'filter-panel__label';
            if (filter.tooltip) {
                label.setAttribute('data-tooltip', filter.tooltip);
                label.title = filter.tooltip;
            }
            
            const labelText = document.createElement('span');
            labelText.className = 'filter-panel__label-text';
            labelText.textContent = filter.label;
            
            const display = document.createElement('span');
            display.className = 'filter-panel__display';
            display.id = `${this.containerId}_${filterKey}_display`;
            
            label.appendChild(labelText);
            label.appendChild(display);
            
            // Create slider container
            const sliderContainer = document.createElement('div');
            sliderContainer.id = `${this.containerId}_${filterKey}_slider`;
            sliderContainer.className = 'dual-slider';
            
            // Add compact class if in compact mode
            if (this.compact) {
                sliderContainer.classList.add('dual-slider--compact');
            }
            
            // Assemble group first (so element is in DOM)
            group.appendChild(label);
            group.appendChild(sliderContainer);
            slidersContainer.appendChild(group);
            
            // Create DualSlider instance (after element is in DOM)
            const slider = new DualSlider({
                containerId: sliderContainer.id,
                min: range.min,
                max: range.max,
                step: filter.step,
                label: filter.label,
                initialMin: range.min,
                initialMax: range.max,
                formatValue: filter.formatValue,
                onChange: (min, max) => {
                    this.handleFilterChange();
                }
            });
            
            // Set display element
            slider.display = display;
            slider.updateSlider();
            
            // Store slider instance
            this.sliders[filterKey] = slider;
        });
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Toggle button (if collapsible)
        if (this.collapsible) {
            const toggleBtn = document.getElementById(`${this.containerId}_toggle`);
            if (toggleBtn) {
                toggleBtn.addEventListener('click', () => {
                    this.toggle();
                });
            }
        }
        
        // Search input (only if included in FilterPanel)
        const searchInput = document.getElementById(`${this.containerId}_search`);
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.trim().toLowerCase();
                this.handleFilterChange();
            });
        }
        
        // Reset button
        const resetBtn = document.getElementById(`${this.containerId}_reset`);
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.reset();
            });
        }
    }
    
    /**
     * Handle filter change
     */
    handleFilterChange() {
        const filters = this.getFilters();
        
        // Update RESET button state based on whether filters are active
        this.updateResetButtonState(filters);
        
        if (this.onFilterChange) {
            this.onFilterChange(filters);
        }
    }
    
    /**
     * Check if filters are active (not at default values)
     */
    hasActiveFilters(filters) {
        // Check search query
        if (this.searchQuery && this.searchQuery.trim() !== '') {
            return true;
        }
        
        // Check slider values
        for (const filterKey in filters) {
            if (filterKey === 'search') continue;
            
            if (filters[filterKey] && Array.isArray(filters[filterKey])) {
                const [min, max] = filters[filterKey];
                const range = this.ranges[filterKey];
                
                // Check if values differ from full range
                if (range && (min !== range.min || max !== range.max)) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    /**
     * Update RESET button visual state based on active filters
     */
    updateResetButtonState(filters) {
        const resetBtn = document.getElementById(`${this.containerId}_reset`);
        if (resetBtn) {
            if (this.hasActiveFilters(filters)) {
                resetBtn.classList.add('has-active-filters');
            } else {
                resetBtn.classList.remove('has-active-filters');
            }
        }
    }
    
    /**
     * Get current filter values
     */
    getFilters() {
        const filters = {
            search: this.searchQuery
        };
        
        Object.keys(this.sliders).forEach(filterKey => {
            const slider = this.sliders[filterKey];
            const values = slider.getValues();
            filters[filterKey] = [values.min, values.max];
        });
        
        return filters;
    }
    
    /**
     * Set filter values programmatically
     */
    setFilters(filters) {
        // Set search
        if (filters.search !== undefined) {
            const searchInput = document.getElementById(`${this.containerId}_search`);
            if (searchInput) {
                searchInput.value = filters.search;
                this.searchQuery = filters.search.trim().toLowerCase();
            }
        }
        
        // Set sliders
        Object.keys(filters).forEach(filterKey => {
            if (filterKey === 'search') return;
            
            const slider = this.sliders[filterKey];
            if (slider && Array.isArray(filters[filterKey])) {
                const [min, max] = filters[filterKey];
                slider.setValues(min, max);
            }
        });
        
        this.handleFilterChange();
    }
    
    /**
     * Reset all filters
     */
    reset() {
        // Reset search
        const searchInput = document.getElementById(`${this.containerId}_search`);
        if (searchInput) {
            searchInput.value = '';
            this.searchQuery = '';
        }
        
        // Reset sliders
        Object.values(this.sliders).forEach(slider => {
            slider.reset();
        });
        
        // Call reset callback
        if (this.onReset) {
            this.onReset();
        }
        
        // Trigger filter change
        this.handleFilterChange();
    }
    
    /**
     * Toggle collapsed/expanded state
     */
    toggle() {
        this.isCollapsed = !this.isCollapsed;
        this.updateCollapsedState();
        
        // Save state to localStorage
        if (this.collapsible) {
            localStorage.setItem(`filterPanel_${this.containerId}_collapsed`, this.isCollapsed.toString());
        }
        
        // Call toggle callback
        if (this.onToggle) {
            this.onToggle(this.isCollapsed);
        }
    }
    
    /**
     * Update collapsed state visually
     */
    updateCollapsedState() {
        const content = document.getElementById(`${this.containerId}_content`);
        const toggleBtn = document.getElementById(`${this.containerId}_toggle`);
        const toggleIcon = toggleBtn ? toggleBtn.querySelector('.filter-panel__toggle-icon') : null;
        
        if (this.isCollapsed) {
            this.container.classList.add('filter-panel--collapsed');
            if (content) content.style.display = 'none';
            if (toggleIcon) toggleIcon.textContent = '+';
            if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
        } else {
            this.container.classList.remove('filter-panel--collapsed');
            if (content) content.style.display = '';
            if (toggleIcon) toggleIcon.textContent = '−';
            if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
            
            // Recalculate slider positions when expanding (in case container width changed)
            // Use setTimeout to ensure DOM has updated
            setTimeout(() => {
                Object.values(this.sliders).forEach(slider => {
                    if (slider && typeof slider.updateSlider === 'function') {
                        slider.updateSlider();
                    }
                });
            }, 50);
        }
    }
    
    /**
     * Update metadata and recalculate ranges
     */
    updateMetadata(metadata) {
        this.metadata = metadata || {};
        this.ranges = this.calculateRanges(this.metadata);
        
        // Update slider ranges
        Object.keys(this.sliders).forEach(filterKey => {
            const slider = this.sliders[filterKey];
            const range = this.ranges[filterKey];
            
            // Update min/max and reset
            slider.min = range.min;
            slider.max = range.max;
            slider.reset();
        });
    }
    
    /**
     * Cleanup
     */
    destroy() {
        // Destroy all sliders
        Object.values(this.sliders).forEach(slider => {
            slider.destroy();
        });
        
        // Clear container
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}

// Export if using modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FilterPanel;
}
