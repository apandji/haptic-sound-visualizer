/**
 * AnalyzeSidebarNav — Patterns / Trials toggle at the top of the sidebar.
 */
class AnalyzeSidebarNav {
    constructor(options = {}) {
        this.containerId = options.containerId || 'analyzeSidebarNav';
        this.container = document.getElementById(this.containerId);
        this.onViewChange = options.onViewChange || null;
        this.currentView = 'pattern';
        if (!this.container) return;
        this.render();
    }

    render() {
        this.container.className = 'analyze-sidebar-nav';
        this.container.innerHTML = `
            <div class="segmented-control segmented-control--sm analyze-sidebar-nav__tabs" role="tablist" aria-label="Sidebar view">
                <button type="button" class="segmented-control__item segmented-control__item--active" data-view="pattern" role="tab" aria-selected="true">Patterns</button>
                <button type="button" class="segmented-control__item" data-view="trials" role="tab" aria-selected="false">Trials</button>
            </div>
        `;

        this.container.querySelectorAll('.segmented-control__item').forEach(tab => {
            tab.addEventListener('click', () => {
                const view = tab.dataset.view;
                this.setActiveView(view);
                if (this.onViewChange) this.onViewChange(view);
            });
        });
    }

    setActiveView(view) {
        this.currentView = view;
        this.container.querySelectorAll('.segmented-control__item').forEach(tab => {
            const isActive = tab.dataset.view === view;
            tab.classList.toggle('segmented-control__item--active', isActive);
            tab.setAttribute('aria-selected', String(isActive));
        });
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnalyzeSidebarNav;
}
