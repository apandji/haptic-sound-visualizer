# Base Components

Base components are standalone, reusable UI components that can be used independently or composed into variants.

## Components

### PatternExplorer
**File**: `patternExplorer.js`  
**CSS**: `../../css/components/base/patternExplorer.css`  
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
**File**: `dualSlider.js`  
**CSS**: `../../css/components/base/dualSlider.css`  
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
**File**: `filterPanel.js`  
**CSS**: `../../css/components/base/filterPanel.css`  
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
**File**: `visualizer.js`  
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

### PatternQueue
**File**: `patternQueue.js`  
**CSS**: `../../css/components/base/patternQueue.css`  
**Purpose**: Displays a queue of selected patterns with drag & drop reordering for test sessions.

**API**:
```javascript
new PatternQueue({
  containerId: 'queue',
  metadata: {...}, // Pattern metadata for tooltips
  onItemRemove: (file, index) => {
    // Called when item is removed
  },
  onReorder: (items) => {
    // Called when items are reordered via drag & drop
  }
})

// Methods
queue.addItem(file)        // Add pattern to queue
queue.removeItem(index)     // Remove item at index
queue.getItems()            // Get all items in queue
queue.clear()               // Clear all items
queue.isInQueue(filePath)   // Check if file is in queue
queue.updateMetadata(metadata) // Update metadata
queue.destroy()             // Cleanup
```

**Example**: `../../dev/components-examples/queue.example.html`

---

### SessionInfo
**File**: `sessionInfo.js`  
**CSS**: `../../css/components/base/sessionInfo.css`  
**Purpose**: Form component for collecting session metadata, including distinct participant notes and session notes.

**API**:
```javascript
new SessionInfo({
  containerId: 'sessionInfo',
  participants: [...], // Array of {participant_id, participant_code, ...}
  locations: [...],     // Array of {location_id, name, ...}
  initialData: {...},   // Optional: initial form values
  onChange: (change) => {
    // change = {field, value, data, isValid}
  },
  onValidationChange: (isValid, data) => {
    // Called when validation state changes
  }
})

// Methods
sessionInfo.getData()              // Get current form data
sessionInfo.setData(data)          // Set form data programmatically
sessionInfo.validate()             // Validate form (returns boolean)
sessionInfo.reset()                // Reset form to defaults
sessionInfo.updateParticipants(participants) // Update participants list
sessionInfo.updateLocations(locations)        // Update locations list
sessionInfo.destroy()              // Cleanup
```

**Example**: `../../dev/components-examples/session-info.example.html`

---

### SignalQualityVisualizer
**File**: `signalQualityVisualizer.js`  
**CSS**: `../../css/components/base/signalQualityVisualizer.css`  
**Purpose**: Intercom-style floating widget that displays real-time signal quality metrics for OpenBCI Ganglion EEG channels. Appears automatically when device is connected.

**API**:
```javascript
const signalQuality = new SignalQualityVisualizer({
    containerId: 'signalQualityVisualizer',
    updateInterval: 1000,        // Update frequency in ms (default: 1000)
    windowLength: 2.0,           // PSD window length in seconds (default: 2.0)
    useMockData: true,           // Use mock data from CSV (default: true)
    mockDataPath: 'data/ganglion_sample_data.csv',
    onQualityChange: (qualities) => {
        // qualities = [
        //   { channel: 'CH1', rms_uV: 45.2, quality: 'good', ... },
        //   ...
        // ]
    },
    onConnectionChange: (isConnected) => {
        // Called when device connects/disconnects
    }
});

// Methods
signalQuality.start()              // Start monitoring (shows widget)
signalQuality.stop()               // Stop monitoring (hides widget)
signalQuality.toggle()             // Toggle expanded/collapsed panel
signalQuality.expand()             // Expand panel
signalQuality.collapse()           // Collapse panel
signalQuality.getQualities()       // Get current quality metrics
signalQuality.isDeviceConnected()  // Check connection status
signalQuality.destroy()            // Cleanup
```

**Features**:
- Intercom-style floating widget (bottom-right corner)
- Minimized button with color-coded status dot (green/orange/red)
- Expandable panel with quality table
- Real-time updates (configurable interval)
- Mock data support (loads from CSV file)
- Quality classification: good/ok/poor based on RMS thresholds

**Quality Metrics**:
- **RMS (μV)**: Root mean square amplitude (1-45 Hz band)
- **Quality**: Classification based on thresholds:
  - **Good**: `5.0 <= RMS <= 100.0` μV
  - **OK**: `100.0 < RMS <= 150.0` μV
  - **Poor**: Everything else

**Example**: `../../dev/components-examples/signal-quality-visualizer.example.html`

---

## Adding a New Base Component

1. Create component file: `ComponentName.js`
2. Create CSS file: `../../css/components/base/component-name.css`
3. Create example: `../../dev/components-examples/component-name.example.html`
4. Document in this README
5. Follow the component template (see COMPONENT_ORGANIZATION.md)
