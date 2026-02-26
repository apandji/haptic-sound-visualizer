/**
 * PatternExplorerForAnalysis Variant
 * Wraps PatternExplorer for the analysis sidebar.
 * Adds trial count badges, comparison mode, and data adaptation.
 */
class PatternExplorerForAnalysis {
    constructor(options = {}) {
        this.containerId = options.containerId || 'patternList';
        this.container = document.getElementById(this.containerId);

        if (!this.container) {
            console.error(`PatternExplorerForAnalysis: Container #${this.containerId} not found`);
            return;
        }

        // Callbacks
        this.onPatternSelect = options.onPatternSelect || null;
        this.onComparisonChange = options.onComparisonChange || null;
        this.onFilePreview = options.onFilePreview || null;

        // State
        this.patterns = []; // [{name, path, trialCount, ...}]
        this.selectedPattern = null;
        this.comparisonPatterns = [];
        this.isComparisonMode = false;

        // Create internal structure
        this.headerEl = null;
        this.toggleBtn = null;
        this.listContainerId = this.containerId + '_list';
        this.patternExplorer = null;

        this.boundHandlers = {};
        this.init();
    }

    init() {
        this.container.classList.add('pattern-explorer-analysis');

        // Build header with PATTERNS label and COMPARE toggle
        this.headerEl = document.createElement('div');
        this.headerEl.className = 'pattern-explorer-analysis__header';

        const label = document.createElement('span');
        label.className = 'pattern-explorer-analysis__header-label';
        label.textContent = 'PATTERNS';

        this.toggleBtn = document.createElement('button');
        this.toggleBtn.className = 'pattern-explorer-analysis__compare-btn';
        this.toggleBtn.textContent = 'COMPARE';
        this.boundHandlers.toggleClick = () => this.toggleComparisonMode();
        this.toggleBtn.addEventListener('click', this.boundHandlers.toggleClick);

        this.headerEl.appendChild(label);
        this.headerEl.appendChild(this.toggleBtn);

        // Create list container for PatternExplorer
        const listContainer = document.createElement('div');
        listContainer.id = this.listContainerId;
        listContainer.className = 'pattern-explorer-analysis__list';

        this.container.innerHTML = '';
        this.container.appendChild(this.headerEl);
        this.container.appendChild(listContainer);

        // Create PatternExplorer instance
        this.patternExplorer = new PatternExplorer({
            containerId: this.listContainerId,
            showPreviewButton: true,
            showHeader: false,
            metadata: {},
            onFileClick: (file) => this.handleFileClick(file),
            onFilePreview: (file) => {
                if (this.onFilePreview) this.onFilePreview(file);
            }
        });
    }

    /**
     * Set patterns from data processor output
     * @param {Array} patterns - [{name, path, trialCount, sessionCount, uniqueParticipants}]
     */
    setPatterns(patterns) {
        this.patterns = patterns || [];

        // Convert to file format PatternExplorer expects
        const files = this.patterns.map(p => ({
            name: p.name,
            path: p.path
        }));

        this.patternExplorer.render(files);
        this._injectTrialCounts();
    }

    /**
     * Inject trial count badges after PatternExplorer renders
     */
    _injectTrialCounts() {
        const listContainer = document.getElementById(this.listContainerId);
        if (!listContainer) return;

        const items = listContainer.querySelectorAll('.file-item');
        items.forEach(item => {
            const filePath = item.dataset.filePath;
            const pattern = this.patterns.find(p => p.path === filePath);
            if (!pattern) return;

            // Remove existing badge if any
            const existing = item.querySelector('.pattern-explorer-analysis__trial-count');
            if (existing) existing.remove();

            const badge = document.createElement('span');
            badge.className = 'pattern-explorer-analysis__trial-count';
            badge.textContent = pattern.trialCount;
            badge.title = `${pattern.trialCount} trial${pattern.trialCount !== 1 ? 's' : ''} across ${pattern.uniqueParticipants} participant${pattern.uniqueParticipants !== 1 ? 's' : ''}`;

            item.appendChild(badge);
        });
    }

    /**
     * Handle file click — single-select or comparison toggle
     */
    handleFileClick(file) {
        if (this.isComparisonMode) {
            this._toggleComparison(file.name);
        } else {
            this.selectedPattern = file.name;
            this.patternExplorer.setActiveFile(file.path);
            if (this.onPatternSelect) this.onPatternSelect(file.name);
        }
    }

    /**
     * Programmatically select a pattern
     */
    selectPattern(patternName) {
        const pattern = this.patterns.find(p => p.name === patternName);
        if (!pattern) return;

        this.selectedPattern = patternName;
        this.patternExplorer.setActiveFile(pattern.path);
        if (this.onPatternSelect) this.onPatternSelect(patternName);
    }

    /**
     * Set playing state for audio preview
     */
    setPlayingState(filePath, isPlaying) {
        if (this.patternExplorer) {
            this.patternExplorer.setPlayingFile(filePath, isPlaying);
        }
    }

    // --- Comparison mode ---

    toggleComparisonMode() {
        this.isComparisonMode = !this.isComparisonMode;
        this.toggleBtn.classList.toggle('pattern-explorer-analysis__compare-btn--active', this.isComparisonMode);

        if (!this.isComparisonMode) {
            // Exit comparison mode — clear comparison selections
            this.comparisonPatterns = [];
            this._updateComparisonUI();

            // Restore single selection
            if (this.selectedPattern) {
                const pattern = this.patterns.find(p => p.name === this.selectedPattern);
                if (pattern) this.patternExplorer.setActiveFile(pattern.path);
                if (this.onPatternSelect) this.onPatternSelect(this.selectedPattern);
            }
        } else {
            // Enter comparison mode — start with currently selected pattern
            this.comparisonPatterns = [];
            if (this.selectedPattern) {
                this.comparisonPatterns.push(this.selectedPattern);
            }
            // Clear active state since we use checkboxes now
            this.patternExplorer.setActiveFile(null);
            this._updateComparisonUI();
        }
    }

    _toggleComparison(patternName) {
        const index = this.comparisonPatterns.indexOf(patternName);
        if (index >= 0) {
            this.comparisonPatterns.splice(index, 1);
        } else {
            if (this.comparisonPatterns.length < 4) {
                this.comparisonPatterns.push(patternName);
            }
        }

        this._updateComparisonUI();

        if (this.onComparisonChange) {
            this.onComparisonChange([...this.comparisonPatterns]);
        }
    }

    _updateComparisonUI() {
        const colors = typeof COMPARISON_COLORS !== 'undefined' ? COMPARISON_COLORS : ['#333', '#999', '#cc0000', '#006699'];
        const listContainer = document.getElementById(this.listContainerId);
        if (!listContainer) return;

        const items = listContainer.querySelectorAll('.file-item');
        items.forEach(item => {
            const filePath = item.dataset.filePath;
            const pattern = this.patterns.find(p => p.path === filePath);
            if (!pattern) return;

            const compIndex = this.comparisonPatterns.indexOf(pattern.name);
            const isInComparison = compIndex >= 0;

            item.classList.toggle('pattern-explorer-analysis__item--comparison', isInComparison);

            if (isInComparison) {
                item.style.borderLeftColor = colors[compIndex % colors.length];
            } else {
                item.style.borderLeftColor = '';
            }
        });
    }

    destroy() {
        if (this.toggleBtn && this.boundHandlers.toggleClick) {
            this.toggleBtn.removeEventListener('click', this.boundHandlers.toggleClick);
        }
        if (this.patternExplorer) {
            this.patternExplorer.destroy();
        }
        this.boundHandlers = {};
        if (this.container) {
            this.container.innerHTML = '';
            this.container.classList.remove('pattern-explorer-analysis');
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PatternExplorerForAnalysis;
}
