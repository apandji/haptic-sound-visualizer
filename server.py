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
AUDIO_DIR = 'audio_files'

# Import database handler
try:
    from db_handler import (
        save_session_data,
        get_all_tags,
        get_all_locations,
        get_all_participants
    )
    DB_AVAILABLE = True
except ImportError as e:
    print(f"Warning: Database handler not available: {e}")
    DB_AVAILABLE = False


class Handler(http.server.SimpleHTTPRequestHandler):
    def send_json_response(self, data, status=200):
        """Send JSON response with CORS headers."""
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

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

    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Server running at http://localhost:{PORT}/")
        print()
        print("API Endpoints:")
        print(f"  GET  /api/list-audio-files  - List audio files")
        print(f"  GET  /api/tags              - Get all tags")
        print(f"  GET  /api/locations         - Get all locations")
        print(f"  GET  /api/participants      - Get all participants")
        print(f"  GET  /api/status            - Server status")
        print(f"  POST /api/session           - Save session data")
        print(f"  POST /api/sessions/bulk     - Save multiple sessions")
        print()
        print("Press Ctrl+C to stop")

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped")
