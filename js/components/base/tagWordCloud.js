/**
 * TagWordCloud Component
 * CSS-based word cloud where font size reflects tag frequency.
 * Complements the TagFrequencyChart bar chart.
 */
class TagWordCloud {
    constructor(options = {}) {
        this.containerId = options.containerId || 'tagWordCloud';
        this.container = document.getElementById(this.containerId);

        if (!this.container) {
            console.error(`TagWordCloud: Container #${this.containerId} not found`);
            return;
        }

        this.render();
    }

    render() {
        this.container.classList.add('tag-word-cloud');
        this.container.innerHTML = '';

        const header = document.createElement('div');
        header.className = 'tag-word-cloud__header';
        header.textContent = 'TAG CLOUD';

        this.cloudEl = document.createElement('div');
        this.cloudEl.className = 'tag-word-cloud__cloud';

        this.container.appendChild(header);
        this.container.appendChild(this.cloudEl);
    }

    /**
     * Single pattern: display tags sized by frequency
     * @param {Array} tagFrequency - [{id, label, count, isCustom}]
     */
    update(tagFrequency) {
        if (!tagFrequency || tagFrequency.length === 0) {
            this.cloudEl.innerHTML = '<div class="tag-word-cloud__empty">No tags recorded</div>';
            return;
        }

        const maxCount = tagFrequency[0].count;
        const minCount = tagFrequency[tagFrequency.length - 1].count;

        this.cloudEl.innerHTML = '';

        // Shuffle for visual variety (but keep deterministic with a simple sort variation)
        const shuffled = [...tagFrequency].sort((a, b) => {
            const hash = (s) => s.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
            return hash(a.id) - hash(b.id);
        });

        for (const tag of shuffled) {
            const word = document.createElement('span');
            word.className = 'tag-word-cloud__word';
            if (tag.isCustom) word.classList.add('tag-word-cloud__word--custom');
            word.textContent = tag.label;

            // Scale font size: 12px (min) to 28px (max)
            const scale = maxCount === minCount ? 1 : (tag.count - minCount) / (maxCount - minCount);
            const fontSize = 12 + scale * 16;
            const opacity = 0.4 + scale * 0.6;
            word.style.fontSize = `${fontSize}px`;
            word.style.opacity = opacity;

            word.title = `${tag.label}: ${tag.count} time${tag.count !== 1 ? 's' : ''}`;

            this.cloudEl.appendChild(word);
        }
    }

    /**
     * Comparison mode: overlay tags from multiple patterns
     * @param {Array} patternsData - [{name, tagFrequency}]
     */
    updateComparison(patternsData) {
        if (!patternsData || patternsData.length === 0) return;

        const colors = typeof COMPARISON_COLORS !== 'undefined' ? COMPARISON_COLORS : ['#333', '#999', '#cc0000', '#006699'];

        // Collect all unique tags and find max count
        const tagMap = new Map();
        for (const p of patternsData) {
            if (!p.tagFrequency) continue;
            for (const tag of p.tagFrequency) {
                if (!tagMap.has(tag.id)) {
                    tagMap.set(tag.id, { id: tag.id, label: tag.label, totalCount: 0, patterns: [] });
                }
                const entry = tagMap.get(tag.id);
                entry.totalCount += tag.count;
                entry.patterns.push({ name: p.name, count: tag.count, index: patternsData.indexOf(p) });
            }
        }

        const tags = Array.from(tagMap.values()).sort((a, b) => b.totalCount - a.totalCount);
        const maxCount = tags.length > 0 ? tags[0].totalCount : 1;
        const minCount = tags.length > 0 ? tags[tags.length - 1].totalCount : 1;

        this.cloudEl.innerHTML = '';

        // Legend
        const legend = document.createElement('div');
        legend.className = 'tag-word-cloud__legend';
        patternsData.forEach((p, i) => {
            const item = document.createElement('span');
            item.className = 'tag-word-cloud__legend-item';
            const swatch = document.createElement('span');
            swatch.className = 'tag-word-cloud__legend-swatch';
            swatch.style.backgroundColor = colors[i % colors.length];
            item.appendChild(swatch);
            item.appendChild(document.createTextNode(p.name));
            legend.appendChild(item);
        });
        this.cloudEl.appendChild(legend);

        // Shuffled tags
        const shuffled = [...tags].sort((a, b) => {
            const hash = (s) => s.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
            return hash(a.id) - hash(b.id);
        });

        for (const tag of shuffled) {
            const scale = maxCount === minCount ? 1 : (tag.totalCount - minCount) / (maxCount - minCount);
            const fontSize = 12 + scale * 16;

            const word = document.createElement('span');
            word.className = 'tag-word-cloud__word';
            word.textContent = tag.label;
            word.style.fontSize = `${fontSize}px`;

            // Color based on dominant pattern
            if (tag.patterns.length === 1) {
                word.style.color = colors[tag.patterns[0].index % colors.length];
            } else {
                // Shared tag — use gradient-like dual color via border
                const sorted = [...tag.patterns].sort((a, b) => b.count - a.count);
                word.style.color = colors[sorted[0].index % colors.length];
                word.style.textDecoration = 'underline';
                word.style.textDecorationColor = colors[sorted[1].index % colors.length];
            }

            const breakdown = tag.patterns.map(p => `${p.name}: ${p.count}`).join(', ');
            word.title = `${tag.label} (${breakdown})`;

            this.cloudEl.appendChild(word);
        }
    }

    clear() {
        if (this.cloudEl) this.cloudEl.innerHTML = '';
    }

    destroy() {
        if (this.container) {
            this.container.innerHTML = '';
            this.container.classList.remove('tag-word-cloud');
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TagWordCloud;
}
