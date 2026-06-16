/**
 * PatternExplorerForAnalysis — sidebar pattern list for Analyze.
 */
class PatternExplorerForAnalysis {
    constructor(options = {}) {
        this.containerId = options.containerId || 'patternList';
        this.container = document.getElementById(this.containerId);
        this.onPatternSelect = options.onPatternSelect || null;
        this.onFilePreview = options.onFilePreview || null;
        // externalControls: search + sort are driven from outside
        // (the global modebar) via setSearchQuery / setSortBy.
        this.externalControls = Boolean(options.externalControls);
        this.patterns = [];
        this.selectedPattern = null;
        this.withDataOnly = true;
        this.searchQuery = '';
        this.sortBy = 'trials'; // 'name' | 'trials'
        this.boundHandlers = {};
        if (!this.container) return;
        this.init();
    }

    init() {
        this.container.classList.add('pattern-explorer-analysis');

        this.searchRow = document.createElement('div');
        this.searchRow.className = 'pattern-explorer-analysis__search-row';

        if (!this.externalControls) {
            this.searchInput = document.createElement('input');
            this.searchInput.type = 'search';
            this.searchInput.className = 'input pattern-explorer-analysis__search';
            this.searchInput.placeholder = 'Search…';
            this.boundHandlers.searchInput = () => {
                this.searchQuery = this.searchInput.value.trim().toLowerCase();
                this._renderList();
            };
            this.searchInput.addEventListener('input', this.boundHandlers.searchInput);
        }

        this.dataToggleBtn = document.createElement('button');
        this.dataToggleBtn.type = 'button';
        this.dataToggleBtn.className = 'pattern-explorer-analysis__text-btn';
        this.dataToggleBtn.textContent = 'With data';
        this.dataToggleBtn.title = 'Show only patterns with trials';
        this.boundHandlers.dataToggle = () => {
            this.withDataOnly = !this.withDataOnly;
            this.dataToggleBtn.textContent = this.withDataOnly ? 'With data' : 'All';
            this.dataToggleBtn.classList.toggle('pattern-explorer-analysis__text-btn--active', !this.withDataOnly);
            this._renderList();
        };
        this.dataToggleBtn.addEventListener('click', this.boundHandlers.dataToggle);

        if (this.searchInput) this.searchRow.appendChild(this.searchInput);
        this.searchRow.appendChild(this.dataToggleBtn);

        if (!this.externalControls) {
            this.sortRow = document.createElement('div');
            this.sortRow.className = 'pattern-explorer-analysis__sort-row';

            const sortLabel = document.createElement('label');
            sortLabel.className = 'pattern-explorer-analysis__sort-label';
            sortLabel.setAttribute('for', `${this.containerId}_sort`);
            sortLabel.textContent = 'Sort';

            this.sortSelect = document.createElement('select');
            this.sortSelect.id = `${this.containerId}_sort`;
            this.sortSelect.className = 'select pattern-explorer-analysis__sort-select';
            this.sortSelect.setAttribute('aria-label', 'Sort patterns');
            [
                { value: 'name', label: 'Name' },
                { value: 'trials', label: 'Trials' }
            ].forEach(({ value, label }) => {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = label;
                if (value === this.sortBy) option.selected = true;
                this.sortSelect.appendChild(option);
            });
            this.boundHandlers.sortChange = () => {
                this.sortBy = this.sortSelect.value;
                this._renderList();
            };
            this.sortSelect.addEventListener('change', this.boundHandlers.sortChange);

            this.sortRow.appendChild(sortLabel);
            this.sortRow.appendChild(this.sortSelect);
        }

        this.listContainerId = this.containerId + '_list';
        const listContainer = document.createElement('div');
        listContainer.id = this.listContainerId;
        listContainer.className = 'pattern-explorer-analysis__list';

        this.container.innerHTML = '';
        this.container.appendChild(this.searchRow);
        if (this.sortRow) this.container.appendChild(this.sortRow);
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
        this._renderList();
    }

    setSearchQuery(query) {
        this.searchQuery = String(query || '').trim().toLowerCase();
        this._renderList();
    }

    setSortBy(sortBy) {
        this.sortBy = sortBy;
        this._renderList();
    }

    _getVisiblePatterns() {
        let list = this.withDataOnly
            ? this.patterns.filter(pattern => pattern.trialCount > 0)
            : [...this.patterns];

        if (this.searchQuery) {
            list = list.filter(pattern => pattern.name.toLowerCase().includes(this.searchQuery));
        }

        list.sort(this._getSortCompareFn());
        return list;
    }

    _getSortCompareFn() {
        if (this.sortBy === 'name') {
            return (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        }

        if (this.sortBy === 'confidence') {
            return (a, b) => {
                const av = a.confidence ?? 0;
                const bv = b.confidence ?? 0;
                if (bv !== av) return bv - av;
                return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
            };
        }

        return (a, b) => {
            if (a.trialCount === 0 && b.trialCount > 0) return 1;
            if (b.trialCount === 0 && a.trialCount > 0) return -1;
            if (b.trialCount !== a.trialCount) return b.trialCount - a.trialCount;
            return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        };
    }

    _renderList() {
        const visible = this._getVisiblePatterns();
        this.patternExplorer.render(visible.map(pattern => ({
            name: pattern.name,
            path: pattern.path
        })));
        this._injectPatternBadges();

        if (this.selectedPattern) {
            const selected = this.patterns.find(entry => entry.name === this.selectedPattern);
            if (selected) this.patternExplorer.setActiveFile(selected.path);
        }
    }

    _injectPatternBadges() {
        const listContainer = document.getElementById(this.listContainerId);
        if (!listContainer) return;

        listContainer.querySelectorAll('.file-item').forEach(item => {
            const filePath = item.dataset.filePath;
            const patternName = item.querySelector('.file-item-text')?.textContent;
            const pattern = this.patterns.find(entry => entry.path === filePath || entry.name === patternName);
            if (!pattern) return;

            item.style.display = '';

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
        this.setSelectedPattern(patternName);
        if (this.onPatternSelect) this.onPatternSelect(patternName);
    }

    /** Sync the visual selection without firing onPatternSelect. Pass null to clear. */
    setSelectedPattern(patternName) {
        this.selectedPattern = patternName || null;
        const pattern = patternName
            ? this.patterns.find(entry => entry.name === patternName)
            : null;
        this.patternExplorer.setActiveFile(pattern ? pattern.path : null);
    }

    setPlayingState(filePath, isPlaying) {
        if (this.patternExplorer) this.patternExplorer.setPlayingFile(filePath, isPlaying);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PatternExplorerForAnalysis;
}
