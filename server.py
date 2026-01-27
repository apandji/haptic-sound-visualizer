#!/usr/bin/env python3
import http.server
import socketserver
import json
import os

PORT = 8000
AUDIO_DIR = 'audio_files'

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/api/list-audio-files':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
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
            
            self.wfile.write(json.dumps(files).encode())
        else:
            super().do_GET()

if __name__ == '__main__':
    os.makedirs(AUDIO_DIR, exist_ok=True)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Server running at http://localhost:{PORT}/")
        print("Press Ctrl+C to stop")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped")
