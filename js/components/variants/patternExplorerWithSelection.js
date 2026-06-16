/**
 * PatternExplorerWithSelection Variant
 * Pattern library with queue selection, shared filter chrome via PatternLibraryShell.
 */
class PatternExplorerWithSelection {
    constructor(options = {}) {
        this.containerId = options.containerId || 'fileList';
        this.filterContainerId = options.filterContainerId || 'filterPanel';

        this.container = document.getElementById(this.containerId);

        if (!this.container) {
            console.error(`PatternExplorerWithSelection: Container #${this.containerId} not found`);
            return;
        }

        this.queue = options.queue || null;
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
        this.onSelectionChange = options.onSelectionChange || null;
        this.onFilterChange = options.onFilterChange || null;

        this.selectedFiles = new Set();
        this.filteredFiles = [...this.allFiles];
        this.boundHandlers = {};

        this.init();
    }

    init() {
        if (!this.parentContainer) {
            console.error('PatternExplorerWithSelection: Parent container not found');
            return;
        }

        PatternLibraryShell.initChrome(this, {
            filterPresentation: this.filterPresentation,
            headerLabel: 'Library',
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

        this.overrideRender();

        if (this.allFiles?.length) {
            if (!this.filteredFiles?.length) {
                this.filteredFiles = [...this.allFiles];
            }
            this.patternExplorer.render(this.filteredFiles);
            PatternLibraryShell.updatePatternCount(this);
        }
    }

    handleFilterChange(filters) {
        PatternLibraryShell.applyFilters(this, filters);
        this.render(this.filteredFiles);
        this.onFilterChange?.(filters, this.filteredFiles);
    }

    handleFilterReset() {
        this.filteredFiles = [...this.allFiles];
        this.render(this.filteredFiles);
        this.onFilterChange?.({}, this.filteredFiles);
    }

    overrideRender() {
        const originalRender = this.patternExplorer.render.bind(this.patternExplorer);
        const originalCreateFileItem = this.patternExplorer.createFileItem.bind(this.patternExplorer);

        this.patternExplorer.createFileItem = (file) => {
            const item = originalCreateFileItem(file);
            this.addSelectionIcon(item, file);
            return item;
        };

        this.patternExplorer.render = (files) => {
            originalRender(files);
            this.updateSelectionIcons();
        };
    }

    addSelectionIcon(item, file) {
        if (item.querySelector('.file-item-selection-icon')) return;

        const selectionIcon = document.createElement('button');
        selectionIcon.className = 'file-item-selection-icon';
        selectionIcon.dataset.filePath = file.path;
        selectionIcon.setAttribute('aria-label', `Add ${file.name} to queue`);
        selectionIcon.title = 'Add to queue';

        this.updateSelectionIcon(selectionIcon, file.path);

        selectionIcon.addEventListener('click', (event) => {
            event.stopPropagation();
            this.handleSelectionClick(file, selectionIcon);
        });

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

    updateSelectionIcon(icon, filePath) {
        const isSelected = this.selectedFiles.has(filePath);

        if (isSelected) {
            icon.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                    <path fill-rule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clip-rule="evenodd" />
                </svg>
            `;
            icon.classList.add('file-item-selection-icon--selected');
            icon.setAttribute('aria-label', `Remove ${filePath.split('/').pop()} from queue`);
            icon.title = 'Remove from queue';
        } else {
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

    handleSelectionClick(file, icon) {
        icon.style.transform = 'scale(0.8)';
        setTimeout(() => { icon.style.transform = ''; }, 150);

        if (this.selectedFiles.has(file.path)) {
            this.removeFromQueue(file);
        } else {
            this.addToQueue(file);
        }
        this.updateSelectionIcon(icon, file.path);
    }

    addToQueue(file) {
        if (!this.queue) return false;
        const added = this.queue.addItem(file);
        if (added) {
            this.selectedFiles.add(file.path);
            this.onSelectionChange?.(file, true);
            return true;
        }
        return false;
    }

    removeFromQueue(file) {
        if (!this.queue) return false;
        const items = this.queue.getItems();
        const index = items.findIndex(item => item.path === file.path);
        if (index >= 0) {
            this.queue.removeItem(index);
            this.selectedFiles.delete(file.path);
            this.onSelectionChange?.(file, false);
            return true;
        }
        return false;
    }

    updateSelectionIcons() {
        this.container.querySelectorAll('.file-item').forEach(item => {
            const icon = item.querySelector('.file-item-selection-icon');
            if (icon) {
                this.updateSelectionIcon(icon, icon.dataset.filePath);
            }
        });
    }

    render(files) {
        if (files) {
            const isNewFileSet = files.length === this.allFiles.length &&
                files.length > 0 &&
                files.some((f, i) => !this.allFiles[i] || f.path !== this.allFiles[i].path);
            const isDifferentLength = files.length !== this.allFiles.length;

            if (isNewFileSet || isDifferentLength) {
                this.allFiles = files;
                if (this.filterPanel) {
                    const filters = this.filterPanel.getFilters();
                    filters.search = this.searchQuery || '';
                    this.handleFilterChange(filters);
                    return;
                }
                this.filteredFiles = [...this.allFiles];
            } else {
                this.filteredFiles = files;
            }
        }

        this.patternExplorer?.render(this.filteredFiles || []);
        PatternLibraryShell.updatePatternCount(this);
    }

    setFiles(files) {
        this.allFiles = files || [];
        if (this.filterPanel) {
            const filters = this.filterPanel.getFilters();
            filters.search = this.searchQuery || '';
            this.handleFilterChange(filters);
        } else {
            this.filteredFiles = [...this.allFiles];
            this.render();
        }
    }

    setMetadata(metadata) {
        this.metadata = metadata || {};
        if (this.patternExplorer) {
            this.patternExplorer.metadata = this.metadata;
        }
        this.filterPanel?.updateMetadata(this.metadata);
    }

    getFilters() {
        if (this.filterPanel) {
            const filters = this.filterPanel.getFilters();
            filters.search = this.searchQuery || '';
            return filters;
        }
        return { search: this.searchQuery || '' };
    }

    resetFilters() {
        this.filterPanel?.reset();
        if (this.searchInput) {
            this.searchInput.value = '';
            this.searchQuery = '';
        }
        this.handleFilterReset();
    }

    setQueue(queue) {
        this.queue = queue;
        if (this.queue) {
            this.selectedFiles = new Set(this.queue.getItems().map(item => item.path));
            this.updateSelectionIcons();
        }
    }

    syncWithQueue() {
        if (this.queue) {
            this.selectedFiles = new Set(this.queue.getItems().map(item => item.path));
            this.updateSelectionIcons();
        }
    }

    getFilteredFiles() {
        return this.filteredFiles || [];
    }

    setPlayingFile(filePath, isPlaying) {
        this.patternExplorer?.setPlayingFile(filePath, isPlaying);
    }

    updateProgress(filePath, progress) {
        this.patternExplorer?.updateProgress(filePath, progress);
    }

    destroy() {
        PatternLibraryShell.destroy(this);
        this.selectedFiles.clear();
        this.queue = null;
    }
}
