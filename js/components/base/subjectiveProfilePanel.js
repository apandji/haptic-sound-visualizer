/**
 * SubjectiveProfilePanel — scales and bento-style categorical survey readouts.
 */
class SubjectiveProfilePanel {
    constructor(options = {}) {
        this.scalesEl = document.getElementById(options.scalesId || 'subjectiveScales');
        this.gridEl = document.getElementById(options.gridId || 'subjectiveGrid');
        this.bentoHintEl = document.getElementById(options.bentoHintId || 'subjectiveBentoHint');
        this.bentoLegendEl = document.getElementById(options.bentoLegendId || 'subjectiveBentoLegend');
        this.binaryEl = document.getElementById(options.binaryId || 'subjectiveBinary');
        this.binarySection = document.getElementById(options.binarySectionId || 'subjectiveBinarySection');
        this.emotionEl = document.getElementById(options.emotionId || 'subjectiveEmotion');
        this.emotionSection = document.getElementById(options.emotionSectionId || 'subjectiveEmotionSection');
        this.vibesEl = document.getElementById(options.vibesId || 'subjectiveVibes');
        this.vibesSection = document.getElementById(options.vibesSectionId || 'subjectiveVibesSection');
    }

    update(subjective = null) {
        if (!subjective) {
            this._clear();
            return;
        }

        this._renderScales(subjective.scales || {});
        this._renderBento(subjective);
    }

    _clear() {
        if (this.scalesEl) this.scalesEl.innerHTML = '';
        [this.binaryEl, this.emotionEl, this.vibesEl, this.bentoLegendEl].forEach(el => {
            if (el) el.innerHTML = '';
        });
        [this.bentoHintEl, this.bentoLegendEl, this.binarySection, this.vibesSection, this.emotionSection]
            .forEach(el => {
                if (el) el.hidden = true;
            });
        if (this.gridEl) this.gridEl.classList.remove('subjective-grid--no-binary');
    }

    _heatmapLegend() {
        return `
            <div class="survey-heatmap__legend" aria-hidden="true">
                <span class="survey-heatmap__legend-end">Less</span>
                <div class="survey-heatmap__legend-scale"></div>
                <span class="survey-heatmap__legend-end">More</span>
            </div>
        `;
    }

    _heatmapCell(option) {
        const intensity = option.pct || 0;
        const lightText = intensity >= 40;
        const zero = intensity === 0;

        return `
            <td class="survey-heatmap__cell ${zero ? 'survey-heatmap__cell--zero' : ''} ${lightText ? 'survey-heatmap__cell--light' : ''}"
                style="--intensity:${intensity}"
                title="${option.label}: ${option.count} (${intensity}%)">
                <span class="survey-heatmap__cell-label">${option.label}</span>
                <span class="survey-heatmap__cell-value">${zero ? '—' : `${intensity}%`}</span>
            </td>
        `;
    }

    _heatmapTableHtml(rows, variant) {
        if (!rows.length) return '';

        return `
            <div class="survey-heatmap survey-heatmap--${variant}">
                <div class="survey-heatmap__scroll">
                    <table class="survey-heatmap__table">
                        <tbody>
                            ${rows.map(row => `
                                <tr>
                                    <th class="survey-heatmap__facet" scope="row">${row.label}</th>
                                    ${row.options.map(option => this._heatmapCell(option)).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    _renderHeatmapPanel(containerEl, rows, variant, emptyMessage, surveyedCount) {
        if (!containerEl) return false;

        if (!surveyedCount || !rows.length) {
            containerEl.innerHTML = `<div class="subjective-panel__empty">${emptyMessage}</div>`;
            return false;
        }

        containerEl.innerHTML = this._heatmapTableHtml(rows, variant);
        return true;
    }

    _renderScales(scales) {
        if (!this.scalesEl) return;

        const fields = [
            { key: 'urgency', label: 'Urgency' },
            { key: 'intensity', label: 'Intensity' },
            { key: 'confidence', label: 'Confidence' }
        ];

        this.scalesEl.innerHTML = fields.map(({ key, label }) => {
            const stat = scales[key] || { values: [], median: null, min: null, max: null };
            if (!stat.values.length) {
                return `
                    <div class="subjective-scales__card">
                        <div class="subjective-scales__label">${label}</div>
                        <div class="subjective-scales__median">—</div>
                        <div class="subjective-scales__track subjective-scales__track--empty"></div>
                    </div>
                `;
            }

            const minPct = stat.min * 100;
            const maxPct = stat.max * 100;
            const medianPct = stat.median * 100;
            const rangeLeft = minPct;
            const rangeWidth = Math.max(maxPct - minPct, 2);

            return `
                <div class="subjective-scales__card">
                    <div class="subjective-scales__label">${label}</div>
                    <div class="subjective-scales__median">${stat.median.toFixed(2)}</div>
                    <div class="subjective-scales__track">
                        <div class="subjective-scales__range" style="left:${rangeLeft}%; width:${rangeWidth}%"></div>
                        <div class="subjective-scales__dot" style="left:${medianPct}%"></div>
                    </div>
                    <div class="subjective-scales__hint">${stat.min.toFixed(2)} – ${stat.max.toFixed(2)}</div>
                </div>
            `;
        }).join('');
    }

    _renderBento(subjective) {
        const surveyedCount = subjective.surveyedCount || 0;
        const emotion = subjective.emotion || [];
        const vibeRows = subjective.vibeRows || [];
        const binaryVisible = subjective.binaryVisible;
        const binaryRows = binaryVisible ? (subjective.binaryRows || []) : [];

        const hasBento = surveyedCount > 0 && (
            emotion.length > 0 || vibeRows.length > 0 || binaryRows.length > 0
        );

        if (!hasBento) {
            this._clear();
            return;
        }

        if (this.bentoHintEl) this.bentoHintEl.hidden = false;

        if (this.bentoLegendEl) {
            this.bentoLegendEl.hidden = false;
            this.bentoLegendEl.innerHTML = this._heatmapLegend();
        }

        if (this.gridEl) {
            this.gridEl.classList.toggle('subjective-grid--no-binary', !binaryVisible);
        }

        if (this.binarySection) {
            if (binaryVisible) {
                this.binarySection.hidden = false;
                this._renderHeatmapPanel(
                    this.binaryEl,
                    binaryRows,
                    'binary',
                    'No binary action responses yet.',
                    surveyedCount
                );
            } else {
                this.binarySection.hidden = true;
                if (this.binaryEl) this.binaryEl.innerHTML = '';
            }
        }

        if (this.vibesSection) {
            this.vibesSection.hidden = false;
            this._renderHeatmapPanel(
                this.vibesEl,
                vibeRows,
                'vibes',
                'No vibe responses yet.',
                surveyedCount
            );
        }

        if (this.emotionSection) {
            this.emotionSection.hidden = false;
            this._renderHeatmapPanel(
                this.emotionEl,
                emotion,
                'emotion',
                'No emotion responses yet.',
                surveyedCount
            );
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SubjectiveProfilePanel;
}
