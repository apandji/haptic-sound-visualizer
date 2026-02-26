# Project Diary — Haptic Sound Visualizer

**Purpose:** Source material for a UX case study. Organized by topic, capturing learnings, challenges, design decisions, and pivots across the project.

**Project span:** January 27 – February 10, 2026 (ongoing)

---

## 1. The Problem Space

### What we're trying to solve
There's no standardized tool for correlating subjective haptic experiences with objective brainwave data. Haptic audio — sound designed to be *felt* through a Woojer vest, not just heard — is an emerging modality with no visual representation. Researchers have a library of 378 audio patterns and no way to browse, test, or analyze them systematically.

### Who this is for
- **Primary:** A small research team (4 people: Pandji, Noah, Jonathan, Long) running controlled EEG experiments with participants wearing a Woojer vest.
- **Secondary:** Conference audiences who need to *see* what haptic patterns look like, since they can't feel them through a screen.

### The dual identity problem
The tool has to serve two very different contexts: a live research instrument (running experiments, collecting EEG data, managing sessions) and a presentation/communication tool (visualizing patterns for conference demos). These contexts pull the design in different directions — the research tool needs precision, control, and data integrity; the demo tool needs visual appeal and simplicity. We've had to navigate this tension throughout.

---

## 2. Architecture & Technical Stack

### Why vanilla JavaScript
We chose pure HTML/CSS/JavaScript with p5.js over React, Vue, or Streamlit. The rationale: simplest path to p5.js integration, no build step, runs on any lab computer without setup, and deploys to GitHub Pages as static files. The trade-off is that we lose framework-level state management and component lifecycle — things that became painful as the app grew in complexity.

### The monolith-to-components migration
The project started as a single `app.js` file (~2,500 lines) powering one `index.html`. This was fine for an MVP visualizer but became unmanageable once we needed three distinct modes (Library, Test, Analysis). The migration happened in a single intense day (Feb 3, 2026 — 12 commits) and involved:

- Extracting a component-based architecture from the monolith
- Creating a `base / variants / modules` directory structure
- Building reusable components: `PatternExplorer`, `FilterPanel`, `DualSlider`, `Visualizer`, `AudioControls`, `PatternQueue`
- Creating "variant" components that compose base components for specific use cases (e.g., `PatternExplorerWithFilters` for the Library page, `PatternExplorerWithSelection` for the Test page)

**Key learning:** Doing this refactor *before* building the Test page was the right call. The component architecture made it possible to reuse the pattern browser in two different contexts with different behaviors (browse-and-play vs. select-and-queue). If we'd built the Test page on top of the monolith, we'd have been forced to refactor later under more pressure.

**Challenge:** Without ES6 modules (we use global classes loaded via `<script>` tags), dependency management is manual and fragile. We've flagged migration to ES6 modules as a future task, but it hasn't been urgent enough to prioritize.

### Three-mode application structure
The app is organized into three pages/modes, each with a distinct purpose:
- **Library** (`index.html`) — Browse, filter, play, and visualize patterns
- **Test** (`test.html`) — Build a queue, configure a session, run the experiment
- **Analysis** (`analyze.html`) — Review collected data (still a placeholder)

This maps cleanly to the research workflow: explore patterns → run experiment → analyze results. The separation also lets us think about each context's UX independently.

---

## 3. Designing the Pattern Library

### Making the invisible visible
The core UX challenge of the Library page: haptic patterns are audio files, and audio is invisible. We needed to give researchers a way to quickly understand what a pattern "does" without playing every single file. We approached this from two angles:

1. **Metadata extraction** — A Python script (`generate_metadata.py`) analyzes every audio file and extracts: RMS amplitude, duration, stereo balance, and stereo movement. These become filterable properties.
2. **Real-time visualization** — 8 visualization modes (waveform, intensity bars, stereo field, frequency spectrum, directional pulses, liquid blob, particle swarm, frequency terrain) give different perspectives on the same audio.

### Smart filtering as a research tool
The filter system uses dual-handle range sliders for continuous properties (RMS, duration, stereo balance, stereo movement) plus text search. This lets researchers do things like "show me all short, high-intensity patterns with strong stereo movement" — a query that would be impossible by just browsing filenames.

**Design decision:** We extracted the filter logic into pure functions (`js/modules/filters.js`) separate from the UI, so the same filtering can be applied in different contexts. The `FilterPanel` component is purely UI; the actual filtering is context-independent.

**Future direction:** Could we use natural language so that researchers can quickly type in "short, high-intensoty" or even, once patterns are tagged, "calming" and surface patterns for use in research or in a use case-based application.

### Collapsible filters
We debated three approaches for the filter panel: always visible, collapsible, or hidden behind a button. We went with collapsible (default collapsed) using +/− icons in a brutalist style. The reasoning: filters are powerful but not used on every visit. Collapsing them gives more vertical space for the file list, which is the primary interaction surface.

### Brutalist aesthetic
The UI uses a clean, light design with monospace typography — deliberate aesthetic choices. No rounded corners, minimal color, sharp edges. This serves the conference demo context (projects well, looks professional and distinctive) and the research context (information-dense, no decoration competing with data).

---

## 4. Audio Playback Challenges

### The p5.js audio integration
Audio is central to the entire application, and it was the source of the most painful bugs. We use p5.js's `p5.SoundFile` for playback and `p5.FFT` for real-time frequency analysis that drives the visualizations.

### The mode-scaffolding audio breakage
When we introduced the three-mode architecture (Library/Test/Analysis), audio playback completely broke. The root cause: p5.js sketch initialization timing. In the monolith, the p5 container always existed on page load. In the multi-mode version, containers were created dynamically, and the p5 sketch tried to initialize before its container was ready.

This consumed significant debugging time. We created a backup branch (`backup/audio-fixes-attempt-2026-01-28`) documenting the failed attempts. The fix eventually came during the Feb 3 component refactor, where we restructured initialization order and ensured the p5 container existed before sketch creation.

**Key learning:** p5.js makes assumptions about DOM availability that don't play well with dynamic page structures. Any future refactoring needs to respect the p5.js lifecycle.

### GitHub Pages audio path issues
When deploying to GitHub Pages, all audio paths broke because they were absolute (`/audio_files/...`). The fix was simple (switch to relative paths) but highlighted how deployment context affects seemingly trivial decisions.

### Audio looping for the test protocol
The testing protocol requires 30-second stimulation phases. This creates two edge cases:
- **Pattern < 30s:** Must loop seamlessly with no gaps
- **Pattern > 30s:** Must fade out over 5 seconds starting at the 25s mark, then cut at 30s

This is still pending implementation and represents a non-trivial audio engineering challenge in the browser. p5.sound's built-in looping may have micro-gaps; we may need to use the Web Audio API's `GainNode` directly for the fade-out.

---

## 5. Designing the Research Protocol

### The test execution flow
This is the most complex piece of UX in the project. A single test session involves:

1. **Calibration** (20s) — Blank screen, collecting baseline EEG
2. **Per-pattern trial loop:**
   - Baseline phase (30s silence, EEG recording)
   - Stimulation phase (30s audio looping, EEG recording)
   - Survey (participant selects perceptual tags)
   - Checkpoint (researcher-controlled pause)
3. **Session completion** — Summary, data saved

Every phase has error handling requirements (audio failure retries, EEG disconnection logging, abort logic) and data integrity constraints (what to save if a trial is aborted mid-baseline vs. mid-stimulation).

### Researcher vs. participant: the single-screen problem
The researcher and participant are in the same room, sharing one computer. During setup, the researcher controls everything. During the trial, the participant shouldn't see the researcher's controls. During the survey, the participant needs to interact with the screen directly.

We solved this with a full-screen overlay approach: the test execution takes over the entire screen, showing only what the participant needs to see (countdown, survey). The researcher manages screen positioning physically. We discussed building a separate "Participant View" mode but decided screen positioning was sufficient for the current lab setup.

**Open question:** This works for a 4-person team in a single lab, but doesn't scale. If the tool were used by other research groups, a dual-screen or separate-device approach would be needed.

### Queue-first workflow
A deliberate UX decision: the pattern queue must be built *before* starting a session, and cannot be modified mid-session. This trades flexibility for data integrity — if the queue could change during a session, it would complicate the data model and create opportunities for researcher error. The queue is immutable once the session begins.

### Session initialization
We capture a mix of auto-detected and manually-entered metadata:
- **Auto-captured:** Browser info, platform, OS, screen resolution, CPU cores, RAM
- **Manual entry:** Participant name, researcher name (dropdown of 4 team members), computer identifier (dropdown, defaults to lab's primary iMac)
- **Auto-generated:** Session ID (UUID), participant ID (UUID to handle duplicate names)

The researcher dropdown is hardcoded to four names — a pragmatic decision for a small team. The computer dropdown exists because the team might run sessions on different lab machines and needs to track which hardware was used.

---

## 6. Survey Design — Balancing Science and UX

### From 4 options to 20 tags
The survey went through a major evolution. Initially it was conceived as a simple A/B/C/D multiple choice. It evolved into a 20-tag multi-select system across 7 perceptual dimensions.

### Tag selection criteria
Each tag was chosen to satisfy two constraints simultaneously:
1. **Pattern coverage** — Does this tag meaningfully describe the haptic/audio patterns in the library?
2. **EEG band correlation** — Does this subjective state have established associations with specific brainwave frequency bands?

For example, "Calming" maps to the Alpha band, "Focused" maps to Low Beta/Gamma, "Dreamy" maps to Theta. This dual purpose is the project's novel research contribution: if participants report feeling "Calming" and their Alpha band activity increases during that pattern, that's a meaningful correlation.

### The 7 dimensions
Tags are organized into: Valence (pleasant/unsettling), Arousal (calming/energizing/tense/chaotic), Texture (sharp/smooth), Temporal (rhythmic/pulsing), Weight (heavy/light), Sensation (warm/tingling), Cognitive (focused/dreamy/drowsy/hypnotic), and Spatial (expansive/grounding).

### Survey UX decisions
- **Full-screen overlay** — Prevents participant from seeing researcher controls
- **Button-based multi-select** — Not checkboxes, not radio buttons. Buttons feel more tactile and are easier to tap
- **Minimum one selection required** — Can't skip the survey entirely
- **Custom free-text tags** — Participants can add their own descriptors beyond the 20 provided
- **Audio replay available** — Participant can re-listen to the pattern during the survey

### Configurable tags
Tags are loaded from `trialTagsConfig.json`, not hardcoded. This means the research team can adjust the tag set between studies without code changes — an important research tool flexibility.

**Unresolved:** Should tag order be randomized per trial to avoid order effects? Should there be a time limit on the survey? These are research methodology questions that affect UX.

---

## 7. EEG Hardware Integration

### The technology research process
We evaluated four approaches for connecting an OpenBCI Ganglion (4-channel EEG, 200Hz) to the browser:

1. **Web Bluetooth API** (recommended) — Direct browser connection, no backend, but Chrome/Edge only and requires HTTPS
2. **Web Serial API** — Uncertain compatibility with Bluetooth devices
3. **BrainFlow JavaScript/WebAssembly** — Doesn't exist (dead end)
4. **Python backend + WebSocket** — Works everywhere but adds infrastructure complexity

We recommended Web Bluetooth as the primary approach with Python backend as fallback.

### The archived library problem
The most promising JavaScript library for Ganglion connection (`ganglion-ble` by Neurosity) has been archived since July 2020. It's functional but unmaintained. This is a real risk — we may need to fork and maintain it ourselves, or discover it doesn't work with newer browser versions.

### Signal quality monitoring
We built a signal quality widget (Intercom-style floating component) that classifies each EEG channel as good/ok/poor based on RMS amplitude and 60Hz noise detection. The quality thresholds match a collaborator's Python reference implementation (`signal_quality.py`), ensuring consistency between the browser-based monitoring and the team's existing analysis tools.

### Starting with mock data
A pragmatic decision: build the entire test flow with simulated EEG data first, then swap in real device data later. This let us design and test the research protocol UX without waiting for hardware integration. The `EEGDataCollector` module abstracts data collection behind an interface that works identically with mock or real data.

---

## 8. Scope Management & Pragmatic Trade-offs

### Plan vs. reality in the component phases
The original plan called for five separate phases with distinct modules:
- Phase 1: FilterPanel component
- Phase 2: Audio visualization components
- Phase 3: SelectionManager module
- Phase 4: DragDropManager module
- Phase 5: PatternExplorerTestMode variant

In practice, Phases 3–5 collapsed into a single integrated variant (`PatternExplorerWithSelection`). The separate module architecture was over-engineered for the actual use case. Selection is a one-click toggle (not shift+click multi-select), and drag-and-drop only exists for queue reordering (not for dragging from the explorer to the queue).

**Key learning:** We documented the deviation explicitly rather than pretending the plan was followed. The `PHASE_3_4_5_REVIEW.md` file captures what was planned, what was built, and why the difference was acceptable. This transparency is useful for the team and for anyone reviewing the project later.

### What we deliberately cut
The PRD listed many features that we haven't built and may never build:
- Drag-and-drop file upload (we pre-load a fixed library)
- Audio editing capabilities
- Export visualization as image/video
- Dark theme
- Mobile support
- Comparison mode (side-by-side files)
- Fullscreen presentation mode

These were all reasonable features but outside the critical path for the research use case. The conference presentation need is served by the visualizations themselves; the research need is served by the test protocol.

### localStorage as a deliberate constraint
All session data is stored in `localStorage` — a 5–10MB limit that won't hold large EEG datasets long-term. This is a conscious trade-off: it lets us build and test the full flow without backend infrastructure. The data structures are designed to be API-compatible so migration to a real database (MySQL, as designed in `database_schema.txt`) is straightforward when the time comes.

---

## 9. Process & Collaboration

### Documentation-driven development
This project has unusually thorough documentation for its size. Before building major features, we wrote design documents (`TEST_EXECUTION_FLOW_DESIGN.md`, `TESTING_PROTOCOL.md`, `TECHNOLOGY_RESEARCH.md`) that surfaced questions and forced decisions. Many of these documents contain resolved questions with decision timestamps — a form of architectural decision records.

### The critical questions pattern
For the test protocol, we identified 12+ critical questions that blocked implementation (survey options, completion detection, skip handling, queue modification rules, etc.). These were tracked in `CRITICAL_QUESTIONS.md` with explicit status markers. This prevented building on assumptions and forced the team to align before code was written.

### Branch strategy
The project uses feature branches that map to major workstreams:
- `master` — Stable, deployed
- `feature/mode-scaffolding` — Three-mode architecture (merged into later branches)
- `feature/library-page` — Library page components
- `feature/testing-page` — Test setup page
- `feature/analysis` — Current working branch (analysis page + ongoing work)

### Archiving over deleting
Superseded documentation goes to `docs/archive/` rather than being deleted. This preserves the decision history — you can see what was considered, what was rejected, and why. For a case study, this trail of thinking is more valuable than just the final state.

---

## 10. Open Challenges & Future Directions

### The analysis page gap
The Analysis page (`analyze.html`) is still a placeholder. This is the final piece of the research workflow and arguably the most important for the research team's day-to-day use. It needs: session browsing, EEG data visualization (frequency band charts, before/after comparisons), survey response aggregation, and data export (CSV/JSON).

### Real device integration
No one has tested the `ganglion-ble` library with an actual Ganglion device in the browser yet. This is the single biggest technical risk. If Web Bluetooth doesn't work reliably, we fall back to a Python backend + WebSocket architecture, which changes the deployment story significantly (no longer pure static hosting).

### Test execution flow completion
The test execution overlay (calibration → baseline → stimulation → survey → checkpoint loop) is designed but not fully implemented. The `TestSession` module and `TestExecutionOverlay` component are the current priority. This is the feature that turns the tool from a nice visualizer into an actual research instrument.

### ES6 module migration
The global-class-via-script-tag approach has reached its ergonomic limit. As the codebase grows, dependency order in HTML files becomes increasingly fragile. Migration to ES6 modules would bring proper imports, better tooling support, and clearer dependency graphs.

### Scaling beyond one lab
The current design assumes one room, one computer, one researcher, one participant. Supporting multiple research sites would require: a real backend, user accounts, data synchronization, and possibly a separate participant-facing interface (tablet app or second-screen web view).

---

## 11. Key Takeaways for a UX Case Study

1. **Dual-audience tools need explicit mode separation.** The Library/Test/Analysis split wasn't just organizational — it was a UX necessity. Researchers browsing patterns have completely different goals and mental models than researchers running an experiment.

2. **Hardware constraints shape software UX.** The single-screen constraint (researcher and participant sharing one display) directly drove the full-screen overlay approach, the survey button design, and the checkpoint flow.

3. **Research protocol design is UX design.** Decisions about phase durations, survey tag selection, abort handling, and data integrity are all user experience decisions. They determine whether the tool produces good data and whether researchers trust it.

4. **Start with mock data, not real hardware.** Building the EEG data flow with simulated data let us iterate on the protocol UX without waiting for hardware. The abstraction layer means swapping in real data later is a module-level change, not a redesign.

5. **Document deviations, not just plans.** The most useful documentation in this project isn't the original plans — it's the documents that explain *why* the implementation diverged from the plan and why that was OK.

6. **Brutalist aesthetics can be functional.** The monospace, no-decoration design isn't just a style choice — it prioritizes information density and legibility on projector screens, which matters for both the research and conference contexts.

7. **Vanilla JS component architecture is possible but has a ceiling.** We proved you can build a component-based system without React/Vue, but the manual wiring (no virtual DOM, no reactive state, no module system) becomes increasingly costly as complexity grows. For a research tool with a small team, the simplicity trade-off was worth it. For a product, it probably wouldn't be.
