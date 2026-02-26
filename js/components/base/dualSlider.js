/**
 * DualSlider Component
 * A dual-handle range slider for selecting min/max values
 */
class DualSlider {
    constructor(options = {}) {
        // Required options
        this.containerId = options.containerId;
        this.container = document.getElementById(this.containerId);
        
        if (!this.container) {
            console.error(`DualSlider: Container #${this.containerId} not found`);
            return;
        }
        
        // Configuration
        this.min = options.min !== undefined ? options.min : 0;
        this.max = options.max !== undefined ? options.max : 1;
        this.step = options.step !== undefined ? options.step : 0.01;
        this.label = options.label || '';
        this.initialMin = options.initialMin !== undefined ? options.initialMin : this.min;
        this.initialMax = options.initialMax !== undefined ? options.initialMax : this.max;
        
        // Custom formatting function
        this.formatValue = options.formatValue || ((val) => val.toFixed(2));
        
        // Callbacks
        this.onChange = options.onChange || null;
        
        // State
        this.valueMin = this.initialMin;
        this.valueMax = this.initialMax;
        this.activeHandle = null;
        
        // DOM elements (will be created)
        this.track = null;
        this.range = null;
        this.handleMin = null;
        this.handleMax = null;
        this.display = null;
        
        // Bound event handlers (for proper cleanup)
        this.boundHandlers = {
            handleMinMouseDown: null,
            handleMaxMouseDown: null,
            handleMinTouchStart: null,
            handleMaxTouchStart: null,
            documentMouseMove: null,
            documentMouseUp: null,
            documentTouchMove: null,
            documentTouchEnd: null,
            trackClick: null
        };
        
        // Initialize
        this.init();
    }
    
    /**
     * Initialize the slider
     */
    init() {
        // Create HTML structure
        this.createHTML();
        
        // Get DOM references
        this.track = this.container.querySelector('.dual-slider__track');
        this.range = this.container.querySelector('.dual-slider__range');
        this.handleMin = this.container.querySelector('.dual-slider__handle-min');
        this.handleMax = this.container.querySelector('.dual-slider__handle-max');
        this.display = this.container.querySelector('.dual-slider__display');
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Initial update
        this.updateSlider();
    }
    
    /**
     * Create HTML structure
     */
    createHTML() {
        // Preserve existing classes (like dual-slider--compact)
        if (!this.container.classList.contains('dual-slider')) {
            this.container.classList.add('dual-slider');
        }
        this.container.innerHTML = `
            <div class="dual-slider__track"></div>
            <div class="dual-slider__handle dual-slider__handle-min" data-handle="min"></div>
            <div class="dual-slider__handle dual-slider__handle-max" data-handle="max"></div>
            <div class="dual-slider__range"></div>
        `;
        
        // Create display element if label provided
        if (this.label) {
            const display = document.createElement('span');
            display.className = 'dual-slider__display';
            this.container.parentElement.insertBefore(display, this.container.nextSibling);
        }
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Create bound handlers and store references for cleanup
        this.boundHandlers.handleMinMouseDown = (e) => this.handleMouseDown(e, this.handleMin);
        this.boundHandlers.handleMaxMouseDown = (e) => this.handleMouseDown(e, this.handleMax);
        this.boundHandlers.handleMinTouchStart = (e) => this.handleTouchStart(e, this.handleMin);
        this.boundHandlers.handleMaxTouchStart = (e) => this.handleTouchStart(e, this.handleMax);
        this.boundHandlers.documentMouseMove = (e) => this.handleMouseMove(e);
        this.boundHandlers.documentMouseUp = () => this.handleMouseUp();
        this.boundHandlers.documentTouchMove = (e) => this.handleTouchMove(e);
        this.boundHandlers.documentTouchEnd = () => this.handleTouchEnd();
        this.boundHandlers.trackClick = (e) => this.handleTrackClick(e);
        
        // Handle mouse down on handles
        this.handleMin.addEventListener('mousedown', this.boundHandlers.handleMinMouseDown);
        this.handleMax.addEventListener('mousedown', this.boundHandlers.handleMaxMouseDown);
        
        // Handle mouse move and up on document (for dragging)
        document.addEventListener('mousemove', this.boundHandlers.documentMouseMove);
        document.addEventListener('mouseup', this.boundHandlers.documentMouseUp);
        
        // Handle touch events
        this.handleMin.addEventListener('touchstart', this.boundHandlers.handleMinTouchStart);
        this.handleMax.addEventListener('touchstart', this.boundHandlers.handleMaxTouchStart);
        document.addEventListener('touchmove', this.boundHandlers.documentTouchMove);
        document.addEventListener('touchend', this.boundHandlers.documentTouchEnd);
        
        // Allow clicking on track to move nearest handle
        this.track.addEventListener('click', this.boundHandlers.trackClick);
    }
    
    /**
     * Get current values
     */
    getValues() {
        return {
            min: this.valueMin,
            max: this.valueMax
        };
    }
    
    /**
     * Set values programmatically
     */
    setValues(newMin, newMax) {
        // Clamp values
        newMin = Math.max(this.min, Math.min(newMin, this.valueMax - this.step));
        newMax = Math.min(this.max, Math.max(newMax, this.valueMin + this.step));
        
        this.valueMin = newMin;
        this.valueMax = newMax;
        
        this.updateSlider();
    }
    
    /**
     * Reset to full range
     */
    reset() {
        this.valueMin = this.min;
        this.valueMax = this.max;
        this.updateSlider();
    }
    
    /**
     * Update slider visual state
     */
    updateSlider() {
        const minPercent = ((this.valueMin - this.min) / (this.max - this.min)) * 100;
        const maxPercent = ((this.valueMax - this.min) / (this.max - this.min)) * 100;
        
        // Get container padding to account for handle positioning
        const containerStyles = window.getComputedStyle(this.container);
        const paddingLeft = parseFloat(containerStyles.paddingLeft) || 0;
        const paddingRight = parseFloat(containerStyles.paddingRight) || 0;
        const containerWidth = this.container.getBoundingClientRect().width;
        const trackWidth = containerWidth - paddingLeft - paddingRight;
        
        // Calculate handle positions relative to container, accounting for padding
        // Handles are centered on the track, so we need to position them relative to track start
        // Ensure handles stay within visible bounds (accounting for handle width)
        const handleWidth = this.container.classList.contains('dual-slider--compact') ? 12 : 14;
        const handleHalfWidth = handleWidth / 2;
        
        // Calculate positions ensuring handles don't go outside container bounds
        const minLeft = Math.max(paddingLeft + handleHalfWidth, paddingLeft + (minPercent / 100) * trackWidth);
        const maxLeft = Math.min(containerWidth - paddingRight - handleHalfWidth, paddingLeft + (maxPercent / 100) * trackWidth);
        
        // Ensure max is always >= min
        const finalMaxLeft = Math.max(minLeft, maxLeft);
        
        // Update handle positions (in pixels, accounting for padding)
        this.handleMin.style.left = `${minLeft}px`;
        this.handleMax.style.left = `${finalMaxLeft}px`;
        
        // Update range bar - position it to align with handle centers
        // The range should start at the min handle center and end at the max handle center
        // Both handles and range are positioned relative to the container
        // minLeft and finalMaxLeft are already relative to container, so use them directly
        this.range.style.left = `${minLeft}px`;
        this.range.style.width = `${finalMaxLeft - minLeft}px`;
        
        // Update display
        if (this.display) {
            const formattedMin = this.formatValue(this.valueMin);
            const formattedMax = this.formatValue(this.valueMax);
            this.display.textContent = `(${formattedMin}-${formattedMax})`;
        }
        
        // Trigger onChange callback
        if (this.onChange) {
            this.onChange(this.valueMin, this.valueMax);
        }
    }
    
    /**
     * Get value from mouse/touch position
     */
    getValueFromPosition(clientX) {
        const trackRect = this.track.getBoundingClientRect();
        const x = clientX - trackRect.left;
        const percent = Math.max(0, Math.min(1, x / trackRect.width));
        const value = this.min + percent * (this.max - this.min);
        // Snap to step
        return Math.round(value / this.step) * this.step;
    }
    
    /**
     * Handle mouse down
     */
    handleMouseDown(e, handle) {
        e.preventDefault();
        this.activeHandle = handle;
        handle.classList.add('active');
        
        const value = this.getValueFromPosition(e.clientX);
        if (handle === this.handleMin) {
            this.setValues(Math.min(value, this.valueMax - this.step), this.valueMax);
        } else {
            this.setValues(this.valueMin, Math.max(value, this.valueMin + this.step));
        }
    }
    
    /**
     * Handle mouse move
     */
    handleMouseMove(e) {
        if (!this.activeHandle) return;
        e.preventDefault();
        
        const value = this.getValueFromPosition(e.clientX);
        if (this.activeHandle === this.handleMin) {
            this.setValues(Math.max(this.min, Math.min(value, this.valueMax - this.step)), this.valueMax);
        } else {
            this.setValues(this.valueMin, Math.min(this.max, Math.max(value, this.valueMin + this.step)));
        }
    }
    
    /**
     * Handle mouse up
     */
    handleMouseUp() {
        if (this.activeHandle) {
            this.activeHandle.classList.remove('active');
            this.activeHandle = null;
        }
    }
    
    /**
     * Handle touch start
     */
    handleTouchStart(e, handle) {
        e.preventDefault();
        const touch = e.touches[0];
        this.activeHandle = handle;
        handle.classList.add('active');
        
        const value = this.getValueFromPosition(touch.clientX);
        if (handle === this.handleMin) {
            this.setValues(Math.min(value, this.valueMax - this.step), this.valueMax);
        } else {
            this.setValues(this.valueMin, Math.max(value, this.valueMin + this.step));
        }
    }
    
    /**
     * Handle touch move
     */
    handleTouchMove(e) {
        if (!this.activeHandle) return;
        e.preventDefault();
        
        const touch = e.touches[0];
        const value = this.getValueFromPosition(touch.clientX);
        if (this.activeHandle === this.handleMin) {
            this.setValues(Math.max(this.min, Math.min(value, this.valueMax - this.step)), this.valueMax);
        } else {
            this.setValues(this.valueMin, Math.min(this.max, Math.max(value, this.valueMin + this.step)));
        }
    }
    
    /**
     * Handle touch end
     */
    handleTouchEnd() {
        if (this.activeHandle) {
            this.activeHandle.classList.remove('active');
            this.activeHandle = null;
        }
    }
    
    /**
     * Handle track click
     */
    handleTrackClick(e) {
        const value = this.getValueFromPosition(e.clientX);
        const distToMin = Math.abs(value - this.valueMin);
        const distToMax = Math.abs(value - this.valueMax);
        
        if (distToMin < distToMax) {
            this.setValues(Math.max(this.min, Math.min(value, this.valueMax - this.step)), this.valueMax);
        } else {
            this.setValues(this.valueMin, Math.min(this.max, Math.max(value, this.valueMin + this.step)));
        }
    }
    
    /**
     * Cleanup
     */
    destroy() {
        // Remove handle event listeners
        if (this.handleMin && this.boundHandlers.handleMinMouseDown) {
            this.handleMin.removeEventListener('mousedown', this.boundHandlers.handleMinMouseDown);
            this.handleMin.removeEventListener('touchstart', this.boundHandlers.handleMinTouchStart);
        }
        
        if (this.handleMax && this.boundHandlers.handleMaxMouseDown) {
            this.handleMax.removeEventListener('mousedown', this.boundHandlers.handleMaxMouseDown);
            this.handleMax.removeEventListener('touchstart', this.boundHandlers.handleMaxTouchStart);
        }
        
        // Remove document-level event listeners
        if (this.boundHandlers.documentMouseMove) {
            document.removeEventListener('mousemove', this.boundHandlers.documentMouseMove);
        }
        if (this.boundHandlers.documentMouseUp) {
            document.removeEventListener('mouseup', this.boundHandlers.documentMouseUp);
        }
        if (this.boundHandlers.documentTouchMove) {
            document.removeEventListener('touchmove', this.boundHandlers.documentTouchMove);
        }
        if (this.boundHandlers.documentTouchEnd) {
            document.removeEventListener('touchend', this.boundHandlers.documentTouchEnd);
        }
        
        // Remove track click listener
        if (this.track && this.boundHandlers.trackClick) {
            this.track.removeEventListener('click', this.boundHandlers.trackClick);
        }
        
        // Clear bound handlers references
        this.boundHandlers = {
            handleMinMouseDown: null,
            handleMaxMouseDown: null,
            handleMinTouchStart: null,
            handleMaxTouchStart: null,
            documentMouseMove: null,
            documentMouseUp: null,
            documentTouchMove: null,
            documentTouchEnd: null,
            trackClick: null
        };
        
        // Remove display element if created
        if (this.display && this.display.parentElement) {
            this.display.parentElement.removeChild(this.display);
        }
        
        // Clear container
        if (this.container) {
            this.container.innerHTML = '';
        }
        
        // Clear DOM references
        this.track = null;
        this.range = null;
        this.handleMin = null;
        this.handleMax = null;
        this.display = null;
        this.activeHandle = null;
    }
}

// Export if using modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DualSlider;
}
