const ANALYZE_PREDEFINED_ACTIONS = ['Lean', 'Slide', 'Turn', 'Twist', 'Run', 'Jump'];

const ANALYZE_BINARY_PAIRS = [
    { id: 'pull_push', label: 'Pull / Push', options: ['Pull', 'Push'] },
    { id: 'left_right', label: 'Left / Right', options: ['Left', 'Right'] },
    { id: 'relax_focus', label: 'Relax / Focus', options: ['Relax', 'Focus'] },
    { id: 'up_down', label: 'Up / Down', options: ['Up', 'Down'] },
    { id: 'stop_start', label: 'Stop / Start', options: ['Stop', 'Start'] },
    { id: 'forward_backward', label: 'Forward / Back', options: ['Forward', 'Backward'] },
    { id: 'faster_slower', label: 'Faster / Slower', options: ['Faster', 'Slower'] },
    { id: 'tighten_loosen', label: 'Tighten / Loosen', options: ['Tighten', 'Loosen'] },
    { id: 'continue_abort', label: 'Continue / Abort', options: ['Continue', 'Abort'] }
];

const ANALYZE_VIBE_PAIRS = [
    { id: 'hot_cold', label: 'Hot / Cold', options: ['Hot', 'Cold'] },
    { id: 'hard_soft', label: 'Hard / Soft', options: ['Hard', 'Soft'] },
    { id: 'smooth_rough', label: 'Smooth / Rough', options: ['Smooth', 'Rough'] },
    { id: 'safe_danger', label: 'Safe / Danger', options: ['Safe', 'Danger'] },
    { id: 'long_short', label: 'Long / Short', options: ['Long', 'Short'] },
    { id: 'expected_unknown', label: 'Expected / Unknown', options: ['Expected', 'Unknown'] },
    { id: 'rain_shine', label: 'Rain / Shine', options: ['Rain', 'Shine'] },
    { id: 'bright_dark', label: 'Bright / Dark', options: ['Bright', 'Dark'] },
    { id: 'recognizable_unrecognizable', label: 'Recognizable / Unrecognizable', options: ['Recognizable', 'Unrecognizable'] },
    { id: 'welcoming_unwelcoming', label: 'Welcoming / Unwelcoming', options: ['Welcoming', 'Unwelcoming'] },
    { id: 'open_closed', label: 'Open / Closed', options: ['Open', 'Closed'] }
];

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

const ANALYZE_SMALL_SAMPLE_THRESHOLD = 5;

// Neutral / Attentive / Disruptive landscape
const ANALYZE_NAD_BUCKETS = [
    { id: 'neutral', label: 'Neutral' },
    { id: 'attentive', label: 'Attentive' },
    { id: 'disruptive', label: 'Disruptive' }
];

// A bucket is suggested when its affinity score clears this threshold.
const ANALYZE_NAD_SUGGESTION_THRESHOLD = 0.55;

// Vibe pairs surfaced as disruption/comfort signals on the landscape.
const ANALYZE_NAD_VIBE_PAIR_IDS = ['safe_danger', 'expected_unknown', 'welcoming_unwelcoming'];
const ANALYZE_NAD_BINARY_PAIR_IDS = ['relax_focus'];

const ANALYZE_STORAGE_KEYS = {
    patternLastViewed: 'analyze_v2_pattern_last_viewed',
    filterPrefs: 'analyze_v2_filter_prefs',
    landscapePrefs: 'analyze_v2_landscape_prefs'
};
