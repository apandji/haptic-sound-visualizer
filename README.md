# Haptic Sound Visualizer

Research web app for exploring haptic audio patterns, running EEG test sessions, and analyzing results.

It is a vanilla JS frontend (no build step) plus Python services:
- `server.py`: static file + REST API + SQLite persistence
- `eeg_server.py`: WebSocket EEG stream (OpenBCI Ganglion or mock mode)
- `run_servers.py`: starts both together

## What Is In This Repo

- **Explore page** (`index.html`)
  - Browse and filter pattern library
  - Preview files
  - Visualize audio in multiple modes (p5.js)
- **Test page** (`test.html`)
  - Build/reorder a pattern queue
  - Enter session metadata
  - Run calibration -> baseline -> stimulation -> survey flow
  - Collect EEG readings via WebSocket
  - Save sessions to `localStorage` and SQLite API
- **Analyze page** (`analyze.html`)
  - Load sessions from database or browser storage
  - Compare patterns with charts (Plotly)
  - Inspect band-power deltas and tag frequency

**Documentation index:** [docs/README.md](docs/README.md) (architecture, protocol, backlog, archive).

## Quick Start (Mock EEG)

1. Install Python dependencies:

```bash
pip install websockets numpy
```

2. Start both services in mock mode:

```bash
python run_servers.py --mock
```

3. Open:
- `http://localhost:8000/index.html` (Explore)
- `http://localhost:8000/test.html` (Test)
- `http://localhost:8000/analyze.html` (Analyze)

## Real EEG Setup (OpenBCI Ganglion)

Install additional dependency:

```bash
pip install brainflow
```

Start services with your dongle port:

```bash
python run_servers.py --port COM5
```

On macOS, start with your serial device path (example):

```bash
python run_servers.py --port /dev/cu.usbserial-XXXX
```

Useful options:

```bash
python run_servers.py --port COM5 --ws-port 8765 --update-interval 0.1 --window-sec 2.0 --quality-channels 1,2,3,4
python eeg_server.py --mock
python eeg_server.py --port COM5
```

## Metadata Generation

If you add or change files in `audio_files/`, regenerate metadata:

```bash
pip install librosa soundfile
python generate_metadata.py           # only missing files
python generate_metadata.py --all     # refresh all
```

This updates `pattern_metadata.json` (with backup).

## Database

- **Active SQLite file:** `haptic_research_v2.db`
- **Schema:** `schema_v2.sql`
- **Init script:** `create_database.py` (creates an empty v2 database)
- **Migration notes:** [docs/SURVEY_V2_MIGRATION.md](docs/SURVEY_V2_MIGRATION.md)
- **Frozen v1 backup:** `backups/haptic_research_frozen_*.db`
- Legacy v1 files (`haptic_research.db`, `schema.sql`) are kept for reference only
- Legacy MySQL-style sketch (ignore): `docs/archive/database_schema.txt`

Initialize (or recreate) an empty v2 database:

```bash
python create_database.py
```

To rebuild v2 from a frozen v1 backup, see the migration doc and `migrate_to_v2.py`.

## Server

```bash
pip3 install -r requirements.txt
python3 server.py
```

Opens at `http://127.0.0.1:8000/`. Auth is **off by default**. To enable WashU Entra RBAC, see [docs/ENTRA_SETUP.md](docs/ENTRA_SETUP.md).

## API Endpoints (`server.py`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/list-audio-files` | Audio files in `audio_files/` |
| GET | `/api/tags` | Survey taxonomy as a flat tag catalog |
| GET | `/api/locations` | All locations |
| GET | `/api/participants` | All participants |
| GET | `/api/survey/custom-actions` | Known custom survey actions (autocomplete) |
| GET | `/api/analysis/pattern-metadata` | Pattern audio metadata for Analyze |
| GET | `/api/analysis/sessions` | Full session corpus for Analyze (`?limit=N` optional) |
| GET | `/api/analysis/tags` | Analyst classification tag vocabulary |
| POST | `/api/analysis/tags` | Create a custom analyst tag |
| GET | `/api/analysis/pattern-tags` | Tag assignments + notes per pattern |
| POST | `/api/analysis/pattern-tags` | Save tags + notes for a pattern |
| POST | `/api/analysis/trials/notes` | Save analyst note on a trial |
| POST | `/api/analysis/trials/exclude` | Exclude/include a trial in analysis |
| GET | `/api/timing-stats` | Empirical session timing stats |
| GET | `/api/pattern-stats` | Per-pattern trial counts for queue weighting |
| GET | `/api/me` | Current user + roles (when auth enabled) |
| GET | `/api/status` | Server status |
| POST | `/api/session` | Save a completed session |
| POST | `/api/sessions/bulk` | Save multiple sessions (localStorage sync) |

The server binds to `127.0.0.1` only. Optional Entra SSO + RBAC (`AUTH_REQUIRED=true`) enforces roles on `/api/*` — see [docs/ENTRA_SETUP.md](docs/ENTRA_SETUP.md).

## Key Config Files

- `js/modules/sessionTimingConfig.json`
  - Calibration, baseline, and stimulation durations (seconds)
  - `taggingDuration` — used by session time estimator (human-readable “~ how long” on setup)
  - `surveyDurationEstimate` — used for **in-session ETA** in the tester control panel (falls back to `taggingDuration` if omitted)
- `js/modules/surveyTaxonomy.js` / `survey_taxonomy.py`
  - Binary action and vibe pair definitions for the post-trial survey (v2)

## Test Session Defaults

Current defaults from code/config (see `sessionTimingConfig.json` for live values):
- Calibration: typically `20s`
- Baseline (per trial): typically `30s`
- Stimulation (per trial): typically `30s`
- Survey/tagging **estimate**: `surveyDurationEstimate` and/or `taggingDuration` (for UI estimates only)

**Calibration gate (channel quality)** on `test.html` uses per-channel metrics (e.g. RMS and 60 Hz relative power) and requires a minimum number of **good** channels before manual start is encouraged; see `js/test/testExecution.js` and the calibration UI copy for the exact thresholds.

## Data Flow and Storage

- During Test sessions, EEG readings stream via WebSocket (`ws://localhost:8765`) and are appended into session/trial objects in memory.
- Session data lives in browser memory during the test; it is written only at session end (or abort with completed trials):
  - Browser backup: `localStorage['sessions']`
  - Server DB: `POST /api/session` → SQLite (`haptic_research_v2.db`)
- Analyze loads the full corpus from the database API (`GET /api/analysis/sessions`) and aggregates client-side (`js/modules/analysisDataProcessor.js`).

## Repository Layout

```text
.
|- index.html / test.html / analyze.html
|- server.py / eeg_server.py / run_servers.py
|- db_handler.py / schema_v2.sql / create_database.py / migrate_to_v2.py
|- generate_metadata.py / signal_quality.py / eeg_quality.py
|- js/components/ (UI components)
|- js/modules/ (non-UI logic)
|- css/components/ (component styles)
|- audio_files/ (pattern assets)
|- docs/ (protocol and architecture notes — see [docs/README.md](docs/README.md))
|- dev/ (component/module example pages)
```

## Notes

- No `requirements.txt` is currently provided; install dependencies manually as above.
- `server.py` runs on port `8000`.
- `eeg_server.py` runs on WebSocket port `8765` by default (binds to localhost).
- The active pattern catalog is `audio_files/` (served via `/api/list-audio-files`); `legacy_audio_files/` holds the retired catalog. The static fallback `audio-files.json` still lists the legacy catalog and is stale.
