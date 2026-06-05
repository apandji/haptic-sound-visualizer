/**
 * SummaryStats Component
 * Displays summary stat cards for a selected pattern.
 */
class SummaryStats {
    constructor(options = {}) {
        this.containerId = options.containerId || 'summaryStats';
        this.container = document.getElementById(this.containerId);
        if (!this.container) return;
        this.render();
    }

    render() {
        this.container.className = 'summary-stats';
        this.container.innerHTML = '';
        this.cards = {
            trials: this.createCard('--', 'Trials'),
            participants: this.createCard('--', 'Participants'),
            changedBand: this.createCard('--', 'Most Changed Band'),
            topAction: this.createCard('--', 'Top Action'),
            urgency: this.createCard('--', 'Median Urgency'),
            mood: this.createCard('--', 'Top Mood')
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
        this.cards.trials.querySelector('.summary-stats__card-value').textContent = summary.totalTrials;
        this.cards.participants.querySelector('.summary-stats__card-value').textContent = summary.uniqueParticipants;

        if (summary.mostChangedBand && summary.eegTrialCount > 0) {
            const direction = summary.mostChangedBand.avgDelta > 0 ? '+' : '';
            this.cards.changedBand.querySelector('.summary-stats__card-value').textContent =
                `${summary.mostChangedBand.band} (${direction}${(summary.mostChangedBand.avgDelta * 100).toFixed(1)}%)`;
        } else {
            this.cards.changedBand.querySelector('.summary-stats__card-value').textContent = '--';
        }

        if (summary.topAction) {
            this.cards.topAction.querySelector('.summary-stats__card-value').textContent =
                `${summary.topAction.action} (${summary.topAction.count}x)`;
        } else {
            this.cards.topAction.querySelector('.summary-stats__card-value').textContent = '--';
        }

        if (summary.medianUrgency != null && summary.surveyedCount > 0) {
            this.cards.urgency.querySelector('.summary-stats__card-value').textContent =
                summary.medianUrgency.toFixed(2);
        } else {
            this.cards.urgency.querySelector('.summary-stats__card-value').textContent = '--';
        }

        if (summary.topMood) {
            this.cards.mood.querySelector('.summary-stats__card-value').textContent = summary.topMood;
        } else {
            this.cards.mood.querySelector('.summary-stats__card-value').textContent = '--';
        }
    }

    clear() {
        this.render();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SummaryStats;
}
