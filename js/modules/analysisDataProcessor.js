/**
 * AnalysisDataProcessor Module
 * Aggregates session data for the Analyze dashboard.
 * Pure logic — no DOM access.
 */
class AnalysisDataProcessor {
    constructor(options = {}) {
        this.sessions = options.sessions || [];
        this.patternMetadata = options.patternMetadata || {};
        // The full pattern library under study ([{name, path}]) — defines the
        // universe of patterns even when some have never been tested.
        this.patternCatalog = options.patternCatalog || [];
        this.bands = ['delta', 'theta', 'alpha', 'beta', 'gamma'];
        this.filters = this._defaultFilters();
    }

    _defaultFilters() {
        return {
            participantIds: null,
            dateFrom: '',
            dateTo: '',
            completedOnly: true,
            hideExcluded: true
        };
    }

    loadSessions(sessions) {
        this.sessions = (sessions || []).map(session => ({
            ...session,
            trials: (session.trials || []).map(trial => ({
                ...trial,
                surveyResponse: trial.surveyResponse
                    ? this._normalizeSurveyResponse(trial.surveyResponse)
                    : trial.surveyResponse
            }))
        }));
    }

    setPatternMetadata(catalog) {
        this.patternMetadata = catalog || {};
    }

    setPatternCatalog(files) {
        this.patternCatalog = (files || []).map(file => ({
            name: file.name,
            path: file.path || `audio_files/${file.name}`
        }));
    }

    setFilters(filters = {}) {
        this.filters = { ...this._defaultFilters(), ...filters };
    }

    getFilters() {
        return { ...this.filters };
    }

    getCorpusSummary() {
        const sessions = this._getFilteredSessions();
        const trials = this._getFlatTrials({ includeExcluded: !this.filters.hideExcluded });
        const included = this._getFlatTrials();
        const participants = new Set(sessions.map(s => s.participant_id).filter(Boolean));

        let allTrialCount = 0;
        for (const session of this.sessions || []) {
            allTrialCount += (session.trials || []).length;
        }

        return {
            sessionCount: sessions.length,
            trialCount: included.length,
            excludedTrialCount: trials.length - included.length,
            participantCount: participants.size,
            allTrialCount
        };
    }

    getFilterOptions() {
        const participants = new Map();
        const datesWithData = new Set();

        for (const session of this.sessions) {
            if (session.participant_id != null && session.participant_code) {
                participants.set(session.participant_id, session.participant_code);
            }
            const sessionDate = String(session.startedAt || '').slice(0, 10);
            if (sessionDate) datesWithData.add(sessionDate);
        }

        const sortedDates = Array.from(datesWithData).sort();

        return {
            participants: Array.from(participants.entries()).map(([id, code]) => ({ id, code })),
            dateBounds: {
                min: sortedDates[0] || null,
                max: sortedDates[sortedDates.length - 1] || null
            },
            datesWithData: sortedDates
        };
    }

    getPatternSidebarItems() {
        const statsByName = {};
        for (const trial of this._getFlatTrials()) {
            const name = trial.pattern?.name;
            if (!name) continue;
            if (!statsByName[name]) {
                statsByName[name] = {
                    name,
                    path: trial.pattern.path || '',
                    trialCount: 0,
                    sessionIds: new Set(),
                    participantIds: new Set(),
                    latestEndTime: null,
                    surveyedCount: 0,
                    urgencyValues: [],
                    intensityValues: [],
                    reportedValues: []
                };
            }
            const stats = statsByName[name];
            stats.trialCount += 1;
            stats.sessionIds.add(trial.sessionId);
            stats.participantIds.add(trial.participantId);
            const endTime = trial.endTime || trial.startTime;
            if (endTime && (!stats.latestEndTime || endTime > stats.latestEndTime)) {
                stats.latestEndTime = endTime;
            }
            if (this._trialHasSurvey(trial)) {
                stats.surveyedCount += 1;
                stats.urgencyValues.push(trial.surveyResponse?.urgency);
                stats.intensityValues.push(trial.surveyResponse?.intensity);
                stats.reportedValues.push(trial.surveyResponse?.confidence);
            }
        }

        // The pattern library defines the sidebar universe — not the audio
        // metadata catalog, which spans far more files than this study uses.
        const catalogPaths = new Map(this.patternCatalog.map(entry => [entry.name, entry.path]));
        const catalogNames = new Set(catalogPaths.keys());
        Object.keys(statsByName).forEach(name => catalogNames.add(name));

        const items = Array.from(catalogNames).map(name => {
            const metadata = this.patternMetadata[name] || null;
            const stats = statsByName[name] || {
                name,
                path: catalogPaths.get(name) || metadata?.path || (name ? `audio_files/${name}` : ''),
                trialCount: 0,
                sessionIds: new Set(),
                participantIds: new Set(),
                latestEndTime: null,
                surveyedCount: 0,
                urgencyValues: [],
                intensityValues: [],
                reportedValues: []
            };

            const confidence = this._computePlacementConfidence(
                stats.surveyedCount,
                this._computeSpreadStats(stats.urgencyValues),
                this._computeSpreadStats(stats.intensityValues),
                stats.reportedValues
            );

            return {
                name,
                path: stats.path || metadata?.path || `audio_files/${name}`,
                trialCount: stats.trialCount,
                sessionCount: stats.sessionIds.size,
                uniqueParticipants: stats.participantIds.size,
                surveyedCount: stats.surveyedCount,
                confidence: confidence.value,
                hasNewData: typeof analyzePatternHasNewData === 'function'
                    ? analyzePatternHasNewData(name, stats.latestEndTime)
                    : false,
                metadata
            };
        });

        return this._sortPatternItems(items);
    }

    getUniquePatterns() {
        return this.getPatternSidebarItems().filter(item => item.trialCount > 0);
    }

    getPatternAnalysis(patternName) {
        const allTrials = this._getFlatTrials({ patternName });
        if (allTrials.length === 0) {
            return null;
        }

        const eegTrials = allTrials.filter(trial => this._trialHasEeg(trial));
        const surveyedTrials = allTrials.filter(trial => this._trialHasSurvey(trial));
        const deltas = eegTrials.map(t => this._computeDelta(t));
        const actionFrequency = this._computeActionFrequency(surveyedTrials);
        const tagFrequency = this._computeTagFrequency(allTrials);
        const metadata = this.patternMetadata[patternName] || null;
        const subjective = this._computeSubjectiveProfile(allTrials);

        return {
            patternName,
            metadata,
            summary: this._computeSummary(allTrials, deltas, actionFrequency, subjective, eegTrials.length),
            radar: eegTrials.length ? this._computeRadar(eegTrials) : null,
            boxPlots: eegTrials.length ? this._computeBoxPlots(deltas) : null,
            timeSeries: eegTrials.length ? this._computeTimeSeries(eegTrials) : null,
            actionFrequency,
            tagFrequency,
            subjective,
            eegTrialCount: eegTrials.length,
            trials: this.getTrials({ patternName })
        };
    }

    /**
     * Corpus-wide per-pattern aggregates for the NAD landscape view.
     * Aggregates respect the active global filters; trialPoints additionally
     * include excluded trials (flagged) so the bloom can render them hollow.
     */
    getCorpusLandscape() {
        const trialsByPattern = new Map();
        for (const trial of this._getFlatTrials({ includeExcluded: true })) {
            const name = trial.pattern?.name;
            if (!name) continue;
            if (!trialsByPattern.has(name)) trialsByPattern.set(name, []);
            trialsByPattern.get(name).push(trial);
        }

        const patterns = [];
        trialsByPattern.forEach((allTrials, name) => {
            // Trials counted toward aggregates follow the hideExcluded filter.
            const trials = this.filters.hideExcluded
                ? allTrials.filter(t => !t.excludeFromAnalysis)
                : allTrials;
            if (!trials.length) return;

            const surveyed = this._getSurveyedTrials(trials);
            const participantIds = new Set(trials.map(t => t.participantId));

            const urgency = this._computeSpreadStats(surveyed.map(t => t.surveyResponse?.urgency));
            const intensity = this._computeSpreadStats(surveyed.map(t => t.surveyResponse?.intensity));
            const vibeLeanings = this._computePairLeanings(
                surveyed, 'vibes',
                typeof ANALYZE_NAD_VIBE_PAIR_IDS !== 'undefined' ? ANALYZE_NAD_VIBE_PAIR_IDS : [],
                typeof ANALYZE_VIBE_PAIRS !== 'undefined' ? ANALYZE_VIBE_PAIRS : []
            );
            const binaryLeanings = this._computePairLeanings(
                surveyed, 'binaryActions',
                typeof ANALYZE_NAD_BINARY_PAIR_IDS !== 'undefined' ? ANALYZE_NAD_BINARY_PAIR_IDS : [],
                typeof ANALYZE_BINARY_PAIRS !== 'undefined' ? ANALYZE_BINARY_PAIRS : []
            );

            const trialPoints = this._getSurveyedTrials(allTrials).map(trial => ({
                dbTrialId: trial.dbTrialId,
                trialOrder: trial.trialOrder,
                urgency: trial.surveyResponse?.urgency,
                intensity: trial.surveyResponse?.intensity,
                excluded: Boolean(trial.excludeFromAnalysis),
                dbSessionId: trial.dbSessionId,
                participantCode: trial.participantCode,
                startTime: trial.startTime
            }));

            let latestEndTime = null;
            for (const trial of trials) {
                const endTime = trial.endTime || trial.startTime;
                if (endTime && (!latestEndTime || endTime > latestEndTime)) {
                    latestEndTime = endTime;
                }
            }

            patterns.push({
                eeg: this._computeEegEffect(trials),
                name,
                path: allTrials[0].pattern?.path || '',
                metadata: this.patternMetadata[name] || null,
                trialCount: trials.length,
                surveyedCount: surveyed.length,
                participantCount: participantIds.size,
                latestEndTime,
                hasNewData: typeof analyzePatternHasNewData === 'function'
                    ? analyzePatternHasNewData(name, latestEndTime)
                    : false,
                urgency,
                intensity,
                trialPoints,
                topActions: this._computeActionFrequency(surveyed).slice(0, 3),
                vibeLeanings,
                binaryLeanings,
                confidence: this._computePlacementConfidence(
                    surveyed.length, urgency, intensity,
                    surveyed.map(t => t.surveyResponse?.confidence)
                ),
                suggestion: this._computeNadSuggestion({
                    urgency, intensity, vibeLeanings, binaryLeanings,
                    surveyedCount: surveyed.length
                })
            });
        });

        // Patterns in the library that have never produced a usable trial
        // still belong on the landscape (as never-tested entries).
        const seen = new Set(patterns.map(p => p.name));
        for (const entry of this.patternCatalog) {
            if (seen.has(entry.name)) continue;
            seen.add(entry.name);
            patterns.push({
                name: entry.name,
                path: entry.path,
                metadata: this.patternMetadata[entry.name] || null,
                eeg: { trialCount: 0, topBand: null, topDelta: null, maxAbsDelta: null },
                trialCount: 0,
                surveyedCount: 0,
                participantCount: 0,
                latestEndTime: null,
                hasNewData: false,
                urgency: this._computeSpreadStats([]),
                intensity: this._computeSpreadStats([]),
                trialPoints: [],
                topActions: [],
                vibeLeanings: [],
                binaryLeanings: [],
                confidence: this._computePlacementConfidence(0, { median: null }, { median: null }),
                suggestion: this._computeNadSuggestion({
                    urgency: { median: null }, intensity: { median: null },
                    vibeLeanings: [], binaryLeanings: [], surveyedCount: 0
                })
            });
        }

        patterns.sort((a, b) => b.surveyedCount - a.surveyedCount || a.name.localeCompare(b.name));

        return {
            patterns,
            mappablePatternCount: patterns.filter(p => p.surveyedCount > 0).length,
            testedPatternCount: patterns.filter(p => p.trialCount > 0).length,
            totalPatternCount: patterns.length
        };
    }

    /**
     * Per-pattern electrophysiological effect summary: the band whose mean
     * baseline->stimulation delta is largest in magnitude. A pattern whose
     * maxAbsDelta stays near zero is producing no measurable brain response.
     */
    _computeEegEffect(trials) {
        const eegTrials = (trials || []).filter(t => this._trialHasEeg(t));
        if (!eegTrials.length) {
            return { trialCount: 0, topBand: null, topDelta: null, maxAbsDelta: null };
        }

        const deltas = eegTrials.map(t => this._computeDelta(t));
        let topBand = null;
        let topDelta = 0;
        for (const band of this.bands) {
            const avg = deltas.reduce((sum, d) => sum + (d[band] || 0), 0) / deltas.length;
            if (topBand === null || Math.abs(avg) > Math.abs(topDelta)) {
                topBand = band;
                topDelta = avg;
            }
        }

        return {
            trialCount: eegTrials.length,
            topBand,
            topDelta,
            maxAbsDelta: Math.abs(topDelta)
        };
    }

    /**
     * Confidence in a pattern's map placement (0-1).
     * evidence:    surveyed-trial count saturating at 5.
     * consistency: 1 - avg urgency/intensity IQR normalized against 0.5
     *              (an IQR of 0.5 on the 0-1 scale means opinions are split).
     * reported:    mean of participants' self-reported confidence (0-1).
     *
     * value blends the statistical score (evidence × consistency) with the
     * reported score; reported is itself discounted by evidence so one very
     * sure participant can't inflate a single-trial pattern.
     */
    _computePlacementConfidence(surveyedCount, urgency, intensity, reportedValues = []) {
        if (!surveyedCount || urgency.median == null || intensity.median == null) {
            return { value: 0, evidence: 0, consistency: 0, avgIqr: null, reported: null };
        }

        const evidence = Math.min(1, surveyedCount / 5);

        const iqrs = [];
        if (urgency.q1 != null && urgency.q3 != null) iqrs.push(urgency.q3 - urgency.q1);
        if (intensity.q1 != null && intensity.q3 != null) iqrs.push(intensity.q3 - intensity.q1);
        const avgIqr = iqrs.length ? iqrs.reduce((sum, v) => sum + v, 0) / iqrs.length : null;
        const consistency = avgIqr == null
            ? 1
            : Math.max(0, Math.min(1, 1 - avgIqr / 0.5));

        const reportedNums = (reportedValues || [])
            .filter(v => v != null && Number.isFinite(Number(v)))
            .map(Number);
        const reported = reportedNums.length
            ? reportedNums.reduce((sum, v) => sum + v, 0) / reportedNums.length
            : null;

        const statistical = evidence * consistency;
        const value = reported == null
            ? statistical
            : statistical * 0.7 + (reported * evidence) * 0.3;

        return { value, evidence, consistency, avgIqr, reported };
    }

    /**
     * Research health lists for the landscape home: which patterns need
     * more trials, which placements are unstable, which data is oldest.
     * Operates on an already-computed getCorpusLandscape() result.
     */
    getResearchHealth(landscape, options = {}) {
        const {
            minSurveyed = 3,
            consistencyThreshold = 0.5,
            staleLimit = 5,
            minEegTrials = 2,
            flatEegThreshold = 0.03,
            digInConfidence = 0.45,
            surveySignalThreshold = 0.2
        } = options;
        const patterns = landscape?.patterns || [];

        // Patterns that demonstrably do something AND have data we can trust:
        // a measurable EEG shift or a distinct placement away from the map's
        // indifferent center, backed by enough consistent trials. These are
        // the candidates worth digging into (and elevating).
        const digIn = patterns
            .map(p => {
                const measuredEeg = p.eeg
                    && p.eeg.trialCount >= minEegTrials
                    && p.eeg.maxAbsDelta != null;
                const eegEffect = measuredEeg && p.eeg.maxAbsDelta >= flatEegThreshold;
                // Measured-and-flat disqualifies: that pattern belongs in the
                // retire list, not the elevate list, however distinct its
                // survey placement reads.
                const eegFlat = measuredEeg && !eegEffect;
                const surveySignal = (p.urgency?.median != null && p.intensity?.median != null)
                    ? Math.hypot(p.urgency.median - 0.5, p.intensity.median - 0.5)
                    : null;
                return { p, eegEffect, eegFlat, surveySignal };
            })
            .filter(({ p, eegEffect, eegFlat, surveySignal }) =>
                p.surveyedCount >= minSurveyed
                && (p.confidence?.value ?? 0) >= digInConfidence
                && !eegFlat
                && (eegEffect || (surveySignal != null && surveySignal >= surveySignalThreshold)))
            .sort((a, b) => (b.p.confidence?.value ?? 0) - (a.p.confidence?.value ?? 0))
            .map(({ p, eegEffect, surveySignal }) => ({
                name: p.name,
                score: p.confidence.value,
                reported: p.confidence.reported,
                consistency: p.confidence.consistency,
                surveyedCount: p.surveyedCount,
                eegEffect,
                eegTrialCount: p.eeg?.trialCount ?? 0,
                topBand: p.eeg?.topBand ?? null,
                topDelta: p.eeg?.topDelta ?? null,
                surveyDistinct: surveySignal != null && surveySignal >= surveySignalThreshold
            }));

        const underTested = patterns
            .filter(p => p.surveyedCount < minSurveyed)
            .sort((a, b) => a.surveyedCount - b.surveyedCount || a.name.localeCompare(b.name))
            .map(p => ({
                name: p.name,
                trialCount: p.trialCount,
                surveyedCount: p.surveyedCount,
                needed: minSurveyed - p.surveyedCount
            }));

        const unstable = patterns
            .filter(p => p.surveyedCount >= minSurveyed
                && p.confidence
                && p.confidence.consistency < consistencyThreshold)
            .sort((a, b) => a.confidence.consistency - b.confidence.consistency)
            .map(p => ({
                name: p.name,
                surveyedCount: p.surveyedCount,
                consistency: p.confidence.consistency,
                avgIqr: p.confidence.avgIqr
            }));

        // Enough EEG trials, yet no band moves meaningfully off baseline.
        const flatEeg = patterns
            .filter(p => p.eeg
                && p.eeg.trialCount >= minEegTrials
                && p.eeg.maxAbsDelta != null
                && p.eeg.maxAbsDelta < flatEegThreshold)
            .sort((a, b) => a.eeg.maxAbsDelta - b.eeg.maxAbsDelta)
            .map(p => ({
                name: p.name,
                eegTrialCount: p.eeg.trialCount,
                maxAbsDelta: p.eeg.maxAbsDelta,
                topBand: p.eeg.topBand
            }));

        const stale = patterns
            .filter(p => p.latestEndTime)
            .sort((a, b) => String(a.latestEndTime).localeCompare(String(b.latestEndTime)))
            .slice(0, staleLimit)
            .map(p => ({
                name: p.name,
                surveyedCount: p.surveyedCount,
                latestEndTime: p.latestEndTime
            }));

        return { digIn, underTested, unstable, flatEeg, stale };
    }

    _percentile(sortedValues, fraction) {
        if (!sortedValues.length) return null;
        if (sortedValues.length === 1) return sortedValues[0];
        const position = fraction * (sortedValues.length - 1);
        const lower = Math.floor(position);
        const upper = Math.min(lower + 1, sortedValues.length - 1);
        const weight = position - lower;
        return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
    }

    _computeSpreadStats(values) {
        const numeric = (values || [])
            .filter(value => value != null && Number.isFinite(Number(value)))
            .map(Number)
            .sort((a, b) => a - b);
        if (!numeric.length) {
            return { n: 0, median: null, q1: null, q3: null, min: null, max: null };
        }
        return {
            n: numeric.length,
            median: this._percentile(numeric, 0.5),
            q1: this._percentile(numeric, 0.25),
            q3: this._percentile(numeric, 0.75),
            min: numeric[0],
            max: numeric[numeric.length - 1]
        };
    }

    _computePairLeanings(surveyedTrials, field, pairIds, pairCatalog) {
        return (pairIds || []).map(pairId => {
            const pairDef = (pairCatalog || []).find(pair => pair.id === pairId);
            if (!pairDef) return null;

            const counts = {};
            pairDef.options.forEach(option => { counts[option] = 0; });
            let answered = 0;
            surveyedTrials.forEach(trial => {
                const value = trial.surveyResponse?.[field]?.[pairId];
                if (!value || counts[value] == null) return;
                answered += 1;
                counts[value] += 1;
            });

            const options = pairDef.options.map(label => ({
                label,
                count: counts[label] || 0,
                pct: answered ? Math.round(((counts[label] || 0) / answered) * 100) : 0
            }));
            const lean = answered
                ? options.reduce((best, option) => (option.count > best.count ? option : best))
                : null;

            return {
                id: pairId,
                label: pairDef.label,
                options,
                answered,
                lean: lean && lean.count > 0 ? { label: lean.label, pct: lean.pct } : null
            };
        }).filter(Boolean);
    }

    /**
     * Transparent rule-based Neutral/Attentive/Disruptive affinity scores.
     * Each bucket gets a 0-1 score from weighted components; every component
     * is reported as evidence so the analyst can see why a bucket is suggested.
     */
    _computeNadSuggestion({ urgency, intensity, vibeLeanings, binaryLeanings, surveyedCount }) {
        const empty = {
            hasData: false,
            scores: { neutral: null, attentive: null, disruptive: null },
            suggested: [],
            ambiguous: false,
            evidence: { neutral: [], attentive: [], disruptive: [] }
        };
        if (!surveyedCount || urgency.median == null || intensity.median == null) {
            return empty;
        }

        const u = urgency.median;
        const i = intensity.median;
        const peak = (x, center, halfwidth) => Math.max(0, 1 - Math.abs(x - center) / halfwidth);
        const leanShare = (leanings, pairId, optionLabel) => {
            const row = (leanings || []).find(l => l.id === pairId);
            if (!row || !row.answered) return null;
            const option = row.options.find(o => o.label === optionLabel);
            return option ? { share: option.pct / 100, pct: option.pct, n: row.answered } : null;
        };

        const relax = leanShare(binaryLeanings, 'relax_focus', 'Relax');
        const focus = leanShare(binaryLeanings, 'relax_focus', 'Focus');
        const safe = leanShare(vibeLeanings, 'safe_danger', 'Safe');
        const danger = leanShare(vibeLeanings, 'safe_danger', 'Danger');
        const unknown = leanShare(vibeLeanings, 'expected_unknown', 'Unknown');
        const welcoming = leanShare(vibeLeanings, 'welcoming_unwelcoming', 'Welcoming');

        const score = (components) => {
            let weightedSum = 0;
            let totalWeight = 0;
            const evidence = [];
            components.forEach(({ value, weight, label }) => {
                if (value == null) return;
                weightedSum += value * weight;
                totalWeight += weight;
                evidence.push(label);
            });
            return {
                value: totalWeight > 0 ? weightedSum / totalWeight : null,
                evidence
            };
        };

        const fmt = (value) => value.toFixed(2);
        const leanLabel = (name, entry) => entry
            ? { value: entry.share, label: `${name} ${entry.pct}% of ${entry.n} answered` }
            : { value: null, label: '' };

        const neutral = score([
            { value: 1 - u, weight: 2, label: `Median urgency ${fmt(u)} (lower supports Neutral)` },
            { value: 1 - i, weight: 2, label: `Median intensity ${fmt(i)} (lower supports Neutral)` },
            { ...leanLabel('Relax', relax), weight: 1 },
            { ...leanLabel('Safe', safe), weight: 1 },
            { ...leanLabel('Welcoming', welcoming), weight: 1 }
        ]);

        const attentive = score([
            { value: peak(u, 0.6, 0.4), weight: 2, label: `Median urgency ${fmt(u)} (mid-high supports Attentive)` },
            { value: peak(i, 0.5, 0.5), weight: 2, label: `Median intensity ${fmt(i)} (moderate supports Attentive)` },
            { ...leanLabel('Focus', focus), weight: 1.5 }
        ]);

        const disruptive = score([
            { value: u, weight: 2, label: `Median urgency ${fmt(u)} (higher supports Disruptive)` },
            { value: i, weight: 2, label: `Median intensity ${fmt(i)} (higher supports Disruptive)` },
            { ...leanLabel('Danger', danger), weight: 1 },
            { ...leanLabel('Unknown', unknown), weight: 1 }
        ]);

        const scores = {
            neutral: neutral.value,
            attentive: attentive.value,
            disruptive: disruptive.value
        };
        const threshold = typeof ANALYZE_NAD_SUGGESTION_THRESHOLD !== 'undefined'
            ? ANALYZE_NAD_SUGGESTION_THRESHOLD
            : 0.55;
        const suggested = Object.entries(scores)
            .filter(([, value]) => value != null && value >= threshold)
            .sort((a, b) => b[1] - a[1])
            .map(([bucket]) => bucket);

        return {
            hasData: true,
            scores,
            suggested,
            ambiguous: suggested.length === 0,
            evidence: {
                neutral: neutral.evidence,
                attentive: attentive.evidence,
                disruptive: disruptive.evidence
            }
        };
    }

    getTrials(options = {}) {
        const {
            patternName = null,
            participantId = null,
            sessionId = null,
            includeExcluded = false
        } = options;

        let trials = this._getFlatTrials({
            includeIncomplete: !this.filters.completedOnly,
            includeExcluded
        });

        if (patternName) {
            trials = trials.filter(t => t.pattern?.name === patternName);
        }
        if (participantId != null && participantId !== '') {
            trials = trials.filter(t => String(t.participantId) === String(participantId));
        }
        if (sessionId) {
            trials = trials.filter(t => t.sessionId === sessionId || String(t.dbSessionId) === String(sessionId));
        }

        return trials
            .map(trial => this._toTrialListItem(trial))
            .sort((a, b) => String(b.startTime).localeCompare(String(a.startTime)));
    }

    getTrialDetail(dbTrialId) {
        const trial = this._getFlatTrials({ includeExcluded: true, includeIncomplete: true })
            .find(t => String(t.dbTrialId) === String(dbTrialId));
        if (!trial) return null;

        const baselineForComparison = this._resolveBaselineReadings(
            trial,
            this._getSessionReferenceBaseline(this._findSessionByTrial(trial))
        );
        const hasEeg = baselineForComparison.length > 0 && (trial.stimulationReadings?.length || 0) > 0;

        return {
            ...this._toTrialListItem(trial),
            participantNotes: trial.participantNotes,
            sessionNotes: trial.sessionNotes,
            equipmentInfo: trial.equipmentInfo,
            experimenter: trial.experimenter,
            locationName: trial.locationName,
            notesRaw: trial.notesRaw || '',
            testerNotes: trial.testerNotes || [],
            testerEvents: trial.testerEvents || [],
            surveyResponse: trial.surveyResponse,
            baselineReadings: trial.baselineReadings || [],
            stimulationReadings: trial.stimulationReadings || [],
            analysisBaselineReadings: baselineForComparison,
            hasEeg,
            bandDelta: hasEeg ? this._computeDelta({ ...trial, analysisBaselineReadings: baselineForComparison }) : null
        };
    }

    updateTrialExclusion(dbTrialId, excluded) {
        for (const session of this.sessions) {
            for (const trial of session.trials || []) {
                if (String(trial.dbTrialId) === String(dbTrialId)) {
                    trial.excludeFromAnalysis = Boolean(excluded);
                    return true;
                }
            }
        }
        return false;
    }

    updateTrialAnalystNotes(dbTrialId, notes) {
        for (const session of this.sessions) {
            for (const trial of session.trials || []) {
                if (String(trial.dbTrialId) === String(dbTrialId)) {
                    trial.analystNotes = notes || '';
                    return true;
                }
            }
        }
        return false;
    }

    _sortPatternItems(items) {
        return items.sort((a, b) => {
            if (a.trialCount === 0 && b.trialCount > 0) return 1;
            if (b.trialCount === 0 && a.trialCount > 0) return -1;
            if (b.trialCount !== a.trialCount) return b.trialCount - a.trialCount;
            return a.name.localeCompare(b.name);
        });
    }

    _findSessionByTrial(trial) {
        return this.sessions.find(session =>
            (session.trials || []).some(t => String(t.dbTrialId) === String(trial.dbTrialId))
        );
    }

    _toTrialListItem(trial) {
        const actions = this._getTrialActions(trial);
        return {
            dbTrialId: trial.dbTrialId,
            trialId: trial.trialId,
            patternName: trial.pattern?.name,
            patternPath: trial.pattern?.path,
            participantCode: trial.participantCode,
            participantId: trial.participantId,
            sessionId: trial.sessionId,
            dbSessionId: trial.dbSessionId,
            sessionDate: trial.sessionDate,
            trialOrder: trial.trialOrder,
            startTime: trial.startTime,
            endTime: trial.endTime,
            status: trial.status,
            excludeFromAnalysis: Boolean(trial.excludeFromAnalysis),
            analystNotes: trial.analystNotes || '',
            hasSurvey: this._trialHasSurvey(trial),
            actions,
            urgency: trial.surveyResponse?.urgency,
            intensity: trial.surveyResponse?.intensity,
            confidence: trial.surveyResponse?.confidence,
            mood: trial.surveyResponse?.emotion?.mood || null,
            vibesSummary: this._formatVibesSummary(trial.surveyResponse?.vibes)
        };
    }

    _formatVibesSummary(vibes = {}) {
        if (!vibes || typeof vibes !== 'object') return '';
        const parts = Object.values(vibes).filter(Boolean);
        return parts.join(' · ');
    }

    _trialHasEeg(trial) {
        const baseline = this._getBaselineReadingsForAnalysis(trial);
        return baseline.length > 0 && (trial.stimulationReadings?.length || 0) > 0;
    }

    _getSurveyedTrials(trials) {
        return (trials || []).filter(trial => this._trialHasSurvey(trial));
    }

    _median(values) {
        if (!values.length) return null;
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid];
    }

    _mode(values) {
        if (!values.length) return null;
        const counts = new Map();
        values.forEach(value => {
            counts.set(value, (counts.get(value) || 0) + 1);
        });
        let bestValue = null;
        let bestCount = 0;
        counts.forEach((count, value) => {
            if (count > bestCount) {
                bestCount = count;
                bestValue = value;
            }
        });
        return bestValue;
    }

    _computeScaleStats(values) {
        const numeric = (values || []).filter(value => value != null && Number.isFinite(Number(value)))
            .map(value => Number(value));
        if (!numeric.length) {
            return { values: [], median: null, min: null, max: null };
        }
        return {
            values: numeric,
            median: this._median(numeric),
            min: Math.min(...numeric),
            max: Math.max(...numeric)
        };
    }

    _computeSubjectiveProfile(trials) {
        const surveyed = this._getSurveyedTrials(trials);
        const surveyedCount = surveyed.length;

        const scales = {
            urgency: this._computeScaleStats(surveyed.map(t => t.surveyResponse?.urgency)),
            intensity: this._computeScaleStats(surveyed.map(t => t.surveyResponse?.intensity)),
            confidence: this._computeScaleStats(surveyed.map(t => t.surveyResponse?.confidence))
        };

        const binaryRows = (typeof ANALYZE_BINARY_PAIRS !== 'undefined' ? ANALYZE_BINARY_PAIRS : []).map(pair => {
            const counts = {};
            pair.options.forEach(option => { counts[option] = 0; });
            let answered = 0;
            surveyed.forEach(trial => {
                const value = trial.surveyResponse?.binaryActions?.[pair.id];
                if (!value) return;
                answered += 1;
                if (counts[value] != null) counts[value] += 1;
            });
            const options = pair.options.map(label => ({
                label,
                count: counts[label] || 0,
                pct: answered ? Math.round(((counts[label] || 0) / answered) * 100) : 0
            }));
            return { ...pair, answered, options };
        });

        const binaryVisible = binaryRows.some(row =>
            surveyedCount > 0 && row.answered / surveyedCount >= 0.2
        );

        const emotion = (typeof ANALYZE_EMOTION_FACETS !== 'undefined' ? ANALYZE_EMOTION_FACETS : []).map(facet => {
            const optionsList = ANALYZE_EMOTION_OPTIONS?.[facet.id] || [];
            const counts = {};
            optionsList.forEach(option => { counts[option] = 0; });
            let answered = 0;
            surveyed.forEach(trial => {
                const value = trial.surveyResponse?.emotion?.[facet.id];
                if (!value) return;
                answered += 1;
                if (counts[value] != null) counts[value] += 1;
            });
            const options = optionsList.map(label => ({
                label,
                count: counts[label] || 0,
                pct: answered ? Math.round(((counts[label] || 0) / answered) * 100) : 0
            }));
            return { ...facet, answered, options };
        });

        const vibeRows = (typeof ANALYZE_VIBE_PAIRS !== 'undefined' ? ANALYZE_VIBE_PAIRS : []).map(pair => {
            const counts = {};
            pair.options.forEach(option => { counts[option] = 0; });
            let answered = 0;
            surveyed.forEach(trial => {
                const value = trial.surveyResponse?.vibes?.[pair.id];
                if (!value) return;
                answered += 1;
                if (counts[value] != null) counts[value] += 1;
            });
            const options = pair.options.map(label => ({
                label,
                count: counts[label] || 0,
                pct: answered ? Math.round(((counts[label] || 0) / answered) * 100) : 0
            }));
            return { ...pair, answered, options };
        });

        return {
            surveyedCount,
            scales,
            binaryRows,
            binaryVisible,
            emotion,
            vibeRows
        };
    }

    _getFilteredSessions() {
        return (this.sessions || []).filter(session => this._sessionPassesFilters(session));
    }

    _sessionPassesFilters(session) {
        const filters = this.filters;
        if (filters.participantIds !== null && filters.participantIds !== undefined) {
            if (filters.participantIds.length === 0) return false;
            if (!filters.participantIds.includes(session.participant_id)) return false;
        }
        if (session.isAborted && filters.completedOnly) {
            return false;
        }
        if (filters.dateFrom || filters.dateTo) {
            const sessionDate = String(session.startedAt || '').slice(0, 10);
            if (filters.dateFrom && sessionDate < filters.dateFrom) return false;
            if (filters.dateTo && sessionDate > filters.dateTo) return false;
        }
        return true;
    }

    _getFlatTrials(options = {}) {
        const {
            patternName = null,
            includeExcluded = false,
            includeIncomplete = false,
            requireSurvey = false
        } = options;

        const trials = [];
        for (const session of this._getFilteredSessions()) {
            const sessionReferenceBaseline = this._getSessionReferenceBaseline(session);
            for (const trial of session.trials || []) {
                if (patternName && trial.pattern?.name !== patternName) continue;
                if (!includeIncomplete && this.filters.completedOnly && trial.status !== 'completed') continue;
                if (!includeExcluded && this.filters.hideExcluded && trial.excludeFromAnalysis) continue;
                if (requireSurvey && !this._trialHasSurvey(trial)) continue;

                trials.push({
                    ...trial,
                    participantId: session.participant_id,
                    participantCode: session.participant_code,
                    participantNotes: session.participant_notes,
                    sessionNotes: session.notes,
                    equipmentInfo: session.equipment_info,
                    experimenter: session.experimenter,
                    locationName: session.location_name,
                    sessionDate: session.startedAt,
                    sessionId: session.sessionId,
                    dbSessionId: session.dbSessionId,
                    analysisBaselineReadings: this._resolveBaselineReadings(trial, sessionReferenceBaseline),
                    calibrationReadings: session.calibrationReadings || []
                });
            }
        }
        return trials;
    }

    _getTrialsForPattern(patternName) {
        return this._getFlatTrials({ patternName }).filter(trial => {
            const baseline = trial.analysisBaselineReadings || [];
            return baseline.length > 0 && (trial.stimulationReadings?.length || 0) > 0;
        });
    }

    _trialHasSurvey(trial) {
        return Boolean(trial?.surveyResponse);
    }

    _getTrialActions(trial) {
        const action = trial?.surveyResponse?.action || {};
        const predefined = Array.isArray(action.predefined) ? [...action.predefined] : [];
        const custom = this._getCustomActionValues(action);
        return { predefined, custom, all: [...predefined, ...custom] };
    }

    _computeActionFrequency(trials) {
        const counts = {};
        ANALYZE_PREDEFINED_ACTIONS.forEach(action => {
            counts[action] = 0;
        });
        const customCounts = new Map();

        for (const trial of trials) {
            const actions = this._getTrialActions(trial);
            actions.predefined.forEach(action => {
                counts[action] = (counts[action] || 0) + 1;
            });
            actions.custom.forEach(action => {
                this._registerCustomAction(customCounts, action);
            });
        }

        const predefined = ANALYZE_PREDEFINED_ACTIONS
            .map(action => ({ action, count: counts[action] || 0, isCustom: false }))
            .filter(entry => entry.count > 0);

        const custom = Array.from(customCounts.values())
            .map(entry => ({ action: entry.label, count: entry.count, isCustom: true }))
            .sort((a, b) => b.count - a.count);

        return [...predefined, ...custom];
    }

    _getSessionReferenceBaseline(session) {
        if (!session?.trials?.length) return [];
        const orderedTrials = [...session.trials]
            .filter(trial => trial?.status === 'completed')
            .sort((a, b) => (a?.trialOrder || 0) - (b?.trialOrder || 0));
        const baselineTrial = orderedTrials.find(
            trial => Array.isArray(trial.baselineReadings) && trial.baselineReadings.length > 0
        );
        return baselineTrial?.baselineReadings || [];
    }

    _resolveBaselineReadings(trial, sessionReferenceBaseline = []) {
        if (Array.isArray(trial?.baselineReadings) && trial.baselineReadings.length > 0) {
            return trial.baselineReadings;
        }
        if (Array.isArray(sessionReferenceBaseline) && sessionReferenceBaseline.length > 0) {
            return sessionReferenceBaseline;
        }
        return [];
    }

    _getBaselineReadingsForAnalysis(trial) {
        if (Array.isArray(trial?.analysisBaselineReadings) && trial.analysisBaselineReadings.length > 0) {
            return trial.analysisBaselineReadings;
        }
        if (Array.isArray(trial?.baselineReadings)) {
            return trial.baselineReadings;
        }
        return [];
    }

    _meanBand(readings, bandKey) {
        if (!readings || readings.length === 0) return 0;
        let sum = 0;
        let count = 0;
        for (const reading of readings) {
            const val = reading[bandKey];
            if (val !== undefined && val !== null) {
                sum += val;
                count += 1;
            }
        }
        return count > 0 ? sum / count : 0;
    }

    _computeDelta(trial) {
        const delta = {};
        for (const band of this.bands) {
            const key = `${band}_rel`;
            const baselineAvg = this._meanBand(this._getBaselineReadingsForAnalysis(trial), key);
            const stimulationAvg = this._meanBand(trial.stimulationReadings, key);
            delta[band] = stimulationAvg - baselineAvg;
        }
        return delta;
    }

    _computeSummary(trials, deltas, actionFrequency, subjective = {}, eegTrialCount = 0) {
        const participantIds = new Set(trials.map(t => t.participantId));
        let mostChangedBand = { band: 'alpha', avgDelta: 0 };

        if (deltas.length > 0) {
            for (const band of this.bands) {
                const values = deltas.map(d => d[band]);
                const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
                if (Math.abs(avg) > Math.abs(mostChangedBand.avgDelta)) {
                    mostChangedBand = { band, avgDelta: avg };
                }
            }
        }

        const topAction = actionFrequency.length > 0
            ? { action: actionFrequency[0].action, count: actionFrequency[0].count }
            : null;

        const surveyedCount = subjective.surveyedCount || 0;
        const medianUrgency = subjective.scales?.urgency?.median ?? null;
        const moodValues = this._getSurveyedTrials(trials)
            .map(t => t.surveyResponse?.emotion?.mood)
            .filter(Boolean);
        const topMood = this._mode(moodValues);

        return {
            totalTrials: trials.length,
            uniqueParticipants: participantIds.size,
            surveyedCount,
            eegTrialCount,
            mostChangedBand,
            topAction,
            medianUrgency,
            topMood
        };
    }

    _computeRadar(trials) {
        const baselineAvg = {};
        const stimulationAvg = {};
        for (const band of this.bands) {
            const key = `${band}_rel`;
            const baselineValues = trials.map(t => this._meanBand(this._getBaselineReadingsForAnalysis(t), key));
            const stimValues = trials.map(t => this._meanBand(t.stimulationReadings, key));
            baselineAvg[key] = baselineValues.reduce((sum, value) => sum + value, 0) / baselineValues.length;
            stimulationAvg[key] = stimValues.reduce((sum, value) => sum + value, 0) / stimValues.length;
        }
        return { baselineAvg, stimulationAvg };
    }

    _computeBoxPlots(deltas) {
        const result = {};
        for (const band of this.bands) {
            result[band] = deltas.map(d => d[band]);
        }
        return result;
    }

    _computeTimeSeries(trials) {
        let baselineDuration = 0;
        for (const trial of trials) {
            const baselineReadings = this._getBaselineReadingsForAnalysis(trial);
            if (baselineReadings.length < 2) continue;
            const blStart = baselineReadings[0].timestamp_ms;
            const blEnd = baselineReadings[baselineReadings.length - 1].timestamp_ms;
            const dur = Math.ceil((blEnd - blStart) / 1000);
            if (dur > baselineDuration) baselineDuration = dur;
        }
        if (baselineDuration === 0) baselineDuration = 10;

        let stimulationDuration = 0;
        for (const trial of trials) {
            if (!trial.stimulationReadings || trial.stimulationReadings.length < 2) continue;
            const stimStart = trial.stimulationReadings[0].timestamp_ms;
            const stimEnd = trial.stimulationReadings[trial.stimulationReadings.length - 1].timestamp_ms;
            const dur = Math.ceil((stimEnd - stimStart) / 1000);
            if (dur > stimulationDuration) stimulationDuration = dur;
        }
        if (stimulationDuration === 0) stimulationDuration = 30;

        const result = {
            calibrationDuration: 0,
            baselineDuration,
            stimulationDuration
        };
        const totalStart = -baselineDuration;
        const suffixes = ['_rel', '_abs'];

        for (const band of this.bands) {
            for (const suffix of suffixes) {
                const key = `${band}${suffix}`;
                const bins = {};
                for (const trial of trials) {
                    const baselineReadings = this._getBaselineReadingsForAnalysis(trial);
                    if (baselineReadings.length > 0) {
                        const blEnd = baselineReadings[baselineReadings.length - 1].timestamp_ms;
                        for (const reading of baselineReadings) {
                            const relativeMs = reading.timestamp_ms - blEnd;
                            const binIndex = Math.floor(relativeMs / 1000);
                            if (binIndex < -baselineDuration) continue;
                            if (!bins[binIndex]) bins[binIndex] = [];
                            const val = reading[key];
                            if (val !== undefined && val !== null) bins[binIndex].push(val);
                        }
                    }
                    if (trial.stimulationReadings && trial.stimulationReadings.length > 0) {
                        const stimStart = trial.stimulationReadings[0].timestamp_ms;
                        for (const reading of trial.stimulationReadings) {
                            const relativeMs = reading.timestamp_ms - stimStart;
                            const binIndex = Math.floor(relativeMs / 1000);
                            if (binIndex < 0 || binIndex >= stimulationDuration) continue;
                            if (!bins[binIndex]) bins[binIndex] = [];
                            const val = reading[key];
                            if (val !== undefined && val !== null) bins[binIndex].push(val);
                        }
                    }
                }

                const series = [];
                for (let i = totalStart; i < stimulationDuration; i += 1) {
                    const values = bins[i] || [];
                    if (values.length === 0) {
                        series.push({ t: i, mean: null, ci_lower: null, ci_upper: null });
                        continue;
                    }
                    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
                    const n = values.length;
                    if (n < 2) {
                        series.push({ t: i, mean, ci_lower: mean, ci_upper: mean });
                    } else {
                        const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1);
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

    _computeTagFrequency(trials) {
        const tagMap = {};
        for (const trial of trials) {
            const tags = this._getTagsForTrial(trial);
            for (const tag of tags) {
                if (!tagMap[tag.id]) {
                    tagMap[tag.id] = { id: tag.id, label: tag.label, count: 0, isCustom: tag.isCustom || false };
                }
                tagMap[tag.id].count += 1;
            }
        }
        return Object.values(tagMap).sort((a, b) => b.count - a.count);
    }

    _getTagsForTrial(trial) {
        if (Array.isArray(trial?.selectedTags) && trial.selectedTags.length > 0) {
            return trial.selectedTags;
        }
        return this._getDerivedTagsFromSurveyResponse(trial?.surveyResponse);
    }

    _getDerivedTagsFromSurveyResponse(surveyResponse) {
        if (!surveyResponse) return [];
        const normalized = this._normalizeSurveyResponse(surveyResponse);
        const tags = [];
        const binaryActions = normalized.binaryActions || {};
        const action = normalized.action || {};
        const emotion = normalized.emotion || {};
        const vibes = normalized.vibes || {};
        const pushTag = (id, label, isCustom = false) => tags.push({ id, label, isCustom });

        Object.entries(binaryActions).forEach(([pairId, value]) => {
            if (!value) return;
            pushTag(`binary:${pairId}:${this._slugify(value)}`, `Binary: ${value}`);
        });

        (action.predefined || []).forEach(value => pushTag(`action:${this._slugify(value)}`, `Action: ${value}`));
        this._getCustomActionValues(action).forEach(customValue => {
            pushTag(`action:custom:${this._slugify(customValue)}`, `Action: ${customValue}`, true);
        });

        Object.entries(emotion).forEach(([facet, value]) => {
            if (!value) return;
            pushTag(`emotion:${facet}:${this._slugify(value)}`, `${this._titleCase(facet)}: ${value}`);
        });
        Object.entries(vibes).forEach(([pairId, value]) => {
            if (!value) return;
            pushTag(`vibe:${pairId}:${this._slugify(value)}`, `Vibe: ${value}`);
        });
        return tags;
    }

    _normalizeSurveyResponse(surveyResponse) {
        if (!surveyResponse || typeof surveyResponse !== 'object') return surveyResponse;

        const binaryActions = { ...(surveyResponse.binaryActions || {}) };
        const direction = surveyResponse.direction || {};
        const directionMap = {
            left_right: direction.leftRight,
            up_down: direction.upDown,
            forward_backward: direction.forwardBackward
        };
        Object.entries(directionMap).forEach(([pairId, value]) => {
            if (value && !binaryActions[pairId]) binaryActions[pairId] = value;
        });

        const vibes = { ...(surveyResponse.vibes || {}) };
        const texture = surveyResponse.texture || {};
        const textureMap = {
            hot_cold: texture.temperature,
            hard_soft: texture.hardness,
            smooth_rough: texture.surface
        };
        Object.entries(textureMap).forEach(([pairId, value]) => {
            if (value && !vibes[pairId]) vibes[pairId] = value;
        });

        return {
            ...surveyResponse,
            binaryActions,
            vibes
        };
    }

    _slugify(value) {
        return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown';
    }

    _titleCaseAction(value) {
        const collapsed = String(value || '').trim().replace(/\s+/g, ' ');
        if (!collapsed) {
            return '';
        }
        return collapsed
            .split(' ')
            .filter(Boolean)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    _getCustomActionValues(action) {
        const rawCustom = action?.custom;
        const values = Array.isArray(rawCustom) ? rawCustom : [rawCustom];
        const normalizedValues = [];
        const seenValues = new Set();
        values.forEach(value => {
            const normalized = this._titleCaseAction(value);
            const dedupeKey = normalized.toLowerCase();
            if (!normalized || seenValues.has(dedupeKey)) return;
            seenValues.add(dedupeKey);
            normalizedValues.push(normalized);
        });
        return normalizedValues;
    }

    _isPredefinedAction(value) {
        const key = String(value || '').trim().toLowerCase();
        return ANALYZE_PREDEFINED_ACTIONS.some(action => action.toLowerCase() === key);
    }

    _registerCustomAction(registry, value) {
        const normalized = this._titleCaseAction(value);
        const key = normalized.toLowerCase();
        if (!key || this._isPredefinedAction(normalized)) return;

        let entry = registry.get(key);
        if (!entry) {
            entry = { label: normalized, count: 0 };
            registry.set(key, entry);
        }

        entry.count += 1;
        entry.label = normalized;
    }

    _titleCase(value) {
        const text = String(value || '');
        return text.charAt(0).toUpperCase() + text.slice(1);
    }

    _formatDate(value) {
        if (!value) return 'Unknown date';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
        return date.toLocaleDateString();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnalysisDataProcessor;
}
