/**
 * AttentionQueuePanel — the landscape's "what needs attention" queue.
 *
 * Grouped by what the analyst should do, in elevate-vs-eliminate order:
 *   1. Worth digging into — measurable response + data we can trust
 *   2. Retire candidates  — enough data, no measurable brain response
 *   3. Mixed signals      — participants disagree; check trials for outliers
 *   4. Needs more data    — under-tested or never tested
 *   5. Stale              — no new data in over a week (hidden while fresh)
 *
 * Progressive disclosure: collapsed rows show only pattern + confidence
 * score. Clicking a row expands it to reveal the evidence line, the
 * confidence breakdown, inline tag chips (Worth digging into only), and
 * an "Open pattern" action.
 */
class AttentionQueuePanel {
    constructor(options = {}) {
        this.containerId = options.containerId || 'attentionQueuePanel';
        this.container = document.getElementById(this.containerId);
        this.onPatternSelect = options.onPatternSelect || null;
        this.onTagToggle = options.onTagToggle || null; // (patternName, tagId) => Promise

        if (!this.container) {
            console.error(`AttentionQueuePanel: Container #${this.containerId} not found`);
            return;
        }

        this.expandedKey = null;

        this.container.classList.add('attention-queue');
        this.container.addEventListener('click', (event) => this._handleClick(event));
    }

    static STALE_DAYS = 7;

    static get SECTION_ICONS() {
        const icons = (typeof window !== 'undefined' && window.ICONS) || {};
        return {
            dig: icons.trendingUp || '',
            retire: icons.archive || '',
            mixed: icons.alert || '',
            data: icons.plus || '',
            stale: icons.clock || ''
        };
    }

    /**
     * @param {Object} health      getResearchHealth() result
     * @param {Object} landscape   getCorpusLandscape() result
     * @param {Map}    patternTags Map<patternName, number[]>
     * @param {Array}  tags        full tag vocabulary [{id, name, color, isDefault}]
     */
    update(health, landscape, patternTags, tags = []) {
        this.patternTags = patternTags || new Map();
        this.tags = tags || [];

        const confByName = new Map(
            (landscape?.patterns || []).map(p => [p.name, p.confidence || null])
        );
        const isTagged = (name) => (this.patternTags.get(name) || []).length > 0;

        const sections = [];

        const digRows = (health?.digIn || []).map(entry => ({
            pattern: entry.name,
            flag: isTagged(entry.name) ? null : 'untagged',
            why: this._digWhy(entry),
            score: entry.score,
            confidence: confByName.get(entry.name),
            taggable: true
        }));
        if (digRows.length) {
            sections.push({
                kind: 'dig',
                title: 'Worth digging into',
                desc: 'Measurable response, data you can trust',
                rows: digRows
            });
        }

        const retireRows = (health?.flatEeg || []).map(entry => ({
            pattern: entry.name,
            why: `largest band shift ${(entry.maxAbsDelta * 100).toFixed(1)}% (${entry.topBand}) over ${entry.eegTrialCount} EEG trials — retire or redesign?`,
            score: confByName.get(entry.name)?.value,
            confidence: confByName.get(entry.name)
        }));
        if (retireRows.length) {
            sections.push({
                kind: 'retire',
                title: 'Retire candidates',
                desc: 'No measurable brain response despite enough data',
                rows: retireRows
            });
        }

        const mixedRows = (health?.unstable || []).map(entry => ({
            pattern: entry.name,
            why: `ratings spread ±${(entry.avgIqr / 2).toFixed(2)} across ${entry.surveyedCount} trials — look for outlier trials to exclude`,
            score: confByName.get(entry.name)?.value,
            confidence: confByName.get(entry.name)
        }));
        if (mixedRows.length) {
            sections.push({
                kind: 'mixed',
                title: 'Mixed signals',
                desc: 'Participants disagree — check trials for outliers',
                rows: mixedRows
            });
        }

        const dataRows = (health?.underTested || []).map(entry => ({
            pattern: entry.name,
            why: entry.trialCount === 0
                ? `no trials yet — run ${entry.needed} to map it`
                : `${entry.surveyedCount} surveyed — run ${entry.needed} more`,
            score: confByName.get(entry.name)?.value,
            confidence: confByName.get(entry.name)
        }));
        if (dataRows.length) {
            sections.push({
                kind: 'data',
                title: 'Needs more data',
                desc: 'Too few surveyed trials to judge',
                rows: dataRows
            });
        }

        const staleRows = this._staleRows(health, confByName);
        if (staleRows.length) {
            sections.push({
                kind: 'stale',
                title: 'Going stale',
                desc: 'No new data in over a week',
                rows: staleRows
            });
        }

        if (!sections.length) {
            this.container.innerHTML = `
                <p class="attention-queue__empty">
                    Nothing urgent — every tested pattern has enough consistent data and a tag.
                </p>
            `;
            return;
        }

        this.container.innerHTML = sections.map(section => `
            <section class="attention-queue__section attention-queue__section--${section.kind}">
                <header class="attention-queue__section-head">
                    <h4 class="attention-queue__section-title">${AttentionQueuePanel.SECTION_ICONS[section.kind] || ''}${this._escape(section.title)}</h4>
                    <span class="attention-queue__section-count">${section.rows.length}</span>
                </header>
                <p class="attention-queue__section-desc">${this._escape(section.desc)}</p>
                <ul class="attention-queue__list">
                    ${section.rows.map(row => this._rowHtml(section.kind, row)).join('')}
                </ul>
            </section>
        `).join('');
    }

    _rowHtml(kind, row) {
        const key = `${kind}:${row.pattern}`;
        const open = this.expandedKey === key;
        return `
            <li class="attention-queue__item ${open ? 'attention-queue__item--open' : ''}">
                <button type="button" class="attention-queue__row" data-queue-toggle="${this._escape(key)}" aria-expanded="${open}">
                    <span class="attention-queue__chev" aria-hidden="true"></span>
                    <span class="attention-queue__action">
                        <span class="attention-queue__pattern font-mono">${this._escape(row.pattern)}</span>
                        ${row.flag ? `<span class="attention-queue__flag">${this._escape(row.flag)}</span>` : ''}
                    </span>
                    ${this._scoreHtml(row.score)}
                </button>
                <div class="attention-queue__detail" ${open ? '' : 'hidden'}>
                    <p class="attention-queue__why">${this._escape(row.why)}</p>
                    ${this._breakdownHtml(row.confidence)}
                    ${row.taggable ? this._tagChipsHtml(row.pattern) : ''}
                    <div class="attention-queue__detail-actions">
                        <button type="button" class="attention-queue__open" data-queue-open="${this._escape(row.pattern)}">
                            Open pattern →
                        </button>
                    </div>
                </div>
            </li>
        `;
    }

    _scoreHtml(score) {
        if (score == null) return '';
        const pct = Math.round(Math.max(0, Math.min(1, score)) * 100);
        return `
            <span class="attention-queue__score" title="Confidence: trials × agreement × self-reported sureness">
                <span class="attention-queue__score-num">${pct}%</span>
                <span class="attention-queue__score-bar"><i style="width: ${pct}%"></i></span>
            </span>
        `;
    }

    _breakdownHtml(confidence) {
        if (!confidence || !confidence.evidence) return '';
        const parts = [
            `evidence ${Math.round(confidence.evidence * 100)}%`,
            `agreement ${Math.round(confidence.consistency * 100)}%`
        ];
        if (confidence.reported != null) {
            parts.push(`self-rated ${Math.round(confidence.reported * 100)}%`);
        }
        return `<p class="attention-queue__breakdown">confidence = ${parts.join(' · ')}</p>`;
    }

    _tagChipsHtml(patternName) {
        if (!this.tags.length || !this.onTagToggle) return '';
        const assigned = new Set(this.patternTags.get(patternName) || []);
        return `
            <div class="attention-queue__tags" role="group" aria-label="Tag ${this._escape(patternName)}">
                ${this.tags.map(tag => `
                    <button type="button"
                        class="attention-queue__tag-chip ${assigned.has(tag.id) ? 'attention-queue__tag-chip--on' : ''}"
                        style="--tag-color:${this._escape(tag.color || 'var(--color-accent)')}"
                        data-queue-tag="${tag.id}"
                        data-queue-tag-pattern="${this._escape(patternName)}"
                        aria-pressed="${assigned.has(tag.id)}">
                        ${this._escape(tag.name)}
                    </button>
                `).join('')}
            </div>
        `;
    }

    _digWhy(entry) {
        const parts = [];
        if (entry.eegEffect && entry.topBand) {
            const pct = entry.topDelta * 100;
            parts.push(`${entry.topBand} ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% over ${entry.eegTrialCount} EEG trials`);
        }
        if (entry.surveyDistinct) {
            parts.push('distinct placement');
        }
        parts.push(`${entry.surveyedCount} trials`);
        return parts.join(' · ');
    }

    _staleRows(health, confByName) {
        const now = Date.now();
        return (health?.stale || [])
            .map(entry => {
                const then = new Date(entry.latestEndTime).getTime();
                if (!Number.isFinite(then)) return null;
                const days = Math.floor((now - then) / 86400000);
                if (days < AttentionQueuePanel.STALE_DAYS) return null;
                return {
                    pattern: entry.name,
                    why: `no new data in ${days} days — schedule a retest`,
                    score: confByName.get(entry.name)?.value,
                    confidence: confByName.get(entry.name)
                };
            })
            .filter(Boolean);
    }

    async _handleClick(event) {
        const openBtn = event.target.closest('[data-queue-open]');
        if (openBtn) {
            if (this.onPatternSelect) this.onPatternSelect(openBtn.dataset.queueOpen);
            return;
        }

        const chip = event.target.closest('[data-queue-tag]');
        if (chip) {
            if (!this.onTagToggle) return;
            chip.disabled = true;
            try {
                await this.onTagToggle(chip.dataset.queueTagPattern, Number(chip.dataset.queueTag));
                // The app refresh re-renders this panel with the new state.
            } catch (err) {
                console.error('AttentionQueuePanel: tag toggle failed', err);
                chip.disabled = false;
            }
            return;
        }

        const row = event.target.closest('[data-queue-toggle]');
        if (row) this._toggleRow(row.dataset.queueToggle);
    }

    _toggleRow(key) {
        this.expandedKey = this.expandedKey === key ? null : key;
        this.container.querySelectorAll('[data-queue-toggle]').forEach(btn => {
            const item = btn.closest('.attention-queue__item');
            const open = btn.dataset.queueToggle === this.expandedKey;
            btn.setAttribute('aria-expanded', String(open));
            if (item) {
                item.classList.toggle('attention-queue__item--open', open);
                const detail = item.querySelector('.attention-queue__detail');
                if (detail) detail.hidden = !open;
            }
        });
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
    module.exports = AttentionQueuePanel;
}
