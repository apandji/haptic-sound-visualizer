/**
 * Path gain map for Multi-audio — Disruptive slots use their own pattern, or 2× Attentive when empty.
 */
const DISRUPTIVE_GAIN_MULTIPLIER = 2;

function getAllSlotIndices() {
    return window.MultiAudioConstants?.getAllSlotIndices?.() || [0, 1, 2, 3, 4];
}

function getDisruptivePairSource() {
    return window.MultiAudioConstants?.getDisruptivePairSource?.() || { 0: 1, 4: 3 };
}

function hasOwnSlotAssignment(assignments, slotIndex) {
    if (window.MultiAudioConstants?.hasOwnSlotAssignment) {
        return window.MultiAudioConstants.hasOwnSlotAssignment(assignments, slotIndex);
    }
    return Boolean(assignments?.[slotIndex]?.path);
}

function computePathGains(assignments, mixPosition, options = {}) {
    const gainMult = options.disruptiveGainMultiplier ?? DISRUPTIVE_GAIN_MULTIPLIER;
    const weights = computeSlotWeights(mixPosition);
    const pathGains = new Map();
    const slots = assignments || [];

    const addGain = (path, amount) => {
        if (!path || amount <= 0) return;
        const normalized = window.MultiAudioConstants?.normalizeMultiAudioPath(path) || path;
        pathGains.set(normalized, (pathGains.get(normalized) || 0) + amount);
    };

    getAllSlotIndices().forEach((index) => {
        const slot = slots[index];
        if (slot?.path) {
            addGain(slot.path, weights[index]);
        }
    });

    Object.entries(getDisruptivePairSource()).forEach(([disruptiveIndex, attentiveIndex]) => {
        const dIndex = Number(disruptiveIndex);
        const aIndex = Number(attentiveIndex);
        if (hasOwnSlotAssignment(slots, dIndex)) return;

        const source = slots[aIndex];
        if (source?.path && weights[dIndex] > 0) {
            addGain(source.path, weights[dIndex] * gainMult);
        }
    });

    return pathGains;
}

function sanitizeSlotAssignments(assignments) {
    const slotCount = window.MultiAudioConstants?.SLOT_COUNT || 5;
    const next = (assignments || []).map((slot) => (slot ? { ...slot } : null));
    while (next.length < slotCount) next.push(null);
    return next.slice(0, slotCount);
}

function validateSlotAssignment(assignments, slotIndex, file) {
    const path = window.MultiAudioConstants?.normalizeMultiAudioPath(
        file?.path || (file?.name ? `audio_files/${file.name}` : '')
    );
    if (!path) {
        return { ok: false, reason: 'Invalid pattern.' };
    }

    const neutralPath = assignments[2]?.path
        ? window.MultiAudioConstants.normalizeMultiAudioPath(assignments[2].path)
        : null;

    if ((slotIndex === 0 || slotIndex === 1 || slotIndex === 3 || slotIndex === 4)
        && neutralPath && path === neutralPath) {
        return {
            ok: false,
            reason: 'This slot cannot use the same pattern as Neutral.'
        };
    }

    if (slotIndex === 2) {
        const attMinus = assignments[1]?.path
            ? window.MultiAudioConstants.normalizeMultiAudioPath(assignments[1].path)
            : null;
        const attPlus = assignments[3]?.path
            ? window.MultiAudioConstants.normalizeMultiAudioPath(assignments[3].path)
            : null;
        if ((attMinus && path === attMinus) || (attPlus && path === attPlus)) {
            return {
                ok: false,
                reason: 'Neutral cannot use the same pattern as an Attentive slot.'
            };
        }
    }

    return { ok: true, targetIndex: slotIndex };
}

function hasAudibleAssignments(assignments) {
    const slots = assignments || [];
    return getAllSlotIndices().some((index) => Boolean(slots[index]?.path));
}

if (typeof window !== 'undefined') {
    window.MultiAudioPathGains = {
        DISRUPTIVE_GAIN_MULTIPLIER,
        getAllSlotIndices,
        getDisruptivePairSource,
        computePathGains,
        sanitizeSlotAssignments,
        validateSlotAssignment,
        hasOwnSlotAssignment,
        hasAudibleAssignments
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        DISRUPTIVE_GAIN_MULTIPLIER,
        getAllSlotIndices,
        getDisruptivePairSource,
        computePathGains,
        sanitizeSlotAssignments,
        validateSlotAssignment,
        hasOwnSlotAssignment,
        hasAudibleAssignments
    };
}
