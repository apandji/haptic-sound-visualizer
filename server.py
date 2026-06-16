#!/usr/bin/env python3
"""
HTTP Server for Haptic Research

Serves static files and handles API requests for:
- Listing audio files
- Saving session data to SQLite database
- Managing participants, locations, and tags
"""

import http.server
import socketserver
import json
import os
from urllib.parse import urlparse, parse_qs

PORT = 8000
HOST = '127.0.0.1'  # localhost only — avoids exposing PII APIs on the lab LAN
AUDIO_DIR = 'audio_files'

# Import database handler
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
        get_pattern_survey_counts
    )
    DB_AVAILABLE = True
except ImportError as e:
    print(f"Warning: Database handler not available: {e}")
    DB_AVAILABLE = False


class Handler(http.server.SimpleHTTPRequestHandler):
    def send_json_response(self, data, status=200):
        """Send JSON response."""
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_GET(self):
        """Handle GET requests."""
        parsed_path = urlparse(self.path)
        path = parsed_path.path

        if path == '/api/list-audio-files':
            files = []
            if os.path.exists(AUDIO_DIR):
                for filename in sorted(os.listdir(AUDIO_DIR)):
                    if filename.lower().endswith(('.mp3', '.wav', '.ogg', '.m4a')):
                        filepath = os.path.join(AUDIO_DIR, filename)
                        if os.path.isfile(filepath):
                            files.append({
                                'name': filename,
                                'path': f'/audio_files/{filename}',
                                'size': os.path.getsize(filepath)
                            })
            self.send_json_response(files)

        elif path == '/api/tags':
            if DB_AVAILABLE:
                tags = get_all_tags()
                self.send_json_response(tags)
            else:
                self.send_json_response({'error': 'Database not available'}, 500)

        elif path == '/api/locations':
            if DB_AVAILABLE:
                locations = get_all_locations()
                self.send_json_response(locations)
            else:
                self.send_json_response({'error': 'Database not available'}, 500)

        elif path == '/api/participants':
            if DB_AVAILABLE:
                participants = get_all_participants()
                self.send_json_response(participants)
            else:
                self.send_json_response({'error': 'Database not available'}, 500)

        elif path == '/api/survey/custom-actions':
            if DB_AVAILABLE:
                self.send_json_response({'actions': get_known_custom_actions()})
            else:
                self.send_json_response({'error': 'Database not available'}, 500)

        elif path == '/api/analysis/pattern-metadata':
            if DB_AVAILABLE:
                self.send_json_response(get_pattern_metadata_catalog())
            else:
                self.send_json_response({'error': 'Database not available'}, 500)

        elif path == '/api/analysis/sessions':
            if DB_AVAILABLE:
                query_params = parse_qs(parsed_path.query)
                limit_param = query_params.get('limit', [None])[0]
                try:
                    limit = int(limit_param) if limit_param else None
                except (TypeError, ValueError):
                    self.send_json_response({'error': 'Invalid limit parameter'}, 400)
                    return
                sessions = get_analysis_sessions(limit=limit)
                self.send_json_response(sessions)
            else:
                self.send_json_response({'error': 'Database not available'}, 500)

        elif path == '/api/analysis/tags':
            if DB_AVAILABLE:
                self.send_json_response({'tags': get_analysis_tags()})
            else:
                self.send_json_response({'error': 'Database not available'}, 500)

        elif path == '/api/analysis/pattern-tags':
            if DB_AVAILABLE:
                self.send_json_response(get_pattern_tag_state())
            else:
                self.send_json_response({'error': 'Database not available'}, 500)

        elif path == '/api/timing-stats':
            if DB_AVAILABLE:
                self.send_json_response(get_session_timing_stats())
            else:
                self.send_json_response({'error': 'Database not available'}, 500)

        elif path == '/api/pattern-stats':
            if DB_AVAILABLE:
                query_params = parse_qs(parsed_path.query)
                participant_param = query_params.get('participant_id', [None])[0]
                try:
                    participant_id = int(participant_param) if participant_param else None
                except (TypeError, ValueError):
                    self.send_json_response({'error': 'Invalid participant_id parameter'}, 400)
                    return
                self.send_json_response(get_pattern_survey_counts(participant_id))
            else:
                self.send_json_response({'error': 'Database not available'}, 500)

        elif path == '/api/status':
            self.send_json_response({
                'status': 'ok',
                'database_available': DB_AVAILABLE,
                'audio_dir': AUDIO_DIR,
                'audio_files_count': len([f for f in os.listdir(AUDIO_DIR) if f.lower().endswith(('.mp3', '.wav', '.ogg', '.m4a'))]) if os.path.exists(AUDIO_DIR) else 0
            })

        else:
            super().do_GET()

    def do_POST(self):
        """Handle POST requests."""
        parsed_path = urlparse(self.path)
        path = parsed_path.path

        # Read request body
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8') if content_length > 0 else '{}'

        try:
            data = json.loads(body)
        except json.JSONDecodeError as e:
            self.send_json_response({'error': f'Invalid JSON: {e}'}, 400)
            return

        if path == '/api/session':
            # Save session data to database
            if not DB_AVAILABLE:
                self.send_json_response({'error': 'Database not available'}, 500)
                return

            try:
                result = save_session_data(data)
                if result['success']:
                    self.send_json_response(result, 200)
                else:
                    self.send_json_response(result, 500)
            except Exception as e:
                import traceback
                self.send_json_response({
                    'error': str(e),
                    'traceback': traceback.format_exc()
                }, 500)

        elif path == '/api/analysis/trials/exclude':
            if not DB_AVAILABLE:
                self.send_json_response({'error': 'Database not available'}, 500)
                return

            trial_id = data.get('trialId')
            excluded = data.get('excludeFromAnalysis')
            if trial_id is None or excluded is None:
                self.send_json_response({'error': 'trialId and excludeFromAnalysis are required'}, 400)
                return

            try:
                trial_id_int = int(trial_id)
            except (TypeError, ValueError):
                self.send_json_response({'error': 'Invalid trialId'}, 400)
                return

            result = set_trial_exclude_from_analysis(trial_id_int, bool(excluded))
            status = 200 if result.get('success') else 404
            self.send_json_response(result, status)

        elif path == '/api/analysis/tags':
            if not DB_AVAILABLE:
                self.send_json_response({'error': 'Database not available'}, 500)
                return

            result = create_analysis_tag(data.get('name'), data.get('color'))
            status = 200 if result.get('success') else 400
            self.send_json_response(result, status)

        elif path == '/api/analysis/pattern-tags':
            if not DB_AVAILABLE:
                self.send_json_response({'error': 'Database not available'}, 500)
                return

            pattern_name = data.get('patternName')
            if not pattern_name or not str(pattern_name).strip():
                self.send_json_response({'error': 'patternName is required'}, 400)
                return

            result = save_pattern_tag_state(
                pattern_name=str(pattern_name),
                tag_ids=data.get('tagIds') or [],
                notes=data.get('notes')
            )
            status = 200 if result.get('success') else 400
            self.send_json_response(result, status)

        elif path == '/api/analysis/trials/notes':
            if not DB_AVAILABLE:
                self.send_json_response({'error': 'Database not available'}, 500)
                return

            trial_id = data.get('trialId')
            try:
                trial_id_int = int(trial_id)
            except (TypeError, ValueError):
                self.send_json_response({'error': 'Invalid trialId'}, 400)
                return

            result = set_trial_analyst_notes(trial_id_int, data.get('analystNotes'))
            status = 200 if result.get('success') else 404
            self.send_json_response(result, status)

        elif path == '/api/sessions/bulk':
            # Save multiple sessions (for syncing localStorage data)
            if not DB_AVAILABLE:
                self.send_json_response({'error': 'Database not available'}, 500)
                return

            sessions = data.get('sessions', [])
            results = []
            for session_data in sessions:
                try:
                    result = save_session_data(session_data)
                    results.append(result)
                except Exception as e:
                    results.append({
                        'success': False,
                        'error': str(e),
                        'sessionId': session_data.get('sessionId', 'unknown')
                    })

            success_count = sum(1 for r in results if r.get('success'))
            self.send_json_response({
                'success': success_count == len(sessions),
                'total': len(sessions),
                'saved': success_count,
                'failed': len(sessions) - success_count,
                'results': results
            })

        else:
            self.send_json_response({'error': 'Not found'}, 404)


if __name__ == '__main__':
    os.makedirs(AUDIO_DIR, exist_ok=True)
    socketserver.TCPServer.allow_reuse_address = True

    print("=" * 50)
    print("Haptic Research Server")
    print("=" * 50)
    print(f"Database available: {DB_AVAILABLE}")
    print()

    with socketserver.TCPServer((HOST, PORT), Handler) as httpd:
        print(f"Server running at http://localhost:{PORT}/")
        print()
        print("API Endpoints:")
        print(f"  GET  /api/list-audio-files  - List audio files")
        print(f"  GET  /api/tags              - Get all tags")
        print(f"  GET  /api/locations         - Get all locations")
        print(f"  GET  /api/participants      - Get all participants")
        print(f"  GET  /api/survey/custom-actions - Known custom survey actions")
        print(f"  GET  /api/analysis/pattern-metadata - Pattern audio metadata for Analyze")
        print(f"  GET  /api/analysis/sessions - Get sessions for Analyze page")
        print(f"  GET  /api/analysis/tags     - Analyst classification tag vocabulary")
        print(f"  POST /api/analysis/tags     - Create a custom analyst tag")
        print(f"  GET  /api/analysis/pattern-tags - Tag assignments + notes per pattern")
        print(f"  POST /api/analysis/pattern-tags - Save tags + notes for a pattern")
        print(f"  POST /api/analysis/trials/notes - Save analyst note on a trial")
        print(f"  GET  /api/timing-stats      - Empirical session timing stats")
        print(f"  GET  /api/pattern-stats     - Per-pattern trial counts for queue weighting")
        print(f"  POST /api/analysis/trials/exclude - Exclude/include trial in analysis")
        print(f"  GET  /api/status            - Server status")
        print(f"  POST /api/session           - Save session data")
        print(f"  POST /api/sessions/bulk     - Save multiple sessions")
        print()
        print("Press Ctrl+C to stop")

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped")
