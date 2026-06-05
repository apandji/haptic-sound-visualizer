/**
 * SubjectiveProfilePanel — scales and bento-style categorical survey readouts.
 */
class SubjectiveProfilePanel {
    constructor(options = {}) {
        this.scalesEl = document.getElementById(options.scalesId || 'subjectiveScales');
        this.gridEl = document.getElementById(options.gridId || 'subjectiveGrid');
        this.bentoHintEl = document.getElementById(options.bentoHintId || 'subjectiveBentoHint');
        this.bentoLegendEl = document.getElementById(options.bentoLegendId || 'subjectiveBentoLegend');
        this.directionEl = document.getElementById(options.directionId || 'subjectiveDirection');
        this.directionSection = document.getElementById(options.directionSectionId || 'subjectiveDirectionSection');
        this.emotionEl = document.getElementById(options.emotionId || 'subjectiveEmotion');
        this.emotionSection = document.getElementById(options.emotionSectionId || 'subjectiveEmotionSection');
        this.textureEl = document.getElementById(options.textureId || 'subjectiveTexture');
        this.textureSection = document.getElementById(options.textureSectionId || 'subjectiveTextureSection');
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
        [this.directionEl, this.emotionEl, this.textureEl, this.bentoLegendEl].forEach(el => {
            if (el) el.innerHTML = '';
        });
        [this.bentoHintEl, this.bentoLegendEl, this.directionSection, this.textureSection, this.emotionSection]
            .forEach(el => {
                if (el) el.hidden = true;
            });
        if (this.gridEl) this.gridEl.classList.remove('subjective-grid--no-direction');
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
        const textureRows = subjective.textureRows || [];
        const directionVisible = subjective.directionVisible;
        const directionRows = directionVisible ? (subjective.direction || []) : [];

        const hasBento = surveyedCount > 0 && (
            emotion.length > 0 || textureRows.length > 0 || directionRows.length > 0
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
            this.gridEl.classList.toggle('subjective-grid--no-direction', !directionVisible);
        }

        if (this.directionSection) {
            if (directionVisible) {
                this.directionSection.hidden = false;
                this._renderHeatmapPanel(
                    this.directionEl,
                    directionRows,
                    'direction',
                    'No direction responses yet.',
                    surveyedCount
                );
            } else {
                this.directionSection.hidden = true;
                if (this.directionEl) this.directionEl.innerHTML = '';
            }
        }

        if (this.textureSection) {
            this.textureSection.hidden = false;
            this._renderHeatmapPanel(
                this.textureEl,
                textureRows,
                'texture',
                'No texture responses yet.',
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
