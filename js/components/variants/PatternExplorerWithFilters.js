/**
 * PatternExplorerWithFilters Variant
 * Composes PatternExplorer + FilterPanel with automatic filtering
 * 
 * This variant automatically wires FilterPanel changes to PatternExplorer,
 * applying filters and updating the file list.
 */
class PatternExplorerWithFilters {
    constructor(options = {}) {
        // Required container IDs
        this.containerId = options.containerId || 'fileList';
        this.filterContainerId = options.filterContainerId || 'filterPanel';
        
        // Get containers
        this.container = document.getElementById(this.containerId);
        this.filterContainer = document.getElementById(this.filterContainerId);
        
        if (!this.container) {
            console.error(`PatternExplorerWithFilters: Container #${this.containerId} not found`);
            return;
        }
        
        if (!this.filterContainer) {
            console.error(`PatternExplorerWithFilters: Filter container #${this.filterContainerId} not found`);
            return;
        }
        
        // Configuration
        this.allFiles = options.files || []; // All files (unfiltered)
        this.metadata = options.metadata || {};
        
        // FilterPanel options - new structure: header → search → collapsible filters
        this.compact = options.compact !== undefined ? options.compact : true; // Default to compact
        this.collapsible = options.collapsible !== undefined ? options.collapsible : true; // Default to collapsible
        this.defaultCollapsed = options.defaultCollapsed !== undefined ? options.defaultCollapsed : true; // Default to collapsed
        this.searchPlaceholder = options.searchPlaceholder || 'Search patterns...';
        
        // Get parent container for restructuring
        this.parentContainer = this.container.parentElement;
        
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
     * Initialize PatternExplorer and FilterPanel with new structure:
     * Wrapper (sticky) → Header → Search → Collapsible Filters → File List
     */
    init() {
        if (!this.parentContainer) {
            console.error('PatternExplorerWithFilters: Parent container not found');
            return;
        }
        
        // 1. Create sticky wrapper container (like index.html's #filters)
        const wrapper = this.createStickyWrapper();
        if (!wrapper) {
            console.error('PatternExplorerWithFilters: Failed to create sticky wrapper');
            return;
        }
        
        // 2. Ensure filter container exists and is inside sticky wrapper
        let filterContainer = document.getElementById(this.filterContainerId);
        if (!filterContainer) {
            // Create filter container if it doesn't exist
            filterContainer = document.createElement('div');
            filterContainer.id = this.filterContainerId;
            wrapper.appendChild(filterContainer);
        } else if (filterContainer.parentElement !== wrapper) {
            // Move filter container into sticky wrapper if it exists elsewhere
            wrapper.appendChild(filterContainer);
        }
        
        // 3. Move existing header/search into wrapper if they exist
        const existingHeader = this.parentContainer.querySelector('.pattern-explorer-header');
        if (existingHeader && existingHeader.parentElement !== wrapper) {
            wrapper.insertBefore(existingHeader, wrapper.firstChild);
        }
        
        const existingSearch = this.parentContainer.querySelector('.pattern-explorer-search');
        if (existingSearch && existingSearch.parentElement !== wrapper) {
            // Insert after header if it exists, otherwise at start
            const header = wrapper.querySelector('.pattern-explorer-header');
            if (header) {
                wrapper.insertBefore(existingSearch, header.nextSibling);
            } else {
                wrapper.insertBefore(existingSearch, wrapper.firstChild);
            }
        }
        
        // 4. Create PATTERN EXPLORER header inside wrapper (if it doesn't exist)
        this.createHeader();
        
        // 5. Create search box inside wrapper (if it doesn't exist)
        this.createSearchBox();
        
        // 5. Create FilterPanel (sliders only, no search, collapsible, in well)
        this.filterPanel = new FilterPanel({
            containerId: this.filterContainerId,
            metadata: this.metadata,
            compact: this.compact,
            collapsible: this.collapsible,
            defaultCollapsed: this.defaultCollapsed,
            searchPlaceholder: this.searchPlaceholder,
            includeSearch: false, // Don't include search - we create it separately
            onFilterChange: (filters) => {
                // Merge search query into filters
                filters.search = this.searchQuery;
                this.handleFilterChange(filters);
            },
            onReset: () => {
                // Also reset search
                if (this.searchInput) {
                    this.searchInput.value = '';
                    this.searchQuery = '';
                }
                this.handleFilterReset();
            }
        });
        
        // 6. Create PatternExplorer (no header - we create it separately)
        this.patternExplorer = new PatternExplorer({
            containerId: this.containerId,
            metadata: this.metadata,
            showHeader: false, // We create header separately
            showPreviewButton: this.showPreviewButton,
            showProgressBar: this.showProgressBar,
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
     * Create sticky wrapper container (like index.html's #filters)
     * This wraps header + search + filters in a single sticky unit
     */
    createStickyWrapper() {
        if (!this.parentContainer) {
            console.error('PatternExplorerWithFilters: parentContainer not set');
            return null;
        }
        
        // Check if wrapper already exists
        let wrapper = this.parentContainer.querySelector('.pattern-explorer-sticky-wrapper');
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.className = 'pattern-explorer-sticky-wrapper';
            
            // Insert at the beginning of parent container, before file list
            // Find where to insert (before fileList, or at start)
            const fileList = document.getElementById(this.containerId);
            const insertBefore = fileList || this.parentContainer.firstChild;
            
            if (insertBefore) {
                this.parentContainer.insertBefore(wrapper, insertBefore);
            } else {
                this.parentContainer.appendChild(wrapper);
            }
        }
        
        this.stickyWrapper = wrapper;
        return wrapper;
    }
    
    /**
     * Create PATTERN EXPLORER header (inside sticky wrapper)
     */
    createHeader() {
        if (!this.stickyWrapper) {
            this.createStickyWrapper();
        }
        
        // Check if header exists in wrapper first
        let header = this.stickyWrapper.querySelector('.pattern-explorer-header');
        
        // If not in wrapper, check parent container (might exist from previous init)
        if (!header && this.parentContainer) {
            header = this.parentContainer.querySelector('.pattern-explorer-header');
            if (header && header.parentElement !== this.stickyWrapper) {
                // Move existing header into wrapper
                this.stickyWrapper.insertBefore(header, this.stickyWrapper.firstChild);
            }
        }
        
        // Create new header if it doesn't exist anywhere
        if (!header) {
            header = document.createElement('div');
            header.className = 'pattern-explorer-header';
            header.textContent = 'PATTERN EXPLORER';
            
            // Insert at the beginning of sticky wrapper
            this.stickyWrapper.insertBefore(header, this.stickyWrapper.firstChild);
        }
    }
    
    /**
     * Create search box (inside sticky wrapper, separate from filters)
     */
    createSearchBox() {
        if (!this.stickyWrapper) {
            this.createStickyWrapper();
        }
        
        // Check if search container exists in wrapper first
        let searchContainer = this.stickyWrapper.querySelector('.pattern-explorer-search');
        
        // If not in wrapper, check parent container (might exist from previous init)
        if (!searchContainer && this.parentContainer) {
            searchContainer = this.parentContainer.querySelector('.pattern-explorer-search');
            if (searchContainer && searchContainer.parentElement !== this.stickyWrapper) {
                // Move existing search into wrapper (after header)
                const header = this.stickyWrapper.querySelector('.pattern-explorer-header');
                if (header) {
                    this.stickyWrapper.insertBefore(searchContainer, header.nextSibling);
                } else {
                    this.stickyWrapper.insertBefore(searchContainer, this.stickyWrapper.firstChild);
                }
            }
        }
        
        // Create new search container if it doesn't exist anywhere
        if (!searchContainer) {
            searchContainer = document.createElement('div');
            searchContainer.className = 'pattern-explorer-search';
            
            this.searchInput = document.createElement('input');
            this.searchInput.type = 'text';
            this.searchInput.className = 'pattern-explorer-search-input';
            this.searchInput.id = `${this.filterContainerId}_search`;
            this.searchInput.placeholder = this.searchPlaceholder;
            this.searchInput.autocomplete = 'off';
            
            // Handle search input
            this.searchQuery = '';
            this.searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.trim().toLowerCase();
                // Trigger filter change
                if (this.filterPanel) {
                    const filters = this.filterPanel.getFilters();
                    filters.search = this.searchQuery;
                    this.handleFilterChange(filters);
                }
            });
            
            searchContainer.appendChild(this.searchInput);
            
            // Insert after header, before filter container
            const header = this.stickyWrapper.querySelector('.pattern-explorer-header');
            const filterPanel = document.getElementById(this.filterContainerId);
            
            if (filterPanel && this.stickyWrapper.contains(filterPanel)) {
                // Filter panel is already in wrapper, insert search before it
                this.stickyWrapper.insertBefore(searchContainer, filterPanel);
            } else if (header && header.nextSibling) {
                // Insert after header
                this.stickyWrapper.insertBefore(searchContainer, header.nextSibling);
            } else {
                // Append to wrapper
                this.stickyWrapper.appendChild(searchContainer);
            }
        } else {
            this.searchInput = searchContainer.querySelector('.pattern-explorer-search-input');
        }
    }
    
    /**
     * Handle filter changes from FilterPanel
     */
    handleFilterChange(filters) {
        // Apply filters using Filters module
        if (typeof Filters !== 'undefined') {
            this.filteredFiles = Filters.applyFilters(this.allFiles, filters, this.metadata);
        } else {
            console.warn('PatternExplorerWithFilters: Filters module not loaded. Please include js/modules/filters.js');
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
