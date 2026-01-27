# Haptic Sound Visualizer

A minimal, modern web application for visualizing haptic sound patterns. Built with vanilla JavaScript and p5.js.

## Features

- **File Browser**: Browse and select from hundreds of audio files
- **Real-time Visualization**: Waveform visualization synchronized with playback
- **Playback Controls**: Play, pause, stop with loop toggle
- **Minimal UI**: Clean, light design with monospace fonts
- **Auto-load**: Automatically loads all audio files from directory

## Getting Started

### Prerequisites

- Python 3.x
- Modern web browser

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd haptic-sound-visualizer
```

2. Add your audio files to the `audio_files/` directory

3. Start the server:
```bash
python3 server.py
```

4. Open your browser to `http://localhost:8000`

## Usage

- Click any file in the sidebar to load and play it
- Use ▶/⏸ to play/pause
- Use ⏹ to stop
- Toggle Loop button to enable/disable looping
- Files auto-play when selected (if browser allows)

## Project Structure

```
haptic-sound-visualizer/
├── index.html          # Main HTML file
├── app.js              # Application logic
├── server.py           # Python HTTP server
├── audio_files/        # Audio files directory (add your files here)
└── README.md
```

## License

[Your License Here]
