// Audio processing utilities
class AudioProcessor {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.source = null;
        this.gainNode = null;
        this.buffer = null;
        this.isPlaying = false;
        this.startTime = 0;
        this.pauseTime = 0;
        this.loop = false;
        this.onEndedCallback = null;
    }

    async init() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.8;
        } catch (error) {
            console.error('Error initializing AudioProcessor:', error);
            throw error;
        }
    }

    async loadFile(file) {
        // Handle both File objects and URL strings
        let arrayBuffer;
        
        try {
            if (typeof file === 'string') {
                // Load from URL
                console.log('Loading file from URL:', file);
                const response = await fetch(file);
                if (!response.ok) {
                    throw new Error(`Failed to load audio file: ${response.status} ${response.statusText}`);
                }
                console.log('Fetch successful, reading array buffer...');
                arrayBuffer = await response.arrayBuffer();
                console.log('Array buffer loaded, size:', arrayBuffer.byteLength);
            } else {
                // Load from File object
                arrayBuffer = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.onerror = (e) => reject(new Error('FileReader error: ' + e.message));
                    reader.readAsArrayBuffer(file);
                });
            }
            
            if (!arrayBuffer || arrayBuffer.byteLength === 0) {
                throw new Error('File is empty or could not be read');
            }
            
            console.log('Decoding audio data...');
            // Use a promise wrapper for decodeAudioData to handle errors better
            this.buffer = await new Promise((resolve, reject) => {
                this.audioContext.decodeAudioData(
                    arrayBuffer.slice(0), // Create a copy to avoid issues
                    (decodedData) => {
                        console.log('Audio decoded successfully');
                        resolve(decodedData);
                    },
                    (error) => {
                        console.error('Audio decode error:', error);
                        reject(new Error(`Failed to decode audio: ${error.message || 'Unknown error'}`));
                    }
                );
            });
            
            // Stop any currently playing source
            this.stop();
            
            // Don't create source yet - will be created on play()
            // Just decode and store the buffer
            
            return {
                duration: this.buffer.duration,
                sampleRate: this.buffer.sampleRate,
                numberOfChannels: this.buffer.numberOfChannels,
                length: this.buffer.length
            };
        } catch (error) {
            console.error('Error in loadFile:', error);
            throw error;
        }
    }

    play() {
        if (!this.buffer) return;
        
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        // Stop existing source if playing
        if (this.source) {
            try {
                this.source.stop();
            } catch (e) {
                // Source already stopped
            }
        }
        
        // Create new source from buffer
        this.source = this.audioContext.createBufferSource();
        this.source.buffer = this.buffer;
        
        // Create gain node for volume control
        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.value = 1.0;
        
        // Connect: source -> gain -> analyser -> destination
        this.source.connect(this.gainNode);
        this.gainNode.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
        
        // Start playback from pause position
        this.startTime = this.audioContext.currentTime - this.pauseTime;
        this.source.start(0, this.pauseTime);
        this.isPlaying = true;
        
        // Handle end of playback
        this.source.onended = () => {
            if (this.loop) {
                // Loop: restart from beginning
                this.pauseTime = 0;
                this.startTime = 0;
                this.play();
            } else {
                // No loop: stop playback
            this.isPlaying = false;
            this.pauseTime = 0;
            this.startTime = 0;
                if (this.onEndedCallback) {
                    this.onEndedCallback();
                }
            }
        };
    }

    pause() {
        if (!this.isPlaying || !this.source) return;
        
        this.pauseTime = this.audioContext.currentTime - this.startTime;
        this.source.stop();
        this.source = null;
        this.isPlaying = false;
    }

    stop() {
        if (this.source) {
            try {
                this.source.stop();
            } catch (e) {
                // Source already stopped
            }
            this.source = null;
        }
        this.isPlaying = false;
        this.pauseTime = 0;
        this.startTime = 0;
    }

    getCurrentTime() {
        if (!this.isPlaying) return this.pauseTime;
        return this.audioContext.currentTime - this.startTime;
    }

    setVolume(volume) {
        // Volume is 0-100, convert to 0-1
        if (this.gainNode) {
            this.gainNode.gain.value = volume / 100;
        }
    }

    getFrequencyData() {
        if (!this.analyser) return null;
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteFrequencyData(dataArray);
        return dataArray;
    }

    getWaveformData() {
        if (!this.analyser) return null;
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteTimeDomainData(dataArray);
        return dataArray;
    }

    getHapticIntensity() {
        // Focus on low frequencies (20-250 Hz) for haptic response
        const frequencyData = this.getFrequencyData();
        if (!frequencyData) return 0;
        
        // Calculate intensity from low frequency range
        // Assuming sample rate of 44100, fftSize of 2048
        // Each bin represents ~21.5 Hz
        // Low frequencies are roughly bins 0-12 (0-258 Hz)
        let sum = 0;
        const lowFreqBins = Math.min(12, frequencyData.length);
        
        for (let i = 0; i < lowFreqBins; i++) {
            sum += frequencyData[i];
        }
        
        return sum / lowFreqBins / 255; // Normalize to 0-1
    }

    setLoop(loop) {
        this.loop = loop;
    }

    onEnded(callback) {
        this.onEndedCallback = callback;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioProcessor;
}
