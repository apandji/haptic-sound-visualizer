/**
 * PatternQueue Component
 * Displays a queue of selected patterns with drag & drop reordering
 */
class PatternQueue {
    constructor(options = {}) {
        this.containerId = options.containerId || 'queue';
        this.container = document.getElementById(this.containerId);
        this.metadata = options.metadata || {};
        this.onItemRemove = options.onItemRemove || null;
        this.onReorder = options.onReorder || null;
        this.onClear = options.onClear || null;
        this.onRandomSelect = options.onRandomSelect || null; // Called when random selection is made
        this.getAvailableFiles = options.getAvailableFiles || null; // Callback to get filtered/available files for random selection
        
        // Queue state: array of file objects with order
        this.items = [];
        
        // Drag & drop state
        this.draggedItem = null;
        this.dragOverIndex = null;
        this.dropZoneIndicator = null; // Visual indicator for drop position
        
        // Track newly added items for highlight animation
        this.newlyAddedItems = new Set();
        
        // Create tooltip element (reuse same global tooltip as PatternExplorer)
        this.tooltip = this.createTooltip();
        
        if (!this.container) {
            console.error(`PatternQueue: Container #${this.containerId} not found`);
            return;
        }
        
        // Add queue class to container
        this.container.classList.add('queue');
        
        // Initialize (always visible now)
        this.render();
    }
    
    /**
     * Create global tooltip element (reuse PatternExplorer's tooltip)
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
     * Render the queue (always visible)
     */
    render() {
        if (!this.container) return;
        
        // Always visible - no hide/show logic
        this.container.classList.remove('queue--hidden');
        
        // Check if header, list, and footer already exist
        let header = this.container.querySelector('.queue__header');
        let listContainer = this.container.querySelector('.queue__list');
        let footer = this.container.querySelector('.queue__footer');
        
        if (!header) {
            // Create header
            header = this.createHeader();
            this.container.appendChild(header);
        } else {
            // Update count in existing header
            const countEl = header.querySelector('.queue__header-count');
            this.updateCount(countEl);
        }
        
        if (!listContainer) {
            // Create queue list container
            listContainer = document.createElement('div');
            listContainer.className = 'queue__list';
            this.container.appendChild(listContainer);
        }
        
        if (!footer) {
            // Create footer
            footer = this.createFooter();
            this.container.appendChild(footer);
        } else {
            // Update clear button state in existing footer
            const clearBtn = footer.querySelector('.queue__footer-clear');
            this.updateClearButton(clearBtn);
        }
        
        // Render items
        this.renderItems(listContainer);
        
        // Add drag leave handler to container to hide drop zone when leaving queue area
        if (listContainer) {
            listContainer.addEventListener('dragleave', (e) => {
                // Only hide if we're actually leaving the container
                if (!listContainer.contains(e.relatedTarget)) {
                    this.hideDropZoneIndicator();
                }
            });
        }
    }
    
    /**
     * Create header with PATTERNS title and count
     */
    createHeader() {
        const header = document.createElement('div');
        header.className = 'queue__header';
        
        const headerLeft = document.createElement('div');
        headerLeft.className = 'queue__header-left';
        
        const headerText = document.createElement('span');
        headerText.className = 'queue__header-text';
        headerText.textContent = 'PATTERNS';
        headerLeft.appendChild(headerText);
        
        const headerCount = document.createElement('span');
        headerCount.className = 'queue__header-count';
        headerLeft.appendChild(headerCount);
        
        header.appendChild(headerLeft);
        
        // Header actions container (only Random buttons now)
        const headerActions = document.createElement('div');
        headerActions.className = 'queue__header-actions';
        
        // Random selection buttons (always visible if getAvailableFiles is provided)
        if (this.getAvailableFiles) {
            const randomGroup = document.createElement('div');
            randomGroup.className = 'queue__header-random-group';
            
            const randomLabel = document.createElement('span');
            randomLabel.className = 'queue__header-random-label';
            randomLabel.textContent = 'Random:';
            randomGroup.appendChild(randomLabel);
            
            // Random count buttons: 3, 5, 10, 20
            [3, 5, 10, 20].forEach(count => {
                const randomBtn = document.createElement('button');
                randomBtn.className = 'queue__header-random-btn';
                randomBtn.textContent = count.toString();
                randomBtn.setAttribute('aria-label', `Randomly select ${count} patterns`);
                randomBtn.title = `Random ${count}`;
                randomBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.randomSelect(count);
                });
                randomGroup.appendChild(randomBtn);
            });
            
            headerActions.appendChild(randomGroup);
        }
        
        header.appendChild(headerActions);
        
        // Update count
        this.updateCount(headerCount);
        
        return header;
    }
    
    /**
     * Create footer with Clear button
     */
    createFooter() {
        const footer = document.createElement('div');
        footer.className = 'queue__footer';
        
        // Clear button (always visible, disabled when empty)
        const clearButton = document.createElement('button');
        clearButton.className = 'queue__footer-clear';
        clearButton.textContent = 'CLEAR';
        clearButton.setAttribute('aria-label', 'Clear all items from session');
        clearButton.title = 'Clear all items';
        clearButton.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!clearButton.disabled) {
                this.clear();
            }
        });
        footer.appendChild(clearButton);
        
        // Update clear button state
        this.updateClearButton(clearButton);
        
        return footer;
    }
    
    
    /**
     * Update count display
     */
    updateCount(countElement) {
        if (!countElement) {
            countElement = this.container?.querySelector('.queue__header-count');
        }
        if (countElement) {
            const count = this.items.length;
            countElement.textContent = count > 0 ? `${count}` : '';
        }
    }
    
    /**
     * Update clear button state (disabled when empty)
     */
    updateClearButton(clearButton) {
        if (!clearButton) {
            clearButton = this.container?.querySelector('.queue__footer-clear');
        }
        if (clearButton) {
            clearButton.disabled = this.items.length === 0;
        }
    }
    
    /**
     * Render queue items
     */
    renderItems(container) {
        if (!container) {
            container = this.container?.querySelector('.queue__list');
        }
        if (!container) return;
        
        container.innerHTML = '';
        
        // Update count in header
        const header = this.container.querySelector('.queue__header');
        if (header) {
            const countEl = header.querySelector('.queue__header-count');
            this.updateCount(countEl);
        }
        
        // Update clear button state in footer
        const footer = this.container.querySelector('.queue__footer');
        if (footer) {
            const clearBtn = footer.querySelector('.queue__footer-clear');
            this.updateClearButton(clearBtn);
        }
        
        if (this.items.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'queue__empty';
            emptyState.textContent = 'Select patterns to include in session';
            container.appendChild(emptyState);
            return;
        }
        
        this.items.forEach((item, index) => {
            const queueItem = this.createQueueItem(item, index);
            container.appendChild(queueItem);
            
            // Highlight newly added items
            if (this.newlyAddedItems.has(item.path)) {
                queueItem.classList.add('queue__item--newly-added');
                // Remove highlight class after animation
                setTimeout(() => {
                    queueItem.classList.remove('queue__item--newly-added');
                    this.newlyAddedItems.delete(item.path);
                }, 600);
            }
        });
    }
    
    /**
     * Create a queue item element
     */
    createQueueItem(file, index) {
        const item = document.createElement('div');
        item.className = 'queue__item';
        item.draggable = true;
        item.dataset.index = index;
        item.dataset.filePath = file.path;
        
        // Order number
        const orderNumber = document.createElement('span');
        orderNumber.className = 'queue__item-order';
        orderNumber.textContent = `${index + 1}`;
        item.appendChild(orderNumber);
        
        // Pattern name
        const name = document.createElement('span');
        name.className = 'queue__item-name';
        name.textContent = file.name;
        item.appendChild(name);
        
        // Drag handle (≡)
        const dragHandle = document.createElement('span');
        dragHandle.className = 'queue__item-drag-handle';
        dragHandle.innerHTML = '≡';
        dragHandle.setAttribute('aria-label', 'Drag to reorder');
        dragHandle.title = 'Drag to reorder';
        item.appendChild(dragHandle);
        
        // Remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'queue__item-remove';
        removeBtn.innerHTML = '×';
        removeBtn.setAttribute('aria-label', `Remove ${file.name} from queue`);
        removeBtn.title = 'Remove from queue';
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeItem(index);
        });
        item.appendChild(removeBtn);
        
        // Drag & drop handlers
        item.addEventListener('dragstart', (e) => {
            this.handleDragStart(e, index);
        });
        
        item.addEventListener('dragover', (e) => {
            this.handleDragOver(e, index);
        });
        
        item.addEventListener('dragleave', () => {
            this.handleDragLeave(index);
        });
        
        item.addEventListener('drop', (e) => {
            this.handleDrop(e, index);
        });
        
        item.addEventListener('dragend', () => {
            this.handleDragEnd();
        });
        
        // Tooltip handlers
        item.addEventListener('mouseenter', (e) => {
            // Don't show tooltip if hovering over buttons
            if (e.target !== removeBtn && e.target !== dragHandle && !removeBtn.contains(e.target) && !dragHandle.contains(e.target)) {
                this.showTooltip(item, file);
            }
        });
        
        item.addEventListener('mouseleave', () => {
            this.hideTooltip();
        });
        
        item.addEventListener('mousemove', (e) => {
            if (e.target !== removeBtn && e.target !== dragHandle && !removeBtn.contains(e.target) && !dragHandle.contains(e.target)) {
                if (this.tooltip.classList.contains('show')) {
                    this.showTooltip(item, file);
                }
            }
        });
        
        return item;
    }
    
    /**
     * Handle drag start
     */
    handleDragStart(e, index) {
        this.draggedItem = index;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.target.outerHTML);
        e.target.classList.add('queue__item--dragging');
    }
    
    /**
     * Handle drag over
     */
    handleDragOver(e, index) {
        if (e.preventDefault) {
            e.preventDefault();
        }
        e.dataTransfer.dropEffect = 'move';
        
        if (this.draggedItem !== null) {
            const item = e.currentTarget;
            const container = item.parentElement;
            
            // Find the dragged element by its dragging class (more reliable than index)
            const draggedElement = container.querySelector('.queue__item--dragging');
            
            if (!draggedElement) {
                return false;
            }
            
            // Don't do anything if dragging over self
            if (draggedElement === item) {
                return false;
            }
            
            // Auto-scroll when near edges
            this.handleAutoScroll(container, e.clientY);
            
            const afterElement = this.getDragAfterElement(container, e.clientY);
            
            // Show drop zone indicator
            this.showDropZoneIndicator(container, afterElement, e.clientY);
            
            // Visual reordering for feedback
            if (afterElement == null) {
                // Insert at end
                container.appendChild(draggedElement);
            } else {
                // Insert before the element we're hovering over
                container.insertBefore(draggedElement, afterElement);
            }
            
            // Update order numbers for visual feedback
            this.updateOrderNumbers();
            
            // Update drag over index for visual feedback
            this.dragOverIndex = index;
        }
        
        return false;
    }
    
    /**
     * Handle auto-scroll when dragging near container edges
     */
    handleAutoScroll(container, y) {
        const containerRect = container.getBoundingClientRect();
        const scrollThreshold = 50; // pixels from edge
        const scrollSpeed = 10; // pixels per frame
        
        // Check if near top edge
        if (y - containerRect.top < scrollThreshold && container.scrollTop > 0) {
            container.scrollTop -= scrollSpeed;
        }
        // Check if near bottom edge
        else if (containerRect.bottom - y < scrollThreshold && 
                 container.scrollTop < container.scrollHeight - container.clientHeight) {
            container.scrollTop += scrollSpeed;
        }
    }
    
    /**
     * Show drop zone indicator
     */
    showDropZoneIndicator(container, afterElement, y) {
        // Remove existing indicator
        this.hideDropZoneIndicator();
        
        // Create drop zone indicator
        const indicator = document.createElement('div');
        indicator.className = 'queue__drop-zone-indicator';
        this.dropZoneIndicator = indicator;
        
        if (afterElement) {
            // Insert before target element
            container.insertBefore(indicator, afterElement);
        } else {
            // Insert at end
            container.appendChild(indicator);
        }
    }
    
    /**
     * Hide drop zone indicator
     */
    hideDropZoneIndicator() {
        if (this.dropZoneIndicator && this.dropZoneIndicator.parentElement) {
            this.dropZoneIndicator.parentElement.removeChild(this.dropZoneIndicator);
        }
        this.dropZoneIndicator = null;
    }
    
    /**
     * Get element after which to insert dragged item
     */
    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.queue__item:not(.queue__item--dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
    
    /**
     * Handle drag leave
     */
    handleDragLeave(index) {
        // Visual feedback handled in dragover
        // Drop zone indicator persists until drag ends or we leave the container
    }
    
    /**
     * Handle drop
     */
    handleDrop(e, index) {
        if (e.stopPropagation) {
            e.stopPropagation();
        }
        
        if (e.preventDefault) {
            e.preventDefault();
        }
        
        // Hide drop zone indicator
        this.hideDropZoneIndicator();
        
        if (this.draggedItem !== null) {
            // Calculate new index based on final DOM position
            const container = e.currentTarget.parentElement;
            const items = Array.from(container.querySelectorAll('.queue__item'));
            const draggedElement = items.find(item => item.classList.contains('queue__item--dragging'));
            
            if (!draggedElement) {
                return false;
            }
            
            // Get the final position of the dragged element in the DOM
            const newIndex = items.indexOf(draggedElement);
            
            // Only reorder if position actually changed
            if (newIndex !== this.draggedItem) {
                // Reorder items array based on final DOM position
                const draggedItemData = this.items[this.draggedItem];
                this.items.splice(this.draggedItem, 1);
                
                // Insert at new position
                this.items.splice(newIndex, 0, draggedItemData);
                
                // Update order numbers to reflect new positions
                this.updateOrderNumbers();
                
                // Brief highlight on the reordered item
                draggedElement.classList.add('queue__item--reordered');
                setTimeout(() => {
                    draggedElement.classList.remove('queue__item--reordered');
                }, 400);
                
                // Call callback
                if (this.onReorder) {
                    this.onReorder(this.items);
                }
            }
        }
        
        return false;
    }
    
    /**
     * Handle drag end
     */
    handleDragEnd() {
        // Remove dragging class from all items
        this.container.querySelectorAll('.queue__item--dragging').forEach(item => {
            item.classList.remove('queue__item--dragging');
        });
        
        // Hide drop zone indicator
        this.hideDropZoneIndicator();
        
        // Update order numbers in case drag ended without drop
        this.updateOrderNumbers();
        
        this.draggedItem = null;
        this.dragOverIndex = null;
    }
    
    /**
     * Update order numbers for all queue items
     */
    updateOrderNumbers() {
        const container = this.container?.querySelector('.queue__list');
        if (!container) return;
        
        const items = container.querySelectorAll('.queue__item');
        items.forEach((item, index) => {
            const orderNumber = item.querySelector('.queue__item-order');
            if (orderNumber) {
                orderNumber.textContent = `${index + 1}`;
            }
            // Update dataset index
            item.dataset.index = index;
        });
    }
    
    /**
     * Show tooltip for queue item (reuse PatternExplorer logic)
     */
    showTooltip(item, file) {
        const metadata = this.metadata[file.name];
        
        if (metadata) {
            this.positionTooltipWithMetadata(item, metadata);
        } else {
            this.positionTooltipNoMetadata(item);
        }
    }
    
    /**
     * Position tooltip with metadata
     */
    positionTooltipWithMetadata(item, metadata) {
        const itemRect = item.getBoundingClientRect();
        const spacing = 8;
        
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
        const spacing = 8;
        
        // Reset tooltip position
        this.tooltip.style.left = '-9999px';
        this.tooltip.style.top = '0px';
        this.tooltip.style.visibility = 'hidden';
        this.tooltip.style.display = 'block';
        this.tooltip.classList.remove('show');
        
        const tooltipRect = this.tooltip.getBoundingClientRect();
        
        // Position to the right of item
        let left = itemRect.right + spacing;
        let top = itemRect.top + (itemRect.height / 2) - (tooltipRect.height / 2);
        
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
        
        const arrowTop = (itemRect.top + itemRect.height / 2) - top;
        
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
     * Add item to queue
     */
    addItem(file) {
        // Check if already in queue
        const exists = this.items.some(item => item.path === file.path);
        if (exists) {
            return false; // Already in queue
        }
        
        // Mark as newly added for highlight animation
        this.newlyAddedItems.add(file.path);
        
        this.items.push(file);
        this.render();
        return true;
    }
    
    /**
     * Remove item from queue
     */
    removeItem(index) {
        if (index >= 0 && index < this.items.length) {
            const removedItem = this.items[index];
            this.items.splice(index, 1);
            this.render();
            
            // Call callback
            if (this.onItemRemove) {
                this.onItemRemove(removedItem, index);
            }
            
            return removedItem;
        }
        return null;
    }
    
    /**
     * Clear all items from queue
     */
    clear() {
        if (this.items.length === 0) {
            return;
        }
        
        const clearedItems = [...this.items];
        this.items = [];
        this.render();
        
        // Call callback for each removed item
        if (this.onItemRemove) {
            clearedItems.forEach((item, index) => {
                this.onItemRemove(item, index);
            });
        }
        
        // Call clear callback if provided
        if (this.onClear) {
            this.onClear(clearedItems);
        }
    }
    
    /**
     * Randomly select N patterns from available files
     */
    randomSelect(count) {
        if (!this.getAvailableFiles) {
            console.warn('PatternQueue: getAvailableFiles callback not provided');
            return;
        }
        
        const availableFiles = this.getAvailableFiles();
        if (!availableFiles || availableFiles.length === 0) {
            console.warn('PatternQueue: No available files for random selection');
            return;
        }
        
        // Don't select more than available
        const selectCount = Math.min(count, availableFiles.length);
        
        // Shuffle and select N items
        const shuffled = [...availableFiles].sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, selectCount);
        
        // Clear current queue and add random selections
        this.items = [];
        selected.forEach(file => {
            // Mark as newly added for highlight animation
            this.newlyAddedItems.add(file.path);
            this.items.push(file);
        });
        
        this.render();
        
        // Call callbacks for each added item
        if (this.onItemRemove) {
            // Note: onItemRemove is called for removals, but we can use it to sync
            // The PatternExplorerWithSelection will sync via syncWithQueue
        }
        
        // Call random select callback if provided
        if (this.onRandomSelect) {
            this.onRandomSelect(selected, count);
        }
    }
    
    /**
     * Get all items in queue
     */
    getItems() {
        return [...this.items];
    }
    
    /**
     * Clear queue
     */
    clear() {
        this.items = [];
        this.render();
    }
    
    /**
     * Check if file is in queue
     */
    isInQueue(filePath) {
        return this.items.some(item => item.path === filePath);
    }
    
    /**
     * Update metadata
     */
    updateMetadata(metadata) {
        this.metadata = metadata || {};
    }
    
    /**
     * Destroy component
     */
    destroy() {
        this.hideTooltip();
        if (this.container) {
            this.container.innerHTML = '';
        }
        this.items = [];
    }
}
