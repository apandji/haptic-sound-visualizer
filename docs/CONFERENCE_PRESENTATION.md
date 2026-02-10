# Conference Presentation - Haptic Sound Visualizer

**Status**: Draft  
**Last Updated**: February 8, 2026

---

## Presentation Outline

### 1. Introduction & Motivation (3-5 min)
- **The question**: Can haptic sound patterns produce measurable neurological responses?
- **Context**: Haptic audio as an emerging modality - audio designed to be *felt*, not just heard
- **Gap**: No standardized tool exists for correlating subjective haptic experiences with objective brainwave data
- **What we built**: A web-based research platform for running controlled EEG experiments with haptic audio patterns

### 2. The Pattern Library (3-4 min)
- **378 haptic sound patterns** - a curated library of audio files designed for haptic research
- **Automated metadata extraction**: RMS amplitude, duration, stereo balance, stereo movement
- **Smart filtering**: Researchers can browse, search, and filter patterns by acoustic properties
- **8 real-time visualization modes**: Waveform, intensity, stereo, spectrum, pulses, blob, particles, landscape
- **Demo**: Walk through the Library page - selecting a pattern, visualizing it, filtering

### 3. System Architecture (3-4 min)
- **Vanilla JavaScript, component-based**: No framework dependencies, modular design
- **Component hierarchy**: Base components, composed variants, non-UI modules
- **Three-mode application**: Library (browse) -> Test (experiment) -> Analysis (results)
- **Why web-based**: Accessibility, no installation, runs on any lab computer, Web Bluetooth for EEG devices
- **Diagram**: Show system architecture with component relationships

### 4. The Test Protocol (5-7 min)
- **Experimental design**:
  - 20-second calibration period (baseline EEG)
  - Per-pattern trial: 30s baseline (silence) + 30s stimulation (audio looping)
  - Researcher-controlled checkpoints between trials
  - Post-trial survey with 20 tags across 7 perceptual dimensions
- **Survey tag design**: Tags chosen for both pattern coverage AND EEG band correlation
  - Example: "Calming" -> Alpha band, "Focused" -> Low Beta/Gamma, "Dreamy" -> Theta
- **Session management**: Participant info, researcher selection, auto-captured hardware metadata
- **Demo**: Walk through the Test Setup page - building a queue, configuring session

### 5. EEG Integration (3-4 min)
- **OpenBCI Ganglion**: 4-channel EEG, 200 Hz sampling rate
- **Signal quality monitoring**: Real-time widget (Intercom-style) showing per-channel quality
  - RMS amplitude, 60Hz noise detection, good/ok/poor classification
  - Matches Python reference implementation thresholds
- **Connection approach**: Web Bluetooth API for direct browser connection (no backend)
  - Fallback: Python backend + WebSocket
- **Quality thresholds**: Based on collaborator's `signal_quality.py` implementation
- **Demo**: Show the Signal Quality Visualizer component (mock data demo)

### 6. Data Model & Analysis (3-4 min)
- **Database schema**: Participants, sessions, trials, brainwave readings, survey tags
- **Data collected per trial**:
  - EEG readings tagged by phase (calibration / baseline / stimulation)
  - Audio synchronization via `audio_time_offset`
  - Subjective survey responses (multi-select tags + free text)
- **Analysis potential**:
  - Compare baseline vs stimulation EEG across frequency bands
  - Correlate subjective tags with brainwave patterns
  - Identify patterns that produce strongest/most consistent responses
  - Cross-participant analysis

### 7. Challenges & Lessons Learned (2-3 min)
- **Web Bluetooth limitations**: Chrome/Edge only, HTTPS required, archived libraries
- **Real-time signal processing in browser**: PSD calculation, FFT, Welch's method in JavaScript
- **Experimental design trade-offs**: 30s phase duration, seamless audio looping, survey fatigue
- **Component architecture without frameworks**: Benefits and costs of vanilla JS

### 8. Future Work (2-3 min)
- **Complete test execution flow** (in progress)
- **Real device integration** - connecting actual Ganglion hardware
- **Analysis dashboard** - visualizing collected data, cross-session comparisons
- **Backend API & database** - moving from localStorage to persistent storage
- **Multi-site support** - enabling remote research sessions
- **Open-sourcing** the platform for other haptic audio researchers

### 9. Q&A (5 min)

---

## Artifacts to Gather

### Screenshots

| # | Screenshot | Source | Notes |
|---|-----------|--------|-------|
| 1 | **Library page - full view** | `http://localhost:8000/index.html` | Show pattern list, visualizer, filters, audio controls |
| 2 | **Library page - visualization modes** | Library page | Capture 3-4 different visualization modes (waveform, spectrum, blob, particles) |
| 3 | **Library page - filter panel active** | Library page | Show filters narrowing down pattern list |
| 4 | **Test Setup page - empty state** | `http://localhost:8000/test.html` | Show the setup interface before queue is populated |
| 5 | **Test Setup page - populated queue** | Test page | Show patterns added to queue with metadata |
| 6 | **Signal Quality Widget - expanded** | `http://localhost:8000/dev/components-examples/signal-quality-visualizer.example.html` | Show all 4 channels with quality indicators |
| 7 | **Signal Quality Widget - minimized** | Signal quality example | Show the Intercom-style collapsed button |
| 8 | **Signal Quality Widget - error state** | Signal quality example | Show error/disconnected state |
| 9 | **Analysis page** | `http://localhost:8000/analyze.html` | Current state (even if placeholder) |
| 10 | **Component examples** | `http://localhost:8000/dev/components-examples/` | Show individual component isolation |
| 11 | **Pattern Explorer with filters** | Filter panel example | Show dual sliders in action |
| 12 | **Survey tag design** | Create from `TESTING_PROTOCOL.md` tag table | Table showing 20 tags, dimensions, and EEG band probes |

### Screen Recordings / Video

| # | Recording | Duration | Notes |
|---|-----------|----------|-------|
| 1 | **Library page walkthrough** | 30-60s | Browse patterns, play audio, switch visualization modes, use filters |
| 2 | **Test Setup flow** | 30-60s | Add patterns to queue, reorder, see session time estimate |
| 3 | **Signal Quality Widget demo** | 30s | Connect, show real-time updates, expand/collapse, change channels |
| 4 | **Full demo** (if test flow is ready) | 2-3 min | End-to-end: queue -> start session -> calibration -> baseline -> stimulation -> survey -> checkpoint |
| 5 | **Visualization modes montage** | 30s | Quick cuts between all 8 visualization modes with audio playing |

### Diagrams to Create

| # | Diagram | Description |
|---|---------|-------------|
| 1 | **System Architecture** | High-level: Browser app -> three modes -> components / modules. Show Library, Test, Analysis pages and their components |
| 2 | **Component Hierarchy** | Base components -> Variants -> Pages. Show how PatternExplorer, FilterPanel, etc. compose together |
| 3 | **Test Protocol Flow** | Flowchart: Queue setup -> Calibration -> [Baseline -> Stimulation -> Survey -> Checkpoint] x N -> Session Complete |
| 4 | **Data Flow** | EEG Device -> Signal Quality -> EEG Data Collector -> Test Session -> Database. Show data pipeline |
| 5 | **EEG Integration Options** | Decision tree: Web Bluetooth vs Web Serial vs BrainFlow vs Python Backend |
| 6 | **Survey Tag Mapping** | Visual showing 20 tags organized by dimension, with EEG band correlations highlighted |
| 7 | **Database ER Diagram** | From `database_schema.txt`: participants, sessions, trials, brainwave_readings, tags |

### Data / Tables for Slides

| # | Data | Source |
|---|------|--------|
| 1 | **Pattern library stats** | `pattern_metadata.json` - count, duration range, RMS range, stereo metrics |
| 2 | **Survey tags table** | `TESTING_PROTOCOL.md` - 20 tags x 7 dimensions x EEG band probes |
| 3 | **Signal quality thresholds** | Good/OK/Poor thresholds from `signal_quality.py` |
| 4 | **Technology comparison** | Web Bluetooth vs Backend approach (from `TECHNOLOGY_RESEARCH.md`) |
| 5 | **Test timing breakdown** | Calibration (20s) + N x [Baseline (30s) + Stimulation (30s) + Survey + Checkpoint] |

### Code Snippets for Slides (if applicable)

| # | Snippet | Purpose |
|---|---------|---------|
| 1 | Component constructor pattern | Show the component API design pattern |
| 2 | Signal quality classification | Show the quality threshold logic (JS matching Python) |
| 3 | Web Bluetooth connection | Show how simple the Ganglion connection API is |
| 4 | Survey tag config JSON | Show the configurable tag system |

---

## Presentation Tips

- **Lead with the research question**, not the technology
- **Show the visualizations early** - they're visually compelling and capture attention
- **Emphasize the correlation angle** - subjective tags mapped to EEG bands is the novel contribution
- **Demo over slides** - the live app is more impressive than screenshots
- **Acknowledge the status** - be transparent about what's built vs in-progress vs planned
- **Target audience consideration** - adjust technical depth based on whether audience is HCI, neuroscience, or engineering

---

## Estimated Presentation Length

| Section | Minutes |
|---------|---------|
| Introduction & Motivation | 3-5 |
| Pattern Library | 3-4 |
| System Architecture | 3-4 |
| Test Protocol | 5-7 |
| EEG Integration | 3-4 |
| Data Model & Analysis | 3-4 |
| Challenges & Lessons | 2-3 |
| Future Work | 2-3 |
| Q&A | 5 |
| **Total** | **~30 min** |

Adjust sections based on conference time slot (15 min, 20 min, or 30 min format).
