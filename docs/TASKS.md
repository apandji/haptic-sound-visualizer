# Haptic Sound Visualizer - Task Tracker

**Last Updated**: February 8, 2026  
**Working Branch**: `feature/analysis`

Use this document to track all work across the project. Tasks are formatted for easy transfer to Linear.

---

## COMPLETED

### Component Architecture & Organization
- [x] **HSV-C01**: Scaffold three-mode architecture (Library / Test / Analysis)
- [x] **HSV-C02**: Create component-based directory structure (`js/components/base/`, `variants/`, `modules/`)
- [x] **HSV-C03**: Build `PatternExplorer` base component
- [x] **HSV-C04**: Build `FilterPanel` component with `DualSlider`
- [x] **HSV-C05**: Build `AudioControls` component
- [x] **HSV-C06**: Build `Visualizer` component (8 visualization modes)
- [x] **HSV-C07**: Build `PatternExplorerWithFilters` variant
- [x] **HSV-C08**: Build `PatternExplorerWithSelection` variant (for Test page queue)
- [x] **HSV-C09**: Set up CSS component organization (`css/components/base/`, `variants/`)
- [x] **HSV-C10**: Create component example pages in `dev/components-examples/`

### Audio & Metadata
- [x] **HSV-A01**: Build `audioPlayer.js` module (play/pause/stop/loop)
- [x] **HSV-A02**: Build `filters.js` module (search, RMS, duration, stereo filtering)
- [x] **HSV-A03**: Create `generate_metadata.py` script (RMS, duration, stereo balance, stereo movement)
- [x] **HSV-A04**: Generate metadata for all audio files (`pattern_metadata.json`)

### Signal Quality Widget
- [x] **HSV-SQ01**: Build `SignalQualityVisualizer` component (Intercom-style floating widget)
- [x] **HSV-SQ02**: Implement quality classification (good / ok / poor) matching Python thresholds
- [x] **HSV-SQ03**: Implement mock data integration with `ganglion_sample_data.csv`
- [x] **HSV-SQ04**: Add data validation & error handling
- [x] **HSV-SQ05**: Add channel configuration (select which channels to monitor)
- [x] **HSV-SQ06**: Add window length & sampling rate configuration
- [x] **HSV-SQ07**: Implement connection lifecycle management (prepare / startStream / stopStream / release)
- [x] **HSV-SQ08**: Add last-update timestamp display

### Test Setup Page
- [x] **HSV-T01**: Build Test Setup page with pattern queue
- [x] **HSV-T02**: Implement drag-and-drop queue reordering
- [x] **HSV-T03**: Build `SessionTimeEstimator` module
- [x] **HSV-T04**: Create session timing config (`sessionTimingConfig.json`)
- [x] **HSV-T05**: Design test execution flow (documented in `TEST_EXECUTION_FLOW_DESIGN.md`)
- [x] **HSV-T06**: Define 20 survey tags across 7 dimensions with EEG band probes
- [x] **HSV-T07**: Create trial tags config (`trialTagsConfig.json`)

### Documentation & Process
- [x] **HSV-D01**: Write `CONTRIBUTING.md` (branch naming, commit messages, PR process)
- [x] **HSV-D02**: Write `COMPONENT_ORGANIZATION.md`
- [x] **HSV-D03**: Write `METADATA_GENERATION.md`
- [x] **HSV-D04**: Write `TESTING_PROTOCOL.md`
- [x] **HSV-D05**: Write `TEST_EXECUTION_FLOW_DESIGN.md`
- [x] **HSV-D06**: Complete technology research for OpenBCI Ganglion browser integration
- [x] **HSV-D07**: Create database schema design (`database_schema.txt`)
- [x] **HSV-D08**: Write `OPENBCI_GANGLION_INTEGRATION_PLAN.md`

---

## IN PROGRESS

### Test Execution Flow
- [ ] **HSV-T08**: Build `TestSession` module (session state management, phase transitions)
  - State: calibration | baseline | stimulation | checkpoint | survey
  - Coordinates between components
  - Saves data to localStorage
- [ ] **HSV-T09**: Build `TestExecutionOverlay` component (full-screen overlay)
  - Calibration screen (20s countdown)
  - Baseline phase (30s countdown)
  - Stimulation phase (30s countdown + audio playback)
  - Progress indicator

### Analysis Page
- [ ] **HSV-AN01**: Build Analysis page (`analyze.html`) - currently placeholder
  - Data loader component
  - Session data visualization

---

## PENDING

### Test Execution Flow (continued)
- [ ] **HSV-T10**: Build `TrialTagsSurvey` component (full-screen multi-select, 20 tags)
  - Custom free-text tag input
  - Require at least one selection
  - Audio replay button during survey
- [ ] **HSV-T11**: Build `CheckpointScreen` (researcher-controlled pause between trials)
  - Show trial progress, next pattern name
  - "Continue to Next Test" button + Enter key shortcut
- [ ] **HSV-T12**: Implement audio looping logic for stimulation phase
  - Seamless loop for patterns < 30s
  - 5s fade-out + cut for patterns > 30s
  - Track `audio_time_offset`
  - 5 retry attempts on audio failure
- [ ] **HSV-T13**: Build `EEGDataCollector` module (dummy data initially)
  - Buffer readings in memory
  - Tag readings with phase / trial info
  - Simulate realistic EEG frequency band values
- [ ] **HSV-T14**: Implement session initialization UI
  - Participant name (required), auto-generated UUID
  - Researcher name dropdown (pandji, noah, jonathan, long)
  - Computer identifier dropdown
  - Auto-capture browser / hardware info
- [ ] **HSV-T15**: Implement ABORT functionality
  - Abort mid-baseline: discard all data
  - Abort mid-stimulation: save baseline + partial data, flag as "aborted"
- [ ] **HSV-T16**: Implement session data persistence (localStorage, structured for future API)
- [ ] **HSV-T17**: End-to-end test of complete test flow (calibration -> trials -> survey -> checkpoint -> completion)

### OpenBCI Ganglion Integration
- [ ] **HSV-EEG01**: Test `ganglion-ble` library with actual Ganglion device
- [ ] **HSV-EEG02**: Port PSD calculation (Welch's method) to JavaScript
  - FFT library selection (`fft.js` or `dsp.js` or Web Audio API)
  - Band power calculation (trapezoidal integration)
- [ ] **HSV-EEG03**: Implement real device connection (Web Bluetooth or Python backend fallback)
- [ ] **HSV-EEG04**: Replace mock data in `SignalQualityVisualizer` with real device data
- [ ] **HSV-EEG05**: Design UX for null/dropped EEG connection during test flow
- [ ] **HSV-EEG06**: Integrate signal quality monitoring into test execution flow
- [ ] **HSV-EEG07**: Get answers from collaborator on technical questions (Q1-Q11)

### Analysis Page
- [ ] **HSV-AN02**: Design analysis page layout and data visualizations
- [ ] **HSV-AN03**: Build session browser / data loader
- [ ] **HSV-AN04**: Build EEG data visualization (frequency band charts, before/after comparisons)
- [ ] **HSV-AN05**: Build survey response aggregation view
- [ ] **HSV-AN06**: Implement data export (CSV / JSON)

### Infrastructure & Polish
- [ ] **HSV-I01**: Migrate from global classes to ES6 modules
- [ ] **HSV-I02**: Build backend API (replace localStorage with database)
- [ ] **HSV-I03**: Implement database schema (MySQL, as designed in `database_schema.txt`)
- [ ] **HSV-I04**: Add HTTPS support (required for Web Bluetooth)
- [ ] **HSV-I05**: Cross-browser testing (Chrome/Edge focus for Web Bluetooth)
- [ ] **HSV-I06**: Error handling audit across all components

### Conference Presentation
- [ ] **HSV-P01**: Prepare conference presentation (see `docs/CONFERENCE_PRESENTATION.md`)
- [ ] **HSV-P02**: Capture screenshots and screen recordings of all modes
- [ ] **HSV-P03**: Create system architecture diagram
- [ ] **HSV-P04**: Record demo video of full test execution flow

---

## Labels for Linear

| Label | Description |
|-------|-------------|
| `component` | UI component work |
| `module` | Non-UI logic / module work |
| `eeg` | OpenBCI Ganglion / EEG integration |
| `test-flow` | Test execution flow |
| `analysis` | Analysis page |
| `infra` | Infrastructure, backend, deployment |
| `docs` | Documentation |
| `presentation` | Conference presentation prep |

---

## Priority Guide

| Priority | Scope |
|----------|-------|
| **Urgent** | HSV-T08, HSV-T09 (test execution MVP) |
| **High** | HSV-T10 - HSV-T17 (complete test flow) |
| **Medium** | HSV-AN01 - AN06 (analysis page), HSV-EEG01 - EEG07 (device integration) |
| **Low** | HSV-I01 - I06 (infrastructure), HSV-P01 - P04 (presentation) |

---

## Docs Inventory

### Active (in `docs/`)
| File | Purpose | Status |
|------|---------|--------|
| `COMPONENT_ORGANIZATION.md` | Component architecture guide | Reference |
| `CONTRIBUTING.md` | Development workflow guide | Reference |
| `database_schema.txt` | MySQL schema design | Reference |
| `METADATA_GENERATION.md` | Audio metadata generation guide | Reference |
| `OPENBCI_GANGLION_INTEGRATION_PLAN.md` | Ganglion integration plan | In Progress |
| `SIGNAL_QUALITY_IMPLEMENTATION_SUMMARY.md` | Signal quality widget API reference | Reference |
| `TECHNOLOGY_RESEARCH.md` | Browser EEG integration research | Reference |
| `TEST_EXECUTION_FLOW_DESIGN.md` | Test execution flow design | In Progress |
| `TESTING_PROTOCOL.md` | End-to-end testing protocol | In Progress |
| `TASKS.md` | This file - master task tracker | Active |
| `CONFERENCE_PRESENTATION.md` | Conference presentation outline | Active |

### Archived (in `docs/archive/`)
Superseded or completed planning documents. Kept for historical reference.
