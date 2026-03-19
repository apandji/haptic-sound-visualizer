// Shared Plotly configuration – fonts and colors aligned with design tokens
const PLOTLY_FONT = "'Geist Mono', 'SF Mono', Monaco, 'Roboto Mono', 'Courier New', monospace";
const PLOTLY_FONT_SANS = "'Geist Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const PLOTLY_THEME = {
    fontFamily: PLOTLY_FONT_SANS,
    fontSize: 11,
    fontColor: '#666666',
    gridColor: '#e8e8e8',
    lineColor: '#e0e0e0',
    paperBg: 'transparent',
    plotBg: 'transparent',
    titleFontSize: 10
};
function getPlotlyLayoutTheme(overrides = {}) {
    return {
        font: { family: PLOTLY_THEME.fontFamily, size: PLOTLY_THEME.fontSize, color: PLOTLY_THEME.fontColor },
        paper_bgcolor: PLOTLY_THEME.paperBg,
        plot_bgcolor: PLOTLY_THEME.plotBg,
        margin: { l: 50, r: 20, t: 25, b: 50 },
        showlegend: false,
        xaxis: {
            gridcolor: PLOTLY_THEME.gridColor,
            tickfont: { size: 9, family: PLOTLY_THEME.fontFamily },
            zeroline: false
        },
        yaxis: {
            gridcolor: PLOTLY_THEME.gridColor,
            tickfont: { size: 9, family: PLOTLY_THEME.fontFamily }
        },
        ...overrides
    };
}
const COMPARISON_COLORS = ['#333333', '#999999', '#BA0C2F', '#006699'];
const BAND_COLORS = {
    delta: '#4a7eb5',
    theta: '#5bb5a2',
    alpha: '#d4a843',
    beta: '#d97a3e',
    gamma: '#c75b7a'
};

/**
 * Generate shades of a band color for comparison mode.
 * Returns array of N hex colors: [base, lighter, darker, lightest]
 */
function getBandShades(hex, n) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const shades = [];
    // Offsets: 0 = base, then alternate lighter/darker
    const offsets = [0, 0.35, -0.25, 0.55];
    for (let i = 0; i < n; i++) {
        const off = offsets[i % offsets.length];
        const nr = Math.round(Math.min(255, Math.max(0, r + (255 - r) * Math.max(0, off) + r * Math.min(0, off))));
        const ng = Math.round(Math.min(255, Math.max(0, g + (255 - g) * Math.max(0, off) + g * Math.min(0, off))));
        const nb = Math.round(Math.min(255, Math.max(0, b + (255 - b) * Math.max(0, off) + b * Math.min(0, off))));
        shades.push('#' + [nr, ng, nb].map(c => c.toString(16).padStart(2, '0')).join(''));
    }
    return shades;
}
