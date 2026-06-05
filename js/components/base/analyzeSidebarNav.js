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
            <div class="analyze-sidebar-nav__tabs" role="tablist" aria-label="Sidebar view">
                <button type="button" class="analyze-sidebar-nav__tab analyze-sidebar-nav__tab--active" data-view="pattern" role="tab" aria-selected="true">Patterns</button>
                <button type="button" class="analyze-sidebar-nav__tab" data-view="trials" role="tab" aria-selected="false">Trials</button>
            </div>
        `;

        this.container.querySelectorAll('.analyze-sidebar-nav__tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const view = tab.dataset.view;
                this.setActiveView(view);
                if (this.onViewChange) this.onViewChange(view);
            });
        });
    }

    setActiveView(view) {
        this.currentView = view;
        this.container.querySelectorAll('.analyze-sidebar-nav__tab').forEach(tab => {
            const isActive = tab.dataset.view === view;
            tab.classList.toggle('analyze-sidebar-nav__tab--active', isActive);
            tab.setAttribute('aria-selected', String(isActive));
        });
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnalyzeSidebarNav;
}
