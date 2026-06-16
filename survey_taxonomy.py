"""
Shared survey pair taxonomy for binary actions and vibes (v2 schema).
"""

from typing import Dict, List, Tuple

# (pair_id, (option_a, option_b))
SURVEY_BINARY_PAIRS: List[Tuple[str, Tuple[str, str]]] = [
    ('pull_push', ('Pull', 'Push')),
    ('left_right', ('Left', 'Right')),
    ('relax_focus', ('Relax', 'Focus')),
    ('up_down', ('Up', 'Down')),
    ('stop_start', ('Stop', 'Start')),
    ('forward_backward', ('Forward', 'Backward')),
    ('faster_slower', ('Faster', 'Slower')),
    ('tighten_loosen', ('Tighten', 'Loosen')),
    ('continue_abort', ('Continue', 'Abort')),
]

SURVEY_VIBE_PAIRS: List[Tuple[str, Tuple[str, str]]] = [
    ('hot_cold', ('Hot', 'Cold')),
    ('hard_soft', ('Hard', 'Soft')),
    ('smooth_rough', ('Smooth', 'Rough')),
    ('safe_danger', ('Safe', 'Danger')),
    ('long_short', ('Long', 'Short')),
    ('expected_unknown', ('Expected', 'Unknown')),
    ('rain_shine', ('Rain', 'Shine')),
    ('bright_dark', ('Bright', 'Dark')),
    ('recognizable_unrecognizable', ('Recognizable', 'Unrecognizable')),
    ('welcoming_unwelcoming', ('Welcoming', 'Unwelcoming')),
    ('open_closed', ('Open', 'Closed')),
]

# Legacy texture facet -> v2 pair_id (migration only)
LEGACY_TEXTURE_FACET_TO_PAIR_ID: Dict[str, str] = {
    'temperature': 'hot_cold',
    'hardness': 'hard_soft',
    'surface': 'smooth_rough',
}

# Legacy direction axis names match v2 pair_id directly.
LEGACY_DIRECTION_AXIS_TO_PAIR_ID: Dict[str, str] = {
    'left_right': 'left_right',
    'up_down': 'up_down',
    'forward_backward': 'forward_backward',
}

SURVEY_ACTION_OPTIONS = ('Lean', 'Slide', 'Turn', 'Twist', 'Run', 'Jump')

SURVEY_EMOTION_OPTIONS = {
    'mood': ('Distressed', 'Sad', 'Balanced', 'Happy', 'Ecstatic', 'Unsure'),
    'anxiety': ('Meditative', 'Relaxed', 'Steady', 'Cautious', 'Anxious', 'Unsure'),
    'focus': ('Scattered', 'Distracted', 'Present', 'Engaged', 'Absorbed', 'Unsure'),
    'body': ('Tense', 'Tight', 'Neutral', 'Loose', 'Grounded', 'Unsure'),
    'energy': ('Depleted', 'Tired', 'Neutral', 'Energized', 'Charged', 'Unsure'),
    'clarity': ('Confused', 'Foggy', 'Clear', 'Sharp', 'Lucid', 'Unsure'),
    'social': ('Withdrawn', 'Reserved', 'Open', 'Connected', 'Expansive', 'Unsure'),
    'motivation': ('Resistant', 'Reluctant', 'Willing', 'Driven', 'Compelled', 'Unsure'),
}

BINARY_PAIR_VALUES: Dict[str, Tuple[str, str]] = dict(SURVEY_BINARY_PAIRS)
VIBE_PAIR_VALUES: Dict[str, Tuple[str, str]] = dict(SURVEY_VIBE_PAIRS)


def is_valid_binary_pair_value(pair_id: str, value: str) -> bool:
    allowed = BINARY_PAIR_VALUES.get(pair_id)
    if not allowed:
        return False
    return value in allowed


def is_valid_vibe_pair_value(pair_id: str, value: str) -> bool:
    allowed = VIBE_PAIR_VALUES.get(pair_id)
    if not allowed:
        return False
    return value in allowed
