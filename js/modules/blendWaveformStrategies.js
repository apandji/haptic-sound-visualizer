/**
 * Blend waveform strategies for Multi-audio NAD discussion tool.
 * Mode labels are defined in visualizationModes.js (aligned with single-audio families).
 */
const BlendWaveformStrategies = (function createBlendWaveformStrategies() {
    const STRATEGIES = new Map();

    const STEREO_SCATTER_MOVEMENT_MAX = 0.55;

    function hexToRgb(hex) {
        const cleaned = String(hex).replace('#', '');
        if (cleaned.length !== 6) return [136, 136, 136];
        return [
            parseInt(cleaned.slice(0, 2), 16),
            parseInt(cleaned.slice(2, 4), 16),
            parseInt(cleaned.slice(4, 6), 16)
        ];
    }

    function sampleWaveform(soundFile, numPoints = 256) {
        if (!soundFile?.buffer || !soundFile.isLoaded()) {
            return new Array(numPoints).fill(0);
        }

        const channel = soundFile.buffer.getChannelData(0);
        const sampleRate = soundFile.buffer.sampleRate;
        const currentTime = soundFile.currentTime();
        const startSample = Math.floor(currentTime * sampleRate);
        const windowSamples = Math.max(32, Math.floor(sampleRate * 0.06));

        const samples = [];
        for (let i = 0; i < numPoints; i++) {
            const offset = Math.floor((i / (numPoints - 1)) * windowSamples);
            const idx = Math.min(Math.max(0, startSample + offset), channel.length - 1);
            samples.push(channel[idx] || 0);
        }
        return samples;
    }

    function sampleStereoBars(soundFile, numBars = 80) {
        const empty = {
            left: new Array(numBars).fill(0),
            right: new Array(numBars).fill(0),
            isStereo: false
        };

        if (!soundFile?.buffer || !soundFile.isLoaded()) {
            return empty;
        }

        const channels = soundFile.buffer.numberOfChannels;
        const currentTime = soundFile.currentTime();
        const sampleRate = soundFile.buffer.sampleRate;
        const bufferLength = soundFile.buffer.length;
        const sampleIndex = Math.floor(currentTime * sampleRate);
        const lookaheadSamples = 1024;
        const samplesPerBar = Math.max(1, Math.floor(lookaheadSamples / numBars));

        const leftChannel = soundFile.buffer.getChannelData(0);
        const rightChannel = channels >= 2
            ? soundFile.buffer.getChannelData(1)
            : leftChannel;

        const left = [];
        const right = [];

        for (let i = 0; i < numBars; i++) {
            let leftSum = 0;
            let rightSum = 0;
            let count = 0;

            for (let j = 0; j < samplesPerBar; j++) {
                const idx = sampleIndex + (i * samplesPerBar) + j;
                if (idx >= 0 && idx < bufferLength) {
                    leftSum += Math.abs(leftChannel[idx]);
                    rightSum += Math.abs(rightChannel[idx]);
                    count++;
                }
            }

            left.push(count > 0 ? leftSum / count : 0);
            right.push(count > 0 ? rightSum / count : 0);
        }

        return { left, right, isStereo: channels >= 2 };
    }

    function activeSources(sources) {
        return (sources || []).filter((source) => source?.soundFile?.isLoaded() && source.weight > 0.001);
    }

    function lookupPatternMetadata(patternMetadata, source) {
        if (!patternMetadata || !source?.name) return null;
        return patternMetadata[source.name] || null;
    }

    function drawCenterLine(p, width, height) {
        p.stroke(180, 180, 180, 120);
        p.strokeWeight(1);
        p.line(0, height / 2, width, height / 2);
    }

    function drawWaveformPath(p, samples, width, height, rgb, alpha, strokeWeight) {
        if (!samples.length) return;

        p.stroke(rgb[0], rgb[1], rgb[2], alpha);
        p.strokeWeight(strokeWeight);
        p.noFill();
        p.beginShape();
        for (let i = 0; i < samples.length; i++) {
            const x = p.map(i, 0, samples.length - 1, 0, width);
            const y = p.map(samples[i], -1, 1, height, 0);
            p.vertex(x, y);
        }
        p.endShape();
    }

    function drawStereoLane(p, soundFile, width, laneTop, laneHeight, rgb, alpha) {
        const numBars = Math.min(80, Math.max(24, Math.floor(width / 5)));
        const barWidth = width / numBars;
        const stereo = sampleStereoBars(soundFile, numBars);
        const centerY = laneTop + laneHeight / 2;
        const scale = laneHeight * 0.42;

        p.stroke(210, 210, 210, 70);
        p.strokeWeight(1);
        p.line(0, centerY, width, centerY);

        for (let i = 0; i < numBars; i++) {
            const leftIntensity = stereo.left[i] * scale;
            const rightIntensity = stereo.right[i] * scale;
            const x = i * barWidth;

            if (stereo.isStereo) {
                if (leftIntensity > 0.5) {
                    p.fill(rgb[0], rgb[1], rgb[2], Math.floor(alpha * 0.85));
                    p.noStroke();
                    p.rect(x + 1, centerY - leftIntensity, barWidth - 2, leftIntensity);
                }
                if (rightIntensity > 0.5) {
                    p.fill(rgb[0], rgb[1], rgb[2], Math.floor(alpha * 0.55));
                    p.noStroke();
                    p.rect(x + 1, centerY, barWidth - 2, rightIntensity);
                }
            } else if (leftIntensity > 0.5) {
                const monoIntensity = leftIntensity * 0.7;
                p.fill(rgb[0], rgb[1], rgb[2], Math.floor(alpha * 0.65));
                p.noStroke();
                p.rect(x + 1, centerY - monoIntensity / 2, barWidth - 2, monoIntensity);
            }
        }
    }

    function drawStereoScatterAxes(p, plot) {
        const { left, top, width, height } = plot;

        p.stroke(180, 180, 180, 100);
        p.strokeWeight(1);
        p.line(left, top + height, left + width, top + height);
        p.line(left, top, left, top + height);
        p.line(left + width / 2, top, left + width / 2, top + height);

        p.stroke(180, 180, 180, 45);
        for (let i = 1; i < 4; i++) {
            const y = top + (height * i) / 4;
            p.line(left, y, left + width, y);
        }

        p.noStroke();
        p.fill(130);
        p.textSize(10);
        p.textAlign(p.CENTER, p.TOP);
        p.text('L', left + 8, top + height + 6);
        p.text('C', left + width / 2, top + height + 6);
        p.text('R', left + width - 8, top + height + 6);

        p.textAlign(p.LEFT, p.CENTER);
        p.text('Moving', left + 6, top + 8);
        p.text('Static', left + 6, top + height - 4);
    }

    function register(id, drawFn) {
        STRATEGIES.set(id, drawFn);
    }

    register('layered', (ctx) => {
        const { p, sources, width, height } = ctx;
        const layers = activeSources(sources).sort((a, b) => a.weight - b.weight);

        drawCenterLine(p, width, height);
        layers.forEach((source) => {
            const samples = sampleWaveform(source.soundFile);
            const rgb = hexToRgb(source.color);
            const alpha = Math.floor(40 + source.weight * 215);
            const strokeWeight = 1 + source.weight * 2.5;
            drawWaveformPath(p, samples, width, height, rgb, alpha, strokeWeight);
        });
    });

    register('weighted-sum', (ctx) => {
        const { p, sources, mixPosition, width, height } = ctx;
        const layers = activeSources(sources);
        if (!layers.length) return;

        const numPoints = 256;
        const composite = new Array(numPoints).fill(0);
        let totalWeight = 0;

        layers.forEach((source) => {
            const samples = sampleWaveform(source.soundFile, numPoints);
            totalWeight += source.weight;
            for (let i = 0; i < numPoints; i++) {
                composite[i] += samples[i] * source.weight;
            }
        });

        if (totalWeight > 0) {
            for (let i = 0; i < numPoints; i++) {
                composite[i] /= totalWeight;
            }
        }

        const rgb = hexToRgb(
            window.MultiAudioConstants?.nadColorAtMixPosition(mixPosition) || '#8b95a5'
        );

        drawCenterLine(p, width, height);
        drawWaveformPath(p, composite, width, height, rgb, 255, 2.2);
    });

    register('dominant-ghosts', (ctx) => {
        const { p, sources, width, height } = ctx;
        const layers = activeSources(sources);
        if (!layers.length) return;

        const dominant = layers.reduce((best, source) => (
            source.weight > best.weight ? source : best
        ), layers[0]);

        drawCenterLine(p, width, height);
        layers.forEach((source) => {
            const samples = sampleWaveform(source.soundFile);
            const rgb = hexToRgb(source.color);
            const isDominant = source.slotIndex === dominant.slotIndex;
            const alpha = isDominant ? 255 : 55;
            const strokeWeight = isDominant ? 2.5 : 1;
            drawWaveformPath(p, samples, width, height, rgb, alpha, strokeWeight);
        });
    });

    register('slot-lanes', (ctx) => {
        const { p, sources, width, height } = ctx;
        const slotCount = window.MultiAudioConstants?.SLOT_COUNT || 5;
        const laneHeight = height / slotCount;

        for (let i = 0; i < slotCount; i++) {
            const yTop = i * laneHeight;
            const yMid = yTop + laneHeight / 2;
            const source = (sources || []).find((entry) => entry.slotIndex === i);

            p.stroke(210, 210, 210, 80);
            p.strokeWeight(1);
            p.line(0, yTop, width, yTop);

            if (!source?.soundFile?.isLoaded() || source.weight <= 0.001) {
                continue;
            }

            const samples = sampleWaveform(source.soundFile);
            const rgb = hexToRgb(source.color);
            const alpha = Math.floor(50 + source.weight * 205);
            const amplitude = laneHeight * 0.38;

            p.stroke(rgb[0], rgb[1], rgb[2], alpha);
            p.strokeWeight(1.2 + source.weight);
            p.noFill();
            p.beginShape();
            for (let j = 0; j < samples.length; j++) {
                const x = p.map(j, 0, samples.length - 1, 0, width);
                const y = yMid - samples[j] * amplitude;
                p.vertex(x, y);
            }
            p.endShape();
        }

        p.line(0, height, width, height);
    });

    register('stereo-lanes', (ctx) => {
        const { p, sources, width, height } = ctx;
        const slotCount = window.MultiAudioConstants?.SLOT_COUNT || 5;
        const laneHeight = height / slotCount;

        for (let i = 0; i < slotCount; i++) {
            const yTop = i * laneHeight;
            const source = (sources || []).find((entry) => entry.slotIndex === i);

            p.stroke(210, 210, 210, 80);
            p.strokeWeight(1);
            p.line(0, yTop, width, yTop);

            if (!source?.soundFile?.isLoaded() || source.weight <= 0.001) {
                continue;
            }

            const rgb = hexToRgb(source.color);
            const alpha = Math.floor(55 + source.weight * 200);
            drawStereoLane(p, source.soundFile, width, yTop, laneHeight, rgb, alpha);
        }

        p.line(0, height, width, height);

        const legendY = height - 10;
        p.textSize(9);
        p.textAlign(p.LEFT, p.CENTER);
        p.noStroke();
        p.fill(120);
        p.text('L ↑  ·  R ↓ per lane', 10, legendY);
    });

    register('stereo-scatter', (ctx) => {
        const { p, sources, width, height, patternMetadata, mixPosition } = ctx;
        const layers = activeSources(sources);
        const plot = {
            left: 44,
            top: 20,
            width: width - 60,
            height: height - 48
        };

        drawStereoScatterAxes(p, plot);

        if (!layers.length) return;

        let movementMax = STEREO_SCATTER_MOVEMENT_MAX;
        layers.forEach((source) => {
            const meta = lookupPatternMetadata(patternMetadata, source);
            if (meta?.stereo_movement != null) {
                movementMax = Math.max(movementMax, meta.stereo_movement * 1.1);
            }
        });

        let blendBalance = 0;
        let blendMovement = 0;
        let blendWeight = 0;

        layers.forEach((source) => {
            const meta = lookupPatternMetadata(patternMetadata, source);
            const balance = meta?.stereo_balance ?? 0;
            const movement = meta?.stereo_movement ?? 0;
            const rgb = hexToRgb(source.color);
            const alpha = Math.floor(70 + source.weight * 185);
            const radius = 5 + source.weight * 14;

            const x = plot.left + plot.width / 2 + balance * (plot.width / 2 - 10);
            const y = plot.top + plot.height - (movement / movementMax) * plot.height;

            blendBalance += balance * source.weight;
            blendMovement += movement * source.weight;
            blendWeight += source.weight;

            p.noStroke();
            p.fill(rgb[0], rgb[1], rgb[2], alpha);
            p.circle(x, y, radius);

            p.fill(rgb[0], rgb[1], rgb[2], Math.min(255, alpha + 40));
            p.textSize(9);
            p.textAlign(p.LEFT, p.BOTTOM);
            p.text(source.label, x + radius * 0.45, y - 2);
        });

        if (blendWeight > 0) {
            const avgBalance = blendBalance / blendWeight;
            const avgMovement = blendMovement / blendWeight;
            const centroidX = plot.left + plot.width / 2 + avgBalance * (plot.width / 2 - 10);
            const centroidY = plot.top + plot.height - (avgMovement / movementMax) * plot.height;
            const centroidRgb = hexToRgb(
                window.MultiAudioConstants?.nadColorAtMixPosition(mixPosition) || '#8b95a5'
            );

            p.noFill();
            p.stroke(centroidRgb[0], centroidRgb[1], centroidRgb[2], 220);
            p.strokeWeight(2);
            p.circle(centroidX, centroidY, 16);

            p.stroke(centroidRgb[0], centroidRgb[1], centroidRgb[2], 120);
            p.strokeWeight(1);
            p.line(centroidX - 10, centroidY, centroidX + 10, centroidY);
            p.line(centroidX, centroidY - 10, centroidX, centroidY + 10);
        }
    });

    function draw(strategyId, ctx) {
        const drawFn = STRATEGIES.get(strategyId) || STRATEGIES.get('layered');
        if (!drawFn) return;
        drawFn(ctx);
    }

    function list() {
        return window.VisualizationModes?.MULTI_BLEND_STRATEGIES || [];
    }

    return { draw, list, register };
})();

if (typeof window !== 'undefined') {
    window.BlendWaveformStrategies = BlendWaveformStrategies;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BlendWaveformStrategies;
}
