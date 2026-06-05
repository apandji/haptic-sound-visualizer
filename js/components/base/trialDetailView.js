/**
 * TrialDetailView — single trial with notes and exclusion toggle.
 */
class TrialDetailView {
    constructor(options = {}) {
        this.containerId = options.containerId || 'trialDetailView';
        this.container = document.getElementById(this.containerId);
        this.onExcludeChange = options.onExcludeChange || null;
        this.onBack = options.onBack || null;
        this.currentTrialId = null;
        if (!this.container) return;
        this.render(null);
    }

    render(detail) {
        this.container.className = 'trial-detail-view';
        if (!detail) {
            this.container.innerHTML = '<div class="trial-detail-view__empty">Select a trial to inspect notes, survey, and EEG context.</div>';
            return;
        }

        this.currentTrialId = detail.dbTrialId;
        const survey = detail.surveyResponse;
        const actions = (detail.actions?.all || []).join(', ') || '—';
        const emotions = survey?.emotion
            ? Object.entries(survey.emotion).map(([key, value]) => `${key}: ${value}`).join(' · ')
            : '—';

        this.container.innerHTML = `
            <div class="trial-detail-view__header">
                <button type="button" class="trial-detail-view__back" id="trialDetailBack">← Back</button>
                <div>
                    <div class="trial-detail-view__title-row">
                        <h2 class="trial-detail-view__title">${detail.participantCode || 'Unknown'} · ${detail.patternName || 'Pattern'}</h2>
                        ${detail.excludeFromAnalysis ? '<span class="trial-detail-view__excluded-badge">Excluded</span>' : ''}
                    </div>
                    <p class="trial-detail-view__subtitle">Session ${this._formatDate(detail.sessionDate)} · Trial ${detail.trialOrder}</p>
                </div>
                <label class="trial-detail-view__exclude">
                    <input type="checkbox" id="trialExcludeToggle" ${detail.excludeFromAnalysis ? 'checked' : ''}>
                    <span>Exclude from collective analysis</span>
                </label>
            </div>
            <div class="trial-detail-view__grid">
                <section class="trial-detail-view__card">
                    <h3>Context</h3>
                    <dl>
                        <dt>Participant notes</dt><dd>${this._text(detail.participantNotes)}</dd>
                        <dt>Session notes</dt><dd>${this._text(detail.sessionNotes)}</dd>
                        <dt>Experimenter</dt><dd>${this._text(detail.experimenter)}</dd>
                        <dt>Location</dt><dd>${this._text(detail.locationName)}</dd>
                        <dt>Equipment</dt><dd>${this._text(detail.equipmentInfo)}</dd>
                        <dt>Status</dt><dd>${detail.status || '—'}</dd>
                    </dl>
                </section>
                <section class="trial-detail-view__card">
                    <h3>Survey</h3>
                    <dl>
                        <dt>Actions</dt><dd>${actions}</dd>
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
                <section class="trial-detail-view__card">
                    <h3>EEG summary</h3>
                    <p>${detail.hasEeg ? this._formatBandDelta(detail.bandDelta) : 'No baseline/stimulation readings available for this trial.'}</p>
                    <p class="trial-detail-view__hint">${detail.testerEvents?.length ? `${detail.testerEvents.length} tester event(s) recorded.` : 'No tester events.'}</p>
                </section>
            </div>
        `;

        this.container.querySelector('#trialDetailBack').addEventListener('click', () => {
            if (this.onBack) this.onBack();
        });
        this.container.querySelector('#trialExcludeToggle').addEventListener('change', (event) => {
            if (this.onExcludeChange) {
                this.onExcludeChange(detail.dbTrialId, event.target.checked);
            }
        });
    }

    _text(value) {
        const text = String(value || '').trim();
        return text || '—';
    }

    _formatTesterNotes(notes) {
        if (!Array.isArray(notes) || notes.length === 0) return '—';
        return notes.map(note => {
            if (typeof note === 'string') return note;
            return note.text || note.note || JSON.stringify(note);
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
