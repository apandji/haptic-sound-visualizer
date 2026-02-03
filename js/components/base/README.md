# Base Components

Base components are standalone, reusable UI components that can be used independently or composed into variants.

## Components

### PatternExplorer
**File**: `PatternExplorer.js`  
**CSS**: `../../css/components/base/pattern-explorer.css`  
**Purpose**: Renders a list of audio files with tooltips, play/pause buttons, and click handlers.

**API**:
```javascript
new PatternExplorer({
  containerId: 'fileList',
  files: [...],
  metadata: {...},
  onFileClick: (file) => {},
  onFilePreview: (file) => {},
  showProgressBar: false
})
```

**Example**: `../../dev/components-examples/pattern-explorer.example.html`

---

### DualSlider
**File**: `DualSlider.js`  
**CSS**: `../../css/components/base/dual-slider.css`  
**Purpose**: A dual-handle range slider for selecting min/max values.

**API**:
```javascript
new DualSlider({
  containerId: 'slider-container',
  min: 0,
  max: 1,
  step: 0.01,
  label: 'RMS',
  initialMin: 0,
  initialMax: 1,
  formatValue: (val) => val.toFixed(3),
  onChange: (min, max) => {
    console.log(`Range: ${min} - ${max}`);
  }
})

// Methods
slider.getValues()        // Get current min/max values
slider.setValues(min, max) // Set values programmatically
slider.reset()            // Reset to full range
slider.destroy()          // Cleanup
```

**Example**: `../../dev/components-examples/dual-slider.example.html`

---

### FilterPanel
**File**: `FilterPanel.js`  
**CSS**: `../../css/components/base/filter-panel.css`  
**Purpose**: Search box + multiple dual sliders for filtering audio files.

**API**:
```javascript
new FilterPanel({
  containerId: 'filterPanel',
  metadata: {...}, // For calculating ranges
  filters: {...},  // Optional: custom filter config
  onFilterChange: (filters) => {
    // filters = { search: '', rms: [min, max], duration: [min, max], ... }
  },
  onReset: () => {}
})

// Methods
filterPanel.getFilters()        // Get current filter values
filterPanel.setFilters(filters) // Set filter values programmatically
filterPanel.reset()             // Reset all filters
filterPanel.updateMetadata(metadata) // Update metadata and recalculate ranges
filterPanel.destroy()            // Cleanup
```

**Example**: `../../dev/components-examples/filter-panel.example.html`

---

### Visualizer
**File**: `Visualizer.js`  
**CSS**: `../../css/components/base/visualizer.css`  
**Purpose**: Wraps p5.js sketch with visualization mode selection. Provides all 8 visualization modes from index.html.

**API**:
```javascript
new Visualizer({
  containerId: 'p5-container',
  audioPlayer: audioPlayer,  // AudioPlayer instance (optional, can be set later)
  defaultMode: 'waveform',    // Default visualization mode
  onModeChange: (mode) => {
    // Called when mode changes
  }
})

// Methods
visualizer.setMode(mode)           // Switch visualization mode
visualizer.getMode()               // Get current mode
visualizer.setAudioPlayer(player)  // Update audio player reference
visualizer.destroy()               // Cleanup
```

**Visualization Modes**:
- `waveform` - Waveform visualization
- `intensity` - Intensity bars
- `stereo` - Stereo field visualization
- `spectrum` - Frequency spectrum
- `pulses` - Directional pulses
- `blob` - Liquid blob
- `particles` - Particle swarm
- `landscape` - Frequency terrain

**Example**: `../../dev/components-examples/visualizer.example.html`

---

## Adding a New Base Component

1. Create component file: `ComponentName.js`
2. Create CSS file: `../../css/components/base/component-name.css`
3. Create example: `../../dev/components-examples/component-name.example.html`
4. Document in this README
5. Follow the component template (see COMPONENT_ORGANIZATION.md)
