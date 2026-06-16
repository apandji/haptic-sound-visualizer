// Shared Plotly configuration – fonts and colors aligned with design tokens
const PLOTLY_FONT = "'Geist Mono', 'SF Mono', Monaco, 'Roboto Mono', 'Courier New', monospace";
const PLOTLY_FONT_SANS = "'Geist Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

function isDarkTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
}

function getPlotlyThemeColors() {
    if (isDarkTheme()) {
        return {
            fontFamily: PLOTLY_FONT_SANS,
            fontSize: 11,
            fontColor: '#a1a1aa',
            gridColor: '#3f3f46',
            lineColor: '#52525b',
            paperBg: 'transparent',
            plotBg: 'transparent',
            titleFontSize: 10,
            polarBg: '#18181b',
            annotationColor: '#71717a',
            phaseLineColor: '#52525b',
            ghostLineColor: '#52525b',
            seriesLineColor: '#e4e4e7',
            seriesFillColor: 'rgba(228, 228, 231, 0.08)',
            ghostFillColor: 'rgba(161, 161, 170, 0.1)',
            baselineLineColor: '#71717a',
        };
    }
    return {
        fontFamily: PLOTLY_FONT_SANS,
        fontSize: 11,
        fontColor: '#666666',
        gridColor: '#e8e8e8',
        lineColor: '#e0e0e0',
        paperBg: 'transparent',
        plotBg: 'transparent',
        titleFontSize: 10,
        polarBg: 'rgba(0,0,0,0)',
        annotationColor: '#bbb',
        phaseLineColor: '#ccc',
        ghostLineColor: '#ddd',
        seriesLineColor: '#333',
        seriesFillColor: 'rgba(51, 51, 51, 0.05)',
        ghostFillColor: 'rgba(200, 200, 200, 0.06)',
        baselineLineColor: '#555',
    };
}

/** @deprecated use getPlotlyThemeColors() — kept for chart modules that read PLOTLY_THEME */
let PLOTLY_THEME = getPlotlyThemeColors();

function syncPlotlyTheme() {
    PLOTLY_THEME = getPlotlyThemeColors();
    return PLOTLY_THEME;
}

function getPlotlyLayoutTheme(overrides = {}) {
    const theme = syncPlotlyTheme();
    return {
        font: { family: theme.fontFamily, size: theme.fontSize, color: theme.fontColor },
        paper_bgcolor: theme.paperBg,
        plot_bgcolor: theme.plotBg,
        margin: { l: 50, r: 20, t: 25, b: 50 },
        showlegend: false,
        xaxis: {
            gridcolor: theme.gridColor,
            tickfont: { size: 9, family: theme.fontFamily, color: theme.fontColor },
            zeroline: false,
            linecolor: theme.lineColor,
        },
        yaxis: {
            gridcolor: theme.gridColor,
            tickfont: { size: 9, family: theme.fontFamily, color: theme.fontColor },
            linecolor: theme.lineColor,
        },
        ...overrides,
    };
}

function getComparisonColors() {
    return isDarkTheme()
        ? ['#e4e4e7', '#71717a', '#e85a75', '#74c0fc']
        : ['#333333', '#999999', '#BA0C2F', '#006699'];
}

const COMPARISON_COLORS = getComparisonColors();

function refreshComparisonColors() {
    const next = getComparisonColors();
    COMPARISON_COLORS.length = 0;
    COMPARISON_COLORS.push(...next);
}

const BAND_COLORS = {
    delta: '#4a7eb5',
    theta: '#5bb5a2',
    alpha: '#d4a843',
    beta: '#d97a3e',
    gamma: '#c75b7a',
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

if (typeof window !== 'undefined') {
    window.addEventListener('sail-theme-change', () => {
        syncPlotlyTheme();
        refreshComparisonColors();
    });
}
