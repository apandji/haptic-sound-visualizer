// Waveform visualization using p5.js
let waveformSketch = null;

function createWaveformVisualization(containerId, audioProcessor) {
    waveformSketch = function(p) {
        let waveformData = null;
        let currentTime = 0;
        let duration = 0;

        p.setup = function() {
            const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
            canvas.parent(containerId);
            p.colorMode(p.HSB, 360, 100, 100);
        };

        p.draw = function() {
            p.background(220, 20, 10); // Dark background
            
            // Get waveform data
            waveformData = audioProcessor.getWaveformData();
            
            if (waveformData && waveformData.length > 0) {
                // Draw waveform
                p.stroke(200, 80, 100); // Blue color
                p.strokeWeight(2);
                p.noFill();
                
                p.beginShape();
                const sliceWidth = p.width / waveformData.length;
                
                for (let i = 0; i < waveformData.length; i++) {
                    const v = waveformData[i] / 128.0;
                    const y = p.map(v, 0, 1, p.height / 2, 0);
                    const x = i * sliceWidth;
                    p.vertex(x, y);
                }
                p.endShape();
                
                // Draw center line
                p.stroke(0, 0, 50);
                p.strokeWeight(1);
                p.line(0, p.height / 2, p.width, p.height / 2);
                
                // Draw playhead
                if (duration > 0) {
                    const playheadX = p.map(currentTime, 0, duration, 0, p.width);
                    p.stroke(0, 100, 100); // Red playhead
                    p.strokeWeight(2);
                    p.line(playheadX, 0, playheadX, p.height);
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

        // Update function to be called from main app
        this.updateTime = function(time, totalDuration) {
            currentTime = time;
            duration = totalDuration;
        };
    };

    return new p5(waveformSketch);
}
