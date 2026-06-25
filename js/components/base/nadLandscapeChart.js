/**
 * NadLandscapeChart — the global Urgency x Intensity map of patterns.
 *
 * One dot per pattern at its median position:
 *   - color   = assigned analyst tag (single tag -> tag color,
 *               multiple tags -> multi color, untagged -> open gray)
 *   - opacity = placement confidence (evidence x consistency); faint dots
 *               say "don't trust this placement yet"
 *   - size    = trial count (gentle sqrt scale)
 *
 * Hover a dot  -> that pattern's individual trials fade in as smaller
 *                 circles (one hierarchy level down); excluded render hollow.
 * Click a dot  -> onPatternSelect(name): navigate to the Pattern view.
 *
 * setHighlightedTag(tagId) dims patterns outside a tag cohort.
 */
class NadLandscapeChart {
    constructor(options = {}) {
        this.containerId = options.containerId || 'nadLandscapeChart';
        this.container = document.getElementById(this.containerId);
        this.onPatternSelect = options.onPatternSelect || null;
        this.onPatternHover = options.onPatternHover || null;

        if (!this.container) {
            console.error(`NadLandscapeChart: Container #${this.containerId} not found`);
            return;
        }

        this.landscape = null;
        this.tagsById = new Map();
        this.patternTags = new Map();
        this.hoveredPattern = null;
        this.highlightedTagId = null;
        this.plotDiv = null;
        this._unhoverTimer = null;
        this.render();
    }

    static multiTagColor() {
        return '#8b6fc0';
    }

    render() {
        this.container.classList.add('nad-landscape-chart');
        this.container.innerHTML = `
            <details class="nad-landscape-chart__popover">
                <summary aria-label="How to read this map" title="How to read this map">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.75"/>
                        <path d="M12 11v5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
                        <circle cx="12" cy="8" r="1" fill="currentColor"/>
                    </svg>
                </summary>
                <div class="nad-landscape-chart__popover-body">
                    <div class="nad-landscape-chart__popover-section" data-landscape-legend></div>
                    <div class="nad-landscape-chart__popover-section">
                        <span class="nad-landscape-chart__popover-label">Reading the map</span>
                        <span class="nad-landscape-chart__legend-item">Opacity = placement confidence (enough trials, consistent ratings)</span>
                        <span class="nad-landscape-chart__legend-item">Size = trial count</span>
                        <span class="nad-landscape-chart__legend-item">Hover a dot to peek at its trials · click to open the pattern</span>
                    </div>
                </div>
            </details>
            <div class="nad-landscape-chart__plot" data-landscape-plot></div>
            <div class="nad-landscape-chart__empty" data-landscape-empty hidden></div>
        `;

        this.plotDiv = this.container.querySelector('[data-landscape-plot]');
        this.emptyEl = this.container.querySelector('[data-landscape-empty]');
        this.legendEl = this.container.querySelector('[data-landscape-legend]');
    }

    /**
     * @param {object} landscape  getCorpusLandscape() result
     * @param {object} tagState   { tagsById: Map<id, {name,color}>, patternTags: Map<name, number[]> }
     */
    update(landscape, tagState = {}) {
        this.landscape = landscape;
        this.tagsById = tagState.tagsById || new Map();
        this.patternTags = tagState.patternTags || new Map();
        this._renderLegend();
        this._draw();
    }

    /** Accepts a tag id, the string 'untagged', or null to clear. */
    setHighlightedTag(tagId) {
        const normalized = tagId == null
            ? null
            : (tagId === 'untagged' ? 'untagged' : Number(tagId));
        if (this.highlightedTagId === normalized) return;
        this.highlightedTagId = normalized;
        this._draw();
    }

    _renderLegend() {
        if (!this.legendEl) return;
        const items = ['<span class="nad-landscape-chart__popover-label">Tags</span>'];
        this.tagsById.forEach(tag => {
            items.push(
                `<span class="nad-landscape-chart__legend-item"><span class="nad-landscape-chart__legend-dot" style="--dot-color:${window.AppUI?.sanitizeCssColor ? window.AppUI.sanitizeCssColor(tag.color) : '#888888'}"></span>${this._escape(tag.name)}</span>`
            );
        });
        items.push(`<span class="nad-landscape-chart__legend-item"><span class="nad-landscape-chart__legend-dot" style="--dot-color:${NadLandscapeChart.multiTagColor()}"></span>Multiple tags</span>`);
        items.push('<span class="nad-landscape-chart__legend-item"><span class="nad-landscape-chart__legend-dot nad-landscape-chart__legend-dot--open"></span>Untagged</span>');
        items.push('<span class="nad-landscape-chart__legend-item"><span class="nad-landscape-chart__legend-dot nad-landscape-chart__legend-dot--hollow"></span>Excluded trial (on hover)</span>');
        this.legendEl.innerHTML = items.join('');
    }

    _dotStyle(entry) {
        const muted = (typeof PLOTLY_THEME !== 'undefined' && PLOTLY_THEME.fontColor) || '#999';
        const tagIds = this.patternTags.get(entry.name) || [];
        const tags = tagIds.map(id => this.tagsById.get(id)).filter(Boolean);

        let color = muted;
        if (tags.length === 1) color = tags[0].color;
        else if (tags.length > 1) color = NadLandscapeChart.multiTagColor();

        return { color, open: tags.length === 0, tags };
    }

    _opacityFor(entry) {
        const confidence = entry.confidence?.value ?? 0;
        let opacity = 0.25 + 0.75 * Math.max(0, Math.min(1, confidence));

        if (this.highlightedTagId != null) {
            const tagIds = this.patternTags.get(entry.name) || [];
            const inCohort = this.highlightedTagId === 'untagged'
                ? tagIds.length === 0
                : tagIds.includes(this.highlightedTagId);
            if (!inCohort) opacity = Math.min(opacity, 0.12);
        }
        return opacity;
    }

    _mappablePatterns() {
        return (this.landscape?.patterns || []).filter(p =>
            p.surveyedCount > 0 && p.urgency.median != null && p.intensity.median != null
        );
    }

    _draw() {
        if (!this.plotDiv || !this.landscape) return;

        const patterns = this._mappablePatterns();
        if (!patterns.length) {
            Plotly.purge(this.plotDiv);
            this._plotInitialized = false;
            this.emptyEl.hidden = false;
            this.emptyEl.textContent = 'No surveyed trials under the current filters — the map needs urgency/intensity ratings.';
            return;
        }
        this.emptyEl.hidden = true;

        const theme = typeof PLOTLY_THEME !== 'undefined' ? PLOTLY_THEME : {};
        const font = theme.fontFamily || 'sans-serif';
        const styles = patterns.map(p => this._dotStyle(p));

        const patternTrace = {
            type: 'scatter',
            mode: 'markers',
            x: patterns.map(p => p.urgency.median),
            y: patterns.map(p => p.intensity.median),
            customdata: patterns.map(p => p.name),
            marker: {
                size: patterns.map(p => 10 + Math.sqrt(p.trialCount) * 3.5),
                color: styles.map((s, idx) => {
                    const alpha = this._opacityFor(patterns[idx]);
                    return s.open ? 'rgba(0,0,0,0)' : this._hexToRgba(s.color, alpha);
                }),
                line: {
                    color: styles.map((s, idx) => {
                        const opacity = this._opacityFor(patterns[idx]);
                        // Keep faint dots readable via their outline, but let
                        // cohort dimming (opacity ~0.12) actually dim them.
                        const alpha = opacity < 0.2 ? opacity : Math.max(opacity, 0.35);
                        const base = patterns[idx].name === this.hoveredPattern
                            ? (theme.seriesLineColor || '#333')
                            : s.color;
                        return base.startsWith('#') ? this._hexToRgba(base, alpha) : base;
                    }),
                    width: patterns.map(p => (p.name === this.hoveredPattern ? 3 : 2))
                }
            },
            hovertemplate: patterns.map((p, idx) => this._patternHover(p, styles[idx]) + '<extra></extra>')
        };

        // Trial peek: only populated while a pattern dot is hovered.
        const hovered = this.hoveredPattern
            ? patterns.find(p => p.name === this.hoveredPattern) || null
            : null;
        const peekPoints = hovered ? (hovered.trialPoints || []) : [];
        const hoveredStyle = hovered ? this._dotStyle(hovered) : null;
        const peekColor = hoveredStyle && !hoveredStyle.open
            ? hoveredStyle.color
            : (theme.fontColor || '#888');

        const peekTrace = {
            type: 'scatter',
            mode: 'markers',
            x: peekPoints.map(t => t.urgency),
            y: peekPoints.map(t => t.intensity),
            customdata: peekPoints.map(() => hovered ? hovered.name : ''),
            marker: {
                size: 7,
                color: peekPoints.map(t => (t.excluded ? 'rgba(0,0,0,0)' : this._hexToRgba(peekColor, 0.75))),
                line: {
                    color: this._hexToRgba(peekColor, 0.85),
                    width: 1.25
                }
            },
            hovertemplate: peekPoints.map(t => this._trialHover(t, hovered) + '<extra></extra>')
        };

        const layout = {
            font: { family: font, size: theme.fontSize || 11, color: theme.fontColor || '#666' },
            paper_bgcolor: theme.paperBg || 'transparent',
            plot_bgcolor: theme.plotBg || 'transparent',
            margin: { l: 55, r: 16, t: 12, b: 48 },
            showlegend: false,
            height: 520,
            hovermode: 'closest',
            xaxis: {
                title: { text: 'Urgency (median)', font: { size: theme.titleFontSize || 10, family: font, color: theme.fontColor || '#666' } },
                range: [-0.04, 1.04],
                gridcolor: theme.gridColor || '#e8e8e8',
                zeroline: false,
                fixedrange: true,
                tickfont: { size: 9, family: font, color: theme.fontColor || '#666' }
            },
            yaxis: {
                title: { text: 'Intensity (median)', font: { size: theme.titleFontSize || 10, family: font, color: theme.fontColor || '#666' } },
                range: [-0.04, 1.04],
                gridcolor: theme.gridColor || '#e8e8e8',
                zeroline: false,
                fixedrange: true,
                tickfont: { size: 9, family: font, color: theme.fontColor || '#666' }
            },
            shapes: this._cornerTints(),
            annotations: this._cornerLabels(font)
        };

        Plotly.react(this.plotDiv, [patternTrace, peekTrace], layout, {
            displayModeBar: false,
            responsive: true
        });

        if (!this._plotInitialized) {
            this._plotInitialized = true;
            this._bindPlotEvents();
        }
    }

    _bindPlotEvents() {
        this.plotDiv.on('plotly_click', (event) => {
            const point = event?.points?.[0];
            if (!point || !this.onPatternSelect) return;
            // Both pattern dots and peeked trial dots navigate to the pattern.
            if (point.customdata) this.onPatternSelect(point.customdata);
        });

        this.plotDiv.on('plotly_hover', (event) => {
            const point = event?.points?.[0];
            if (!point) return;
            if (this._unhoverTimer) {
                clearTimeout(this._unhoverTimer);
                this._unhoverTimer = null;
            }
            // Hovering a peek dot keeps its parent pattern's peek alive.
            const name = point.customdata;
            if (point.curveNumber === 0 && name && name !== this.hoveredPattern) {
                this.hoveredPattern = name;
                this._draw();
                if (this.onPatternHover) this.onPatternHover(name);
            }
        });

        this.plotDiv.on('plotly_unhover', () => {
            // Grace period so the peek survives the cursor moving from the
            // pattern dot onto one of its trial dots.
            if (this._unhoverTimer) clearTimeout(this._unhoverTimer);
            this._unhoverTimer = setTimeout(() => {
                this._unhoverTimer = null;
                if (!this.hoveredPattern) return;
                this.hoveredPattern = null;
                this._draw();
                if (this.onPatternHover) this.onPatternHover(null);
            }, 140);
        });
    }

    _cornerTints() {
        const tint = (x0, y0, x1, y1, color) => ({
            type: 'rect', xref: 'x', yref: 'y',
            x0, y0, x1, y1,
            fillcolor: this._hexToRgba(color, 0.04),
            line: { width: 0 },
            layer: 'below'
        });
        return [
            tint(-0.04, -0.04, 0.32, 0.32, '#5bb5a2'),
            tint(0.68, 0.68, 1.04, 1.04, '#c75b7a')
        ];
    }

    _cornerLabels(font) {
        const note = (x, y, text, color) => ({
            x, y, xref: 'x', yref: 'y',
            text,
            showarrow: false,
            font: { size: 9, family: font, color: this._hexToRgba(color, 0.4) }
        });
        return [
            note(0.14, 0.015, 'CALMER', '#5bb5a2'),
            note(0.86, 0.99, 'MORE DEMANDING', '#c75b7a')
        ];
    }

    _patternHover(entry, style) {
        const confidence = entry.confidence || {};
        const lines = [
            `<b>${entry.name}</b>`,
            `${entry.trialCount} trial${entry.trialCount === 1 ? '' : 's'} · ${entry.surveyedCount} surveyed · ${entry.participantCount} participant${entry.participantCount === 1 ? '' : 's'}`,
            `Urgency ${entry.urgency.median.toFixed(2)} (IQR ${entry.urgency.q1.toFixed(2)}–${entry.urgency.q3.toFixed(2)})`,
            `Intensity ${entry.intensity.median.toFixed(2)} (IQR ${entry.intensity.q1.toFixed(2)}–${entry.intensity.q3.toFixed(2)})`,
            `Placement confidence ${(Math.round((confidence.value ?? 0) * 100))}%`
        ];
        if (style.tags.length) {
            lines.push(`Tags: ${style.tags.map(t => this._escape(t.name)).join(' + ')}`);
        } else {
            lines.push('Untagged — click to classify');
        }
        return lines.join('<br>');
    }

    _trialHover(trial, pattern) {
        const lines = [
            `<b>${pattern.name} · trial #${trial.trialOrder ?? trial.dbTrialId}</b>`,
            `${trial.participantCode || 'Unknown'} · ${String(trial.startTime || '').slice(0, 10)}`,
            `Urgency ${Number(trial.urgency).toFixed(2)} · Intensity ${Number(trial.intensity).toFixed(2)}`
        ];
        if (trial.excluded) lines.push('Excluded from analysis');
        return lines.join('<br>');
    }

    _hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    _escape(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    clear() {
        if (this.plotDiv) {
            Plotly.purge(this.plotDiv);
            this._plotInitialized = false;
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = NadLandscapeChart;
}
