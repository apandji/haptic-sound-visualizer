/**
 * AnalyzeSidebarNav — Patterns / Trials mode toggle at the top of the sidebar.
 */
class AnalyzeSidebarNav {
    constructor(options = {}) {
        this.containerId = options.containerId || 'analyzeSidebarNav';
        this.container = document.getElementById(this.containerId);
        this.onViewChange = options.onViewChange || null;
        this.currentView = 'patterns';
        this.tabControls = null;
        if (!this.container) return;
        this.render();
    }

    render() {
        this.container.className = 'analyze-sidebar-nav';
        const icons = window.ICONS || {};
        const patternsIcon = icons.grid || '';
        const trialsIcon = icons.list || '';

        this.container.innerHTML = `
            <div class="segmented-control segmented-control--sm analyze-sidebar-nav__tabs" id="analyzeSidebarTablist" role="tablist" aria-label="Sidebar view">
                <button type="button" class="segmented-control__item segmented-control__item--active" id="analyzeSidebarTab-patterns" data-view="patterns" role="tab" aria-selected="true" aria-controls="patternSidebarPanel">${patternsIcon}Patterns</button>
                <button type="button" class="segmented-control__item" id="analyzeSidebarTab-trials" data-view="trials" role="tab" aria-selected="false" aria-controls="trialsView" tabindex="-1">${trialsIcon}Trials</button>
            </div>
        `;

        const tablist = this.container.querySelector('[role="tablist"]');

        this.container.querySelectorAll('.segmented-control__item').forEach(tab => {
            tab.addEventListener('click', () => {
                this.setActiveView(tab.dataset.view);
                if (this.onViewChange) this.onViewChange(tab.dataset.view);
            });
        });

        if (window.AppUI) {
            this.tabControls = AppUI.bindSegmentedTabs(tablist, {
                getValue: (tab) => tab.dataset.view,
                onSelect: (view) => {
                    this.setActiveView(view);
                    if (this.onViewChange) this.onViewChange(view);
                },
            });
        }
    }

    setActiveView(view) {
        this.currentView = view;
        const tabs = this.container.querySelectorAll('.segmented-control__item');
        let activeTab = null;

        tabs.forEach(tab => {
            const isActive = tab.dataset.view === view;
            tab.classList.toggle('segmented-control__item--active', isActive);
            tab.setAttribute('aria-selected', String(isActive));
            tab.tabIndex = isActive ? 0 : -1;
            if (isActive) activeTab = tab;
        });

        if (this.tabControls && activeTab) {
            this.tabControls.syncTabIndex(activeTab);
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnalyzeSidebarNav;
}
