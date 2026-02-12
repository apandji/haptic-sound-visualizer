/**
 * TagFrequencyChart Component
 * Displays tag frequency as horizontal bars. Pure DOM, no Plotly.
 */
class TagFrequencyChart {
    constructor(options = {}) {
        this.containerId = options.containerId || 'tagFrequencyChart';
        this.container = document.getElementById(this.containerId);

        if (!this.container) {
            console.error(`TagFrequencyChart: Container #${this.containerId} not found`);
            return;
        }

        this.render();
    }

    render() {
        this.container.classList.add('tag-frequency-chart');
        this.container.innerHTML = '';

        const header = document.createElement('div');
        header.className = 'tag-frequency-chart__header';
        header.textContent = 'TAG RESPONSES';

        this.listEl = document.createElement('div');
        this.listEl.className = 'tag-frequency-chart__list';

        this.container.appendChild(header);
        this.container.appendChild(this.listEl);
    }

    update(tagFrequency) {
        if (!tagFrequency || tagFrequency.length === 0) {
            this.listEl.innerHTML = '<div class="tag-frequency-chart__empty">No tags recorded</div>';
            return;
        }

        const maxCount = tagFrequency[0].count;
        this.listEl.innerHTML = '';

        for (const tag of tagFrequency) {
            const row = document.createElement('div');
            row.className = 'tag-frequency-chart__row';

            const label = document.createElement('div');
            label.className = 'tag-frequency-chart__label';
            label.textContent = tag.label;
            if (tag.isCustom) label.classList.add('tag-frequency-chart__label--custom');

            const barWrapper = document.createElement('div');
            barWrapper.className = 'tag-frequency-chart__bar-wrapper';

            const bar = document.createElement('div');
            bar.className = 'tag-frequency-chart__bar';
            bar.style.width = `${(tag.count / maxCount) * 100}%`;
            barWrapper.appendChild(bar);

            const count = document.createElement('div');
            count.className = 'tag-frequency-chart__count';
            count.textContent = tag.count;

            row.appendChild(label);
            row.appendChild(barWrapper);
            row.appendChild(count);
            this.listEl.appendChild(row);
        }
    }

    updateComparison(patternsData) {
        if (!patternsData || patternsData.length === 0) return;

        const colors = typeof COMPARISON_COLORS !== 'undefined' ? COMPARISON_COLORS : ['#333', '#999', '#cc0000', '#006699'];

        // Collect all unique tags across patterns
        const tagSet = new Map();
        for (const p of patternsData) {
            if (!p.tagFrequency) continue;
            for (const tag of p.tagFrequency) {
                if (!tagSet.has(tag.id)) {
                    tagSet.set(tag.id, { id: tag.id, label: tag.label, isCustom: tag.isCustom });
                }
            }
        }

        // Find max count for scaling
        let maxCount = 1;
        for (const p of patternsData) {
            if (!p.tagFrequency) continue;
            for (const tag of p.tagFrequency) {
                if (tag.count > maxCount) maxCount = tag.count;
            }
        }

        // Sort tags by total count across patterns
        const tags = Array.from(tagSet.values()).map(tag => {
            let total = 0;
            for (const p of patternsData) {
                if (!p.tagFrequency) continue;
                const found = p.tagFrequency.find(t => t.id === tag.id);
                if (found) total += found.count;
            }
            return { ...tag, totalCount: total };
        }).sort((a, b) => b.totalCount - a.totalCount);

        this.listEl.innerHTML = '';

        // Legend
        const legend = document.createElement('div');
        legend.className = 'tag-frequency-chart__legend';
        patternsData.forEach((p, i) => {
            const item = document.createElement('span');
            item.className = 'tag-frequency-chart__legend-item';
            const swatch = document.createElement('span');
            swatch.className = 'tag-frequency-chart__legend-swatch';
            swatch.style.backgroundColor = colors[i % colors.length];
            item.appendChild(swatch);
            item.appendChild(document.createTextNode(p.name));
            legend.appendChild(item);
        });
        this.listEl.appendChild(legend);

        for (const tag of tags) {
            const row = document.createElement('div');
            row.className = 'tag-frequency-chart__row';

            const label = document.createElement('div');
            label.className = 'tag-frequency-chart__label';
            label.textContent = tag.label;

            const barsContainer = document.createElement('div');
            barsContainer.className = 'tag-frequency-chart__bars-container';

            for (let i = 0; i < patternsData.length; i++) {
                const p = patternsData[i];
                const found = p.tagFrequency ? p.tagFrequency.find(t => t.id === tag.id) : null;
                const count = found ? found.count : 0;
                const color = colors[i % colors.length];

                const barRow = document.createElement('div');
                barRow.className = 'tag-frequency-chart__bar-row';

                const bar = document.createElement('div');
                bar.className = 'tag-frequency-chart__bar';
                bar.style.width = `${(count / maxCount) * 100}%`;
                bar.style.backgroundColor = color;

                const countEl = document.createElement('span');
                countEl.className = 'tag-frequency-chart__count tag-frequency-chart__count--inline';
                countEl.textContent = count;

                barRow.appendChild(bar);
                barRow.appendChild(countEl);
                barsContainer.appendChild(barRow);
            }

            row.appendChild(label);
            row.appendChild(barsContainer);
            this.listEl.appendChild(row);
        }
    }

    clear() {
        if (this.listEl) {
            this.listEl.innerHTML = '';
        }
    }

    destroy() {
        if (this.container) {
            this.container.innerHTML = '';
            this.container.classList.remove('tag-frequency-chart');
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TagFrequencyChart;
}
