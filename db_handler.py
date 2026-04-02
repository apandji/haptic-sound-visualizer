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

DB_PATH = Path(__file__).parent / 'haptic_research.db'

SURVEY_ACTION_OPTIONS = ('Lean', 'Slide', 'Turn', 'Twist', 'Run', 'Jump')
SURVEY_DIRECTION_AXES = {
    'left_right': ('Left', 'Right'),
    'up_down': ('Up', 'Down'),
    'forward_backward': ('Forward', 'Backward')
}
SURVEY_TEXTURE_FACETS = {
    'temperature': ('Hot', 'Cold'),
    'hardness': ('Hard', 'Soft'),
    'surface': ('Smooth', 'Rough')
}
SURVEY_EMOTION_OPTIONS = {
    'mood': ('Distressed', 'Sad', 'Balanced', 'Happy', 'Ecstatic', 'Unsure'),
    'anxiety': ('Meditative', 'Relaxed', 'Steady', 'Cautious', 'Anxious', 'Unsure'),
    'focus': ('Scattered', 'Distracted', 'Present', 'Engaged', 'Absorbed', 'Unsure'),
    'body': ('Tense', 'Tight', 'Neutral', 'Loose', 'Grounded', 'Unsure'),
    'energy': ('Depleted', 'Tired', 'Neutral', 'Energized', 'Charged', 'Unsure'),
    'clarity': ('Confused', 'Foggy', 'Clear', 'Sharp', 'Lucid', 'Unsure'),
    'social': ('Withdrawn', 'Reserved', 'Open', 'Connected', 'Expansive', 'Unsure'),
    'motivation': ('Resistant', 'Reluctant', 'Willing', 'Driven', 'Compelled', 'Unsure')
}


def _slugify_fragment(value: str) -> str:
    """Create a stable lowercase slug for synthesized tag IDs."""
    slug = re.sub(r'[^a-z0-9]+', '-', str(value).strip().lower()).strip('-')
    return slug or 'unknown'


def flatten_survey_response_to_tags(survey_response: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Derive analysis-friendly flat tags from a structured survey response."""
    if not survey_response:
        return []

    derived_tags: List[Dict[str, Any]] = []

    direction = survey_response.get('direction') or {}
    for axis_key, axis_label in (
        ('leftRight', 'Direction'),
        ('upDown', 'Direction'),
        ('forwardBackward', 'Direction')
    ):
        value = direction.get(axis_key)
        if not value:
            continue
        derived_tags.append({
            'id': f"direction:{axis_key}:{_slugify_fragment(value)}",
            'label': f"{axis_label}: {value}",
            'category': 'direction',
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

    texture = survey_response.get('texture') or {}
    for facet, label in (
        ('temperature', 'Temperature'),
        ('hardness', 'Hardness'),
        ('surface', 'Surface')
    ):
        value = texture.get(facet)
        if not value:
            continue
        derived_tags.append({
            'id': f"texture:{facet}:{_slugify_fragment(value)}",
            'label': f"{label}: {value}",
            'category': f"texture:{facet}",
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
    """Validate the action section and require at least one response."""
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

    if not unique_predefined and not custom_values:
        raise ValueError("At least one action response is required")

    return {
        'predefined': unique_predefined,
        'custom': custom_values
    }


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
        normalized = str(item).strip()
        dedupe_key = normalized.lower()
        if not normalized or dedupe_key in seen_values:
            continue
        seen_values.add(dedupe_key)
        normalized_values.append(normalized)

    return normalized_values


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
        'left_right': normalize_optional_choice(direction.get('leftRight'), SURVEY_DIRECTION_AXES['left_right'], 'direction.leftRight'),
        'up_down': normalize_optional_choice(direction.get('upDown'), SURVEY_DIRECTION_AXES['up_down'], 'direction.upDown'),
        'forward_backward': normalize_optional_choice(direction.get('forwardBackward'), SURVEY_DIRECTION_AXES['forward_backward'], 'direction.forwardBackward')
    }

    texture = survey_response.get('texture') or {}
    normalized_texture = {
        'temperature': normalize_optional_choice(texture.get('temperature'), SURVEY_TEXTURE_FACETS['temperature'], 'texture.temperature'),
        'hardness': normalize_optional_choice(texture.get('hardness'), SURVEY_TEXTURE_FACETS['hardness'], 'texture.hardness'),
        'surface': normalize_optional_choice(texture.get('surface'), SURVEY_TEXTURE_FACETS['surface'], 'texture.surface')
    }

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

    for axis, value in normalized_direction.items():
        if not value:
            continue
        cursor.execute(
            "INSERT INTO trial_survey_directions (response_id, axis, value) VALUES (?, ?, ?)",
            (response_id, axis, value)
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

    for facet, value in normalized_texture.items():
        if not value:
            continue
        cursor.execute(
            "INSERT INTO trial_survey_textures (response_id, facet, value) VALUES (?, ?, ?)",
            (response_id, facet, value)
        )
        saved_selection_count += 1

    saved_selection_count += len(normalized_emotion)

    return saved_selection_count


def get_connection():
    """Get database connection with foreign keys enabled."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


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
                    "direction": {
                        "leftRight": "Left",
                        "upDown": null,
                        "forwardBackward": "Forward"
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
                    "texture": {
                        "temperature": "Hot",
                        "hardness": null,
                        "surface": "Smooth"
                    },
                    "confidence": 0.88
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
        trials = session_data.get('trials', [])

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
        directions_by_response: Dict[int, Dict[str, str]] = {}
        actions_by_response: Dict[int, Dict[str, Any]] = {}
        textures_by_response: Dict[int, Dict[str, str]] = {}
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
                    SELECT response_id, axis, value
                    FROM trial_survey_directions
                    WHERE response_id IN ({response_placeholders})
                    ORDER BY response_id, axis
                    """,
                    response_ids
                )

                for row in cursor.fetchall():
                    directions_by_response.setdefault(row['response_id'], {})[row['axis']] = row['value']

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
                    SELECT response_id, facet, value
                    FROM trial_survey_textures
                    WHERE response_id IN ({response_placeholders})
                    ORDER BY response_id, facet
                    """,
                    response_ids
                )

                for row in cursor.fetchall():
                    textures_by_response.setdefault(row['response_id'], {})[row['facet']] = row['value']

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
                    direction = directions_by_response.get(response_id, {})
                    action = actions_by_response.get(response_id, {'predefined': [], 'custom': []})
                    texture = textures_by_response.get(response_id, {})
                    survey_response = {
                        'urgency': survey_row['urgency'],
                        'intensity': survey_row['intensity'],
                        'direction': {
                            'leftRight': direction.get('left_right'),
                            'upDown': direction.get('up_down'),
                            'forwardBackward': direction.get('forward_backward')
                        },
                        'action': {
                            'predefined': list(action.get('predefined', [])),
                            'custom': list(action.get('custom', []))
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
                        'texture': {
                            'temperature': texture.get('temperature'),
                            'hardness': texture.get('hardness'),
                            'surface': texture.get('surface')
                        },
                        'confidence': survey_row['confidence']
                    }
                    selected_tags = flatten_survey_response_to_tags(survey_response)

                trial_payload = {
                    'trialId': f"{session_id}_trial_{trial_row['trial_order']}",
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

                trial_notes_blob = trial_row['trial_notes'] or ''
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

    for axis_values in SURVEY_DIRECTION_AXES.values():
        for value in axis_values:
            tags.append({
                'tag_id': f"direction:{_slugify_fragment(value)}",
                'tag_name': value,
                'category': 'direction',
                'description': 'Optional directional response'
            })

    for facet, values in SURVEY_EMOTION_OPTIONS.items():
        for value in values:
            tags.append({
                'tag_id': f"emotion:{facet}:{_slugify_fragment(value)}",
                'tag_name': value,
                'category': f"emotion:{facet}",
                'description': f"{facet.capitalize()} response"
            })

    for facet, values in SURVEY_TEXTURE_FACETS.items():
        for value in values:
            tags.append({
                'tag_id': f"texture:{facet}:{_slugify_fragment(value)}",
                'tag_name': value,
                'category': f"texture:{facet}",
                'description': 'Optional texture response'
            })

    return tags


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
