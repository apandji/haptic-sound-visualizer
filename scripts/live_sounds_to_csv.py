"""Convert one or more full Live sounds JSON exports to a compact segment CSV."""

import argparse
import csv
import json
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


def convert(paths, output):
    count = 0
    with output.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        for path in paths:
            data = json.loads(path.read_text(encoding="utf-8-sig"))
            if not isinstance(data, dict) or not isinstance(data.get("segments"), list):
                raise ValueError(f"{path}: expected a Live sounds export with a segments list")
            segments = data["segments"]
            baseline = next((s for s in segments if s.get("kind") == "baseline"), None)
            sound_number = 0
            for segment in segments:
                readings = segment.get("readings", [])
                if not isinstance(readings, list):
                    raise ValueError(f"{path}: segment readings must be a list")
                if segment.get("kind") == "sound":
                    sound_number += 1
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
                writer.writerow(row)
                count += 1
    return count


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("files", nargs="+", type=Path, help="Full Live sounds JSON exports")
    parser.add_argument("--output", type=Path, default=Path("live-sounds-summary.csv"))
    args = parser.parse_args()
    count = convert(args.files, args.output)
    print(f"Wrote {count} segment rows to {args.output}")


if __name__ == "__main__":
    main()
