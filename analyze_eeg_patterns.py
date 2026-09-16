#!/usr/bin/env python3
"""Participant-paired exploratory EEG analysis; see docs/EEG_PATTERN_ANALYSIS.md."""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
from itertools import combinations
import json
from pathlib import Path
import sqlite3

import numpy as np
import scipy
from scipy import stats

BANDS = ('delta', 'theta', 'alpha', 'beta', 'gamma')
ROOT = Path(__file__).resolve().parent


def finite(value):
    return isinstance(value, (int, float)) and np.isfinite(value)


def clean_phase(rows, *, min_quality=70, trim_seconds=2.0,
                min_seconds=10.0, min_retained=0.5):
    """Reject invalid/poor-quality summaries, not raw EEG artifact correction.

    Joint validity keeps all bands on the same windows. No outcome-dependent
    outlier removal. Trim phase onset to reduce rolling-window contamination.
    """
    rejected = Counter()
    timed = [r for r in rows if finite(r['timestamp_ms'])]
    rejected['invalid_timestamp'] = len(rows) - len(timed)
    if not timed:
        return None, {'input': len(rows), 'retained': 0, 'reason': 'no_readings',
                      'rejected': dict(rejected)}
    onset = min(r['timestamp_ms'] for r in timed)
    kept, seen = [], set()
    eligible = 0
    for row in sorted(timed, key=lambda r: r['timestamp_ms']):
        timestamp = row['timestamp_ms']
        if timestamp - onset < trim_seconds * 1000:
            rejected['phase_onset'] += 1
            continue
        if timestamp in seen:
            rejected['duplicate_timestamp'] += 1
            continue
        seen.add(timestamp)
        eligible += 1
        quality = row['signal_quality']
        if not finite(quality) or not min_quality <= quality <= 100:
            rejected['poor_or_unknown_quality'] += 1
            continue
        if any(not finite(row[f'{b}_abs']) or row[f'{b}_abs'] <= 0
               or not finite(row[f'{b}_rel']) or not 0 <= row[f'{b}_rel'] <= 1
               for b in BANDS):
            rejected['invalid_band_power'] += 1
            continue
        kept.append(row)
    # Coverage counts occupied one-second bins; gaps do not count as exposure.
    seconds = len({int((r['timestamp_ms'] - onset) // 1000) for r in kept})
    fraction = len(kept) / eligible if eligible else 0.0
    usable = seconds >= min_seconds and fraction >= min_retained
    audit = {'input': len(rows), 'retained': len(kept), 'occupied_seconds': seconds,
             'retained_fraction': fraction, 'rejected': dict(rejected),
             'reason': 'usable' if usable else 'insufficient_clean_coverage'}
    if not usable:
        return None, audit
    # Equal weighting of occupied seconds avoids weighting bursty delivery more.
    bins = defaultdict(list)
    for row in kept:
        bins[int((row['timestamp_ms'] - onset) // 1000)].append(row)
    means = {f'{b}_{kind}': float(np.mean([
        np.mean([r[f'{b}_{kind}'] for r in block]) for block in bins.values()
    ])) for b in BANDS for kind in ('abs', 'rel')}
    return means, audit


def load_trials(db):
    """Open read-only, validate schema, and load one consistent SQLite snapshot."""
    path = Path(db).resolve()
    if not path.is_file():
        raise ValueError(f'Database not found: {path}. Supply --db with the study database.')
    connection = sqlite3.connect(path.as_uri() + '?mode=ro', uri=True)
    connection.row_factory = sqlite3.Row
    try:
        connection.execute('BEGIN')
        required = {
            'trials': {'trial_id', 'session_id', 'pattern_id', 'trial_order',
                       'end_time', 'exclude_from_analysis'},
            'sessions': {'session_id', 'participant_id'},
            'patterns': {'pattern_id', 'name', 'file_path'},
            'brainwave_readings': {'reading_id', 'trial_id', 'timestamp_ms', 'phase', 'signal_quality',
                                  *(f'{b}_{k}' for b in BANDS for k in ('abs', 'rel'))},
        }
        for table, columns in required.items():
            actual = {r['name'] for r in connection.execute(f'PRAGMA table_info({table})')}
            missing = columns - actual
            if missing:
                raise ValueError(f'{table} missing columns {sorted(missing)}; use the current v2 study database.')
        trials = [dict(r) for r in connection.execute('''
            SELECT t.*, s.participant_id, p.name AS pattern_name, p.file_path
            FROM trials t JOIN sessions s USING(session_id)
            JOIN patterns p USING(pattern_id)
            ORDER BY t.session_id, t.trial_order, t.trial_id
        ''')]
        readings = defaultdict(list)
        for row in connection.execute('SELECT * FROM brainwave_readings ORDER BY reading_id'):
            readings[(row['trial_id'], row['phase'])].append(dict(row))
        return trials, readings
    finally:
        connection.close()


def paired_changes(trials, readings, *, baseline_mode='trial', **quality_options):
    cache, phase_audit = {}, []
    for (trial_id, phase), rows in readings.items():
        means, audit = clean_phase(rows, **quality_options)
        cache[(trial_id, phase)] = means
        phase_audit.append({'trial_id': trial_id, 'phase': phase, **audit})
    references = {}
    trials_by_id = {trial['trial_id']: trial for trial in trials}
    for trial in trials:
        if (not trial['exclude_from_analysis'] and trial['end_time']
                and cache.get((trial['trial_id'], 'baseline'))):
            references.setdefault(trial['session_id'], trial['trial_id'])
    changes, trial_audit = [], []
    for trial in trials:
        tid = trial['trial_id']
        reason = None
        if trial['exclude_from_analysis']:
            reason = 'analyst_excluded'
        elif not trial['end_time']:
            reason = 'incomplete_trial'
        elif trial['participant_id'] is None:
            reason = 'missing_participant'
        base_id = tid
        # Only borrow when own baseline is absent, never when it failed QC.
        if (baseline_mode == 'session' and not readings.get((tid, 'baseline'))):
            candidate = references.get(trial['session_id'])
            # No future baseline: prevent stimulation contaminating its reference.
            candidate_trial = trials_by_id.get(candidate)
            if candidate_trial and candidate_trial['trial_order'] <= trial['trial_order']:
                base_id = candidate
        baseline = cache.get((base_id, 'baseline'))
        stimulation = cache.get((tid, 'stimulation'))
        if not reason and (baseline is None or stimulation is None):
            reason = 'missing_or_unusable_paired_phase'
        trial_audit.append({'trial_id': tid, 'pattern_id': trial['pattern_id'],
                            'baseline_trial_id': base_id, 'reason': reason or 'included'})
        if reason:
            continue
        for band in BANDS:
            ba, sa = baseline[f'{band}_abs'], stimulation[f'{band}_abs']
            changes.append({
                'trial_id': tid, 'session_id': trial['session_id'],
                'participant_id': trial['participant_id'], 'pattern_id': trial['pattern_id'],
                'pattern_name': trial['pattern_name'], 'file_path': trial['file_path'],
                'baseline_trial_id': base_id, 'band': band,
                'baseline_abs': ba, 'stimulation_abs': sa,
                'absolute_change_uv2': sa - ba,
                'log_power_ratio': float(np.log(sa) - np.log(ba)),
                'relative_change_pp': 100 * (stimulation[f'{band}_rel'] - baseline[f'{band}_rel']),
            })
    groups = defaultdict(list)
    for row in changes:
        groups[(row['participant_id'], row['pattern_id'], row['band'])].append(row)
    participants = []
    for (participant, pattern, band), rows in sorted(groups.items()):
        participants.append({
            'participant_id': participant, 'pattern_id': pattern, 'band': band,
            'n_trials': len(rows),
            **{metric: float(np.mean([r[metric] for r in rows])) for metric in
               ('absolute_change_uv2', 'log_power_ratio', 'relative_change_pp')},
        })
    return changes, participants, phase_audit, trial_audit


def mean_test(values, min_participants):
    values = np.asarray(values, dtype=float)
    n = len(values)
    result = {'n_participants': n, 'mean': float(values.mean()) if n else None,
              'ci95_low': None, 'ci95_high': None, 'p_value': None,
              'standardized_change_dz': None, 'positive_fraction':
              float(np.mean(values > 0)) if n else None, 'status': 'insufficient_data'}
    if n < min_participants:
        return result
    if np.ptp(values) < 1e-12:
        result['status'] = 'degenerate_variance'
        return result
    test = stats.ttest_1samp(values, 0)
    ci = test.confidence_interval()
    result.update(ci95_low=float(ci.low), ci95_high=float(ci.high),
                  p_value=float(test.pvalue),
                  standardized_change_dz=float(values.mean() / values.std(ddof=1)),
                  status='tested')
    return result


def analyze(trials, participants, min_participants=6, fdr=0.05):
    patterns = {t['pattern_id']: {'pattern_id': t['pattern_id'],
                'pattern_name': t['pattern_name'], 'file_path': t['file_path']} for t in trials}
    effects, correlations = [], []
    for pid, pattern in sorted(patterns.items()):
        rows = [r for r in participants if r['pattern_id'] == pid]
        for band in BANDS:
            band_rows = [r for r in rows if r['band'] == band]
            for metric in ('log_power_ratio', 'relative_change_pp'):
                effects.append({**pattern, 'band': band, 'metric': metric,
                                **mean_test([r[metric] for r in band_rows], min_participants)})
        by_person = defaultdict(dict)
        for row in rows:
            by_person[row['participant_id']][row['band']] = row['log_power_ratio']
        for a, b in combinations(BANDS, 2):
            pairs = [(v[a], v[b]) for v in by_person.values() if a in v and b in v]
            result = {**pattern, 'band_a': a, 'band_b': b, 'n_participants': len(pairs),
                      'r': None, 'ci95_low': None, 'ci95_high': None,
                      'p_value': None, 'status': 'insufficient_data'}
            if len(pairs) >= min_participants:
                x, y = np.asarray(pairs).T
                if np.ptp(x) < 1e-12 or np.ptp(y) < 1e-12:
                    result['status'] = 'degenerate_variance'
                else:
                    test = stats.pearsonr(x, y)
                    ci = test.confidence_interval()
                    result.update(r=float(test.statistic), p_value=float(test.pvalue),
                                  ci95_low=float(ci.low), ci95_high=float(ci.high), status='tested')
            correlations.append(result)
    # One family across ALL patterns, both band endpoints and all correlations.
    # Untestable planned comparisons enter as p=1 (conservative, visible family).
    family = effects + correlations
    if family:
        qvalues = stats.false_discovery_control(
            [r['p_value'] if r['p_value'] is not None else 1.0 for r in family], method='by')
        for row, q in zip(family, qvalues):
            row['q_value_by'] = float(q) if row['p_value'] is not None else None
            if row['status'] == 'tested':
                row['status'] = 'candidate_for_follow_up' if q <= fdr else 'inconclusive'
    ranking = []
    for pid, pattern in sorted(patterns.items()):
        pe = [r for r in effects if r['pattern_id'] == pid]
        candidates = [r for r in pe if r['status'] == 'candidate_for_follow_up']
        tested = [r for r in pe if r['p_value'] is not None]
        best = min(tested, key=lambda r: r['q_value_by']) if tested else None
        ranking.append({**pattern, 'n_participants': max(r['n_participants'] for r in pe),
                        'status': 'candidate_for_follow_up' if candidates else
                        ('inconclusive' if tested else 'insufficient_or_degenerate_data'),
                        'best_q_value_by': best['q_value_by'] if best else None,
                        'supported_band_metrics': [f"{r['band']}:{r['metric']}" for r in candidates]})
    ranking.sort(key=lambda r: (r['best_q_value_by'] is None, r['best_q_value_by'] or 0, r['pattern_id']))
    return effects, correlations, ranking, len(family)


def markdown_report(result):
    lines = ['# Participant-paired EEG screening', '',
             'Exploratory associations, not proof of benefit or causation. '
             'Nonsignificant patterns are inconclusive, not ineffective.', '',
             f"Included trials: {len({r['trial_id'] for r in result['trial_changes']})}. "
             f"Planned comparisons: {result['comparison_count']}. "
             'P-values adjusted together using Benjamini–Yekutieli FDR.', '',
             'Each participant has equal weight per sound after averaging their repeated trial changes. '
             '95% intervals are pointwise, not corrected for selection or multiple comparisons.', '',
             '| Sound (pattern ID) | People | Result | Best adjusted p |',
             '| --- | ---: | --- | ---: |']
    for row in result['pattern_ranking']:
        name = row['pattern_name'].replace('|', '\\|').replace('\n', ' ')
        q = row['best_q_value_by']
        lines.append(f"| {name} ({row['pattern_id']}) | {row['n_participants']} | "
                     f"{row['status']} | {q:.4g} |" if q is not None else
                     f"| {name} ({row['pattern_id']}) | {row['n_participants']} | {row['status']} | — |")
    lines += ['', '## Band changes', '',
              'Log power ratio = ln(stimulation absolute power / own baseline absolute power). '
              'Relative changes are percentage points of 1–45 Hz power.', '',
              '| Sound ID | Band | Measure | N | Mean | 95% CI | p | Adjusted p |',
              '| --- | --- | --- | ---: | ---: | --- | ---: | ---: |']
    def fmt(v):
        return '—' if v is None else f'{v:.4g}'
    for row in result['band_effects']:
        lines.append(f"| {row['pattern_id']} | {row['band']} | {row['metric']} | "
                     f"{row['n_participants']} | {fmt(row['mean'])} | "
                     f"{fmt(row['ci95_low'])}, {fmt(row['ci95_high'])} | "
                     f"{fmt(row['p_value'])} | {fmt(row['q_value_by'])} |")
    lines += ['', '## Correlations between participant band changes', '',
              'Pearson correlations of absolute log power changes, separately for each sound. '
              'These are not within-recording temporal correlations.', '',
              '| Sound ID | Bands | N | r | 95% CI | p | Adjusted p |',
              '| --- | --- | ---: | ---: | --- | ---: | ---: |']
    for row in result['band_correlations']:
        lines.append(f"| {row['pattern_id']} | {row['band_a']} / {row['band_b']} | "
                     f"{row['n_participants']} | {fmt(row['r'])} | "
                     f"{fmt(row['ci95_low'])}, {fmt(row['ci95_high'])} | "
                     f"{fmt(row['p_value'])} | {fmt(row['q_value_by'])} |")
    lines += ['', '## Limitations', '', *[f'- {s}' for s in result['limitations']], '',
              'See results.json for participant changes, trial changes, and every quality exclusion.']
    return '\n'.join(lines) + '\n'


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', type=Path, default=ROOT / 'haptic_research_v2.db')
    parser.add_argument('--out', type=Path, default=ROOT / 'exports' /
                        datetime.now().strftime('eeg_stats_%Y%m%d_%H%M%S'))
    parser.add_argument('--baseline-mode', choices=['trial', 'session'], default='trial')
    parser.add_argument('--min-quality', type=float, default=70)
    parser.add_argument('--trim-seconds', type=float, default=2)
    parser.add_argument('--min-seconds', type=float, default=10)
    parser.add_argument('--min-retained', type=float, default=0.5)
    parser.add_argument('--min-participants', type=int, default=6)
    parser.add_argument('--fdr', type=float, default=0.05)
    args = parser.parse_args(argv)
    if not (0 <= args.min_quality <= 100 and args.trim_seconds >= 0 and args.min_seconds > 0
            and 0 < args.min_retained <= 1 and args.min_participants >= 4 and 0 < args.fdr < 1):
        parser.error('Invalid thresholds; require min-participants >= 4 and valid quality/coverage/FDR bounds.')
    try:
        trials, readings = load_trials(args.db)
    except (ValueError, sqlite3.Error) as exc:
        parser.error(str(exc))
    changes, participants, phase_audit, trial_audit = paired_changes(
        trials, readings, baseline_mode=args.baseline_mode, min_quality=args.min_quality,
        trim_seconds=args.trim_seconds, min_seconds=args.min_seconds, min_retained=args.min_retained)
    effects, correlations, ranking, comparison_count = analyze(
        trials, participants, args.min_participants, args.fdr)
    result = {
        'created_utc': datetime.now(timezone.utc).isoformat(),
        'configuration': {k: str(v) if isinstance(v, Path) else v for k, v in vars(args).items()},
        'versions': {'numpy': np.__version__, 'scipy': scipy.__version__},
        'comparison_count': comparison_count,
        'pattern_ranking': ranking, 'band_effects': effects, 'band_correlations': correlations,
        'participant_changes': participants, 'trial_changes': changes,
        'phase_audit': phase_audit, 'trial_audit': trial_audit,
        'limitations': [
            'Stored band powers are not raw EEG. Quality rejection cannot remove all eye, muscle, '
            'motion, or line-noise artifacts; no retrospective raw-signal filter was applied.',
            'The acquisition code averages channels before Welch PSD; raw channel data is not retained.',
            'Mock/board provenance is not stored in brainwave_readings. Verify this corpus contains real EEG.',
            'Independent participants and approximately normal participant changes are assumed for t tests; '
            'Pearson inference assumes independent approximately bivariate-normal change pairs. Small N is fragile.',
            'Relative powers share a denominator. Correlations use absolute log changes to reduce closure artifacts, '
            'but shared noise and baseline estimation error can still correlate changes.',
            'No randomized sham/control adjustment: order, drift, carryover and expectancy can explain changes. '
            'A band increase or decrease is not inherently beneficial.',
            'A significant change is a follow-up candidate. Lack of significance is not evidence of equivalence. '
            'No effect-size threshold or desired response direction has been specified.',
            'Session baseline reuse is opt-in and may introduce drift; exclusions and baseline IDs are audited.',
        ],
    }
    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / 'results.json').write_text(json.dumps(result, indent=2, allow_nan=False), encoding='utf-8')
    (args.out / 'report.md').write_text(markdown_report(result), encoding='utf-8')
    print(f"Analyzed {len(trials)} trials; {len(changes) // len(BANDS)} included. Report: {args.out / 'report.md'}")
    if not changes:
        print('No usable paired EEG data. Inspect trial/phase audit; no scientific findings can be inferred.')


if __name__ == '__main__':
    main()
