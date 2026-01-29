// Simple Haptic Sound Visualizer
let sound = null;
let fft = null;
let isPlaying = false;
let isLooping = true;
let currentFilePath = null;
let filesList = [];
let allFilesList = []; // Store all files before filtering
let patternMetadata = {}; // Map filename -> metadata
let visualizationMode = 'waveform'; // 'waveform', 'intensity', 'stereo', 'spectrum', 'pulses', 'blob', 'particles', 'landscape'

// Pulse tracking for directional pulses visualization
let activePulses = [];

// Particle system for particle swarm
let particles = [];

// Blob vertices for liquid blob
let blobVertices = [];

// Load files when page loads
window.addEventListener('DOMContentLoaded', async () => {
    // Load metadata first, then file list (so metadata is available when rendering)
    await loadPatternMetadata();
    await loadFileList();
    setupControls();
    setupVizModeSelector();
    setupFilters();
    setupP5Sketch();
});

// Load pattern metadata
async function loadPatternMetadata() {
    try {
        const response = await fetch('pattern_metadata.json');
        if (response.ok) {
            const data = await response.json();
            if (data.patterns && Array.isArray(data.patterns)) {
                // Create a map from filename to metadata
                patternMetadata = {};
                data.patterns.forEach(pattern => {
                    patternMetadata[pattern.filename] = pattern;
                });
                console.log('Loaded metadata for', Object.keys(patternMetadata).length, 'patterns');
            }
        }
    } catch (error) {
        console.warn('Could not load pattern metadata:', error);
    }
}

// Load file list from server or static JSON file
async function loadFileList() {
    // Try API endpoint first (for local development)
    try {
        const apiResponse = await fetch('/api/list-audio-files');
        if (apiResponse.ok) {
            const contentType = apiResponse.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const data = await apiResponse.json();
                if (Array.isArray(data)) {
                    allFilesList = data;
                    applyFilters();
                    console.log('Loaded', allFilesList.length, 'files from API');
                    return;
                }
            }
        }
    } catch (apiError) {
        // API not available, continue to static file
        console.log('API endpoint not available:', apiError.message);
    }
    
    // Fallback to static JSON file (for GitHub Pages)
    // Try different paths to handle various GitHub Pages configurations
    const basePath = window.location.pathname.replace(/\/[^/]*$/, '') || '';
    const jsonPaths = [
        basePath + '/audio-files.json',
        './audio-files.json',
        'audio-files.json',
        '/audio-files.json'
    ];
    
    for (const path of jsonPaths) {
        try {
            console.log('Trying to load from:', path);
            const response = await fetch(path);
            
            if (!response.ok) {
                console.log('Response not OK, status:', response.status, 'for path:', path);
                continue;
            }
            
            const contentType = response.headers.get('content-type') || '';
            console.log('Content-Type:', contentType, 'for path:', path);
            
            // Get response as text first to check if it's JSON
            const text = await response.text();
            
            // Check if it's JSON by content type or by content
            const isJson = contentType.includes('application/json') || 
                          contentType.includes('text/json') ||
                          text.trim().startsWith('[') || 
                          text.trim().startsWith('{');
            
            if (!isJson) {
                console.log('Response does not appear to be JSON, starts with:', text.substring(0, 50));
                continue;
            }
            
            // Parse as JSON
            const data = JSON.parse(text);
            if (Array.isArray(data) && data.length > 0) {
                allFilesList = data;
                applyFilters();
                console.log('Successfully loaded', allFilesList.length, 'files from:', path);
                return;
            } else {
                console.log('Data is not a valid array or is empty');
                continue;
            }
        } catch (fetchError) {
            console.log('Error loading from', path, ':', fetchError.message);
            // Continue to next path
            continue;
        }
    }
    
    // If we get here, all attempts failed
    console.error('Failed to load audio files from any source');
    const fileListEl = document.getElementById('fileList');
    if (fileListEl) {
        fileListEl.innerHTML = '<p style="color: red; padding: 20px;">Error loading files. Please check the console for details.</p>';
    }
}

// Global tooltip element (created once, reused)
let globalTooltip = null;

// Create global tooltip if it doesn't exist
function getGlobalTooltip() {
    if (!globalTooltip) {
        globalTooltip = document.createElement('div');
        globalTooltip.className = 'file-tooltip';
        document.body.appendChild(globalTooltip);
    }
    return globalTooltip;
}

// Position tooltip relative to file item
function positionTooltip(item, metadata) {
    const tooltip = getGlobalTooltip();
    const itemRect = item.getBoundingClientRect();
    
    // Set tooltip content
    tooltip.innerHTML = `
        <div class="tooltip-row">RMS: ${metadata.rms_mean.toFixed(3)}</div>
        <div class="tooltip-row">Duration: ${metadata.duration.toFixed(1)}s</div>
        <div class="tooltip-row">Balance: ${metadata.stereo_balance.toFixed(2)}</div>
        <div class="tooltip-row">Movement: ${metadata.stereo_movement.toFixed(2)}</div>
    `;
    
    // Position tooltip off-screen temporarily to measure it
    tooltip.style.left = '-9999px';
    tooltip.style.top = '0px';
    tooltip.style.visibility = 'hidden';
    tooltip.style.display = 'block';
    tooltip.classList.remove('show'); // Ensure hidden initially
    
    // Force layout calculation
    const tooltipRect = tooltip.getBoundingClientRect();
    const spacing = 8;
    
    // Calculate position to the right of item
    let left = itemRect.right + spacing;
    let top = itemRect.top + (itemRect.height / 2) - (tooltipRect.height / 2);
    
    // Store the item's center Y position for arrow alignment
    const itemCenterY = itemRect.top + (itemRect.height / 2);
    
    // Check if tooltip would go off the right edge
    if (left + tooltipRect.width > window.innerWidth - 10) {
        // Position to the left instead
        left = itemRect.left - tooltipRect.width - spacing;
        tooltip.classList.add('flipped');
    } else {
        tooltip.classList.remove('flipped');
    }
    
    // Ensure tooltip doesn't go off top or bottom
    if (top < 10) {
        top = 10;
    } else if (top + tooltipRect.height > window.innerHeight - 10) {
        top = window.innerHeight - tooltipRect.height - 10;
    }
    
    // Calculate arrow position relative to tooltip top
    // Arrow should point to item's center
    const arrowTop = itemCenterY - top;
    
    // Position and show tooltip
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.setProperty('--arrow-top', `${arrowTop}px`);
    tooltip.style.visibility = 'visible';
    tooltip.classList.add('show');
}

// Position tooltip for files without metadata
function positionTooltipNoMetadata(item) {
    const tooltip = getGlobalTooltip();
    const itemRect = item.getBoundingClientRect();
    
    // Set tooltip content
    tooltip.innerHTML = `<div class="tooltip-row">No metadata available</div>`;
    
    // Position tooltip off-screen temporarily to measure it
    tooltip.style.left = '-9999px';
    tooltip.style.top = '0px';
    tooltip.style.visibility = 'hidden';
    tooltip.style.display = 'block';
    tooltip.classList.remove('show');
    
    // Force layout calculation
    const tooltipRect = tooltip.getBoundingClientRect();
    const spacing = 8;
    
    // Calculate position to the right of item
    let left = itemRect.right + spacing;
    let top = itemRect.top + (itemRect.height / 2) - (tooltipRect.height / 2);
    
    // Store the item's center Y position for arrow alignment
    const itemCenterY = itemRect.top + (itemRect.height / 2);
    
    // Check if tooltip would go off the right edge
    if (left + tooltipRect.width > window.innerWidth - 10) {
        // Position to the left instead
        left = itemRect.left - tooltipRect.width - spacing;
        tooltip.classList.add('flipped');
    } else {
        tooltip.classList.remove('flipped');
    }
    
    // Ensure tooltip doesn't go off top or bottom
    if (top < 10) {
        top = 10;
    } else if (top + tooltipRect.height > window.innerHeight - 10) {
        top = window.innerHeight - tooltipRect.height - 10;
    }
    
    // Calculate arrow position relative to tooltip top
    const arrowTop = itemCenterY - top;
    
    // Position and show tooltip
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.setProperty('--arrow-top', `${arrowTop}px`);
    tooltip.style.visibility = 'visible';
    tooltip.classList.add('show');
}

// Hide tooltip
function hideTooltip() {
    if (globalTooltip) {
        globalTooltip.classList.remove('show');
        globalTooltip.style.visibility = 'hidden';
    }
}

// Render file list
function renderFileList(files) {
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = '';
    
    files.forEach(file => {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.textContent = file.name;
        
        // Add hover handlers for tooltip (show for all files)
        // Look up metadata dynamically when event fires (not when listener is created)
        item.addEventListener('mouseenter', () => {
            const metadata = patternMetadata[file.name];
            if (metadata) {
                positionTooltip(item, metadata);
            } else {
                positionTooltipNoMetadata(item);
            }
        });
        
        item.addEventListener('mouseleave', () => {
            hideTooltip();
        });
        
        // Also update position on mouse move (in case item moves while hovering)
        item.addEventListener('mousemove', () => {
            const metadata = patternMetadata[file.name];
            if (metadata) {
                positionTooltip(item, metadata);
            } else {
                positionTooltipNoMetadata(item);
            }
        });
        
        item.addEventListener('click', () => {
            // Remove active from all
            document.querySelectorAll('.file-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            loadAudio(file.path);
        });
        fileList.appendChild(item);
    });
}

// Load audio file - this will be called from p5 sketch
function loadAudio(path) {
    console.log('loadAudio called with path:', path);
    console.log('window.p5Sketch exists:', !!window.p5Sketch);
    console.log('loadAudioFile function exists:', !!(window.p5Sketch && window.p5Sketch.loadAudioFile));
    
    currentFilePath = path;
    
    // Stop current sound if playing
    if (sound) {
        try {
            sound.stop();
        } catch (e) {
            console.log('Error stopping:', e);
        }
        sound = null;
    }
    
    // Use the stored function reference
    const loadFn = loadAudioFileFunction || window.loadAudioFileFunction;
    
    if (typeof loadFn === 'function') {
        console.log('Calling loadAudioFile function');
        try {
            loadFn(path);
        } catch (error) {
            console.error('Error calling loadAudioFile:', error);
            alert('Error loading file: ' + error.message);
        }
    } else {
        console.error('loadAudioFile function not available yet, waiting...');
        // Retry after a short delay
        setTimeout(() => {
            const retryFn = loadAudioFileFunction || window.loadAudioFileFunction;
            if (typeof retryFn === 'function') {
                console.log('Retrying loadAudioFile');
                retryFn(path);
            } else {
                console.error('loadAudioFile function still not available');
                alert('Error: Audio loading function not ready. Please refresh the page.');
            }
        }, 1000);
    }
}

// Setup controls
function setupControls() {
    const playBtn = document.getElementById('playBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const stopBtn = document.getElementById('stopBtn');
    const loopBtn = document.getElementById('loopBtn');
    
    playBtn.addEventListener('click', () => {
        if (!sound) {
            console.log('No sound loaded');
            return;
        }
        
        if (!sound.isLoaded()) {
            console.log('Sound not loaded yet');
            return;
        }
        
        try {
            sound.play();
            playBtn.style.display = 'none';
            pauseBtn.style.display = 'inline-block';
            isPlaying = true;
        } catch (error) {
            console.error('Error playing:', error);
        }
    });
    
    pauseBtn.addEventListener('click', () => {
        if (sound && sound.isLoaded()) {
            try {
                sound.pause();
                playBtn.style.display = 'inline-block';
                pauseBtn.style.display = 'none';
                isPlaying = false;
            } catch (error) {
                console.error('Error pausing:', error);
            }
        }
    });
    
    stopBtn.addEventListener('click', () => {
        if (sound && sound.isLoaded()) {
            try {
                sound.stop();
                playBtn.style.display = 'inline-block';
                pauseBtn.style.display = 'none';
                isPlaying = false;
            } catch (error) {
                console.error('Error stopping:', error);
            }
        }
    });
    
    loopBtn.addEventListener('click', () => {
        isLooping = !isLooping;
        loopBtn.classList.toggle('active', isLooping);
        
        if (sound && sound.isLoaded()) {
            sound.setLoop(isLooping);
        }
    });
}

// Setup visualization mode selector
function setupVizModeSelector() {
    const vizModeSelect = document.getElementById('vizMode');
    if (vizModeSelect) {
        vizModeSelect.addEventListener('change', (e) => {
            visualizationMode = e.target.value;
        });
    }
}

// Setup filters with dual-handle sliders
function setupFilters() {
    const sliders = [
        { id: 'rms_slider', displayId: 'rms_display', filterKey: 'rms' },
        { id: 'duration_slider', displayId: 'duration_display', filterKey: 'duration' },
        { id: 'balance_slider', displayId: 'balance_display', filterKey: 'balance' },
        { id: 'movement_slider', displayId: 'movement_display', filterKey: 'movement' }
    ];
    
    sliders.forEach(sliderConfig => {
        initDualSlider(sliderConfig.id, sliderConfig.displayId, sliderConfig.filterKey);
    });
    
    // Setup search box
    const searchBox = document.getElementById('searchBox');
    if (searchBox) {
        searchBox.addEventListener('input', () => {
            applyFilters();
        });
    }
    
    const resetBtn = document.getElementById('resetFilters');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            // Reset search box
            if (searchBox) {
                searchBox.value = '';
            }
            // Reset sliders
            sliders.forEach(sliderConfig => {
                resetSlider(sliderConfig.id, sliderConfig.displayId, sliderConfig.filterKey);
            });
            applyFilters();
        });
    }
}

// Initialize a dual-handle slider
function initDualSlider(sliderId, displayId, filterKey) {
    const slider = document.getElementById(sliderId);
    if (!slider) return;
    
    const min = parseFloat(slider.dataset.min);
    const max = parseFloat(slider.dataset.max);
    const step = parseFloat(slider.dataset.step);
    
    const track = slider.querySelector('.slider-track');
    const range = slider.querySelector('.slider-range');
    const handleMin = slider.querySelector('.slider-handle-min');
    const handleMax = slider.querySelector('.slider-handle-max');
    const display = document.getElementById(displayId);
    
    // Store initial values in dataset (accessible from outside)
    slider.dataset.valueMin = min;
    slider.dataset.valueMax = max;
    let activeHandle = null;
    
    // Helper to get current values
    function getValues() {
        return {
            min: parseFloat(slider.dataset.valueMin),
            max: parseFloat(slider.dataset.valueMax)
        };
    }
    
    // Helper to set values
    function setValues(newMin, newMax) {
        slider.dataset.valueMin = newMin;
        slider.dataset.valueMax = newMax;
    }
    
    // Update slider visual state
    function updateSlider() {
        const values = getValues();
        const valueMin = values.min;
        const valueMax = values.max;
        
        const minPercent = ((valueMin - min) / (max - min)) * 100;
        const maxPercent = ((valueMax - min) / (max - min)) * 100;
        
        handleMin.style.left = `${minPercent}%`;
        handleMax.style.left = `${maxPercent}%`;
        
        range.style.left = `${minPercent}%`;
        range.style.width = `${maxPercent - minPercent}%`;
        
        // Update display
        if (display) {
            const formatValue = (val) => {
                if (filterKey === 'rms') return val.toFixed(3);
                if (filterKey === 'duration') return val.toFixed(1);
                return val.toFixed(2);
            };
            // Condensed display format
            if (filterKey === 'duration') {
                display.textContent = `(${formatValue(valueMin)}-${formatValue(valueMax)}s)`;
            } else {
                display.textContent = `(${formatValue(valueMin)}-${formatValue(valueMax)})`;
            }
        }
        
        // Trigger filter update
        applyFilters();
    }
    
    // Get value from mouse position
    function getValueFromMouse(e) {
        const trackRect = track.getBoundingClientRect();
        const x = e.clientX - trackRect.left;
        const percent = Math.max(0, Math.min(1, x / trackRect.width));
        const value = min + percent * (max - min);
        return Math.round(value / step) * step;
    }
    
    // Handle mouse down
    function handleMouseDown(e, handle) {
        e.preventDefault();
        activeHandle = handle;
        handle.classList.add('active');
        
        const value = getValueFromMouse(e);
        const values = getValues();
        if (handle === handleMin) {
            setValues(Math.min(value, values.max - step), values.max);
        } else {
            setValues(values.min, Math.max(value, values.min + step));
        }
        updateSlider();
    }
    
    // Handle mouse move
    function handleMouseMove(e) {
        if (!activeHandle) return;
        e.preventDefault();
        
        const value = getValueFromMouse(e);
        const values = getValues();
        if (activeHandle === handleMin) {
            setValues(Math.max(min, Math.min(value, values.max - step)), values.max);
        } else {
            setValues(values.min, Math.min(max, Math.max(value, values.min + step)));
        }
        updateSlider();
    }
    
    // Handle mouse up
    function handleMouseUp() {
        if (activeHandle) {
            activeHandle.classList.remove('active');
            activeHandle = null;
        }
    }
    
    // Event listeners
    handleMin.addEventListener('mousedown', (e) => handleMouseDown(e, handleMin));
    handleMax.addEventListener('mousedown', (e) => handleMouseDown(e, handleMax));
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Also allow clicking on track
    track.addEventListener('click', (e) => {
        const value = getValueFromMouse(e);
        const values = getValues();
        const distToMin = Math.abs(value - values.min);
        const distToMax = Math.abs(value - values.max);
        
        if (distToMin < distToMax) {
            setValues(Math.max(min, Math.min(value, values.max - step)), values.max);
        } else {
            setValues(values.min, Math.min(max, Math.max(value, values.min + step)));
        }
        updateSlider();
    });
    
    // Store update function on slider for reset
    slider._updateSlider = updateSlider;
    
    // Initial update
    updateSlider();
}

// Reset slider to full range
function resetSlider(sliderId, displayId, filterKey) {
    const slider = document.getElementById(sliderId);
    if (!slider) return;
    
    const min = parseFloat(slider.dataset.min);
    const max = parseFloat(slider.dataset.max);
    
    // Reset stored values
    slider.dataset.valueMin = min;
    slider.dataset.valueMax = max;
    
    // Call the update function if it exists
    if (slider._updateSlider) {
        slider._updateSlider();
    }
}

// Apply filters to file list
function applyFilters() {
    if (allFilesList.length === 0) {
        filesList = [];
        renderFileList(filesList);
        return;
    }
    
    // Get search query
    const searchBox = document.getElementById('searchBox');
    const searchQuery = searchBox ? searchBox.value.trim().toLowerCase() : '';
    
    // Get filter values from sliders
    const rmsSlider = document.getElementById('rms_slider');
    const durationSlider = document.getElementById('duration_slider');
    const balanceSlider = document.getElementById('balance_slider');
    const movementSlider = document.getElementById('movement_slider');
    
    const rmsMin = rmsSlider ? parseFloat(rmsSlider.dataset.valueMin) : -Infinity;
    const rmsMax = rmsSlider ? parseFloat(rmsSlider.dataset.valueMax) : Infinity;
    const durationMin = durationSlider ? parseFloat(durationSlider.dataset.valueMin) : -Infinity;
    const durationMax = durationSlider ? parseFloat(durationSlider.dataset.valueMax) : Infinity;
    const balanceMin = balanceSlider ? parseFloat(balanceSlider.dataset.valueMin) : -Infinity;
    const balanceMax = balanceSlider ? parseFloat(balanceSlider.dataset.valueMax) : Infinity;
    const movementMin = movementSlider ? parseFloat(movementSlider.dataset.valueMin) : -Infinity;
    const movementMax = movementSlider ? parseFloat(movementSlider.dataset.valueMax) : Infinity;
    
    // Filter files
    filesList = allFilesList.filter(file => {
        // Search filter (case-insensitive)
        if (searchQuery && !file.name.toLowerCase().includes(searchQuery)) {
            return false;
        }
        
        // Match file with metadata by filename
        const metadata = patternMetadata[file.name];
        if (!metadata) {
            // If no metadata, include file (don't filter it out by metadata filters)
            return true;
        }
        
        // Check all metadata filters (AND logic)
        const rmsMatch = metadata.rms_mean >= rmsMin && metadata.rms_mean <= rmsMax;
        const durationMatch = metadata.duration >= durationMin && metadata.duration <= durationMax;
        const balanceMatch = metadata.stereo_balance >= balanceMin && metadata.stereo_balance <= balanceMax;
        const movementMatch = metadata.stereo_movement >= movementMin && metadata.stereo_movement <= movementMax;
        
        return rmsMatch && durationMatch && balanceMatch && movementMatch;
    });
    
    renderFileList(filesList);
}

// Store reference to load function
let loadAudioFileFunction = null;

// Setup p5.js sketch
function setupP5Sketch() {
    const sketch = function(p) {
        p.setup = function() {
            const container = document.getElementById('p5-container');
            const canvas = p.createCanvas(container.clientWidth, container.clientHeight);
            canvas.parent('p5-container');
            
            fft = new p5.FFT();
            
            // Create separate analyzers for left and right channels
            // These will be set up when audio loads
            window.leftFFT = null;
            window.rightFFT = null;
            
            console.log('p5.js sketch setup complete');
        };
        
        // Function to load audio file (called from outside)
        // Store it in a way that's accessible
        const loadAudioFile = function(path) {
            console.log('loadAudioFile called in p5 sketch with path:', path);
            
            const playBtn = document.getElementById('playBtn');
            const pauseBtn = document.getElementById('pauseBtn');
            if (playBtn) {
                playBtn.textContent = '⋯';
                playBtn.disabled = true;
            }
            if (pauseBtn) {
                pauseBtn.style.display = 'none';
            }
            
            // Stop current sound
            if (sound) {
                try {
                    sound.stop();
                } catch (e) {
                    console.log('Error stopping sound:', e);
                }
                sound = null;
            }
            
            console.log('Calling p.loadSound with path:', path);
            
            // Load new sound using p5's loadSound
            try {
                sound = p.loadSound(
                    path,
                    () => {
                        // Success callback
                        console.log('Audio loaded successfully!');
                        console.log('Sound object:', sound);
                        
                        // Wait a bit for sound to be fully ready
                        setTimeout(() => {
                            if (sound && sound.isLoaded()) {
                                console.log('Sound is loaded, duration:', sound.duration());
                                sound.setLoop(isLooping);
                                
                                // Setup stereo analyzers if sound is stereo
                                setupStereoAnalyzers(sound);
                                
                                // Try to play
                                try {
                                    sound.play();
                                    isPlaying = true;
                                    const playBtn = document.getElementById('playBtn');
                                    const pauseBtn = document.getElementById('pauseBtn');
                                    if (playBtn) {
                                        playBtn.style.display = 'none';
                                        playBtn.disabled = false;
                                    }
                                    if (pauseBtn) {
                                        pauseBtn.style.display = 'inline-block';
                                    }
                                    console.log('Audio started playing successfully');
                                } catch (playError) {
                                    console.warn('Autoplay blocked:', playError);
                                    const playBtn = document.getElementById('playBtn');
                                    if (playBtn) {
                                        playBtn.style.display = 'inline-block';
                                        playBtn.disabled = false;
                                    }
                                }
                            } else {
                                console.error('Sound loaded but isLoaded() returns false');
                                const playBtn = document.getElementById('playBtn');
                                if (playBtn) {
                                    playBtn.textContent = '▶';
                                    playBtn.style.display = 'inline-block';
                                    playBtn.disabled = false;
                                }
                            }
                        }, 100);
                    },
                    (error) => {
                        // Error callback
                        console.error('Error loading audio:', error);
                        const playBtn = document.getElementById('playBtn');
                        if (playBtn) {
                            playBtn.textContent = '▶';
                            playBtn.style.display = 'inline-block';
                            playBtn.disabled = false;
                        }
                        alert('Error loading audio file: ' + (error.message || 'Unknown error'));
                    }
                );
                
                console.log('p.loadSound called, sound object:', sound);
            } catch (error) {
                console.error('Exception calling p.loadSound:', error);
                const playBtn = document.getElementById('playBtn');
                if (playBtn) {
                    playBtn.textContent = '▶';
                    playBtn.style.display = 'inline-block';
                    playBtn.disabled = false;
                }
                alert('Error: ' + error.message);
            }
        };
        
        // Make function accessible globally
        loadAudioFileFunction = loadAudioFile;
        window.loadAudioFileFunction = loadAudioFile;
        
        p.draw = function() {
            // Light background
            p.background(250, 250, 250);
            
            if (sound && sound.isLoaded() && sound.isPlaying()) {
                // Route to appropriate visualization
                switch(visualizationMode) {
                    case 'intensity':
                        drawIntensityBars(p);
                        break;
                    case 'stereo':
                        drawStereoField(p);
                        break;
                    case 'spectrum':
                        drawFrequencySpectrum(p);
                        break;
                    case 'pulses':
                        drawDirectionalPulses(p);
                        break;
                    case 'blob':
                        drawLiquidBlob(p);
                        break;
                    case 'particles':
                        drawParticleSwarm(p);
                        break;
                    case 'landscape':
                        draw3DLandscape(p);
                        break;
                    case 'waveform':
                    default:
                        drawWaveform(p);
                        break;
                }
                
                // Draw playhead - red accent (for all modes)
                if (sound.duration() > 0) {
                    const progress = sound.currentTime() / sound.duration();
                    p.stroke(255, 0, 0);
                    p.strokeWeight(2);
                    p.line(progress * p.width, 0, progress * p.width, p.height);
                }
            } else {
                // Show placeholder - subtle gray text
                p.noStroke();
                p.fill(180);
                p.textAlign(p.CENTER, p.CENTER);
                p.textSize(12);
                p.text('Select a file to play', p.width / 2, p.height / 2);
            }
        };
        
        // Original waveform visualization
        function drawWaveform(p) {
            const waveform = fft.waveform();
            
            p.stroke(0);
            p.strokeWeight(1.5);
            p.noFill();
            
            p.beginShape();
            for (let i = 0; i < waveform.length; i++) {
                const x = p.map(i, 0, waveform.length, 0, p.width);
                const y = p.map(waveform[i], -1, 1, p.height / 2, 0);
                p.vertex(x, y);
            }
            p.endShape();
            
            // Draw center line - subtle gray
            p.stroke(200);
            p.strokeWeight(1);
            p.line(0, p.height / 2, p.width, p.height / 2);
        }
        
        // Apple-style intensity bars
        function drawIntensityBars(p) {
            const waveform = fft.waveform();
            const numBars = 100; // Number of bars to display
            const barWidth = p.width / numBars;
            
            // Calculate intensity for each bar
            const samplesPerBar = Math.floor(waveform.length / numBars);
            
            for (let i = 0; i < numBars; i++) {
                let sum = 0;
                let max = 0;
                
                // Calculate average and peak intensity for this bar
                for (let j = 0; j < samplesPerBar; j++) {
                    const idx = i * samplesPerBar + j;
                    if (idx < waveform.length) {
                        const val = Math.abs(waveform[idx]);
                        sum += val;
                        max = Math.max(max, val);
                    }
                }
                
                const avgIntensity = sum / samplesPerBar;
                const barHeight = avgIntensity * p.height * 0.8;
                
                // Color based on intensity (green -> yellow -> red)
                let r, g, b;
                if (avgIntensity < 0.33) {
                    // Green to yellow
                    const t = avgIntensity / 0.33;
                    r = Math.floor(255 * t);
                    g = 255;
                    b = 0;
                } else if (avgIntensity < 0.66) {
                    // Yellow to orange
                    const t = (avgIntensity - 0.33) / 0.33;
                    r = 255;
                    g = Math.floor(255 * (1 - t * 0.5));
                    b = 0;
                } else {
                    // Orange to red
                    const t = (avgIntensity - 0.66) / 0.34;
                    r = 255;
                    g = Math.floor(255 * (0.5 - t * 0.5));
                    b = 0;
                }
                
                p.fill(r, g, b);
                p.noStroke();
                
                const x = i * barWidth;
                const y = p.height / 2 - barHeight / 2;
                
                // Draw bar with rounded corners effect
                p.rect(x + 1, y, barWidth - 2, barHeight);
            }
            
            // Draw center line
            p.stroke(200);
            p.strokeWeight(1);
            p.line(0, p.height / 2, p.width, p.height / 2);
        }
        
        // Setup separate analyzers for left and right channels
        function setupStereoAnalyzers(soundFile) {
            try {
                if (!soundFile || !soundFile.buffer) {
                    window.soundBuffer = null;
                    window.isStereo = false;
                    return;
                }
                
                // Check if stereo
                const numChannels = soundFile.buffer.numberOfChannels;
                if (numChannels >= 2) {
                    window.soundBuffer = soundFile.buffer;
                    window.isStereo = true;
                    console.log('Stereo file detected, will use channel separation');
                } else {
                    window.soundBuffer = null;
                    window.isStereo = false;
                    console.log('Mono file detected');
                }
            } catch (error) {
                console.warn('Could not set up stereo analyzers:', error);
                window.soundBuffer = null;
                window.isStereo = false;
            }
        }
        
        // Abstract L/R positionality visualization
        function drawStereoField(p) {
            const numBars = 80;
            const barWidth = p.width / numBars;
            
            // Use buffer channel data for accurate stereo separation
            if (window.isStereo && sound && sound.buffer && sound.buffer.numberOfChannels >= 2 && sound.isPlaying()) {
                try {
                    drawStereoFromBuffer(p, numBars, barWidth);
                } catch (e) {
                    console.warn('Error drawing stereo from buffer:', e);
                    drawStereoFallback(p, numBars, barWidth);
                }
            } else {
                // Fallback: use mixed waveform (mono or analyzers not available)
                drawStereoFallback(p, numBars, barWidth);
            }
            
            // Draw center line (reference for stereo balance)
            p.stroke(200);
            p.strokeWeight(1);
            p.line(0, p.height / 2, p.width, p.height / 2);
            
            // Draw vertical center line to show stereo field center
            p.stroke(150);
            p.strokeWeight(1);
            p.line(p.width / 2, 0, p.width / 2, p.height);
            
            // Draw minimal legend
            drawStereoLegend(p);
        }
        
        // Minimal legend for stereo field
        function drawStereoLegend(p) {
            const legendX = 12;
            const legendY = p.height - 40;
            const boxSize = 8;
            const spacing = 20;
            
            p.textSize(10);
            p.textAlign(p.LEFT, p.CENTER);
            p.noStroke();
            
            // Left (blue)
            p.fill(50, 100, 200);
            p.rect(legendX, legendY - boxSize / 2, boxSize, boxSize);
            p.fill(100);
            p.text('L', legendX + boxSize + 4, legendY);
            
            // Right (orange)
            p.fill(200, 100, 50);
            p.rect(legendX + spacing + 20, legendY - boxSize / 2, boxSize, boxSize);
            p.fill(100);
            p.text('R', legendX + spacing + 20 + boxSize + 4, legendY);
        }
        
        // Extract stereo from buffer channel data (real-time)
        function drawStereoFromBuffer(p, numBars, barWidth) {
            if (!sound || !sound.buffer || sound.buffer.numberOfChannels < 2) {
                drawStereoFallback(p, numBars, barWidth);
                return;
            }
            
            // Get current playback position
            const currentTime = sound.currentTime();
            const sampleRate = sound.buffer.sampleRate;
            const bufferLength = sound.buffer.length;
            const duration = sound.buffer.duration;
            
            if (currentTime < 0 || currentTime >= duration) return;
            
            // Calculate sample index for current playback position
            const sampleIndex = Math.floor(currentTime * sampleRate);
            const lookaheadSamples = 1024; // Number of samples to analyze ahead
            const samplesPerBar = Math.max(1, Math.floor(lookaheadSamples / numBars));
            
            // Get channel data directly from buffer
            const leftChannel = sound.buffer.getChannelData(0);
            const rightChannel = sound.buffer.getChannelData(1);
            
            for (let i = 0; i < numBars; i++) {
                let leftSum = 0;
                let rightSum = 0;
                let count = 0;
                
                // Sample from current position forward
                for (let j = 0; j < samplesPerBar; j++) {
                    const idx = sampleIndex + (i * samplesPerBar) + j;
                    if (idx >= 0 && idx < bufferLength) {
                        leftSum += Math.abs(leftChannel[idx]);
                        rightSum += Math.abs(rightChannel[idx]);
                        count++;
                    }
                }
                
                const leftAvg = count > 0 ? leftSum / count : 0;
                const rightAvg = count > 0 ? rightSum / count : 0;
                
                // Scale intensities
                const leftIntensity = leftAvg * p.height * 0.45;
                const rightIntensity = rightAvg * p.height * 0.45;
                
                const x = i * barWidth;
                const centerY = p.height / 2;
                
                // Draw left channel (top half, blue tint)
                if (leftIntensity > 0.5) {
                    p.fill(50, 100, 200, 240);
                    p.noStroke();
                    p.rect(x + 1, centerY - leftIntensity, barWidth - 2, leftIntensity);
                }
                
                // Draw right channel (bottom half, orange/red tint)
                if (rightIntensity > 0.5) {
                    p.fill(200, 100, 50, 240);
                    p.noStroke();
                    p.rect(x + 1, centerY, barWidth - 2, rightIntensity);
                }
                
                // Visualize stereo balance with indicator
                const total = leftIntensity + rightIntensity;
                if (total > 1) {
                    const balance = (rightIntensity - leftIntensity) / total; // -1 (left) to +1 (right)
                    
                    // Draw panning indicator dot
                    if (Math.abs(balance) > 0.1) {
                        const panX = x + barWidth / 2;
                        const panY = centerY + balance * Math.min(leftIntensity, rightIntensity) * 0.4;
                        p.fill(0, 180);
                        p.noStroke();
                        p.circle(panX, panY, 4);
                    }
                }
            }
        }
        
        // Fallback visualization using waveform (for mono or when buffer not available)
        function drawStereoFallback(p, numBars, barWidth) {
            const waveform = fft.waveform();
            const samplesPerBar = Math.floor(waveform.length / numBars);
            
            for (let i = 0; i < numBars; i++) {
                let sum = 0;
                let count = 0;
                
                for (let j = 0; j < samplesPerBar; j++) {
                    const idx = i * samplesPerBar + j;
                    if (idx < waveform.length) {
                        sum += Math.abs(waveform[idx]);
                        count++;
                    }
                }
                
                const avg = count > 0 ? sum / count : 0;
                const intensity = avg * p.height * 0.4;
                
                const x = i * barWidth;
                const centerY = p.height / 2;
                
                // Draw as mono (same on both sides)
                if (intensity > 0.5) {
                    p.fill(100, 100, 100, 200);
                    p.noStroke();
                    p.rect(x + 1, centerY - intensity / 2, barWidth - 2, intensity);
                }
            }
        }
        
        // Frequency spectrum with haptic mapping
        function drawFrequencySpectrum(p) {
            const spectrum = fft.analyze();
            const waveform = fft.waveform();
            
            // Calculate overall intensity for haptic mapping
            let totalIntensity = 0;
            for (let i = 0; i < waveform.length; i++) {
                totalIntensity += Math.abs(waveform[i]);
            }
            const avgIntensity = totalIntensity / waveform.length;
            
            const barWidth = p.width / spectrum.length;
            const maxBarHeight = p.height * 0.8;
            
            // Draw frequency bars
            for (let i = 0; i < spectrum.length; i++) {
                const barHeight = p.map(spectrum[i], 0, 255, 0, maxBarHeight);
                const x = i * barWidth;
                const y = p.height - barHeight;
                
                // Color mapping: low freq (blue) -> mid (green) -> high (red)
                // More vibrant, saturated colors for better contrast
                const freqRatio = i / spectrum.length;
                let r, g, b;
                
                if (freqRatio < 0.33) {
                    // Low frequencies - bright blue to cyan
                    const t = freqRatio / 0.33;
                    r = Math.floor(30 * t);
                    g = Math.floor(100 + 155 * t);
                    b = 255;
                } else if (freqRatio < 0.66) {
                    // Mid frequencies - cyan to bright yellow
                    const t = (freqRatio - 0.33) / 0.33;
                    r = Math.floor(30 + 225 * t);
                    g = 255;
                    b = Math.floor(255 * (1 - t * 0.8));
                } else {
                    // High frequencies - yellow to bright red
                    const t = (freqRatio - 0.66) / 0.34;
                    r = 255;
                    g = Math.floor(255 * (1 - t));
                    b = Math.floor(50 * (1 - t));
                }
                
                // Intensity affects brightness and saturation - make it more vibrant
                const intensityFactor = spectrum[i] / 255;
                
                // Boost saturation and brightness for better visibility
                const saturationBoost = 1.2;
                const brightnessBoost = 0.8 + intensityFactor * 0.2;
                
                // Apply boosts
                r = Math.min(255, Math.floor(r * brightnessBoost));
                g = Math.min(255, Math.floor(g * brightnessBoost));
                b = Math.min(255, Math.floor(b * brightnessBoost));
                
                // Higher opacity for better contrast
                const alpha = 200 + intensityFactor * 55;
                
                p.fill(r, g, b, alpha);
                
                // Add subtle stroke for definition
                p.stroke(r * 0.7, g * 0.7, b * 0.7, alpha * 0.8);
                p.strokeWeight(0.5);
                
                p.rect(x, y, barWidth - 1, barHeight);
            }
            
            // Draw intensity overlay (haptic mapping visualization)
            // Show overall intensity as a horizontal bar at the top
            const intensityBarHeight = 8;
            const intensityBarWidth = avgIntensity * p.width;
            
            // Color based on intensity
            let intensityR, intensityG, intensityB;
            if (avgIntensity < 0.33) {
                intensityR = 0;
                intensityG = Math.floor(255 * (avgIntensity / 0.33));
                intensityB = 0;
            } else if (avgIntensity < 0.66) {
                const t = (avgIntensity - 0.33) / 0.33;
                intensityR = Math.floor(255 * t);
                intensityG = 255;
                intensityB = 0;
            } else {
                intensityR = 255;
                intensityG = Math.floor(255 * (1 - (avgIntensity - 0.66) / 0.34));
                intensityB = 0;
            }
            
            p.fill(intensityR, intensityG, intensityB);
            p.noStroke();
            p.rect(0, 0, intensityBarWidth, intensityBarHeight);
            
            // Draw center reference line
            p.stroke(200);
            p.strokeWeight(1);
            p.line(0, p.height / 2, p.width, p.height / 2);
        }
        
        // Directional pulses visualization (FPS-style impact indicators)
        function drawDirectionalPulses(p) {
            // Get stereo channel intensities and sharpness
            let leftIntensity = 0;
            let rightIntensity = 0;
            let leftSharpness = 0;
            let rightSharpness = 0;
            
            if (window.isStereo && sound && sound.buffer && sound.buffer.numberOfChannels >= 2 && sound.isPlaying()) {
                try {
                    const currentTime = sound.currentTime();
                    const sampleRate = sound.buffer.sampleRate;
                    const bufferLength = sound.buffer.length;
                    const sampleIndex = Math.floor(currentTime * sampleRate);
                    
                    const leftChannel = sound.buffer.getChannelData(0);
                    const rightChannel = sound.buffer.getChannelData(1);
                    
                    // Sample recent audio for intensity and sharpness
                    const sampleWindow = 512;
                    let leftSum = 0;
                    let rightSum = 0;
                    let leftMaxChange = 0;
                    let rightMaxChange = 0;
                    let count = 0;
                    
                    let prevLeft = 0;
                    let prevRight = 0;
                    
                    for (let i = 0; i < sampleWindow; i++) {
                        const idx = sampleIndex - sampleWindow + i;
                        if (idx >= 0 && idx < bufferLength) {
                            const leftVal = Math.abs(leftChannel[idx]);
                            const rightVal = Math.abs(rightChannel[idx]);
                            
                            leftSum += leftVal;
                            rightSum += rightVal;
                            
                            // Calculate sharpness as rate of change (attack/transient detection)
                            if (i > 0) {
                                const leftChange = Math.abs(leftVal - prevLeft);
                                const rightChange = Math.abs(rightVal - prevRight);
                                leftMaxChange = Math.max(leftMaxChange, leftChange);
                                rightMaxChange = Math.max(rightMaxChange, rightChange);
                            }
                            
                            prevLeft = leftVal;
                            prevRight = rightVal;
                            count++;
                        }
                    }
                    
                    leftIntensity = count > 0 ? leftSum / count : 0;
                    rightIntensity = count > 0 ? rightSum / count : 0;
                    leftSharpness = leftMaxChange; // Sharpness = max rate of change
                    rightSharpness = rightMaxChange;
                } catch (e) {
                    console.warn('Error getting stereo data for pulses:', e);
                }
            } else {
                // Fallback to waveform analysis
                const waveform = fft.waveform();
                let sum = 0;
                let maxChange = 0;
                let prev = 0;
                
                for (let i = 0; i < waveform.length; i++) {
                    const val = Math.abs(waveform[i]);
                    sum += val;
                    
                    const change = Math.abs(val - prev);
                    maxChange = Math.max(maxChange, change);
                    prev = val;
                }
                
                const avg = sum / waveform.length;
                leftIntensity = avg;
                rightIntensity = avg;
                leftSharpness = maxChange;
                rightSharpness = maxChange;
            }
            
            // Lower threshold and ensure pulses always appear
            const pulseThreshold = 0.03; // Much lower threshold
            const currentFrame = p.frameCount;
            
            // Always create pulses if there's any audio, even if very low
            // Scale intensity to ensure visibility
            const minVisibleIntensity = 0.15; // Minimum intensity for visual impact
            const scaledLeftIntensity = Math.max(leftIntensity, minVisibleIntensity * 0.3);
            const scaledRightIntensity = Math.max(rightIntensity, minVisibleIntensity * 0.3);
            
            // Create pulses more frequently
            const timeSinceLastLeft = activePulses.filter(p => p.side === 'left').length > 0 
                ? currentFrame - Math.max(...activePulses.filter(p => p.side === 'left').map(p => p.frame))
                : 999;
            const timeSinceLastRight = activePulses.filter(p => p.side === 'right').length > 0
                ? currentFrame - Math.max(...activePulses.filter(p => p.side === 'right').map(p => p.frame))
                : 999;
            
            // Create left pulses
            if (leftIntensity > pulseThreshold || (leftIntensity > 0 && timeSinceLastLeft > 60)) {
                const recentLeftPulses = activePulses.filter(pulse => 
                    pulse.side === 'left' && currentFrame - pulse.frame < 40
                );
                if (recentLeftPulses.length < 5) {
                    activePulses.push({
                        side: 'left',
                        intensity: Math.max(scaledLeftIntensity, minVisibleIntensity),
                        sharpness: leftSharpness,
                        radius: 0,
                        frame: currentFrame,
                        maxRadius: Math.min(p.width, p.height) * 0.95
                    });
                }
            }
            
            // Create right pulses
            if (rightIntensity > pulseThreshold || (rightIntensity > 0 && timeSinceLastRight > 60)) {
                const recentRightPulses = activePulses.filter(pulse => 
                    pulse.side === 'right' && currentFrame - pulse.frame < 40
                );
                if (recentRightPulses.length < 5) {
                    activePulses.push({
                        side: 'right',
                        intensity: Math.max(scaledRightIntensity, minVisibleIntensity),
                        sharpness: rightSharpness,
                        radius: 0,
                        frame: currentFrame,
                        maxRadius: Math.min(p.width, p.height) * 0.95
                    });
                }
            }
            
            // Update and draw active pulses with more visual impact
            p.noFill();
            const centerY = p.height / 2;
            
            for (let i = activePulses.length - 1; i >= 0; i--) {
                const pulse = activePulses[i];
                const age = currentFrame - pulse.frame;
                
                // Faster speed for more impact
                const speed = 6 + pulse.intensity * 12; // Increased from 4 + 8
                pulse.radius += speed;
                
                // Calculate opacity (fade out as pulse expands, but stay visible longer)
                const progress = pulse.radius / pulse.maxRadius;
                const baseOpacity = 255 * (1 - progress * 0.8) * Math.max(pulse.intensity, 0.3); // Minimum opacity
                
                if (pulse.radius > pulse.maxRadius || baseOpacity < 15) { // Lower threshold
                    activePulses.splice(i, 1);
                    continue;
                }
                
                // Color based on intensity: green (low) -> yellow (mid) -> red (high)
                let r, g, b;
                const intensityNorm = Math.min(pulse.intensity * 1.5, 1); // Normalize intensity
                
                if (intensityNorm < 0.33) {
                    // Green to yellow-green
                    const t = intensityNorm / 0.33;
                    r = Math.floor(50 + 100 * t);
                    g = 255;
                    b = Math.floor(50 * (1 - t));
                } else if (intensityNorm < 0.66) {
                    // Yellow-green to yellow
                    const t = (intensityNorm - 0.33) / 0.33;
                    r = Math.floor(150 + 105 * t);
                    g = 255;
                    b = Math.floor(50 * (1 - t));
                } else {
                    // Yellow to red
                    const t = (intensityNorm - 0.66) / 0.34;
                    r = 255;
                    g = Math.floor(255 * (1 - t));
                    b = 0;
                }
                
                // Sharpness affects opacity and adds visual "spark"
                const sharpnessNorm = Math.min(pulse.sharpness * 10, 1);
                const opacity = Math.max(baseOpacity * (0.8 + 0.2 * sharpnessNorm), 80); // Higher minimum opacity
                
                // Draw main pulse circle (thicker, more visible)
                const pulseX = pulse.side === 'left' ? 0 : p.width;
                p.stroke(r, g, b, opacity);
                p.strokeWeight(3 + pulse.intensity * 5); // Thicker stroke
                p.circle(pulseX, centerY, pulse.radius * 2);
                
                // Draw multiple concentric circles for more impact
                if (pulse.radius > 20) {
                    p.stroke(r, g, b, opacity * 0.6);
                    p.strokeWeight(2 + pulse.intensity * 3);
                    p.circle(pulseX, centerY, pulse.radius * 1.5);
                }
                
                // Sharpness visualization: add inner pulse or spikes for sharp transients
                if (sharpnessNorm > 0.2) { // Lower threshold
                    // Draw inner pulse for sharpness
                    const innerRadius = pulse.radius * 0.5;
                    const sharpOpacity = opacity * sharpnessNorm * 0.8;
                    p.stroke(r, g, b, sharpOpacity);
                    p.strokeWeight(2 + sharpnessNorm * 3);
                    p.circle(pulseX, centerY, innerRadius * 2);
                    
                    // Add "spark" lines for very sharp sounds
                    if (sharpnessNorm > 0.5) { // Lower threshold
                        p.stroke(r, g, b, sharpOpacity);
                        p.strokeWeight(2);
                        const sparkLength = pulse.radius * 0.4;
                        const numSparks = 12; // More sparks
                        for (let s = 0; s < numSparks; s++) {
                            const angle = (s / numSparks) * p.TWO_PI;
                            const startX = pulseX + Math.cos(angle) * innerRadius;
                            const startY = centerY + Math.sin(angle) * innerRadius;
                            const endX = pulseX + Math.cos(angle) * (innerRadius + sparkLength);
                            const endY = centerY + Math.sin(angle) * (innerRadius + sparkLength);
                            p.line(startX, startY, endX, endY);
                        }
                    }
                }
                
                // Add glow effect for high intensity
                if (pulse.intensity > 0.4) {
                    p.stroke(r, g, b, opacity * 0.3);
                    p.strokeWeight(1);
                    p.circle(pulseX, centerY, pulse.radius * 2.2);
                }
            }
            
            // If no pulses exist and audio is playing, create at least one
            if (activePulses.length === 0 && sound && sound.isPlaying()) {
                // Create a subtle pulse to show something is happening
                const fallbackIntensity = Math.max(leftIntensity, rightIntensity, 0.2);
                if (fallbackIntensity > 0) {
                    const side = leftIntensity > rightIntensity ? 'left' : 'right';
                    activePulses.push({
                        side: side,
                        intensity: fallbackIntensity,
                        sharpness: Math.max(leftSharpness, rightSharpness),
                        radius: 0,
                        frame: currentFrame,
                        maxRadius: Math.min(p.width, p.height) * 0.9
                    });
                }
            }
            
            // Draw center reference line
            p.stroke(200);
            p.strokeWeight(1);
            p.line(0, centerY, p.width, centerY);
        }
        
        // Liquid Morphing Blob visualization
        function drawLiquidBlob(p) {
            const spectrum = fft.analyze();
            const waveform = fft.waveform();
            
            // Calculate overall intensity
            let totalIntensity = 0;
            for (let i = 0; i < waveform.length; i++) {
                totalIntensity += Math.abs(waveform[i]);
            }
            const avgIntensity = totalIntensity / waveform.length;
            
            // Get stereo data for asymmetric morphing
            let leftIntensity = avgIntensity;
            let rightIntensity = avgIntensity;
            let leftSharpness = 0;
            let rightSharpness = 0;
            
            if (window.isStereo && sound && sound.buffer && sound.buffer.numberOfChannels >= 2) {
                try {
                    const currentTime = sound.currentTime();
                    const sampleRate = sound.buffer.sampleRate;
                    const sampleIndex = Math.floor(currentTime * sampleRate);
                    const leftChannel = sound.buffer.getChannelData(0);
                    const rightChannel = sound.buffer.getChannelData(1);
                    
                    let leftSum = 0, rightSum = 0, leftMaxChange = 0, rightMaxChange = 0;
                    let prevLeft = 0, prevRight = 0;
                    const windowSize = 256;
                    
                    for (let i = 0; i < windowSize; i++) {
                        const idx = sampleIndex - windowSize + i;
                        if (idx >= 0 && idx < leftChannel.length) {
                            const l = Math.abs(leftChannel[idx]);
                            const r = Math.abs(rightChannel[idx]);
                            leftSum += l;
                            rightSum += r;
                            
                            if (i > 0) {
                                leftMaxChange = Math.max(leftMaxChange, Math.abs(l - prevLeft));
                                rightMaxChange = Math.max(rightMaxChange, Math.abs(r - prevRight));
                            }
                            prevLeft = l;
                            prevRight = r;
                        }
                    }
                    
                    leftIntensity = leftSum / windowSize;
                    rightIntensity = rightSum / windowSize;
                    leftSharpness = leftMaxChange;
                    rightSharpness = rightMaxChange;
                } catch (e) {}
            }
            
            // Base blob size from intensity (more dramatic scaling)
            const baseRadius = 100 + avgIntensity * 300;
            const centerX = p.width / 2;
            const centerY = p.height / 2;
            
            // Create blob vertices using perlin noise and audio
            const numPoints = 80; // More points for smoother, more detailed blob
            if (blobVertices.length !== numPoints) {
                blobVertices = [];
                for (let i = 0; i < numPoints; i++) {
                    blobVertices.push({ angle: 0, radius: baseRadius });
                }
            }
            
            // Update blob shape with more liquid-like, flowing effects
            const time = p.frameCount * 0.02; // Slower, more fluid animation
            const maxSharpness = Math.max(leftSharpness, rightSharpness);
            
            // Use multiple noise layers for more organic, wave-like motion
            for (let i = 0; i < numPoints; i++) {
                const angle = (i / numPoints) * p.TWO_PI;
                
                // Multiple noise layers for more complex, fluid motion
                const noiseX1 = Math.cos(angle) * 1.5 + time * 0.5;
                const noiseY1 = Math.sin(angle) * 1.5 + time * 0.5;
                const noiseX2 = Math.cos(angle) * 3.0 + time * 0.3;
                const noiseY2 = Math.sin(angle) * 3.0 + time * 0.3;
                const noiseX3 = Math.cos(angle) * 0.8 + time * 0.7;
                const noiseY3 = Math.sin(angle) * 0.8 + time * 0.7;
                
                // Combine multiple noise layers for smoother, more organic waves
                const noise1 = p.noise(noiseX1, noiseY1);
                const noise2 = p.noise(noiseX2, noiseY2) * 0.6;
                const noise3 = p.noise(noiseX3, noiseY3) * 0.4;
                const combinedNoise = (noise1 + noise2 + noise3) / 2;
                
                // Base radius with smooth, wave-like noise
                let radius = baseRadius + combinedNoise * 50;
                
                // Frequency bands affect different parts (smoother transitions)
                const freqBand = Math.floor((i / numPoints) * spectrum.length);
                const freqIntensity = spectrum[freqBand] / 255;
                radius += freqIntensity * 100;
                
                // Sharpness creates fluid spikes (more rounded, less angular)
                const sharpness = (leftSharpness + rightSharpness) / 2;
                if (sharpness > 0.05) {
                    const spikeAngle = Math.atan2(Math.sin(angle), Math.cos(angle));
                    const leftSpike = Math.abs(spikeAngle) < p.PI / 2 ? leftSharpness : 0;
                    const rightSpike = Math.abs(spikeAngle) > p.PI / 2 ? rightSharpness : 0;
                    // Use sine wave for smoother spike shape
                    const spikeShape = Math.sin(angle * 2) * 0.5 + 0.5;
                    const spikeIntensity = (leftSpike + rightSpike) * 150 * spikeShape;
                    radius += spikeIntensity;
                    
                    // Add extra fluid spike for very sharp sounds
                    if (maxSharpness > 0.2) {
                        radius += maxSharpness * 100 * spikeShape;
                    }
                }
                
                // L/R asymmetry with smooth wave transition
                const lrWave = Math.sin(angle);
                if (lrWave > 0) {
                    // Left side - smooth wave transition
                    radius += (leftIntensity - rightIntensity) * 80 * lrWave;
                } else {
                    // Right side - smooth wave transition
                    radius += (rightIntensity - leftIntensity) * 80 * Math.abs(lrWave);
                }
                
                // Add smooth pulsing effect (more wave-like)
                const pulse = Math.sin(p.frameCount * 0.08 + angle * 2) * avgIntensity * 25;
                radius += pulse;
                
                // Add secondary wave for more liquid movement
                const secondaryWave = Math.sin(p.frameCount * 0.12 + angle * 3) * avgIntensity * 15;
                radius += secondaryWave;
                
                blobVertices[i].angle = angle;
                blobVertices[i].radius = radius;
            }
            
            // Dynamic color based on intensity and frequency
            const dominantFreq = spectrum.indexOf(Math.max(...spectrum));
            const freqRatio = dominantFreq / spectrum.length;
            
            // Color gradient: blue (low) -> cyan -> green -> yellow -> red (high)
            let r, g, b;
            if (freqRatio < 0.2) {
                // Low frequencies - deep blue
                r = 30;
                g = 100 + avgIntensity * 100;
                b = 200 + avgIntensity * 55;
            } else if (freqRatio < 0.4) {
                // Low-mid - cyan
                r = 30 + avgIntensity * 50;
                g = 200 + avgIntensity * 55;
                b = 255;
            } else if (freqRatio < 0.6) {
                // Mid - green to yellow-green
                r = 50 + avgIntensity * 100;
                g = 255;
                b = 100 + avgIntensity * 50;
            } else if (freqRatio < 0.8) {
                // Mid-high - yellow
                r = 200 + avgIntensity * 55;
                g = 255;
                b = 50;
            } else {
                // High - orange to red
                r = 255;
                g = 150 + avgIntensity * 50;
                b = 30;
            }
            
            // Boost brightness based on intensity
            const brightnessBoost = 0.7 + avgIntensity * 0.3;
            r = Math.min(255, Math.floor(r * brightnessBoost));
            g = Math.min(255, Math.floor(g * brightnessBoost));
            b = Math.min(255, Math.floor(b * brightnessBoost));
            
            // Draw main blob with smooth, liquid-like curves
            // Use bezier curves for smoother, more fluid edges
            p.fill(r, g, b, 180); // Slightly more transparent for liquid effect
            p.stroke(r * 0.7, g * 0.7, b * 0.7, 200);
            p.strokeWeight(2.5);
            
            // Use bezierVertex for smoother, more liquid curves
            p.beginShape();
            for (let i = 0; i < blobVertices.length; i++) {
                const v = blobVertices[i];
                const nextIdx = (i + 1) % blobVertices.length;
                const prevIdx = (i - 1 + blobVertices.length) % blobVertices.length;
                
                const vCurr = blobVertices[i];
                const vNext = blobVertices[nextIdx];
                const vPrev = blobVertices[prevIdx];
                
                const x = centerX + Math.cos(vCurr.angle) * vCurr.radius;
                const y = centerY + Math.sin(vCurr.angle) * vCurr.radius;
                
                if (i === 0) {
                    p.vertex(x, y);
                } else {
                    // Calculate control points for smooth bezier curves
                    const prevX = centerX + Math.cos(vPrev.angle) * vPrev.radius;
                    const prevY = centerY + Math.sin(vPrev.angle) * vPrev.radius;
                    const nextX = centerX + Math.cos(vNext.angle) * vNext.radius;
                    const nextY = centerY + Math.sin(vNext.angle) * vNext.radius;
                    
                    // Control point for smooth curve (midpoint between current and next)
                    const cp1x = x + (nextX - x) * 0.3;
                    const cp1y = y + (nextY - y) * 0.3;
                    
                    p.bezierVertex(
                        cp1x, cp1y,
                        cp1x, cp1y,
                        x, y
                    );
                }
            }
            p.endShape(p.CLOSE);
            
            // Add inner highlight for liquid shine effect
            if (avgIntensity > 0.2) {
                p.fill(r + 30, g + 30, b + 30, 100);
                p.noStroke();
                p.beginShape();
                for (let i = 0; i < blobVertices.length; i++) {
                    const v = blobVertices[i];
                    const x = centerX + Math.cos(v.angle) * v.radius * 0.7;
                    const y = centerY + Math.sin(v.angle) * v.radius * 0.7;
                    p.curveVertex(x, y);
                }
                p.endShape(p.CLOSE);
            }
            
            // Add multiple inner ripples for intensity (more dramatic)
            if (avgIntensity > 0.15) {
                p.noFill();
                const numRipples = Math.floor(avgIntensity * 3) + 1;
                
                for (let ripple = 0; ripple < numRipples; ripple++) {
                    const rippleProgress = (ripple + 1) / (numRipples + 1);
                    const rippleRadius = baseRadius * 0.5 * rippleProgress;
                    const rippleAlpha = 150 * (1 - rippleProgress) * avgIntensity;
                    
                    p.stroke(r, g, b, rippleAlpha);
                    p.strokeWeight(2);
                    p.circle(centerX, centerY, rippleRadius * 2);
                }
            }
            
            // Add outer glow for high intensity
            if (avgIntensity > 0.3) {
                p.noFill();
                p.stroke(r, g, b, 80);
                p.strokeWeight(1);
                const glowRadius = baseRadius * 1.2;
                p.circle(centerX, centerY, glowRadius * 2);
            }
        }
        
        // Particle Swarm visualization
        function drawParticleSwarm(p) {
            const spectrum = fft.analyze();
            const waveform = fft.waveform();
            
            // Calculate intensity
            let totalIntensity = 0;
            for (let i = 0; i < waveform.length; i++) {
                totalIntensity += Math.abs(waveform[i]);
            }
            const avgIntensity = totalIntensity / waveform.length;
            
            // Get stereo data
            let leftIntensity = avgIntensity;
            let rightIntensity = avgIntensity;
            let leftSharpness = 0;
            let rightSharpness = 0;
            
            if (window.isStereo && sound && sound.buffer && sound.buffer.numberOfChannels >= 2) {
                try {
                    const currentTime = sound.currentTime();
                    const sampleRate = sound.buffer.sampleRate;
                    const sampleIndex = Math.floor(currentTime * sampleRate);
                    const leftChannel = sound.buffer.getChannelData(0);
                    const rightChannel = sound.buffer.getChannelData(1);
                    
                    let leftSum = 0, rightSum = 0, leftMaxChange = 0, rightMaxChange = 0;
                    let prevLeft = 0, prevRight = 0;
                    const windowSize = 256;
                    
                    for (let i = 0; i < windowSize; i++) {
                        const idx = sampleIndex - windowSize + i;
                        if (idx >= 0 && idx < leftChannel.length) {
                            const l = Math.abs(leftChannel[idx]);
                            const r = Math.abs(rightChannel[idx]);
                            leftSum += l;
                            rightSum += r;
                            
                            if (i > 0) {
                                leftMaxChange = Math.max(leftMaxChange, Math.abs(l - prevLeft));
                                rightMaxChange = Math.max(rightMaxChange, Math.abs(r - prevRight));
                            }
                            prevLeft = l;
                            prevRight = r;
                        }
                    }
                    
                    leftIntensity = leftSum / windowSize;
                    rightIntensity = rightSum / windowSize;
                    leftSharpness = leftMaxChange;
                    rightSharpness = rightMaxChange;
                } catch (e) {}
            }
            
            // Particle count based on intensity (more oomph!)
            const targetParticleCount = 100 + Math.floor(avgIntensity * 400);
            
            // Initialize or adjust particles
            while (particles.length < targetParticleCount) {
                // Determine which side based on stereo intensity
                const sideProb = leftIntensity / (leftIntensity + rightIntensity + 0.001);
                const side = p.random() < sideProb ? 'left' : 'right';
                
                // Spawn particles on their respective sides
                let spawnX;
                if (side === 'left') {
                    spawnX = p.random(0, p.width * 0.4);
                } else {
                    spawnX = p.random(p.width * 0.6, p.width);
                }
                
                particles.push({
                    x: spawnX,
                    y: p.random(p.height),
                    vx: p.random(-2, 2),
                    vy: p.random(-2, 2),
                    size: p.random(3, 8),
                    freqBand: Math.floor(p.random(spectrum.length)),
                    side: side
                });
            }
            
            // Remove excess particles
            while (particles.length > targetParticleCount) {
                particles.pop();
            }
            
            // Update and draw particles
            const centerX = p.width / 2;
            const centerY = p.height / 2;
            
            // Calculate target positions for L/R swarming
            const leftTargetX = p.width * 0.25;
            const rightTargetX = p.width * 0.75;
            
            for (let i = particles.length - 1; i >= 0; i--) {
                const particle = particles[i];
                
                // Get frequency intensity for this particle
                const freqIntensity = spectrum[particle.freqBand] / 255;
                
                // Strong L/R swarming behavior
                let targetX;
                let channelIntensity;
                
                if (particle.side === 'left') {
                    targetX = leftTargetX;
                    channelIntensity = leftIntensity;
                    
                    // Strong attraction to left side when left channel is active
                    const dx = targetX - particle.x;
                    const attraction = 0.05 + leftIntensity * 0.1;
                    particle.vx += dx * attraction;
                    
                    // Push away from right side
                    if (particle.x > centerX) {
                        particle.vx -= (rightIntensity * 0.15);
                    }
                } else {
                    targetX = rightTargetX;
                    channelIntensity = rightIntensity;
                    
                    // Strong attraction to right side when right channel is active
                    const dx = targetX - particle.x;
                    const attraction = 0.05 + rightIntensity * 0.1;
                    particle.vx += dx * attraction;
                    
                    // Push away from left side
                    if (particle.x < centerX) {
                        particle.vx += (leftIntensity * 0.15);
                    }
                }
                
                // Vertical attraction to center (weaker to avoid stuck particles)
                const dy = centerY - particle.y;
                particle.vy += dy * 0.01; // Reduced from 0.02
                
                // Sharpness creates explosive bursts
                const sharpness = particle.side === 'left' ? leftSharpness : rightSharpness;
                if (sharpness > 0.1) {
                    const angle = p.random(p.TWO_PI);
                    const burstForce = sharpness * 5;
                    particle.vx += Math.cos(angle) * burstForce;
                    particle.vy += Math.sin(angle) * burstForce;
                }
                
                // Prevent particles from getting stuck - add small random movement
                const distFromTarget = Math.abs(targetX - particle.x) + Math.abs(centerY - particle.y);
                if (distFromTarget < 5 && Math.abs(particle.vx) < 0.1 && Math.abs(particle.vy) < 0.1) {
                    // Particle is stuck near target, give it a small push
                    particle.vx += p.random(-0.5, 0.5);
                    particle.vy += p.random(-0.5, 0.5);
                }
                
                // Intensity affects particle behavior
                const intensityBoost = channelIntensity * 2;
                particle.vx *= (1 + intensityBoost * 0.01);
                particle.vy *= (1 + intensityBoost * 0.01);
                
                // Ensure minimum velocity to prevent completely stuck particles
                if (Math.abs(particle.vx) < 0.05 && Math.abs(particle.vy) < 0.05) {
                    particle.vx += p.random(-0.2, 0.2);
                    particle.vy += p.random(-0.2, 0.2);
                }
                
                // Update position
                particle.x += particle.vx;
                particle.y += particle.vy;
                
                // Boundary wrapping with bounce
                if (particle.x < 0) {
                    particle.x = 0;
                    particle.vx *= -0.5;
                }
                if (particle.x > p.width) {
                    particle.x = p.width;
                    particle.vx *= -0.5;
                }
                if (particle.y < 0) {
                    particle.y = 0;
                    particle.vy *= -0.5;
                }
                if (particle.y > p.height) {
                    particle.y = p.height;
                    particle.vy *= -0.5;
                }
                
                // Damping
                particle.vx *= 0.96;
                particle.vy *= 0.96;
                
                // Draw particle with more visual impact
                const hue = p.map(particle.freqBand, 0, spectrum.length, 180, 360);
                const brightness = 60 + freqIntensity * 195 + channelIntensity * 100;
                const alpha = 180 + freqIntensity * 75;
                
                // Larger, brighter particles
                p.fill(hue, 100, brightness, alpha);
                p.noStroke();
                const particleSize = particle.size * (1 + freqIntensity * 0.5 + channelIntensity * 0.3);
                p.circle(particle.x, particle.y, particleSize);
                
                // Add glow effect for high intensity
                if (channelIntensity > 0.3) {
                    p.fill(hue, 100, brightness, alpha * 0.3);
                    p.circle(particle.x, particle.y, particleSize * 2);
                }
            }
            
            // Draw center divider line
            p.stroke(200, 50);
            p.strokeWeight(1);
            p.line(centerX, 0, centerX, p.height);
        }
        
        // 3D Audio Landscape visualization (2D perspective view)
        function draw3DLandscape(p) {
            const spectrum = fft.analyze();
            const waveform = fft.waveform();
            
            // Calculate intensity
            let totalIntensity = 0;
            for (let i = 0; i < waveform.length; i++) {
                totalIntensity += Math.abs(waveform[i]);
            }
            const avgIntensity = totalIntensity / waveform.length;
            
            // Get stereo data
            let leftIntensity = avgIntensity;
            let rightIntensity = avgIntensity;
            
            if (window.isStereo && sound && sound.buffer && sound.buffer.numberOfChannels >= 2) {
                try {
                    const currentTime = sound.currentTime();
                    const sampleRate = sound.buffer.sampleRate;
                    const sampleIndex = Math.floor(currentTime * sampleRate);
                    const leftChannel = sound.buffer.getChannelData(0);
                    const rightChannel = sound.buffer.getChannelData(1);
                    
                    let leftSum = 0, rightSum = 0;
                    const windowSize = 256;
                    
                    for (let i = 0; i < windowSize; i++) {
                        const idx = sampleIndex - windowSize + i;
                        if (idx >= 0 && idx < leftChannel.length) {
                            leftSum += Math.abs(leftChannel[idx]);
                            rightSum += Math.abs(rightChannel[idx]);
                        }
                    }
                    
                    leftIntensity = leftSum / windowSize;
                    rightIntensity = rightSum / windowSize;
                } catch (e) {}
            }
            
            // Draw landscape as 2D side view with perspective
            const cols = spectrum.length;
            const baseY = p.height * 0.8;
            const maxHeight = p.height * 0.6;
            
            // Draw terrain from left to right
            p.beginShape();
            p.fill(100, 150, 200, 200);
            p.stroke(80, 120, 180, 255);
            p.strokeWeight(2);
            
            // Start at bottom left
            p.vertex(0, p.height);
            
            // Draw terrain line
            for (let i = 0; i < cols; i++) {
                const freqValue = spectrum[i] / 255;
                
                // Calculate height
                let height = freqValue * maxHeight;
                height += avgIntensity * maxHeight * 0.5;
                
                // L/R asymmetry
                const xRatio = i / cols;
                if (xRatio < 0.5) {
                    height += (leftIntensity - rightIntensity) * maxHeight * 0.3;
                } else {
                    height += (rightIntensity - leftIntensity) * maxHeight * 0.3;
                }
                
                // Add noise
                height += p.noise(i * 0.1, p.frameCount * 0.01) * maxHeight * 0.2;
                
                const x = p.map(i, 0, cols, 0, p.width);
                const y = baseY - height;
                
                // Color based on frequency
                const hue = p.map(i, 0, cols, 200, 300);
                const brightness = 50 + freqValue * 200;
                
                // Draw vertical bar for this frequency
                p.fill(hue, 100, brightness, 220);
                p.noStroke();
                const barWidth = p.width / cols;
                p.rect(x, y, barWidth, p.height - y);
                
                // Add to shape for terrain outline
                p.vertex(x, y);
            }
            
            // End at bottom right
            p.vertex(p.width, p.height);
            p.endShape(p.CLOSE);
            
            // Draw terrain outline on top
            p.stroke(150, 200, 255, 200);
            p.strokeWeight(2);
            p.noFill();
            p.beginShape();
            for (let i = 0; i < cols; i++) {
                const freqValue = spectrum[i] / 255;
                let height = freqValue * maxHeight;
                height += avgIntensity * maxHeight * 0.5;
                
                const xRatio = i / cols;
                if (xRatio < 0.5) {
                    height += (leftIntensity - rightIntensity) * maxHeight * 0.3;
                } else {
                    height += (rightIntensity - leftIntensity) * maxHeight * 0.3;
                }
                height += p.noise(i * 0.1, p.frameCount * 0.01) * maxHeight * 0.2;
                
                const x = p.map(i, 0, cols, 0, p.width);
                const y = baseY - height;
                p.vertex(x, y);
            }
            p.endShape();
        }
        
        p.windowResized = function() {
            const container = document.getElementById('p5-container');
            p.resizeCanvas(container.clientWidth, container.clientHeight);
        };
    };
    
    // Create p5 instance
    window.p5Sketch = new p5(sketch);
    console.log('p5.js sketch created');
    
    // Wait a bit for setup to complete and function to be assigned
    setTimeout(() => {
        console.log('loadAudioFileFunction available:', typeof loadAudioFileFunction);
        console.log('window.loadAudioFileFunction available:', typeof window.loadAudioFileFunction);
    }, 500);
}
