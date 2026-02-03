# Phase 2: Linear Tasks

## ✅ Completed
- **Task 1: Create AudioPlayer Module** - ✅ DONE
  - File: `js/modules/audioPlayer.js`
  - Example: `dev/modules-examples/audio-player.example.html`
  - Status: Complete with LOOP 30s feature, tested, documented

---

## 📋 Remaining Tasks

### Task 2: Create Visualizer Component
**Priority**: High  
**Estimated Time**: 4-6 hours  
**Dependencies**: Task 1 (AudioPlayer) ✅

**Description**:  
Create a component that wraps p5.js sketch with visualization mode selection. Must replicate exact behavior from `index.html`.

**Files to Create**:
- `js/components/base/Visualizer.js`
- `css/components/base/visualizer.css`
- `dev/components-examples/visualizer.example.html`

**Requirements**:
- [ ] Extract p5.js sketch setup from `app.js` (lines 1062-2486)
- [ ] Extract all 8 visualization drawing functions:
  - [ ] `drawWaveform()`
  - [ ] `drawIntensityBars()`
  - [ ] `drawStereoField()`
  - [ ] `drawFrequencySpectrum()`
  - [ ] `drawDirectionalPulses()`
  - [ ] `drawLiquidBlob()`
  - [ ] `drawParticleSwarm()`
  - [ ] `draw3DLandscape()`
- [ ] Implement mode switching (switch statement in `draw()`)
- [ ] Integrate with AudioPlayer (get p5.SoundFile via `audioPlayer.getSoundFile()`)
- [ ] Use FFT analysis for visualizations
- [ ] Draw playhead (red line) showing playback progress
- [ ] Show placeholder text when no audio loaded
- [ ] Implement `setMode(mode)`, `getMode()`, `setAudioPlayer(player)`, `destroy()` methods
- [ ] Create example/test page
- [ ] Test all 8 visualization modes independently

**API**:
```javascript
new Visualizer({
  containerId: 'p5-container',
  audioPlayer: audioPlayer,
  defaultMode: 'waveform',
  onModeChange: (mode) => {}
})
```

**Acceptance Criteria**:
- ✅ All 8 visualization modes work exactly like `index.html`
- ✅ Mode switching works without recreating sketch
- ✅ Visualizations update in real-time during playback
- ✅ Playhead shows playback progress
- ✅ Placeholder shown when no audio loaded
- ✅ Component can be destroyed and cleaned up

---

### Task 3: Create AudioControls Component
**Priority**: High  
**Estimated Time**: 2-3 hours  
**Dependencies**: Task 1 (AudioPlayer) ✅, Task 2 (Visualizer)

**Description**:  
Create control bar with loop toggle, visualization mode selector, and stop button. No play/pause (handled by PatternExplorer).

**Files to Create**:
- `js/components/base/AudioControls.js`
- `css/components/base/audioControls.css`
- `dev/components-examples/audio-controls.example.html`

**Requirements**:
- [ ] Extract controls bar HTML/CSS from `index.html` (lines 451-467)
- [ ] Remove play/pause buttons (not needed)
- [ ] Implement stop button (`⏹`)
- [ ] Implement loop toggle button (`LOOP` with `.active` class)
- [ ] Implement visualization mode selector (dropdown `<select>`)
- [ ] Wire loop toggle to AudioPlayer (`audioPlayer.setLoop()`)
- [ ] Wire mode selector to Visualizer (`visualizer.setMode()`)
- [ ] Wire stop button to AudioPlayer (`audioPlayer.stop()`)
- [ ] Match design from `index.html`
- [ ] Create example/test page
- [ ] Test all controls independently

**API**:
```javascript
new AudioControls({
  containerId: 'audioControls',
  audioPlayer: audioPlayer,
  visualizer: visualizer,
  defaultLoop: true,
  defaultMode: 'waveform',
  modes: [...],
  onLoopChange: (isLooping) => {},
  onModeChange: (mode) => {},
  onStop: () => {}
})
```

**Acceptance Criteria**:
- ✅ Stop button stops playback
- ✅ Loop toggle enables/disables looping
- ✅ Mode selector switches visualization modes
- ✅ UI matches `index.html` design
- ✅ All callbacks fire correctly
- ✅ Component can be destroyed and cleaned up

---

### Task 4: Integrate Components into library.html
**Priority**: High  
**Estimated Time**: 3-4 hours  
**Dependencies**: Task 1 ✅, Task 2, Task 3

**Description**:  
Integrate AudioPlayer, Visualizer, and AudioControls into `library.html` and wire them together with PatternExplorer.

**Files to Modify**:
- `library.html`

**Requirements**:
- [ ] Add p5.js and p5.sound.js dependencies to `library.html`
- [ ] Add Visualizer component to main content area
- [ ] Add AudioControls component above visualizer
- [ ] Initialize AudioPlayer with p5.js `loadSound` function
- [ ] Wire PatternExplorer file clicks → AudioPlayer (`audioPlayer.loadFile()`)
- [ ] Wire PatternExplorer play button → AudioPlayer (`audioPlayer.play()`/`pause()`)
- [ ] Wire AudioControls → AudioPlayer (stop, loop)
- [ ] Wire AudioControls → Visualizer (mode selection)
- [ ] Wire AudioPlayer → Visualizer (audio loading)
- [ ] Test end-to-end functionality

**Integration Points**:
```javascript
// PatternExplorer → AudioPlayer
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

// AudioPlayer → Visualizer
audioPlayer.onLoad = (soundFile) => {
  visualizer.setAudioPlayer(audioPlayer);
};

// AudioControls → AudioPlayer & Visualizer
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

**Acceptance Criteria**:
- ✅ Clicking file in PatternExplorer loads audio
- ✅ Clicking play button in PatternExplorer plays/pauses audio
- ✅ Stop button stops playback
- ✅ Loop toggle works
- ✅ Mode selector switches visualization modes
- ✅ Visualizer shows real-time visualization during playback
- ✅ All 8 visualization modes work
- ✅ Behavior matches `index.html` functionality

---

## 📊 Summary

**Total Tasks**: 4  
**Completed**: 1 ✅  
**Remaining**: 3  

**Estimated Total Time**: 9-13 hours

**Task Order**:
1. ✅ AudioPlayer Module (DONE)
2. Visualizer Component (Next)
3. AudioControls Component
4. Integration into library.html

---

## 🎯 Phase 2 Success Criteria

- ✅ AudioPlayer module works independently
- ⬜ Visualizer component works independently
- ⬜ AudioControls component works independently
- ⬜ All 8 visualization modes work correctly
- ⬜ Loop control works correctly
- ⬜ Visualization mode selection works correctly
- ⬜ Stop button works correctly
- ⬜ PatternExplorer file clicks load audio
- ⬜ PatternExplorer play button controls playback
- ⬜ Visualizer updates in real-time during playback
- ⬜ All functionality from `index.html` replicated in `library.html`
- ⬜ Clean component-based architecture maintained
