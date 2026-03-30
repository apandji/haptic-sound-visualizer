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

- SQLite file: `haptic_research.db`
- Schema file: `schema.sql` (includes `trial_events` for tester markers — apply migrations if upgrading an old DB)
- Init script: `create_database.py`
- Legacy MySQL-style sketch (ignore): `docs/archive/database_schema.txt`

Initialize (or recreate if DB is missing):

```bash
python create_database.py
```

## API Endpoints (`server.py`)

- `GET /api/list-audio-files`
- `GET /api/tags`
- `GET /api/locations`
- `GET /api/participants`
- `GET /api/analysis/sessions`
- `GET /api/status`
- `POST /api/session`
- `POST /api/sessions/bulk`

## Key Config Files

- `js/modules/sessionTimingConfig.json`
  - Calibration, baseline, and stimulation durations (seconds)
  - `taggingDuration` — used by session time estimator (human-readable “~ how long” on setup)
  - `surveyDurationEstimate` — used for **in-session ETA** in the tester control panel (falls back to `taggingDuration` if omitted)
- `js/modules/trialTagsConfig.json`
  - Survey categories/tags shown after each trial

## Test Session Defaults

Current defaults from code/config (see `sessionTimingConfig.json` for live values):
- Calibration: typically `20s`
- Baseline (per trial): typically `30s`
- Stimulation (per trial): typically `30s`
- Survey/tagging **estimate**: `surveyDurationEstimate` and/or `taggingDuration` (for UI estimates only)

**Calibration gate (channel quality)** on `test.html` uses per-channel metrics (e.g. RMS and 60 Hz relative power) and requires a minimum number of **good** channels before manual start is encouraged; see `js/test/testExecution.js` and the calibration UI copy for the exact thresholds.

## Data Flow and Storage

- During Test sessions, EEG readings stream via WebSocket (`ws://localhost:8765`) and are appended into session/trial objects in memory.
- Session save writes:
  - Browser backup: `localStorage['sessions']`
  - Server DB: `POST /api/session` -> SQLite (`haptic_research.db`)
- Analyze mode can load from:
  - Database (`/api/analysis/sessions`)
  - Browser storage fallback (`localStorage['sessions']`)
  - **Sample data** — on Analyze, use **LOAD SAMPLE DATA** to preview charts with mock sessions (`js/analyze/mockDashboardData.js`).

## Repository Layout

```text
.
|- index.html / test.html / analyze.html
|- server.py / eeg_server.py / run_servers.py
|- db_handler.py / schema.sql / create_database.py
|- generate_metadata.py / signal_quality.py
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
- `eeg_server.py` runs on WebSocket port `8765` by default.
- Local development uses `/api/list-audio-files`; static hosting falls back to `audio-files.json`.
