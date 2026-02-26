# Test Execution Flow - Design & Implementation Plan

## Overview
This document outlines the design, architecture, and implementation plan for the test execution flow that begins when a user clicks "START SESSION" on the test setup page (`test.html`).

---

## 🎯 Core Requirements

### Flow Summary
1. **Calibration Period** (20s) - Blank screen with countdown, collect brainwave readings
2. **Trial Loop** (for each pattern in queue):
   - **Baseline Phase** (30s) - Silence, collect brainwave readings
   - **Stimulation Phase** (30s) - Play audio on loop, collect brainwave readings
   - **Checkpoint** - Researcher-controlled pause (continue or abort)
   - **Survey** - Multi-select trial_tags selection (A, B, C, D)
3. **Sequential Playback** - Trials play as a playlist, one after another

---

## ✅ Decisions Made

### 1. Page Architecture & Navigation
**Decision:** **Same Page with Overlay** - Full-screen overlay that covers the entire setup interface. This maintains continuity and allows for easier state management.

### 2. Calibration UI
**Decision:** **Blank screen with countdown** - Minimal distraction, researcher can position screen away from participant.

### 3. Trial Tags
**Decision:** **A, B, C, D options** - Configurable via `js/modules/trialTagsConfig.json` file for easy updates.

### 4. EEG Integration
**Decision:** **Dummy/Simulated Data** - Start with simulated brainwave readings. Real EEG integration will come later.

### 5. Browser Refresh Handling
**Decision:** **Cancel session, return to setup** - Browser refresh takes user back to Test Setup page. Unsuccessful trials are not saved. Error handling included.

### 6. Inter-Trial Pause
**Decision:** **Researcher-controlled checkpoint** - Between trials, pause and allow researcher to continue or abort. This replaces the automatic 5s buffer with a researcher-controlled checkpoint.

---

## 🤔 Critical Questions & Decisions Needed

### ~~1. Page Architecture & Navigation~~ ✅ DECIDED

---

### 2. State Management & Data Flow

**Question:** How do we manage the complex state of an active test session?

**State Variables Needed:**
- Current session ID
- Current trial index
- Current phase (calibration | baseline | stimulation | buffer | survey | checkpoint)
- Phase timers/countdowns
- Queue of patterns (immutable during session)
- Collected brainwave readings (in-memory buffer before saving)
- Trial tags selections
- Audio playback state
- EEG connection state

**Options:**
- **A) Global Variables** (current approach)
  - ✅ Simple, direct access
  - ❌ Hard to debug, risk of state inconsistencies
  
- **B) Session State Object/Class**
  - ✅ Centralized state management
  - ✅ Easier to serialize/save
  - ✅ Better debugging
  - ❌ More initial setup

**Recommendation:** **Option B** - Create a `TestSession` class/module that encapsulates all session state and provides methods for state transitions.

**Follow-up Questions:**
- Should we persist session state to `localStorage` periodically to prevent data loss on page refresh?
- How do we handle browser refresh mid-test? (Save state? Restart? Warn user?)

---

### ~~3. Calibration Period~~ ✅ DECIDED

---

### 4. Trial Execution UI

**Question:** What should the execution interface look like during baseline/stimulation phases?

**Requirements:**
- Show countdown timer (30s baseline, 30s stimulation)
- Show current phase name
- Show current trial number (e.g., "Trial 3 of 8")
- Show pattern name
- Collect brainwave readings (background)
- Handle audio playback (stimulation phase)

**Design Considerations:**
- **Participant View:** Should be minimal/non-distracting (countdown only?)
- **Researcher View:** Should show more detail (trial info, progress, EEG status)

**Recommendation:** 
- **Full-screen overlay** with large, clear countdown
- **Minimal text** (phase name, countdown)
- **Progress indicator** (small, non-distracting)
- **Researcher controls** (ABORT button, EEG status indicator) - positioned where participant can't see

**Follow-up Questions:**
- Should there be visual/audio cues for phase transitions? (e.g., subtle beep, screen flash)
- How do we handle the screen positioning requirement? (UI reminder? Instructions?)

---

### 5. Audio Playback During Stimulation

**Question:** How do we ensure seamless audio looping for the 30s stimulation phase?

**Requirements:**
- If pattern < 30s: Loop seamlessly (no gaps)
- If pattern > 30s: Fade out starting at 25s, cut at 30s
- Handle audio start delays (measure `audio_time_offset`)
- Retry logic (5 attempts) if audio fails to start

**Technical Challenges:**
- p5.sound looping behavior (need to verify seamless looping)
- Fade-out implementation (Web Audio API or p5.sound)
- Timing precision (ensuring exact 30s cutoff)
- Error handling (what if audio file fails to load mid-session?)

**Recommendation:**
- Use `AudioPlayer` module's existing `setLoop(true)` for patterns < 30s
- Implement custom fade-out logic using Web Audio API `GainNode` for patterns > 30s
- Add `audio_time_offset` tracking (measure time from phase start to actual playback start)
- Implement retry logic with exponential backoff

**Follow-up Questions:**
- What constitutes "audio failure"? (No sound? Delayed start? Distorted playback?)
- Should we preload all audio files at session start to prevent mid-session loading delays?

---

### 6. Brainwave Data Collection

**Question:** How do we collect and store brainwave readings during the test?

**Requirements:**
- Collect readings continuously during calibration, baseline, and stimulation
- Tag readings with phase (`calibration`, `baseline`, `stimulation`)
- Tag readings with `audio_time_offset` during stimulation
- Store readings associated with `trial_id`
- Handle EEG disconnection gracefully

**Technical Approach:**
- **In-memory buffer:** Store readings in arrays during test
- **Batch save:** Save to `localStorage` (or prepare for API) after each trial
- **Data structure:** Array of objects with `timestamp_ms`, frequency bands, phase, etc.

**Critical Questions:**
- **Do we have EEG integration yet?** (If not, simulate with dummy data)
- How frequently should we sample? (Based on EEG device specs)
- What happens if EEG disconnects mid-trial? (Log event, continue with partial data?)
- Should we show real-time EEG visualization to researcher? (Probably yes, but where?)

**Recommendation:**
- **Phase 1:** Implement with **dummy/simulated EEG data** (random values, realistic ranges)
- **Phase 2:** Integrate real EEG device (Ganglion) later
- Create `EEGDataCollector` module that abstracts data collection (works with dummy or real data)

---

### 7. 5-Second Buffer Between Trials

**Question:** What happens during the 5s buffer?

**Options:**
- **A) Blank screen with countdown**
  - ✅ Clear transition
  - ✅ Gives participant/researcher a moment
  
- **B) Checkpoint screen (researcher-controlled)**
  - ✅ More control
  - ❌ Doesn't match requirement of "5 second buffer"
  
- **C) Silent transition (no UI change, just wait)**
  - ✅ Seamless
  - ❌ No feedback

**Recommendation:** **Option A** - Show a minimal "Preparing next trial..." message with 5s countdown. This provides feedback without being distracting.

**Follow-up Questions:**
- Should the buffer be skippable by researcher? (Probably not, to maintain consistency)
- What if researcher wants to pause between trials? (Add pause functionality?)

---

### ~~8. Survey/Trial Tags Selection~~ ✅ DECIDED
**Decision:** A, B, C, D options loaded from `js/modules/trialTagsConfig.json`. Configurable for easy updates.

---

### 9. Data Persistence & Storage

**Question:** How do we save session and trial data?

**Current State:**
- Sessions are saved to `localStorage` (from `test.html`)
- No backend API yet

**Requirements:**
- Save session data (already implemented)
- Save trial data (new)
- Save brainwave readings (new)
- Save trial_tags selections (new)

**Options:**
- **A) localStorage only** (current approach)
  - ✅ Works offline
  - ✅ Simple
  - ❌ Limited storage (5-10MB)
  - ❌ Not ideal for large datasets (brainwave readings)
  
- **B) localStorage + IndexedDB**
  - ✅ More storage capacity
  - ✅ Better for structured data
  - ❌ More complex
  
- **C) localStorage + Prepare for API**
  - ✅ Can migrate to backend later
  - ✅ Structure data as if sending to API
  - ❌ Still limited by localStorage size

**Recommendation:** **Option C** - Use localStorage for now, but structure data in a format that can be easily sent to an API later. For brainwave readings, we may need to batch them or use IndexedDB if the dataset becomes too large.

**Follow-up Questions:**
- How many brainwave readings per trial? (Depends on sampling rate - could be hundreds/thousands)
- Should we compress brainwave data? (Probably not necessary for now)
- What's the export format? (JSON file, as currently implemented for sessions)

---

### ~~10. Error Handling & Edge Cases~~ ✅ DECIDED
**Decision:** Browser refresh cancels session and returns to setup. Unsuccessful trials are not saved. Error handling included.

**Other Critical Scenarios to Handle:**

1. **Audio fails to load/play**
   - Retry 5 times
   - Show error to researcher
   - Option to skip trial or abort session

2. **EEG disconnects mid-trial**
   - Log disconnection timestamp
   - Continue trial (with partial data)
   - Show warning to researcher

3. **Browser refresh mid-session**
   - ✅ **DECIDED:** Cancel session, return to setup page
   - Unsuccessful trials not saved
   - Error handling included

4. **Queue is empty** (shouldn't happen, but validate)
   - Prevent session start if queue is empty

5. **Pattern file missing/corrupted**
   - Skip trial, log error
   - Continue with next pattern

6. **Participant wants to stop mid-session**
   - ABORT button (researcher only)
   - Save partial data
   - Mark session as "aborted"

**Recommendation:** Create an `ErrorHandler` utility module that centralizes error handling logic and provides consistent UI feedback.

---

## 🏗️ Proposed Architecture

### Components Needed

1. **`TestExecutionOverlay`** (New Component)
   - Full-screen overlay for test execution
   - Manages phase transitions
   - Displays countdown, trial info, progress
   - Handles ABORT functionality

2. **`CalibrationScreen`** (Sub-component or state)
   - 20s calibration countdown
   - Minimal UI

3. **`TrialExecutionScreen`** (Sub-component or state)
   - Baseline phase (30s countdown)
   - Stimulation phase (30s countdown + audio)
   - Shows trial number, pattern name

4. **`BufferScreen`** (Sub-component or state)
   - 5s buffer countdown
   - "Preparing next trial..." message

5. **`TrialTagsSurvey`** (New Component)
   - Multi-select button interface
   - Full-screen overlay
   - Validation (require at least one selection)

6. **`CheckpointScreen`** (Sub-component or state)
   - Shows trial progress
   - "Continue to Next Test" button
   - Researcher-controlled

### Modules Needed

1. **`TestSession`** (New Module)
   - Manages session state
   - Handles phase transitions
   - Coordinates between components
   - Saves data to localStorage

2. **`EEGDataCollector`** (New Module)
   - Abstracts EEG data collection
   - Works with dummy data initially
   - Can be swapped for real EEG integration later
   - Buffers readings in memory
   - Tags readings with phase/trial info

3. **`TrialTimer`** (New Module or part of TestSession)
   - Manages countdown timers
   - Handles phase transitions
   - Provides callbacks for phase changes

4. **`AudioPlaybackController`** (New Module or extend AudioPlayer)
   - Handles audio during stimulation phase
   - Manages looping for patterns < 30s
   - Implements fade-out for patterns > 30s
   - Tracks `audio_time_offset`

### Data Structures

```javascript
// Session State
{
  sessionId: string,
  startTime: Date,
  currentTrialIndex: number,
  currentPhase: 'calibration' | 'baseline' | 'stimulation' | 'buffer' | 'survey' | 'checkpoint',
  queue: Array<{name, path, ...}>,
  trials: Array<{
    trialId: string,
    patternId: string,
    startTime: Date,
    endTime: Date,
    baselineReadings: Array<BrainwaveReading>,
    stimulationReadings: Array<BrainwaveReading>,
    audioTimeOffset: number,
    selectedTags: Array<tagId>,
    status: 'completed' | 'aborted' | 'skipped'
  }>,
  calibrationReadings: Array<BrainwaveReading>,
  eegConnected: boolean
}

// Brainwave Reading
{
  timestamp_ms: number,
  delta_abs: number,
  theta_abs: number,
  alpha_abs: number,
  beta_abs: number,
  gamma_abs: number,
  delta_rel: number,
  theta_rel: number,
  alpha_rel: number,
  beta_rel: number,
  gamma_rel: number,
  phase: 'calibration' | 'baseline' | 'stimulation',
  audioTimeOffset?: number // Only during stimulation
}
```

---

## 📋 Implementation Phases

### Phase 1: Core Execution Flow (MVP)
1. Create `TestSession` module
2. Create `TestExecutionOverlay` component
3. Implement calibration screen (20s, dummy EEG data)
4. Implement baseline phase (30s countdown, dummy EEG data)
5. Implement stimulation phase (30s countdown, audio playback, dummy EEG data)
6. Implement 5s buffer
7. Basic trial loop (sequential playback)

### Phase 2: Survey & Data Collection
1. Create `TrialTagsSurvey` component
2. Integrate survey into trial flow
3. Implement `EEGDataCollector` module (dummy data)
4. Save trial data to localStorage
5. Save brainwave readings to localStorage

### Phase 3: Polish & Error Handling
1. Add ABORT functionality
2. Implement error handling (audio failures, etc.)
3. Add progress indicators
4. Add researcher controls
5. Handle edge cases

### Phase 4: Real EEG Integration (Future)
1. Integrate Ganglion device
2. Replace dummy data with real EEG readings
3. Add EEG connection status UI
4. Handle EEG disconnection scenarios

---

## 🎨 UI/UX Considerations

### Visual Hierarchy
- **Participant-facing:** Minimal, non-distracting (large countdown, minimal text)
- **Researcher-facing:** More detail (trial info, progress, EEG status, controls)

### Screen Positioning
- Need to ensure screen is not facing participant during test
- Consider adding a UI reminder or instruction screen before session starts

### Transitions
- Smooth transitions between phases
- Clear visual feedback for phase changes
- Non-jarring audio transitions (fade in/out)

### Accessibility
- Keyboard shortcuts (Enter to continue, Escape to abort?)
- Screen reader support (if needed)
- High contrast mode (if needed)

---

## ❓ Questions for You

1. **Page Architecture:** Same page (overlay) or separate page? (I recommend same page with overlay)

2. **Calibration UI:** Blank screen, minimal countdown, or researcher-only UI?

3. **Trial Tags:** What are the actual tag options? Should we hardcode them for now or load from a config file?

4. **EEG Integration:** Do we have EEG device integration ready, or should we start with dummy/simulated data?

5. **Data Storage:** localStorage sufficient for now, or should we plan for IndexedDB?

6. **Error Recovery:** How should we handle browser refresh mid-session? (Save state? Restart? Warn?)

7. **Researcher Controls:** Should there be a way to pause between trials, or is the 5s buffer the only break?

8. **Screen Positioning:** How do we ensure the screen isn't facing the participant? (UI reminder? Separate researcher screen?)

9. **Audio Preloading:** Should we preload all audio files at session start to prevent delays?

10. **Progress Display:** What level of detail should the progress indicator show? (Just trial number? Estimated time remaining? Visual progress bar?)

---

## 🚀 Next Steps

Once we align on the questions above, I'll:
1. Create the component and module files
2. Implement the core execution flow
3. Integrate with existing `test.html` page
4. Test the flow end-to-end
5. Iterate based on feedback

---

## 📝 Notes

- This is a complex feature with many moving parts. Breaking it into phases will help manage complexity.
- Starting with dummy EEG data allows us to build and test the flow without waiting for device integration.
- The overlay approach keeps everything on one page, simplifying state management.
- We should test the audio looping behavior thoroughly, especially for patterns of various lengths.
