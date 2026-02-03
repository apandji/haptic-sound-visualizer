/**
 * FilterDrawer Component
 * Slide-out panel that slides out from behind a parent container
 * Handles positioning, animations, and open/close state
 */
class FilterDrawer {
    constructor(options = {}) {
        // Container ID (will be created if not exists)
        this.containerId = options.containerId || 'filterDrawer';
        
        // Parent container to position relative to (e.g., Pattern Explorer container)
        this.parentContainer = options.parentContainer || null;
        
        // Get or create container
        let container = document.getElementById(this.containerId);
        if (!container) {
            container = document.createElement('div');
            container.id = this.containerId;
            
            // Append to parent container if provided, otherwise to body
            if (this.parentContainer) {
                this.parentContainer.appendChild(container);
            } else {
                document.body.appendChild(container);
            }
        }
        this.container = container;
        
        // Configuration
        this.width = options.width || 350; // Panel width in pixels
        this.position = options.position || 'right'; // 'left' or 'right'
        
        // Callbacks
        this.onOpen = options.onOpen || null;
        this.onClose = options.onClose || null;
        
        // State
        this.isOpen = false;
        
        // Initialize
        this.init();
    }
    
    /**
     * Initialize the drawer
     */
    init() {
        this.createHTML();
        this.setupEventListeners();
    }
    
    /**
     * Create HTML structure
     */
    createHTML() {
        // Add base classes
        this.container.className = 'filter-drawer';
        if (this.position === 'right') {
            this.container.classList.add('filter-drawer--right');
        } else {
            this.container.classList.add('filter-drawer--left');
        }
        
        // If parent container exists, add class to indicate relative positioning
        if (this.parentContainer) {
            this.container.classList.add('filter-drawer--relative');
        }
        
        // Create panel
        this.panel = document.createElement('div');
        this.panel.className = 'filter-drawer__panel';
        this.panel.setAttribute('role', 'dialog');
        this.panel.setAttribute('aria-label', 'Filter Panel');
        
        // Set width
        this.panel.style.width = `${this.width}px`;
        
        // Create header
        const header = document.createElement('div');
        header.className = 'filter-drawer__header';
        
        const title = document.createElement('h2');
        title.className = 'filter-drawer__title';
        title.textContent = 'FILTERS';
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'filter-drawer__close';
        closeBtn.setAttribute('aria-label', 'Close filters');
        closeBtn.innerHTML = '×';
        closeBtn.type = 'button';
        
        header.appendChild(title);
        header.appendChild(closeBtn);
        
        // Create content area
        this.content = document.createElement('div');
        this.content.className = 'filter-drawer__content';
        this.content.id = `${this.containerId}_content`;
        
        // Assemble panel
        this.panel.appendChild(header);
        this.panel.appendChild(this.content);
        
        // Add to container
        this.container.appendChild(this.panel);
        
        // Set initial state (closed)
        this.updateState();
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Close button
        const closeBtn = this.panel.querySelector('.filter-drawer__close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.close();
            });
        }
        
        // Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
    }
    
    /**
     * Open the drawer
     */
    open() {
        if (this.isOpen) return;
        
        this.isOpen = true;
        this.updateState();
        
        if (this.onOpen) {
            this.onOpen();
        }
    }
    
    /**
     * Close the drawer
     */
    close() {
        if (!this.isOpen) return;
        
        this.isOpen = false;
        this.updateState();
        
        if (this.onClose) {
            this.onClose();
        }
    }
    
    /**
     * Toggle open/close state
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
    
    /**
     * Update visual state (open/closed)
     */
    updateState() {
        if (this.isOpen) {
            this.container.classList.add('filter-drawer--open');
            this.panel.setAttribute('aria-hidden', 'false');
        } else {
            this.container.classList.remove('filter-drawer--open');
            this.panel.setAttribute('aria-hidden', 'true');
        }
    }
    
    /**
     * Get content container (for inserting FilterPanel)
     */
    getContentContainer() {
        return this.content;
    }
    
    /**
     * Set panel width
     */
    setWidth(width) {
        this.width = width;
        this.panel.style.width = `${width}px`;
    }
    
    /**
     * Destroy the drawer
     */
    destroy() {
        // Remove event listeners
        const closeBtn = this.panel.querySelector('.filter-drawer__close');
        if (closeBtn) {
            closeBtn.replaceWith(closeBtn.cloneNode(true));
        }
        
        // Remove container
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}
