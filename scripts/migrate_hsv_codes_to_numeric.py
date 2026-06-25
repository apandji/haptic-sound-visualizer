#!/usr/bin/env python3
"""
Renumber HSV-* participant codes to zero-padded numeric codes (000001, …).

Preserves lookup_hmac and all trial data. Updates participant_code only.
Legacy name-based codes (APANDJI, etc.) are untouched.

Usage:
  python scripts/migrate_hsv_codes_to_numeric.py --dry-run
  python scripts/migrate_hsv_codes_to_numeric.py
"""

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from db_handler import get_connection
from participant_ids import PARTICIPANT_CODE_WIDTH, allocate_next_participant_code


def migrate(dry_run: bool = False) -> int:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        rows = cursor.execute(
            """
            SELECT participant_id, participant_code
            FROM participants
            WHERE participant_code LIKE 'HSV-%'
            ORDER BY participant_id
            """
        ).fetchall()

        if not rows:
            print('No HSV-* participant codes to migrate.')
            return 0

        next_code = allocate_next_participant_code(cursor)
        updates = []
        for row in rows:
            updates.append((next_code, row['participant_id'], row['participant_code']))
            next_num = int(next_code) + 1
            next_code = str(next_num).zfill(PARTICIPANT_CODE_WIDTH)

        for new_code, participant_id, old_code in updates:
            action = 'would update' if dry_run else 'updated'
            print(f'  {action} {old_code} → {new_code} (participant_id={participant_id})')
            if not dry_run:
                cursor.execute(
                    'UPDATE participants SET participant_code = ? WHERE participant_id = ?',
                    (new_code, participant_id),
                )

        if not dry_run:
            conn.commit()
        print(f'\nDone. {"Would migrate" if dry_run else "Migrated"} {len(updates)} participant(s).')
        return 0
    except Exception as exc:
        conn.rollback()
        print(f'Failed: {exc}', file=sys.stderr)
        return 1
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(description='Migrate HSV-* codes to 000001-style codes')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    raise SystemExit(migrate(dry_run=args.dry_run))


if __name__ == '__main__':
    main()
