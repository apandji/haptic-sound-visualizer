/**
 * TrialsSidebarList — compact trial list for the Analyze sidebar.
 */
class TrialsSidebarList {
    constructor(options = {}) {
        this.containerId = options.containerId || 'trialSidebarList';
        this.container = document.getElementById(this.containerId);
        this.onTrialSelect = options.onTrialSelect || null;
        this.trials = [];
        this.selectedTrialId = null;
        this.searchQuery = '';
        if (!this.container) return;
        this.render();
    }

    render() {
        this.container.className = 'trials-sidebar-list';
        this.container.innerHTML = `
            <input type="search" class="trials-sidebar-list__search" placeholder="Search trials…" aria-label="Search trials">
            <div class="trials-sidebar-list__items"></div>
        `;
        this.searchInput = this.container.querySelector('.trials-sidebar-list__search');
        this.itemsEl = this.container.querySelector('.trials-sidebar-list__items');
        this.searchInput.addEventListener('input', () => {
            this.searchQuery = this.searchInput.value.trim().toLowerCase();
            this._renderItems();
        });
    }

    setTrials(trials = []) {
        this.trials = trials || [];
        this._renderItems();
    }

    selectTrial(dbTrialId) {
        this.selectedTrialId = dbTrialId != null ? String(dbTrialId) : null;
        this._renderItems();
    }

    _renderItems() {
        if (!this.itemsEl) return;

        const filtered = this.trials.filter(trial => {
            if (!this.searchQuery) return true;
            const haystack = [
                trial.participantCode,
                trial.patternName,
                ...(trial.actions?.all || [])
            ].join(' ').toLowerCase();
            return haystack.includes(this.searchQuery);
        });

        if (!filtered.length) {
            this.itemsEl.innerHTML = '<div class="trials-sidebar-list__empty">No trials match the current filters.</div>';
            return;
        }

        this.itemsEl.innerHTML = filtered.map(trial => {
            const isSelected = String(trial.dbTrialId) === String(this.selectedTrialId);
            const actions = (trial.actions?.all || []).slice(0, 2).join(', ');
            const actionSuffix = (trial.actions?.all || []).length > 2 ? '…' : '';
            return `
                <button type="button"
                    class="trials-sidebar-list__item ${isSelected ? 'trials-sidebar-list__item--active' : ''} ${trial.excludeFromAnalysis ? 'trials-sidebar-list__item--excluded' : ''}"
                    data-trial-id="${trial.dbTrialId}">
                    <span class="trials-sidebar-list__item-row">
                        <span class="trials-sidebar-list__item-primary">${trial.participantCode || 'Unknown'} · ${this._formatDate(trial.sessionDate)}</span>
                        ${trial.excludeFromAnalysis ? '<span class="trials-sidebar-list__item-flag">Excluded</span>' : ''}
                    </span>
                    <span class="trials-sidebar-list__item-secondary">${trial.patternName || '—'}${actions ? ` · ${actions}${actionSuffix}` : ''}</span>
                </button>
            `;
        }).join('');

        this.itemsEl.querySelectorAll('.trials-sidebar-list__item').forEach(button => {
            button.addEventListener('click', () => {
                const trialId = button.dataset.trialId;
                this.selectTrial(trialId);
                if (this.onTrialSelect) this.onTrialSelect(trialId);
            });
        });
    }

    _formatDate(value) {
        if (!value) return '—';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toLocaleDateString();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TrialsSidebarList;
}
