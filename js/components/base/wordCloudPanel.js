/**
 * WordCloudPanel — at-a-glance frequency view for actions / vibes.
 *
 * Cloud mode: words sized between min and max font size by count, laid out
 * with flexbox (no Plotly). Bars mode: compact ranked CSS bars with exact
 * counts. A small segmented toggle switches between them; preference is
 * remembered per panel in localStorage.
 *
 * Input: [{ label, count }]
 */
class WordCloudPanel {
    constructor(options = {}) {
        this.containerId = options.containerId;
        this.container = document.getElementById(this.containerId);
        this.title = options.title || '';
        this.emptyText = options.emptyText || 'No responses yet.';
        this.storageKey = `analyze_v2_wordcloud_${this.containerId}`;

        if (!this.container) {
            console.error(`WordCloudPanel: Container #${this.containerId} not found`);
            return;
        }

        this.items = [];
        this.mode = this._loadMode();
        this.container.classList.add('word-cloud');
    }

    _loadMode() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            return stored === 'bars' ? 'bars' : 'cloud';
        } catch {
            return 'cloud';
        }
    }

    _saveMode() {
        try { localStorage.setItem(this.storageKey, this.mode); } catch { /* non-fatal */ }
    }

    update(items) {
        this.items = (items || [])
            .filter(item => item && item.count > 0)
            .sort((a, b) => b.count - a.count || String(a.label).localeCompare(String(b.label)));
        this.render();
    }

    render() {
        const toggle = `
            <div class="word-cloud__header">
                ${this.title ? `<span class="word-cloud__title">${this._escape(this.title)}</span>` : '<span></span>'}
                <div class="segmented-control segmented-control--sm" role="group" aria-label="${this._escape(this.title)} display mode">
                    <button type="button" class="segmented-control__item ${this.mode === 'cloud' ? 'segmented-control__item--active' : ''}" data-cloud-mode="cloud">Cloud</button>
                    <button type="button" class="segmented-control__item ${this.mode === 'bars' ? 'segmented-control__item--active' : ''}" data-cloud-mode="bars">Bars</button>
                </div>
            </div>
        `;

        const body = !this.items.length
            ? `<p class="word-cloud__empty">${this._escape(this.emptyText)}</p>`
            : (this.mode === 'cloud' ? this._cloudHtml() : this._barsHtml());

        this.container.innerHTML = toggle + body;

        this.container.querySelectorAll('[data-cloud-mode]').forEach(button => {
            button.addEventListener('click', () => {
                if (this.mode === button.dataset.cloudMode) return;
                this.mode = button.dataset.cloudMode;
                this._saveMode();
                this.render();
            });
        });
    }

    _cloudHtml() {
        const counts = this.items.map(item => item.count);
        const min = Math.min(...counts);
        const max = Math.max(...counts);
        // Interleave large and small words so big ones don't all stack left.
        const shuffled = this._interleave(this.items);

        const words = shuffled.map(item => {
            const t = max === min ? 1 : (item.count - min) / (max - min);
            const size = 0.75 + t * 1.05;            // rem: 0.75 -> 1.8
            const weight = t > 0.6 ? 600 : (t > 0.25 ? 500 : 400);
            const opacity = 0.55 + t * 0.45;
            return `<span class="word-cloud__word"
                style="font-size:${size.toFixed(2)}rem; font-weight:${weight}; opacity:${opacity.toFixed(2)}"
                title="${this._escape(item.label)} — ${item.count} response${item.count === 1 ? '' : 's'}">${this._escape(item.label)}</span>`;
        }).join('');

        return `<div class="word-cloud__cloud">${words}</div>`;
    }

    _barsHtml() {
        const max = this.items[0]?.count || 1;
        const rows = this.items.map(item => `
            <div class="word-cloud__bar-row">
                <span class="word-cloud__bar-label">${this._escape(item.label)}</span>
                <span class="word-cloud__bar-track">
                    <span class="word-cloud__bar-fill" style="width:${Math.round((item.count / max) * 100)}%"></span>
                </span>
                <span class="word-cloud__bar-count">${item.count}</span>
            </div>
        `).join('');
        return `<div class="word-cloud__bars">${rows}</div>`;
    }

    /** Largest in the middle, alternating outward — a classic cloud shape. */
    _interleave(sorted) {
        const result = [];
        sorted.forEach((item, idx) => {
            if (idx % 2 === 0) result.push(item);
            else result.unshift(item);
        });
        return result;
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
    module.exports = WordCloudPanel;
}
