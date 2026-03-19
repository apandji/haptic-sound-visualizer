/**
 * TimeSeriesChart Component
 * Displays brainwave values over baseline + stimulation period.
 * Solo mode: multi-select band toggles with band colors (show/hide bands).
 * Comparison mode: single-band selector with pattern colors.
 * Vertical transition marker at t=0. Abs/rel toggle.
 * Wraps Plotly.js line chart.
 */
class TimeSeriesChart {
    constructor(options = {}) {
        this.containerId = options.containerId || 'timeSeriesChart';
        this.container = document.getElementById(this.containerId);

        if (!this.container) {
            console.error(`TimeSeriesChart: Container #${this.containerId} not found`);
            return;
        }

        this.plotDiv = null;
        this.activeBand = 'alpha'; // for comparison mode (single-select)
        this.visibleBands = new Set(['delta', 'theta', 'alpha', 'beta', 'gamma']); // for solo mode (multi-select)
        this.powerMode = 'rel'; // 'rel' or 'abs'
        this.bands = ['delta', 'theta', 'alpha', 'beta', 'gamma'];
        this.bandLabels = { delta: 'Delta', theta: 'Theta', alpha: 'Alpha', beta: 'Beta', gamma: 'Gamma' };
        this.currentData = null;
        this.currentMode = 'single'; // 'single' or 'comparison'
        this.comparisonData = null;

        this.boundHandlers = {};
        this.render();
    }

    render() {
        this.container.classList.add('time-series-chart');
        this.container.innerHTML = '';

        // Header row with label, band toggles, and power toggle
        const headerRow = document.createElement('div');
        headerRow.className = 'time-series-chart__header-row';

        const header = document.createElement('div');
        header.className = 'time-series-chart__header';
        header.textContent = 'TEMPORAL VIEW';

        const controlsRow = document.createElement('div');
        controlsRow.className = 'time-series-chart__controls';

        // Band toggles — always visible
        this.bandTogglesEl = document.createElement('div');
        this.bandTogglesEl.className = 'time-series-chart__band-toggles';

        this.boundHandlers.bandBtns = [];
        for (const band of this.bands) {
            const btn = document.createElement('button');
            btn.className = 'time-series-chart__band-btn';
            btn.textContent = this.bandLabels[band];
            btn.dataset.band = band;

            const handler = () => this._handleBandClick(band);
            btn.addEventListener('click', handler);
            this.boundHandlers.bandBtns.push({ btn, handler });

            this.bandTogglesEl.appendChild(btn);
        }

        // Power mode toggle (abs / rel)
        this.powerToggleEl = document.createElement('div');
        this.powerToggleEl.className = 'time-series-chart__power-toggle';

        this.relBtn = document.createElement('button');
        this.relBtn.className = 'time-series-chart__power-btn time-series-chart__power-btn--active';
        this.relBtn.textContent = 'REL';
        this.relBtn.title = 'Relative power (normalized)';

        this.absBtn = document.createElement('button');
        this.absBtn.className = 'time-series-chart__power-btn';
        this.absBtn.textContent = 'ABS';
        this.absBtn.title = 'Absolute power (raw)';

        this.boundHandlers.relClick = () => this.setPowerMode('rel');
        this.boundHandlers.absClick = () => this.setPowerMode('abs');
        this.relBtn.addEventListener('click', this.boundHandlers.relClick);
        this.absBtn.addEventListener('click', this.boundHandlers.absClick);

        this.powerToggleEl.appendChild(this.relBtn);
        this.powerToggleEl.appendChild(this.absBtn);

        controlsRow.appendChild(this.bandTogglesEl);
        controlsRow.appendChild(this.powerToggleEl);

        headerRow.appendChild(header);
        headerRow.appendChild(controlsRow);

        this.plotDiv = document.createElement('div');
        this.plotDiv.className = 'time-series-chart__plot';

        this.container.appendChild(headerRow);
        this.container.appendChild(this.plotDiv);

        this._updateBandButtons();
    }

    update(timeSeriesData) {
        this.currentData = timeSeriesData;
        this.currentMode = 'single';
        this._updateBandButtons();
        this._renderSingle();
    }

    updateComparison(patternsData) {
        this.comparisonData = patternsData;
        this.currentMode = 'comparison';
        this._updateBandButtons();
        this._renderComparison();
    }

    /**
     * Handle band button click — toggle visibility (solo) or select (comparison)
     */
    _handleBandClick(band) {
        if (this.currentMode === 'comparison') {
            // Single-select for comparison
            this.activeBand = band;
        } else {
            // Multi-select toggle for solo
            if (this.visibleBands.has(band)) {
                // Don't allow deselecting all bands
                if (this.visibleBands.size > 1) {
                    this.visibleBands.delete(band);
                }
            } else {
                this.visibleBands.add(band);
            }
        }

        this._updateBandButtons();

        if (this.currentMode === 'comparison' && this.comparisonData) {
            this._renderComparison();
        } else if (this.currentData) {
            this._renderSingle();
        }
    }

    setPowerMode(mode) {
        this.powerMode = mode;
        this.relBtn.classList.toggle('time-series-chart__power-btn--active', mode === 'rel');
        this.absBtn.classList.toggle('time-series-chart__power-btn--active', mode === 'abs');

        if (this.currentMode === 'comparison' && this.comparisonData) {
            this._renderComparison();
        } else if (this.currentData) {
            this._renderSingle();
        }
    }

    /**
     * Update band button appearance based on current mode
     */
    _updateBandButtons() {
        const bandColors = typeof BAND_COLORS !== 'undefined' ? BAND_COLORS : {
            delta: '#4a7eb5', theta: '#5bb5a2', alpha: '#d4a843', beta: '#d97a3e', gamma: '#c75b7a'
        };

        const btns = this.container.querySelectorAll('.time-series-chart__band-btn');
        btns.forEach(btn => {
            const band = btn.dataset.band;
            const color = bandColors[band];
            let isActive;

            if (this.currentMode === 'comparison') {
                isActive = band === this.activeBand;
            } else {
                isActive = this.visibleBands.has(band);
            }

            btn.classList.toggle('time-series-chart__band-btn--active', isActive);

            if (isActive) {
                btn.style.backgroundColor = color;
                btn.style.borderColor = color;
                btn.style.color = '#fff';
            } else {
                btn.style.backgroundColor = '';
                btn.style.borderColor = '';
                btn.style.color = '';
            }
        });
    }

    /**
     * Solo mode: visible bands with band colors + CI shading
     */
    _renderSingle() {
        if (!this.currentData) return;

        const bandColors = typeof BAND_COLORS !== 'undefined' ? BAND_COLORS : {
            delta: '#4a7eb5', theta: '#5bb5a2', alpha: '#d4a843', beta: '#d97a3e', gamma: '#c75b7a'
        };

        const suffix = `_${this.powerMode}`;
        const traces = [];

        for (const band of this.bands) {
            if (!this.visibleBands.has(band)) continue;

            const key = `${band}${suffix}`;
            const series = this.currentData[key];
            if (!series) continue;

            const times = series.map(s => s.t);
            const means = series.map(s => s.mean);
            const ciLower = series.map(s => s.ci_lower);
            const ciUpper = series.map(s => s.ci_upper);
            const color = bandColors[band] || '#333';

            // CI upper bound (invisible line)
            traces.push({
                type: 'scatter',
                x: times,
                y: ciUpper,
                mode: 'lines',
                line: { width: 0 },
                showlegend: false,
                hoverinfo: 'skip'
            });

            // CI lower bound with fill to upper
            traces.push({
                type: 'scatter',
                x: times,
                y: ciLower,
                mode: 'lines',
                line: { width: 0 },
                fill: 'tonexty',
                fillcolor: this._hexToRgba(color, 0.08),
                showlegend: false,
                hoverinfo: 'skip'
            });

            // Mean line
            traces.push({
                type: 'scatter',
                x: times,
                y: means,
                mode: 'lines',
                line: { color, width: 2 },
                name: this.bandLabels[band],
                hovertemplate: 't=%{x}s: %{y:.4f}<extra>' + this.bandLabels[band] + '</extra>'
            });
        }

        const layout = this._getLayout();
        layout.showlegend = true;
        layout.legend = { font: { size: 10 }, x: 0, y: -0.15, orientation: 'h' };
        this._addTransitionMarker(layout);

        Plotly.react(this.plotDiv, traces, layout, this._getConfig());
    }

    /**
     * Comparison mode: single band, multiple patterns with pattern colors
     */
    _renderComparison() {
        if (!this.comparisonData) return;

        const bandColors = typeof BAND_COLORS !== 'undefined' ? BAND_COLORS : {
            delta: '#4a7eb5', theta: '#5bb5a2', alpha: '#d4a843', beta: '#d97a3e', gamma: '#c75b7a'
        };
        const baseColor = bandColors[this.activeBand] || '#333';
        const n = this.comparisonData.length;
        const hasShadesFunc = typeof getBandShades === 'function';
        const shades = hasShadesFunc ? getBandShades(baseColor, n) : [baseColor];

        const suffix = `_${this.powerMode}`;
        const key = `${this.activeBand}${suffix}`;
        const traces = [];

        for (let i = 0; i < n; i++) {
            const p = this.comparisonData[i];
            if (!p.timeSeries || !p.timeSeries[key]) continue;
            const series = p.timeSeries[key];
            const color = shades[i % shades.length];

            const times = series.map(s => s.t);
            const means = series.map(s => s.mean);
            const ciLower = series.map(s => s.ci_lower);
            const ciUpper = series.map(s => s.ci_upper);

            // CI shading
            traces.push({
                type: 'scatter',
                x: times,
                y: ciUpper,
                mode: 'lines',
                line: { width: 0 },
                showlegend: false,
                hoverinfo: 'skip'
            });
            traces.push({
                type: 'scatter',
                x: times,
                y: ciLower,
                mode: 'lines',
                line: { width: 0 },
                fill: 'tonexty',
                fillcolor: this._hexToRgba(color, 0.08),
                showlegend: false,
                hoverinfo: 'skip'
            });

            // Mean line
            traces.push({
                type: 'scatter',
                x: times,
                y: means,
                mode: 'lines',
                line: { color, width: 2 },
                name: p.name,
                hovertemplate: 't=%{x}s: %{y:.4f}<extra>' + p.name + '</extra>'
            });
        }

        const layout = this._getLayout();
        layout.showlegend = true;
        layout.legend = { font: { size: 10 }, x: 0, y: -0.15, orientation: 'h' };
        this._addTransitionMarker(layout);

        Plotly.react(this.plotDiv, traces, layout, this._getConfig());
    }

    /**
     * Add vertical dashed lines and phase annotations for calibration/baseline/stimulation
     */
    _addTransitionMarker(layout) {
        const data = this.currentMode === 'comparison'
            ? (this.comparisonData && this.comparisonData[0]?.timeSeries)
            : this.currentData;

        const calDuration = data?.calibrationDuration || 0;
        const blDuration = data?.baselineDuration || 10;
        const stimDuration = data?.stimulationDuration || 30;
        const font = typeof PLOTLY_THEME !== 'undefined' ? PLOTLY_THEME.fontFamily : 'sans-serif';

        const totalStart = -(calDuration + blDuration);
        layout.xaxis.range = [totalStart, stimDuration - 1];

        layout.shapes = [];
        layout.annotations = [];

        // Transition: calibration → baseline (at -blDuration)
        if (calDuration > 0) {
            layout.shapes.push({
                type: 'line',
                x0: -blDuration, x1: -blDuration,
                y0: 0, y1: 1,
                yref: 'paper',
                line: { color: '#ddd', width: 1, dash: 'dot' }
            });

            layout.annotations.push({
                x: totalStart + calDuration / 2,
                y: 1.02,
                yref: 'paper',
                text: 'CALIBRATION',
                showarrow: false,
                font: { size: 9, color: '#ccc', family: font }
            });
        }

        // Transition: baseline → stimulation (at 0)
        layout.shapes.push({
            type: 'line',
            x0: 0, x1: 0,
            y0: 0, y1: 1,
            yref: 'paper',
            line: { color: '#ccc', width: 1, dash: 'dash' }
        });

        // Baseline label
        layout.annotations.push({
            x: -blDuration / 2,
            y: 1.02,
            yref: 'paper',
            text: 'BASELINE',
            showarrow: false,
            font: { size: 9, color: '#bbb', family: font }
        });

        // Stimulation label
        layout.annotations.push({
            x: (stimDuration - 1) / 2,
            y: 1.02,
            yref: 'paper',
            text: 'STIMULATION',
            showarrow: false,
            font: { size: 9, color: '#bbb', family: font }
        });
    }

    _getLayout() {
        const font = typeof PLOTLY_THEME !== 'undefined' ? PLOTLY_THEME.fontFamily : 'sans-serif';
        const yLabel = this.powerMode === 'abs' ? 'Absolute Power' : 'Relative Power';
        const base = typeof getPlotlyLayoutTheme === 'function' ? getPlotlyLayoutTheme({ height: 300 }) : {};
        return {
            ...base,
            font: { family: font, size: (PLOTLY_THEME && PLOTLY_THEME.fontSize) || 11, color: (PLOTLY_THEME && PLOTLY_THEME.fontColor) || '#666' },
            xaxis: {
                ...(base.xaxis || {}),
                title: { text: 'Time (seconds)', font: { size: (PLOTLY_THEME && PLOTLY_THEME.titleFontSize) || 10, family: font } },
                dtick: 5,
                gridcolor: (PLOTLY_THEME && PLOTLY_THEME.gridColor) || '#e8e8e8',
                tickfont: { size: 9, family: font }
            },
            yaxis: {
                ...(base.yaxis || {}),
                title: { text: yLabel, font: { size: (PLOTLY_THEME && PLOTLY_THEME.titleFontSize) || 10, family: font } },
                gridcolor: (PLOTLY_THEME && PLOTLY_THEME.gridColor) || '#e8e8e8',
                tickfont: { size: 9, family: font }
            }
        };
    }

    _getConfig() {
        return { displayModeBar: false, responsive: true };
    }

    _hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    clear() {
        if (this.plotDiv) {
            Plotly.purge(this.plotDiv);
        }
        this.currentData = null;
        this.comparisonData = null;
    }

    destroy() {
        this.clear();
        if (this.boundHandlers.bandBtns) {
            for (const { btn, handler } of this.boundHandlers.bandBtns) {
                btn.removeEventListener('click', handler);
            }
        }
        if (this.relBtn && this.boundHandlers.relClick) {
            this.relBtn.removeEventListener('click', this.boundHandlers.relClick);
        }
        if (this.absBtn && this.boundHandlers.absClick) {
            this.absBtn.removeEventListener('click', this.boundHandlers.absClick);
        }
        this.boundHandlers = {};
        if (this.container) {
            this.container.innerHTML = '';
            this.container.classList.remove('time-series-chart');
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TimeSeriesChart;
}
