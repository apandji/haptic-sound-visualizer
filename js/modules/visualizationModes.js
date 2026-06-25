/**
 * Shared visualization mode catalog for Explore single- and multi-audio.
 * Labels align by family where concepts overlap (waveform, stereo, spectrum).
 */
const SINGLE_VISUALIZATION_MODES = [
    { id: 'waveform', label: 'Waveform', group: 'waveform' },
    { id: 'intensity', label: 'Intensity Bars', group: 'waveform' },
    { id: 'stereo', label: 'Stereo Field', group: 'stereo' },
    { id: 'spectrum', label: 'Frequency Spectrum', group: 'spectrum' },
    { id: 'pulses', label: 'Directional Pulses', group: 'stereo' },
    { id: 'blob', label: 'Liquid Blob', group: 'motion' },
    { id: 'particles', label: 'Particle Swarm', group: 'motion' },
    { id: 'landscape', label: 'Frequency Terrain', group: 'spectrum' }
];

const MULTI_BLEND_STRATEGIES = [
    {
        id: 'layered',
        label: 'Layered Waveforms',
        group: 'waveform',
        singleAnalog: 'waveform',
        description: 'Overlaid NAD-colored waveforms; opacity follows mix weight.'
    },
    {
        id: 'weighted-sum',
        label: 'Weighted Waveform',
        group: 'waveform',
        singleAnalog: 'waveform',
        description: 'One composite trace blended by slot weight — closest to combined output.'
    },
    {
        id: 'dominant-ghosts',
        label: 'Dominant + Ghosts',
        group: 'waveform',
        singleAnalog: 'waveform',
        description: 'Emphasizes the loudest slot; others appear as faint context.'
    },
    {
        id: 'slot-lanes',
        label: 'Slot Lanes',
        group: 'waveform',
        singleAnalog: 'waveform',
        description: 'Five horizontal waveform bands — one lane per NAD slot.'
    },
    {
        id: 'stereo-lanes',
        label: 'Stereo Lanes',
        group: 'stereo',
        singleAnalog: 'stereo',
        description: 'Five lanes with left/right energy bars per slot — Stereo Field by NAD slot.'
    },
    {
        id: 'stereo-scatter',
        label: 'Stereo Scatter',
        group: 'stereo',
        singleAnalog: 'stereo',
        description: 'Balance vs movement per pattern; dot size and opacity follow mix weight.'
    }
];

function getSingleModeOptions() {
    return SINGLE_VISUALIZATION_MODES.map(({ id, label }) => ({ value: id, label }));
}

function getMultiBlendModeOptions() {
    return MULTI_BLEND_STRATEGIES.map(({ id, label }) => ({ value: id, label }));
}

function getMultiBlendStrategy(id) {
    return MULTI_BLEND_STRATEGIES.find((entry) => entry.id === id) || null;
}

if (typeof window !== 'undefined') {
    window.VisualizationModes = {
        SINGLE_VISUALIZATION_MODES,
        MULTI_BLEND_STRATEGIES,
        getSingleModeOptions,
        getMultiBlendModeOptions,
        getMultiBlendStrategy
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SINGLE_VISUALIZATION_MODES,
        MULTI_BLEND_STRATEGIES,
        getSingleModeOptions,
        getMultiBlendModeOptions,
        getMultiBlendStrategy
    };
}
