/**
 * TrialDetailView — persistent trial detail panel beside the trial list.
 * Exclusion toggle, prev/next stepping, and an editable analyst note.
 */
class TrialDetailView {
    constructor(options = {}) {
        this.containerId = options.containerId || 'trialDetailView';
        this.container = document.getElementById(this.containerId);
        this.onExcludeChange = options.onExcludeChange || null;
        this.onNavigate = options.onNavigate || null; // (dbTrialId) => void
        this.onSaveNote = options.onSaveNote || null; // (dbTrialId, text) => Promise
        this.currentTrialId = null;
        if (!this.container) return;
        this.render(null);
    }

    /** nav: { prevId, nextId, position } — all optional. */
    render(detail, nav = null) {
        this.container.className = 'trial-detail-view';
        if (!detail) {
            this.container.innerHTML = '<div class="trial-detail-view__empty">Select a trial from the list to inspect notes, survey, and EEG context.</div>';
            return;
        }

        this.currentTrialId = detail.dbTrialId;
        const survey = detail.surveyResponse;
        const actions = (detail.actions?.all || []).map(a => this._esc(a)).join(', ') || '—';
        const emotions = survey?.emotion
            ? Object.entries(survey.emotion)
                .map(([key, value]) => `${this._esc(key)}: ${this._esc(value)}`)
                .join(' · ')
            : '—';
        const binaryChoices = this._formatPairChoices(
            survey?.binaryActions,
            typeof ANALYZE_BINARY_PAIRS !== 'undefined' ? ANALYZE_BINARY_PAIRS : null
        );
        const vibes = this._formatPairChoices(
            survey?.vibes,
            typeof ANALYZE_VIBE_PAIRS !== 'undefined' ? ANALYZE_VIBE_PAIRS : null
        );

        const navHtml = nav ? `
            <div class="trial-detail-view__nav">
                <button type="button" class="trial-detail-view__nav-btn" data-nav-trial="${nav.prevId ?? ''}" ${nav.prevId ? '' : 'disabled'} title="Previous trial">‹</button>
                ${nav.position ? `<span class="trial-detail-view__nav-position font-mono">${nav.position}</span>` : ''}
                <button type="button" class="trial-detail-view__nav-btn" data-nav-trial="${nav.nextId ?? ''}" ${nav.nextId ? '' : 'disabled'} title="Next trial">›</button>
            </div>
        ` : '';

        this.container.innerHTML = `
            <div class="trial-detail-view__header">
                <div>
                    <div class="trial-detail-view__title-row">
                        <h2 class="trial-detail-view__title">${this._esc(detail.participantCode || 'Unknown')} · ${this._esc(detail.patternName || 'Pattern')}</h2>
                        ${detail.excludeFromAnalysis ? '<span class="trial-detail-view__excluded-badge">Excluded</span>' : ''}
                    </div>
                    <p class="trial-detail-view__subtitle">Session ${this._formatDate(detail.sessionDate)} · Trial ${detail.trialOrder}</p>
                </div>
                ${navHtml}
            </div>
            <label class="trial-detail-view__exclude">
                <input type="checkbox" id="trialExcludeToggle" ${detail.excludeFromAnalysis ? 'checked' : ''}>
                <span>Exclude from collective analysis</span>
            </label>
            <div class="trial-detail-view__grid">
                <section class="trial-detail-view__card">
                    <h3>Context</h3>
                    <dl>
                        <dt>Participant notes</dt><dd>${this._text(detail.participantNotes)}</dd>
                        <dt>Session notes</dt><dd>${this._text(detail.sessionNotes)}</dd>
                        <dt>Experimenter</dt><dd>${this._text(detail.experimenter)}</dd>
                        <dt>Location</dt><dd>${this._text(detail.locationName)}</dd>
                        <dt>Equipment</dt><dd>${this._text(detail.equipmentInfo)}</dd>
                        <dt>Status</dt><dd>${detail.status ? this._esc(detail.status) : '—'}</dd>
                    </dl>
                </section>
                <section class="trial-detail-view__card">
                    <h3>Survey</h3>
                    <dl>
                        <dt>Other actions</dt><dd>${actions}</dd>
                        <dt>Binary choices</dt><dd>${binaryChoices}</dd>
                        <dt>Vibes</dt><dd>${vibes}</dd>
                        <dt>Intensity</dt><dd>${survey ? (survey.intensity * 100).toFixed(0) + '%' : '—'}</dd>
                        <dt>Urgency</dt><dd>${survey ? (survey.urgency * 100).toFixed(0) + '%' : '—'}</dd>
                        <dt>Confidence</dt><dd>${survey ? (survey.confidence * 100).toFixed(0) + '%' : '—'}</dd>
                        <dt>Emotions</dt><dd>${emotions}</dd>
                    </dl>
                </section>
                <section class="trial-detail-view__card">
                    <h3>Notes</h3>
                    <dl>
                        <dt>Raw trial notes</dt><dd>${this._text(detail.notesRaw)}</dd>
                        <dt>Tester notes</dt><dd>${this._formatTesterNotes(detail.testerNotes)}</dd>
                    </dl>
                </section>
                <section class="trial-detail-view__card ${detail.hasEeg ? 'trial-detail-view__card--eeg' : ''}">
                    <h3>Brainwaves</h3>
                    <p>${detail.hasEeg ? this._formatBandDelta(detail.bandDelta) : 'No baseline/stimulation readings available for this trial.'}</p>
                    ${detail.hasEeg ? '<div class="trial-detail-view__eeg-chart" data-eeg-chart></div>' : ''}
                    <p class="trial-detail-view__hint">${detail.testerEvents?.length ? `${detail.testerEvents.length} tester event(s) recorded.` : 'No tester events.'}</p>
                </section>
                <section class="trial-detail-view__card trial-detail-view__card--analyst">
                    <h3>Analyst note</h3>
                    <textarea class="trial-detail-view__note-input" data-note-input rows="3"
                        placeholder="Your read on this trial — anomalies, context, exclusion rationale…">${this._escapeText(detail.analystNotes || '')}</textarea>
                    <div class="trial-detail-view__note-row">
                        <button type="button" class="trial-detail-view__note-save" data-note-save>Save note</button>
                        <span class="trial-detail-view__note-status" data-note-status aria-live="polite"></span>
                    </div>
                </section>
            </div>
        `;

        this._bindNoteEditor(detail);
        this._renderEegChart(detail);
        this.container.querySelectorAll('[data-nav-trial]').forEach(button => {
            button.addEventListener('click', () => {
                if (button.dataset.navTrial && this.onNavigate) {
                    this.onNavigate(button.dataset.navTrial);
                }
            });
        });
        this.container.querySelector('#trialExcludeToggle').addEventListener('change', (event) => {
            if (this.onExcludeChange) {
                this.onExcludeChange(detail.dbTrialId, event.target.checked);
            }
        });
    }

    /**
     * Per-trial brainwave time series: relative band power over the
     * stimulation window, with the trial's analysis baseline shown as a
     * dotted lead-in so shifts read against their reference.
     */
    _renderEegChart(detail) {
        const el = this.container.querySelector('[data-eeg-chart]');
        if (!el || typeof Plotly === 'undefined') return;

        const stim = detail.stimulationReadings || [];
        if (stim.length < 2) {
            el.remove();
            return;
        }

        const bands = ['delta', 'theta', 'alpha', 'beta', 'gamma'];
        const colors = typeof BAND_COLORS !== 'undefined' ? BAND_COLORS : {
            delta: '#4a7eb5', theta: '#5bb5a2', alpha: '#d4a843', beta: '#d97a3e', gamma: '#c75b7a'
        };

        const baseline = detail.analysisBaselineReadings || [];
        const t0 = stim[0].timestamp_ms;
        const toSeconds = (readings, offsetMs) => readings.map(r => (r.timestamp_ms - offsetMs) / 1000);

        const traces = [];
        for (const band of bands) {
            const key = `${band}_rel`;
            if (baseline.length >= 2) {
                const b0 = baseline[0].timestamp_ms;
                const baselineSpan = (baseline[baseline.length - 1].timestamp_ms - b0) / 1000;
                traces.push({
                    x: toSeconds(baseline, b0).map(s => s - baselineSpan - 1),
                    y: baseline.map(r => r[key]),
                    name: band,
                    mode: 'lines',
                    line: { color: colors[band] || '#888', width: 1, dash: 'dot' },
                    opacity: 0.6,
                    showlegend: false,
                    hovertemplate: `${band} (baseline) %{y:.3f}<extra></extra>`
                });
            }
            traces.push({
                x: toSeconds(stim, t0),
                y: stim.map(r => r[key]),
                name: band,
                mode: 'lines',
                line: { color: colors[band] || '#888', width: 1.5 },
                hovertemplate: `${band} %{y:.3f}<extra></extra>`
            });
        }

        const themed = typeof getPlotlyLayoutTheme === 'function' ? getPlotlyLayoutTheme() : {};
        const layout = {
            ...themed,
            height: 220,
            margin: { l: 40, r: 10, t: 10, b: 30 },
            showlegend: true,
            legend: { orientation: 'h', y: -0.22, font: { size: 9 } },
            xaxis: {
                ...(themed.xaxis || {}),
                title: { text: 'seconds (baseline ┄ → stimulation —)', font: { size: 9 } },
                zeroline: true
            },
            yaxis: {
                ...(themed.yaxis || {}),
                title: { text: 'relative power', font: { size: 9 } }
            }
        };

        Plotly.newPlot(el, traces, layout, { displayModeBar: false, responsive: true });
    }

    _bindNoteEditor(detail) {
        const saveBtn = this.container.querySelector('[data-note-save]');
        const input = this.container.querySelector('[data-note-input]');
        const status = this.container.querySelector('[data-note-status]');
        if (!saveBtn || !input) return;

        saveBtn.addEventListener('click', async () => {
            if (!this.onSaveNote) return;
            saveBtn.disabled = true;
            if (status) status.textContent = 'Saving…';
            try {
                await this.onSaveNote(detail.dbTrialId, input.value);
                if (status) status.textContent = 'Saved.';
            } catch (err) {
                console.error('TrialDetailView: note save failed', err);
                if (status) status.textContent = 'Save failed — try again.';
            } finally {
                saveBtn.disabled = false;
            }
        });
    }

    _esc(value) {
        if (window.AppUI?.escapeHtml) return window.AppUI.escapeHtml(value);
        return String(value ?? '');
    }

    _escapeText(value) {
        return this._esc(value);
    }

    _formatPairChoices(values = {}, pairDefinitions = null) {
        if (!values || typeof values !== 'object') return '—';
        const entries = Object.entries(values).filter(([, value]) => Boolean(value));
        if (!entries.length) return '—';

        if (Array.isArray(pairDefinitions) && pairDefinitions.length) {
            const labelById = Object.fromEntries(pairDefinitions.map(pair => [pair.id, pair.label]));
            return entries
                .map(([pairId, value]) => {
                    const label = labelById[pairId] || pairId.replace(/_/g, ' ');
                    return `${this._esc(label)}: ${this._esc(value)}`;
                })
                .join(' · ');
        }

        return entries.map(([, value]) => this._esc(value)).join(' · ');
    }

    _text(value) {
        const text = String(value || '').trim();
        return text ? this._esc(text) : '—';
    }

    _formatTesterNotes(notes) {
        if (!Array.isArray(notes) || notes.length === 0) return '—';
        return notes.map(note => {
            if (typeof note === 'string') return this._esc(note);
            return this._esc(note.text || note.note || JSON.stringify(note));
        }).join(' · ');
    }

    _formatBandDelta(delta) {
        if (!delta) return '—';
        return Object.entries(delta)
            .map(([band, value]) => `${band} ${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`)
            .join(' · ');
    }

    _formatDate(value) {
        if (!value) return 'Unknown';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toLocaleDateString();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TrialDetailView;
}
