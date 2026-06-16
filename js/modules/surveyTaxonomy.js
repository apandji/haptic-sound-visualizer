/**
 * Survey pair taxonomy (v2) — shared by Test survey and Analyze.
 * Binary pairs are intentionally interleaved (no spatial/semantic grouping).
 */
const SURVEY_BINARY_PAIRS = [
    { id: 'pull_push', options: ['Pull', 'Push'] },
    { id: 'left_right', options: ['Left', 'Right'] },
    { id: 'relax_focus', options: ['Relax', 'Focus'] },
    { id: 'up_down', options: ['Up', 'Down'] },
    { id: 'stop_start', options: ['Stop', 'Start'] },
    { id: 'forward_backward', options: ['Forward', 'Backward'] },
    { id: 'faster_slower', options: ['Faster', 'Slower'] },
    { id: 'tighten_loosen', options: ['Tighten', 'Loosen'] },
    { id: 'continue_abort', options: ['Continue', 'Abort'] }
];

const SURVEY_VIBE_PAIRS = [
    { id: 'hot_cold', options: ['Hot', 'Cold'] },
    { id: 'hard_soft', options: ['Hard', 'Soft'] },
    { id: 'smooth_rough', options: ['Smooth', 'Rough'] },
    { id: 'safe_danger', options: ['Safe', 'Danger'] },
    { id: 'long_short', options: ['Long', 'Short'] },
    { id: 'expected_unknown', options: ['Expected', 'Unknown'] },
    { id: 'rain_shine', options: ['Rain', 'Shine'] },
    { id: 'bright_dark', options: ['Bright', 'Dark'] },
    { id: 'recognizable_unrecognizable', options: ['Recognizable', 'Unrecognizable'] },
    { id: 'welcoming_unwelcoming', options: ['Welcoming', 'Unwelcoming'] },
    { id: 'open_closed', options: ['Open', 'Closed'] }
];

const SURVEY_OTHER_ACTION_OPTIONS = ['Lean', 'Slide', 'Turn', 'Twist', 'Run', 'Jump'];

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SURVEY_BINARY_PAIRS,
        SURVEY_VIBE_PAIRS,
        SURVEY_OTHER_ACTION_OPTIONS
    };
}
