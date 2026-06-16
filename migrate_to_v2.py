#!/usr/bin/env python3
"""
Migrate haptic_research.db -> haptic_research_v2.db

- Freezes a timestamped backup of the source database
- Copies all core research data
- Migrates trial_survey_directions -> trial_survey_binary_actions
- Migrates trial_survey_textures -> trial_survey_vibes (facet -> pair_id)
- Preserves trial_survey_actions (other actions) unchanged
"""

from __future__ import annotations

import shutil
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from survey_taxonomy import (
    LEGACY_DIRECTION_AXIS_TO_PAIR_ID,
    LEGACY_TEXTURE_FACET_TO_PAIR_ID,
)

ROOT = Path(__file__).parent
SOURCE_DB = ROOT / 'haptic_research.db'
TARGET_DB = ROOT / 'haptic_research_v2.db'
SCHEMA_V2 = ROOT / 'schema_v2.sql'
BACKUP_DIR = ROOT / 'backups'


def _connect(path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys = ON')
    return conn


def _table_exists(conn: sqlite3.Connection, name: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
        (name,),
    ).fetchone()
    return row is not None


def _copy_table(source: sqlite3.Connection, target: sqlite3.Connection, table: str, columns: list[str]) -> int:
    cols = ', '.join(columns)
    placeholders = ', '.join('?' for _ in columns)
    rows = source.execute(f'SELECT {cols} FROM {table}').fetchall()
    if not rows:
        return 0
    target.executemany(
        f'INSERT INTO {table} ({cols}) VALUES ({placeholders})',
        [tuple(row[col] for col in columns) for row in rows],
    )
    return len(rows)


def migrate() -> None:
    if not SOURCE_DB.exists():
        raise SystemExit(f'Source database not found: {SOURCE_DB}')

    BACKUP_DIR.mkdir(exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H%M%SZ')
    frozen_backup = BACKUP_DIR / f'haptic_research_frozen_{timestamp}.db'
    shutil.copy2(SOURCE_DB, frozen_backup)
    print(f'Frozen backup: {frozen_backup}')

    if TARGET_DB.exists():
        TARGET_DB.unlink()

    source = _connect(SOURCE_DB)
    target = _connect(TARGET_DB)

    try:
        target.executescript(SCHEMA_V2.read_text(encoding='utf-8'))
        target.commit()

        counts = {}

        counts['participants'] = _copy_table(
            source, target, 'participants',
            ['participant_id', 'participant_code', 'age', 'gender', 'handedness', 'created_at', 'notes'],
        )
        counts['locations'] = _copy_table(
            source, target, 'locations',
            ['location_id', 'name', 'description', 'address'],
        )
        counts['patterns'] = _copy_table(
            source, target, 'patterns',
            ['pattern_id', 'name', 'file_path', 'duration_ms', 'description', 'metadata_json'],
        )
        counts['sessions'] = _copy_table(
            source, target, 'sessions',
            ['session_id', 'participant_id', 'location_id', 'session_date', 'equipment_info', 'experimenter', 'notes'],
        )
        counts['trials'] = _copy_table(
            source, target, 'trials',
            ['trial_id', 'session_id', 'pattern_id', 'trial_order', 'start_time', 'end_time', 'notes', 'exclude_from_analysis'],
        )
        counts['trial_survey_responses'] = _copy_table(
            source, target, 'trial_survey_responses',
            [
                'response_id', 'trial_id', 'urgency', 'intensity', 'mood', 'anxiety', 'focus',
                'body', 'energy', 'clarity', 'social', 'motivation', 'confidence', 'created_at',
            ],
        )

        if _table_exists(source, 'trial_survey_actions'):
            counts['trial_survey_actions'] = _copy_table(
                source, target, 'trial_survey_actions',
                ['response_id', 'action_type', 'action_value'],
            )
        else:
            counts['trial_survey_actions'] = 0

        # Directions -> binary_actions
        direction_rows = 0
        if _table_exists(source, 'trial_survey_directions'):
            for row in source.execute(
                'SELECT response_id, axis, value FROM trial_survey_directions ORDER BY response_id, axis'
            ):
                pair_id = LEGACY_DIRECTION_AXIS_TO_PAIR_ID.get(row['axis'])
                if not pair_id:
                    raise ValueError(f'Unknown legacy direction axis: {row["axis"]!r}')
                target.execute(
                    'INSERT INTO trial_survey_binary_actions (response_id, pair_id, value) VALUES (?, ?, ?)',
                    (row['response_id'], pair_id, row['value']),
                )
                direction_rows += 1
        counts['trial_survey_binary_actions_from_directions'] = direction_rows

        # Textures -> vibes
        texture_rows = 0
        if _table_exists(source, 'trial_survey_textures'):
            for row in source.execute(
                'SELECT response_id, facet, value FROM trial_survey_textures ORDER BY response_id, facet'
            ):
                pair_id = LEGACY_TEXTURE_FACET_TO_PAIR_ID.get(row['facet'])
                if not pair_id:
                    raise ValueError(f'Unknown legacy texture facet: {row["facet"]!r}')
                target.execute(
                    'INSERT INTO trial_survey_vibes (response_id, pair_id, value) VALUES (?, ?, ?)',
                    (row['response_id'], pair_id, row['value']),
                )
                texture_rows += 1
        counts['trial_survey_vibes_from_textures'] = texture_rows

        if _table_exists(source, 'trial_events'):
            counts['trial_events'] = _copy_table(
                source, target, 'trial_events',
                ['event_id', 'trial_id', 'event_type', 'phase', 'timestamp_ms', 'created_at', 'details_json'],
            )
        else:
            counts['trial_events'] = 0

        if _table_exists(source, 'brainwave_readings'):
            counts['brainwave_readings'] = _copy_table(
                source, target, 'brainwave_readings',
                [
                    'reading_id', 'trial_id', 'timestamp_ms', 'phase', 'signal_quality',
                    'delta_abs', 'theta_abs', 'alpha_abs', 'beta_abs', 'gamma_abs',
                    'delta_rel', 'theta_rel', 'alpha_rel', 'beta_rel', 'gamma_rel',
                ],
            )
        else:
            counts['brainwave_readings'] = 0

        target.commit()

        # Verification
        src_directions = 0
        if _table_exists(source, 'trial_survey_directions'):
            src_directions = source.execute('SELECT COUNT(*) AS n FROM trial_survey_directions').fetchone()['n']
        src_textures = 0
        if _table_exists(source, 'trial_survey_textures'):
            src_textures = source.execute('SELECT COUNT(*) AS n FROM trial_survey_textures').fetchone()['n']

        tgt_binary = target.execute('SELECT COUNT(*) AS n FROM trial_survey_binary_actions').fetchone()['n']
        tgt_vibes = target.execute('SELECT COUNT(*) AS n FROM trial_survey_vibes').fetchone()['n']

        if src_directions != tgt_binary:
            raise RuntimeError(
                f'Binary action migration mismatch: source directions={src_directions}, target binary={tgt_binary}'
            )
        if src_textures != tgt_vibes:
            raise RuntimeError(
                f'Vibes migration mismatch: source textures={src_textures}, target vibes={tgt_vibes}'
            )

        print('Migration complete.')
        print(f'Target database: {TARGET_DB}')
        for key, value in counts.items():
            print(f'  {key}: {value}')
        print(f'  verified binary_actions == legacy directions: {tgt_binary}')
        print(f'  verified vibes == legacy textures: {tgt_vibes}')

    finally:
        source.close()
        target.close()


if __name__ == '__main__':
    migrate()
