# Architecture

Vanilla JS frontend (no build step, global classes loaded via ordered `<script>` tags) + two Python services.

## Pages

| Page | Purpose | Page logic |
|------|---------|------------|
| `index.html` (Explore) | Browse/filter the pattern library, preview audio, p5.js visualizer | `js/app/` |
| `test.html` (Test) | Build a pattern queue, enter session metadata, run calibration → baseline → stimulation → 12-step survey per trial, collect EEG over WebSocket | `js/test/` |
| `analyze.html` (Analyze) | Load the session corpus, chart EEG/survey aggregates, tag patterns (Neutral/Attentive/Disruptive + custom), annotate and exclude trials | `js/analyze/` |

## Services

- `server.py` — `http.server`-based static file server + JSON API + SQLite persistence (port 8000). See the endpoint table in the root README.
- `eeg_server.py` — WebSocket EEG stream on `ws://localhost:8765` (OpenBCI Ganglion via brainflow, or `--mock`).
- `run_servers.py` — starts both.

## Frontend layout

```text
js/
|- components/base/      # standalone UI components (one class per file)
|- components/variants/  # composed variants (e.g. patternExplorerWithSelection)
|- modules/              # non-UI logic shared across pages (see js/modules/README.md)
|- app/                  # Explore page wiring (state, explorer, dataLoaders, bootstrap)
|- test/                 # Test page wiring (state, dataAndComponents, testExecution,
|                        #   sessionPersistence, signalQuality, bootstrap)
|- analyze/              # Analyze page wiring (constants, config, state, app, bootstrap)
|- theme.js / icons.js / uiHelpers.js / dataCache.js / appNav.js  # shared chrome
css/
|- design-tokens.css     # tokens (load first)
|- chrome.css            # shared app chrome
|- pages/                # per-page layout
|- components/           # per-component styles (base/ and variants/)
dev/                     # standalone example pages for components/modules
```

Conventions:

- Components are global classes (`class Foo`) instantiated by page bootstrap scripts; script order in each HTML file matters.
- Components render with template strings into a container element; non-UI logic lives in `js/modules/`.
- Page state is held in plain objects in each page's `state.js`; cross-component communication is via constructor callbacks.

## Data flow

- Test sessions are held in memory (`js/modules/testSession.js`) while running; on completion/abort the persistable trials are saved to `localStorage['sessions']` and `POST /api/session`.
- Analyze fetches the entire corpus from `GET /api/analysis/sessions` (cached 60 s by `js/dataCache.js`) and aggregates client-side in `js/modules/analysisDataProcessor.js`.
- Survey taxonomy is defined twice on purpose: `js/modules/surveyTaxonomy.js` (frontend) and `survey_taxonomy.py` (backend validation) — keep them in sync.

## Database

SQLite, `haptic_research_v2.db`, schema in `schema_v2.sql` (see root README and
`docs/SURVEY_V2_MIGRATION.md`). All writes go through `db_handler.py`.

Historical plan documents for this architecture live in `docs/archive/`
(`COMPONENT_ARCHITECTURE.md`, `COMPONENT_ORGANIZATION.md`).
