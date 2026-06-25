#!/usr/bin/env python3
"""
Backfill lookup_hmac for legacy participants using a codebook CSV.

The codebook maps participant_code → legal name. Names are used only to compute
HMAC; they are never written to SQLite. Only lookup_hmac is stored on the row.

Usage:
  python scripts/backfill_participant_lookup.py codebook.csv
  python scripts/backfill_participant_lookup.py codebook.csv --dry-run

CSV format (header required):
  participant_code,name
  APANDJI,Andrew Pandji
  AJUNG,Alice Jung

Keep the codebook outside git (see participant_codebook.example.csv).
"""

import argparse
import csv
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from db_handler import get_connection
from participant_ids import normalize_participant_name, compute_lookup_hmac_for_name


def backfill(csv_path: Path, dry_run: bool = False) -> int:
    if not csv_path.is_file():
        print(f'Codebook not found: {csv_path}', file=sys.stderr)
        return 1

    rows = []
    with csv_path.open(newline='', encoding='utf-8') as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames or 'participant_code' not in reader.fieldnames or 'name' not in reader.fieldnames:
            print('CSV must have columns: participant_code,name', file=sys.stderr)
            return 1
        for line_num, row in enumerate(reader, start=2):
            code = (row.get('participant_code') or '').strip()
            name = (row.get('name') or '').strip()
            if not code or not name:
                print(f'Line {line_num}: skipping empty code or name', file=sys.stderr)
                continue
            rows.append((code, name))

    if not rows:
        print('No rows to process.', file=sys.stderr)
        return 1

    conn = get_connection()
    cursor = conn.cursor()
    updated = 0
    skipped = 0
    errors = 0

    try:
        for code, name in rows:
            normalized = normalize_participant_name(name)
            lookup_hmac = compute_lookup_hmac_for_name(name)

            cursor.execute(
                'SELECT participant_id, participant_code, lookup_hmac FROM participants WHERE participant_code = ?',
                (code,),
            )
            participant = cursor.fetchone()
            if not participant:
                print(f'  SKIP {code}: no participant with this code in database')
                skipped += 1
                continue

            if participant['lookup_hmac']:
                if participant['lookup_hmac'] == lookup_hmac:
                    print(f'  OK   {code}: already backfilled for "{normalized}"')
                    skipped += 1
                    continue
                print(f'  ERROR {code}: lookup_hmac already set to a different value', file=sys.stderr)
                errors += 1
                continue

            cursor.execute(
                'SELECT participant_id, participant_code FROM participants WHERE lookup_hmac = ?',
                (lookup_hmac,),
            )
            conflict = cursor.fetchone()
            if conflict and conflict['participant_code'] != code:
                print(
                    f'  ERROR {code}: HMAC for "{normalized}" already used by {conflict["participant_code"]}',
                    file=sys.stderr,
                )
                errors += 1
                continue

            action = 'would set' if dry_run else 'set'
            print(f'  {action} {code} ← lookup for "{normalized}" (name not stored)')

            if not dry_run:
                cursor.execute(
                    'UPDATE participants SET lookup_hmac = ? WHERE participant_code = ?',
                    (lookup_hmac, code),
                )
                updated += 1

        if not dry_run:
            conn.commit()
    except Exception as exc:
        conn.rollback()
        print(f'Failed: {exc}', file=sys.stderr)
        return 1
    finally:
        conn.close()

    print(f'\nDone. Updated: {updated}, skipped: {skipped}, errors: {errors}')
    return 1 if errors else 0


def main():
    parser = argparse.ArgumentParser(description='Backfill lookup_hmac from codebook CSV')
    parser.add_argument('codebook', type=Path, help='CSV with participant_code,name columns')
    parser.add_argument('--dry-run', action='store_true', help='Print actions without writing')
    args = parser.parse_args()
    raise SystemExit(backfill(args.codebook, dry_run=args.dry_run))


if __name__ == '__main__':
    main()
