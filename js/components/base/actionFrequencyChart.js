/**
 * ActionFrequencyChart — structured survey action counts.
 */
class ActionFrequencyChart {
    constructor(options = {}) {
        this.containerId = options.containerId || 'actionFrequencyChart';
        this.container = document.getElementById(this.containerId);
        if (!this.container) return;
        this.render();
    }

    render() {
        this.container.className = 'action-frequency-chart';
        this.container.innerHTML = '<div class="action-frequency-chart__empty">No action responses yet.</div>';
    }

    update(actionFrequency) {
        if (!actionFrequency || actionFrequency.length === 0) {
            this.render();
            return;
        }

        const max = Math.max(...actionFrequency.map(entry => entry.count), 1);
        this.container.innerHTML = actionFrequency.map(entry => {
            const width = Math.round((entry.count / max) * 100);
            return `
                <div class="action-frequency-chart__row">
                    <div class="action-frequency-chart__label">${entry.action}${entry.isCustom ? ' (custom)' : ''}</div>
                    <div class="action-frequency-chart__bar-wrap">
                        <div class="action-frequency-chart__bar" style="width:${width}%"></div>
                    </div>
                    <div class="action-frequency-chart__count">${entry.count}</div>
                </div>
            `;
        }).join('');
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ActionFrequencyChart;
}
