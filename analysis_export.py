#!/usr/bin/env python3
"""
Export the analysis corpus as Gemini-ready CSVs + a codebook.

Default bundle (what to upload):
  CODEBOOK.md              read first — grain, joins, field meanings
  trials.csv               one row per trial (start here)
  patterns.csv             one row per pattern
  sessions.csv             one row per session
  participants.csv         coded IDs + demographics
  survey_pairs.csv         long: binary-action and vibe choices
  survey_actions.csv       long: predefined / custom actions
  eeg_by_trial_phase.csv   tidy EEG means (trial × phase)
  pattern_tags.csv         long: analyst tags per pattern

Optional:
  eeg_readings.csv         every brainwave row (--readings)

Usage:
  python3 analysis_export.py
  python3 analysis_export.py --out exports/my-run
  python3 analysis_export.py --readings
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import re
import sqlite3
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from db_handler import DB_PATH, PATTERN_METADATA_PATH, get_connection

BANDS = ("delta", "theta", "alpha", "beta", "gamma")
BAND_COLS = tuple(f"{band}_{kind}" for band in BANDS for kind in ("abs", "rel"))

CODEBOOK = """# Haptic analysis export — codebook

Upload **this file plus the CSVs** into WashU Gemini / Gemini Notebook.
Start with `CODEBOOK.md`, `trials.csv`, and `patterns.csv`. Join the others
only when a question needs them.

Participant codes in these files are the study's coded identifiers. Do not
re-identify participants. Filter out `exclude_from_analysis = 1` unless you
are auditing exclusions.

## Which file to use

| Question | File |
|---|---|
| Compare patterns, survey scores, EEG change | `trials.csv` |
| Pattern-level means, tags, audio metadata | `patterns.csv` |
| Session or location effects | `sessions.csv` |
| Demographics (age / gender / handedness) | `participants.csv` |
| Binary-action or vibe pair choices | `survey_pairs.csv` |
| Lean / Slide / custom actions | `survey_actions.csv` |
| EEG by baseline vs stimulation (tidy) | `eeg_by_trial_phase.csv` |
| Analyst Neutral / Attentive / Disruptive tags | `pattern_tags.csv` |
| Per-timestamp EEG (only if exported) | `eeg_readings.csv` |

Join key is `trial_id` for trial-grained tables, `session_id` for sessions,
`participant_code` or `participant_id` for people, and `pattern_name` (the
AUD filename, e.g. `AUD007.mp3`) for patterns.

**Stable pattern number is the AUD file number, not `pattern_id`.**
`pattern_id` in the database is shuffled relative to the audio file.
`aud_number` on `trials.csv` / `patterns.csv` is the number to use
(Pattern 7 = AUD007).

## trials.csv (primary grain)

One row per stimulation trial.

Survey scalars (`urgency`, `intensity`, `confidence`) are 0–1.
Emotion facets (`mood`, `anxiety`, `focus`, `body`, `energy`, `clarity`,
`social`, `motivation`) are ordered category labels from the v2 survey.

EEG columns on this file are **trial means**, then **stimulation minus
baseline** (`eeg_delta_*`). That matches the Analyze page: if a trial has
no own baseline readings, `eeg_baseline_source` is `session` and the first
same-session baseline is used. Empty EEG fields mean there was no usable
pair.

`exclude_from_analysis` is 1 when an analyst hid the trial. Pattern-level
means in `patterns.csv` already omit those rows.

## EEG units

Absolute band powers (`*_abs`) are BrainFlow band-power estimates from the
OpenBCI Ganglion stream. Relative powers (`*_rel`) are that band divided by
the sum of the five bands on the same reading. Deltas are stim − baseline
(positive = higher during stimulation).

Default export does **not** include timestamp-level rows. Re-export with
`--readings` (CLI) or `GET /api/analysis/export?readings=1` if you need
`eeg_readings.csv`. Prefer the trial/phase summaries for Gemini.

## Survey pair tables

`survey_pairs.csv` is long (several rows per trial):

- `pair_kind` = `binary_action` or `vibe`
- `pair_id` = taxonomy id (`pull_push`, `hot_cold`, …)
- `value` = the chosen pole (`Pull`, `Hot`, …)

`survey_actions.csv` is also long: `action_type` is `predefined` or `custom`.

## Audio metadata on patterns.csv

From `pattern_metadata.json`: `rms_mean` (loudness proxy), `stereo_balance`
(negative = left), `stereo_movement` (how much the signal travels),
`duration_sec`.
"""


def _parse_iso(value: Any) -> Optional[datetime]:
    if not value:
        return None
    text = str(value).strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return None


def _duration_sec(start_value: Any, end_value: Any) -> Optional[float]:
    start = _parse_iso(start_value)
    end = _parse_iso(end_value)
    if not start or not end:
        return None
    return (end - start).total_seconds()


def _aud_number(name_or_path: Optional[str]) -> Optional[int]:
    if not name_or_path:
        return None
    match = re.search(r"AUD(\d+)", str(name_or_path), flags=re.IGNORECASE)
    return int(match.group(1)) if match else None


def _csv_cell(value: Any) -> Any:
    if value is None:
        return ""
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, float):
        return round(value, 6)
    return value


def _write_csv(fieldnames: Sequence[str], rows: Iterable[Dict[str, Any]]) -> str:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=list(fieldnames), extrasaction="ignore")
    writer.writeheader()
    for row in rows:
        writer.writerow({key: _csv_cell(row.get(key)) for key in fieldnames})
    return buffer.getvalue()


def _rows(conn: sqlite3.Connection, sql: str, params: Sequence[Any] = ()) -> List[sqlite3.Row]:
    return conn.execute(sql, params).fetchall()


def _load_metadata() -> Dict[str, Dict[str, Any]]:
    if not PATTERN_METADATA_PATH.exists():
        return {}
    try:
        payload = json.loads(PATTERN_METADATA_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    catalog: Dict[str, Dict[str, Any]] = {}
    for entry in payload.get("patterns", []):
        filename = entry.get("filename")
        if filename:
            catalog[filename] = entry
    return catalog


def _eeg_phase_means(conn: sqlite3.Connection) -> Dict[Tuple[int, str], Dict[str, Any]]:
    select_avgs = ", ".join(f"AVG({col}) AS {col}" for col in BAND_COLS)
    rows = _rows(
        conn,
        f"""
        SELECT trial_id, phase,
               COUNT(*) AS n_readings,
               AVG(signal_quality) AS signal_quality,
               {select_avgs}
        FROM brainwave_readings
        GROUP BY trial_id, phase
        """,
    )
    out: Dict[Tuple[int, str], Dict[str, Any]] = {}
    for row in rows:
        out[(row["trial_id"], row["phase"] or "baseline")] = dict(row)
    return out


def _session_fallback_baselines(
    trial_rows: Sequence[sqlite3.Row],
    phase_means: Dict[Tuple[int, str], Dict[str, Any]],
) -> Dict[int, Dict[str, Any]]:
    """First trial-in-session that has baseline EEG, keyed by session_id."""
    by_session: Dict[int, List[sqlite3.Row]] = defaultdict(list)
    for row in trial_rows:
        by_session[row["session_id"]].append(row)
    fallback: Dict[int, Dict[str, Any]] = {}
    for session_id, trials in by_session.items():
        ordered = sorted(trials, key=lambda r: (r["trial_order"] or 0, r["trial_id"]))
        for trial in ordered:
            baseline = phase_means.get((trial["trial_id"], "baseline"))
            if baseline:
                fallback[session_id] = baseline
                break
    return fallback


def _analysis_baseline(
    trial_id: int,
    session_id: int,
    phase_means: Dict[Tuple[int, str], Dict[str, Any]],
    session_fallback: Dict[int, Dict[str, Any]],
) -> Tuple[Optional[Dict[str, Any]], str]:
    own = phase_means.get((trial_id, "baseline"))
    if own:
        return own, "own"
    fallback = session_fallback.get(session_id)
    if fallback:
        return fallback, "session"
    return None, ""


def _build_trial_eeg(
    trial_id: int,
    session_id: int,
    phase_means: Dict[Tuple[int, str], Dict[str, Any]],
    session_fallback: Dict[int, Dict[str, Any]],
) -> Dict[str, Any]:
    baseline, source = _analysis_baseline(trial_id, session_id, phase_means, session_fallback)
    stim = phase_means.get((trial_id, "stimulation"))
    out: Dict[str, Any] = {
        "n_eeg_baseline": (baseline or {}).get("n_readings"),
        "n_eeg_stim": (stim or {}).get("n_readings"),
        "eeg_baseline_source": source,
        "has_eeg": bool(baseline and stim),
    }
    for col in BAND_COLS:
        base_val = baseline.get(col) if baseline else None
        stim_val = stim.get(col) if stim else None
        out[f"eeg_base_{col}"] = base_val
        out[f"eeg_stim_{col}"] = stim_val
        if base_val is not None and stim_val is not None:
            out[f"eeg_delta_{col}"] = stim_val - base_val
        else:
            out[f"eeg_delta_{col}"] = None
    return out


def build_export_files(
    conn: Optional[sqlite3.Connection] = None,
    include_readings: bool = False,
) -> Dict[str, str]:
    owns_conn = conn is None
    if owns_conn:
        conn = get_connection()
    try:
        return _build_export_files(conn, include_readings=include_readings)
    finally:
        if owns_conn:
            conn.close()


def _build_export_files(conn: sqlite3.Connection, include_readings: bool) -> Dict[str, str]:
    metadata = _load_metadata()
    phase_means = _eeg_phase_means(conn)

    participant_rows = _rows(
        conn,
        """
        SELECT participant_id, participant_code, age, gender, handedness,
               created_at, notes
        FROM participants
        ORDER BY participant_id
        """,
    )
    session_rows = _rows(
        conn,
        """
        SELECT s.session_id, s.participant_id, p.participant_code,
               s.location_id, l.name AS location_name,
               s.session_date, s.equipment_info, s.experimenter, s.notes
        FROM sessions s
        LEFT JOIN participants p ON p.participant_id = s.participant_id
        LEFT JOIN locations l ON l.location_id = s.location_id
        ORDER BY s.session_date, s.session_id
        """,
    )
    trial_rows = _rows(
        conn,
        """
        SELECT t.trial_id, t.session_id, t.pattern_id, t.trial_order,
               t.start_time, t.end_time, t.notes AS trial_notes,
               t.exclude_from_analysis, t.analyst_notes,
               t.analyst_notes_updated_at,
               p.name AS pattern_name, p.file_path AS pattern_path,
               s.session_date, s.participant_id, s.location_id,
               s.experimenter,
               part.participant_code, part.age, part.gender, part.handedness,
               loc.name AS location_name
        FROM trials t
        JOIN sessions s ON s.session_id = t.session_id
        LEFT JOIN patterns p ON p.pattern_id = t.pattern_id
        LEFT JOIN participants part ON part.participant_id = s.participant_id
        LEFT JOIN locations loc ON loc.location_id = s.location_id
        ORDER BY s.session_date, t.session_id, t.trial_order, t.trial_id
        """,
    )
    survey_by_trial = {
        row["trial_id"]: dict(row)
        for row in _rows(
            conn,
            """
            SELECT trial_id, urgency, intensity, confidence,
                   mood, anxiety, focus, body, energy, clarity, social, motivation
            FROM trial_survey_responses
            """,
        )
    }
    pair_rows = [
        {
            "trial_id": row["trial_id"],
            "pair_kind": "binary_action",
            "pair_id": row["pair_id"],
            "value": row["value"],
        }
        for row in _rows(
            conn,
            """
            SELECT r.trial_id, b.pair_id, b.value
            FROM trial_survey_binary_actions b
            JOIN trial_survey_responses r ON r.response_id = b.response_id
            ORDER BY r.trial_id, b.pair_id
            """,
        )
    ]
    pair_rows.extend(
        {
            "trial_id": row["trial_id"],
            "pair_kind": "vibe",
            "pair_id": row["pair_id"],
            "value": row["value"],
        }
        for row in _rows(
            conn,
            """
            SELECT r.trial_id, v.pair_id, v.value
            FROM trial_survey_vibes v
            JOIN trial_survey_responses r ON r.response_id = v.response_id
            ORDER BY r.trial_id, v.pair_id
            """,
        )
    )
    action_rows = [
        {
            "trial_id": row["trial_id"],
            "action_type": row["action_type"],
            "action_value": row["action_value"],
        }
        for row in _rows(
            conn,
            """
            SELECT r.trial_id, a.action_type, a.action_value
            FROM trial_survey_actions a
            JOIN trial_survey_responses r ON r.response_id = a.response_id
            ORDER BY r.trial_id, a.action_type, a.action_value
            """,
        )
    ]
    pattern_rows = _rows(
        conn,
        """
        SELECT pattern_id, name, file_path, duration_ms, description
        FROM patterns
        ORDER BY name
        """,
    )
    tag_rows = [
        {
            "pattern_name": row["pattern_name"],
            "tag_name": row["tag_name"],
            "tag_color": row["color"],
            "is_default": row["is_default"],
        }
        for row in _rows(
            conn,
            """
            SELECT pat.pattern_name, t.name AS tag_name, t.color, t.is_default
            FROM pattern_analysis_tags pat
            JOIN analysis_tags t ON t.tag_id = pat.tag_id
            ORDER BY pat.pattern_name, t.name COLLATE NOCASE
            """,
        )
    ]
    annotations = {
        row["pattern_name"]: row["notes"]
        for row in _rows(conn, "SELECT pattern_name, notes FROM pattern_annotations")
    }
    tags_by_pattern: Dict[str, List[str]] = defaultdict(list)
    for row in tag_rows:
        tags_by_pattern[row["pattern_name"]].append(row["tag_name"])

    session_fallback = _session_fallback_baselines(trial_rows, phase_means)

    eeg_phase_rows: List[Dict[str, Any]] = []
    for (trial_id, phase), means in sorted(phase_means.items()):
        row = {"trial_id": trial_id, "phase": phase, "n_readings": means.get("n_readings"),
               "signal_quality": means.get("signal_quality")}
        for col in BAND_COLS:
            row[col] = means.get(col)
        eeg_phase_rows.append(row)

    trial_export_rows: List[Dict[str, Any]] = []
    for trial in trial_rows:
        survey = survey_by_trial.get(trial["trial_id"], {})
        eeg = _build_trial_eeg(
            trial["trial_id"], trial["session_id"], phase_means, session_fallback
        )
        duration_sec = _duration_sec(trial["start_time"], trial["end_time"])
        trial_export_rows.append({
            "trial_id": trial["trial_id"],
            "session_id": trial["session_id"],
            "participant_id": trial["participant_id"],
            "participant_code": trial["participant_code"],
            "session_date": trial["session_date"],
            "trial_order": trial["trial_order"],
            "pattern_id": trial["pattern_id"],
            "pattern_name": trial["pattern_name"],
            "aud_number": _aud_number(trial["pattern_name"] or trial["pattern_path"]),
            "location_name": trial["location_name"],
            "experimenter": trial["experimenter"],
            "start_time": trial["start_time"],
            "end_time": trial["end_time"],
            "duration_sec": duration_sec,
            "exclude_from_analysis": trial["exclude_from_analysis"],
            "analyst_notes": trial["analyst_notes"],
            "trial_notes": trial["trial_notes"],
            "has_survey": int(trial["trial_id"] in survey_by_trial),
            "urgency": survey.get("urgency"),
            "intensity": survey.get("intensity"),
            "confidence": survey.get("confidence"),
            "mood": survey.get("mood"),
            "anxiety": survey.get("anxiety"),
            "focus": survey.get("focus"),
            "body": survey.get("body"),
            "energy": survey.get("energy"),
            "clarity": survey.get("clarity"),
            "social": survey.get("social"),
            "motivation": survey.get("motivation"),
            **eeg,
        })

    trials_by_pattern: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for row in trial_export_rows:
        if row["pattern_name"]:
            trials_by_pattern[row["pattern_name"]].append(row)

    def _mean(values: List[Any]) -> Optional[float]:
        nums = [v for v in values if isinstance(v, (int, float))]
        if not nums:
            return None
        return sum(nums) / len(nums)

    pattern_export_rows: List[Dict[str, Any]] = []
    for pattern in pattern_rows:
        name = pattern["name"]
        meta = metadata.get(name) or metadata.get(Path(pattern["file_path"] or "").name) or {}
        all_trials = trials_by_pattern.get(name, [])
        kept = [t for t in all_trials if not t["exclude_from_analysis"]]
        surveyed = [t for t in kept if t["has_survey"]]
        eeg_trials = [t for t in kept if t["has_eeg"]]
        row = {
            "pattern_id": pattern["pattern_id"],
            "pattern_name": name,
            "aud_number": _aud_number(name or pattern["file_path"]),
            "file_path": pattern["file_path"],
            "duration_sec": meta.get("duration") if meta.get("duration") is not None
            else ((pattern["duration_ms"] / 1000.0) if pattern["duration_ms"] else None),
            "rms_mean": meta.get("rms_mean"),
            "stereo_balance": meta.get("stereo_balance"),
            "stereo_movement": meta.get("stereo_movement"),
            "n_trials": len(all_trials),
            "n_included": len(kept),
            "n_excluded": sum(1 for t in all_trials if t["exclude_from_analysis"]),
            "n_surveyed": len(surveyed),
            "n_with_eeg": len(eeg_trials),
            "avg_urgency": _mean([t["urgency"] for t in surveyed]),
            "avg_intensity": _mean([t["intensity"] for t in surveyed]),
            "avg_confidence": _mean([t["confidence"] for t in surveyed]),
            "tags": "|".join(tags_by_pattern.get(name, [])),
            "analyst_notes": annotations.get(name, ""),
            "description": pattern["description"],
        }
        for col in BAND_COLS:
            row[f"avg_eeg_delta_{col}"] = _mean([t.get(f"eeg_delta_{col}") for t in eeg_trials])
        pattern_export_rows.append(row)

    files: Dict[str, str] = {
        "CODEBOOK.md": CODEBOOK,
        "trials.csv": _write_csv(_trial_fields(), trial_export_rows),
        "patterns.csv": _write_csv(_pattern_fields(), pattern_export_rows),
        "sessions.csv": _write_csv(
            [
                "session_id", "participant_id", "participant_code", "location_id",
                "location_name", "session_date", "equipment_info", "experimenter",
                "notes",
            ],
            [dict(row) for row in session_rows],
        ),
        "participants.csv": _write_csv(
            [
                "participant_id", "participant_code", "age", "gender",
                "handedness", "created_at", "notes",
            ],
            [dict(row) for row in participant_rows],
        ),
        "survey_pairs.csv": _write_csv(
            ["trial_id", "pair_kind", "pair_id", "value"], pair_rows
        ),
        "survey_actions.csv": _write_csv(
            ["trial_id", "action_type", "action_value"], action_rows
        ),
        "eeg_by_trial_phase.csv": _write_csv(
            ["trial_id", "phase", "n_readings", "signal_quality", *BAND_COLS],
            eeg_phase_rows,
        ),
        "pattern_tags.csv": _write_csv(
            ["pattern_name", "tag_name", "tag_color", "is_default"], tag_rows
        ),
    }

    if include_readings:
        reading_rows = [
            dict(row)
            for row in _rows(
                conn,
                f"""
                SELECT trial_id, timestamp_ms, phase, signal_quality, {", ".join(BAND_COLS)}
                FROM brainwave_readings
                ORDER BY trial_id, timestamp_ms
                """,
            )
        ]
        files["eeg_readings.csv"] = _write_csv(
            ["trial_id", "timestamp_ms", "phase", "signal_quality", *BAND_COLS],
            reading_rows,
        )

    return files


def _trial_fields() -> List[str]:
    fields = [
        "trial_id", "session_id", "participant_id", "participant_code",
        "session_date", "trial_order", "pattern_id", "pattern_name", "aud_number",
        "location_name", "experimenter", "start_time", "end_time", "duration_sec",
        "exclude_from_analysis", "has_survey", "has_eeg", "eeg_baseline_source",
        "n_eeg_baseline", "n_eeg_stim",
        "urgency", "intensity", "confidence",
        "mood", "anxiety", "focus", "body", "energy", "clarity", "social",
        "motivation", "analyst_notes", "trial_notes",
    ]
    for prefix in ("eeg_base_", "eeg_stim_", "eeg_delta_"):
        fields.extend(f"{prefix}{col}" for col in BAND_COLS)
    return fields


def _pattern_fields() -> List[str]:
    fields = [
        "pattern_id", "pattern_name", "aud_number", "file_path", "duration_sec",
        "rms_mean", "stereo_balance", "stereo_movement",
        "n_trials", "n_included", "n_excluded", "n_surveyed", "n_with_eeg",
        "avg_urgency", "avg_intensity", "avg_confidence",
        "tags", "analyst_notes", "description",
    ]
    fields.extend(f"avg_eeg_delta_{col}" for col in BAND_COLS)
    return fields


def write_export_dir(
    out_dir: Path,
    include_readings: bool = False,
    conn: Optional[sqlite3.Connection] = None,
) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    files = build_export_files(conn=conn, include_readings=include_readings)
    for name, content in files.items():
        (out_dir / name).write_text(content, encoding="utf-8")
    return out_dir


def build_export_zip_bytes(
    include_readings: bool = False,
    conn: Optional[sqlite3.Connection] = None,
) -> bytes:
    files = build_export_files(conn=conn, include_readings=include_readings)
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, content in files.items():
            archive.writestr(name, content)
    return buffer.getvalue()


def default_export_dir(root: Optional[Path] = None) -> Path:
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    base = (root or Path(__file__).resolve().parent) / "exports"
    candidate = base / f"analysis_{stamp}"
    if not candidate.exists():
        return candidate
    stamp_hms = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H%M%SZ")
    return base / f"analysis_{stamp_hms}"


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export analysis CSVs + codebook for Gemini."
    )
    parser.add_argument(
        "--out",
        type=Path,
        help="Output directory (default: exports/analysis_YYYY-MM-DD).",
    )
    parser.add_argument(
        "--db",
        type=Path,
        help=f"SQLite path (default: {DB_PATH.name}).",
    )
    parser.add_argument(
        "--readings",
        action="store_true",
        help="Also write eeg_readings.csv (every timestamp).",
    )
    return parser.parse_args(argv)


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = parse_args(argv)
    db_path = args.db or DB_PATH
    if not Path(db_path).exists():
        print(f"Database not found: {db_path}")
        return 1

    if args.db:
        conn = sqlite3.connect(str(args.db))
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
    else:
        conn = get_connection()

    out_dir = args.out or default_export_dir()
    try:
        write_export_dir(out_dir, include_readings=args.readings, conn=conn)
    finally:
        conn.close()

    written = sorted(p.name for p in out_dir.iterdir() if p.is_file())
    print(f"Wrote {len(written)} files to {out_dir}")
    for name in written:
        print(f"  {name}")
    print("Upload CODEBOOK.md + the CSVs to Gemini. Start with trials.csv and patterns.csv.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
