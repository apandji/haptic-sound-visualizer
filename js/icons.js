/**
 * ICONS — single source of truth for inline SVG icons.
 *
 * Icons are sourced from Lucide (https://lucide.dev, ISC/MIT license).
 * Prefer simple, high-contrast glyphs that stay legible at 14–16px.
 * To add a new icon: copy the inner paths from lucide.dev, wrap with
 * the svg() helper below, and add a short camelCase key.
 *
 * Usage:
 *   - In JS templates:  `${(window.ICONS || {}).grid || ''}`
 *   - In static HTML:   <span class="icon" data-icon="grid"></span>
 *     (hydrated on DOMContentLoaded by the helper at the bottom)
 */
(function () {
    const svg = (inner) =>
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        inner +
        '</svg>';

    window.ICONS = {
        // layout-grid — Explore nav, Patterns toggle
        grid: svg('<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/>'),
        // play — Test nav
        play: svg('<polygon points="6 3 20 12 6 21 6 3"/>'),
        // bar-chart-2 — Analyze nav
        chart: svg('<line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/>'),
        // list — Trials toggle
        list: svg('<line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/>'),
        // chevrons-up-down — sort control
        sort: svg('<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>'),
        // arrow-up — attention queue "dig"
        trendingUp: svg('<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>'),
        // archive — attention queue "retire"
        archive: svg('<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>'),
        // triangle-alert — attention queue "mixed"
        alert: svg('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>'),
        // plus — attention queue "needs data"
        plus: svg('<path d="M5 12h14"/><path d="M12 5v14"/>'),
        // clock — attention queue "stale"
        clock: svg('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'),
        // list-filter — Filters toolbar button
        listFilter: svg('<path d="M3 6h18"/><path d="M7 12h10"/><path d="M10 18h4"/>'),
        // rotate-cw — refresh toolbar button
        refresh: svg('<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>'),

        // Backward-compat aliases (older data-icon / template keys)
        compass: null,
        flask: null,
        scatter: null,
    };

    window.ICONS.compass = window.ICONS.grid;
    window.ICONS.flask = window.ICONS.play;
    window.ICONS.scatter = window.ICONS.grid;

    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('[data-icon]').forEach((el) => {
            const icon = window.ICONS[el.dataset.icon];
            if (icon) el.innerHTML = icon;
        });
    });
})();
