/**
 * PatternExplorer Component
 * Renders a list of audio files with tooltips and click handlers
 */
class PatternExplorer {
    constructor(options = {}) {
        this.containerId = options.containerId || 'fileList';
        this.container = document.getElementById(this.containerId);
        this.metadata = options.metadata || {};
        this.onFileClick = options.onFileClick || null;
        this.onFileHover = options.onFileHover || null;
        this.onFilePreview = options.onFilePreview || null; // Preview callback (play button)
        this.onPlayStateChange = options.onPlayStateChange || null; // Called when play/pause state changes
        this.showPreviewButton = options.showPreviewButton !== false; // Default to true
        this.showProgressBar = options.showProgressBar || false; // Default to false (optional)
        this.activeFilePath = null;
        this.playingFilePath = null; // Currently playing file path
        this.isPlaying = false; // Current play state
        this.showHeader = options.showHeader !== false; // Default to true
        this.showFilterButton = options.showFilterButton || false; // Show filter icon button
        this.onFilterButtonClick = options.onFilterButtonClick || null; // Called when filter button clicked
        
        // Bound event handlers (for proper cleanup)
        this.boundHandlers = {
            filterBtnClick: null
        };
        
        // DOM references
        this.filterButton = null;
        
        // Create tooltip element (shared across all file items)
        this.tooltip = this.createTooltip();
        
        if (!this.container) {
            console.error(`PatternExplorer: Container #${this.containerId} not found`);
        }
        
        // Create header if needed
        if (this.showHeader) {
            this.createHeader();
        }
    }
    
    /**
     * Create panel header
     */
    createHeader() {
        // Check if header already exists
        let header = this.container.parentElement?.querySelector('.panel-header');
        if (!header && this.container.parentElement) {
            header = document.createElement('div');
            header.className = 'panel-header';
            header.textContent = 'PATTERN EXPLORER';
            // Insert before the file list container
            this.container.parentElement.insertBefore(header, this.container);
        }
    }
    
    /**
     * Create panel header
     */
    createHeader() {
        // Check if header already exists in parent
        if (!this.container || !this.container.parentElement) {
            return;
        }
        
        let header = this.container.parentElement.querySelector('.panel-header');
        if (!header) {
            header = document.createElement('div');
            header.className = 'panel-header';
            
            // Create header content wrapper
            const headerContent = document.createElement('div');
            headerContent.className = 'panel-header__content';
            headerContent.textContent = 'PATTERN EXPLORER';
            
            header.appendChild(headerContent);
            
            // Add filter button if enabled
            if (this.showFilterButton) {
                this.filterButton = document.createElement('button');
                this.filterButton.className = 'panel-header__filter-btn';
                this.filterButton.setAttribute('aria-label', 'Open filters');
                this.filterButton.title = 'Filters';
                this.filterButton.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                        <path d="M3 3a1 1 0 011-1h12a1 1 0 011 1v2.586a1 1 0 01-.293.707l-4.414 4.414a1 1 0 00-.293.707V15a1 1 0 01-1 1H7a1 1 0 01-1-1v-3.586a1 1 0 00-.293-.707L1.293 6.293A1 1 0 011 5.586V3z"/>
                    </svg>
                `;
                
                // Create bound handler and store reference
                this.boundHandlers.filterBtnClick = () => {
                    if (this.onFilterButtonClick) {
                        this.onFilterButtonClick();
                    }
                };
                
                this.filterButton.addEventListener('click', this.boundHandlers.filterBtnClick);
                header.appendChild(this.filterButton);
            }
            
            // Insert before the file list container
            this.container.parentElement.insertBefore(header, this.container);
        }
    }
    
    /**
     * Create global tooltip element
     */
    createTooltip() {
        let tooltip = document.getElementById('file-tooltip-global');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'file-tooltip-global';
            tooltip.className = 'file-tooltip';
            document.body.appendChild(tooltip);
        }
        return tooltip;
    }
    
    /**
     * Render file list
     * @param {Array} files - Array of file objects with {name, path, ...}
     */
    render(files) {
        if (!this.container) {
            console.error('PatternExplorer: Cannot render, container not found');
            return;
        }
        
        this.container.innerHTML = '';
        
        if (!files || files.length === 0) {
            this.container.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: #999;">
                    <p style="font-size: 13px; margin-bottom: 8px; font-weight: 500;">No files match your filters</p>
                    <p style="font-size: 11px; color: #ccc;">Try adjusting your search or filter criteria</p>
                </div>
            `;
            return;
        }
        
        files.forEach(file => {
            const item = this.createFileItem(file);
            // Only add play button if enabled
            if (!this.showPreviewButton) {
                const playBtn = item.querySelector('.file-item-play-btn');
                if (playBtn) {
                    playBtn.style.display = 'none';
                }
            }
            this.container.appendChild(item);
        });
    }
    
    /**
     * Create a single file item element
     */
    createFileItem(file) {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.dataset.filePath = file.path;
        
        // Create play/pause button with heroicon
        const playButton = document.createElement('button');
        playButton.className = 'file-item-play-btn';
        playButton.dataset.filePath = file.path;
        this.updatePlayButtonIcon(playButton, file.path === this.playingFilePath && this.isPlaying, file.name);
        
        // Prevent click event from bubbling to item
        playButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handlePlayClick(file, item, playButton);
        });
        
        // Create text container
        const textSpan = document.createElement('span');
        textSpan.className = 'file-item-text';
        textSpan.textContent = file.name;
        
        // Create progress bar (optional)
        let progressBar = null;
        if (this.showProgressBar) {
            progressBar = document.createElement('div');
            progressBar.className = 'file-item-progress';
            const progressFill = document.createElement('div');
            progressFill.className = 'file-item-progress-fill';
            progressFill.style.width = '0%';
            progressBar.appendChild(progressFill);
            progressBar.dataset.filePath = file.path;
        }
        
        // Assemble item
        item.appendChild(playButton);
        item.appendChild(textSpan);
        if (progressBar) {
            item.appendChild(progressBar);
        }
        
        // Add hover handlers for tooltip (on the whole item)
        item.addEventListener('mouseenter', (e) => {
            // Don't show tooltip if hovering over play button
            if (e.target !== playButton) {
                this.showTooltip(item, file);
            }
        });
        
        item.addEventListener('mouseleave', () => {
            this.hideTooltip();
        });
        
        item.addEventListener('mousemove', (e) => {
            // Update tooltip position on mouse move (but not if hovering over play button)
            if (e.target !== playButton && this.tooltip.classList.contains('show')) {
                this.showTooltip(item, file);
            }
        });
        
        // Add click handler to item (for selecting, not previewing)
        item.addEventListener('click', (e) => {
            // Don't trigger if clicking the play button
            if (e.target !== playButton && !playButton.contains(e.target)) {
                this.handleFileClick(file, item);
            }
        });
        
        return item;
    }
    
    /**
     * Update play button icon (play or pause)
     */
    updatePlayButtonIcon(button, isPlaying, fileName = null) {
        const currentLabel = button.getAttribute('aria-label') || '';
        const fileDisplayName = fileName || (currentLabel.replace(/^(Preview|Pause)\s+/, '') || 'file');
        
        if (isPlaying) {
            // Heroicon Pause (solid/filled style)
            button.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="heroicon-pause">
                    <path fill-rule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clip-rule="evenodd" />
                </svg>
            `;
            button.title = 'Pause';
            button.setAttribute('aria-label', `Pause ${fileDisplayName}`);
        } else {
            // Heroicon Play (solid/filled style)
            button.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="heroicon-play">
                    <path fill-rule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clip-rule="evenodd" />
                </svg>
            `;
            button.title = 'Preview';
            button.setAttribute('aria-label', `Preview ${fileDisplayName}`);
        }
    }
    
    /**
     * Handle play button click (preview/pause)
     */
    handlePlayClick(file, item, playButton) {
        const isCurrentlyPlaying = this.playingFilePath === file.path && this.isPlaying;
        
        // Toggle play state
        if (isCurrentlyPlaying) {
            // Currently playing this file - pause it
            this.setPlayingFile(null, false);
            if (this.onPlayStateChange) {
                this.onPlayStateChange(file, false);
            }
        } else {
            // Not playing or different file - start playing
            this.setActiveFile(file.path);
            this.setPlayingFile(file.path, true);
            
            // Call preview callback if provided
            if (this.onFilePreview) {
                this.onFilePreview(file);
            } else if (this.onFileClick) {
                // Fallback to regular click handler
                this.onFileClick(file);
            }
            
            if (this.onPlayStateChange) {
                this.onPlayStateChange(file, true);
            }
        }
    }
    
    /**
     * Handle file click
     */
    handleFileClick(file, item) {
        // Remove active from all items
        this.container.querySelectorAll('.file-item').forEach(el => {
            el.classList.remove('active');
        });
        
        // Set this item as active
        item.classList.add('active');
        this.activeFilePath = file.path;
        
        // Call callback if provided
        if (this.onFileClick) {
            this.onFileClick(file);
        }
    }
    
    /**
     * Show tooltip for file item
     */
    showTooltip(item, file) {
        const metadata = this.metadata[file.name];
        
        if (metadata) {
            this.positionTooltipWithMetadata(item, metadata);
        } else {
            this.positionTooltipNoMetadata(item);
        }
        
        // Call hover callback if provided
        if (this.onFileHover) {
            this.onFileHover(file, metadata);
        }
    }
    
    /**
     * Position tooltip with metadata
     */
    positionTooltipWithMetadata(item, metadata) {
        const itemRect = item.getBoundingClientRect();
        
        // Set tooltip content
        this.tooltip.innerHTML = `
            <div class="tooltip-row">RMS: ${metadata.rms_mean.toFixed(3)}</div>
            <div class="tooltip-row">Duration: ${metadata.duration.toFixed(1)}s</div>
            <div class="tooltip-row">Balance: ${metadata.stereo_balance.toFixed(2)}</div>
            <div class="tooltip-row">Movement: ${metadata.stereo_movement.toFixed(2)}</div>
        `;
        
        this.positionTooltip(item, itemRect);
    }
    
    /**
     * Position tooltip without metadata
     */
    positionTooltipNoMetadata(item) {
        const itemRect = item.getBoundingClientRect();
        
        this.tooltip.innerHTML = '<div class="tooltip-row">No metadata available</div>';
        this.positionTooltip(item, itemRect);
    }
    
    /**
     * Position tooltip relative to item
     */
    positionTooltip(item, itemRect) {
        // Position off-screen temporarily to measure
        this.tooltip.style.left = '-9999px';
        this.tooltip.style.top = '0px';
        this.tooltip.style.visibility = 'hidden';
        this.tooltip.style.display = 'block';
        this.tooltip.classList.remove('show');
        
        const tooltipRect = this.tooltip.getBoundingClientRect();
        const spacing = 8;
        
        // Calculate position to the right of item
        let left = itemRect.right + spacing;
        let top = itemRect.top + (itemRect.height / 2) - (tooltipRect.height / 2);
        const itemCenterY = itemRect.top + (itemRect.height / 2);
        
        // Check if tooltip would go off the right edge
        if (left + tooltipRect.width > window.innerWidth - 10) {
            left = itemRect.left - tooltipRect.width - spacing;
            this.tooltip.classList.add('flipped');
        } else {
            this.tooltip.classList.remove('flipped');
        }
        
        // Ensure tooltip doesn't go off top or bottom
        if (top < 10) {
            top = 10;
        } else if (top + tooltipRect.height > window.innerHeight - 10) {
            top = window.innerHeight - tooltipRect.height - 10;
        }
        
        // Calculate arrow position
        const arrowTop = itemCenterY - top;
        
        // Position and show tooltip
        this.tooltip.style.left = `${left}px`;
        this.tooltip.style.top = `${top}px`;
        this.tooltip.style.setProperty('--arrow-top', `${arrowTop}px`);
        this.tooltip.style.visibility = 'visible';
        this.tooltip.classList.add('show');
    }
    
    /**
     * Hide tooltip
     */
    hideTooltip() {
        if (this.tooltip) {
            this.tooltip.classList.remove('show');
            this.tooltip.style.visibility = 'hidden';
        }
    }
    
    /**
     * Set active file
     */
    setActiveFile(filePath) {
        this.activeFilePath = filePath;
        
        // Update UI
        this.container.querySelectorAll('.file-item').forEach(item => {
            if (item.dataset.filePath === filePath) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }
    
    /**
     * Set playing file and state
     * @param {string|null} filePath - Path of file that's playing (null to stop)
     * @param {boolean} isPlaying - Whether file is currently playing
     */
    setPlayingFile(filePath, isPlaying) {
        const wasPlaying = this.playingFilePath === filePath && this.isPlaying;
        
        // Update state
        this.playingFilePath = filePath;
        this.isPlaying = isPlaying;
        
        // Update all play buttons
        this.container.querySelectorAll('.file-item-play-btn').forEach(button => {
            const buttonFilePath = button.dataset.filePath;
            const shouldShowPause = buttonFilePath === filePath && isPlaying;
            // Get filename from the file item
            const fileItem = button.closest('.file-item');
            const fileName = fileItem ? fileItem.querySelector('.file-item-text')?.textContent : null;
            this.updatePlayButtonIcon(button, shouldShowPause, fileName);
        });
        
        // Update progress bars if enabled
        if (this.showProgressBar) {
            this.container.querySelectorAll('.file-item-progress').forEach(progressBar => {
                const progressFilePath = progressBar.dataset.filePath;
                if (progressFilePath === filePath && isPlaying) {
                    progressBar.classList.add('playing');
                } else {
                    progressBar.classList.remove('playing');
                }
            });
        }
    }
    
    /**
     * Update progress for a file (if progress bar is enabled)
     * @param {string} filePath - Path of file
     * @param {number} progress - Progress percentage (0-100)
     */
    updateProgress(filePath, progress) {
        if (!this.showProgressBar) return;
        
        const progressBar = this.container.querySelector(
            `.file-item-progress[data-file-path="${filePath}"]`
        );
        
        if (progressBar) {
            const progressFill = progressBar.querySelector('.file-item-progress-fill');
            if (progressFill) {
                progressFill.style.width = `${Math.max(0, Math.min(100, progress))}%`;
            }
        }
    }
    
    /**
     * Update metadata
     */
    updateMetadata(metadata) {
        this.metadata = metadata || {};
    }
    
    /**
     * Cleanup
     */
    destroy() {
        // Remove filter button event listener
        if (this.filterButton && this.boundHandlers.filterBtnClick) {
            this.filterButton.removeEventListener('click', this.boundHandlers.filterBtnClick);
        }
        
        // Clear bound handlers references
        this.boundHandlers = {
            filterBtnClick: null
        };
        
        this.hideTooltip();
        if (this.container) {
            this.container.innerHTML = '';
        }
        
        // Clear references
        this.filterButton = null;
        
        // Note: We don't remove the tooltip element as it might be shared
        // Note: File item listeners are automatically removed when container.innerHTML is cleared
    }
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PatternExplorer;
}
