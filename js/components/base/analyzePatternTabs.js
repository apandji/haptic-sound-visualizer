/**
 * AnalyzePatternTabs — Physiological / Subjective tab switcher for pattern detail.
 */
class AnalyzePatternTabs {
    constructor(options = {}) {
        this.containerId = options.containerId || 'analyzePatternTabs';
        this.container = document.getElementById(this.containerId);
        this.physioPanelId = options.physioPanelId || 'analyzePhysioPanel';
        this.subjectivePanelId = options.subjectivePanelId || 'analyzeSubjectivePanel';
        this.storageKey = options.storageKey || 'analyze_v2_pattern_tab';
        this.onChange = options.onChange || null;
        this.activeTab = 'physiological';

        if (!this.container) return;

        this.physioPanel = document.getElementById(this.physioPanelId);
        this.subjectivePanel = document.getElementById(this.subjectivePanelId);
        this.buttons = this.container.querySelectorAll('[data-analyze-tab]');

        const saved = localStorage.getItem(this.storageKey);
        if (saved === 'physiological' || saved === 'subjective') {
            this.activeTab = saved;
        }

        this.buttons.forEach(button => {
            button.addEventListener('click', () => {
                this.setActiveTab(button.dataset.analyzeTab);
            });
        });

        this.setActiveTab(this.activeTab, false);
    }

    setActiveTab(tab, persist = true) {
        if (tab !== 'physiological' && tab !== 'subjective') return;
        this.activeTab = tab;

        this.buttons.forEach(button => {
            const isActive = button.dataset.analyzeTab === tab;
            button.classList.toggle('segmented-control__item--active', isActive);
            button.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        if (this.physioPanel) {
            this.physioPanel.hidden = tab !== 'physiological';
        }
        if (this.subjectivePanel) {
            this.subjectivePanel.hidden = tab !== 'subjective';
        }

        if (persist) {
            localStorage.setItem(this.storageKey, tab);
        }

        if (this.onChange) {
            this.onChange(tab);
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnalyzePatternTabs;
}
