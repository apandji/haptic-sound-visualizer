/**
 * TrialsListView — filterable trial table.
 */
class TrialsListView {
    constructor(options = {}) {
        this.containerId = options.containerId || 'trialsListView';
        this.container = document.getElementById(this.containerId);
        this.onTrialSelect = options.onTrialSelect || null;
        this.compact = Boolean(options.compact);
        if (!this.container) return;
        this.render([]);
    }

    render(trials = []) {
        this.container.className = 'trials-list-view';
        if (!trials.length) {
            this.container.innerHTML = '<div class="trials-list-view__empty">No trials match the current filters.</div>';
            return;
        }

        this.container.innerHTML = `
            <table class="trials-list-view__table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Participant</th>
                        ${this.compact ? '' : '<th>Pattern</th>'}
                        <th>Actions</th>
                        <th>Urgency</th>
                        <th>Mood</th>
                        <th>Texture</th>
                        <th>Flags</th>
                    </tr>
                </thead>
                <tbody>
                    ${trials.map(trial => `
                        <tr data-trial-id="${trial.dbTrialId}" class="${trial.excludeFromAnalysis ? 'trials-list-view__row--excluded' : ''}">
                            <td>${this._formatDate(trial.sessionDate)}</td>
                            <td>${trial.participantCode || '—'}</td>
                            ${this.compact ? '' : `<td>${trial.patternName || '—'}</td>`}
                            <td>${(trial.actions?.all || []).join(', ') || '—'}</td>
                            <td>${this._formatScale(trial.urgency)}</td>
                            <td>${trial.mood || '—'}</td>
                            <td>${trial.textureSummary || '—'}</td>
                            <td>
                                ${trial.excludeFromAnalysis ? '<span class="trials-list-view__flag">Excluded</span>' : ''}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        this.container.querySelectorAll('tbody tr').forEach(row => {
            row.addEventListener('click', () => {
                const trialId = row.dataset.trialId;
                if (this.onTrialSelect) this.onTrialSelect(trialId);
            });
        });
    }

    _formatScale(value) {
        if (value == null || !Number.isFinite(Number(value))) return '—';
        return Number(value).toFixed(2);
    }

    _formatDate(value) {
        if (!value) return '—';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toLocaleDateString();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TrialsListView;
}
