// Playback controls UI
class PlaybackControls {
    constructor() {
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
        this.volume = 100;
        this.loop = false;
        this.onPlayCallback = null;
        this.onPauseCallback = null;
        this.onStopCallback = null;
        this.onSeekCallback = null;
        this.onVolumeChangeCallback = null;
    }

    init() {
        const playPauseBtn = document.getElementById('playPauseBtn');
        const stopBtn = document.getElementById('stopBtn');
        const seekBar = document.getElementById('seekBar');
        const volumeSlider = document.getElementById('volumeSlider');
        const fullscreenBtn = document.getElementById('fullscreenBtn');
        const loopCheckbox = document.getElementById('loop');
        
        playPauseBtn.addEventListener('click', () => {
            this.togglePlayPause();
        });
        
        stopBtn.addEventListener('click', () => {
            this.stop();
        });
        
        seekBar.addEventListener('input', (e) => {
            const seekTime = (e.target.value / 100) * this.duration;
            this.seek(seekTime);
        });
        
        volumeSlider.addEventListener('input', (e) => {
            this.setVolume(e.target.value);
        });
        
        fullscreenBtn.addEventListener('click', () => {
            this.toggleFullscreen();
        });
        
        // Initialize loop state from checkbox
        this.loop = loopCheckbox.checked;
        
        loopCheckbox.addEventListener('change', (e) => {
            this.loop = e.target.checked;
        });
        
        // Update seek bar and time display periodically
        setInterval(() => {
            this.updateDisplay();
        }, 100);
    }

    togglePlayPause() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    play() {
        this.isPlaying = true;
        const btn = document.getElementById('playPauseBtn');
        btn.textContent = '⏸ Pause';
        
        if (this.onPlayCallback) {
            this.onPlayCallback();
        }
    }

    pause() {
        this.isPlaying = false;
        const btn = document.getElementById('playPauseBtn');
        btn.textContent = '▶ Play';
        
        if (this.onPauseCallback) {
            this.onPauseCallback();
        }
    }

    stop() {
        this.isPlaying = false;
        this.currentTime = 0;
        const btn = document.getElementById('playPauseBtn');
        btn.textContent = '▶ Play';
        
        if (this.onStopCallback) {
            this.onStopCallback();
        }
    }

    seek(time) {
        this.currentTime = Math.max(0, Math.min(time, this.duration));
        if (this.onSeekCallback) {
            this.onSeekCallback(this.currentTime);
        }
    }

    setVolume(volume) {
        this.volume = parseInt(volume);
        if (this.onVolumeChangeCallback) {
            this.onVolumeChangeCallback(this.volume);
        }
    }

    setDuration(duration) {
        this.duration = duration;
        this.updateDisplay();
    }

    setCurrentTime(time) {
        this.currentTime = time;
        this.updateDisplay();
    }

    updateDisplay() {
        // Update time display
        const currentTimeEl = document.getElementById('currentTime');
        const totalTimeEl = document.getElementById('totalTime');
        
        currentTimeEl.textContent = this.formatTime(this.currentTime);
        totalTimeEl.textContent = this.formatTime(this.duration);
        
        // Update seek bar
        const seekBar = document.getElementById('seekBar');
        if (this.duration > 0) {
            seekBar.value = (this.currentTime / this.duration) * 100;
        } else {
            seekBar.value = 0;
        }
    }

    formatTime(seconds) {
        if (isNaN(seconds) || seconds === 0) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error('Error attempting to enable fullscreen:', err);
            });
        } else {
            document.exitFullscreen();
        }
    }

    onPlay(callback) {
        this.onPlayCallback = callback;
    }

    onPause(callback) {
        this.onPauseCallback = callback;
    }

    onStop(callback) {
        this.onStopCallback = callback;
    }

    onSeek(callback) {
        this.onSeekCallback = callback;
    }

    onVolumeChange(callback) {
        this.onVolumeChangeCallback = callback;
    }
}

// Initialize controls when DOM is ready
let playbackControls = null;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        playbackControls = new PlaybackControls();
        playbackControls.init();
    });
} else {
    playbackControls = new PlaybackControls();
    playbackControls.init();
}
