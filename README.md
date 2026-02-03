# Haptic Sound Visualizer

A minimal, modern web application for visualizing haptic sound patterns. Built with vanilla JavaScript, p5.js, and a component-based architecture.

## Features

- **Pattern Library**: Browse and filter hundreds of audio patterns with metadata
- **Real-time Visualization**: 8 visualization modes (waveform, intensity, stereo, spectrum, pulses, blob, particles, landscape)
- **Smart Filtering**: Filter by RMS, duration, stereo balance, and stereo movement
- **Playback Controls**: Play, pause, stop with loop modes (off, continuous, 30s)
- **Minimal UI**: Clean, light design with monospace typography

## Getting Started

### Prerequisites

- Python 3.x (for local server)
- Modern web browser

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd haptic-sound-visualizer
```

2. Add your audio files to the `audio_files/` directory

3. Generate metadata (optional but recommended):
```bash
python3 generate_metadata.py
```

4. Start the server:
```bash
python3 server.py
```

5. Open your browser to `http://localhost:8000`

## Project Structure

```
haptic-sound-visualizer/
├── index.html              # Main application (Library page)
├── server.py               # Python HTTP server with API
├── generate_metadata.py    # Audio metadata generator
├── pattern_metadata.json   # Generated pattern metadata
├── audio-files.json        # File listing for static hosting
│
├── js/
│   ├── components/
│   │   ├── base/           # Standalone UI components
│   │   │   ├── PatternExplorer.js
│   │   │   ├── FilterPanel.js
│   │   │   ├── DualSlider.js
│   │   │   ├── Visualizer.js
│   │   │   └── AudioControls.js
│   │   └── variants/       # Composed components
│   │       └── PatternExplorerWithFilters.js
│   └── modules/            # Non-UI logic
│       ├── audioPlayer.js
│       └── filters.js
│
├── css/
│   └── components/
│       └── base/           # Component styles
│
├── dev/                    # Development & testing
│   ├── components-examples/
│   └── modules-examples/
│
├── docs/                   # Documentation
│   ├── COMPONENT_ORGANIZATION.md
│   ├── PHASE_2_PLAN.md
│   └── archive/
│
├── audio_files/            # Audio files (add your files here)
│
└── legacy/                 # Archived legacy code
    ├── index.html          # Old TEST page
    └── app.js              # Old monolithic app
```

## Architecture

The project uses a component-based architecture:

- **Base Components** (`js/components/base/`): Standalone, reusable UI components
- **Variants** (`js/components/variants/`): Composed components combining multiple base components
- **Modules** (`js/modules/`): Non-UI logic like audio playback and filtering

See `docs/COMPONENT_ORGANIZATION.md` for detailed architecture documentation.

## Usage

1. **Browse Patterns**: Click any file in the sidebar to load and visualize it
2. **Filter**: Use search and sliders to filter by metadata
3. **Preview**: Click the play button on any file for quick preview
4. **Visualize**: Select visualization mode from the dropdown
5. **Loop Modes**: Choose OFF (play once), ∞ (continuous), or 30s (30-second loop)

## Development

### Running Examples

Component examples are in `dev/components-examples/` and can be opened directly in a browser when running the local server.

### Adding Components

1. Create component in `js/components/base/`
2. Add CSS in `css/components/base/`
3. Create example in `dev/components-examples/`
4. Document in `js/components/base/README.md`

See `docs/CONTRIBUTING.md` for guidelines.

## License

[Your License Here]
