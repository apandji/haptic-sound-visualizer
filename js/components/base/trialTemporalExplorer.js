/**
 * TrialTemporalExplorer — per-trial deep dive under the aggregate
 * Temporal View. One small-multiple brainwave chart per trial, so
 * single-trial dynamics aren't washed out by the pattern average.
 *
 * Two view modes:
 *   - Grid: small multiples, one chart per trial, multi-band.
 *   - Overlay: every trial on one chart (one line per trial, single band
 *     at a time); legend clicks toggle individual trials on/off.
 *
 * Controls:
 *   - view mode toggle (Grid / Overlay)
 *   - participant chips (multi-select: hide/show each participant's trials)
 *   - band toggles (multi-select in Grid, single-select in Overlay)
 *   - REL/ABS power mode
 *
 * Grid charts share one x-range and one y-range so trials are directly
 * comparable. Collapsed by default; charts only plot while expanded
 * (Plotly can't size itself in hidden containers).
 */
class TrialTemporalExplorer {
    constructor(options = {}) {
        this.containerId = options.containerId || 'trialTemporalExplorer';
        this.container = document.getElementById(this.containerId);
        this.onTrialOpen = options.onTrialOpen || null; // (dbTrialId) => void

        if (!this.container) {
            console.error(`TrialTemporalExplorer: Container #${this.containerId} not found`);
            return;
        }

        this.bands = ['delta', 'theta', 'alpha', 'beta', 'gamma'];
        this.bandLabels = { delta: 'Delta', theta: 'Theta', alpha: 'Alpha', beta: 'Beta', gamma: 'Gamma' };

        this.trials = [];             // [{dbTrialId, participantCode, trialOrder, sessionDate, timeSeries}]
        this.expanded = false;
        this.viewMode = 'grid';       // 'grid' | 'overlay'
        this.visibleBands = new Set(this.bands);
        this.activeBand = 'alpha';    // overlay mode (single-select)
        this.hiddenParticipants = new Set();
        this.hiddenTrials = new Set();// overlay legend toggles (dbTrialId strings)
        this.powerMode = 'rel';       // 'rel' | 'abs'
        this.plotDivs = [];

        this.container.classList.add('trial-temporal');
    }

    update(trials) {
        this.trials = trials || [];

        // Drop stale participant/trial hides (e.g. filters or pattern changed).
        const codes = new Set(this.trials.map(t => t.participantCode));
        for (const hidden of [...this.hiddenParticipants]) {
            if (!codes.has(hidden)) this.hiddenParticipants.delete(hidden);
        }
        const ids = new Set(this.trials.map(t => String(t.dbTrialId)));
        for (const hidden of [...this.hiddenTrials]) {
            if (!ids.has(hidden)) this.hiddenTrials.delete(hidden);
        }

        if (!this.trials.length) {
            this.clear();
            return;
        }
        this._renderShell();
        if (this.expanded) this._renderBody();
    }

    clear() {
        this._purgePlots();
        this.trials = [];
        this.container.innerHTML = '';
    }

    _renderShell() {
        this._purgePlots();
        const count = this.trials.length;
        this.container.innerHTML = `
            <button type="button" class="trial-temporal__toggle" data-tt-toggle aria-expanded="${this.expanded}">
                <span class="trial-temporal__toggle-chevron" aria-hidden="true">${this.expanded ? '▾' : '▸'}</span>
                Per-trial temporal view
                <span class="trial-temporal__toggle-meta">${count} trial${count === 1 ? '' : 's'} with EEG</span>
            </button>
            <div class="trial-temporal__body" data-tt-body ${this.expanded ? '' : 'hidden'}></div>
        `;

        this.container.querySelector('[data-tt-toggle]').addEventListener('click', () => {
            this.expanded = !this.expanded;
            this._renderShell();
            if (this.expanded) this._renderBody();
        });
    }

    _participants() {
        const seen = new Map();
        for (const trial of this.trials) {
            if (!seen.has(trial.participantCode)) {
                seen.set(trial.participantCode, 0);
            }
            seen.set(trial.participantCode, seen.get(trial.participantCode) + 1);
        }
        return [...seen.entries()].map(([code, trialCount]) => ({ code, trialCount }));
    }

    _visibleTrials() {
        return this.trials.filter(t => !this.hiddenParticipants.has(t.participantCode));
    }

    _renderBody() {
        const body = this.container.querySelector('[data-tt-body]');
        if (!body) return;
        this._purgePlots();

        const participants = this._participants();
        const visible = this._visibleTrials();

        const participantChips = participants.map(({ code, trialCount }) => {
            const active = !this.hiddenParticipants.has(code);
            return `<button type="button" class="trial-temporal__chip ${active ? 'trial-temporal__chip--active' : ''}"
                data-tt-participant="${this._escape(code)}" aria-pressed="${active}"
                title="${active ? 'Hide' : 'Show'} ${this._escape(code)}">${this._escape(code)}<span class="trial-temporal__chip-count">${trialCount}</span></button>`;
        }).join('');

        const isOverlay = this.viewMode === 'overlay';
        const bandColors = this._bandColors();
        const bandChips = this.bands.map(band => {
            const active = isOverlay ? band === this.activeBand : this.visibleBands.has(band);
            const color = bandColors[band];
            return `<button type="button" class="trial-temporal__chip trial-temporal__chip--band ${active ? 'trial-temporal__chip--active' : ''}"
                data-tt-band="${band}" aria-pressed="${active}"
                style="${active ? `background:${color};border-color:${color};color:#fff;` : ''}">${this.bandLabels[band]}</button>`;
        }).join('');

        let chartsHtml;
        if (!visible.length) {
            chartsHtml = '<div class="trial-temporal__empty">All participants are hidden — turn one back on to see trials.</div>';
        } else if (isOverlay) {
            chartsHtml = `
                <div class="trial-temporal__overlay">
                    <div class="trial-temporal__overlay-plot" data-tt-overlay></div>
                    <p class="trial-temporal__hint">Click a trial in the legend to toggle it · double-click to isolate it.</p>
                </div>
            `;
        } else {
            chartsHtml = `<div class="trial-temporal__grid">${visible.map((trial, index) => `
                <figure class="trial-temporal__cell ${trial.excludeFromAnalysis ? 'trial-temporal__cell--excluded' : ''}">
                    <figcaption class="trial-temporal__cell-caption">
                        <span class="trial-temporal__cell-title font-mono">${this._escape(trial.participantCode)} · #${trial.trialOrder ?? '—'}</span>
                        <span class="trial-temporal__cell-meta">${this._formatDate(trial.sessionDate)}${trial.excludeFromAnalysis ? ' · excluded' : ''}</span>
                        ${this.onTrialOpen ? `<button type="button" class="trial-temporal__cell-open" data-tt-open="${String(trial.dbTrialId)}">view trial</button>` : ''}
                    </figcaption>
                    <div class="trial-temporal__plot" data-tt-plot="${index}"></div>
                </figure>`).join('')}</div>`;
        }

        body.innerHTML = `
            <div class="trial-temporal__controls">
                <div class="trial-temporal__control-group trial-temporal__control-group--mode">
                    <span class="trial-temporal__control-label">View</span>
                    <div class="trial-temporal__mode-toggle">
                        <button type="button" class="trial-temporal__power-btn ${!isOverlay ? 'trial-temporal__power-btn--active' : ''}" data-tt-mode="grid" title="One chart per trial">Grid</button>
                        <button type="button" class="trial-temporal__power-btn ${isOverlay ? 'trial-temporal__power-btn--active' : ''}" data-tt-mode="overlay" title="All trials on one chart">Overlay</button>
                    </div>
                </div>
                <div class="trial-temporal__control-group">
                    <span class="trial-temporal__control-label">Participants</span>
                    <div class="trial-temporal__chips">${participantChips}</div>
                </div>
                <div class="trial-temporal__control-group">
                    <span class="trial-temporal__control-label">Brain waves${isOverlay ? ' (one at a time)' : ''}</span>
                    <div class="trial-temporal__chips">${bandChips}</div>
                </div>
                <div class="trial-temporal__control-group trial-temporal__control-group--power">
                    <button type="button" class="trial-temporal__power-btn ${this.powerMode === 'rel' ? 'trial-temporal__power-btn--active' : ''}" data-tt-power="rel" title="Relative power (normalized)">REL</button>
                    <button type="button" class="trial-temporal__power-btn ${this.powerMode === 'abs' ? 'trial-temporal__power-btn--active' : ''}" data-tt-power="abs" title="Absolute power (raw)">ABS</button>
                </div>
            </div>
            ${chartsHtml}
        `;

        this._bindControls(body);
        if (isOverlay) {
            this._plotOverlay(body, visible);
        } else {
            this._plotAll(body, visible);
        }
    }

    _bindControls(body) {
        body.querySelectorAll('[data-tt-participant]').forEach(chip => {
            chip.addEventListener('click', () => {
                const code = chip.dataset.ttParticipant;
                if (this.hiddenParticipants.has(code)) {
                    this.hiddenParticipants.delete(code);
                } else {
                    this.hiddenParticipants.add(code);
                }
                this._renderBody();
            });
        });

        body.querySelectorAll('[data-tt-mode]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (this.viewMode === btn.dataset.ttMode) return;
                this.viewMode = btn.dataset.ttMode;
                // Entering overlay: carry over a sensible single band.
                if (this.viewMode === 'overlay' && !this.visibleBands.has(this.activeBand)) {
                    this.activeBand = [...this.visibleBands][0] || 'alpha';
                }
                this._renderBody();
            });
        });

        body.querySelectorAll('[data-tt-band]').forEach(chip => {
            chip.addEventListener('click', () => {
                const band = chip.dataset.ttBand;
                if (this.viewMode === 'overlay') {
                    // Single-select: one band across all overlaid trials.
                    this.activeBand = band;
                } else if (this.visibleBands.has(band)) {
                    // Keep at least one band visible.
                    if (this.visibleBands.size > 1) this.visibleBands.delete(band);
                } else {
                    this.visibleBands.add(band);
                }
                this._renderBody();
            });
        });

        body.querySelectorAll('[data-tt-power]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.powerMode = btn.dataset.ttPower;
                this._renderBody();
            });
        });

        body.querySelectorAll('[data-tt-open]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (this.onTrialOpen) this.onTrialOpen(btn.dataset.ttOpen);
            });
        });
    }

    /**
     * Shared axes across all visible charts: one x-range (longest
     * baseline/stimulation) and one y-range (min/max over visible bands),
     * so differences between trials are real, not autoscale artifacts.
     */
    _sharedRanges(visible) {
        const suffix = `_${this.powerMode}`;
        let maxBaseline = 0;
        let maxStimulation = 0;
        let yMin = Infinity;
        let yMax = -Infinity;

        for (const trial of visible) {
            const ts = trial.timeSeries || {};
            maxBaseline = Math.max(maxBaseline, ts.baselineDuration || 0);
            maxStimulation = Math.max(maxStimulation, ts.stimulationDuration || 0);
            for (const band of this.bands) {
                if (!this.visibleBands.has(band)) continue;
                for (const point of ts[`${band}${suffix}`] || []) {
                    if (point.mean == null) continue;
                    if (point.mean < yMin) yMin = point.mean;
                    if (point.mean > yMax) yMax = point.mean;
                }
            }
        }

        if (!Number.isFinite(yMin)) { yMin = 0; yMax = 1; }
        const pad = (yMax - yMin || 1) * 0.08;
        return {
            x: [-(maxBaseline || 10), (maxStimulation || 30) - 1],
            y: [yMin - pad, yMax + pad]
        };
    }

    _plotAll(body, visible) {
        if (typeof Plotly === 'undefined') return;
        const ranges = this._sharedRanges(visible);
        const bandColors = this._bandColors();
        const suffix = `_${this.powerMode}`;

        visible.forEach((trial, index) => {
            const plotDiv = body.querySelector(`[data-tt-plot="${index}"]`);
            if (!plotDiv) return;

            const traces = [];
            for (const band of this.bands) {
                if (!this.visibleBands.has(band)) continue;
                const series = (trial.timeSeries || {})[`${band}${suffix}`];
                if (!series || !series.length) continue;
                traces.push({
                    type: 'scatter',
                    x: series.map(p => p.t),
                    y: series.map(p => p.mean),
                    mode: 'lines',
                    line: { color: bandColors[band], width: 1.5 },
                    name: this.bandLabels[band],
                    connectgaps: false,
                    hovertemplate: 't=%{x}s: %{y:.4f}<extra>' + this.bandLabels[band] + '</extra>'
                });
            }

            Plotly.react(plotDiv, traces, this._cellLayout(ranges), {
                displayModeBar: false,
                responsive: true
            });
            this.plotDivs.push(plotDiv);
        });
    }

    /**
     * Overlay mode: one chart, one line per trial for the active band.
     * Plotly's legend handles per-trial toggling (click) and isolation
     * (double-click); we mirror that state into hiddenTrials so it
     * survives re-renders (band/power switches, data refreshes).
     */
    _plotOverlay(body, visible) {
        if (typeof Plotly === 'undefined') return;
        const plotDiv = body.querySelector('[data-tt-overlay]');
        if (!plotDiv) return;

        const bandColors = this._bandColors();
        const baseColor = bandColors[this.activeBand] || '#4a7eb5';
        const colors = typeof getBandShades === 'function'
            ? getBandShades(baseColor, visible.length)
            : visible.map(() => baseColor);

        const key = `${this.activeBand}_${this.powerMode}`;
        let maxBaseline = 0;
        let maxStimulation = 0;
        const traces = [];

        visible.forEach((trial, index) => {
            const ts = trial.timeSeries || {};
            const series = ts[key];
            if (!series || !series.length) return;
            maxBaseline = Math.max(maxBaseline, ts.baselineDuration || 0);
            maxStimulation = Math.max(maxStimulation, ts.stimulationDuration || 0);

            const id = String(trial.dbTrialId);
            const label = `${trial.participantCode} #${trial.trialOrder ?? '—'}${trial.excludeFromAnalysis ? ' (excluded)' : ''}`;
            traces.push({
                type: 'scatter',
                x: series.map(p => p.t),
                y: series.map(p => p.mean),
                mode: 'lines',
                line: {
                    color: colors[index % colors.length],
                    width: 1.5,
                    dash: trial.excludeFromAnalysis ? 'dot' : 'solid'
                },
                name: label,
                meta: id,
                visible: this.hiddenTrials.has(id) ? 'legendonly' : true,
                connectgaps: false,
                hovertemplate: 't=%{x}s: %{y:.4f}<extra>' + this._escape(label) + '</extra>'
            });
        });

        Plotly.react(
            plotDiv,
            traces,
            this._overlayLayout([-(maxBaseline || 10), (maxStimulation || 30) - 1]),
            { displayModeBar: false, responsive: true }
        );
        this.plotDivs.push(plotDiv);

        // Legend toggles/isolates end in a restyle — read back the applied
        // per-trace visibility and persist it across re-renders.
        plotDiv.on('plotly_restyle', () => {
            (plotDiv.data || []).forEach(trace => {
                if (!trace.meta) return;
                if (trace.visible === 'legendonly') this.hiddenTrials.add(trace.meta);
                else this.hiddenTrials.delete(trace.meta);
            });
        });
    }

    _overlayLayout(xRange) {
        const theme = typeof PLOTLY_THEME !== 'undefined' ? PLOTLY_THEME : {};
        const base = typeof getPlotlyLayoutTheme === 'function' ? getPlotlyLayoutTheme({ height: 360 }) : { height: 360 };
        const font = theme.fontFamily || 'sans-serif';
        const fontColor = theme.fontColor || '#666';
        const gridColor = theme.gridColor || '#e8e8e8';
        const annotationColor = theme.annotationColor || '#bbb';

        return {
            ...base,
            height: 360,
            margin: { l: 48, r: 8, t: 24, b: 30 },
            showlegend: true,
            legend: { font: { size: 10, family: font, color: fontColor }, x: 0, y: -0.18, orientation: 'h' },
            font: { family: font, size: 10, color: fontColor },
            xaxis: {
                ...(base.xaxis || {}),
                title: {
                    text: 'Time (seconds)',
                    font: { size: 10, family: font, color: fontColor }
                },
                range: xRange,
                dtick: 5,
                gridcolor: gridColor,
                tickfont: { size: 9, family: font, color: fontColor }
            },
            yaxis: {
                ...(base.yaxis || {}),
                title: {
                    text: this.powerMode === 'abs' ? 'Absolute Power' : 'Relative Power',
                    font: { size: 10, family: font, color: fontColor }
                },
                gridcolor: gridColor,
                tickfont: { size: 9, family: font, color: fontColor }
            },
            shapes: [{
                type: 'line',
                x0: 0, x1: 0,
                y0: 0, y1: 1,
                yref: 'paper',
                line: { color: theme.phaseLineColor || '#ccc', width: 1, dash: 'dash' }
            }],
            annotations: [
                {
                    x: xRange[0] / 2,
                    y: 1.04,
                    yref: 'paper',
                    text: 'BASELINE',
                    showarrow: false,
                    font: { size: 9, color: annotationColor, family: font }
                },
                {
                    x: xRange[1] / 2,
                    y: 1.04,
                    yref: 'paper',
                    text: 'STIMULATION',
                    showarrow: false,
                    font: { size: 9, color: annotationColor, family: font }
                }
            ]
        };
    }

    _cellLayout(ranges) {
        const theme = typeof PLOTLY_THEME !== 'undefined' ? PLOTLY_THEME : {};
        const base = typeof getPlotlyLayoutTheme === 'function' ? getPlotlyLayoutTheme({ height: 180 }) : { height: 180 };
        const font = theme.fontFamily || 'sans-serif';
        const fontColor = theme.fontColor || '#666';
        const gridColor = theme.gridColor || '#e8e8e8';

        return {
            ...base,
            height: 180,
            margin: { l: 42, r: 8, t: 8, b: 26 },
            showlegend: false,
            font: { family: font, size: 10, color: fontColor },
            xaxis: {
                ...(base.xaxis || {}),
                range: ranges.x,
                dtick: 10,
                gridcolor: gridColor,
                tickfont: { size: 8, family: font, color: fontColor }
            },
            yaxis: {
                ...(base.yaxis || {}),
                range: ranges.y,
                gridcolor: gridColor,
                tickfont: { size: 8, family: font, color: fontColor }
            },
            shapes: [{
                type: 'line',
                x0: 0, x1: 0,
                y0: 0, y1: 1,
                yref: 'paper',
                line: { color: theme.phaseLineColor || '#ccc', width: 1, dash: 'dash' }
            }]
        };
    }

    _bandColors() {
        return typeof BAND_COLORS !== 'undefined' ? BAND_COLORS : {
            delta: '#4a7eb5', theta: '#5bb5a2', alpha: '#d4a843', beta: '#d97a3e', gamma: '#c75b7a'
        };
    }

    _purgePlots() {
        if (typeof Plotly !== 'undefined') {
            this.plotDivs.forEach(div => {
                try { Plotly.purge(div); } catch (err) { /* already detached */ }
            });
        }
        this.plotDivs = [];
    }

    _formatDate(value) {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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
    module.exports = TrialTemporalExplorer;
}
