/**
 * AnalysisDataProcessor Module
 * Aggregates session data for the analysis dashboard.
 * Pure logic — no DOM access.
 */
class AnalysisDataProcessor {
    constructor(options = {}) {
        this.sessions = options.sessions || [];
        this.bands = ['delta', 'theta', 'alpha', 'beta', 'gamma'];
    }

    /**
     * Load/replace sessions data
     * @param {Array} sessions - Array of session objects from localStorage/JSON
     */
    loadSessions(sessions) {
        this.sessions = sessions || [];
    }

    /**
     * Get all unique patterns found across loaded sessions
     * @returns {Array} [{name, path, trialCount, sessionCount, uniqueParticipants}]
     */
    getUniquePatterns() {
        const patternMap = {};

        for (const session of this.sessions) {
            if (!session.trials) continue;
            for (const trial of session.trials) {
                if (trial.status !== 'completed') continue;
                const name = trial.pattern?.name;
                if (!name) continue;

                if (!patternMap[name]) {
                    patternMap[name] = {
                        name,
                        path: trial.pattern.path || '',
                        trialCount: 0,
                        sessionIds: new Set(),
                        participantIds: new Set()
                    };
                }
                patternMap[name].trialCount++;
                patternMap[name].sessionIds.add(session.sessionId);
                patternMap[name].participantIds.add(session.participant_id);
            }
        }

        return Object.values(patternMap)
            .map(p => ({
                name: p.name,
                path: p.path,
                trialCount: p.trialCount,
                sessionCount: p.sessionIds.size,
                uniqueParticipants: p.participantIds.size
            }))
            .sort((a, b) => b.trialCount - a.trialCount);
    }

    /**
     * Get full analysis for a single pattern
     * @param {string} patternName
     * @returns {Object} {summary, radar, boxPlots, timeSeries, tagFrequency}
     */
    getPatternAnalysis(patternName) {
        const trials = this._getTrialsForPattern(patternName);

        if (trials.length === 0) {
            return null;
        }

        const deltas = trials.map(t => this._computeDelta(t));
        const tagFrequency = this._computeTagFrequency(trials);

        return {
            patternName,
            summary: this._computeSummary(trials, deltas, tagFrequency),
            radar: this._computeRadar(trials),
            boxPlots: this._computeBoxPlots(deltas),
            timeSeries: this._computeTimeSeries(trials),
            tagFrequency
        };
    }

    /**
     * Get comparison analysis for multiple patterns
     * @param {Array<string>} patternNames
     * @returns {Object} {patterns: [{name, radar, boxPlots, tagFrequency, summary}]}
     */
    getComparisonAnalysis(patternNames) {
        return {
            patterns: patternNames.map(name => {
                const analysis = this.getPatternAnalysis(name);
                if (!analysis) return { name, radar: null, boxPlots: null, tagFrequency: [], summary: null };
                return {
                    name,
                    radar: analysis.radar,
                    boxPlots: analysis.boxPlots,
                    timeSeries: analysis.timeSeries,
                    tagFrequency: analysis.tagFrequency,
                    summary: analysis.summary
                };
            })
        };
    }

    // --- Internal helpers ---

    /**
     * Get all completed trials for a pattern across all sessions
     */
    _getTrialsForPattern(patternName) {
        const trials = [];
        for (const session of this.sessions) {
            if (!session.trials) continue;
            for (const trial of session.trials) {
                if (trial.status !== 'completed') continue;
                if (trial.pattern?.name !== patternName) continue;
                if (!trial.baselineReadings?.length || !trial.stimulationReadings?.length) continue;
                trials.push({
                    ...trial,
                    participantId: session.participant_id,
                    calibrationReadings: session.calibrationReadings || []
                });
            }
        }
        return trials;
    }

    /**
     * Compute mean of a band across an array of readings
     */
    _meanBand(readings, bandKey) {
        if (!readings || readings.length === 0) return 0;
        let sum = 0;
        let count = 0;
        for (const r of readings) {
            const val = r[bandKey];
            if (val !== undefined && val !== null) {
                sum += val;
                count++;
            }
        }
        return count > 0 ? sum / count : 0;
    }

    /**
     * Compute delta (stimulation - baseline) per band for a single trial
     * Uses relative power (_rel)
     */
    _computeDelta(trial) {
        const delta = {};
        for (const band of this.bands) {
            const key = `${band}_rel`;
            const baselineAvg = this._meanBand(trial.baselineReadings, key);
            const stimulationAvg = this._meanBand(trial.stimulationReadings, key);
            delta[band] = stimulationAvg - baselineAvg;
        }
        return delta;
    }

    /**
     * Compute summary stats
     */
    _computeSummary(trials, deltas, tagFrequency) {
        const participantIds = new Set(trials.map(t => t.participantId));

        // Find most changed band (largest absolute average delta)
        let mostChangedBand = { band: 'alpha', avgDelta: 0 };
        for (const band of this.bands) {
            const values = deltas.map(d => d[band]);
            const avg = values.reduce((s, v) => s + v, 0) / values.length;
            if (Math.abs(avg) > Math.abs(mostChangedBand.avgDelta)) {
                mostChangedBand = { band, avgDelta: avg };
            }
        }

        // Most common tag
        const mostCommonTag = tagFrequency.length > 0
            ? { id: tagFrequency[0].id, label: tagFrequency[0].label, count: tagFrequency[0].count }
            : null;

        return {
            totalTrials: trials.length,
            uniqueParticipants: participantIds.size,
            mostChangedBand,
            mostCommonTag
        };
    }

    /**
     * Compute radar data (average relative power for baseline vs stimulation)
     */
    _computeRadar(trials) {
        const baselineAvg = {};
        const stimulationAvg = {};

        for (const band of this.bands) {
            const key = `${band}_rel`;
            const baselineValues = trials.map(t => this._meanBand(t.baselineReadings, key));
            const stimValues = trials.map(t => this._meanBand(t.stimulationReadings, key));

            baselineAvg[key] = baselineValues.reduce((s, v) => s + v, 0) / baselineValues.length;
            stimulationAvg[key] = stimValues.reduce((s, v) => s + v, 0) / stimValues.length;
        }

        return { baselineAvg, stimulationAvg };
    }

    /**
     * Compute box plot data (array of delta values per band)
     */
    _computeBoxPlots(deltas) {
        const result = {};
        for (const band of this.bands) {
            result[band] = deltas.map(d => d[band]);
        }
        return result;
    }

    /**
     * Compute time series with mean and 95% CI per band.
     * Includes calibration (furthest negative), baseline, and stimulation (positive).
     * Computes both _rel and _abs series.
     * Timeline: [-calDur-blDur ... -blDur] calibration | [-blDur ... 0] baseline | [0 ... stimDur] stimulation
     */
    _computeTimeSeries(trials) {
        // Determine calibration duration (max across trials, from session-level data)
        let calibrationDuration = 0;
        for (const trial of trials) {
            if (!trial.calibrationReadings || trial.calibrationReadings.length < 2) continue;
            const calStart = trial.calibrationReadings[0].timestamp_ms;
            const calEnd = trial.calibrationReadings[trial.calibrationReadings.length - 1].timestamp_ms;
            const dur = Math.ceil((calEnd - calStart) / 1000);
            if (dur > calibrationDuration) calibrationDuration = dur;
        }

        // Determine baseline duration (max across trials, in seconds)
        let baselineDuration = 0;
        for (const trial of trials) {
            if (!trial.baselineReadings || trial.baselineReadings.length < 2) continue;
            const blStart = trial.baselineReadings[0].timestamp_ms;
            const blEnd = trial.baselineReadings[trial.baselineReadings.length - 1].timestamp_ms;
            const dur = Math.ceil((blEnd - blStart) / 1000);
            if (dur > baselineDuration) baselineDuration = dur;
        }
        if (baselineDuration === 0) baselineDuration = 10; // fallback

        // Determine stimulation duration (max across trials)
        let stimulationDuration = 0;
        for (const trial of trials) {
            if (!trial.stimulationReadings || trial.stimulationReadings.length < 2) continue;
            const stimStart = trial.stimulationReadings[0].timestamp_ms;
            const stimEnd = trial.stimulationReadings[trial.stimulationReadings.length - 1].timestamp_ms;
            const dur = Math.ceil((stimEnd - stimStart) / 1000);
            if (dur > stimulationDuration) stimulationDuration = dur;
        }
        if (stimulationDuration === 0) stimulationDuration = 30; // fallback

        const totalStart = -(calibrationDuration + baselineDuration);
        const result = { calibrationDuration, baselineDuration, stimulationDuration };

        const suffixes = ['_rel', '_abs'];

        for (const band of this.bands) {
            for (const suffix of suffixes) {
                const key = `${band}${suffix}`;
                const bins = {}; // binIndex → array of values

                for (const trial of trials) {
                    // Calibration readings → most negative time bins
                    // Maps to [-(calDur+blDur) ... -blDur)
                    if (trial.calibrationReadings && trial.calibrationReadings.length > 0) {
                        const calStart = trial.calibrationReadings[0].timestamp_ms;
                        for (const reading of trial.calibrationReadings) {
                            const relativeMs = reading.timestamp_ms - calStart;
                            const binIndex = totalStart + Math.floor(relativeMs / 1000);

                            if (!bins[binIndex]) bins[binIndex] = [];
                            const val = reading[key];
                            if (val !== undefined && val !== null) {
                                bins[binIndex].push(val);
                            }
                        }
                    }

                    // Baseline readings → negative time bins [-blDur ... 0)
                    if (trial.baselineReadings && trial.baselineReadings.length > 0) {
                        const blEnd = trial.baselineReadings[trial.baselineReadings.length - 1].timestamp_ms;
                        for (const reading of trial.baselineReadings) {
                            const relativeMs = reading.timestamp_ms - blEnd;
                            const binIndex = Math.floor(relativeMs / 1000);
                            if (binIndex < -baselineDuration) continue;

                            if (!bins[binIndex]) bins[binIndex] = [];
                            const val = reading[key];
                            if (val !== undefined && val !== null) {
                                bins[binIndex].push(val);
                            }
                        }
                    }

                    // Stimulation readings → positive time bins [0 ... stimDur)
                    if (trial.stimulationReadings && trial.stimulationReadings.length > 0) {
                        const stimStart = trial.stimulationReadings[0].timestamp_ms;
                        for (const reading of trial.stimulationReadings) {
                            const relativeMs = reading.timestamp_ms - stimStart;
                            const binIndex = Math.floor(relativeMs / 1000);
                            if (binIndex < 0 || binIndex >= stimulationDuration) continue;

                            if (!bins[binIndex]) bins[binIndex] = [];
                            const val = reading[key];
                            if (val !== undefined && val !== null) {
                                bins[binIndex].push(val);
                            }
                        }
                    }
                }

                // Build series from totalStart to stimulationDuration-1
                const series = [];
                for (let i = totalStart; i < stimulationDuration; i++) {
                    const values = bins[i] || [];
                    if (values.length === 0) {
                        series.push({ t: i, mean: null, ci_lower: null, ci_upper: null });
                        continue;
                    }

                    const mean = values.reduce((s, v) => s + v, 0) / values.length;
                    const n = values.length;

                    if (n < 2) {
                        series.push({ t: i, mean, ci_lower: mean, ci_upper: mean });
                    } else {
                        const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
                        const stdErr = Math.sqrt(variance / n);
                        const ci = 1.96 * stdErr;
                        series.push({ t: i, mean, ci_lower: mean - ci, ci_upper: mean + ci });
                    }
                }

                result[key] = series;
            }
        }

        return result;
    }

    /**
     * Count tag frequency across all trials, sorted descending
     */
    _computeTagFrequency(trials) {
        const tagMap = {};

        for (const trial of trials) {
            if (!trial.selectedTags) continue;
            for (const tag of trial.selectedTags) {
                const id = tag.id;
                if (!tagMap[id]) {
                    tagMap[id] = { id, label: tag.label, count: 0, isCustom: tag.isCustom || false };
                }
                tagMap[id].count++;
            }
        }

        return Object.values(tagMap).sort((a, b) => b.count - a.count);
    }
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnalysisDataProcessor;
}
