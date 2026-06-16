/**
 * TagCohortsPanel — tag filter chips that live directly on the map panel.
 *
 * One chip per analyst tag with its pattern count, plus an "Untagged" chip.
 * Clicking a chip highlights that cohort on the map and dims everything
 * else (toggle off by clicking again). The parent wires onHighlightTag to
 * NadLandscapeChart.setHighlightedTag.
 */
class TagCohortsPanel {
    static UNTAGGED = 'untagged';

    constructor(options = {}) {
        this.containerId = options.containerId || 'tagCohortsPanel';
        this.container = document.getElementById(this.containerId);
        this.onHighlightTag = options.onHighlightTag || null;

        if (!this.container) {
            console.error(`TagCohortsPanel: Container #${this.containerId} not found`);
            return;
        }

        this.activeTagId = null;
        this.container.classList.add('tag-cohorts');
        this.container.addEventListener('click', (event) => {
            const chip = event.target.closest('[data-cohort-tag]');
            if (!chip) return;
            const raw = chip.dataset.cohortTag;
            const tagId = raw === TagCohortsPanel.UNTAGGED ? TagCohortsPanel.UNTAGGED : Number(raw);
            this.activeTagId = (this.activeTagId === tagId) ? null : tagId;
            this._syncActive();
            if (this.onHighlightTag) this.onHighlightTag(this.activeTagId);
        });
    }

    /**
     * @param {Array} tags            [{id, name, color, isDefault}]
     * @param {Map}   patternTags     Map<patternName, number[]>
     * @param {number} mappableCount  patterns visible on the map
     */
    update(tags, patternTags, mappableCount) {
        this.tags = tags || [];
        const counts = new Map();
        let taggedCount = 0;
        (patternTags || new Map()).forEach(tagIds => {
            if (tagIds.length) taggedCount += 1;
            tagIds.forEach(id => counts.set(id, (counts.get(id) || 0) + 1));
        });
        const untagged = Math.max(0, (mappableCount || 0) - taggedCount);

        const chips = this.tags.map(tag => `
            <button type="button" class="tag-cohorts__chip" data-cohort-tag="${tag.id}"
                style="--chip-color:${tag.color}"
                title="Highlight ${this._escape(tag.name)} patterns on the map">
                <span class="tag-cohorts__dot"></span>
                <span class="tag-cohorts__name">${this._escape(tag.name)}</span>
                <span class="tag-cohorts__count">${counts.get(tag.id) || 0}</span>
            </button>
        `);

        chips.push(`
            <button type="button" class="tag-cohorts__chip tag-cohorts__chip--untagged" data-cohort-tag="${TagCohortsPanel.UNTAGGED}"
                title="Highlight patterns that still need a classification">
                <span class="tag-cohorts__dot tag-cohorts__dot--open"></span>
                <span class="tag-cohorts__name">Untagged</span>
                <span class="tag-cohorts__count">${untagged}</span>
            </button>
        `);

        this.container.innerHTML = `<div class="tag-cohorts__chips">${chips.join('')}</div>`;
        this._syncActive();
    }

    _syncActive() {
        this.container.querySelectorAll('[data-cohort-tag]').forEach(chip => {
            const raw = chip.dataset.cohortTag;
            const tagId = raw === TagCohortsPanel.UNTAGGED ? TagCohortsPanel.UNTAGGED : Number(raw);
            chip.classList.toggle('tag-cohorts__chip--active', this.activeTagId != null && tagId === this.activeTagId);
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
    module.exports = TagCohortsPanel;
}
