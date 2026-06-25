/**
 * NAD slot definitions for Multi-audio Explore mode.
 */
const MULTI_AUDIO_SLOT_COUNT = 5;
const EXPLORE_PATTERN_DRAG_TYPE = 'application/x-sail-pattern';

const MULTI_AUDIO_SLOTS = [
    {
        id: 'disruptive_minus',
        index: 0,
        label: 'Disruptive−',
        side: 'minus',
        amplifiesPairWhenEmpty: true,
        pairSourceIndex: 1,
        isAssignable: true,
        colorVar: '--color-nad-minus-strong'
    },
    {
        id: 'attentive_minus',
        index: 1,
        label: 'Attentive−',
        side: 'minus',
        isAssignable: true,
        colorVar: '--color-nad-minus-soft'
    },
    {
        id: 'neutral',
        index: 2,
        label: 'Neutral',
        side: 'neutral',
        isAssignable: true,
        colorVar: '--color-nad-neutral'
    },
    {
        id: 'attentive_plus',
        index: 3,
        label: 'Attentive+',
        side: 'plus',
        isAssignable: true,
        colorVar: '--color-nad-plus-soft'
    },
    {
        id: 'disruptive_plus',
        index: 4,
        label: 'Disruptive+',
        side: 'plus',
        amplifiesPairWhenEmpty: true,
        pairSourceIndex: 3,
        isAssignable: true,
        colorVar: '--color-nad-plus-strong'
    }
];

function normalizeMultiAudioPath(path) {
    if (!path) return '';
    let normalized = String(path);
    if (normalized.startsWith('/')) {
        normalized = normalized.substring(1);
    }
    return normalized;
}

function resolveNadColor(colorVar) {
    if (typeof document === 'undefined') return '#888888';
    const raw = getComputedStyle(document.documentElement).getPropertyValue(colorVar).trim();
    return raw || '#888888';
}

function getSlotColor(slotMeta) {
    return resolveNadColor(slotMeta?.colorVar || '--color-nad-neutral');
}

function getAllSlotIndices() {
    return MULTI_AUDIO_SLOTS.map((slot) => slot.index);
}

function getAssignableSlotIndices() {
    return MULTI_AUDIO_SLOTS.filter((slot) => slot.isAssignable).map((slot) => slot.index);
}

function getDisruptivePairSource() {
    const map = {};
    MULTI_AUDIO_SLOTS.forEach((slot) => {
        if (slot.amplifiesPairWhenEmpty && slot.pairSourceIndex != null) {
            map[slot.index] = slot.pairSourceIndex;
        }
    });
    return map;
}

function getPairSourceIndex(slotIndex) {
    return MULTI_AUDIO_SLOTS[slotIndex]?.pairSourceIndex ?? null;
}

function hasOwnSlotAssignment(assignments, slotIndex) {
    return Boolean(assignments?.[slotIndex]?.path);
}

function usesAttentiveFallback(assignments, slotIndex) {
    const meta = MULTI_AUDIO_SLOTS[slotIndex];
    if (!meta?.amplifiesPairWhenEmpty || meta.pairSourceIndex == null) {
        return false;
    }
    if (hasOwnSlotAssignment(assignments, slotIndex)) {
        return false;
    }
    return hasOwnSlotAssignment(assignments, meta.pairSourceIndex);
}

/** Pattern shown/played for a slot (Disruptive falls back to Attentive when empty). */
function getEffectiveSlotAssignment(assignments, slotIndex) {
    const slots = assignments || [];
    const meta = MULTI_AUDIO_SLOTS[slotIndex];
    if (!meta) return null;

    if (hasOwnSlotAssignment(slots, slotIndex)) {
        return { ...slots[slotIndex] };
    }
    if (meta.amplifiesPairWhenEmpty && meta.pairSourceIndex != null) {
        return slots[meta.pairSourceIndex] ? { ...slots[meta.pairSourceIndex] } : null;
    }
    return null;
}

function nadColorAtMixPosition(t) {
    const clamped = Math.max(0, Math.min(1, t));
    if (clamped < 0.125) {
        return resolveNadColor('--color-nad-minus-strong');
    }
    if (clamped < 0.375) {
        return resolveNadColor('--color-nad-minus-soft');
    }
    if (clamped < 0.625) {
        return resolveNadColor('--color-nad-neutral');
    }
    if (clamped < 0.875) {
        return resolveNadColor('--color-nad-plus-soft');
    }
    return resolveNadColor('--color-nad-plus-strong');
}

function serializePatternDragPayload(file) {
    if (!file?.name) return '';
    const path = normalizeMultiAudioPath(file.path || `audio_files/${file.name}`);
    return JSON.stringify({ name: file.name, path });
}

function parsePatternDragPayload(raw) {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        if (!parsed?.name || !parsed?.path) return null;
        return {
            name: parsed.name,
            path: normalizeMultiAudioPath(parsed.path)
        };
    } catch (error) {
        return null;
    }
}

if (typeof window !== 'undefined') {
    window.MultiAudioConstants = {
        SLOT_COUNT: MULTI_AUDIO_SLOT_COUNT,
        SLOTS: MULTI_AUDIO_SLOTS,
        PATTERN_DRAG_TYPE: EXPLORE_PATTERN_DRAG_TYPE,
        serializePatternDragPayload,
        parsePatternDragPayload,
        normalizeMultiAudioPath,
        resolveNadColor,
        getSlotColor,
        getAllSlotIndices,
        getAssignableSlotIndices,
        getDisruptivePairSource,
        getPairSourceIndex,
        hasOwnSlotAssignment,
        usesAttentiveFallback,
        getEffectiveSlotAssignment,
        nadColorAtMixPosition
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        MULTI_AUDIO_SLOT_COUNT,
        MULTI_AUDIO_SLOTS,
        normalizeMultiAudioPath,
        nadColorAtMixPosition
    };
}
