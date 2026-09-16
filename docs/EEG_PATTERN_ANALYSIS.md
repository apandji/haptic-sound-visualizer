# Participant-paired EEG pattern screening

Run from the repository root:

```powershell
python -m pip install -r requirements-analysis.txt
python analyze_eeg_patterns.py --db "C:\path\to\haptic_research_v2.db"
```

The script opens SQLite read-only and writes `report.md` and `results.json` to a timestamped directory under `exports/` (git-ignored). Supply `--out exports/my-analysis` to choose a directory. The JSON contains all individual trial changes, participant changes, baseline references, phase rejection counts, trial exclusion reasons, parameters, and library versions. Participant IDs remain coded; no names or demographics are exported. The input must be the current v2 schema, not the legacy database or a summary-only export. This script does not alter the dashboard, acquisition pipeline, or study database.

## What the existing code does

- `eeg_server.py:compute_bandpowers_uV2` uses BrainFlow Welch PSD, with 50% overlap and the configured window function. `read_real_eeg` averages raw EEG channels **before** computing the PSD. Default acquisition uses a rolling 2-second window updated every 0.1 second. These overlapping summaries are not independent observations.
- Powers are trapezoidal PSD integrals: delta 1–4 Hz, theta 4–8 Hz, alpha 8–12 Hz, beta 13–30 Hz, gamma 30–45 Hz. This implementation leaves a 12–13 Hz gap in the named bands. Relative power divides each band by the full 1–45 Hz integral, **not** by the sum of the five named bands. Gamma here is only 30–45 Hz.
- There is no explicit temporal bandpass/notch filtering, detrending, ICA, or artifact rejection in this acquisition path. Integrating selected PSD frequencies is not artifact removal. Averaging voltages before PSD may cancel channels and is different from averaging per-channel powers.
- `eeg_quality.py` classifies per-channel 1–45 Hz RMS, with good 5–100 microvolts and OK above 100 through 150; other values are poor. The recorded aggregate is the worst channel score: good 100, OK 70, poor 30. Quality is measured, but `analysisDataProcessor.js` does not reject poor-quality readings when computing its means.
- The Analyze page computes each trial's relative stimulation mean minus baseline mean, then averages trial changes. Repeat participants therefore receive more weight. A missing trial baseline can use the first completed same-session baseline. Missing band values can produce zero means. Its plotted intervals are not the participant-level inference in this script.
- The “What needs attention” panel is heuristic: by default, two EEG trials with all mean relative shifts below 0.03 can become “Retire candidates.” This is three **percentage points**, not a 3% proportional change. “Worth digging into” additionally uses survey counts/placement and a confidence score. That score combines count, rating agreement, and self-reported sureness; it is not a p-value, confidence interval, or probability that a finding is true. “Mixed signals” uses survey spread, not EEG heterogeneity. Disagreement alone is not grounds for deleting a valid trial.

## Quality handling

The database contains band summaries and an aggregate quality score, not raw channel waveforms. It is impossible to retrospectively apply a valid EEG notch/bandpass filter or ICA to these summaries. The new script instead adds **quality-based window rejection**, without duplicating PSD calculations or pretending to remove all artifacts:

1. Honor analyst trial exclusions and omit trials without an end time.
2. Trim the first 2 seconds of each phase to reduce baseline/stimulation overlap from rolling acquisition windows. If acquisition used a longer window, increase `--trim-seconds` to match it.
3. Reject duplicate/invalid timestamps, unknown quality or scores below 70, nonfinite/nonpositive absolute powers, and relative powers outside 0–1. A reading must be valid for all five bands, so endpoints use the same windows. No clipping, imputation, or rejection based on the direction of a result.
4. Require at least 10 occupied one-second bins and 50% retained readings after onset trimming. Gaps do not count as recorded time; this is approximate occupied-bin coverage, not proof of ten seconds of independent raw EEG.
5. Average within occupied one-second bins and then across those bins, so bursts of messages do not receive disproportionate weight. Overlapping readings are never counted as independent people.

Thresholds are configurable with `--min-quality`, `--trim-seconds`, `--min-seconds`, and `--min-retained`. Choose them before examining results. Compare a prespecified stricter run (e.g. quality 100) as a sensitivity analysis; do not select whichever setting produces significance. Rejection can itself introduce selection bias; inspect the audits.

By default, only a trial's **own** baseline is used. If the protocol deliberately records one baseline per session, use `--baseline-mode session`. This permits an earlier, completed, nonexcluded same-session baseline only when the trial has no baseline readings at all. A failed own baseline is never replaced. Every baseline trial ID is recorded. Session reuse introduces drift/carryover concerns and does not add independent observations.

## Statistical unit and endpoints

For each participant, pattern, and trial, calculate:

- Absolute power change: stimulation minus that trial's baseline (microvolts squared), exported descriptively.
- Absolute log power ratio: `ln(stimulation / baseline)`. This scales change to the person's baseline and reduces the influence of very large baseline amplitudes. `100 * (exp(mean_log_ratio) - 1)` describes the geometric proportional change; transform interval endpoints the same way. It is not the arithmetic mean percentage change.
- Relative power change: `100 * (stimulation_relative - baseline_relative)`, in percentage points.

Average repeated trial changes within the same participant and sound, including across sessions. Then give each participant **one equal-weight observation** per sound. Group inference never compares a pooled baseline population with a pooled stimulation population and never treats EEG timestamps or repeated trials as independent people. This estimates the average participant's average response to a sound; it does not model session/order effects.

Two-sided one-sample t tests against zero on participant changes give p-values and 95% t intervals. This is paired inference after calculating individual changes. Standardized change `dz` and the fraction of positive participant changes are also exported. Default minimum N is six distinct participants; this is a reporting gate, not a power calculation or guarantee of reliable inference. Constant changes have undefined variance-based inference and are flagged, not called significant.

For each sound, also test all ten pairs of bands using Pearson correlations of **participant absolute log-power changes** and Fisher-transformed 95% intervals. This asks whether people who change more in one band also change more in another. It does not estimate temporal coupling within a person. Absolute changes avoid the direct shared-denominator constraint of relative power, although common noise, shared baselines, and artifacts can still induce correlation. T tests assume approximately normal independent participant changes; Pearson tests/intervals assume independent approximately bivariate-normal pairs. Inspect participant values and confirm exploratory findings in new participants.

All ten band-change tests (five bands × two metrics) and ten correlations per tested sound form **one global family**. Benjamini–Yekutieli correction controls false discovery rate under arbitrary dependence, conservatively accommodating related bands and repeated people across sounds. Untestable comparisons remain in the family with p=1 internally and are displayed as unavailable. Default cutoff is adjusted p ≤ 0.05. The 95% intervals are pointwise, not simultaneous or selection-adjusted. A pointwise interval excluding zero may still fail multiplicity correction.

The sound ranking uses adjusted band-change results. Correlations appear separately and cannot by themselves make a sound a band-change candidate. “Candidate for follow-up” means evidence of a nonzero change under these assumptions, **not** a beneficial, causal, clinically important, or replicated effect. A minimum practically meaningful change and desired direction have not been specified. “Inconclusive” does not mean no effect. Retirement would require a prespecified equivalence margin and adequate precision/power, neither supplied here. No causal claim is possible from baseline-versus-stimulation alone without addressing control conditions, order, drift, and carryover.

## Data availability and provenance

At implementation time this checkout had no `haptic_research_v2.db`. Automated checks use synthetic data only; they establish software behavior, not study findings. Supply the actual study database to generate sound-specific results. The stored readings omit the stream's mock/board source flag, so the script cannot reliably identify historical mock trials. Verify the input corpus consists of actual participant EEG and exclude known mock sessions in the source database before interpreting results.

## Validation and references

```powershell
python -m unittest discover -s tests -p test_eeg_pattern_analysis.py
```

Tests cover repeated-participant weighting, missing and rejected baselines, excluded references, quality/missing values, timestamp duplicates, paired inference, global correction, correlations, and a synthetic SQLite-to-report run that leaves input bytes unchanged.

- [SciPy one-sample t test and confidence interval](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.ttest_1samp.html)
- [SciPy Pearson correlation and Fisher confidence interval](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.pearsonr.html)
- [SciPy false discovery control, including BY under dependent tests](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.false_discovery_control.html)
