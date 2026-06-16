/**
 * PatternLibraryShell — shared header, search, and filter chrome for pattern library variants.
 *
 * filterPresentation:
 *   'inline'  — collapsible filter panel below search (Explore)
 *   'popover' — filter icon opens dropdown; sliders always visible inside (Test)
 */
const PatternLibraryShell = {
    FILTER_ICON_SVG: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>`,

    initChrome(variant, options = {}) {
        if (!variant.parentContainer) {
            console.error('PatternLibraryShell: parent container not found');
            return null;
        }

        variant.filterPresentation = options.filterPresentation || 'inline';
        variant.headerLabel = options.headerLabel || 'PATTERN LIBRARY';
        variant.searchPlaceholder = options.searchPlaceholder || 'Search patterns...';
        variant.compact = options.compact !== undefined ? options.compact : true;
        variant.collapsible = variant.filterPresentation === 'inline'
            ? (options.collapsible !== undefined ? options.collapsible : true)
            : false;
        variant.defaultCollapsed = options.defaultCollapsed !== undefined ? options.defaultCollapsed : true;
        variant.boundHandlers = variant.boundHandlers || {};
        variant.searchQuery = variant.searchQuery || '';

        const wrapper = this.createStickyWrapper(variant);
        if (!wrapper) return null;

        this.ensureFilterContainer(variant, wrapper);
        this.moveExistingChromeIntoWrapper(variant, wrapper);
        this.createHeader(variant);
        this.createSearchBox(variant);

        if (variant.filterPresentation === 'popover') {
            wrapper.classList.add('pattern-explorer-sticky-wrapper--popover');
        }

        variant.filterPanel = new FilterPanel({
            containerId: variant.filterContainerId,
            metadata: variant.metadata,
            compact: variant.compact,
            collapsible: variant.collapsible,
            defaultCollapsed: variant.defaultCollapsed,
            searchPlaceholder: variant.searchPlaceholder,
            includeSearch: false,
            onFilterChange: (filters) => {
                filters.search = variant.searchQuery || '';
                if (typeof variant.handleFilterChange === 'function') {
                    variant.handleFilterChange(filters);
                }
            },
            onReset: () => {
                if (variant.searchInput) {
                    variant.searchInput.value = '';
                    variant.searchQuery = '';
                }
                if (typeof variant.handleFilterReset === 'function') {
                    variant.handleFilterReset();
                }
            },
        });

        if (variant.filterPresentation === 'popover') {
            this.setupPopoverFilters(variant);
        }

        this.updatePatternCount(variant);
        return wrapper;
    },

    createStickyWrapper(variant) {
        let wrapper = variant.parentContainer.querySelector('.pattern-explorer-sticky-wrapper');
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.className = 'pattern-explorer-sticky-wrapper';
            const insertBefore = variant.container || variant.parentContainer.firstChild;
            if (insertBefore) {
                variant.parentContainer.insertBefore(wrapper, insertBefore);
            } else {
                variant.parentContainer.appendChild(wrapper);
            }
        }
        variant.stickyWrapper = wrapper;
        return wrapper;
    },

    ensureFilterContainer(variant, wrapper) {
        let filterContainer = document.getElementById(variant.filterContainerId);
        if (!filterContainer) {
            filterContainer = document.createElement('div');
            filterContainer.id = variant.filterContainerId;
            wrapper.appendChild(filterContainer);
        } else if (filterContainer.parentElement !== wrapper) {
            wrapper.appendChild(filterContainer);
        }
    },

    moveExistingChromeIntoWrapper(variant, wrapper) {
        const existingHeader = variant.parentContainer.querySelector('.pattern-explorer-header');
        if (existingHeader && existingHeader.parentElement !== wrapper) {
            wrapper.insertBefore(existingHeader, wrapper.firstChild);
        }

        const existingSearch = variant.parentContainer.querySelector('.pattern-explorer-search');
        if (existingSearch && existingSearch.parentElement !== wrapper) {
            const header = wrapper.querySelector('.pattern-explorer-header');
            if (header) {
                wrapper.insertBefore(existingSearch, header.nextSibling);
            } else {
                wrapper.insertBefore(existingSearch, wrapper.firstChild);
            }
        }
    },

    createHeader(variant) {
        if (!variant.stickyWrapper) return;

        let header = variant.stickyWrapper.querySelector('.pattern-explorer-header');
        if (!header && variant.parentContainer) {
            header = variant.parentContainer.querySelector('.pattern-explorer-header');
            if (header && header.parentElement !== variant.stickyWrapper) {
                variant.stickyWrapper.insertBefore(header, variant.stickyWrapper.firstChild);
            }
        }

        if (!header) {
            header = document.createElement('div');
            header.className = 'pattern-explorer-header';

            const headerText = document.createElement('span');
            headerText.className = 'section-label pattern-explorer-header__text';
            headerText.textContent = variant.headerLabel;
            header.appendChild(headerText);

            const headerCount = document.createElement('span');
            headerCount.className = 'pattern-explorer-header__count';
            header.appendChild(headerCount);

            variant.stickyWrapper.insertBefore(header, variant.stickyWrapper.firstChild);
        } else {
            const headerText = header.querySelector('.pattern-explorer-header__text');
            if (headerText) {
                headerText.textContent = variant.headerLabel;
            }
            if (!header.querySelector('.pattern-explorer-header__count')) {
                const headerCount = document.createElement('span');
                headerCount.className = 'pattern-explorer-header__count';
                header.appendChild(headerCount);
            }
        }
    },

    createSearchBox(variant) {
        if (!variant.stickyWrapper) return;

        let searchContainer = variant.stickyWrapper.querySelector('.pattern-explorer-search');
        if (!searchContainer && variant.parentContainer) {
            searchContainer = variant.parentContainer.querySelector('.pattern-explorer-search');
            if (searchContainer && searchContainer.parentElement !== variant.stickyWrapper) {
                const header = variant.stickyWrapper.querySelector('.pattern-explorer-header');
                if (header) {
                    variant.stickyWrapper.insertBefore(searchContainer, header.nextSibling);
                } else {
                    variant.stickyWrapper.insertBefore(searchContainer, variant.stickyWrapper.firstChild);
                }
            }
        }

        if (!searchContainer) {
            searchContainer = document.createElement('div');
            searchContainer.className = 'pattern-explorer-search';

            variant.searchInput = document.createElement('input');
            variant.searchInput.type = 'text';
            variant.searchInput.className = 'input pattern-explorer-search-input';
            variant.searchInput.id = `${variant.filterContainerId}_search`;
            variant.searchInput.placeholder = variant.searchPlaceholder;
            variant.searchInput.autocomplete = 'off';

            variant.boundHandlers.searchInput = (event) => {
                variant.searchQuery = event.target.value.trim().toLowerCase();
                if (variant.filterPanel) {
                    const filters = variant.filterPanel.getFilters();
                    filters.search = variant.searchQuery;
                    if (typeof variant.handleFilterChange === 'function') {
                        variant.handleFilterChange(filters);
                    }
                }
            };
            variant.searchInput.addEventListener('input', variant.boundHandlers.searchInput);
            searchContainer.appendChild(variant.searchInput);

            this.insertSearchContainer(variant, searchContainer);
        } else {
            variant.searchInput = searchContainer.querySelector('.pattern-explorer-search-input');
        }
    },

    insertSearchContainer(variant, searchContainer) {
        const wrapper = variant.stickyWrapper;
        const header = wrapper.querySelector('.pattern-explorer-header');
        const filterPanel = document.getElementById(variant.filterContainerId);

        if (variant.filterPresentation === 'popover') {
            let row = wrapper.querySelector('.pattern-explorer-search-row');
            if (!row) {
                row = document.createElement('div');
                row.className = 'pattern-explorer-search-row';
                if (header) {
                    wrapper.insertBefore(row, header.nextSibling);
                } else {
                    wrapper.insertBefore(row, wrapper.firstChild);
                }
            }
            row.appendChild(searchContainer);
            return;
        }

        if (filterPanel && wrapper.contains(filterPanel)) {
            wrapper.insertBefore(searchContainer, filterPanel);
        } else if (header && header.nextSibling) {
            wrapper.insertBefore(searchContainer, header.nextSibling);
        } else {
            wrapper.appendChild(searchContainer);
        }
    },

    setupPopoverFilters(variant) {
        const fp = document.getElementById(variant.filterContainerId);
        if (!fp || !fp.parentNode) return;

        const parent = fp.parentNode;
        if (parent.classList.contains('filter-popover__content')) return;

        const wrap = document.createElement('div');
        wrap.className = 'filter-popover';

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'filter-popover__trigger';
        trigger.setAttribute('aria-label', 'Open filters');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.innerHTML = this.FILTER_ICON_SVG;

        const popoverContent = document.createElement('div');
        popoverContent.className = 'filter-popover__content';

        parent.insertBefore(wrap, fp);
        parent.removeChild(fp);
        popoverContent.appendChild(fp);
        wrap.appendChild(trigger);
        wrap.appendChild(popoverContent);

        variant.filterPopover = { wrap, trigger, popoverContent };

        trigger.addEventListener('click', (event) => {
            event.stopPropagation();
            const open = popoverContent.classList.toggle('is-open');
            trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
            trigger.classList.toggle('filter-popover__trigger--active', open);
        });

        variant.boundHandlers.popoverClose = (event) => {
            if (!wrap.contains(event.target)) {
                popoverContent.classList.remove('is-open');
                trigger.setAttribute('aria-expanded', 'false');
                trigger.classList.remove('filter-popover__trigger--active');
            }
        };
        document.addEventListener('click', variant.boundHandlers.popoverClose);

        const row = variant.stickyWrapper?.querySelector('.pattern-explorer-search-row');
        if (row) {
            row.appendChild(wrap);
        }
    },

    updatePatternCount(variant) {
        if (!variant.stickyWrapper) {
            variant.stickyWrapper = variant.parentContainer?.querySelector('.pattern-explorer-sticky-wrapper');
        }
        if (!variant.stickyWrapper) return;

        const header = variant.stickyWrapper.querySelector('.pattern-explorer-header');
        if (!header) return;

        let countEl = header.querySelector('.pattern-explorer-header__count');
        if (!countEl) {
            countEl = document.createElement('span');
            countEl.className = 'pattern-explorer-header__count';
            header.appendChild(countEl);
        }

        const count = variant.filteredFiles ? variant.filteredFiles.length : 0;
        const total = variant.allFiles ? variant.allFiles.length : 0;
        countEl.textContent = count === total ? `${count}` : `${count} / ${total}`;
    },

    applyFilters(variant, filters) {
        if (typeof Filters !== 'undefined') {
            variant.filteredFiles = Filters.applyFilters(variant.allFiles, filters, variant.metadata);
        } else {
            variant.filteredFiles = [...variant.allFiles];
        }
        this.updatePatternCount(variant);
        return variant.filteredFiles;
    },

    destroy(variant) {
        if (variant.searchInput && variant.boundHandlers?.searchInput) {
            variant.searchInput.removeEventListener('input', variant.boundHandlers.searchInput);
        }
        if (variant.boundHandlers?.popoverClose) {
            document.removeEventListener('click', variant.boundHandlers.popoverClose);
        }
        if (variant.filterPanel?.destroy) {
            variant.filterPanel.destroy();
        }
    },
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PatternLibraryShell;
}
