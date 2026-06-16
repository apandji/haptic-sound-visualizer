/**
 * PatternExplorerWithFilters Variant
 * Composes PatternExplorer + FilterPanel with automatic filtering
 */
class PatternExplorerWithFilters {
    constructor(options = {}) {
        this.containerId = options.containerId || 'fileList';
        this.filterContainerId = options.filterContainerId || 'filterPanel';

        this.container = document.getElementById(this.containerId);
        this.filterContainer = document.getElementById(this.filterContainerId);

        if (!this.container) {
            console.error(`PatternExplorerWithFilters: Container #${this.containerId} not found`);
            return;
        }

        this.allFiles = options.files || [];
        this.metadata = options.metadata || {};
        this.parentContainer = this.container.parentElement;

        this.filterPresentation = options.filterPresentation || 'inline';
        this.showPreviewButton = options.showPreviewButton !== false;
        this.showProgressBar = options.showProgressBar || false;

        this.onFileClick = options.onFileClick || null;
        this.onFileHover = options.onFileHover || null;
        this.onFilePreview = options.onFilePreview || null;
        this.onPlayStateChange = options.onPlayStateChange || null;
        this.onFilterChange = options.onFilterChange || null;

        this.filteredFiles = [...this.allFiles];
        this.boundHandlers = {};

        this.init();
    }

    init() {
        if (!this.parentContainer) {
            console.error('PatternExplorerWithFilters: Parent container not found');
            return;
        }

        PatternLibraryShell.initChrome(this, {
            filterPresentation: this.filterPresentation,
            headerLabel: 'PATTERN LIBRARY',
            searchPlaceholder: 'Search patterns...',
            compact: true,
            collapsible: true,
            defaultCollapsed: true,
        });

        this.patternExplorer = new PatternExplorer({
            containerId: this.containerId,
            metadata: this.metadata,
            showHeader: false,
            showPreviewButton: this.showPreviewButton,
            showProgressBar: this.showProgressBar,
            onFileClick: (file) => this.onFileClick?.(file),
            onFileHover: (file, metadata, event) => this.onFileHover?.(file, metadata, event),
            onFilePreview: (file, isPlaying) => this.onFilePreview?.(file, isPlaying),
            onPlayStateChange: (filePath, isPlaying) => this.onPlayStateChange?.(filePath, isPlaying),
        });

        this.updateFileList();
    }

    handleFilterChange(filters) {
        PatternLibraryShell.applyFilters(this, filters);
        this.updateFileList();
        this.onFilterChange?.(filters, this.filteredFiles);
    }

    handleFilterReset() {
        this.filteredFiles = [...this.allFiles];
        this.updateFileList();
        this.onFilterChange?.({}, this.filteredFiles);
    }

    updateFileList() {
        if (this.patternExplorer) {
            this.patternExplorer.render(this.filteredFiles);
        }
        PatternLibraryShell.updatePatternCount(this);
    }

    setFiles(files) {
        this.allFiles = files || [];
        const currentFilters = this.filterPanel ? this.filterPanel.getFilters() : {};
        currentFilters.search = this.searchQuery || '';
        this.handleFilterChange(currentFilters);
    }

    setMetadata(metadata) {
        this.metadata = metadata || {};
        this.filterPanel?.updateMetadata(this.metadata);
        if (this.patternExplorer) {
            this.patternExplorer.metadata = this.metadata;
        }
        const currentFilters = this.filterPanel ? this.filterPanel.getFilters() : {};
        currentFilters.search = this.searchQuery || '';
        this.handleFilterChange(currentFilters);
    }

    setPlayingFile(filePath, isPlaying) {
        this.patternExplorer?.setPlayingFile(filePath, isPlaying);
    }

    updateProgress(filePath, progress) {
        this.patternExplorer?.updateProgress(filePath, progress);
    }

    getFilteredFiles() {
        return [...this.filteredFiles];
    }

    getFilters() {
        if (this.filterPanel) {
            const filters = this.filterPanel.getFilters();
            filters.search = this.searchQuery || '';
            return filters;
        }
        return { search: this.searchQuery || '' };
    }

    setFilters(filters) {
        this.filterPanel?.setFilters(filters);
    }

    resetFilters() {
        this.filterPanel?.reset();
    }

    destroy() {
        PatternLibraryShell.destroy(this);
        if (this.patternExplorer?.container) {
            this.patternExplorer.container.innerHTML = '';
        }
        this.filterPanel = null;
        this.patternExplorer = null;
        this.searchInput = null;
    }
}
