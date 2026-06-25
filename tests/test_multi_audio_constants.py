#!/usr/bin/env python3
"""Parity tests for multi-audio slot constants (mirrors multiAudioConstants.js)."""

import unittest


MULTI_AUDIO_SLOTS = [
    {
        'id': 'disruptive_minus',
        'index': 0,
        'amplifiesPairWhenEmpty': True,
        'pairSourceIndex': 1,
        'isAssignable': True,
    },
    {
        'id': 'attentive_minus',
        'index': 1,
        'isAssignable': True,
    },
    {
        'id': 'neutral',
        'index': 2,
        'isAssignable': True,
    },
    {
        'id': 'attentive_plus',
        'index': 3,
        'isAssignable': True,
    },
    {
        'id': 'disruptive_plus',
        'index': 4,
        'amplifiesPairWhenEmpty': True,
        'pairSourceIndex': 3,
        'isAssignable': True,
    },
]


def get_all_slot_indices():
    return [slot['index'] for slot in MULTI_AUDIO_SLOTS]


def get_assignable_slot_indices():
    return [slot['index'] for slot in MULTI_AUDIO_SLOTS if slot.get('isAssignable')]


def get_disruptive_pair_source():
    mapping = {}
    for slot in MULTI_AUDIO_SLOTS:
        if slot.get('amplifiesPairWhenEmpty') and slot.get('pairSourceIndex') is not None:
            mapping[slot['index']] = slot['pairSourceIndex']
    return mapping


class MultiAudioConstantsTest(unittest.TestCase):
    def test_all_slot_indices(self):
        self.assertEqual(get_all_slot_indices(), [0, 1, 2, 3, 4])

    def test_assignable_slot_indices(self):
        self.assertEqual(get_assignable_slot_indices(), [0, 1, 2, 3, 4])

    def test_disruptive_pair_source_derived_from_slots(self):
        self.assertEqual(get_disruptive_pair_source(), {0: 1, 4: 3})


if __name__ == '__main__':
    unittest.main()
