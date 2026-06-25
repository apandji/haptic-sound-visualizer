#!/usr/bin/env python3
"""Regenerate audio-files.json and prune pattern_metadata.json to the active catalog."""

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AUDIO_DIR = ROOT / 'audio_files'
AUDIO_FILES_JSON = ROOT / 'audio-files.json'
PATTERN_METADATA_JSON = ROOT / 'pattern_metadata.json'
AUDIO_EXTENSIONS = {'.mp3', '.wav', '.ogg', '.m4a'}


def list_active_audio_files():
    files = []
    if not AUDIO_DIR.is_dir():
        return files
    for filename in sorted(os.listdir(AUDIO_DIR)):
        if Path(filename).suffix.lower() not in AUDIO_EXTENSIONS:
            continue
        filepath = AUDIO_DIR / filename
        if filepath.is_file():
            files.append({
                'name': filename,
                'path': f'/audio_files/{filename}',
                'size': filepath.stat().st_size,
            })
    return files


def prune_pattern_metadata(active_names):
    if not PATTERN_METADATA_JSON.is_file():
        print(f'No metadata file at {PATTERN_METADATA_JSON}')
        return 0

    with PATTERN_METADATA_JSON.open(encoding='utf-8') as handle:
        data = json.load(handle)

    patterns = data.get('patterns', [])
    kept = [entry for entry in patterns if entry.get('filename') in active_names]
    removed = len(patterns) - len(kept)
    data['patterns'] = kept

    with PATTERN_METADATA_JSON.open('w', encoding='utf-8') as handle:
        json.dump(data, handle, indent=2)
        handle.write('\n')

    return removed


def main():
    files = list_active_audio_files()
    active_names = {entry['name'] for entry in files}

    with AUDIO_FILES_JSON.open('w', encoding='utf-8') as handle:
        json.dump(files, handle, indent=2)
        handle.write('\n')

    removed = prune_pattern_metadata(active_names)

    print(f'Wrote {len(files)} entries to {AUDIO_FILES_JSON.name}')
    print(f'Pruned {removed} stale entries from {PATTERN_METADATA_JSON.name} ({len(active_names)} kept)')


if __name__ == '__main__':
    main()
