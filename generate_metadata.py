#!/usr/bin/env python3
"""
Generate metadata for audio files missing from pattern_metadata.json

Usage:
    python3 generate_metadata.py                    # Process only missing files
    python3 generate_metadata.py --all              # Regenerate all files
    python3 generate_metadata.py --all --parallel   # Regenerate all with multiprocessing
"""

import json
import os
import sys
import argparse
import logging
from pathlib import Path
import numpy as np
import librosa

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

AUDIO_DIR = 'audio_files'
METADATA_FILE = 'pattern_metadata.json'


def calculate_rms_mean(y, sr):
    """Calculate mean RMS amplitude."""
    rms = librosa.feature.rms(y=y)[0]
    return float(np.mean(rms))


def calculate_duration(y, sr):
    """Calculate audio duration in seconds."""
    return float(librosa.get_duration(y=y, sr=sr))


def calculate_stereo_balance(y, sr):
    """
    Calculate stereo balance (-1.0 = fully left, 0.0 = center, 1.0 = fully right).
    Reverse-engineered from existing metadata patterns.
    """
    if y.ndim == 1:
        # Mono file - return 0.0
        return 0.0
    
    # Split into left and right channels
    left = y[0]
    right = y[1] if y.shape[0] > 1 else y[0]
    
    # Calculate RMS for each channel
    left_rms = np.mean(librosa.feature.rms(y=left)[0])
    right_rms = np.mean(librosa.feature.rms(y=right)[0])
    
    # Calculate balance: (right - left) / (right + left)
    # Normalized to [-1, 1] range
    total = left_rms + right_rms
    if total == 0:
        return 0.0
    
    balance = (right_rms - left_rms) / total
    return float(np.clip(balance, -1.0, 1.0))


def calculate_stereo_movement(y, sr):
    """
    Calculate stereo movement (0.0 = no movement, higher = more movement).
    Measures how much the stereo field changes over time.
    Reverse-engineered from existing metadata patterns.
    """
    if y.ndim == 1:
        # Mono file - return 0.0
        return 0.0
    
    left = y[0]
    right = y[1] if y.shape[0] > 1 else y[0]
    
    # Calculate RMS over time for each channel
    left_rms = librosa.feature.rms(y=left, frame_length=2048, hop_length=512)[0]
    right_rms = librosa.feature.rms(y=right, frame_length=2048, hop_length=512)[0]
    
    # Calculate instantaneous balance over time
    total = left_rms + right_rms
    # Avoid division by zero
    total[total == 0] = 1e-10
    balance_over_time = (right_rms - left_rms) / total
    
    # Calculate variance/standard deviation of balance over time
    # This measures how much the stereo field moves
    movement = float(np.std(balance_over_time))
    
    # Normalize to match existing range (0.0 to ~0.86)
    # Scale to match observed max value
    movement = np.clip(movement, 0.0, 1.0)
    
    return float(movement)


def process_audio_file(filepath, filename):
    """Process a single audio file and return metadata."""
    try:
        logger.info(f"Processing {filename}...")
        
        # Load audio file
        y, sr = librosa.load(filepath, sr=None, mono=False)
        
        # Calculate metadata
        metadata = {
            'filename': filename,
            'path': f'audio_files/{filename}',
            'rms_mean': calculate_rms_mean(y, sr),
            'duration': calculate_duration(y, sr),
            'stereo_balance': calculate_stereo_balance(y, sr),
            'stereo_movement': calculate_stereo_movement(y, sr)
        }
        
        logger.info(f"✓ {filename}: RMS={metadata['rms_mean']:.6f}, "
                   f"Duration={metadata['duration']:.2f}s, "
                   f"Balance={metadata['stereo_balance']:.4f}, "
                   f"Movement={metadata['stereo_movement']:.4f}")
        
        return metadata
        
    except Exception as e:
        logger.error(f"✗ Error processing {filename}: {str(e)}")
        return None


def get_audio_files():
    """Get list of audio files from audio_files directory."""
    audio_dir = Path(AUDIO_DIR)
    if not audio_dir.exists():
        logger.error(f"Audio directory '{AUDIO_DIR}' not found!")
        return []
    
    audio_files = []
    for ext in ['.mp3', '.wav', '.ogg', '.m4a', '.flac']:
        audio_files.extend(audio_dir.glob(f'*{ext}'))
        audio_files.extend(audio_dir.glob(f'*{ext.upper()}'))
    
    return sorted(audio_files)


def load_existing_metadata():
    """Load existing metadata from pattern_metadata.json."""
    metadata_file = Path(METADATA_FILE)
    
    if not metadata_file.exists():
        logger.warning(f"Metadata file '{METADATA_FILE}' not found. Creating new one.")
        return {'patterns': []}
    
    try:
        with open(metadata_file, 'r') as f:
            data = json.load(f)
        return data
    except json.JSONDecodeError as e:
        logger.error(f"Error parsing {METADATA_FILE}: {e}")
        return {'patterns': []}


def save_metadata(data):
    """Save metadata to pattern_metadata.json."""
    metadata_file = Path(METADATA_FILE)
    
    # Create backup
    if metadata_file.exists():
        backup_file = metadata_file.with_suffix('.json.backup')
        import shutil
        shutil.copy2(metadata_file, backup_file)
        logger.info(f"Created backup: {backup_file}")
    
    # Save updated metadata
    with open(metadata_file, 'w') as f:
        json.dump(data, f, indent=2)
    
    logger.info(f"Saved metadata to {METADATA_FILE}")


def main():
    parser = argparse.ArgumentParser(
        description='Generate metadata for audio files'
    )
    parser.add_argument(
        '--all',
        action='store_true',
        help='Regenerate metadata for all files (not just missing ones)'
    )
    parser.add_argument(
        '--parallel',
        action='store_true',
        help='Use multiprocessing for faster processing (future feature)'
    )
    args = parser.parse_args()
    
    # Load existing metadata
    metadata_data = load_existing_metadata()
    existing_patterns = {p['filename']: p for p in metadata_data.get('patterns', [])}
    
    # Get audio files
    audio_files = get_audio_files()
    logger.info(f"Found {len(audio_files)} audio files")
    
    if not audio_files:
        logger.error("No audio files found!")
        return
    
    # Determine which files to process
    if args.all:
        files_to_process = audio_files
        logger.info("Processing ALL files (--all flag set)")
    else:
        files_to_process = [
            f for f in audio_files
            if f.name not in existing_patterns
        ]
        logger.info(f"Processing {len(files_to_process)} missing files "
                   f"(out of {len(audio_files)} total)")
    
    if not files_to_process:
        logger.info("No files to process!")
        return
    
    # Process files
    new_patterns = []
    errors = 0
    
    for audio_file in files_to_process:
        metadata = process_audio_file(audio_file, audio_file.name)
        if metadata:
            new_patterns.append(metadata)
        else:
            errors += 1
    
    logger.info(f"\nProcessed {len(new_patterns)} files successfully")
    if errors > 0:
        logger.warning(f"Encountered {errors} errors")
    
    # Update metadata
    if args.all:
        # Update existing entries and add new ones (don't replace everything)
        # Create a map of existing patterns by filename
        existing_patterns_map = {p['filename']: p for p in metadata_data['patterns']}
        
        # Update existing entries or add new ones
        for pattern in new_patterns:
            existing_patterns_map[pattern['filename']] = pattern
        
        # Convert back to list
        metadata_data['patterns'] = list(existing_patterns_map.values())
        
        # Sort by filename for consistency
        metadata_data['patterns'].sort(key=lambda x: x['filename'])
    else:
        # Add new patterns to existing ones (only missing files)
        existing_filenames = {p['filename'] for p in metadata_data['patterns']}
        for pattern in new_patterns:
            if pattern['filename'] not in existing_filenames:
                metadata_data['patterns'].append(pattern)
        
        # Sort by filename for consistency
        metadata_data['patterns'].sort(key=lambda x: x['filename'])
    
    # Save updated metadata
    save_metadata(metadata_data)
    
    logger.info("Done!")


if __name__ == '__main__':
    main()
