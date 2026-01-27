// Simplified visualizations using p5.SoundFile directly

function createWaveformVisualization(containerId, soundFile) {
    let fft;
    let waveform;
    
    const sketch = function(p) {
        p.setup = function() {
            const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
            canvas.parent(containerId);
            p.colorMode(p.HSB, 360, 100, 100);
            
            fft = new p5.FFT();
            waveform = new Array(1024).fill(0);
        };
        
        p.draw = function() {
            p.background(220, 20, 10);
            
            if (soundFile && soundFile.isLoaded() && soundFile.isPlaying()) {
                waveform = fft.waveform();
                
                p.stroke(200, 80, 100);
                p.strokeWeight(2);
                p.noFill();
                
                p.beginShape();
                for (let i = 0; i < waveform.length; i++) {
                    const x = p.map(i, 0, waveform.length, 0, p.width);
                    const y = p.map(waveform[i], -1, 1, p.height, 0);
                    p.vertex(x, y);
                }
                p.endShape();
                
                // Playhead
                const progress = soundFile.currentTime() / soundFile.duration();
                p.stroke(0, 100, 100);
                p.strokeWeight(2);
                p.line(progress * p.width, 0, progress * p.width, p.height);
            } else {
                p.fill(0, 0, 50);
                p.textAlign(p.CENTER, p.CENTER);
                p.text('No audio playing', p.width / 2, p.height / 2);
            }
        };
        
        p.windowResized = function() {
            p.resizeCanvas(p.windowWidth, p.windowHeight);
        };
    };
    
    return new p5(sketch);
}

function createSpectrumVisualization(containerId, soundFile) {
    let fft;
    
    const sketch = function(p) {
        p.setup = function() {
            const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
            canvas.parent(containerId);
            
            fft = new p5.FFT();
        };
        
        p.draw = function() {
            p.background(0);
            
            if (soundFile && soundFile.isLoaded() && soundFile.isPlaying()) {
                const spectrum = fft.analyze();
                
                p.noStroke();
                for (let i = 0; i < spectrum.length; i++) {
                    const x = p.map(i, 0, spectrum.length, 0, p.width);
                    const h = p.map(spectrum[i], 0, 255, 0, p.height);
                    const hue = p.map(i, 0, spectrum.length, 0, 360);
                    p.fill(hue, 100, 100);
                    p.rect(x, p.height - h, p.width / spectrum.length, h);
                }
            } else {
                p.fill(255);
                p.textAlign(p.CENTER, p.CENTER);
                p.text('No audio playing', p.width / 2, p.height / 2);
            }
        };
        
        p.windowResized = function() {
            p.resizeCanvas(p.windowWidth, p.windowHeight);
        };
    };
    
    return new p5(sketch);
}

function createHapticVisualization(containerId, soundFile) {
    let fft;
    
    const sketch = function(p) {
        p.setup = function() {
            const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
            canvas.parent(containerId);
            
            fft = new p5.FFT();
        };
        
        p.draw = function() {
            p.background(0);
            
            if (soundFile && soundFile.isLoaded() && soundFile.isPlaying()) {
                const spectrum = fft.analyze();
                // Focus on low frequencies (haptic range: ~20-250 Hz)
                const lowFreqBins = Math.min(12, spectrum.length);
                let intensity = 0;
                
                for (let i = 0; i < lowFreqBins; i++) {
                    intensity += spectrum[i];
                }
                intensity = intensity / lowFreqBins / 255;
                
                // Visualize as pulsing circle
                const size = p.map(intensity, 0, 1, 50, p.width * 0.8);
                p.fill(0, 100, 100, 200);
                p.noStroke();
                p.ellipse(p.width / 2, p.height / 2, size, size);
                
                // Intensity text
                p.fill(255);
                p.textAlign(p.CENTER, p.CENTER);
                p.text(`Haptic Intensity: ${(intensity * 100).toFixed(0)}%`, p.width / 2, p.height / 2);
            } else {
                p.fill(255);
                p.textAlign(p.CENTER, p.CENTER);
                p.text('No audio playing', p.width / 2, p.height / 2);
            }
        };
        
        p.windowResized = function() {
            p.resizeCanvas(p.windowWidth, p.windowHeight);
        };
    };
    
    return new p5(sketch);
}

function createSpectrogramVisualization(containerId, soundFile) {
    let fft;
    let spectrogram = [];
    
    const sketch = function(p) {
        p.setup = function() {
            const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
            canvas.parent(containerId);
            
            fft = new p5.FFT();
        };
        
        p.draw = function() {
            p.background(0);
            
            if (soundFile && soundFile.isLoaded() && soundFile.isPlaying()) {
                const spectrum = fft.analyze();
                spectrogram.push(spectrum);
                
                // Keep only last 200 frames
                if (spectrogram.length > 200) {
                    spectrogram.shift();
                }
                
                // Draw spectrogram
                const frameWidth = p.width / spectrogram.length;
                for (let i = 0; i < spectrogram.length; i++) {
                    const frame = spectrogram[i];
                    for (let j = 0; j < frame.length; j++) {
                        const x = i * frameWidth;
                        const y = p.map(j, 0, frame.length, p.height, 0);
                        const brightness = frame[j];
                        p.stroke(0, 0, brightness);
                        p.point(x, y);
                    }
                }
            } else {
                p.fill(255);
                p.textAlign(p.CENTER, p.CENTER);
                p.text('No audio playing', p.width / 2, p.height / 2);
            }
        };
        
        p.windowResized = function() {
            p.resizeCanvas(p.windowWidth, p.windowHeight);
        };
    };
    
    return new p5(sketch);
}
