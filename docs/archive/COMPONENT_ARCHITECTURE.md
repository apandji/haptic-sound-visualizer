# Component-Based Architecture Plan

## Overview
Modular, component-based architecture to enable:
- **Reusability**: Components can be used across different pages
- **Testability**: Each component can be tested independently
- **Maintainability**: Changes to one component don't break others
- **Incremental Development**: Build and test components one at a time

## Directory Structure

```
/
├── index.html (Library page)
├── test.html (Test page)
├── analyze.html (Analysis page)
├── js/
│   ├── components/
│   │   ├── PatternExplorer.js - Main sidebar component (file list + filters)
│   │   │   ├── PatternExplorerWithQueue.js - Version with queue selection
│   │   │   └── PatternExplorerSimple.js - Version without queue
│   │   ├── Visualizer.js - Base visualizer component
│   │   │   ├── FullVisualizer.js - Large main visualizer
│   │   │   └── MiniVisualizer.js - Compact visualizer
│   │   ├── AudioControls.js - Play/pause/stop/loop controls
│   │   ├── FileItem.js - Individual file item with tooltip
│   │   ├── FilterPanel.js - Search + dual sliders
│   │   ├── DualSlider.js - Reusable dual-handle slider
│   │   └── Tooltip.js - Metadata tooltip component
│   ├── modules/
│   │   ├── fileLoader.js - Load file list & metadata
│   │   ├── audioPlayer.js - Audio loading/playback logic
│   │   ├── filters.js - Filter/search logic
│   │   └── p5Manager.js - p5.js instance management
│   └── pages/
│       ├── library.js - Library page logic
│       ├── test.js - Test page logic
│       └── analyze.js - Analysis page logic
└── css/
    ├── components/
    │   ├── pattern-explorer.css
    │   ├── visualizer.css
    │   ├── audio-controls.css
    │   └── filters.css
    └── styles.css - Base styles
```

## Component Specifications

### 1. PatternExplorer Component

**Purpose**: Sidebar with filters and file list

**Variants**:
- `PatternExplorerSimple`: Browse-only (Library page)
- `PatternExplorerWithQueue`: Browse + add to queue (Test page)

**Props/Options**:
```javascript
{
  containerId: string,        // DOM element ID
  enableQueue: boolean,       // Show queue functionality
  onFileSelect: function,     // Callback when file clicked
  onQueueAdd: function,       // Callback when file added to queue
  initialFilters: object      // Initial filter values
}
```

**Methods**:
- `render(files)` - Render file list
- `updateFilters(filters)` - Update filter values
- `getSelectedFile()` - Get currently selected file
- `destroy()` - Cleanup

**Dependencies**:
- FilterPanel component (for filters)
- fileLoader module

---

### 2. Visualizer Component

**Purpose**: p5.js-based audio visualization

**Variants**:
- `FullVisualizer`: Large, main visualization area
- `MiniVisualizer`: Compact, smaller visualization

**Props/Options**:
```javascript
{
  containerId: string,         // DOM element ID
  width: number,              // Canvas width
  height: number,             // Canvas height
  visualizationMode: string,  // 'waveform', 'spectrum', etc.
  onReady: function           // Callback when ready
}
```

**Methods**:
- `loadAudio(path)` - Load audio file
- `play()` - Start playback
- `pause()` - Pause playback
- `stop()` - Stop playback
- `setVisualizationMode(mode)` - Change visualization
- `destroy()` - Cleanup p5 instance

**Dependencies**:
- p5Manager module
- audioPlayer module

---

### 3. AudioControls Component

**Purpose**: Playback controls (play/pause/stop/loop)

**Props/Options**:
```javascript
{
  containerId: string,        // DOM element ID
  onPlay: function,          // Play callback
  onPause: function,         // Pause callback
  onStop: function,          // Stop callback
  onLoopToggle: function,    // Loop toggle callback
  disabled: boolean           // Disable all controls
}
```

**Methods**:
- `setPlaying(isPlaying)` - Update play/pause state
- `setLooping(isLooping)` - Update loop state
- `setDisabled(disabled)` - Enable/disable controls
- `destroy()` - Cleanup

---

### 4. FileList Component

**Purpose**: Render list of audio files

**Props/Options**:
```javascript
{
  containerId: string,        // DOM element ID
  files: array,              // Array of file objects
  metadata: object,           // Metadata map
  onFileClick: function,     // File click handler
  onFileHover: function,      // File hover handler
  showPreviewButton: boolean  // Show preview play button
}
```

**Methods**:
- `render(files)` - Render file list
- `setActiveFile(path)` - Highlight active file
- `updateFiles(files)` - Update file list
- `destroy()` - Cleanup

**Dependencies**:
- FileItem component
- Tooltip component

---

### 5. FilterPanel Component

**Purpose**: Search box + dual sliders for filtering

**Props/Options**:
```javascript
{
  containerId: string,        // DOM element ID
  filters: object,            // Filter definitions
  onFilterChange: function,   // Callback when filters change
  onReset: function          // Callback when reset clicked
}
```

**Methods**:
- `getFilters()` - Get current filter values
- `setFilters(filters)` - Set filter values
- `reset()` - Reset all filters
- `destroy()` - Cleanup

**Dependencies**:
- DualSlider component

---

### 6. DualSlider Component

**Purpose**: Reusable dual-handle range slider

**Props/Options**:
```javascript
{
  containerId: string,        // DOM element ID
  min: number,               // Minimum value
  max: number,               // Maximum value
  step: number,              // Step size
  label: string,             // Display label
  onChange: function         // Callback when values change
}
```

**Methods**:
- `getValues()` - Get current min/max values
- `setValues(min, max)` - Set values
- `destroy()` - Cleanup

---

## Module Specifications

### fileLoader.js
- `loadFileList()` - Load audio files from API/JSON
- `loadPatternMetadata()` - Load pattern metadata
- `getFileList()` - Get cached file list
- `getMetadata()` - Get cached metadata

### audioPlayer.js
- `createAudioPlayer(options)` - Create audio player instance
- `loadAudio(path)` - Load audio file
- `play()` / `pause()` / `stop()` - Playback control
- `getCurrentSound()` - Get current sound object

### filters.js
- `applyFilters(files, filters, metadata)` - Filter file list
- `createFilterFunction(filters)` - Create filter function
- `validateFilters(filters)` - Validate filter values

### p5Manager.js
- `createP5Instance(options)` - Create p5.js instance
- `destroyP5Instance(instance)` - Cleanup p5 instance
- `getP5Instance(id)` - Get instance by ID

---

## Development Strategy

### Phase 1: Extract Core Components (Start Here)
1. ✅ Create base component structure
2. ✅ Extract PatternExplorer component from current code (file list rendering)
3. Extract FilterPanel component
4. Extract AudioControls component
5. Test each component independently

### Phase 2: Build PatternExplorer
1. Create PatternExplorer base class
2. Implement PatternExplorerSimple (no queue)
3. Test with Library page
4. Implement PatternExplorerWithQueue
5. Test with Test page

### Phase 3: Build Visualizer Components
1. Extract visualizer logic into component
2. Create FullVisualizer
3. Create MiniVisualizer
4. Test both variants

### Phase 4: Create Pages
1. Build Library page using components
2. Build Test page using components
3. Build Analysis page using components

### Phase 5: Refinement
1. Optimize component APIs
2. Add error handling
3. Add loading states
4. Improve styling

---

## Component API Pattern

All components follow this pattern:

```javascript
class ComponentName {
  constructor(options) {
    this.options = options;
    this.container = document.getElementById(options.containerId);
    this.init();
  }
  
  init() {
    // Initialize component
  }
  
  render(data) {
    // Render component
  }
  
  update(data) {
    // Update component state
  }
  
  destroy() {
    // Cleanup
  }
}

// Usage
const component = new ComponentName({
  containerId: 'my-container',
  onEvent: (data) => { /* handle event */ }
});
```

---

## Benefits

1. **Isolated Testing**: Each component can be tested in isolation
2. **Reusability**: PatternExplorer can be used on Library and Test pages
3. **Incremental Development**: Build one component at a time
4. **Easier Debugging**: Know exactly which component has issues
5. **Team Collaboration**: Different people can work on different components
6. **Version Control**: Changes are localized to specific components

---

## Next Steps

1. Start with FileList component (simplest)
2. Extract it from current app.js
3. Test it independently
4. Move to next component
