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
- Schema file: `schema.sql`
- Init script: `create_database.py`

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
  - Calibration/baseline/stimulation/tagging durations
- `js/modules/trialTagsConfig.json`
  - Survey categories/tags shown after each trial

## Test Session Defaults

Current defaults from code/config:
- Calibration: `20s`
- Baseline (per pattern): `30s`
- Stimulation (per pattern): `30s`
- Tagging/survey estimate (per pattern): `10s` (used by estimator)

Calibration quality gate on `test.html` currently requires:
- At least `30` usable calibration readings
- Latest reading age <= `3000ms`
- Signal quality >= `70`
- No more than `25%` channels marked `poor` per reading
- At least `80%` passing readings in evaluation window

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
|- docs/ (protocol and architecture notes)
|- dev/ (component/module example pages)
```

## Notes

- No `requirements.txt` is currently provided; install dependencies manually as above.
- `server.py` runs on port `8000`.
- `eeg_server.py` runs on WebSocket port `8765` by default.
- Local development uses `/api/list-audio-files`; static hosting falls back to `audio-files.json`.
