/**
 * PatternExplorerWithSelection Variant
 * Extends PatternExplorer with selection functionality (plus/checkmark icons),
 * FilterPanel integration, and Queue component integration
 */
class PatternExplorerWithSelection {
    constructor(options = {}) {
        // Required container IDs
        this.containerId = options.containerId || 'fileList';
        this.filterContainerId = options.filterContainerId || 'filterPanel';
        
        // Get containers
        this.container = document.getElementById(this.containerId);
        this.filterContainer = document.getElementById(this.filterContainerId);
        
        if (!this.container) {
            console.error(`PatternExplorerWithSelection: Container #${this.containerId} not found`);
            return;
        }
        
        // Queue component reference
        this.queue = options.queue || null;
        
        // Configuration
        this.allFiles = options.files || []; // All files (unfiltered)
        this.metadata = options.metadata || {};
        
        // FilterPanel options
        this.compact = options.compact !== undefined ? options.compact : true;
        this.collapsible = options.collapsible !== undefined ? options.collapsible : true;
        this.defaultCollapsed = options.defaultCollapsed !== undefined ? options.defaultCollapsed : true;
        this.searchPlaceholder = options.searchPlaceholder || 'Search patterns...';
        
        // Get parent container for restructuring
        this.parentContainer = this.container.parentElement;
        
        // PatternExplorer options
        this.showHeader = options.showHeader !== false;
        this.showPreviewButton = options.showPreviewButton !== false;
        this.showProgressBar = options.showProgressBar || false;
        
        // Callbacks
        this.onFileClick = options.onFileClick || null;
        this.onFileHover = options.onFileHover || null;
        this.onFilePreview = options.onFilePreview || null;
        this.onPlayStateChange = options.onPlayStateChange || null;
        this.onSelectionChange = options.onSelectionChange || null; // Called when item added/removed from queue
        this.onFilterChange = options.onFilterChange || null; // Optional: called when filters change
        
        // Track which files are in queue
        this.selectedFiles = new Set(); // Set of file paths
        
        // State
        this.filteredFiles = [...this.allFiles]; // Start with all files
        
        // Initialize components
        this.init();
    }
    
    /**
     * Initialize PatternExplorer and FilterPanel with selection functionality
     */
    init() {
        if (!this.parentContainer) {
            console.error('PatternExplorerWithSelection: Parent container not found');
            return;
        }
        
        // Create sticky wrapper for filters (like PatternExplorerWithFilters)
        const wrapper = this.createStickyWrapper();
        if (!wrapper) {
            console.error('PatternExplorerWithSelection: Failed to create sticky wrapper');
            return;
        }
        
        // Ensure filter container exists and is inside sticky wrapper
        let filterContainer = document.getElementById(this.filterContainerId);
        if (!filterContainer) {
            filterContainer = document.createElement('div');
            filterContainer.id = this.filterContainerId;
            wrapper.appendChild(filterContainer);
        } else if (filterContainer.parentElement !== wrapper) {
            wrapper.appendChild(filterContainer);
        }
        
        // Move existing header/search into wrapper if they exist
        const existingHeader = this.parentContainer.querySelector('.pattern-explorer-header');
        if (existingHeader && existingHeader.parentElement !== wrapper) {
            wrapper.insertBefore(existingHeader, wrapper.firstChild);
        }
        
        const existingSearch = this.parentContainer.querySelector('.pattern-explorer-search');
        if (existingSearch && existingSearch.parentElement !== wrapper) {
            const header = wrapper.querySelector('.pattern-explorer-header');
            if (header) {
                wrapper.insertBefore(existingSearch, header.nextSibling);
            } else {
                wrapper.insertBefore(existingSearch, wrapper.firstChild);
            }
        }
        
        // Create header and search box
        this.createHeader();
        this.createSearchBox();
        
        // Initialize FilterPanel (without search, since we create it separately)
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
                filters.search = this.searchQuery || '';
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
        
        // Initialize PatternExplorer
        this.patternExplorer = new PatternExplorer({
            containerId: this.containerId,
            metadata: this.metadata,
            showHeader: false, // Header is handled by FilterPanel
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
        
        // Override PatternExplorer's render to add selection icons
        this.overrideRender();
        
        // Initial render - ensure we have files and render them
        if (this.allFiles && this.allFiles.length > 0) {
            // Ensure filteredFiles is set
            if (!this.filteredFiles || this.filteredFiles.length === 0) {
                this.filteredFiles = [...this.allFiles];
            }
            
            // Render the files directly (filters will be applied on first filter change)
            if (this.patternExplorer) {
                this.patternExplorer.render(this.filteredFiles);
            }
            this.updatePatternCount();
        }
    }
    
    /**
     * Create sticky wrapper container for filters (similar to PatternExplorerWithFilters)
     */
    createStickyWrapper() {
        if (!this.parentContainer) {
            console.error('PatternExplorerWithSelection: parentContainer not set');
            return null;
        }
        
        // Check if wrapper already exists
        let wrapper = this.parentContainer.querySelector('.pattern-explorer-sticky-wrapper');
        if (wrapper) {
            this.stickyWrapper = wrapper;
            return wrapper;
        }
        
        // Create wrapper
        wrapper = document.createElement('div');
        wrapper.className = 'pattern-explorer-sticky-wrapper';
        
        // Insert wrapper before file list container
        const insertBefore = this.container || this.parentContainer.firstChild;
        if (insertBefore) {
            this.parentContainer.insertBefore(wrapper, insertBefore);
        } else {
            this.parentContainer.appendChild(wrapper);
        }
        
        this.stickyWrapper = wrapper;
        return wrapper;
    }
    
    /**
     * Create PATTERN LIBRARY header (inside sticky wrapper)
     */
    createHeader() {
        if (!this.stickyWrapper) {
            this.createStickyWrapper();
        }
        
        // Check if header exists in wrapper first
        let header = this.stickyWrapper.querySelector('.pattern-explorer-header');
        
        // If not in wrapper, check parent container
        if (!header && this.parentContainer) {
            header = this.parentContainer.querySelector('.pattern-explorer-header');
            if (header && header.parentElement !== this.stickyWrapper) {
                this.stickyWrapper.insertBefore(header, this.stickyWrapper.firstChild);
            }
        }
        
        // Create new header if it doesn't exist
        if (!header) {
            header = document.createElement('div');
            header.className = 'pattern-explorer-header';
            
            const headerText = document.createElement('span');
            headerText.className = 'pattern-explorer-header__text';
            headerText.textContent = 'Library';
            header.appendChild(headerText);
            
            const headerCount = document.createElement('span');
            headerCount.className = 'pattern-explorer-header__count';
            header.appendChild(headerCount);
            
            this.stickyWrapper.insertBefore(header, this.stickyWrapper.firstChild);
        } else {
            // Ensure header has count element
            let headerText = header.querySelector('.pattern-explorer-header__text');
            let headerCount = header.querySelector('.pattern-explorer-header__count');
            
            if (!headerText) {
                headerText = document.createElement('span');
                headerText.className = 'pattern-explorer-header__text';
                headerText.textContent = 'Library';
                header.insertBefore(headerText, header.firstChild);
            }
            
            if (!headerCount) {
                headerCount = document.createElement('span');
                headerCount.className = 'pattern-explorer-header__count';
                header.appendChild(headerCount);
            }
        }
        
        // Update count
        this.updatePatternCount();
    }
    
    /**
     * Create search box (inside sticky wrapper)
     */
    createSearchBox() {
        if (!this.stickyWrapper) {
            this.createStickyWrapper();
        }
        
        // Check if search container exists in wrapper
        let searchContainer = this.stickyWrapper.querySelector('.pattern-explorer-search');
        
        // If not in wrapper, check parent container
        if (!searchContainer && this.parentContainer) {
            searchContainer = this.parentContainer.querySelector('.pattern-explorer-search');
            if (searchContainer && searchContainer.parentElement !== this.stickyWrapper) {
                const header = this.stickyWrapper.querySelector('.pattern-explorer-header');
                if (header) {
                    this.stickyWrapper.insertBefore(searchContainer, header.nextSibling);
                } else {
                    this.stickyWrapper.insertBefore(searchContainer, this.stickyWrapper.firstChild);
                }
            }
        }
        
        // Create new search container if it doesn't exist
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
            this.boundHandlers = this.boundHandlers || {};
            this.boundHandlers.searchInput = (e) => {
                this.searchQuery = e.target.value.trim().toLowerCase();
                // Trigger filter change
                if (this.filterPanel) {
                    const filters = this.filterPanel.getFilters();
                    filters.search = this.searchQuery;
                    this.handleFilterChange(filters);
                }
            };
            this.searchInput.addEventListener('input', this.boundHandlers.searchInput);
            
            searchContainer.appendChild(this.searchInput);
            
            // Insert after header, before filter container
            const header = this.stickyWrapper.querySelector('.pattern-explorer-header');
            const filterPanel = document.getElementById(this.filterContainerId);
            
            if (filterPanel && this.stickyWrapper.contains(filterPanel)) {
                this.stickyWrapper.insertBefore(searchContainer, filterPanel);
            } else if (header && header.nextSibling) {
                this.stickyWrapper.insertBefore(searchContainer, header.nextSibling);
            } else {
                this.stickyWrapper.appendChild(searchContainer);
            }
        } else {
            this.searchInput = searchContainer.querySelector('.pattern-explorer-search-input');
        }
    }
    
    /**
     * Update pattern count display
     */
    updatePatternCount() {
        if (!this.stickyWrapper) {
            if (this.parentContainer) {
                this.stickyWrapper = this.parentContainer.querySelector('.pattern-explorer-sticky-wrapper');
            }
            if (!this.stickyWrapper) return;
        }
        
        const header = this.stickyWrapper.querySelector('.pattern-explorer-header');
        if (!header) return;
        
        let countEl = header.querySelector('.pattern-explorer-header__count');
        
        if (!countEl) {
            countEl = document.createElement('span');
            countEl.className = 'pattern-explorer-header__count';
            header.appendChild(countEl);
        }
        
        // Update count text
        const count = this.filteredFiles ? this.filteredFiles.length : 0;
        const total = this.allFiles ? this.allFiles.length : 0;
        if (count === total) {
            countEl.textContent = `${count}`;
        } else {
            countEl.textContent = `${count} / ${total}`;
        }
    }
    
    /**
     * Handle filter changes
     */
    handleFilterChange(filters) {
        // Apply filters using the filters module
        if (typeof Filters !== 'undefined') {
            this.filteredFiles = Filters.applyFilters(this.allFiles, filters, this.metadata);
        } else if (typeof applyFilters !== 'undefined') {
            this.filteredFiles = applyFilters(this.allFiles, filters, this.metadata);
        } else {
            console.warn('PatternExplorerWithSelection: Filters module not loaded. Please include js/modules/filters.js');
            this.filteredFiles = [...this.allFiles];
        }
        
        // Update PatternExplorer with filtered files
        this.render(this.filteredFiles);
        
        // Update pattern count
        this.updatePatternCount();
        
        // Call callback if provided
        if (this.onFilterChange) {
            this.onFilterChange(filters, this.filteredFiles);
        }
    }
    
    /**
     * Handle filter reset
     */
    handleFilterReset() {
        this.filteredFiles = [...this.allFiles];
        this.render(this.filteredFiles);
        this.updatePatternCount();
        
        if (this.onFilterChange) {
            this.onFilterChange({}, this.filteredFiles);
        }
    }
    
    /**
     * Override PatternExplorer's render method to add selection icons
     */
    overrideRender() {
        const originalRender = this.patternExplorer.render.bind(this.patternExplorer);
        const originalCreateFileItem = this.patternExplorer.createFileItem.bind(this.patternExplorer);
        
        // Override createFileItem to add selection icon
        this.patternExplorer.createFileItem = (file) => {
            const item = originalCreateFileItem(file);
            this.addSelectionIcon(item, file);
            return item;
        };
        
        // Override render to update selection icons
        this.patternExplorer.render = (files) => {
            originalRender(files);
            // Update selection icons after render
            this.updateSelectionIcons();
        };
    }
    
    /**
     * Add selection icon (plus/checkmark) to file item
     */
    addSelectionIcon(item, file) {
        // Check if icon already exists
        let selectionIcon = item.querySelector('.file-item-selection-icon');
        if (selectionIcon) {
            return; // Already added
        }
        
        // Create selection icon button
        selectionIcon = document.createElement('button');
        selectionIcon.className = 'file-item-selection-icon';
        selectionIcon.dataset.filePath = file.path;
        selectionIcon.setAttribute('aria-label', `Add ${file.name} to queue`);
        selectionIcon.title = 'Add to queue';
        
        // Set initial state
        this.updateSelectionIcon(selectionIcon, file.path);
        
        // Add click handler
        selectionIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleSelectionClick(file, selectionIcon);
        });
        
        // Insert at the end (after text span, before progress bar if exists)
        const textSpan = item.querySelector('.file-item-text');
        const progressBar = item.querySelector('.file-item-progress');
        if (progressBar) {
            item.insertBefore(selectionIcon, progressBar);
        } else if (textSpan) {
            item.insertBefore(selectionIcon, textSpan.nextSibling);
        } else {
            item.appendChild(selectionIcon);
        }
    }
    
    /**
     * Update selection icon state (plus or checkmark)
     */
    updateSelectionIcon(icon, filePath) {
        const isSelected = this.selectedFiles.has(filePath);
        
        if (isSelected) {
            // Show checkmark
            icon.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                    <path fill-rule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clip-rule="evenodd" />
                </svg>
            `;
            icon.classList.add('file-item-selection-icon--selected');
            icon.setAttribute('aria-label', `Remove ${filePath.split('/').pop()} from queue`);
            icon.title = 'Remove from queue';
        } else {
            // Show plus
            icon.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <path d="M12 5v14m-7-7h14"/>
                </svg>
            `;
            icon.classList.remove('file-item-selection-icon--selected');
            icon.setAttribute('aria-label', `Add ${filePath.split('/').pop()} to queue`);
            icon.title = 'Add to queue';
        }
    }
    
    /**
     * Handle selection icon click
     */
    handleSelectionClick(file, icon) {
        const filePath = file.path;
        const isSelected = this.selectedFiles.has(filePath);
        
        // Micro-interaction: brief scale animation
        icon.style.transform = 'scale(0.8)';
        setTimeout(() => {
            icon.style.transform = '';
        }, 150);
        
        if (isSelected) {
            // Remove from queue
            this.removeFromQueue(file);
        } else {
            // Add to queue
            this.addToQueue(file);
        }
        
        // Update icon
        this.updateSelectionIcon(icon, filePath);
    }
    
    /**
     * Add file to queue
     */
    addToQueue(file) {
        if (!this.queue) {
            console.warn('PatternExplorerWithSelection: No queue component provided');
            return false;
        }
        
        const added = this.queue.addItem(file);
        if (added) {
            this.selectedFiles.add(file.path);
            
            // Call callback
            if (this.onSelectionChange) {
                this.onSelectionChange(file, true);
            }
            
            return true;
        }
        
        return false;
    }
    
    /**
     * Remove file from queue
     */
    removeFromQueue(file) {
        if (!this.queue) {
            console.warn('PatternExplorerWithSelection: No queue component provided');
            return false;
        }
        
        const items = this.queue.getItems();
        const index = items.findIndex(item => item.path === file.path);
        
        if (index >= 0) {
            this.queue.removeItem(index);
            this.selectedFiles.delete(file.path);
            
            // Call callback
            if (this.onSelectionChange) {
                this.onSelectionChange(file, false);
            }
            
            return true;
        }
        
        return false;
    }
    
    /**
     * Update selection icons for all items
     */
    updateSelectionIcons() {
        const items = this.container.querySelectorAll('.file-item');
        items.forEach(item => {
            const icon = item.querySelector('.file-item-selection-icon');
            if (icon) {
                const filePath = icon.dataset.filePath;
                this.updateSelectionIcon(icon, filePath);
            }
        });
    }
    
    /**
     * Render file list
     */
    render(files) {
        // If files provided, check if it's a new file set or filtered files
        if (files) {
            // Check if this looks like a new complete file set (same length as allFiles or different structure)
            const isNewFileSet = files.length === this.allFiles.length && 
                                 files.length > 0 &&
                                 files.some((f, i) => !this.allFiles[i] || f.path !== this.allFiles[i].path);
            
            // Also check if it's clearly a new set (different length)
            const isDifferentLength = files.length !== this.allFiles.length;
            
            if (isNewFileSet || isDifferentLength) {
                // This is a new set of files - update allFiles and re-apply filters
                this.allFiles = files;
                
                // Re-apply current filters if FilterPanel exists
                if (this.filterPanel) {
                    const filters = this.filterPanel.getFilters();
                    filters.search = this.searchQuery || '';
                    this.handleFilterChange(filters);
                    return; // handleFilterChange will call render again
                } else {
                    // No filterPanel yet, just set filteredFiles and render
                    this.filteredFiles = [...this.allFiles];
                }
            } else {
                // This is filtered files (same structure as allFiles but potentially filtered)
                this.filteredFiles = files;
            }
        }
        
        // Render the filtered files
        if (this.patternExplorer && this.filteredFiles && this.filteredFiles.length > 0) {
            this.patternExplorer.render(this.filteredFiles);
        } else if (this.patternExplorer) {
            // Empty list - PatternExplorer will show empty state
            this.patternExplorer.render([]);
        }
        
        this.updatePatternCount();
    }
    
    /**
     * Set files (updates allFiles and re-applies filters)
     */
    setFiles(files) {
        this.allFiles = files || [];
        // Re-apply current filters
        if (this.filterPanel) {
            const filters = this.filterPanel.getFilters();
            filters.search = this.searchQuery || '';
            this.handleFilterChange(filters);
        } else {
            this.filteredFiles = [...this.allFiles];
            this.render();
        }
    }
    
    /**
     * Update file list (internal method, similar to PatternExplorerWithFilters)
     */
    updateFileList() {
        if (this.patternExplorer) {
            this.patternExplorer.render(this.filteredFiles);
        }
        this.updatePatternCount();
    }
    
    /**
     * Update metadata
     */
    setMetadata(metadata) {
        this.metadata = metadata || {};
        if (this.patternExplorer) {
            this.patternExplorer.metadata = this.metadata;
        }
        if (this.filterPanel) {
            this.filterPanel.updateMetadata(this.metadata);
        }
    }
    
    /**
     * Get current filters
     */
    getFilters() {
        if (this.filterPanel) {
            const filters = this.filterPanel.getFilters();
            filters.search = this.searchQuery || '';
            return filters;
        }
        return { search: this.searchQuery || '' };
    }
    
    /**
     * Reset all filters
     */
    resetFilters() {
        if (this.filterPanel) {
            this.filterPanel.reset();
        }
        if (this.searchInput) {
            this.searchInput.value = '';
            this.searchQuery = '';
        }
        this.handleFilterReset();
    }
    
    /**
     * Set queue component
     */
    setQueue(queue) {
        this.queue = queue;
        
        // Sync selected files with queue
        if (this.queue) {
            const queueItems = this.queue.getItems();
            this.selectedFiles = new Set(queueItems.map(item => item.path));
            this.updateSelectionIcons();
        }
    }
    
    /**
     * Sync selection state with queue (call when queue changes externally)
     */
    syncWithQueue() {
        if (this.queue) {
            const queueItems = this.queue.getItems();
            this.selectedFiles = new Set(queueItems.map(item => item.path));
            this.updateSelectionIcons();
        }
    }
    
    /**
     * Get currently filtered files (for random selection)
     */
    getFilteredFiles() {
        return this.filteredFiles || [];
    }
    
    /**
     * Set playing file state
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
     * Destroy component
     */
    destroy() {
        if (this.patternExplorer) {
            // Note: PatternExplorer doesn't have destroy method yet
            if (typeof this.patternExplorer.destroy === 'function') {
                this.patternExplorer.destroy();
            }
        }
        this.selectedFiles.clear();
        this.queue = null;
    }
}
