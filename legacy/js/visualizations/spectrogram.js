// Spectrogram (waterfall) visualization using p5.js
let spectrogramSketch = null;

function createSpectrogramVisualization(containerId, audioProcessor) {
    spectrogramSketch = function(p) {
        let frequencyData = null;
        let spectrogramData = [];
        const maxHistoryLength = 200;
        let currentTime = 0;
        let duration = 0;

        p.setup = function() {
            const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
            canvas.parent(containerId);
            p.colorMode(p.HSB, 360, 100, 100);
        };

        p.draw = function() {
            p.background(220, 20, 10); // Dark background
            
            // Get frequency data
            frequencyData = audioProcessor.getFrequencyData();
            
            if (frequencyData && frequencyData.length > 0) {
                // Add current frequency data to history
                const currentSpectrum = Array.from(frequencyData);
                spectrogramData.push(currentSpectrum);
                
                // Limit history length
                if (spectrogramData.length > maxHistoryLength) {
                    spectrogramData.shift();
                }
                
                // Draw spectrogram (time on Y-axis, frequency on X-axis)
                const barWidth = p.width / frequencyData.length;
                const barHeight = p.height / spectrogramData.length;
                
                for (let i = 0; i < spectrogramData.length; i++) {
                    const spectrum = spectrogramData[i];
                    
                    for (let j = 0; j < spectrum.length; j++) {
                        const amplitude = spectrum[j];
                        const brightness = p.map(amplitude, 0, 255, 20, 100);
                        
                        // Color based on frequency
                        const hue = p.map(j, 0, spectrum.length, 240, 0); // Blue to red
                        
                        // Highlight low frequencies
                        const isLowFreq = j < 12;
                        const saturation = isLowFreq ? 100 : 50;
                        
                        p.fill(hue, saturation, brightness);
                        p.noStroke();
                        p.rect(j * barWidth, i * barHeight, barWidth, barHeight);
                    }
                }
                
                // Draw low frequency indicator
                const lowFreqLineX = (12 / frequencyData.length) * p.width;
                p.stroke(0, 100, 100); // Red line
                p.strokeWeight(2);
                p.line(lowFreqLineX, 0, lowFreqLineX, p.height);
                
                // Draw time indicator (most recent at bottom)
                if (duration > 0) {
                    const timeY = p.map(currentTime, 0, duration, 0, p.height);
                    p.stroke(120, 100, 100); // Green line
                    p.strokeWeight(2);
                    p.line(0, timeY, p.width, timeY);
                }
            } else {
                // No data - show placeholder
                p.fill(0, 0, 50);
                p.textAlign(p.CENTER, p.CENTER);
                p.text('No audio data', p.width / 2, p.height / 2);
            }
        };

        p.windowResized = function() {
            p.resizeCanvas(p.windowWidth, p.windowHeight);
        };

        // Update function
        this.updateTime = function(time, totalDuration) {
            currentTime = time;
            duration = totalDuration;
        };
    };

    return new p5(spectrogramSketch);
}
