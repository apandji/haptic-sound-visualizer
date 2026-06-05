/**
 * PatternExplorerForAnalysis — sidebar pattern list for Analyze.
 */
class PatternExplorerForAnalysis {
    constructor(options = {}) {
        this.containerId = options.containerId || 'patternList';
        this.container = document.getElementById(this.containerId);
        this.onPatternSelect = options.onPatternSelect || null;
        this.onFilePreview = options.onFilePreview || null;
        this.patterns = [];
        this.selectedPattern = null;
        this.withDataOnly = true;
        this.searchQuery = '';
        this.boundHandlers = {};
        if (!this.container) return;
        this.init();
    }

    init() {
        this.container.classList.add('pattern-explorer-analysis');

        this.searchRow = document.createElement('div');
        this.searchRow.className = 'pattern-explorer-analysis__search-row';

        this.searchInput = document.createElement('input');
        this.searchInput.type = 'search';
        this.searchInput.className = 'pattern-explorer-analysis__search';
        this.searchInput.placeholder = 'Search…';
        this.boundHandlers.searchInput = () => {
            this.searchQuery = this.searchInput.value.trim().toLowerCase();
            this._injectPatternBadges();
        };
        this.searchInput.addEventListener('input', this.boundHandlers.searchInput);

        this.dataToggleBtn = document.createElement('button');
        this.dataToggleBtn.type = 'button';
        this.dataToggleBtn.className = 'pattern-explorer-analysis__text-btn';
        this.dataToggleBtn.textContent = 'With data';
        this.dataToggleBtn.title = 'Show only patterns with trials';
        this.boundHandlers.dataToggle = () => {
            this.withDataOnly = !this.withDataOnly;
            this.dataToggleBtn.textContent = this.withDataOnly ? 'With data' : 'All';
            this.dataToggleBtn.classList.toggle('pattern-explorer-analysis__text-btn--active', !this.withDataOnly);
            this.setPatterns(this.patterns);
        };
        this.dataToggleBtn.addEventListener('click', this.boundHandlers.dataToggle);

        this.searchRow.appendChild(this.searchInput);
        this.searchRow.appendChild(this.dataToggleBtn);

        this.listContainerId = this.containerId + '_list';
        const listContainer = document.createElement('div');
        listContainer.id = this.listContainerId;
        listContainer.className = 'pattern-explorer-analysis__list';

        this.container.innerHTML = '';
        this.container.appendChild(this.searchRow);
        this.container.appendChild(listContainer);

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

    setPatterns(patterns) {
        this.patterns = patterns || [];
        const visible = this.withDataOnly
            ? this.patterns.filter(pattern => pattern.trialCount > 0)
            : this.patterns;
        this.patternExplorer.render(visible.map(pattern => ({
            name: pattern.name,
            path: pattern.path
        })));
        this._injectPatternBadges();
    }

    _injectPatternBadges() {
        const listContainer = document.getElementById(this.listContainerId);
        if (!listContainer) return;

        listContainer.querySelectorAll('.file-item').forEach(item => {
            const filePath = item.dataset.filePath;
            const patternName = item.querySelector('.file-item-text')?.textContent;
            const pattern = this.patterns.find(entry => entry.path === filePath || entry.name === patternName);
            if (!pattern) return;

            const matchesSearch = !this.searchQuery || pattern.name.toLowerCase().includes(this.searchQuery);
            const matchesData = !this.withDataOnly || pattern.trialCount > 0;
            item.style.display = matchesSearch && matchesData ? '' : 'none';

            item.querySelectorAll('.pattern-explorer-analysis__badges').forEach(el => el.remove());

            const badges = document.createElement('span');
            badges.className = 'pattern-explorer-analysis__badges';

            if (pattern.trialCount > 0) {
                const count = document.createElement('span');
                count.className = 'pattern-explorer-analysis__badge';
                count.textContent = String(pattern.trialCount);
                count.title = `${pattern.trialCount} trial(s)`;
                badges.appendChild(count);
            }

            if (pattern.hasNewData) {
                const dot = document.createElement('span');
                dot.className = 'pattern-explorer-analysis__dot pattern-explorer-analysis__dot--new';
                dot.title = 'New data since last viewed';
                badges.appendChild(dot);
            }

            item.appendChild(badges);
        });
    }

    handleFileClick(file) {
        this.selectedPattern = file.name;
        this.patternExplorer.setActiveFile(file.path);
        if (this.onPatternSelect) this.onPatternSelect(file.name);
    }

    selectPattern(patternName) {
        const pattern = this.patterns.find(entry => entry.name === patternName);
        if (!pattern) return;
        this.selectedPattern = patternName;
        this.patternExplorer.setActiveFile(pattern.path);
        if (this.onPatternSelect) this.onPatternSelect(patternName);
    }

    setPlayingState(filePath, isPlaying) {
        if (this.patternExplorer) this.patternExplorer.setPlayingFile(filePath, isPlaying);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PatternExplorerForAnalysis;
}
