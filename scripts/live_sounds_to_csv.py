"""Convert full Live sounds JSON exports to segment and optional time-window CSVs."""

import argparse
import csv
import json
import math
from collections import defaultdict
from datetime import datetime
from pathlib import Path


BANDS = ("delta", "theta", "alpha", "beta", "gamma")
FIELDS = [
    "source_file", "session_id", "session_label", "session_created_at",
    "segment_kind", "sound_number", "started_at", "ended_at",
    "duration_seconds", "reading_count", "source", "sound_note",
    "mean_signal_quality",
]
for band in BANDS:
    FIELDS.extend((f"mean_{band}_relative", f"{band}_vs_baseline_pp"))
WINDOW_FIELDS = [*FIELDS, "window_index", "window_start_seconds", "window_end_seconds"]


def mean_field(readings, field):
    values = []
    for reading in readings:
        try:
            value = float(reading[field])
        except (KeyError, TypeError, ValueError):
            continue
        if value == value and abs(value) != float("inf"):
            values.append(value)
    return sum(values) / len(values) if values else None


def duration_seconds(segment):
    try:
        start = datetime.fromisoformat(segment["startedAt"].replace("Z", "+00:00"))
        end = datetime.fromisoformat(segment["endedAt"].replace("Z", "+00:00"))
        return max(0, (end - start).total_seconds())
    except (KeyError, TypeError, ValueError):
        return ""


def make_row(path, data, segment, readings, baseline, sound_number):
    row = {
        "source_file": path.name,
        "session_id": data.get("id", ""),
        "session_label": data.get("label", ""),
        "session_created_at": data.get("createdAt", ""),
        "segment_kind": segment.get("kind", ""),
        "sound_number": segment.get("soundNumber") or (sound_number if sound_number else ""),
        "started_at": segment.get("startedAt", ""),
        "ended_at": segment.get("endedAt", ""),
        "duration_seconds": duration_seconds(segment),
        "reading_count": len(readings),
        "source": readings[0].get("source", "") if readings else "",
        "sound_note": segment.get("note", ""),
        "mean_signal_quality": mean_field(readings, "signal_quality"),
    }
    for band in BANDS:
        current = mean_field(readings, f"{band}_rel")
        reference = mean_field(baseline.get("readings", []), f"{band}_rel") if baseline else None
        row[f"mean_{band}_relative"] = current
        row[f"{band}_vs_baseline_pp"] = (
            (current - reference) * 100
            if segment.get("kind") == "sound" and current is not None and reference is not None
            else ""
        )
    return row


def sessions(paths):
    for path in paths:
        data = json.loads(path.read_text(encoding="utf-8-sig"))
        if not isinstance(data, dict) or not isinstance(data.get("segments"), list):
            raise ValueError(f"{path}: expected a Live sounds export with a segments list")
        yield path, data


def convert(paths, output):
    count = 0
    with output.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        for path, data in sessions(paths):
            segments = data["segments"]
            baseline = next((s for s in segments if s.get("kind") == "baseline"), None)
            sound_number = 0
            for segment in segments:
                readings = segment.get("readings", [])
                if not isinstance(readings, list):
                    raise ValueError(f"{path}: segment readings must be a list")
                if segment.get("kind") == "sound":
                    sound_number += 1
                writer.writerow(make_row(path, data, segment, readings, baseline, sound_number))
                count += 1
    return count


def convert_windows(paths, output, window_seconds=10):
    if not math.isfinite(window_seconds) or window_seconds <= 0:
        raise ValueError("window_seconds must be positive and finite")
    count = 0
    with output.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=WINDOW_FIELDS)
        writer.writeheader()
        for path, data in sessions(paths):
            segments = data["segments"]
            baseline = next((s for s in segments if s.get("kind") == "baseline"), None)
            sound_number = 0
            for segment in segments:
                readings = segment.get("readings", [])
                if not isinstance(readings, list):
                    raise ValueError(f"{path}: segment readings must be a list")
                if segment.get("kind") == "sound":
                    sound_number += 1
                if not readings:
                    continue
                try:
                    start_ms = datetime.fromisoformat(segment["startedAt"].replace("Z", "+00:00")).timestamp() * 1000
                except (KeyError, TypeError, ValueError) as exc:
                    raise ValueError(f"{path}: segment needs a valid startedAt for windowing") from exc
                windows = defaultdict(list)
                for reading in readings:
                    try:
                        timestamp_ms = float(reading["timestamp_ms"])
                    except (KeyError, TypeError, ValueError) as exc:
                        raise ValueError(f"{path}: every reading needs timestamp_ms for windowing") from exc
                    if not math.isfinite(timestamp_ms):
                        raise ValueError(f"{path}: reading timestamp_ms must be finite")
                    window_index = max(0, math.floor((timestamp_ms - start_ms) / (window_seconds * 1000)))
                    windows[window_index].append(reading)
                for window_index, window_readings in sorted(windows.items()):
                    row = make_row(path, data, segment, window_readings, baseline, sound_number)
                    row.update({
                        "window_index": window_index,
                        "window_start_seconds": window_index * window_seconds,
                        "window_end_seconds": (window_index + 1) * window_seconds,
                    })
                    writer.writerow(row)
                    count += 1
    return count


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("files", nargs="+", type=Path, help="Full Live sounds JSON exports")
    parser.add_argument("--output", type=Path, default=Path("live-sounds-summary.csv"))
    parser.add_argument("--windows-output", type=Path, help="Also write one row per time window")
    parser.add_argument("--window-seconds", type=float, default=10, help="Time window length (default: 10 seconds)")
    args = parser.parse_args()
    count = convert(args.files, args.output)
    print(f"Wrote {count} segment rows to {args.output}")
    if args.windows_output:
        count = convert_windows(args.files, args.windows_output, args.window_seconds)
        print(f"Wrote {count} time-window rows to {args.windows_output}")


if __name__ == "__main__":
    main()
