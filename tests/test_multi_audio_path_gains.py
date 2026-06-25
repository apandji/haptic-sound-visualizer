#!/usr/bin/env python3
"""Parity tests for multi-audio path gains (mirrors multiAudioPathGains.js)."""

import unittest


DISRUPTIVE_GAIN_MULTIPLIER = 2
ALL_SLOT_INDICES = [0, 1, 2, 3, 4]

MULTI_AUDIO_SLOTS = [
    {'index': 0, 'amplifiesPairWhenEmpty': True, 'pairSourceIndex': 1, 'isAssignable': True},
    {'index': 1, 'isAssignable': True},
    {'index': 2, 'isAssignable': True},
    {'index': 3, 'isAssignable': True},
    {'index': 4, 'amplifiesPairWhenEmpty': True, 'pairSourceIndex': 3, 'isAssignable': True},
]


def get_disruptive_pair_source():
    mapping = {}
    for slot in MULTI_AUDIO_SLOTS:
        if slot.get('amplifiesPairWhenEmpty') and slot.get('pairSourceIndex') is not None:
            mapping[slot['index']] = slot['pairSourceIndex']
    return mapping


DISRUPTIVE_PAIR_SOURCE = get_disruptive_pair_source()


def compute_slot_weights(mix_position, slot_count=5):
    t = max(0.0, min(1.0, float(mix_position)))
    half_width = 0.25
    weights = [max(0.0, 1.0 - abs(t - (i * 0.25)) / half_width) for i in range(slot_count)]
    total = sum(weights)
    if total <= 0:
        return [1.0 / slot_count] * slot_count
    return [w / total for w in weights]


def normalize_path(path):
    if not path:
        return ''
    normalized = str(path)
    if normalized.startswith('/'):
        normalized = normalized[1:]
    return normalized


def has_own_slot_assignment(assignments, slot_index):
    slots = assignments or []
    return bool(slots[slot_index] and slots[slot_index].get('path')) if slot_index < len(slots) else False


def compute_path_gains(assignments, mix_position, disruptive_gain_multiplier=DISRUPTIVE_GAIN_MULTIPLIER):
    weights = compute_slot_weights(mix_position)
    path_gains = {}

    def add_gain(path, amount):
        if not path or amount <= 0:
            return
        normalized = normalize_path(path)
        path_gains[normalized] = path_gains.get(normalized, 0) + amount

    slots = assignments or []
    for index in ALL_SLOT_INDICES:
        slot = slots[index] if index < len(slots) else None
        if slot and slot.get('path'):
            add_gain(slot['path'], weights[index])

    for disruptive_index, attentive_index in DISRUPTIVE_PAIR_SOURCE.items():
        if has_own_slot_assignment(slots, disruptive_index):
            continue
        source = slots[attentive_index] if attentive_index < len(slots) else None
        if source and source.get('path') and weights[disruptive_index] > 0:
            add_gain(source['path'], weights[disruptive_index] * disruptive_gain_multiplier)

    return path_gains


def validate_slot_assignment(assignments, slot_index, file):
    path = normalize_path(file.get('path') or (f"audio_files/{file['name']}" if file.get('name') else ''))
    if not path:
        return {'ok': False, 'reason': 'Invalid pattern.'}

    slots = assignments or []
    neutral_path = normalize_path(slots[2]['path']) if len(slots) > 2 and slots[2] and slots[2].get('path') else None

    if slot_index in (0, 1, 3, 4) and neutral_path and path == neutral_path:
        return {'ok': False, 'reason': 'This slot cannot use the same pattern as Neutral.'}

    if slot_index == 2:
        att_minus = normalize_path(slots[1]['path']) if len(slots) > 1 and slots[1] and slots[1].get('path') else None
        att_plus = normalize_path(slots[3]['path']) if len(slots) > 3 and slots[3] and slots[3].get('path') else None
        if (att_minus and path == att_minus) or (att_plus and path == att_plus):
            return {'ok': False, 'reason': 'Neutral cannot use the same pattern as an Attentive slot.'}

    return {'ok': True, 'targetIndex': slot_index}


class MultiAudioPathGainsTest(unittest.TestCase):
    def test_disruptive_minus_doubles_attentive_minus_when_empty(self):
        assignments = [
            None,
            {'name': 'a.wav', 'path': 'audio_files/a.wav'},
            {'name': 'b.wav', 'path': 'audio_files/b.wav'},
            {'name': 'c.wav', 'path': 'audio_files/c.wav'},
            None,
        ]
        gains = compute_path_gains(assignments, 0.0)
        weights = compute_slot_weights(0.0)
        self.assertAlmostEqual(gains['audio_files/a.wav'], weights[1] + weights[0] * DISRUPTIVE_GAIN_MULTIPLIER, places=5)
        self.assertNotIn('audio_files/b.wav', gains)

    def test_disruptive_plus_doubles_attentive_plus_when_empty(self):
        assignments = [
            None,
            {'name': 'a.wav', 'path': 'audio_files/a.wav'},
            {'name': 'b.wav', 'path': 'audio_files/b.wav'},
            {'name': 'c.wav', 'path': 'audio_files/c.wav'},
            None,
        ]
        gains = compute_path_gains(assignments, 1.0)
        weights = compute_slot_weights(1.0)
        self.assertAlmostEqual(gains['audio_files/c.wav'], weights[3] + weights[4] * DISRUPTIVE_GAIN_MULTIPLIER, places=5)

    def test_explicit_disruptive_uses_own_pattern_only(self):
        assignments = [
            {'name': 'd.wav', 'path': 'audio_files/d.wav'},
            {'name': 'a.wav', 'path': 'audio_files/a.wav'},
            {'name': 'b.wav', 'path': 'audio_files/b.wav'},
            {'name': 'c.wav', 'path': 'audio_files/c.wav'},
            None,
        ]
        gains = compute_path_gains(assignments, 0.0)
        weights = compute_slot_weights(0.0)
        self.assertAlmostEqual(gains['audio_files/d.wav'], weights[0], places=5)
        self.assertNotIn('audio_files/a.wav', gains)

    def test_neutral_peak_no_disruptive_contribution(self):
        assignments = [
            None,
            {'name': 'a.wav', 'path': 'audio_files/a.wav'},
            {'name': 'b.wav', 'path': 'audio_files/b.wav'},
            {'name': 'c.wav', 'path': 'audio_files/c.wav'},
            None,
        ]
        gains = compute_path_gains(assignments, 0.5)
        weights = compute_slot_weights(0.5)
        self.assertAlmostEqual(gains['audio_files/b.wav'], weights[2], places=5)
        self.assertAlmostEqual(gains.get('audio_files/a.wav', 0), weights[1], places=5)

    def test_blocks_attentive_same_as_neutral(self):
        assignments = [None, None, {'name': 'b.wav', 'path': 'audio_files/b.wav'}, None, None]
        result = validate_slot_assignment(assignments, 1, {'name': 'b.wav', 'path': 'audio_files/b.wav'})
        self.assertFalse(result['ok'])

    def test_blocks_disruptive_same_as_neutral(self):
        assignments = [None, None, {'name': 'b.wav', 'path': 'audio_files/b.wav'}, None, None]
        result = validate_slot_assignment(assignments, 0, {'name': 'b.wav', 'path': 'audio_files/b.wav'})
        self.assertFalse(result['ok'])

    def test_blocks_neutral_same_as_attentive(self):
        assignments = [None, {'name': 'a.wav', 'path': 'audio_files/a.wav'}, None, None, None]
        result = validate_slot_assignment(assignments, 2, {'name': 'a.wav', 'path': 'audio_files/a.wav'})
        self.assertFalse(result['ok'])


if __name__ == '__main__':
    unittest.main()
