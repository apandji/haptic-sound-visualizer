"""Synthetic data only: verify pairing, independent units, QC, and inference."""
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

import numpy as np
from scipy import stats

from analyze_eeg_patterns import (BANDS, analyze, clean_phase, load_trials, main,
                                  mean_test, paired_changes)


def reading(second, power=10, quality=100):
    return {'timestamp_ms': second * 1000, 'signal_quality': quality,
            **{f'{b}_abs': power for b in BANDS},
            **{f'{b}_rel': 0.2 for b in BANDS}}


def trial(tid, participant=1, session=1, order=1, excluded=0):
    return {'trial_id': tid, 'participant_id': participant, 'session_id': session,
            'pattern_id': 1, 'pattern_name': 'synthetic', 'file_path': 'synthetic.wav',
            'trial_order': order, 'exclude_from_analysis': excluded, 'end_time': 'done'}


def phases(tid, ratio=2):
    return {(tid, 'baseline'): [reading(i) for i in range(15)],
            (tid, 'stimulation'): [reading(i + 30, 10 * ratio) for i in range(15)]}


class AnalysisTests(unittest.TestCase):
    def test_quality_rejection_and_coverage(self):
        rows = [reading(i) for i in range(15)]
        rows[3]['signal_quality'] = None
        rows[4]['signal_quality'] = 30
        rows[5]['alpha_abs'] = float('nan')
        means, audit = clean_phase(rows)
        self.assertIsNotNone(means)
        self.assertEqual(audit['retained'], 10)
        self.assertEqual(audit['rejected']['poor_or_unknown_quality'], 2)
        self.assertEqual(audit['rejected']['phase_onset'], 2)
        self.assertIsNone(clean_phase([reading(0), reading(100)])[0])

    def test_duplicates_cannot_manufacture_coverage(self):
        rows = [reading(0)] + [reading(4)] * 1000
        self.assertIsNone(clean_phase(rows)[0])

    def test_repeat_trials_do_not_multiply_participants(self):
        trials = [trial(i, order=i) for i in range(1, 11)] + [trial(11, participant=2, session=2)]
        readings = {}
        for t in trials:
            readings.update(phases(t['trial_id'], 2 if t['participant_id'] == 1 else 0.5))
        changes, participants, _, _ = paired_changes(trials, readings)
        alpha = [r['log_power_ratio'] for r in participants if r['band'] == 'alpha']
        self.assertEqual(len(changes), 55)
        self.assertEqual(len(alpha), 2)
        self.assertAlmostEqual(np.mean(alpha), 0)
        effects, _, _, _ = analyze(trials, participants)
        self.assertTrue(all(r['n_participants'] == 2 for r in effects))
        self.assertTrue(all(r['p_value'] is None for r in effects))

    def test_missing_baseline_not_zero_or_automatically_borrowed(self):
        trials = [trial(1), trial(2, order=2)]
        readings = phases(1)
        readings[(2, 'stimulation')] = phases(2)[(2, 'stimulation')]
        self.assertEqual(len(paired_changes(trials, readings)[0]), 5)
        changes = paired_changes(trials, readings, baseline_mode='session')[0]
        self.assertEqual(len(changes), 10)
        self.assertEqual(changes[-1]['baseline_trial_id'], 1)
        # Failed own QC must not be rescued by a different baseline.
        readings[(2, 'baseline')] = [reading(i, quality=30) for i in range(15)]
        self.assertEqual(len(paired_changes(trials, readings, baseline_mode='session')[0]), 5)

    def test_excluded_baseline_cannot_be_reused(self):
        trials = [trial(1, excluded=1), trial(2, order=2)]
        readings = phases(1)
        readings[(2, 'stimulation')] = phases(2)[(2, 'stimulation')]
        self.assertEqual(len(paired_changes(trials, readings, baseline_mode='session')[0]), 0)

    def test_paired_test_and_interval(self):
        values = [0.1, 0.3, 0.2, 0.15, 0.12, 0.22]
        result = mean_test(values, 6)
        expected = stats.ttest_rel(np.asarray(values) + 10, np.full(6, 10.0))
        self.assertAlmostEqual(result['p_value'], expected.pvalue)
        self.assertAlmostEqual(result['ci95_low'], expected.confidence_interval().low)
        self.assertEqual(mean_test([1] * 6, 6)['status'], 'degenerate_variance')

    def test_global_multiplicity_and_correlations(self):
        rng = np.random.default_rng(827)
        people = []
        for person in range(30):
            shared = rng.normal(0.4, 0.1)
            for band in BANDS:
                people.append({'participant_id': person, 'pattern_id': 1, 'band': band,
                               'log_power_ratio': shared + rng.normal(0, 0.01),
                               'relative_change_pp': rng.normal(0, 1)})
        effects, correlations, ranking, family_size = analyze([trial(1)], people)
        self.assertEqual(family_size, 20)
        expected = stats.false_discovery_control(
            [r['p_value'] for r in effects + correlations], method='by')
        np.testing.assert_allclose([r['q_value_by'] for r in effects + correlations], expected)
        self.assertEqual(ranking[0]['status'], 'candidate_for_follow_up')
        self.assertTrue(all(r['r'] > 0.9 for r in correlations))

    def test_cli_read_only_and_json_report(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'study.db'
            db = sqlite3.connect(path)
            db.executescript((Path(__file__).resolve().parents[1] / 'schema_v2.sql').read_text())
            db.execute("INSERT INTO participants (participant_id, participant_code) VALUES (1, 'synthetic')")
            db.execute("INSERT INTO locations (location_id, name) VALUES (1, 'synthetic')")
            db.execute("INSERT INTO patterns (pattern_id, name, file_path) VALUES (1, 'synthetic', 'fake.wav')")
            db.execute("INSERT INTO sessions (session_id, participant_id, location_id, session_date) VALUES (1,1,1,'2026-01-01')")
            db.execute("INSERT INTO trials (trial_id,session_id,pattern_id,trial_order,start_time,end_time) VALUES (1,1,1,1,'start','end')")
            for (_, phase), rows in phases(1).items():
                for row in rows:
                    payload = {'trial_id': 1, 'phase': phase, **row}
                    db.execute(f"INSERT INTO brainwave_readings ({','.join(payload)}) VALUES ({','.join('?' for _ in payload)})", list(payload.values()))
            db.commit()
            db.close()
            original = path.read_bytes()
            out = Path(directory) / 'report'
            main(['--db', str(path), '--out', str(out)])
            self.assertEqual(path.read_bytes(), original)
            result = json.loads((out / 'results.json').read_text())
            self.assertEqual(len(result['trial_changes']), 5)
            self.assertEqual(result['pattern_ranking'][0]['n_participants'], 1)
            self.assertTrue((out / 'report.md').is_file())
            with self.assertRaises(ValueError):
                load_trials(Path(directory) / 'missing.db')
            self.assertFalse((Path(directory) / 'missing.db').exists())


if __name__ == '__main__':
    unittest.main()
