/**
 * AnalyzeToolbar — header tools + floating filters popover.
 */
class AnalyzeToolbar {
    constructor(options = {}) {
        this.containerId = options.containerId || 'analyzeToolbar';
        this.container = document.getElementById(this.containerId);
        this.onFiltersChange = options.onFiltersChange || null;
        this.onRefresh = options.onRefresh || null;
        this.filterOptions = { participants: [], dateBounds: { min: null, max: null }, datesWithData: [] };
        this.filtersOpen = false;
        this.includedParticipantIds = null;
        this.boundHandlers = {};
        if (!this.container) return;
        this.render();
    }

    render() {
        this.container.innerHTML = `
            <button type="button" class="icon-btn" id="analyzeFiltersToggle" aria-expanded="false" aria-controls="analyzeFiltersPopover" title="Filters">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
                </svg>
                <span class="icon-btn__label">Filters</span>
                <span class="icon-btn__badge" id="analyzeFiltersBadge" hidden></span>
            </button>
            <button type="button" id="analyzeRefreshBtn" class="icon-btn analyze-refresh-btn" title="Reload from database" aria-label="Reload from database">
                <svg class="analyze-refresh-btn__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M21 12a9 9 0 1 1-2.64-6.36" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
                    <path d="M21 3v6h-6" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
        `;

        this.summaryEl = document.getElementById('analyzeCorpusSummary');
        this.filtersBadgeEl = this.container.querySelector('#analyzeFiltersBadge');
        this.refreshButton = this.container.querySelector('#analyzeRefreshBtn');
        this.filtersToggle = this.container.querySelector('#analyzeFiltersToggle');
        this.completedOnlyInput = null;
        this.hideExcludedInput = null;

        this._createFiltersPopover();

        [
            this.completedOnlyInput,
            this.hideExcludedInput
        ].forEach(el => el.addEventListener('change', () => this.emitFilters()));

        this.participantsAllBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            this.includedParticipantIds = null;
            this._renderParticipantChips();
            this.emitFilters();
        });
        this.participantsNoneBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            this.includedParticipantIds = [];
            this._renderParticipantChips();
            this.emitFilters();
        });

        this.filtersToggle.addEventListener('click', (event) => {
            event.stopPropagation();
            this.toggleFilters();
        });
        this.filtersCloseBtn.addEventListener('click', () => this.closeFilters());
        this.filtersBackdrop.addEventListener('click', () => this.closeFilters());

        this.boundHandlers.documentClick = (event) => {
            if (!this.filtersOpen) return;
            if (this.filtersPopover.contains(event.target) || this.filtersToggle.contains(event.target)) {
                return;
            }
            this.closeFilters();
        };
        this.boundHandlers.documentKeydown = (event) => {
            if (event.key === 'Escape' && this.filtersOpen) {
                this.closeFilters();
            }
        };
        document.addEventListener('click', this.boundHandlers.documentClick);
        document.addEventListener('keydown', this.boundHandlers.documentKeydown);

        if (this.refreshButton && this.onRefresh) {
            this.refreshButton.addEventListener('click', () => this.onRefresh());
        }
    }

    _createFiltersPopover() {
        this.filtersBackdrop = document.createElement('div');
        this.filtersBackdrop.className = 'analyze-filters-backdrop';
        this.filtersBackdrop.hidden = true;

        this.filtersPopover = document.createElement('div');
        this.filtersPopover.id = 'analyzeFiltersPopover';
        this.filtersPopover.className = 'analyze-filters-popover';
        this.filtersPopover.hidden = true;
        this.filtersPopover.innerHTML = `
            <div class="analyze-filters-popover__header">
                <h2 class="analyze-filters-popover__title">Filters</h2>
                <button type="button" class="analyze-filters-popover__close" id="analyzeFiltersClose" aria-label="Close filters">×</button>
            </div>
            <div class="analyze-filters-popover__body">
                <div class="analyze-filters-popover__columns">
                    <section class="analyze-filters-section">
                        <div class="analyze-filters-section__header">
                            <span class="analyze-filters-section__label">Participants</span>
                            <div class="analyze-filters-section__actions">
                                <button type="button" class="analyze-filters-link" id="analyzeParticipantsAll">All</button>
                                <button type="button" class="analyze-filters-link" id="analyzeParticipantsNone">None</button>
                            </div>
                        </div>
                        <div class="analyze-filters-chips" id="analyzeFilterParticipants"></div>
                    </section>
                    <section class="analyze-filters-section analyze-filters-section--time">
                        <div class="analyze-filters-section__header">
                            <span class="analyze-filters-section__label">Time</span>
                        </div>
                        <div id="analyzeFilterDateRange"></div>
                    </section>
                </div>
                <div class="analyze-filters-toggles">
                    <label class="analyze-filters-toggle">
                        <input type="checkbox" id="analyzeFilterCompletedOnly" checked>
                        <span>Completed only</span>
                    </label>
                    <label class="analyze-filters-toggle">
                        <input type="checkbox" id="analyzeFilterHideExcluded" checked>
                        <span>Hide excluded trials</span>
                    </label>
                </div>
            </div>
        `;

        document.body.appendChild(this.filtersBackdrop);
        document.body.appendChild(this.filtersPopover);

        this.filtersCloseBtn = this.filtersPopover.querySelector('#analyzeFiltersClose');
        this.participantListEl = this.filtersPopover.querySelector('#analyzeFilterParticipants');
        this.participantsAllBtn = this.filtersPopover.querySelector('#analyzeParticipantsAll');
        this.participantsNoneBtn = this.filtersPopover.querySelector('#analyzeParticipantsNone');
        this.dateRangeContainer = this.filtersPopover.querySelector('#analyzeFilterDateRange');
        this.completedOnlyInput = this.filtersPopover.querySelector('#analyzeFilterCompletedOnly');
        this.hideExcludedInput = this.filtersPopover.querySelector('#analyzeFilterHideExcluded');

        this.dateRangeCalendar = new AnalyzeDateRangeCalendar({
            container: this.dateRangeContainer,
            onChange: () => this.emitFilters()
        });

        this.filtersPopover.addEventListener('click', (event) => {
            event.stopPropagation();
        });
    }

    toggleFilters() {
        if (this.filtersOpen) {
            this.closeFilters();
            return;
        }
        this.openFilters();
    }

    openFilters() {
        this.filtersOpen = true;
        this.filtersBackdrop.hidden = false;
        this.filtersPopover.hidden = false;
        this.filtersToggle.setAttribute('aria-expanded', 'true');
        this.filtersToggle.classList.add('icon-btn--active');
        this._positionPopover();
    }

    closeFilters() {
        this.filtersOpen = false;
        this.filtersBackdrop.hidden = true;
        this.filtersPopover.hidden = true;
        this.filtersToggle.setAttribute('aria-expanded', 'false');
        this.filtersToggle.classList.remove('icon-btn--active');
    }

    _positionPopover() {
        const rect = this.filtersToggle.getBoundingClientRect();
        const margin = 12;
        const panelWidth = Math.min(600, window.innerWidth - margin * 2);
        let left = rect.right - panelWidth;
        left = Math.max(margin, Math.min(left, window.innerWidth - panelWidth - margin));

        this.filtersPopover.style.width = `${panelWidth}px`;
        this.filtersPopover.style.left = `${left}px`;

        let top = rect.bottom + 8;
        const popoverHeight = this.filtersPopover.offsetHeight;
        if (top + popoverHeight > window.innerHeight - margin) {
            top = Math.max(margin, rect.top - popoverHeight - 8);
        }
        this.filtersPopover.style.top = `${top}px`;
    }

    setFilterOptions(options = {}) {
        this.filterOptions = options;
        this._renderParticipantChips();
        if (this.dateRangeCalendar) {
            const current = this.dateRangeCalendar.getRange();
            this.dateRangeCalendar.setOptions({
                dateBounds: options.dateBounds,
                datesWithData: options.datesWithData
            });
            this.dateRangeCalendar.setRange(current.dateFrom, current.dateTo);
        }
        this._updateFilterBadge();
    }

    _renderParticipantChips() {
        const participants = this.filterOptions.participants || [];
        if (!this.participantListEl) return;

        if (!participants.length) {
            this.participantListEl.innerHTML = '<div class="analyze-filters-chips__empty">No participants in corpus.</div>';
            return;
        }

        const includedSet = this.includedParticipantIds === null
            ? new Set(participants.map(p => p.id))
            : new Set(this.includedParticipantIds);

        this.participantListEl.innerHTML = participants.map(participant => {
            const included = includedSet.has(participant.id);
            return `
                <button type="button"
                    class="analyze-filters-chip ${included ? 'analyze-filters-chip--included' : ''}"
                    data-participant-id="${participant.id}"
                    aria-pressed="${included}">
                    ${participant.code}
                </button>
            `;
        }).join('');

        this.participantListEl.querySelectorAll('.analyze-filters-chip').forEach(button => {
            button.addEventListener('click', (event) => {
                event.stopPropagation();
                const participantId = Number(button.dataset.participantId);
                const allIds = participants.map(p => p.id);
                const currentSet = this.includedParticipantIds === null
                    ? new Set(allIds)
                    : new Set(this.includedParticipantIds);

                if (currentSet.has(participantId)) {
                    currentSet.delete(participantId);
                } else {
                    currentSet.add(participantId);
                }

                if (currentSet.size === allIds.length) {
                    this.includedParticipantIds = null;
                } else {
                    this.includedParticipantIds = [...currentSet];
                }

                this._renderParticipantChips();
                this.emitFilters();
            });
        });
    }

    _countActiveFilters() {
        const participants = this.filterOptions.participants || [];
        const { dateFrom, dateTo } = this.dateRangeCalendar
            ? this.dateRangeCalendar.getRange()
            : { dateFrom: '', dateTo: '' };

        let count = 0;

        if (this.includedParticipantIds !== null) {
            count += 1;
        }
        if (dateFrom || dateTo) {
            count += 1;
        }
        if (this.completedOnlyInput && !this.completedOnlyInput.checked) {
            count += 1;
        }
        if (this.hideExcludedInput && !this.hideExcludedInput.checked) {
            count += 1;
        }

        return count;
    }

    _updateFilterBadge() {
        if (!this.filtersBadgeEl) return;

        const count = this._countActiveFilters();
        if (count > 0) {
            this.filtersBadgeEl.hidden = false;
            this.filtersBadgeEl.textContent = String(count);
        } else {
            this.filtersBadgeEl.hidden = true;
            this.filtersBadgeEl.textContent = '';
        }
    }

    updateSummary(summary = {}) {
        if (!this.summaryEl) return;
        this.summaryEl.textContent = `${summary.sessionCount || 0} sessions · ${summary.trialCount || 0} trials · ${summary.participantCount || 0} participants`;
    }

    getFilters() {
        const { dateFrom, dateTo } = this.dateRangeCalendar
            ? this.dateRangeCalendar.getRange()
            : { dateFrom: '', dateTo: '' };

        return {
            participantIds: this.includedParticipantIds === null
                ? null
                : [...(this.includedParticipantIds || [])],
            dateFrom,
            dateTo,
            completedOnly: this.completedOnlyInput.checked,
            hideExcluded: this.hideExcludedInput.checked
        };
    }

    emitFilters() {
        this._updateFilterBadge();
        if (this.onFiltersChange) this.onFiltersChange(this.getFilters());
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnalyzeToolbar;
}
