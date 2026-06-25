"""
Database Handler for Haptic Research

Handles saving session data, trials, brainwave readings, and tags to SQLite database.
"""

import sqlite3
import json
import re
from datetime import datetime
from typing import Optional, List, Dict, Any
from pathlib import Path

from survey_taxonomy import (
    SURVEY_BINARY_PAIRS,
    SURVEY_VIBE_PAIRS,
    SURVEY_ACTION_OPTIONS,
    SURVEY_EMOTION_OPTIONS,
    BINARY_PAIR_VALUES,
    VIBE_PAIR_VALUES,
    LEGACY_TEXTURE_FACET_TO_PAIR_ID,
    is_valid_binary_pair_value,
    is_valid_vibe_pair_value,
)

DB_PATH = Path(__file__).parent / 'haptic_research_v2.db'


def _slugify_fragment(value: str) -> str:
    """Create a stable lowercase slug for synthesized tag IDs."""
    slug = re.sub(r'[^a-z0-9]+', '-', str(value).strip().lower()).strip('-')
    return slug or 'unknown'


def flatten_survey_response_to_tags(survey_response: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Derive analysis-friendly flat tags from a structured survey response."""
    if not survey_response:
        return []

    derived_tags: List[Dict[str, Any]] = []

    binary_actions = survey_response.get('binaryActions') or {}
    if isinstance(binary_actions, dict):
        for pair_id, value in binary_actions.items():
            if not value:
                continue
            derived_tags.append({
                'id': f"binary:{pair_id}:{_slugify_fragment(value)}",
                'label': f"Binary: {value}",
                'category': 'binary_action',
                'isCustom': False
            })

    action_payload = survey_response.get('action') or {}
    for value in action_payload.get('predefined', []):
        if value not in SURVEY_ACTION_OPTIONS:
            continue
        derived_tags.append({
            'id': f"action:{_slugify_fragment(value)}",
            'label': f"Action: {value}",
            'category': 'action',
            'isCustom': False
        })

    for custom_action in normalize_custom_action_values(action_payload.get('custom')):
        derived_tags.append({
            'id': f"action:custom:{_slugify_fragment(custom_action)}",
            'label': f"Action: {custom_action}",
            'category': 'action',
            'isCustom': True
        })

    emotion = survey_response.get('emotion') or {}
    for facet, value in emotion.items():
        if not value:
            continue
        derived_tags.append({
            'id': f"emotion:{facet}:{_slugify_fragment(value)}",
            'label': f"{facet.capitalize()}: {value}",
            'category': f"emotion:{facet}",
            'isCustom': False
        })

    vibes = survey_response.get('vibes') or {}
    if isinstance(vibes, dict):
        for pair_id, value in vibes.items():
            if not value:
                continue
            derived_tags.append({
                'id': f"vibe:{pair_id}:{_slugify_fragment(value)}",
                'label': f"Vibe: {value}",
                'category': 'vibe',
                'isCustom': False
            })

    return derived_tags


def normalize_bounded_float(value: Any, field_name: str) -> float:
    """Coerce a required slider value to float in the inclusive 0..1 range."""
    try:
        normalized = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{field_name} must be a float between 0 and 1") from exc

    if normalized < 0.0 or normalized > 1.0:
        raise ValueError(f"{field_name} must be between 0 and 1, got {normalized}")

    return normalized


def normalize_required_choice(value: Any, allowed_values: tuple, field_name: str) -> str:
    """Validate a required categorical answer."""
    normalized = str(value).strip()
    if normalized not in allowed_values:
        raise ValueError(f"{field_name} must be one of {allowed_values}, got {value!r}")
    return normalized


def normalize_optional_choice(value: Any, allowed_values: tuple, field_name: str) -> Optional[str]:
    """Validate an optional categorical answer."""
    if value is None:
        return None

    normalized = str(value).strip()
    if normalized == '':
        return None
    if normalized not in allowed_values:
        raise ValueError(f"{field_name} must be one of {allowed_values}, got {value!r}")
    return normalized


def normalize_action_payload(action_payload: Any) -> Dict[str, Any]:
    """Validate the other-actions section (optional)."""
    payload = action_payload or {}
    predefined_values = payload.get('predefined') or []
    custom_values = normalize_custom_action_values(payload.get('custom'))

    if not isinstance(predefined_values, list):
        raise ValueError("action.predefined must be an array")

    unique_predefined: List[str] = []
    for value in predefined_values:
        normalized = str(value).strip()
        if normalized not in SURVEY_ACTION_OPTIONS:
            raise ValueError(f"Unsupported action value: {value!r}")
        if normalized not in unique_predefined:
            unique_predefined.append(normalized)

    return {
        'predefined': unique_predefined,
        'custom': custom_values
    }


def normalize_binary_actions_payload(binary_payload: Any) -> Dict[str, str]:
    """Validate binary action pair selections."""
    if binary_payload is None:
        return {}
    if not isinstance(binary_payload, dict):
        raise ValueError("binaryActions must be an object")

    normalized: Dict[str, str] = {}
    for pair_id, value in binary_payload.items():
        if value is None or str(value).strip() == '':
            continue
        cleaned = str(value).strip()
        if not is_valid_binary_pair_value(pair_id, cleaned):
            raise ValueError(f"Unsupported binary action {pair_id!r}: {value!r}")
        normalized[str(pair_id)] = cleaned
    return normalized


def normalize_vibes_payload(vibes_payload: Any) -> Dict[str, str]:
    """Validate vibe pair selections."""
    if vibes_payload is None:
        return {}
    if not isinstance(vibes_payload, dict):
        raise ValueError("vibes must be an object")

    normalized: Dict[str, str] = {}
    for pair_id, value in vibes_payload.items():
        if value is None or str(value).strip() == '':
            continue
        cleaned = str(value).strip()
        if not is_valid_vibe_pair_value(pair_id, cleaned):
            raise ValueError(f"Unsupported vibe {pair_id!r}: {value!r}")
        normalized[str(pair_id)] = cleaned
    return normalized


def normalize_custom_action_values(value: Any) -> List[str]:
    """Accept either the legacy single-string custom action or the new array format."""
    if value is None:
        raw_values = []
    elif isinstance(value, list):
        raw_values = value
    elif isinstance(value, str):
        raw_values = [value]
    else:
        raise ValueError("action.custom must be a string or an array")

    normalized_values: List[str] = []
    seen_values = set()

    for item in raw_values:
        normalized = title_case_action(str(item).strip())
        dedupe_key = normalized.lower()
        if not normalized or dedupe_key in seen_values:
            continue
        seen_values.add(dedupe_key)
        normalized_values.append(normalized)

    return normalized_values


def title_case_action(value: str) -> str:
    """Normalize free-text custom actions to Title Case."""
    collapsed = ' '.join(str(value or '').split())
    if not collapsed:
        return ''
    return ' '.join(
        word[:1].upper() + word[1:].lower()
        for word in collapsed.split(' ')
        if word
    )


def get_known_custom_actions() -> List[str]:
    """Return custom actions from past surveys, deduplicated case-insensitively."""
    if not DB_PATH.exists():
        return []

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        cursor = conn.execute(
            """
            SELECT action_value
            FROM trial_survey_actions
            WHERE action_type = 'custom' AND TRIM(action_value) != ''
            """
        )
        spellings: Dict[str, Dict[str, int]] = {}
        predefined_lower = {option.lower() for option in SURVEY_ACTION_OPTIONS}

        for row in cursor.fetchall():
            for value in normalize_custom_action_values(row['action_value']):
                key = value.lower()
                if key in predefined_lower:
                    continue
                bucket = spellings.setdefault(key, {})
                bucket[value] = bucket.get(value, 0) + 1

        labels = [
            max(bucket.items(), key=lambda item: item[1])[0]
            for bucket in spellings.values()
        ]
        return sorted(labels, key=str.lower)
    finally:
        conn.close()


def create_trial_survey_response(conn, trial_id: int, survey_response: Dict[str, Any]) -> int:
    """Persist a structured survey response for one trial. Returns number of saved selections."""
    cursor = conn.cursor()

    urgency = normalize_bounded_float(survey_response.get('urgency'), 'urgency')
    intensity = normalize_bounded_float(survey_response.get('intensity'), 'intensity')
    confidence = normalize_bounded_float(survey_response.get('confidence'), 'confidence')

    emotion = survey_response.get('emotion') or {}
    normalized_emotion = {
        facet: normalize_required_choice(emotion.get(facet), allowed_values, f"emotion.{facet}")
        for facet, allowed_values in SURVEY_EMOTION_OPTIONS.items()
    }

    direction = survey_response.get('direction') or {}
    normalized_direction = {
        'left_right': normalize_optional_choice(direction.get('leftRight'), BINARY_PAIR_VALUES['left_right'], 'direction.leftRight'),
        'up_down': normalize_optional_choice(direction.get('upDown'), BINARY_PAIR_VALUES['up_down'], 'direction.upDown'),
        'forward_backward': normalize_optional_choice(direction.get('forwardBackward'), BINARY_PAIR_VALUES['forward_backward'], 'direction.forwardBackward')
    }

    binary_actions = normalize_binary_actions_payload(survey_response.get('binaryActions'))
    if not binary_actions:
        for pair_id, value in normalized_direction.items():
            if value:
                binary_actions[pair_id] = value

    vibes = normalize_vibes_payload(survey_response.get('vibes'))
    if not vibes:
        texture = survey_response.get('texture') or {}
        for facet, pair_id in LEGACY_TEXTURE_FACET_TO_PAIR_ID.items():
            value = normalize_optional_choice(
                texture.get(facet),
                VIBE_PAIR_VALUES[pair_id],
                f'texture.{facet}'
            )
            if value:
                vibes[pair_id] = value

    normalized_action = normalize_action_payload(survey_response.get('action'))

    cursor.execute(
        """
        INSERT INTO trial_survey_responses
        (trial_id, urgency, intensity, mood, anxiety, focus, body, energy, clarity, social, motivation, confidence)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            trial_id,
            urgency,
            intensity,
            normalized_emotion['mood'],
            normalized_emotion['anxiety'],
            normalized_emotion['focus'],
            normalized_emotion['body'],
            normalized_emotion['energy'],
            normalized_emotion['clarity'],
            normalized_emotion['social'],
            normalized_emotion['motivation'],
            confidence
        )
    )
    response_id = cursor.lastrowid

    saved_selection_count = 0

    for pair_id, value in binary_actions.items():
        cursor.execute(
            "INSERT INTO trial_survey_binary_actions (response_id, pair_id, value) VALUES (?, ?, ?)",
            (response_id, pair_id, value)
        )
        saved_selection_count += 1

    for value in normalized_action['predefined']:
        cursor.execute(
            "INSERT INTO trial_survey_actions (response_id, action_type, action_value) VALUES (?, 'predefined', ?)",
            (response_id, value)
        )
        saved_selection_count += 1

    for custom_value in normalized_action['custom']:
        cursor.execute(
            "INSERT INTO trial_survey_actions (response_id, action_type, action_value) VALUES (?, 'custom', ?)",
            (response_id, custom_value)
        )
        saved_selection_count += 1

    for pair_id, value in vibes.items():
        cursor.execute(
            "INSERT INTO trial_survey_vibes (response_id, pair_id, value) VALUES (?, ?, ?)",
            (response_id, pair_id, value)
        )
        saved_selection_count += 1

    saved_selection_count += len(normalized_emotion)

    return saved_selection_count


PATTERN_METADATA_PATH = Path(__file__).parent / 'pattern_metadata.json'


def _normalize_tag_color(color: Optional[str]) -> Optional[str]:
    """Accept only #rrggbb hex colors for analyst tag styling."""
    if not color:
        return None
    cleaned = str(color).strip()
    if re.fullmatch(r'#[0-9a-fA-F]{6}', cleaned):
        return cleaned.lower()
    return None


def get_connection():
    """Get database connection with foreign keys enabled."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA busy_timeout = 5000")
    ensure_analysis_schema(conn)
    return conn


# Analyst classification tags. The three defaults match the NAD framing;
# analysts can create more. Colors align with the frontend map legend.
DEFAULT_ANALYSIS_TAGS = [
    ('Neutral', '#5bb5a2'),
    ('Attentive', '#d4a843'),
    ('Disruptive', '#c75b7a'),
]

# Cycled through for analyst-created tags when no color is provided.
CUSTOM_TAG_PALETTE = [
    '#6b8fd4', '#b07fc7', '#d4845f', '#5fae5f',
    '#c75b9b', '#8a8a4a', '#5fa8c7', '#a87f5f',
]


def ensure_analysis_schema(conn: sqlite3.Connection) -> None:
    """Apply lightweight schema updates for analysis features."""
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(trials)")
    columns = {row[1] for row in cursor.fetchall()}
    if 'exclude_from_analysis' not in columns:
        cursor.execute(
            "ALTER TABLE trials ADD COLUMN exclude_from_analysis INTEGER NOT NULL DEFAULT 0"
        )
        conn.commit()
    if 'analyst_notes' not in columns:
        cursor.execute("ALTER TABLE trials ADD COLUMN analyst_notes TEXT")
        cursor.execute("ALTER TABLE trials ADD COLUMN analyst_notes_updated_at DATETIME")
        conn.commit()

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS analysis_tags (
            tag_id      INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL UNIQUE COLLATE NOCASE,
            color       TEXT NOT NULL,
            is_default  INTEGER NOT NULL DEFAULT 0,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS pattern_analysis_tags (
            pattern_name  TEXT NOT NULL,
            tag_id        INTEGER NOT NULL REFERENCES analysis_tags(tag_id) ON DELETE CASCADE,
            PRIMARY KEY (pattern_name, tag_id)
        )
        """
    )
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS pattern_annotations (
            pattern_name  TEXT PRIMARY KEY,
            notes         TEXT NOT NULL DEFAULT '',
            updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    tag_count = cursor.execute("SELECT COUNT(*) FROM analysis_tags").fetchone()[0]
    if tag_count == 0:
        for name, color in DEFAULT_ANALYSIS_TAGS:
            cursor.execute(
                "INSERT INTO analysis_tags (name, color, is_default) VALUES (?, ?, 1)",
                (name, color)
            )

    _migrate_legacy_classifications(cursor)
    conn.commit()


def _migrate_legacy_classifications(cursor: sqlite3.Cursor) -> None:
    """One-time migration: boolean NAD classifications -> tag assignments + annotations."""
    legacy_exists = cursor.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'pattern_classifications'"
    ).fetchone()
    if not legacy_exists:
        return

    already_migrated = cursor.execute("SELECT COUNT(*) FROM pattern_analysis_tags").fetchone()[0]
    has_annotations = cursor.execute("SELECT COUNT(*) FROM pattern_annotations").fetchone()[0]
    if already_migrated or has_annotations:
        return

    default_tag_ids = {
        row[0]: row[1] for row in cursor.execute(
            "SELECT name, tag_id FROM analysis_tags WHERE is_default = 1"
        ).fetchall()
    }

    rows = cursor.execute(
        """
        SELECT pattern_name, is_neutral, is_attentive, is_disruptive, notes, updated_at
        FROM pattern_classifications
        """
    ).fetchall()

    for row in rows:
        flags = [
            ('Neutral', row[1]),
            ('Attentive', row[2]),
            ('Disruptive', row[3]),
        ]
        for tag_name, flag in flags:
            if flag and tag_name in default_tag_ids:
                cursor.execute(
                    "INSERT OR IGNORE INTO pattern_analysis_tags (pattern_name, tag_id) VALUES (?, ?)",
                    (row[0], default_tag_ids[tag_name])
                )
        if row[4]:
            cursor.execute(
                """
                INSERT INTO pattern_annotations (pattern_name, notes, updated_at)
                VALUES (?, ?, COALESCE(?, CURRENT_TIMESTAMP))
                ON CONFLICT(pattern_name) DO NOTHING
                """,
                (row[0], row[4], row[5])
            )


def get_pattern_metadata_catalog() -> Dict[str, Dict[str, Any]]:
    """Load audio pattern metadata keyed by filename."""
    if not PATTERN_METADATA_PATH.exists():
        return {}

    try:
        payload = json.loads(PATTERN_METADATA_PATH.read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError):
        return {}

    catalog: Dict[str, Dict[str, Any]] = {}
    for entry in payload.get('patterns', []):
        filename = entry.get('filename')
        if not filename:
            continue
        catalog[filename] = {
            'filename': filename,
            'path': entry.get('path') or f"audio_files/{filename}",
            'rmsMean': entry.get('rms_mean'),
            'durationSec': entry.get('duration'),
            'stereoBalance': entry.get('stereo_balance'),
            'stereoMovement': entry.get('stereo_movement')
        }
    return catalog


def set_trial_exclude_from_analysis(trial_id: int, excluded: bool) -> Dict[str, Any]:
    """Persist whether a trial is excluded from collective analysis."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "UPDATE trials SET exclude_from_analysis = ? WHERE trial_id = ?",
            (1 if excluded else 0, trial_id)
        )
        if cursor.rowcount == 0:
            conn.rollback()
            return {'success': False, 'error': f'Trial {trial_id} not found'}
        conn.commit()
        return {
            'success': True,
            'trialId': trial_id,
            'excludeFromAnalysis': bool(excluded)
        }
    except Exception as exc:
        conn.rollback()
        return {'success': False, 'error': str(exc)}
    finally:
        conn.close()


def _tag_row_to_payload(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        'id': row['tag_id'],
        'name': row['name'],
        'color': row['color'],
        'isDefault': bool(row['is_default'])
    }


def get_analysis_tags() -> List[Dict[str, Any]]:
    """Return the analyst tag vocabulary (defaults first, then custom by name)."""
    conn = get_connection()
    try:
        rows = conn.execute(
            """
            SELECT tag_id, name, color, is_default
            FROM analysis_tags
            ORDER BY is_default DESC, name COLLATE NOCASE
            """
        ).fetchall()
        return [_tag_row_to_payload(row) for row in rows]
    finally:
        conn.close()


def create_analysis_tag(name: str, color: Optional[str] = None) -> Dict[str, Any]:
    """Create a custom analyst tag. Color auto-assigned from a palette when omitted."""
    cleaned_name = ' '.join(str(name or '').split())
    if not cleaned_name:
        return {'success': False, 'error': 'Tag name is required'}
    if len(cleaned_name) > 40:
        return {'success': False, 'error': 'Tag name must be 40 characters or fewer'}

    conn = get_connection()
    try:
        existing = conn.execute(
            "SELECT tag_id, name, color, is_default FROM analysis_tags WHERE name = ? COLLATE NOCASE",
            (cleaned_name,)
        ).fetchone()
        if existing:
            return {'success': True, 'tag': _tag_row_to_payload(existing), 'existed': True}

        normalized_color = _normalize_tag_color(color)
        if not normalized_color:
            custom_count = conn.execute(
                "SELECT COUNT(*) FROM analysis_tags WHERE is_default = 0"
            ).fetchone()[0]
            normalized_color = CUSTOM_TAG_PALETTE[custom_count % len(CUSTOM_TAG_PALETTE)]

        cursor = conn.execute(
            "INSERT INTO analysis_tags (name, color, is_default) VALUES (?, ?, 0)",
            (cleaned_name, normalized_color)
        )
        conn.commit()
        row = conn.execute(
            "SELECT tag_id, name, color, is_default FROM analysis_tags WHERE tag_id = ?",
            (cursor.lastrowid,)
        ).fetchone()
        return {'success': True, 'tag': _tag_row_to_payload(row)}
    except Exception as exc:
        conn.rollback()
        return {'success': False, 'error': str(exc)}
    finally:
        conn.close()


def get_pattern_survey_counts(participant_id: Optional[int] = None) -> Dict[str, Any]:
    """Per-pattern trial/survey counts for queue weighting on the Test page.

    Returns, for every pattern that has trials, how many usable (non-excluded)
    trials and surveyed trials exist, plus how many of those belong to the
    given participant (0 when no participant is supplied).
    """
    conn = get_connection()
    try:
        rows = conn.execute(
            """
            SELECT p.name AS name,
                   COUNT(t.trial_id) AS trial_count,
                   SUM(CASE WHEN r.response_id IS NOT NULL THEN 1 ELSE 0 END) AS surveyed_count,
                   SUM(CASE WHEN s.participant_id = ? THEN 1 ELSE 0 END) AS participant_trials
            FROM patterns p
            LEFT JOIN trials t
                ON t.pattern_id = p.pattern_id
                AND t.exclude_from_analysis = 0
            LEFT JOIN sessions s ON s.session_id = t.session_id
            LEFT JOIN trial_survey_responses r ON r.trial_id = t.trial_id
            GROUP BY p.pattern_id
            """,
            (participant_id if participant_id is not None else -1,)
        ).fetchall()

        return {
            'participantId': participant_id,
            'patterns': [
                {
                    'name': row['name'],
                    'trialCount': row['trial_count'] or 0,
                    'surveyedCount': row['surveyed_count'] or 0,
                    'participantTrials': row['participant_trials'] or 0,
                }
                for row in rows
            ],
        }
    finally:
        conn.close()


def get_pattern_tag_state() -> Dict[str, Any]:
    """Tag assignments and analyst notes for all patterns."""
    conn = get_connection()
    try:
        pattern_tags: Dict[str, List[int]] = {}
        for row in conn.execute(
            "SELECT pattern_name, tag_id FROM pattern_analysis_tags ORDER BY pattern_name, tag_id"
        ).fetchall():
            pattern_tags.setdefault(row['pattern_name'], []).append(row['tag_id'])

        annotations: Dict[str, Dict[str, Any]] = {}
        for row in conn.execute(
            "SELECT pattern_name, notes, updated_at FROM pattern_annotations"
        ).fetchall():
            annotations[row['pattern_name']] = {
                'notes': row['notes'] or '',
                'updatedAt': row['updated_at']
            }

        return {'patternTags': pattern_tags, 'annotations': annotations}
    finally:
        conn.close()


def save_pattern_tag_state(pattern_name: str, tag_ids: List[int],
                           notes: Optional[str] = None) -> Dict[str, Any]:
    """Replace a pattern's tag assignments and upsert its analyst notes."""
    cleaned_name = str(pattern_name or '').strip()
    if not cleaned_name:
        return {'success': False, 'error': 'patternName is required'}

    try:
        normalized_ids = sorted({int(tag_id) for tag_id in (tag_ids or [])})
    except (TypeError, ValueError):
        return {'success': False, 'error': 'tagIds must be a list of integers'}

    cleaned_notes = str(notes).strip() if notes is not None else ''

    conn = get_connection()
    try:
        if normalized_ids:
            placeholders = ','.join('?' for _ in normalized_ids)
            known = {
                row[0] for row in conn.execute(
                    f"SELECT tag_id FROM analysis_tags WHERE tag_id IN ({placeholders})",
                    normalized_ids
                ).fetchall()
            }
            unknown = [tag_id for tag_id in normalized_ids if tag_id not in known]
            if unknown:
                return {'success': False, 'error': f'Unknown tag ids: {unknown}'}

        conn.execute("DELETE FROM pattern_analysis_tags WHERE pattern_name = ?", (cleaned_name,))
        for tag_id in normalized_ids:
            conn.execute(
                "INSERT INTO pattern_analysis_tags (pattern_name, tag_id) VALUES (?, ?)",
                (cleaned_name, tag_id)
            )

        conn.execute(
            """
            INSERT INTO pattern_annotations (pattern_name, notes, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(pattern_name) DO UPDATE SET
                notes = excluded.notes,
                updated_at = CURRENT_TIMESTAMP
            """,
            (cleaned_name, cleaned_notes)
        )
        conn.commit()

        annotation = conn.execute(
            "SELECT notes, updated_at FROM pattern_annotations WHERE pattern_name = ?",
            (cleaned_name,)
        ).fetchone()
        return {
            'success': True,
            'patternName': cleaned_name,
            'tagIds': normalized_ids,
            'notes': annotation['notes'],
            'updatedAt': annotation['updated_at']
        }
    except Exception as exc:
        conn.rollback()
        return {'success': False, 'error': str(exc)}
    finally:
        conn.close()


def set_trial_analyst_notes(trial_id: int, notes: Optional[str]) -> Dict[str, Any]:
    """Persist the analyst's note on a trial (separate from original research notes)."""
    cleaned_notes = str(notes).strip() if notes is not None else ''

    conn = get_connection()
    try:
        cursor = conn.execute(
            """
            UPDATE trials
            SET analyst_notes = ?, analyst_notes_updated_at = CURRENT_TIMESTAMP
            WHERE trial_id = ?
            """,
            (cleaned_notes, trial_id)
        )
        if cursor.rowcount == 0:
            conn.rollback()
            return {'success': False, 'error': f'Trial {trial_id} not found'}
        conn.commit()

        row = conn.execute(
            "SELECT analyst_notes, analyst_notes_updated_at FROM trials WHERE trial_id = ?",
            (trial_id,)
        ).fetchone()
        return {
            'success': True,
            'trialId': trial_id,
            'analystNotes': row['analyst_notes'] or '',
            'analystNotesUpdatedAt': row['analyst_notes_updated_at']
        }
    except Exception as exc:
        conn.rollback()
        return {'success': False, 'error': str(exc)}
    finally:
        conn.close()


def ensure_participant(conn, participant_code: str, age: int = None, gender: str = None,
                       handedness: str = None, notes: str = None) -> int:
    """Get or create a participant by code. Returns participant_id."""
    cursor = conn.cursor()

    # Check if exists
    cursor.execute("SELECT participant_id FROM participants WHERE participant_code = ?", (participant_code,))
    row = cursor.fetchone()

    if row:
        # Update existing participant with new info if provided
        if age or gender or handedness or notes:
            cursor.execute(
                """UPDATE participants SET
                   age = COALESCE(?, age),
                   gender = COALESCE(?, gender),
                   handedness = COALESCE(?, handedness),
                   notes = COALESCE(?, notes)
                   WHERE participant_code = ?""",
                (age, gender, handedness, notes, participant_code)
            )
        return row['participant_id']

    # Create new participant
    cursor.execute(
        "INSERT INTO participants (participant_code, age, gender, handedness, notes) VALUES (?, ?, ?, ?, ?)",
        (participant_code, age, gender, handedness, notes)
    )
    return cursor.lastrowid


def ensure_location(conn, location_id: int, location_name: str = None) -> int:
    """Ensure location exists. Returns location_id."""
    cursor = conn.cursor()

    # Check if exists by ID
    cursor.execute("SELECT location_id FROM locations WHERE location_id = ?", (location_id,))
    row = cursor.fetchone()

    if row:
        return row['location_id']

    # Create with provided name or default
    name = location_name or f"Location {location_id}"
    cursor.execute(
        "INSERT INTO locations (location_id, name) VALUES (?, ?)",
        (location_id, name)
    )
    return location_id


def ensure_pattern(conn, pattern_name: str, file_path: str, duration_ms: int = None, metadata: dict = None) -> int:
    """Get or create a pattern. Returns pattern_id."""
    cursor = conn.cursor()

    # Check if exists by file_path
    cursor.execute("SELECT pattern_id FROM patterns WHERE file_path = ?", (file_path,))
    row = cursor.fetchone()

    if row:
        return row['pattern_id']

    # Create new pattern
    metadata_json = json.dumps(metadata) if metadata else None
    cursor.execute(
        "INSERT INTO patterns (name, file_path, duration_ms, metadata_json) VALUES (?, ?, ?, ?)",
        (pattern_name, file_path, duration_ms, metadata_json)
    )
    return cursor.lastrowid


def map_phase_to_db(phase: str) -> str:
    """Validate brainwave phase names before persisting them."""
    if phase not in ('baseline', 'stimulation'):
        raise ValueError(f"Unsupported brainwave phase: {phase}")
    return phase


def create_session(conn, participant_id: int, location_id: int, session_date: str,
                   equipment_info: str = None, experimenter: str = None, notes: str = None) -> int:
    """Create a new session. Returns session_id."""
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO sessions (participant_id, location_id, session_date, equipment_info, experimenter, notes)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (participant_id, location_id, session_date, equipment_info, experimenter, notes)
    )
    return cursor.lastrowid


def create_trial(conn, session_id: int, pattern_id: int, trial_order: int,
                 start_time: str, end_time: str = None, notes: str = None) -> int:
    """Create a new trial. Returns trial_id."""
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO trials (session_id, pattern_id, trial_order, start_time, end_time, notes)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (session_id, pattern_id, trial_order, start_time, end_time, notes)
    )
    return cursor.lastrowid


def _is_persistable_trial(trial_data: Any) -> bool:
    """Accept only fully completed trials with participant feedback."""
    if not isinstance(trial_data, dict):
        return False

    return (
        trial_data.get('status') == 'completed' and
        bool(trial_data.get('startTime')) and
        bool(trial_data.get('endTime')) and
        isinstance(trial_data.get('surveyResponse'), dict) and
        bool(trial_data.get('surveyResponse'))
    )


def _get_persistable_trials(session_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Filter out calibration, incomplete, aborted, and not-started trials."""
    return [
        trial_data
        for trial_data in session_data.get('trials', [])
        if _is_persistable_trial(trial_data)
    ]


def add_trial_event(conn, trial_id: int, event_type: str, phase: str = None,
                    timestamp_ms: int = None, created_at: str = None, details: Dict[str, Any] = None):
    """Add a tester event marker to a trial."""
    cursor = conn.cursor()
    if created_at is None:
        created_at = datetime.now().isoformat()
    details_json = json.dumps(details) if details else None
    cursor.execute(
        """INSERT INTO trial_events (trial_id, event_type, phase, timestamp_ms, created_at, details_json)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (trial_id, event_type, phase, timestamp_ms, created_at, details_json)
    )
    return cursor.lastrowid


def add_brainwave_reading(conn, trial_id: int, timestamp_ms: int, phase: str,
                          signal_quality: int = None,
                          delta_abs: float = None, theta_abs: float = None,
                          alpha_abs: float = None, beta_abs: float = None,
                          gamma_abs: float = None, delta_rel: float = None,
                          theta_rel: float = None, alpha_rel: float = None,
                          beta_rel: float = None, gamma_rel: float = None):
    """Add a brainwave reading."""
    cursor = conn.cursor()
    db_phase = map_phase_to_db(phase)

    cursor.execute(
        """INSERT INTO brainwave_readings
           (trial_id, timestamp_ms, phase, signal_quality,
            delta_abs, theta_abs, alpha_abs, beta_abs, gamma_abs,
            delta_rel, theta_rel, alpha_rel, beta_rel, gamma_rel)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (trial_id, timestamp_ms, db_phase, signal_quality,
         delta_abs, theta_abs, alpha_abs, beta_abs, gamma_abs,
         delta_rel, theta_rel, alpha_rel, beta_rel, gamma_rel)
    )
    return cursor.lastrowid


def save_session_data(session_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Save complete session data to database.

    Expected session_data structure:
    {
        "sessionId": "session_1234",
        "participant_id": "P001" or int,
        "location_id": 1,
        "startedAt": "2024-01-15T10:30:00.000Z",
        "completedAt": "2024-01-15T11:00:00.000Z",
        "isAborted": false,
        "trials": [
            {
                "trialId": "session_1234_trial_1",
                "pattern": { "name": "pattern1.wav", "path": "audio_files/pattern1.wav" },
                "trialOrder": 1,
                "startTime": "...",
                "endTime": "...",
                "baselineReadings": [...],
                "stimulationReadings": [...],
                "surveyResponse": {
                    "urgency": 0.72,
                    "intensity": 0.61,
                    "confidence": 0.88,
                    "binaryActions": {
                        "left_right": "Left",
                        "forward_backward": "Forward",
                        "relax_focus": "Focus"
                    },
                    "action": {
                        "predefined": ["Lean"],
                        "custom": []
                    },
                    "emotion": {
                        "mood": "Happy",
                        "anxiety": "Relaxed",
                        "focus": "Present",
                        "body": "Grounded",
                        "energy": "Energized",
                        "clarity": "Clear",
                        "social": "Open",
                        "motivation": "Driven"
                    },
                    "vibes": {
                        "hot_cold": "Hot",
                        "smooth_rough": "Smooth"
                    }
                },
                "selectedTags": [...]
            }
        ]
    }
    """
    conn = get_connection()
    result = {
        "success": False,
        "session_id": None,
        "trials_saved": 0,
        "readings_saved": 0,
        "tags_saved": 0,
        "events_saved": 0,
        "errors": []
    }

    try:
        trials = _get_persistable_trials(session_data)
        if not trials:
            result['errors'].append('No completed trials with participant feedback to save')
            return result

        # Get or create participant with full details
        participant_code = session_data.get('participant_code') or session_data.get('participant_id', 'Unknown')
        if isinstance(participant_code, int):
            participant_code = f"P{participant_code:03d}"

        participant_id = ensure_participant(
            conn,
            participant_code=str(participant_code),
            age=session_data.get('participant_age'),
            gender=session_data.get('participant_gender'),
            handedness=session_data.get('participant_handedness'),
            notes=session_data.get('participant_notes')
        )

        # Ensure location exists with proper name
        location_id = session_data.get('location_id', 1)
        location_name = session_data.get('location_name')
        ensure_location(conn, location_id, location_name)

        # Create session with correct fields
        session_date = session_data.get('startedAt') or datetime.now().isoformat()
        equipment_info = session_data.get('equipment_info', '')
        experimenter = session_data.get('experimenter', '')

        # Build notes from user notes + metadata
        notes_parts = []
        if session_data.get('notes'):
            notes_parts.append(session_data.get('notes'))
        notes_parts.append(f"Frontend session ID: {session_data.get('sessionId', 'unknown')}")
        if session_data.get('isAborted'):
            notes_parts.append("[ABORTED]")
        notes = ' | '.join(notes_parts)

        db_session_id = create_session(
            conn,
            participant_id=participant_id,
            location_id=location_id,
            session_date=session_date,
            equipment_info=equipment_info,
            experimenter=experimenter,
            notes=notes
        )
        result['session_id'] = db_session_id

        # Process trials
        for trial_data in trials:
            # Get or create pattern
            pattern_info = trial_data.get('pattern', {})
            pattern_name = pattern_info.get('name', 'unknown')
            pattern_path = pattern_info.get('path', '')
            pattern_id = ensure_pattern(conn, pattern_name, pattern_path)

            # Create trial
            trial_id = create_trial(
                conn,
                session_id=db_session_id,
                pattern_id=pattern_id,
                trial_order=trial_data.get('trialOrder', 1),
                start_time=trial_data.get('startTime', datetime.now().isoformat()),
                end_time=trial_data.get('endTime'),
                notes=f"Status: {trial_data.get('status', 'unknown')} | Tester notes: {json.dumps(trial_data.get('testerNotes', []), ensure_ascii=True)}"
            )
            result['trials_saved'] += 1

            # Save baseline readings
            for reading in trial_data.get('baselineReadings', []):
                add_brainwave_reading(
                    conn,
                    trial_id=trial_id,
                    timestamp_ms=reading.get('timestamp_ms', 0),
                    phase='baseline',
                    signal_quality=reading.get('signal_quality'),
                    delta_abs=reading.get('delta_abs'),
                    theta_abs=reading.get('theta_abs'),
                    alpha_abs=reading.get('alpha_abs'),
                    beta_abs=reading.get('beta_abs'),
                    gamma_abs=reading.get('gamma_abs'),
                    delta_rel=reading.get('delta_rel'),
                    theta_rel=reading.get('theta_rel'),
                    alpha_rel=reading.get('alpha_rel'),
                    beta_rel=reading.get('beta_rel'),
                    gamma_rel=reading.get('gamma_rel')
                )
                result['readings_saved'] += 1

            # Save stimulation readings
            for reading in trial_data.get('stimulationReadings', []):
                add_brainwave_reading(
                    conn,
                    trial_id=trial_id,
                    timestamp_ms=reading.get('timestamp_ms', 0),
                    phase='stimulation',
                    signal_quality=reading.get('signal_quality'),
                    delta_abs=reading.get('delta_abs'),
                    theta_abs=reading.get('theta_abs'),
                    alpha_abs=reading.get('alpha_abs'),
                    beta_abs=reading.get('beta_abs'),
                    gamma_abs=reading.get('gamma_abs'),
                    delta_rel=reading.get('delta_rel'),
                    theta_rel=reading.get('theta_rel'),
                    alpha_rel=reading.get('alpha_rel'),
                    beta_rel=reading.get('beta_rel'),
                    gamma_rel=reading.get('gamma_rel')
                )
                result['readings_saved'] += 1

            survey_response = trial_data.get('surveyResponse')
            if survey_response:
                result['tags_saved'] += create_trial_survey_response(conn, trial_id, survey_response)

            # Save tester events
            for event_data in trial_data.get('testerEvents', []):
                add_trial_event(
                    conn,
                    trial_id=trial_id,
                    event_type=event_data.get('type', 'marker'),
                    phase=event_data.get('phase'),
                    timestamp_ms=event_data.get('timestampMs'),
                    created_at=event_data.get('createdAt'),
                    details=event_data.get('details')
                )
                result['events_saved'] += 1

        conn.commit()
        result['success'] = True

    except Exception as e:
        conn.rollback()
        result['errors'].append(str(e))
        import traceback
        result['errors'].append(traceback.format_exc())
    finally:
        conn.close()

    return result

def _extract_frontend_session_id(notes: Optional[str], db_session_id: int) -> str:
    """Extract frontend session ID from notes; fallback to database ID."""
    if notes:
        match = re.search(r'Frontend session ID:\s*([^|]+)', notes)
        if match:
            frontend_id = match.group(1).strip()
            if frontend_id:
                return frontend_id

    return f"db_session_{db_session_id}"


def _extract_trial_status(notes: Optional[str], end_time: Optional[str]) -> str:
    """Extract trial status from notes (e.g., 'Status: completed')."""
    if notes:
        match = re.search(r'Status:\s*([a-zA-Z_]+)', notes)
        if match:
            return match.group(1).lower()

    return 'completed' if end_time else 'unknown'


def get_analysis_sessions(limit: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Get sessions from the database in the same shape expected by Analyze UI.

    Returns:
        [
            {
                "sessionId": "...",
                "participant_id": ...,
                "location_id": ...,
                "startedAt": "...",
                "trials": [...]
            }
        ]
    """
    conn = get_connection()
    cursor = conn.cursor()

    try:
        session_query = """
            SELECT
                s.session_id,
                s.participant_id,
                s.location_id,
                s.session_date,
                s.equipment_info,
                s.experimenter,
                s.notes,
                p.participant_code,
                p.age,
                p.gender,
                p.handedness,
                p.notes AS participant_notes,
                l.name AS location_name
            FROM sessions s
            LEFT JOIN participants p ON s.participant_id = p.participant_id
            LEFT JOIN locations l ON s.location_id = l.location_id
            ORDER BY s.session_date DESC, s.session_id DESC
        """

        session_params: List[Any] = []
        if limit is not None and limit > 0:
            session_query += " LIMIT ?"
            session_params.append(limit)

        cursor.execute(session_query, session_params)
        session_rows = cursor.fetchall()

        if not session_rows:
            return []

        session_ids = [row['session_id'] for row in session_rows]
        session_placeholders = ','.join('?' for _ in session_ids)

        cursor.execute(
            f"""
            SELECT
                t.trial_id,
                t.session_id,
                t.trial_order,
                t.start_time,
                t.end_time,
                t.notes AS trial_notes,
                t.exclude_from_analysis,
                t.analyst_notes,
                t.analyst_notes_updated_at,
                p.name AS pattern_name,
                p.file_path AS pattern_path
            FROM trials t
            LEFT JOIN patterns p ON t.pattern_id = p.pattern_id
            WHERE t.session_id IN ({session_placeholders})
            ORDER BY t.session_id, t.trial_order, t.trial_id
            """,
            session_ids
        )
        trial_rows = cursor.fetchall()

        trials_by_session: Dict[int, List[sqlite3.Row]] = {}
        trial_ids: List[int] = []
        for row in trial_rows:
            trials_by_session.setdefault(row['session_id'], []).append(row)
            trial_ids.append(row['trial_id'])

        readings_by_trial: Dict[int, Dict[str, List[Dict[str, Any]]]] = {}
        survey_rows_by_trial: Dict[int, Dict[str, Any]] = {}
        binary_actions_by_response: Dict[int, Dict[str, str]] = {}
        actions_by_response: Dict[int, Dict[str, Any]] = {}
        vibes_by_response: Dict[int, Dict[str, str]] = {}
        events_by_trial: Dict[int, List[Dict[str, Any]]] = {}

        if trial_ids:
            trial_placeholders = ','.join('?' for _ in trial_ids)

            cursor.execute(
                f"""
                SELECT
                    trial_id,
                    timestamp_ms,
                    phase,
                    signal_quality,
                    delta_abs, theta_abs, alpha_abs, beta_abs, gamma_abs,
                    delta_rel, theta_rel, alpha_rel, beta_rel, gamma_rel
                FROM brainwave_readings
                WHERE trial_id IN ({trial_placeholders})
                ORDER BY trial_id, timestamp_ms
                """,
                trial_ids
            )

            for row in cursor.fetchall():
                trial_id = row['trial_id']
                phase = row['phase'] or 'baseline'

                reading = {
                    'timestamp_ms': row['timestamp_ms'],
                    'signal_quality': row['signal_quality'],
                    'delta_abs': row['delta_abs'],
                    'theta_abs': row['theta_abs'],
                    'alpha_abs': row['alpha_abs'],
                    'beta_abs': row['beta_abs'],
                    'gamma_abs': row['gamma_abs'],
                    'delta_rel': row['delta_rel'],
                    'theta_rel': row['theta_rel'],
                    'alpha_rel': row['alpha_rel'],
                    'beta_rel': row['beta_rel'],
                    'gamma_rel': row['gamma_rel']
                }

                trial_bucket = readings_by_trial.setdefault(trial_id, {})
                trial_bucket.setdefault(phase, []).append(reading)

            cursor.execute(
                f"""
                SELECT
                    response_id,
                    trial_id,
                    urgency,
                    intensity,
                    mood,
                    anxiety,
                    focus,
                    body,
                    energy,
                    clarity,
                    social,
                    motivation,
                    confidence
                FROM trial_survey_responses
                WHERE trial_id IN ({trial_placeholders})
                ORDER BY trial_id
                """,
                trial_ids
            )

            for row in cursor.fetchall():
                survey_rows_by_trial[row['trial_id']] = dict(row)

            response_ids = [row['response_id'] for row in survey_rows_by_trial.values()]
            if response_ids:
                response_placeholders = ','.join('?' for _ in response_ids)

                cursor.execute(
                    f"""
                    SELECT response_id, pair_id, value
                    FROM trial_survey_binary_actions
                    WHERE response_id IN ({response_placeholders})
                    ORDER BY response_id, pair_id
                    """,
                    response_ids
                )

                for row in cursor.fetchall():
                    binary_actions_by_response.setdefault(row['response_id'], {})[row['pair_id']] = row['value']

                cursor.execute(
                    f"""
                    SELECT response_id, action_type, action_value
                    FROM trial_survey_actions
                    WHERE response_id IN ({response_placeholders})
                    ORDER BY response_id, action_type, action_value
                    """,
                    response_ids
                )

                for row in cursor.fetchall():
                    action_bucket = actions_by_response.setdefault(
                        row['response_id'],
                        {'predefined': [], 'custom': []}
                    )
                    if row['action_type'] == 'predefined':
                        action_bucket['predefined'].append(row['action_value'])
                    else:
                        action_bucket['custom'].append(row['action_value'])

                cursor.execute(
                    f"""
                    SELECT response_id, pair_id, value
                    FROM trial_survey_vibes
                    WHERE response_id IN ({response_placeholders})
                    ORDER BY response_id, pair_id
                    """,
                    response_ids
                )

                for row in cursor.fetchall():
                    vibes_by_response.setdefault(row['response_id'], {})[row['pair_id']] = row['value']

            cursor.execute(
                f"""
                SELECT
                    event_id,
                    trial_id,
                    event_type,
                    phase,
                    timestamp_ms,
                    created_at,
                    details_json
                FROM trial_events
                WHERE trial_id IN ({trial_placeholders})
                ORDER BY trial_id, timestamp_ms, event_id
                """,
                trial_ids
            )

            for row in cursor.fetchall():
                trial_id = row['trial_id']
                details_json = row['details_json']
                details_obj = None
                if details_json:
                    try:
                        details_obj = json.loads(details_json)
                    except json.JSONDecodeError:
                        details_obj = None

                events_by_trial.setdefault(trial_id, []).append({
                    'type': row['event_type'],
                    'phase': row['phase'],
                    'timestampMs': row['timestamp_ms'],
                    'createdAt': row['created_at'],
                    'details': details_obj
                })

        sessions: List[Dict[str, Any]] = []
        for session_row in session_rows:
            db_session_id = session_row['session_id']
            raw_notes = session_row['notes'] or ''
            session_id = _extract_frontend_session_id(raw_notes, db_session_id)

            session_payload = {
                'sessionId': session_id,
                'dbSessionId': db_session_id,
                'participant_id': session_row['participant_id'],
                'location_id': session_row['location_id'],
                'equipment_info': session_row['equipment_info'] or '',
                'experimenter': session_row['experimenter'] or '',
                'notes': raw_notes,
                'participant_code': session_row['participant_code'],
                'participant_age': session_row['age'],
                'participant_gender': session_row['gender'],
                'participant_handedness': session_row['handedness'],
                'participant_notes': session_row['participant_notes'],
                'location_name': session_row['location_name'] or f"Location {session_row['location_id']}",
                'startedAt': session_row['session_date'],
                'completedAt': None,
                'isAborted': '[ABORTED]' in raw_notes,
                'calibrationReadings': [],
                'trials': []
            }

            session_trials = trials_by_session.get(db_session_id, [])

            for trial_row in session_trials:
                trial_id = trial_row['trial_id']
                baseline_phase_readings = readings_by_trial.get(trial_id, {}).get('baseline', [])
                stimulation_phase_readings = readings_by_trial.get(trial_id, {}).get('stimulation', [])
                survey_row = survey_rows_by_trial.get(trial_id)
                survey_response = None
                selected_tags: List[Dict[str, Any]] = []

                if survey_row:
                    response_id = survey_row['response_id']
                    binary_actions = binary_actions_by_response.get(response_id, {})
                    action = actions_by_response.get(response_id, {'predefined': [], 'custom': []})
                    vibes = vibes_by_response.get(response_id, {})
                    survey_response = {
                        'urgency': survey_row['urgency'],
                        'intensity': survey_row['intensity'],
                        'binaryActions': dict(binary_actions),
                        'action': {
                            'predefined': list(action.get('predefined', [])),
                            'custom': normalize_custom_action_values(action.get('custom', []))
                        },
                        'emotion': {
                            'mood': survey_row['mood'],
                            'anxiety': survey_row['anxiety'],
                            'focus': survey_row['focus'],
                            'body': survey_row['body'],
                            'energy': survey_row['energy'],
                            'clarity': survey_row['clarity'],
                            'social': survey_row['social'],
                            'motivation': survey_row['motivation']
                        },
                        'vibes': dict(vibes),
                        'confidence': survey_row['confidence']
                    }
                    selected_tags = flatten_survey_response_to_tags(survey_response)

                trial_notes_blob = trial_row['trial_notes'] or ''
                trial_payload = {
                    'trialId': f"{session_id}_trial_{trial_row['trial_order']}",
                    'dbTrialId': trial_id,
                    'excludeFromAnalysis': bool(trial_row['exclude_from_analysis']),
                    'analystNotes': trial_row['analyst_notes'] or '',
                    'analystNotesUpdatedAt': trial_row['analyst_notes_updated_at'],
                    'notesRaw': trial_notes_blob,
                    'pattern': {
                        'name': trial_row['pattern_name'],
                        'path': trial_row['pattern_path']
                    },
                    'trialOrder': trial_row['trial_order'],
                    'startTime': trial_row['start_time'],
                    'endTime': trial_row['end_time'],
                    'baselineReadings': list(baseline_phase_readings),
                    'stimulationReadings': stimulation_phase_readings,
                    'surveyResponse': survey_response,
                    'selectedTags': selected_tags,
                    'testerNotes': [],
                    'testerEvents': events_by_trial.get(trial_id, []),
                    'status': _extract_trial_status(trial_row['trial_notes'], trial_row['end_time'])
                }

                notes_match = re.search(r'Tester notes:\s*(\[.*\])', trial_notes_blob)
                if notes_match:
                    try:
                        trial_payload['testerNotes'] = json.loads(notes_match.group(1))
                    except json.JSONDecodeError:
                        trial_payload['testerNotes'] = []

                session_payload['trials'].append(trial_payload)

            completed_trial_end_times = [
                trial['endTime']
                for trial in session_payload['trials']
                if trial.get('status') == 'completed' and trial.get('endTime')
            ]
            if completed_trial_end_times:
                session_payload['completedAt'] = max(completed_trial_end_times)

            sessions.append(session_payload)

        return sessions

    finally:
        conn.close()


def get_all_tags() -> List[Dict[str, Any]]:
    """Return the available structured survey taxonomy as a flat tag catalog."""
    tags: List[Dict[str, Any]] = []

    for action in SURVEY_ACTION_OPTIONS:
        tags.append({
            'tag_id': f"action:{_slugify_fragment(action)}",
            'tag_name': action,
            'category': 'action',
            'description': 'Predefined action response'
        })

    for pair_id, (option_a, option_b) in SURVEY_BINARY_PAIRS:
        for value in (option_a, option_b):
            tags.append({
                'tag_id': f"binary:{pair_id}:{_slugify_fragment(value)}",
                'tag_name': value,
                'category': 'binary_action',
                'description': f'Binary action pair {pair_id}'
            })

    for pair_id, (option_a, option_b) in SURVEY_VIBE_PAIRS:
        for value in (option_a, option_b):
            tags.append({
                'tag_id': f"vibe:{pair_id}:{_slugify_fragment(value)}",
                'tag_name': value,
                'category': 'vibe',
                'description': f'Vibe pair {pair_id}'
            })

    for facet, values in SURVEY_EMOTION_OPTIONS.items():
        for value in values:
            tags.append({
                'tag_id': f"emotion:{facet}:{_slugify_fragment(value)}",
                'tag_name': value,
                'category': f"emotion:{facet}",
                'description': f"{facet.capitalize()} response"
            })

    return tags


# Sessions before the survey v2 migration used a different (shorter) survey
# flow, so their trial durations don't represent the current protocol.
TIMING_STATS_SINCE_DATE = '2026-06-08'

# Plausibility bounds for a completed trial cycle (baseline + stimulation +
# survey). Below the minimum the survey can't have been the real 12-step flow
# (dev/aborted runs); above the maximum the session was likely left idle.
TIMING_STATS_MIN_TRIAL_SEC = 70
TIMING_STATS_MAX_TRIAL_SEC = 900

# Cap on session start -> first trial gap; longer gaps mean the page sat idle.
TIMING_STATS_MAX_SETUP_SEC = 600


def _percentile(sorted_values: List[float], fraction: float) -> float:
    """Linear-interpolated percentile of an already-sorted list."""
    if not sorted_values:
        return 0.0
    if len(sorted_values) == 1:
        return sorted_values[0]
    position = fraction * (len(sorted_values) - 1)
    lower = int(position)
    upper = min(lower + 1, len(sorted_values) - 1)
    weight = position - lower
    return sorted_values[lower] * (1 - weight) + sorted_values[upper] * weight


def _summarize_seconds(values: List[float]) -> Dict[str, Any]:
    ordered = sorted(values)
    return {
        'n': len(ordered),
        'medianSec': round(_percentile(ordered, 0.5), 1),
        'p25Sec': round(_percentile(ordered, 0.25), 1),
        'p75Sec': round(_percentile(ordered, 0.75), 1),
    }


def get_session_timing_stats() -> Dict[str, Any]:
    """Empirical session timing derived from recorded trials.

    Returns per-trial cycle stats (baseline start -> survey complete) and
    setup stats (session start -> first trial start), filtered to sessions
    using the current survey flow and excluding dev/test data.
    """
    empty = {
        'trial': _summarize_seconds([]),
        'setup': _summarize_seconds([]),
        'maxObservedQueue': 0,
        'filters': {
            'sinceDate': TIMING_STATS_SINCE_DATE,
            'minTrialSec': TIMING_STATS_MIN_TRIAL_SEC,
            'maxTrialSec': TIMING_STATS_MAX_TRIAL_SEC,
            'excludedParticipants': ['_test'],
        },
    }
    if not DB_PATH.exists():
        return empty

    conn = get_connection()
    try:
        trial_rows = conn.execute(
            """
            SELECT (julianday(t.end_time) - julianday(t.start_time)) * 86400.0 AS duration_sec
            FROM trials t
            JOIN sessions s ON s.session_id = t.session_id
            JOIN participants p ON p.participant_id = s.participant_id
            WHERE t.end_time IS NOT NULL
              AND p.participant_code != '_test'
              AND s.session_date >= ?
              AND (julianday(t.end_time) - julianday(t.start_time)) * 86400.0 BETWEEN ? AND ?
            """,
            (TIMING_STATS_SINCE_DATE, TIMING_STATS_MIN_TRIAL_SEC, TIMING_STATS_MAX_TRIAL_SEC),
        ).fetchall()
        trial_durations = [float(row['duration_sec']) for row in trial_rows]

        setup_rows = conn.execute(
            """
            SELECT (julianday(MIN(t.start_time)) - julianday(s.session_date)) * 86400.0 AS setup_sec
            FROM sessions s
            JOIN trials t ON t.session_id = s.session_id
            JOIN participants p ON p.participant_id = s.participant_id
            WHERE p.participant_code != '_test'
              AND s.session_date >= ?
            GROUP BY s.session_id
            HAVING setup_sec BETWEEN 0 AND ?
            """,
            (TIMING_STATS_SINCE_DATE, TIMING_STATS_MAX_SETUP_SEC),
        ).fetchall()
        setup_durations = [float(row['setup_sec']) for row in setup_rows]

        max_queue_row = conn.execute(
            """
            SELECT MAX(trial_count) AS max_queue FROM (
                SELECT COUNT(*) AS trial_count
                FROM trials t
                JOIN sessions s ON s.session_id = t.session_id
                JOIN participants p ON p.participant_id = s.participant_id
                WHERE p.participant_code != '_test'
                  AND s.session_date >= ?
                GROUP BY t.session_id
            )
            """,
            (TIMING_STATS_SINCE_DATE,),
        ).fetchone()
        max_observed_queue = int(max_queue_row['max_queue'] or 0)
    finally:
        conn.close()

    return {
        'trial': _summarize_seconds(trial_durations),
        'setup': _summarize_seconds(setup_durations),
        'maxObservedQueue': max_observed_queue,
        'filters': empty['filters'],
    }


def get_all_locations() -> List[Dict[str, Any]]:
    """Get all locations from database."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT location_id, name, description, address FROM locations ORDER BY name")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_all_participants() -> List[Dict[str, Any]]:
    """Get all participants from database."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT participant_id, participant_code, age, gender, handedness, created_at, notes FROM participants ORDER BY participant_code")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


if __name__ == "__main__":
    # Test the database connection
    print(f"Database path: {DB_PATH}")
    print(f"Database exists: {DB_PATH.exists()}")

    conn = get_connection()
    cursor = conn.cursor()

    # List tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = cursor.fetchall()
    print(f"Tables: {[t['name'] for t in tables]}")

    conn.close()
