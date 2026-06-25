#!/usr/bin/env python3
"""
HTTP Server for Haptic Research

Serves static files and handles API requests. Optional WashU Entra RBAC via AUTH_REQUIRED=true.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

from auth import (
    api_me,
    enforce_request_auth,
    init_auth,
    log_audit,
    require_coordinator_for_new_participant,
)
from auth_config import auth_required

ROOT = Path(__file__).resolve().parent


def _load_env_file() -> None:
    env_path = ROOT / '.env'
    if not env_path.is_file():
        return
    for line in env_path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, _, value = line.partition('=')
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_env_file()

PORT = int(os.environ.get('PORT', '8000'))
HOST = os.environ.get('HOST', '127.0.0.1')
AUDIO_DIR = 'audio_files'

try:
    from db_handler import (
        save_session_data,
        get_analysis_sessions,
        get_pattern_metadata_catalog,
        set_trial_exclude_from_analysis,
        get_all_tags,
        get_all_locations,
        get_all_participants,
        get_known_custom_actions,
        get_session_timing_stats,
        get_analysis_tags,
        create_analysis_tag,
        get_pattern_tag_state,
        save_pattern_tag_state,
        set_trial_analyst_notes,
        get_pattern_survey_counts,
        resolve_participant_from_name,
    )
    from participant_ids import is_pepper_configured

    DB_AVAILABLE = True
except ImportError as exc:
    print(f'Warning: Database handler not available: {exc}')
    DB_AVAILABLE = False

    def is_pepper_configured() -> bool:
        return False


app = Flask(__name__)
init_auth(app)


@app.before_request
def _auth_gate():
    blocked = enforce_request_auth()
    if blocked is not None:
        return blocked


@app.route('/api/me')
def route_me():
    return api_me()


@app.route('/api/status')
def route_status():
    audio_count = 0
    if os.path.exists(AUDIO_DIR):
        audio_count = len([
            f for f in os.listdir(AUDIO_DIR)
            if f.lower().endswith(('.mp3', '.wav', '.ogg', '.m4a'))
        ])
    return jsonify({
        'status': 'ok',
        'database_available': DB_AVAILABLE,
        'participant_lookup_available': DB_AVAILABLE and is_pepper_configured(),
        'auth_required': auth_required(),
        'audio_dir': AUDIO_DIR,
        'audio_files_count': audio_count,
    })


@app.route('/api/list-audio-files')
def route_list_audio():
    files = []
    if os.path.exists(AUDIO_DIR):
        for filename in sorted(os.listdir(AUDIO_DIR)):
            if filename.lower().endswith(('.mp3', '.wav', '.ogg', '.m4a')):
                filepath = os.path.join(AUDIO_DIR, filename)
                if os.path.isfile(filepath):
                    files.append({
                        'name': filename,
                        'path': f'/audio_files/{filename}',
                        'size': os.path.getsize(filepath),
                    })
    return jsonify(files)


@app.route('/api/tags')
def route_tags():
    if not DB_AVAILABLE:
        return jsonify({'error': 'Database not available'}), 500
    return jsonify(get_all_tags())


@app.route('/api/locations')
def route_locations():
    if not DB_AVAILABLE:
        return jsonify({'error': 'Database not available'}), 500
    return jsonify(get_all_locations())


@app.route('/api/participants')
def route_participants():
    if not DB_AVAILABLE:
        return jsonify({'error': 'Database not available'}), 500
    log_audit('participants.list')
    return jsonify(get_all_participants())


@app.route('/api/survey/custom-actions')
def route_custom_actions():
    if not DB_AVAILABLE:
        return jsonify({'error': 'Database not available'}), 500
    return jsonify({'actions': get_known_custom_actions()})


@app.route('/api/analysis/pattern-metadata')
def route_pattern_metadata():
    if not DB_AVAILABLE:
        return jsonify({'error': 'Database not available'}), 500
    return jsonify(get_pattern_metadata_catalog())


@app.route('/api/analysis/sessions')
def route_analysis_sessions():
    if not DB_AVAILABLE:
        return jsonify({'error': 'Database not available'}), 500
    limit_param = request.args.get('limit')
    try:
        limit = int(limit_param) if limit_param else None
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid limit parameter'}), 400
    log_audit('analysis.sessions.read', resource=f'limit={limit}')
    return jsonify(get_analysis_sessions(limit=limit))


@app.route('/api/analysis/tags', methods=['GET'])
def route_analysis_tags_get():
    if not DB_AVAILABLE:
        return jsonify({'error': 'Database not available'}), 500
    return jsonify({'tags': get_analysis_tags()})


@app.route('/api/analysis/pattern-tags', methods=['GET'])
def route_pattern_tags_get():
    if not DB_AVAILABLE:
        return jsonify({'error': 'Database not available'}), 500
    return jsonify(get_pattern_tag_state())


@app.route('/api/timing-stats')
def route_timing_stats():
    if not DB_AVAILABLE:
        return jsonify({'error': 'Database not available'}), 500
    return jsonify(get_session_timing_stats())


@app.route('/api/pattern-stats')
def route_pattern_stats():
    if not DB_AVAILABLE:
        return jsonify({'error': 'Database not available'}), 500
    participant_param = request.args.get('participant_id')
    try:
        participant_id = int(participant_param) if participant_param else None
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid participant_id parameter'}), 400
    return jsonify(get_pattern_survey_counts(participant_id))


@app.route('/api/session', methods=['POST'])
def route_save_session():
    if not DB_AVAILABLE:
        return jsonify({'error': 'Database not available'}), 500
    data = request.get_json(silent=True) or {}
    try:
        result = save_session_data(data)
        if result.get('success'):
            log_audit('session.save', resource=data.get('sessionId'))
            return jsonify(result), 200
        return jsonify(result), 500
    except Exception as exc:
        import traceback
        return jsonify({'error': str(exc), 'traceback': traceback.format_exc()}), 500


@app.route('/api/analysis/trials/exclude', methods=['POST'])
def route_trial_exclude():
    if not DB_AVAILABLE:
        return jsonify({'error': 'Database not available'}), 500
    data = request.get_json(silent=True) or {}
    trial_id = data.get('trialId')
    excluded = data.get('excludeFromAnalysis')
    if trial_id is None or excluded is None:
        return jsonify({'error': 'trialId and excludeFromAnalysis are required'}), 400
    try:
        trial_id_int = int(trial_id)
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid trialId'}), 400
    result = set_trial_exclude_from_analysis(trial_id_int, bool(excluded))
    status = 200 if result.get('success') else 404
    if result.get('success'):
        log_audit('analysis.trial.exclude', resource=f'trial_id={trial_id_int}')
    return jsonify(result), status


@app.route('/api/analysis/tags', methods=['POST'])
def route_analysis_tags_post():
    if not DB_AVAILABLE:
        return jsonify({'error': 'Database not available'}), 500
    data = request.get_json(silent=True) or {}
    result = create_analysis_tag(data.get('name'), data.get('color'))
    status = 200 if result.get('success') else 400
    return jsonify(result), status


@app.route('/api/analysis/pattern-tags', methods=['POST'])
def route_pattern_tags_post():
    if not DB_AVAILABLE:
        return jsonify({'error': 'Database not available'}), 500
    data = request.get_json(silent=True) or {}
    pattern_name = data.get('patternName')
    if not pattern_name or not str(pattern_name).strip():
        return jsonify({'error': 'patternName is required'}), 400
    result = save_pattern_tag_state(
        pattern_name=str(pattern_name),
        tag_ids=data.get('tagIds') or [],
        notes=data.get('notes'),
    )
    status = 200 if result.get('success') else 400
    return jsonify(result), status


@app.route('/api/analysis/trials/notes', methods=['POST'])
def route_trial_notes():
    if not DB_AVAILABLE:
        return jsonify({'error': 'Database not available'}), 500
    data = request.get_json(silent=True) or {}
    trial_id = data.get('trialId')
    try:
        trial_id_int = int(trial_id)
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid trialId'}), 400
    result = set_trial_analyst_notes(trial_id_int, data.get('analystNotes'))
    status = 200 if result.get('success') else 404
    return jsonify(result), status


@app.route('/api/participants/resolve', methods=['POST'])
def route_participants_resolve():
    if not DB_AVAILABLE:
        return jsonify({'success': False, 'error': 'Database not available'}), 500
    if not is_pepper_configured():
        return jsonify({
            'success': False,
            'error': 'Participant lookup not configured. Run scripts/generate_study_pepper.sh on this machine.',
        }), 503

    data = request.get_json(silent=True) or {}
    blocked = require_coordinator_for_new_participant(data)
    if blocked is not None:
        return blocked

    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'success': False, 'error': 'Name is required'}), 400

    age_raw = data.get('age')
    age = None
    if age_raw is not None and age_raw != '':
        try:
            age = int(age_raw)
        except (TypeError, ValueError):
            return jsonify({'success': False, 'error': 'Invalid age'}), 400

    notes = data.get('notes')
    if notes is not None:
        notes = str(notes).strip() or None

    try:
        result = resolve_participant_from_name(
            name,
            age=age,
            gender=data.get('gender') or None,
            handedness=data.get('handedness') or None,
            notes=notes,
            dry_run=bool(data.get('dry_run')),
            require_existing=bool(data.get('require_existing')),
        )
    except RuntimeError as exc:
        return jsonify({'success': False, 'error': str(exc)}), 503
    except ValueError as exc:
        return jsonify({'success': False, 'error': str(exc)}), 400

    status = 200 if result.get('success') else 400
    if result.get('success'):
        action = 'participants.resolve.existing' if data.get('require_existing') else 'participants.resolve.enroll'
        log_audit(action, resource=result.get('participant_code'))
    return jsonify(result), status


@app.route('/api/sessions/bulk', methods=['POST'])
def route_sessions_bulk():
    if not DB_AVAILABLE:
        return jsonify({'error': 'Database not available'}), 500
    data = request.get_json(silent=True) or {}
    sessions = data.get('sessions', [])
    results = []
    for session_data in sessions:
        try:
            results.append(save_session_data(session_data))
        except Exception as exc:
            results.append({
                'success': False,
                'error': str(exc),
                'sessionId': session_data.get('sessionId', 'unknown'),
            })
    success_count = sum(1 for r in results if r.get('success'))
    if success_count:
        log_audit('sessions.bulk', resource=f'count={success_count}')
    return jsonify({
        'success': success_count == len(sessions),
        'total': len(sessions),
        'saved': success_count,
        'failed': len(sessions) - success_count,
        'results': results,
    })


@app.route('/')
def route_index():
    return send_from_directory(ROOT, 'index.html')


@app.route('/<path:filename>')
def route_static(filename: str):
    return send_from_directory(ROOT, filename)


if __name__ == '__main__':
    os.makedirs(AUDIO_DIR, exist_ok=True)

    print('=' * 50)
    print('Haptic Research Server')
    print('=' * 50)
    print(f'Database available: {DB_AVAILABLE}')
    print(f'Auth required: {auth_required()}')
    if auth_required():
        from auth import entra_configured
        print(f'Entra configured: {entra_configured()}')
    print()
    print(f'Server running at http://{HOST}:{PORT}/')
    print('Press Ctrl+C to stop')

    app.run(host=HOST, port=PORT, debug=False, threaded=True)
