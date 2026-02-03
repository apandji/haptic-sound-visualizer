// Frequency spectrum visualization using p5.js
let spectrumSketch = null;

function createSpectrumVisualization(containerId, audioProcessor) {
    spectrumSketch = function(p) {
        let frequencyData = null;
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
                const barWidth = p.width / frequencyData.length;
                
                for (let i = 0; i < frequencyData.length; i++) {
                    const amplitude = frequencyData[i];
                    const barHeight = p.map(amplitude, 0, 255, 0, p.height);
                    
                    // Color based on frequency (hue) and amplitude (brightness)
                    const hue = p.map(i, 0, frequencyData.length, 240, 0); // Blue to red
                    const brightness = p.map(amplitude, 0, 255, 30, 100);
                    
                    // Highlight low frequencies (haptic range)
                    const isLowFreq = i < 12; // Roughly 0-258 Hz
                    if (isLowFreq) {
                        p.fill(hue, 100, brightness);
                    } else {
                        p.fill(hue, 50, brightness);
                    }
                    
                    p.noStroke();
                    p.rect(i * barWidth, p.height - barHeight, barWidth, barHeight);
                }
                
                // Draw low frequency indicator line
                const lowFreqLineX = (12 / frequencyData.length) * p.width;
                p.stroke(0, 100, 100); // Red line
                p.strokeWeight(2);
                p.line(lowFreqLineX, 0, lowFreqLineX, p.height);
                
                // Label
                p.fill(0, 0, 100);
                p.textAlign(p.LEFT);
                p.text('Low Freq (Haptic)', lowFreqLineX + 5, 20);
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

    return new p5(spectrumSketch);
}
