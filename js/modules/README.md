# Modules

Non-UI logic shared across pages. Modules are global classes/objects loaded via `<script>` tags (no build step); some also export via `module.exports` for standalone testing.

| Module | Purpose | Used by |
|--------|---------|---------|
| `filters.js` | Pure filter logic for the pattern library (search, metadata ranges) | Explore, Test |
| `audioPlayer.js` | Audio playback wrapper around p5.SoundFile (loop, duration caps) | Explore, Test |
| `testSession.js` | In-memory state machine for a running test session (trials, phases, readings, abort) | Test |
| `eegDataCollector.js` | WebSocket client for `eeg_server.py`; collects band-power readings per phase | Test |
| `eegQualityConfig.js` | Channel-quality thresholds used by the calibration gate | Test |
| `sessionTimeEstimator.js` | Session duration estimate from pattern count; reads `sessionTimingConfig.json`, prefers empirical `/api/timing-stats` | Test |
| `surveyTaxonomy.js` | Binary action pairs, vibe pairs, action and emotion options for the v2 survey. Python mirror: `survey_taxonomy.py` (keep in sync) | Test, Analyze |
| `analysisDataProcessor.js` | Pure aggregation of the session corpus for the Analyze dashboard (filters, per-pattern stats, trial details, EEG deltas) | Analyze |

Config: `sessionTimingConfig.json` — calibration/baseline/stimulation durations (seconds) and survey-duration estimates used for setup and in-session ETAs.

Examples for some modules live in `dev/modules-examples/`.

## Adding a new module

1. Create `moduleName.js` with a single class or function group; keep DOM access out.
2. Add a `<script>` tag to the page(s) that need it (order matters).
3. Document it in the table above.
