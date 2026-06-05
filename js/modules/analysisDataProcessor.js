/**
 * AnalysisDataProcessor Module
 * Aggregates session data for the Analyze dashboard.
 * Pure logic — no DOM access.
 */
class AnalysisDataProcessor {
    constructor(options = {}) {
        this.sessions = options.sessions || [];
        this.patternMetadata = options.patternMetadata || {};
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
        this.sessions = sessions || [];
    }

    setPatternMetadata(catalog) {
        this.patternMetadata = catalog || {};
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

        return {
            sessionCount: sessions.length,
            trialCount: included.length,
            excludedTrialCount: trials.length - included.length,
            participantCount: participants.size
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
                    surveyedCount: 0
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
            }
        }

        const catalogNames = new Set(Object.keys(this.patternMetadata));
        Object.keys(statsByName).forEach(name => catalogNames.add(name));

        const items = Array.from(catalogNames).map(name => {
            const metadata = this.patternMetadata[name] || null;
            const stats = statsByName[name] || {
                name,
                path: metadata?.path || (name ? `audio_files/${name}` : ''),
                trialCount: 0,
                sessionIds: new Set(),
                participantIds: new Set(),
                latestEndTime: null,
                surveyedCount: 0
            };

            return {
                name,
                path: stats.path || metadata?.path || `audio_files/${name}`,
                trialCount: stats.trialCount,
                sessionCount: stats.sessionIds.size,
                uniqueParticipants: stats.participantIds.size,
                surveyedCount: stats.surveyedCount,
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
            hasSurvey: this._trialHasSurvey(trial),
            actions,
            urgency: trial.surveyResponse?.urgency,
            intensity: trial.surveyResponse?.intensity,
            confidence: trial.surveyResponse?.confidence,
            mood: trial.surveyResponse?.emotion?.mood || null,
            textureSummary: this._formatTextureSummary(trial.surveyResponse?.texture)
        };
    }

    _formatTextureSummary(texture = {}) {
        if (!texture) return '';
        const parts = [];
        if (texture.temperature) parts.push(texture.temperature);
        if (texture.hardness) parts.push(texture.hardness);
        if (texture.surface) parts.push(texture.surface);
        return parts.join(' / ');
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

        const direction = (typeof ANALYZE_DIRECTION_AXES !== 'undefined' ? ANALYZE_DIRECTION_AXES : []).map(axis => {
            const counts = {};
            axis.options.forEach(option => { counts[option] = 0; });
            let answered = 0;
            surveyed.forEach(trial => {
                const value = trial.surveyResponse?.direction?.[axis.id];
                if (!value) return;
                answered += 1;
                if (counts[value] != null) counts[value] += 1;
            });
            const options = axis.options.map(label => ({
                label,
                count: counts[label] || 0,
                pct: answered ? Math.round(((counts[label] || 0) / answered) * 100) : 0
            }));
            return { ...axis, answered, options };
        });

        const directionVisible = direction.some(axis =>
            surveyedCount > 0 && axis.answered / surveyedCount >= 0.2
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

        const textureCounts = {
            temperature: { Hot: 0, Cold: 0 },
            hardness: { Hard: 0, Soft: 0 },
            surface: { Smooth: 0, Rough: 0 }
        };
        surveyed.forEach(trial => {
            const values = trial.surveyResponse?.texture || {};
            if (values.temperature && textureCounts.temperature[values.temperature] != null) {
                textureCounts.temperature[values.temperature] += 1;
            }
            if (values.hardness && textureCounts.hardness[values.hardness] != null) {
                textureCounts.hardness[values.hardness] += 1;
            }
            if (values.surface && textureCounts.surface[values.surface] != null) {
                textureCounts.surface[values.surface] += 1;
            }
        });

        const textureRows = (typeof ANALYZE_TEXTURE_FACETS !== 'undefined' ? ANALYZE_TEXTURE_FACETS : []).map(facet => {
            const bucket = textureCounts[facet.id] || {};
            let answered = 0;
            facet.options.forEach(option => { answered += bucket[option] || 0; });
            const options = facet.options.map(label => ({
                label,
                count: bucket[label] || 0,
                pct: answered ? Math.round(((bucket[label] || 0) / answered) * 100) : 0
            }));
            return { ...facet, answered, options };
        });

        return {
            surveyedCount,
            scales,
            direction,
            directionVisible,
            emotion,
            texture: textureCounts,
            textureRows
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
        const tags = [];
        const direction = surveyResponse.direction || {};
        const action = surveyResponse.action || {};
        const emotion = surveyResponse.emotion || {};
        const texture = surveyResponse.texture || {};
        const pushTag = (id, label, isCustom = false) => tags.push({ id, label, isCustom });

        if (direction.leftRight) pushTag(`direction:leftRight:${this._slugify(direction.leftRight)}`, `Direction: ${direction.leftRight}`);
        if (direction.upDown) pushTag(`direction:upDown:${this._slugify(direction.upDown)}`, `Direction: ${direction.upDown}`);
        if (direction.forwardBackward) pushTag(`direction:forwardBackward:${this._slugify(direction.forwardBackward)}`, `Direction: ${direction.forwardBackward}`);

        (action.predefined || []).forEach(value => pushTag(`action:${this._slugify(value)}`, `Action: ${value}`));
        this._getCustomActionValues(action).forEach(customValue => {
            pushTag(`action:custom:${this._slugify(customValue)}`, `Action: ${customValue}`, true);
        });

        Object.entries(emotion).forEach(([facet, value]) => {
            if (!value) return;
            pushTag(`emotion:${facet}:${this._slugify(value)}`, `${this._titleCase(facet)}: ${value}`);
        });
        if (texture.temperature) pushTag(`texture:temperature:${this._slugify(texture.temperature)}`, `Temperature: ${texture.temperature}`);
        if (texture.hardness) pushTag(`texture:hardness:${this._slugify(texture.hardness)}`, `Hardness: ${texture.hardness}`);
        if (texture.surface) pushTag(`texture:surface:${this._slugify(texture.surface)}`, `Surface: ${texture.surface}`);
        return tags;
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
