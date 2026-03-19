/**
 * BoxPlotChart Component
 * Displays box plots showing distribution of delta-from-baseline values per band.
 * Wraps Plotly.js box plot.
 */
class BoxPlotChart {
    constructor(options = {}) {
        this.containerId = options.containerId || 'boxPlotChart';
        this.container = document.getElementById(this.containerId);

        if (!this.container) {
            console.error(`BoxPlotChart: Container #${this.containerId} not found`);
            return;
        }

        this.plotDiv = null;
        this.bands = ['delta', 'theta', 'alpha', 'beta', 'gamma'];
        this.bandLabels = ['Delta', 'Theta', 'Alpha', 'Beta', 'Gamma'];
        this.render();
    }

    render() {
        this.container.classList.add('box-plot-chart');
        this.container.innerHTML = '';

        const header = document.createElement('div');
        header.className = 'box-plot-chart__header';
        header.textContent = 'DISTRIBUTION (DELTA FROM BASELINE)';

        this.plotDiv = document.createElement('div');
        this.plotDiv.className = 'box-plot-chart__plot';

        this.container.appendChild(header);
        this.container.appendChild(this.plotDiv);
    }

    update(boxPlotData) {
        if (!boxPlotData) return;

        const bandColors = typeof BAND_COLORS !== 'undefined' ? BAND_COLORS : {
            delta: '#4a7eb5', theta: '#5bb5a2', alpha: '#d4a843', beta: '#d97a3e', gamma: '#c75b7a'
        };

        const traces = this.bands.map((band, i) => {
            const color = bandColors[band] || '#333';
            return {
                type: 'box',
                y: boxPlotData[band] || [],
                name: this.bandLabels[i],
                marker: { color, size: 4 },
                line: { color, width: 1 },
                fillcolor: this._hexToRgba(color, 0.08),
                boxpoints: 'outliers',
                hovertemplate: '%{y:.4f}<extra>' + this.bandLabels[i] + '</extra>'
            };
        });

        const layout = this._getLayout();
        Plotly.react(this.plotDiv, traces, layout, this._getConfig());
    }

    updateComparison(patternsData) {
        if (!patternsData || patternsData.length === 0) return;

        const bandColors = typeof BAND_COLORS !== 'undefined' ? BAND_COLORS : {
            delta: '#4a7eb5', theta: '#5bb5a2', alpha: '#d4a843', beta: '#d97a3e', gamma: '#c75b7a'
        };
        const hasShadesFunc = typeof getBandShades === 'function';
        const n = patternsData.length;
        const traces = [];

        for (let pi = 0; pi < n; pi++) {
            const p = patternsData[pi];
            if (!p.boxPlots) continue;

            for (let bi = 0; bi < this.bands.length; bi++) {
                const baseColor = bandColors[this.bands[bi]] || '#333';
                const color = hasShadesFunc ? getBandShades(baseColor, n)[pi] : baseColor;

                traces.push({
                    type: 'box',
                    y: p.boxPlots[this.bands[bi]] || [],
                    name: p.name,
                    legendgroup: p.name,
                    showlegend: bi === 0,
                    x: Array(p.boxPlots[this.bands[bi]]?.length || 0).fill(this.bandLabels[bi]),
                    marker: { color, size: 4 },
                    line: { color, width: 1 },
                    fillcolor: this._hexToRgba(color, 0.08),
                    boxpoints: 'outliers',
                    hovertemplate: '%{y:.4f}<extra>' + p.name + '</extra>'
                });
            }
        }

        const layout = this._getLayout();
        layout.boxmode = 'group';
        layout.showlegend = true;
        layout.legend = { font: { size: 10 }, x: 0, y: -0.2, orientation: 'h' };

        Plotly.react(this.plotDiv, traces, layout, this._getConfig());
    }

    _getLayout() {
        const font = typeof PLOTLY_THEME !== 'undefined' ? PLOTLY_THEME.fontFamily : 'sans-serif';
        const theme = typeof PLOTLY_THEME !== 'undefined' ? PLOTLY_THEME : {};
        return {
            font: { family: font, size: theme.fontSize || 11, color: theme.fontColor || '#666' },
            paper_bgcolor: theme.paperBg || 'transparent',
            plot_bgcolor: theme.plotBg || 'transparent',
            margin: { l: 50, r: 20, t: 10, b: 40 },
            showlegend: false,
            height: 340,
            yaxis: {
                title: { text: 'Change from baseline', font: { size: theme.titleFontSize || 10, family: font } },
                zeroline: true,
                zerolinecolor: theme.lineColor || '#e0e0e0',
                zerolinewidth: 1,
                gridcolor: theme.gridColor || '#e8e8e8',
                tickfont: { size: 9, family: font }
            },
            xaxis: {
                gridcolor: theme.gridColor || '#e8e8e8',
                tickfont: { size: 10, family: font }
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
    }

    destroy() {
        this.clear();
        if (this.container) {
            this.container.innerHTML = '';
            this.container.classList.remove('box-plot-chart');
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BoxPlotChart;
}
