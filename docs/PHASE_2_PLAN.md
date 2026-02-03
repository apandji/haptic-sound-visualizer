# Phase 2: Audio Visualization & Playback Components

## Goal
Replicate `index.html` functionality in `library.html` by creating modular audio visualization and playback components.

## Overview
Phase 2 focuses on extracting audio playback and visualization functionality from `index.html`/`app.js` into reusable components and modules. This enables the Library page to have full audio playback and visualization capabilities while maintaining a clean, component-based architecture.

**Key Design Decisions**:
- **Play/Pause**: Controlled by PatternExplorer (play buttons in file list)
- **Stop/Loop/Mode**: Controlled by AudioControls component (matches `index.html` layout)
- **Visualization**: Behaves exactly like `index.html` - same p5.js sketch, same drawing functions, same 8 modes
- **Manual Test**: Removed from Phase 2 scope (may be added later for Test page)

---

## Tasks

### 1. Create AudioPlayer Module
**File**: `js/modules/audioPlayer.js`  
**Purpose**: Non-UI audio playback logic using p5.SoundFile

**API**:
```javascript
// Create AudioPlayer instance
const audioPlayer = new AudioPlayer({
  // Optional callbacks (all are optional)
  onLoad: (soundFile) => {
    // Called when audio file finishes loading
    // soundFile is the p5.SoundFile instance
  },
  onPlay: () => {
    // Called when playback starts
  },
  onPause: () => {
    // Called when playback is paused
  },
  onStop: () => {
    // Called when playback stops
  },
  onEnd: () => {
    // Called when playback reaches the end (if not looping)
  }
});

// Methods
audioPlayer.loadFile(filePath)     // Load audio file from path (string)
audioPlayer.play()                 // Start or resume playback
audioPlayer.pause()                // Pause playback (keeps position)
audioPlayer.stop()                 // Stop playback (resets to beginning)
audioPlayer.setLoop(loop)          // Set loop: true/false
audioPlayer.getCurrentTime()       // Returns: number (seconds)
audioPlayer.getDuration()          // Returns: number (seconds) or 0 if not loaded
audioPlayer.isPlaying()            // Returns: boolean
audioPlayer.isLoaded()             // Returns: boolean
audioPlayer.getSoundFile()         // Returns: p5.SoundFile instance (for visualizer)
audioPlayer.destroy()              // Cleanup: removes event listeners, stops playback
```

**Features**:
- p5.SoundFile management
- Playback state tracking (playing/paused/stopped)
- Loop control
- Event callbacks (onLoad, onPlay, onPause, onStop, onEnd)
- Current time tracking
- Duration access

**Dependencies**:
- p5.js and p5.sound.js (must be loaded before this module)

**API Clarification**:
- **`loadFile(filePath)`**: Takes a string path (e.g., `'/audio_files/A_100_1.mp3'`), loads it using `p5.loadSound()`, calls `onLoad` callback when ready
- **`play()`, `pause()`, `stop()`**: Control playback state (same as p5.SoundFile methods)
- **`setLoop(loop)`**: Boolean - enables/disables looping (calls `soundFile.setLoop()`)
- **`getCurrentTime()`, `getDuration()`**: Return numbers in seconds
- **`isPlaying()`, `isLoaded()`**: Return booleans
- **`getSoundFile()`**: Returns the underlying p5.SoundFile instance (needed by Visualizer for FFT analysis)

---

### 2. Create Visualizer Component
**File**: `js/components/base/Visualizer.js`  
**CSS**: `css/components/base/visualizer.css`  
**Example**: `dev/components-examples/visualizer.example.html`

**Purpose**: Wraps p5.js sketch with visualization mode selection

**API**:
```javascript
// Create Visualizer instance
const visualizer = new Visualizer({
  containerId: 'p5-container',     // ID of container div for p5.js sketch
  audioPlayer: audioPlayer,         // AudioPlayer instance (provides p5.SoundFile)
  defaultMode: 'waveform',         // Default visualization mode (string)
  onModeChange: (mode) => {
    // Optional callback when mode changes
    // mode is a string: 'waveform', 'intensity', 'stereo', etc.
  }
});

// Methods
visualizer.setMode(mode)           // Switch visualization mode (string)
visualizer.getMode()               // Returns: string (current mode)
visualizer.setAudioPlayer(player)  // Update audio player reference
visualizer.destroy()               // Cleanup: removes p5.js sketch, clears container
```

**Features**:
- p5.js sketch initialization and management (exactly like `index.html`)
- All 8 visualization modes from `app.js` (waveform, intensity, stereo, spectrum, pulses, blob, particles, landscape)
- Mode switching without recreating sketch (switches drawing function in `draw()`)
- Integration with AudioPlayer module (gets p5.SoundFile via `audioPlayer.getSoundFile()`)
- Uses FFT analysis for visualizations (like `index.html`)
- Automatic cleanup on destroy (removes sketch, clears container)

**How it works** (exactly like `index.html`):
- Creates a p5.js sketch in the container (like `setupP5Sketch()` in `app.js` lines 1062-2486)
- Uses `p5.FFT()` for audio analysis (same as `index.html`)
- In the `draw()` function, switches between visualization modes using a `switch` statement (like line 1198 in `app.js`)
- Gets audio data from AudioPlayer's p5.SoundFile instance via `audioPlayer.getSoundFile()`
- Uses the same drawing functions from `app.js`:
  - `drawWaveform()` (line 1244)
  - `drawIntensityBars()` 
  - `drawStereoField()`
  - `drawFrequencySpectrum()`
  - `drawDirectionalPulses()`
  - `drawLiquidBlob()`
  - `drawParticleSwarm()`
  - `draw3DLandscape()`
- Draws playhead (red line) showing playback progress (line 1227-1232)
- Shows placeholder text when no audio is loaded (line 1234-1240)

**Visualization Modes**:
1. **waveform** - Waveform visualization
2. **intensity** - Intensity bars
3. **stereo** - Stereo field visualization
4. **spectrum** - Frequency spectrum
5. **pulses** - Directional pulses
6. **blob** - Liquid blob
7. **particles** - Particle swarm
8. **landscape** - Frequency terrain

**Dependencies**:
- p5.js and p5.sound.js
- AudioPlayer module
- Visualization drawing functions (from `app.js`)

---

### 3. Create AudioControls Component
**File**: `js/components/base/AudioControls.js`  
**CSS**: `css/components/base/audio-controls.css`  
**Example**: `dev/components-examples/audio-controls.example.html`

**Purpose**: Control bar with loop toggle, visualization mode selector, and stop button (no play/pause - handled by PatternExplorer)

**API**:
```javascript
const audioControls = new AudioControls({
  containerId: 'audioControls',
  audioPlayer: audioPlayer,  // AudioPlayer instance
  visualizer: visualizer,     // Visualizer instance (for mode changes)
  defaultLoop: true,          // Default loop state
  defaultMode: 'waveform',    // Default visualization mode
  modes: [                    // Available visualization modes
    { value: 'waveform', label: 'Waveform' },
    { value: 'intensity', label: 'Intensity Bars' },
    { value: 'stereo', label: 'Stereo Field' },
    { value: 'spectrum', label: 'Frequency Spectrum' },
    { value: 'pulses', label: 'Directional Pulses' },
    { value: 'blob', label: 'Liquid Blob' },
    { value: 'particles', label: 'Particle Swarm' },
    { value: 'landscape', label: 'Frequency Terrain' }
  ],
  onLoopChange: (isLooping) => {
    // Called when loop toggle changes
    audioPlayer.setLoop(isLooping);
  },
  onModeChange: (mode) => {
    // Called when visualization mode changes
    visualizer.setMode(mode);
  },
  onStop: () => {
    // Called when stop button clicked
    audioPlayer.stop();
  }
});

// Methods
audioControls.setLoop(loop)        // Set loop state programmatically
audioControls.getLoop()            // Get current loop state
audioControls.setMode(mode)        // Set visualization mode programmatically
audioControls.getMode()            // Get current visualization mode
audioControls.setAudioPlayer(player) // Update audio player reference
audioControls.setVisualizer(viz)   // Update visualizer reference
audioControls.destroy()            // Cleanup
```

**Features**:
- Stop button (`⏹`)
- Loop toggle button (`LOOP` with `.active` class when enabled)
- Visualization mode selector (dropdown `<select>`)
- Clean, minimal design matching `index.html`
- No play/pause buttons (handled by PatternExplorer)

**UI Elements**:
- Stop button: `⏹`
- Loop toggle: `LOOP` (with `.active` class when enabled)
- Mode selector: Dropdown with 8 visualization modes

---


---

## Implementation Steps

### Step 1: Extract Audio Logic into AudioPlayer Module
1. Review `app.js` audio loading and playback code (around lines 1062-1200)
2. Extract p5.SoundFile management into `AudioPlayer` class
3. Implement event callbacks (onLoad, onPlay, onPause, onStop, onEnd)
4. Add loop control
5. Test independently with example page

### Step 2: Extract Visualization Code
1. Review `app.js` p5.js sketch setup (around lines 1062-2486)
2. Extract visualization drawing functions
3. Create visualization mode switching logic
4. Create `Visualizer` component that wraps p5.js sketch
5. Test independently with example page

### Step 3: Create AudioControls Component
1. Extract controls bar HTML/CSS from `index.html` (lines 451-467)
2. Remove play/pause buttons (handled by PatternExplorer)
3. Implement stop button, loop toggle, and visualization mode selector
4. Wire loop toggle to AudioPlayer module
5. Wire mode selector to Visualizer component
6. Wire stop button to AudioPlayer module
7. Test independently with example page

### Step 4: Integration into library.html
1. Add p5.js and p5.sound.js dependencies
2. Add Visualizer component to main content area
3. Add AudioControls component above visualizer
4. Wire PatternExplorer file clicks → AudioPlayer → Visualizer
5. Wire PatternExplorer play button → AudioPlayer
6. Test end-to-end

---

## File Structure After Phase 2

```
js/
├── components/
│   ├── base/
│   │   ├── PatternExplorer.js          ✅ (Phase 1)
│   │   ├── DualSlider.js                ✅ (Phase 1)
│   │   ├── FilterPanel.js               ✅ (Phase 1)
│   │   ├── Visualizer.js                 🆕
│   │   └── AudioControls.js             🆕
│   ├── variants/
│   │   └── PatternExplorerWithFilters.js ✅ (Phase 1)
│   └── examples/
│       ├── visualizer.example.html       🆕
│       ├── audio-controls.example.html   🆕
│       └── audio-player.example.html      🆕
│
└── modules/
    ├── filters.js                        ✅ (Phase 1)
    └── audioPlayer.js                    🆕

css/
└── components/
    └── base/
        ├── pattern-explorer.css          ✅ (Phase 1)
        ├── dual-slider.css               ✅ (Phase 1)
        ├── filter-panel.css              ✅ (Phase 1)
        ├── visualizer.css                🆕
        └── audio-controls.css             🆕
```

---

## Dependencies

### External Libraries
- **p5.js** (v1.7.0) - Required for visualization
- **p5.sound.js** (v1.7.0) - Required for audio playback

### Internal Dependencies
- **AudioPlayer module** - Required by Visualizer and AudioControls
- **PatternExplorer** - Provides file selection and play button

---

## Integration Points

### PatternExplorer → AudioPlayer
```javascript
// In library.html initialization
patternExplorer.onFileClick = (file) => {
  audioPlayer.loadFile(file.path);
};

patternExplorer.onFilePreview = (file, isPlaying) => {
  if (isPlaying) {
    audioPlayer.play();
  } else {
    audioPlayer.pause();
  }
};
```

### AudioPlayer → Visualizer
```javascript
// Visualizer listens to AudioPlayer events
audioPlayer.onLoad = (soundFile) => {
  visualizer.setAudioPlayer(audioPlayer);
};
```

### AudioControls → AudioPlayer & Visualizer
```javascript
// AudioControls controls both AudioPlayer and Visualizer
audioControls.onStop = () => {
  audioPlayer.stop();
};

audioControls.onLoopChange = (isLooping) => {
  audioPlayer.setLoop(isLooping);
};

audioControls.onModeChange = (mode) => {
  visualizer.setMode(mode);
};
```

---

## Testing Strategy

1. **Module Isolation**: Test AudioPlayer module independently
2. **Component Isolation**: Test Visualizer and AudioControls independently
3. **Example Pages**: Create standalone HTML pages for each component
4. **Integration**: Test AudioPlayer + Visualizer + AudioControls together
5. **End-to-End**: Test full integration in library.html with PatternExplorer

---

## Success Criteria

- ✅ AudioPlayer module works independently
- ✅ Visualizer component works independently
- ✅ AudioControls component works independently
- ✅ All 8 visualization modes work correctly
- ✅ Loop control works correctly (toggle in AudioControls)
- ✅ Visualization mode selection works correctly (dropdown in AudioControls)
- ✅ Stop button works correctly
- ✅ PatternExplorer file clicks load audio
- ✅ PatternExplorer play button controls playback
- ✅ Visualizer updates in real-time during playback
- ✅ All 8 visualization modes work exactly like `index.html`
- ✅ All functionality from `index.html` replicated in `library.html`
- ✅ Clean component-based architecture maintained

---

## Migration Notes

### From app.js to Components
- **Audio loading**: `loadSound()` → `AudioPlayer.loadFile()`
- **Playback control**: Direct p5.SoundFile calls → `AudioPlayer.play/pause/stop()`
- **Visualization**: p5.js sketch in `app.js` → `Visualizer` component
- **Mode switching**: `visualizationMode` variable → `Visualizer.setMode()`
- **Controls**: HTML/CSS in `index.html` → `AudioControls` component

### Preserved Functionality
- All 8 visualization modes (exactly as in `index.html`)
- Loop functionality
- Stop functionality
- Visualization mode switching
- Audio file loading from PatternExplorer
- Real-time visualization updates
- p5.js sketch behavior identical to `index.html`

---

## Next Steps After Phase 2

- Phase 3: SelectionManager module (multi-select functionality)
- Phase 4: DragDropManager module (drag & drop functionality)
- Phase 5: PatternExplorerTestMode variant (full Test page functionality)
- Phase 6: Analysis page components

---

## Notes

- **No Play/Pause in AudioControls**: Since PatternExplorer has play buttons, AudioControls focuses on stop, loop toggle, and visualization mode selection
- **Combined Controls**: Loop toggle and mode selector are both in AudioControls component (matching `index.html` layout)
- **p5.js Integration**: Visualizer component manages p5.js sketch lifecycle exactly like `setupP5Sketch()` in `app.js` - same drawing functions, same FFT analysis, same behavior
- **Visualization Modes**: All 8 modes from `app.js` are included and work identically to `index.html`
- **Event-Driven Architecture**: Components communicate via callbacks/events rather than direct references where possible
- **Backward Compatibility**: `index.html` can continue using `app.js` while `library.html` uses new components
- **Manual Test Removed**: Manual test functionality is not included in Phase 2 (may be added in later phase for Test page)
