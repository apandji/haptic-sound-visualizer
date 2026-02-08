/**
 * SummaryStats Component
 * Displays a row of 4 summary stat cards for a selected pattern.
 */
class SummaryStats {
    constructor(options = {}) {
        this.containerId = options.containerId || 'summaryStats';
        this.container = document.getElementById(this.containerId);

        if (!this.container) {
            console.error(`SummaryStats: Container #${this.containerId} not found`);
            return;
        }

        this.render();
    }

    render() {
        this.container.classList.add('summary-stats');
        this.container.innerHTML = '';

        this.cards = {
            trials: this.createCard('--', 'Total Trials'),
            participants: this.createCard('--', 'Unique Participants'),
            changedBand: this.createCard('--', 'Most Changed Band'),
            commonTag: this.createCard('--', 'Most Common Tag')
        };

        Object.values(this.cards).forEach(card => this.container.appendChild(card));
    }

    createCard(value, label) {
        const card = document.createElement('div');
        card.className = 'summary-stats__card';

        const valueEl = document.createElement('div');
        valueEl.className = 'summary-stats__card-value';
        valueEl.textContent = value;

        const labelEl = document.createElement('div');
        labelEl.className = 'summary-stats__card-label';
        labelEl.textContent = label;

        card.appendChild(valueEl);
        card.appendChild(labelEl);
        return card;
    }

    update(summary) {
        if (!summary) return;

        const trialsValue = this.cards.trials.querySelector('.summary-stats__card-value');
        const participantsValue = this.cards.participants.querySelector('.summary-stats__card-value');
        const bandValue = this.cards.changedBand.querySelector('.summary-stats__card-value');
        const tagValue = this.cards.commonTag.querySelector('.summary-stats__card-value');

        trialsValue.textContent = summary.totalTrials;
        participantsValue.textContent = summary.uniqueParticipants;

        if (summary.mostChangedBand) {
            const direction = summary.mostChangedBand.avgDelta > 0 ? '+' : '';
            bandValue.textContent = `${summary.mostChangedBand.band} (${direction}${(summary.mostChangedBand.avgDelta * 100).toFixed(1)}%)`;
        } else {
            bandValue.textContent = '--';
        }

        tagValue.textContent = summary.mostCommonTag
            ? `${summary.mostCommonTag.label} (${summary.mostCommonTag.count}x)`
            : '--';
    }

    clear() {
        this.render();
    }

    destroy() {
        if (this.container) {
            this.container.innerHTML = '';
            this.container.classList.remove('summary-stats');
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SummaryStats;
}
