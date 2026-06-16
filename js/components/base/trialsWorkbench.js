/**
 * TrialsWorkbench — the trial review table on the Pattern view.
 *
 * Flat trial rows with thin session dividers. Each row: order, urgency,
 * intensity, actions, status badges, a note indicator, and an inline
 * exclude-from-analysis toggle. Clicking a row expands a review drawer
 * with survey readings, research notes, and an editable analyst note
 * (persisted to the DB via onSaveNote).
 */
class TrialsWorkbench {
    constructor(options = {}) {
        this.containerId = options.containerId || 'trialsWorkbench';
        this.container = document.getElementById(this.containerId);
        this.onExcludeToggle = options.onExcludeToggle || null;
        this.onTrialOpen = options.onTrialOpen || null;
        this.getTrialDetail = options.getTrialDetail || null;
        this.onSaveNote = options.onSaveNote || null; // (dbTrialId, text) => Promise
        // selectable: rows act as selectors for an external detail panel
        // (no inline drawer). externalSearch: search is driven from outside.
        this.selectable = Boolean(options.selectable);
        this.externalSearch = Boolean(options.externalSearch);

        if (!this.container) {
            console.error(`TrialsWorkbench: Container #${this.containerId} not found`);
            return;
        }

        this.container.classList.add('trials-workbench');
        this.trials = [];
        this.patternName = null;
        this.expandedTrialId = null;
        this.selectedTrialId = null;
        this.searchQuery = '';
    }

    /** patternName null = cross-pattern mode: rows grow a pattern column. */
    render(trials, patternName = null) {
        if (this.patternName !== patternName) {
            this.expandedTrialId = null;
        }
        this.trials = trials || [];
        this.patternName = patternName;
        this.showPattern = !patternName;

        if (!this.trials.length) {
            this.container.innerHTML = `
                <div class="trials-workbench__empty">${patternName
                    ? 'No trials for this pattern under the current filters.'
                    : 'No trials under the current filters.'}</div>
            `;
            return;
        }

        const toolbarHtml = (this.showPattern && !this.externalSearch) ? `
            <div class="trials-workbench__toolbar">
                <input type="search" class="input trials-workbench__search" data-workbench-search
                    placeholder="Search trials — pattern, participant, action…" value="${this._escape(this.searchQuery)}">
            </div>
        ` : '';

        this.container.innerHTML = `
            ${toolbarHtml}
            <div data-workbench-list>${this._listRegionHtml()}</div>
        `;

        const search = this.container.querySelector('[data-workbench-search]');
        if (search) {
            search.addEventListener('input', () => {
                this.searchQuery = search.value.trim().toLowerCase();
                this._refreshListRegion();
            });
        }

        this._bind();
    }

    _filteredTrials() {
        if (!this.searchQuery) return this.trials;
        return this.trials.filter(trial => {
            const haystack = [
                trial.patternName,
                trial.participantCode,
                trial.status,
                (trial.actions?.all || []).join(' '),
                trial.analystNotes
            ].filter(Boolean).join(' ').toLowerCase();
            return haystack.includes(this.searchQuery);
        });
    }

    _listRegionHtml() {
        const trials = this._filteredTrials();
        if (!trials.length) {
            return '<div class="trials-workbench__empty">No trials match this search.</div>';
        }

        const sessions = this._groupBySessions(trials);
        const surveyed = trials.filter(t => t.hasSurvey).length;
        const noted = trials.filter(t => t.analystNotes).length;

        return `
            <div class="trials-workbench__summary">
                ${trials.length} trial${trials.length === 1 ? '' : 's'} ·
                ${surveyed} surveyed ·
                ${sessions.length} session${sessions.length === 1 ? '' : 's'}
                ${noted ? ` · ${noted} with analyst notes` : ''}
            </div>
            <div class="trials-workbench__scroll">
                ${sessions.map(session => this._sessionHtml(session)).join('')}
            </div>
        `;
    }

    /** Rebuild only the list (keeps search input focus + caret). */
    _refreshListRegion() {
        const region = this.container.querySelector('[data-workbench-list]');
        if (!region) return;
        region.innerHTML = this._listRegionHtml();
        this._bind();
    }

    setSearchQuery(query) {
        this.searchQuery = String(query || '').trim().toLowerCase();
        if (this.trials.length) this._refreshListRegion();
    }

    setSelectedTrial(dbTrialId) {
        this.selectedTrialId = dbTrialId != null ? String(dbTrialId) : null;
        this.container.querySelectorAll('.trials-workbench__row').forEach(row => {
            row.classList.toggle('trials-workbench__row--selected', row.dataset.trialId === this.selectedTrialId);
        });
    }

    clear() {
        this.trials = [];
        this.patternName = null;
        this.expandedTrialId = null;
        this.container.innerHTML = '';
    }

    updateRowNote(dbTrialId, hasNote) {
        const trial = this.trials.find(t => String(t.dbTrialId) === String(dbTrialId));
        if (trial) trial.analystNotes = hasNote ? (trial.analystNotes || ' ') : '';
        this._refreshNoteDot(dbTrialId, hasNote);
    }

    updateRowExclusion(dbTrialId, excluded) {
        const row = this.container.querySelector(`.trials-workbench__row[data-trial-id="${String(dbTrialId)}"]`);
        if (!row) return;
        row.classList.toggle('trials-workbench__row--excluded', excluded);
        const toggle = row.querySelector('[data-exclude-toggle]');
        if (toggle) {
            toggle.checked = excluded;
            toggle.disabled = false;
        }
    }

    _groupBySessions(trials) {
        const sessions = new Map();
        for (const trial of trials) {
            const key = String(trial.dbSessionId ?? trial.sessionId ?? 'unknown');
            if (!sessions.has(key)) {
                sessions.set(key, {
                    key,
                    participantCode: trial.participantCode || 'Unknown',
                    sessionDate: trial.sessionDate || trial.startTime || '',
                    trials: []
                });
            }
            sessions.get(key).trials.push(trial);
        }

        const list = Array.from(sessions.values());
        list.forEach(session => {
            session.trials.sort((a, b) => (a.trialOrder || 0) - (b.trialOrder || 0));
        });
        list.sort((a, b) => String(b.sessionDate).localeCompare(String(a.sessionDate)));
        return list;
    }

    _sessionHtml(session) {
        const date = this._formatDate(session.sessionDate);
        return `
            <div class="trials-workbench__session">
                <div class="trials-workbench__divider">
                    <span class="trials-workbench__divider-label">${this._escape(session.participantCode)} · ${date}</span>
                </div>
                ${session.trials.map(trial => this._rowHtml(trial)).join('')}
            </div>
        `;
    }

    _rowHtml(trial) {
        const excluded = Boolean(trial.excludeFromAnalysis);
        const expanded = !this.selectable && String(trial.dbTrialId) === this.expandedTrialId;
        const selected = this.selectable && String(trial.dbTrialId) === this.selectedTrialId;
        const actions = (trial.actions?.all || []).slice(0, 3).join(', ');
        const fmt = (value) => (value != null && Number.isFinite(Number(value)) ? Number(value).toFixed(2) : '—');
        const mainAttrs = this.selectable
            ? 'data-select-trial title="View trial details"'
            : `data-toggle-drawer aria-expanded="${expanded}" title="${expanded ? 'Collapse trial review' : 'Expand trial review'}"`;

        return `
            <div class="trials-workbench__row ${excluded ? 'trials-workbench__row--excluded' : ''} ${expanded ? 'trials-workbench__row--expanded' : ''} ${selected ? 'trials-workbench__row--selected' : ''}" data-trial-id="${String(trial.dbTrialId)}">
                <button type="button" class="trials-workbench__row-main" ${mainAttrs}>
                    <span class="trials-workbench__cell trials-workbench__cell--order font-mono">#${trial.trialOrder ?? '—'}</span>
                    ${this.showPattern ? `<span class="trials-workbench__cell trials-workbench__cell--pattern font-mono">${this._escape(trial.patternName || '—')}</span>` : ''}
                    <span class="trials-workbench__cell trials-workbench__cell--scale">
                        <span class="trials-workbench__cell-label">urg</span> <span class="font-mono">${fmt(trial.urgency)}</span>
                    </span>
                    <span class="trials-workbench__cell trials-workbench__cell--scale">
                        <span class="trials-workbench__cell-label">int</span> <span class="font-mono">${fmt(trial.intensity)}</span>
                    </span>
                    <span class="trials-workbench__cell trials-workbench__cell--actions">${this._escape(actions) || '<span class="trials-workbench__cell-muted">no actions</span>'}</span>
                    <span class="trials-workbench__cell trials-workbench__cell--status">
                        ${trial.analystNotes ? '<span class="trials-workbench__note-dot" title="Has analyst note"></span>' : ''}
                        ${trial.hasSurvey ? '' : '<span class="trials-workbench__badge">no survey</span>'}
                        ${trial.status !== 'completed' ? `<span class="trials-workbench__badge">${this._escape(trial.status)}</span>` : ''}
                    </span>
                </button>
                <label class="trials-workbench__exclude" title="Exclude this trial from analysis">
                    <input type="checkbox" data-exclude-toggle ${excluded ? 'checked' : ''}>
                    <span>exclude</span>
                </label>
            </div>
            ${expanded ? this._drawerHtml(trial) : ''}
        `;
    }

    _drawerHtml(trial) {
        const detail = this.getTrialDetail ? this.getTrialDetail(trial.dbTrialId) : null;
        if (!detail) {
            return '<div class="trials-workbench__drawer"><div class="trials-workbench__drawer-empty">Trial detail unavailable.</div></div>';
        }

        const fmt = (value) => (value != null && Number.isFinite(Number(value)) ? Number(value).toFixed(2) : '—');
        const allActions = (detail.actions?.all || []).join(', ');

        const surveyBlock = detail.hasSurvey ? `
            <div class="trials-workbench__drawer-section">
                <h4 class="trials-workbench__drawer-title">Survey</h4>
                <dl class="trials-workbench__drawer-facts">
                    <div><dt>Urgency</dt><dd class="font-mono">${fmt(detail.urgency)}</dd></div>
                    <div><dt>Intensity</dt><dd class="font-mono">${fmt(detail.intensity)}</dd></div>
                    <div><dt>Confidence</dt><dd class="font-mono">${fmt(detail.confidence)}</dd></div>
                    ${detail.mood ? `<div><dt>Mood</dt><dd>${this._escape(detail.mood)}</dd></div>` : ''}
                </dl>
                ${detail.vibesSummary ? `<p class="trials-workbench__drawer-text">${this._escape(detail.vibesSummary)}</p>` : ''}
                ${allActions ? `<p class="trials-workbench__drawer-text"><span class="trials-workbench__drawer-label">Actions:</span> ${this._escape(allActions)}</p>` : ''}
            </div>
        ` : `
            <div class="trials-workbench__drawer-section">
                <h4 class="trials-workbench__drawer-title">Survey</h4>
                <p class="trials-workbench__drawer-text trials-workbench__cell-muted">No survey response recorded.</p>
            </div>
        `;

        const noteParts = [];
        if (detail.participantNotes) noteParts.push({ label: 'Participant', text: detail.participantNotes });
        if (detail.notesRaw) noteParts.push({ label: 'Tester', text: detail.notesRaw });
        const researchNotesBlock = `
            <div class="trials-workbench__drawer-section">
                <h4 class="trials-workbench__drawer-title">Research notes</h4>
                ${noteParts.length
                    ? noteParts.map(note => `<p class="trials-workbench__drawer-text"><span class="trials-workbench__drawer-label">${note.label}:</span> ${this._escape(note.text)}</p>`).join('')
                    : '<p class="trials-workbench__drawer-text trials-workbench__cell-muted">No notes.</p>'}
                <p class="trials-workbench__drawer-text">
                    <span class="trials-workbench__drawer-label">EEG:</span>
                    ${detail.hasEeg ? 'baseline + stimulation recorded' : 'not available'}
                </p>
            </div>
        `;

        const analystBlock = `
            <div class="trials-workbench__drawer-section trials-workbench__drawer-section--analyst">
                <h4 class="trials-workbench__drawer-title">Analyst note</h4>
                <textarea class="trials-workbench__note-input" data-note-input rows="2"
                    placeholder="Your read on this trial — anomalies, context, exclusion rationale…">${this._escape(trial.analystNotes || '')}</textarea>
                <div class="trials-workbench__note-row">
                    <button type="button" class="trials-workbench__note-save" data-note-save>Save note</button>
                    <span class="trials-workbench__note-status" data-note-status aria-live="polite"></span>
                </div>
            </div>
        `;

        return `
            <div class="trials-workbench__drawer" data-drawer-for="${String(trial.dbTrialId)}">
                <div class="trials-workbench__drawer-grid">
                    ${surveyBlock}
                    ${researchNotesBlock}
                </div>
                ${analystBlock}
                <div class="trials-workbench__drawer-footer">
                    <button type="button" class="trials-workbench__drawer-open" data-open-trial="${String(trial.dbTrialId)}">Open full trial view →</button>
                </div>
            </div>
        `;
    }

    _toggleDrawer(dbTrialId) {
        const normalized = String(dbTrialId);
        this.expandedTrialId = this.expandedTrialId === normalized ? null : normalized;
        this.render(this.trials, this.patternName);
    }

    _bind() {
        this.container.querySelectorAll('.trials-workbench__row').forEach(row => {
            const dbTrialId = row.dataset.trialId;

            const main = row.querySelector('[data-toggle-drawer]');
            if (main) {
                main.addEventListener('click', () => this._toggleDrawer(dbTrialId));
            }

            const selector = row.querySelector('[data-select-trial]');
            if (selector) {
                selector.addEventListener('click', () => {
                    this.setSelectedTrial(dbTrialId);
                    if (this.onTrialOpen) this.onTrialOpen(dbTrialId);
                });
            }

            const toggle = row.querySelector('[data-exclude-toggle]');
            if (toggle) {
                toggle.addEventListener('change', () => {
                    toggle.disabled = true;
                    if (this.onExcludeToggle) {
                        this.onExcludeToggle(dbTrialId, toggle.checked);
                    }
                });
            }
        });

        this.container.querySelectorAll('[data-open-trial]').forEach(button => {
            button.addEventListener('click', () => {
                if (this.onTrialOpen) this.onTrialOpen(button.dataset.openTrial);
            });
        });

        const drawer = this.container.querySelector('[data-drawer-for]');
        if (drawer) {
            const saveBtn = drawer.querySelector('[data-note-save]');
            const input = drawer.querySelector('[data-note-input]');
            const status = drawer.querySelector('[data-note-status]');
            if (saveBtn && input) {
                saveBtn.addEventListener('click', async () => {
                    if (!this.onSaveNote) return;
                    const dbTrialId = drawer.dataset.drawerFor;
                    saveBtn.disabled = true;
                    if (status) status.textContent = 'Saving…';
                    try {
                        await this.onSaveNote(dbTrialId, input.value);
                        const trial = this.trials.find(t => String(t.dbTrialId) === dbTrialId);
                        if (trial) trial.analystNotes = input.value.trim();
                        if (status) status.textContent = 'Saved.';
                        this._refreshNoteDot(dbTrialId, Boolean(input.value.trim()));
                    } catch (err) {
                        console.error('TrialsWorkbench: note save failed', err);
                        if (status) status.textContent = 'Save failed — try again.';
                    } finally {
                        saveBtn.disabled = false;
                    }
                });
            }
        }
    }

    _refreshNoteDot(dbTrialId, hasNote) {
        const row = this.container.querySelector(`.trials-workbench__row[data-trial-id="${String(dbTrialId)}"]`);
        if (!row) return;
        const statusCell = row.querySelector('.trials-workbench__cell--status');
        if (!statusCell) return;
        const existing = statusCell.querySelector('.trials-workbench__note-dot');
        if (hasNote && !existing) {
            statusCell.insertAdjacentHTML('afterbegin', '<span class="trials-workbench__note-dot" title="Has analyst note"></span>');
        } else if (!hasNote && existing) {
            existing.remove();
        }
    }

    _formatDate(value) {
        if (!value) return 'Unknown date';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }

    _escape(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TrialsWorkbench;
}
