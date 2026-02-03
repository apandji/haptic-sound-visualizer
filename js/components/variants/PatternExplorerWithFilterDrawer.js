/**
 * PatternExplorerWithFilterDrawer Variant
 * Composes PatternExplorer + FilterPanel with inline filters (like index.html)
 * 
 * Filters are displayed inline above the file list, matching the style from index.html
 */
class PatternExplorerWithFilterDrawer {
    constructor(options = {}) {
        // Required container IDs
        this.containerId = options.containerId || 'fileList';
        this.filterContainerId = options.filterContainerId || 'filters';
        
        // Get containers
        this.container = document.getElementById(this.containerId);
        this.filterContainer = document.getElementById(this.filterContainerId);
        
        if (!this.container) {
            console.error(`PatternExplorerWithFilterDrawer: Container #${this.containerId} not found`);
            return;
        }
        
        if (!this.filterContainer) {
            console.error(`PatternExplorerWithFilterDrawer: Filter container #${this.filterContainerId} not found`);
            return;
        }
        
        // Configuration
        this.allFiles = options.files || []; // All files (unfiltered)
        this.metadata = options.metadata || {};
        
        // FilterPanel options - match index.html style (compact, non-collapsible)
        this.searchPlaceholder = options.searchPlaceholder || 'Search files...';
        
        // PatternExplorer options
        this.showHeader = options.showHeader !== false; // Default to true
        this.showPreviewButton = options.showPreviewButton !== false; // Default to true
        this.showProgressBar = options.showProgressBar || false; // Default to false
        
        // Callbacks
        this.onFileClick = options.onFileClick || null;
        this.onFileHover = options.onFileHover || null;
        this.onFilePreview = options.onFilePreview || null;
        this.onPlayStateChange = options.onPlayStateChange || null;
        this.onFilterChange = options.onFilterChange || null; // Optional: called when filters change
        
        // State
        this.filteredFiles = [...this.allFiles]; // Start with all files
        
        // Initialize components
        this.init();
    }
    
    /**
     * Initialize PatternExplorer and FilterPanel (inline)
     */
    init() {
        // Create FilterPanel inline (compact, non-collapsible, matching index.html style)
        this.filterPanel = new FilterPanel({
            containerId: this.filterContainerId,
            metadata: this.metadata,
            compact: true, // Compact style like index.html
            collapsible: false, // Always visible, no collapse
            searchPlaceholder: this.searchPlaceholder,
            onFilterChange: (filters) => {
                this.handleFilterChange(filters);
            },
            onReset: () => {
                this.handleFilterReset();
            }
        });
        
        // Create PatternExplorer (no filter button)
        this.patternExplorer = new PatternExplorer({
            containerId: this.containerId,
            metadata: this.metadata,
            showHeader: this.showHeader,
            showPreviewButton: this.showPreviewButton,
            showProgressBar: this.showProgressBar,
            showFilterButton: false, // No filter button - filters are inline
            onFileClick: (file) => {
                if (this.onFileClick) {
                    this.onFileClick(file);
                }
            },
            onFileHover: (file, metadata, event) => {
                if (this.onFileHover) {
                    this.onFileHover(file, metadata, event);
                }
            },
            onFilePreview: (file, isPlaying) => {
                if (this.onFilePreview) {
                    this.onFilePreview(file, isPlaying);
                }
            },
            onPlayStateChange: (filePath, isPlaying) => {
                if (this.onPlayStateChange) {
                    this.onPlayStateChange(filePath, isPlaying);
                }
            }
        });
        
        // Initial render with all files
        this.updateFileList();
    }
    
    /**
     * Handle filter changes from FilterPanel
     */
    handleFilterChange(filters) {
        // Apply filters using Filters module
        if (typeof Filters !== 'undefined') {
            this.filteredFiles = Filters.applyFilters(this.allFiles, filters, this.metadata);
        } else {
            console.warn('PatternExplorerWithFilterDrawer: Filters module not loaded. Please include js/modules/filters.js');
            // Fallback: just use all files
            this.filteredFiles = [...this.allFiles];
        }
        
        // Update PatternExplorer with filtered files
        this.updateFileList();
        
        // Call optional callback
        if (this.onFilterChange) {
            this.onFilterChange(filters, this.filteredFiles);
        }
    }
    
    /**
     * Handle filter reset
     */
    handleFilterReset() {
        // Reset to all files
        this.filteredFiles = [...this.allFiles];
        this.updateFileList();
        
        // Call optional callback
        if (this.onFilterChange) {
            this.onFilterChange({}, this.filteredFiles);
        }
    }
    
    /**
     * Update PatternExplorer file list
     */
    updateFileList() {
        if (this.patternExplorer) {
            this.patternExplorer.render(this.filteredFiles);
        }
    }
    
    /**
     * Update files (e.g., when new files are loaded)
     */
    setFiles(files) {
        this.allFiles = files || [];
        // Re-apply current filters
        const currentFilters = this.filterPanel ? this.filterPanel.getFilters() : {};
        this.handleFilterChange(currentFilters);
    }
    
    /**
     * Update metadata (e.g., when metadata is loaded)
     */
    setMetadata(metadata) {
        this.metadata = metadata || {};
        
        // Update FilterPanel metadata
        if (this.filterPanel) {
            this.filterPanel.updateMetadata(this.metadata);
        }
        
        // Update PatternExplorer metadata
        if (this.patternExplorer) {
            this.patternExplorer.metadata = this.metadata;
        }
        
        // Re-apply filters with new metadata
        const currentFilters = this.filterPanel ? this.filterPanel.getFilters() : {};
        this.handleFilterChange(currentFilters);
    }
    
    /**
     * Set playing file state (for progress bar)
     */
    setPlayingFile(filePath, isPlaying) {
        if (this.patternExplorer) {
            this.patternExplorer.setPlayingFile(filePath, isPlaying);
        }
    }
    
    /**
     * Update progress for playing file
     */
    updateProgress(filePath, progress) {
        if (this.patternExplorer) {
            this.patternExplorer.updateProgress(filePath, progress);
        }
    }
    
    
    /**
     * Get current filtered files
     */
    getFilteredFiles() {
        return [...this.filteredFiles];
    }
    
    /**
     * Get current filter values
     */
    getFilters() {
        return this.filterPanel ? this.filterPanel.getFilters() : {};
    }
    
    /**
     * Set filter values programmatically
     */
    setFilters(filters) {
        if (this.filterPanel) {
            this.filterPanel.setFilters(filters);
            // This will trigger handleFilterChange via onFilterChange callback
        }
    }
    
    /**
     * Reset all filters
     */
    resetFilters() {
        if (this.filterPanel) {
            this.filterPanel.reset();
        }
    }
    
    /**
     * Destroy components and cleanup
     */
    destroy() {
        if (this.filterPanel && typeof this.filterPanel.destroy === 'function') {
            this.filterPanel.destroy();
        }
        
        // PatternExplorer doesn't have a destroy method yet, but we can clear it
        if (this.patternExplorer && this.patternExplorer.container) {
            this.patternExplorer.container.innerHTML = '';
        }
        
        this.filterPanel = null;
        this.patternExplorer = null;
    }
}
