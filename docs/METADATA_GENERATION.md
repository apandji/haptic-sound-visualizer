# Metadata Generation Guide

This guide explains how to generate metadata for audio files in the haptic sound visualizer.

## Prerequisites

Install the required Python libraries:

```bash
pip3 install librosa soundfile
```

**Note**: `librosa` requires `soundfile` for reading audio files. You may also need `ffmpeg` installed on your system for MP3 support.

## Basic Usage

### Generate Metadata for Missing Files Only (Default)

This is the default behavior - it only processes files that don't already have metadata in `pattern_metadata.json`:

```bash
python3 generate_metadata.py
```

**What it does:**
- Scans the `audio_files/` directory for audio files
- Compares against existing entries in `pattern_metadata.json`
- Processes only files that are missing from the metadata
- Updates `pattern_metadata.json` with new entries
- Creates a backup file (`pattern_metadata.json.backup`) before making changes

**Use case**: When you've added new audio files and want to generate metadata for them.

### Regenerate Metadata for All Files

Use the `--all` flag to regenerate metadata for every file in `audio_files/`, even if they already have metadata:

```bash
python3 generate_metadata.py --all
```

**What it does:**
- Processes ALL files in `audio_files/` directory
- Updates existing metadata entries if they exist
- Adds new entries for files that weren't in metadata
- Preserves metadata for files that reference other directories (e.g., `patterns/`)
- Creates a backup before updating

**Use case**: 
- When you want to refresh all metadata (e.g., after fixing calculation bugs)
- For the future admin feature to regenerate all metadata from the web interface

### Parallel Processing (Future Feature)

The `--parallel` flag is reserved for future multiprocessing support:

```bash
python3 generate_metadata.py --parallel
python3 generate_metadata.py --all --parallel
```

**Note**: Currently, this flag doesn't do anything. It's a placeholder for future optimization.

## What Metadata is Generated

For each audio file, the script calculates:

1. **rms_mean**: Average RMS (Root Mean Square) amplitude - measures overall loudness/intensity
2. **duration**: Length of the audio file in seconds
3. **stereo_balance**: Left/right channel balance
   - Range: -1.0 (fully left) to 1.0 (fully right)
   - 0.0 = centered/mono
4. **stereo_movement**: How much the stereo field changes over time
   - Range: 0.0 (no movement) to ~0.86 (high movement)
   - Measures variance in stereo positioning

## Output Format

The script outputs:
- Progress logs for each file being processed
- Success messages with calculated values
- Error messages for files that fail to process
- Summary of files processed and any errors encountered

Example output:
```
2026-01-28 18:55:23,347 - INFO - Found 425 audio files
2026-01-28 18:55:23,347 - INFO - Processing 1 missing files (out of 425 total)
2026-01-28 18:55:23,347 - INFO - Processing A_100_1.mp3...
2026-01-28 18:55:24,157 - INFO - ✓ A_100_1.mp3: RMS=0.037271, Duration=9.61s, Balance=-0.1824, Movement=0.2723
2026-01-28 18:55:24,157 - INFO - 
Processed 1 files successfully
2026-01-28 18:55:24,158 - INFO - Created backup: pattern_metadata.json.backup
2026-01-28 18:55:24,161 - INFO - Saved metadata to pattern_metadata.json
2026-01-28 18:55:24,161 - INFO - Done!
```

## File Structure

The script updates `pattern_metadata.json` with entries like:

```json
{
  "patterns": [
    {
      "filename": "A_100_1.mp3",
      "path": "audio_files/A_100_1.mp3",
      "rms_mean": 0.03727120906114578,
      "duration": 9.613061224489796,
      "stereo_balance": -0.18240709602832794,
      "stereo_movement": 0.272270143032074
    }
  ]
}
```

## Safety Features

1. **Automatic Backup**: Before updating `pattern_metadata.json`, the script creates `pattern_metadata.json.backup`
2. **Error Handling**: Files that fail to process are logged but don't stop the script
3. **Preservation**: When using `--all`, existing metadata for files not in `audio_files/` is preserved

## Troubleshooting

### "No audio files found!"
- Check that the `audio_files/` directory exists
- Verify audio files are in the correct directory
- Check file extensions are supported (.mp3, .wav, .ogg, .m4a, .flac)

### "Error processing [filename]"
- File might be corrupted
- Unsupported audio format
- Check the full error message in the logs

### Metadata not showing in the app
- Refresh your browser (hard refresh: Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
- Check browser console for errors
- Verify `pattern_metadata.json` was updated correctly

## Future Admin Feature

The script is designed to support a future admin feature where metadata can be regenerated from the web interface with password protection. The `--all` flag will be used for this feature.
