/**
 * RadarChart Component
 * Animated time-scrubbing brainwave fingerprint.
 * Solo mode: slider scrubs through time bins, plays/animates.
 * Comparison mode: static overlay of patterns (stimulation averages).
 * Wraps Plotly.js scatterpolar.
 */
class RadarChart {
    constructor(options = {}) {
        this.containerId = options.containerId || 'radarChart';
        this.container = document.getElementById(this.containerId);

        if (!this.container) {
            console.error(`RadarChart: Container #${this.containerId} not found`);
            return;
        }

        this.plotDiv = null;
        this.bands = ['delta', 'theta', 'alpha', 'beta', 'gamma'];
        this.bandLabels = ['Delta', 'Theta', 'Alpha', 'Beta', 'Gamma'];
        this.bandKeys = ['delta_rel', 'theta_rel', 'alpha_rel', 'beta_rel', 'gamma_rel'];

        // Animation state
        this.frames = [];         // [{t, values: [d,t,a,b,g]}]
        this.baselineAvg = null;  // [d,t,a,b,g] for ghost polygon
        this.significantFrames = []; // indices of significant changes
        this.currentFrameIndex = 0;
        this.isPlaying = false;
        this.animationTimer = null;
        this.analysisData = null;

        // Phase info for slider markers
        this.calibrationDuration = 0;
        this.baselineDuration = 0;
        this.stimulationDuration = 0;

        this.boundHandlers = {};
        this.render();
    }

    render() {
        this.container.classList.add('radar-chart');
        this.container.innerHTML = '';

        // Header row
        const headerRow = document.createElement('div');
        headerRow.className = 'radar-chart__header-row';

        const header = document.createElement('div');
        header.className = 'radar-chart__header';
        header.textContent = 'BRAINWAVE FINGERPRINT';

        this.timeLabel = document.createElement('span');
        this.timeLabel.className = 'radar-chart__time-label';
        this.timeLabel.textContent = '';

        headerRow.appendChild(header);
        headerRow.appendChild(this.timeLabel);

        // Plot
        this.plotDiv = document.createElement('div');
        this.plotDiv.className = 'radar-chart__plot';

        // Controls: play button + slider
        this.controlsEl = document.createElement('div');
        this.controlsEl.className = 'radar-chart__controls';
        this.controlsEl.style.display = 'none';

        this.playBtn = document.createElement('button');
        this.playBtn.className = 'radar-chart__play-btn';
        this.playBtn.textContent = '\u25B6';
        this.playBtn.title = 'Play animation';
        this.boundHandlers.playClick = () => this._togglePlay();
        this.playBtn.addEventListener('click', this.boundHandlers.playClick);

        this.slider = document.createElement('input');
        this.slider.type = 'range';
        this.slider.className = 'radar-chart__slider';
        this.slider.min = 0;
        this.slider.max = 0;
        this.slider.value = 0;
        this.boundHandlers.sliderInput = () => this._onSliderChange();
        this.slider.addEventListener('input', this.boundHandlers.sliderInput);

        this.controlsEl.appendChild(this.playBtn);
        this.controlsEl.appendChild(this.slider);

        // Phase labels below slider
        this.phaseLabelEl = document.createElement('div');
        this.phaseLabelEl.className = 'radar-chart__phase-labels';
        this.phaseLabelEl.style.display = 'none';

        // Significant changes markers
        this.markersEl = document.createElement('div');
        this.markersEl.className = 'radar-chart__markers';
        this.markersEl.style.display = 'none';

        this.container.appendChild(headerRow);
        this.container.appendChild(this.plotDiv);
        this.container.appendChild(this.controlsEl);
        this.container.appendChild(this.phaseLabelEl);
        this.container.appendChild(this.markersEl);
    }

    /**
     * Solo mode: receive full analysis, build frames for animation
     */
    update(analysis) {
        if (!analysis) return;
        this.analysisData = analysis;

        const ts = analysis.timeSeries;
        if (!ts) {
            // Fallback to static radar if no time series
            this._renderStatic(analysis.radar);
            return;
        }

        // Extract phase durations
        this.calibrationDuration = ts.calibrationDuration || 0;
        this.baselineDuration = ts.baselineDuration || 10;
        this.stimulationDuration = ts.stimulationDuration || 30;

        // Build frames from time series
        this._buildFrames(ts);

        // Compute baseline average for ghost polygon
        if (analysis.radar) {
            this.baselineAvg = this.bandKeys.map(k => analysis.radar.baselineAvg[k] || 0);
        }

        // Setup slider
        this.controlsEl.style.display = 'flex';
        this.slider.min = 0;
        this.slider.max = this.frames.length - 1;

        // Start at baseline→stimulation transition
        const transitionIndex = this.frames.findIndex(f => f.t >= 0);
        this.currentFrameIndex = transitionIndex >= 0 ? transitionIndex : 0;
        this.slider.value = this.currentFrameIndex;

        this._renderPhaseLabels();
        this._renderSignificanceMarkers();
        this._renderFrame(this.currentFrameIndex);
    }

    /**
     * Comparison mode: static overlay (no animation)
     */
    updateComparison(patternsData) {
        if (!patternsData || patternsData.length === 0) return;

        this._stopAnimation();
        this.controlsEl.style.display = 'none';
        this.phaseLabelEl.style.display = 'none';
        this.markersEl.style.display = 'none';
        this.timeLabel.textContent = '';

        const colors = typeof COMPARISON_COLORS !== 'undefined' ? COMPARISON_COLORS : ['#333', '#999', '#cc0000', '#006699'];
        const categories = [...this.bandLabels, this.bandLabels[0]];

        const traces = patternsData.map((p, i) => {
            if (!p.radar) return null;
            const values = this.bandKeys.map(k => p.radar.stimulationAvg[k] || 0);
            const closed = [...values, values[0]];
            const color = colors[i % colors.length];

            return {
                type: 'scatterpolar',
                r: closed,
                theta: categories,
                fill: 'toself',
                fillcolor: this._hexToRgba(color, 0.06),
                line: { color, width: 2 },
                name: p.name,
                hovertemplate: '%{theta}: %{r:.4f}<extra>' + p.name + '</extra>'
            };
        }).filter(Boolean);

        const layout = this._getLayout();
        layout.showlegend = true;
        layout.legend = { font: { size: 10 }, x: 0, y: -0.15, orientation: 'h' };

        Plotly.react(this.plotDiv, traces, layout, this._getConfig());
    }

    // --- Frame building ---

    _buildFrames(timeSeries) {
        this.frames = [];
        const suffix = '_rel';
        const firstKey = `${this.bands[0]}${suffix}`;
        const seriesData = timeSeries[firstKey];
        if (!seriesData) return;

        for (let i = 0; i < seriesData.length; i++) {
            const t = seriesData[i].t;
            const values = this.bands.map(band => {
                const key = `${band}${suffix}`;
                const entry = timeSeries[key]?.[i];
                return entry?.mean ?? 0;
            });
            this.frames.push({ t, values });
        }

        // Detect significant changes
        this._detectSignificantChanges();
    }

    _detectSignificantChanges() {
        this.significantFrames = [];
        if (this.frames.length < 3) return;

        // Compute frame-to-frame change magnitudes
        const deltas = [];
        for (let i = 1; i < this.frames.length; i++) {
            let totalChange = 0;
            for (let b = 0; b < this.bands.length; b++) {
                totalChange += Math.abs(this.frames[i].values[b] - this.frames[i - 1].values[b]);
            }
            deltas.push(totalChange);
        }

        // Threshold: mean + 1.5 * stddev
        const mean = deltas.reduce((s, v) => s + v, 0) / deltas.length;
        const variance = deltas.reduce((s, v) => s + (v - mean) ** 2, 0) / deltas.length;
        const stddev = Math.sqrt(variance);
        const threshold = mean + 1.5 * stddev;

        for (let i = 0; i < deltas.length; i++) {
            if (deltas[i] > threshold) {
                // Find the band that changed most
                let maxBandDelta = 0;
                let maxBand = 0;
                for (let b = 0; b < this.bands.length; b++) {
                    const d = Math.abs(this.frames[i + 1].values[b] - this.frames[i].values[b]);
                    if (d > maxBandDelta) {
                        maxBandDelta = d;
                        maxBand = b;
                    }
                }
                this.significantFrames.push({
                    frameIndex: i + 1,
                    t: this.frames[i + 1].t,
                    band: this.bands[maxBand],
                    bandLabel: this.bandLabels[maxBand],
                    magnitude: deltas[i]
                });
            }
        }
    }

    // --- Rendering ---

    _renderFrame(index) {
        if (index < 0 || index >= this.frames.length) return;

        this.currentFrameIndex = index;
        const frame = this.frames[index];

        const bandColors = typeof BAND_COLORS !== 'undefined' ? BAND_COLORS : {
            delta: '#4a7eb5', theta: '#5bb5a2', alpha: '#d4a843', beta: '#d97a3e', gamma: '#c75b7a'
        };
        const markerColors = this.bands.map(b => bandColors[b]);

        // Update time label
        const phase = this._getPhaseForTime(frame.t);
        this.timeLabel.textContent = `t = ${frame.t}s  \u00B7  ${phase}`;

        const categories = [...this.bandLabels, this.bandLabels[0]];
        const currentClosed = [...frame.values, frame.values[0]];
        const markerColorsClosed = [...markerColors, markerColors[0]];

        const traces = [];

        // Ghost: baseline average
        if (this.baselineAvg) {
            const ghostClosed = [...this.baselineAvg, this.baselineAvg[0]];
            traces.push({
                type: 'scatterpolar',
                r: ghostClosed,
                theta: categories,
                fill: 'toself',
                fillcolor: 'rgba(200, 200, 200, 0.06)',
                line: { color: '#ddd', dash: 'dash', width: 1 },
                marker: { size: 0 },
                name: 'Baseline avg',
                hovertemplate: '%{theta}: %{r:.4f}<extra>Baseline avg</extra>'
            });
        }

        // Current frame polygon
        traces.push({
            type: 'scatterpolar',
            r: currentClosed,
            theta: categories,
            fill: 'toself',
            fillcolor: 'rgba(51, 51, 51, 0.05)',
            line: { color: '#333', width: 2 },
            marker: { size: 7, color: markerColorsClosed },
            name: `t = ${frame.t}s`,
            hovertemplate: '%{theta}: %{r:.4f}<extra>Current</extra>'
        });

        const layout = this._getLayout();
        layout.showlegend = true;
        layout.legend = { font: { size: 10 }, x: 0, y: -0.15, orientation: 'h' };

        Plotly.react(this.plotDiv, traces, layout, this._getConfig());
    }

    _renderStatic(radarData) {
        if (!radarData) return;

        this.controlsEl.style.display = 'none';
        this.phaseLabelEl.style.display = 'none';
        this.markersEl.style.display = 'none';
        this.timeLabel.textContent = '';

        const bandColors = typeof BAND_COLORS !== 'undefined' ? BAND_COLORS : {
            delta: '#4a7eb5', theta: '#5bb5a2', alpha: '#d4a843', beta: '#d97a3e', gamma: '#c75b7a'
        };
        const markerColors = this.bands.map(b => bandColors[b]);

        const baselineValues = this.bandKeys.map(k => radarData.baselineAvg[k] || 0);
        const stimValues = this.bandKeys.map(k => radarData.stimulationAvg[k] || 0);
        const categories = [...this.bandLabels, this.bandLabels[0]];
        const markerColorsClosed = [...markerColors, markerColors[0]];

        const traces = [
            {
                type: 'scatterpolar',
                r: [...baselineValues, baselineValues[0]],
                theta: categories,
                fill: 'toself',
                fillcolor: 'rgba(200, 200, 200, 0.1)',
                line: { color: '#ccc', dash: 'dash', width: 1 },
                marker: { size: 5, color: markerColorsClosed },
                name: 'Baseline',
                hovertemplate: '%{theta}: %{r:.4f}<extra>Baseline</extra>'
            },
            {
                type: 'scatterpolar',
                r: [...stimValues, stimValues[0]],
                theta: categories,
                fill: 'toself',
                fillcolor: 'rgba(51, 51, 51, 0.05)',
                line: { color: '#555', width: 2 },
                marker: { size: 7, color: markerColorsClosed },
                name: 'Stimulation',
                hovertemplate: '%{theta}: %{r:.4f}<extra>Stimulation</extra>'
            }
        ];

        const layout = this._getLayout();
        layout.showlegend = true;
        layout.legend = { font: { size: 10 }, x: 0, y: -0.15, orientation: 'h' };
        Plotly.react(this.plotDiv, traces, layout, this._getConfig());
    }

    _renderPhaseLabels() {
        this.phaseLabelEl.style.display = 'flex';
        this.phaseLabelEl.innerHTML = '';

        const total = this.frames.length;
        if (total === 0) return;

        const calDur = this.calibrationDuration;
        const blDur = this.baselineDuration;
        const stimDur = this.stimulationDuration;
        const totalDur = calDur + blDur + stimDur;

        if (calDur > 0) {
            const calLabel = document.createElement('span');
            calLabel.className = 'radar-chart__phase-label';
            calLabel.textContent = 'CAL';
            calLabel.style.width = `${(calDur / totalDur) * 100}%`;
            this.phaseLabelEl.appendChild(calLabel);
        }

        const blLabel = document.createElement('span');
        blLabel.className = 'radar-chart__phase-label';
        blLabel.textContent = 'BASE';
        blLabel.style.width = `${(blDur / totalDur) * 100}%`;
        this.phaseLabelEl.appendChild(blLabel);

        const stimLabel = document.createElement('span');
        stimLabel.className = 'radar-chart__phase-label';
        stimLabel.textContent = 'STIM';
        stimLabel.style.width = `${(stimDur / totalDur) * 100}%`;
        this.phaseLabelEl.appendChild(stimLabel);
    }

    _renderSignificanceMarkers() {
        this.markersEl.style.display = 'block';
        this.markersEl.innerHTML = '';

        if (this.frames.length === 0 || this.significantFrames.length === 0) {
            this.markersEl.style.display = 'none';
            return;
        }

        const bandColors = typeof BAND_COLORS !== 'undefined' ? BAND_COLORS : {
            delta: '#4a7eb5', theta: '#5bb5a2', alpha: '#d4a843', beta: '#d97a3e', gamma: '#c75b7a'
        };

        for (const sf of this.significantFrames) {
            const pct = (sf.frameIndex / (this.frames.length - 1)) * 100;
            const marker = document.createElement('div');
            marker.className = 'radar-chart__sig-marker';
            marker.style.left = `${pct}%`;
            marker.style.backgroundColor = bandColors[sf.band] || '#333';
            marker.title = `t=${sf.t}s: ${sf.bandLabel} shift`;

            marker.addEventListener('click', () => {
                this.slider.value = sf.frameIndex;
                this._onSliderChange();
            });

            this.markersEl.appendChild(marker);
        }
    }

    _getPhaseForTime(t) {
        const blStart = -this.baselineDuration;
        const calStart = -(this.calibrationDuration + this.baselineDuration);

        if (this.calibrationDuration > 0 && t < blStart) return 'calibration';
        if (t < 0) return 'baseline';
        return 'stimulation';
    }

    // --- Playback controls ---

    _togglePlay() {
        if (this.isPlaying) {
            this._stopAnimation();
        } else {
            this._startAnimation();
        }
    }

    _startAnimation() {
        this.isPlaying = true;
        this.playBtn.textContent = '\u275A\u275A';
        this.playBtn.title = 'Pause';

        // If at end, restart
        if (this.currentFrameIndex >= this.frames.length - 1) {
            this.currentFrameIndex = 0;
            this.slider.value = 0;
        }

        const step = () => {
            if (!this.isPlaying) return;

            this.currentFrameIndex++;
            if (this.currentFrameIndex >= this.frames.length) {
                this._stopAnimation();
                return;
            }

            this.slider.value = this.currentFrameIndex;
            this._renderFrame(this.currentFrameIndex);

            this.animationTimer = setTimeout(step, 120);
        };

        step();
    }

    _stopAnimation() {
        this.isPlaying = false;
        this.playBtn.textContent = '\u25B6';
        this.playBtn.title = 'Play animation';
        if (this.animationTimer) {
            clearTimeout(this.animationTimer);
            this.animationTimer = null;
        }
    }

    _onSliderChange() {
        const index = parseInt(this.slider.value);
        this._renderFrame(index);
    }

    // --- Layout helpers ---

    _getLayout() {
        const font = typeof PLOTLY_FONT !== 'undefined' ? PLOTLY_FONT : 'monospace';
        return {
            polar: {
                radialaxis: {
                    visible: true,
                    range: [0, undefined],
                    tickfont: { size: 9, family: font }
                },
                angularaxis: {
                    tickfont: { size: 10, family: font }
                }
            },
            font: { family: font, size: 11, color: '#666' },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            margin: { l: 60, r: 60, t: 20, b: 40 },
            showlegend: false,
            height: 300
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
        this._stopAnimation();
        if (this.plotDiv) {
            Plotly.purge(this.plotDiv);
        }
        this.frames = [];
        this.significantFrames = [];
    }

    destroy() {
        this.clear();
        if (this.playBtn && this.boundHandlers.playClick) {
            this.playBtn.removeEventListener('click', this.boundHandlers.playClick);
        }
        if (this.slider && this.boundHandlers.sliderInput) {
            this.slider.removeEventListener('input', this.boundHandlers.sliderInput);
        }
        this.boundHandlers = {};
        if (this.container) {
            this.container.innerHTML = '';
            this.container.classList.remove('radar-chart');
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = RadarChart;
}
