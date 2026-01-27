// Haptic intensity visualization using p5.js
let hapticSketch = null;

function createHapticVisualization(containerId, audioProcessor) {
    hapticSketch = function(p) {
        let hapticIntensity = 0;
        let intensityHistory = [];
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
            
            // Get haptic intensity
            hapticIntensity = audioProcessor.getHapticIntensity();
            
            // Add to history
            intensityHistory.push({
                intensity: hapticIntensity,
                time: currentTime
            });
            
            // Limit history length
            if (intensityHistory.length > maxHistoryLength) {
                intensityHistory.shift();
            }
            
            // Draw intensity history line
            if (intensityHistory.length > 1) {
                p.stroke(200, 100, 100); // Blue
                p.strokeWeight(3);
                p.noFill();
                
                p.beginShape();
                for (let i = 0; i < intensityHistory.length; i++) {
                    const x = p.map(i, 0, intensityHistory.length - 1, 0, p.width);
                    const y = p.map(intensityHistory[i].intensity, 0, 1, p.height, 0);
                    p.vertex(x, y);
                }
                p.endShape();
            }
            
            // Draw current intensity as a circle
            const circleSize = p.map(hapticIntensity, 0, 1, 50, p.min(p.width, p.height) * 0.8);
            const hue = p.map(hapticIntensity, 0, 1, 240, 0); // Blue to red based on intensity
            
            p.fill(hue, 100, 100, 0.5);
            p.noStroke();
            p.circle(p.width / 2, p.height / 2, circleSize);
            
            // Draw intensity value text
            p.fill(0, 0, 100);
            p.textAlign(p.CENTER, p.CENTER);
            p.textSize(32);
            p.text(`${(hapticIntensity * 100).toFixed(1)}%`, p.width / 2, p.height / 2);
            
            // Draw time indicator
            if (duration > 0) {
                const playheadX = p.map(currentTime, 0, duration, 0, p.width);
                p.stroke(0, 100, 100); // Red playhead
                p.strokeWeight(2);
                p.line(playheadX, 0, playheadX, p.height);
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

    return new p5(hapticSketch);
}
