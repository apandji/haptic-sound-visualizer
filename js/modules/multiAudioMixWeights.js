/**
 * Five-peak triangular crossfade for Multi-audio continuum slider.
 * Slot centers: 0, 0.25, 0.5, 0.75, 1.0
 */
function computeSlotWeights(mixPosition, slotCount = 5) {
    const t = Math.max(0, Math.min(1, Number(mixPosition)));
    const halfWidth = 0.25;
    const weights = [];

    for (let i = 0; i < slotCount; i++) {
        const center = i * 0.25;
        weights.push(Math.max(0, 1 - Math.abs(t - center) / halfWidth));
    }

    const sum = weights.reduce((acc, value) => acc + value, 0);
    if (sum <= 0) {
        return weights.map(() => 1 / slotCount);
    }

    return weights.map((value) => value / sum);
}

if (typeof window !== 'undefined') {
    window.computeSlotWeights = computeSlotWeights;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { computeSlotWeights };
}
