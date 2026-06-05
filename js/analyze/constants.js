const ANALYZE_PREDEFINED_ACTIONS = ['Lean', 'Slide', 'Turn', 'Twist', 'Run', 'Jump'];

const ANALYZE_EMOTION_FACETS = [
    { id: 'mood', label: 'Mood' },
    { id: 'anxiety', label: 'Anxiety' },
    { id: 'focus', label: 'Focus' },
    { id: 'body', label: 'Body' },
    { id: 'energy', label: 'Energy' },
    { id: 'clarity', label: 'Clarity' },
    { id: 'social', label: 'Social' },
    { id: 'motivation', label: 'Motivation' }
];

const ANALYZE_EMOTION_OPTIONS = {
    mood: ['Distressed', 'Sad', 'Balanced', 'Happy', 'Ecstatic', 'Unsure'],
    anxiety: ['Meditative', 'Relaxed', 'Steady', 'Cautious', 'Anxious', 'Unsure'],
    focus: ['Scattered', 'Distracted', 'Present', 'Engaged', 'Absorbed', 'Unsure'],
    body: ['Tense', 'Tight', 'Neutral', 'Loose', 'Grounded', 'Unsure'],
    energy: ['Depleted', 'Tired', 'Neutral', 'Energized', 'Charged', 'Unsure'],
    clarity: ['Confused', 'Foggy', 'Clear', 'Sharp', 'Lucid', 'Unsure'],
    social: ['Withdrawn', 'Reserved', 'Open', 'Connected', 'Expansive', 'Unsure'],
    motivation: ['Resistant', 'Reluctant', 'Willing', 'Driven', 'Compelled', 'Unsure']
};

const ANALYZE_DIRECTION_AXES = [
    { id: 'leftRight', label: 'Left / Right', options: ['Left', 'Right'] },
    { id: 'upDown', label: 'Up / Down', options: ['Up', 'Down'] },
    { id: 'forwardBackward', label: 'Forward / Back', options: ['Forward', 'Backward'] }
];

const ANALYZE_TEXTURE_FACETS = [
    { id: 'temperature', label: 'Temperature', options: ['Hot', 'Cold'] },
    { id: 'hardness', label: 'Hardness', options: ['Hard', 'Soft'] },
    { id: 'surface', label: 'Surface', options: ['Smooth', 'Rough'] }
];

const ANALYZE_SMALL_SAMPLE_THRESHOLD = 5;

const ANALYZE_STORAGE_KEYS = {
    patternLastViewed: 'analyze_v2_pattern_last_viewed',
    filterPrefs: 'analyze_v2_filter_prefs'
};
