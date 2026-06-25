#!/usr/bin/env python3
"""Parity tests for multi-audio slot weight curve (mirrors multiAudioMixWeights.js)."""

import unittest


def compute_slot_weights(mix_position, slot_count=5):
    t = max(0.0, min(1.0, float(mix_position)))
    half_width = 0.25
    weights = [max(0.0, 1.0 - abs(t - (i * 0.25)) / half_width) for i in range(slot_count)]
    total = sum(weights)
    if total <= 0:
        return [1.0 / slot_count] * slot_count
    return [w / total for w in weights]


class MultiAudioMixWeightsTest(unittest.TestCase):
    def test_neutral_peak_at_center(self):
        weights = compute_slot_weights(0.5)
        self.assertAlmostEqual(weights[2], 1.0, places=5)
        self.assertAlmostEqual(sum(weights), 1.0, places=5)

    def test_disruptive_minus_peak_at_zero(self):
        weights = compute_slot_weights(0.0)
        self.assertEqual(max(range(5), key=lambda i: weights[i]), 0)

    def test_disruptive_plus_peak_at_one(self):
        weights = compute_slot_weights(1.0)
        self.assertEqual(max(range(5), key=lambda i: weights[i]), 4)

    def test_weights_always_normalize(self):
        for t in [0.0, 0.12, 0.5, 0.88, 1.0]:
            weights = compute_slot_weights(t)
            self.assertAlmostEqual(sum(weights), 1.0, places=5)
            self.assertTrue(all(w >= 0 for w in weights))


if __name__ == '__main__':
    unittest.main()
