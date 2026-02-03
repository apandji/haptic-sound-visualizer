# Component Variants

Variants are composed components that combine multiple base components to create specific use cases.

## Variants

### Implemented Variants

- **PatternExplorerWithFilters** ✅ - PatternExplorer + FilterPanel (inline)
  - Automatically wires FilterPanel to PatternExplorer
  - Applies filters when FilterPanel changes
  - Updates PatternExplorer file list automatically
  - Single API for both components
  - **Example**: `js/components/examples/pattern-explorer-with-filters.example.html`
  - **API**:
    ```javascript
    new PatternExplorerWithFilters({
      containerId: 'fileList',
      filterContainerId: 'filterPanel',
      files: allFiles,
      metadata: metadata,
      compact: true,
      collapsible: true,
      onFileClick: (file) => {},
      onFilePreview: (file, isPlaying) => {},
      onFilterChange: (filters, filteredFiles) => {}
    })
    ```

- **PatternExplorerWithFilterDrawer** ✅ - PatternExplorer + FilterDrawer + FilterPanel (slide-out)
  - Filter icon button in PatternExplorer header
  - Slide-out drawer panel from the right
  - Overlays main content area
  - Backdrop overlay with click-to-close
  - Escape key to close
  - **Example**: `js/components/examples/pattern-explorer-with-filter-drawer.example.html`
  - **API**:
    ```javascript
    new PatternExplorerWithFilterDrawer({
      containerId: 'fileList',
      drawerId: 'filterDrawer',
      files: allFiles,
      metadata: metadata,
      drawerWidth: 350,
      drawerPosition: 'right',
      onFileClick: (file) => {},
      onFilePreview: (file, isPlaying) => {},
      onFilterChange: (filters, filteredFiles) => {}
    })
    ```

### Planned Variants

- **PatternExplorerSelectable** - PatternExplorer + SelectionManager
- **PatternExplorerTestMode** - PatternExplorer + FilterPanel + SelectionManager + DragDropManager

---

## Adding a New Variant

1. Create variant file: `VariantName.js`
2. Import base components from `../base/`
3. Import modules from `../../modules/`
4. Compose components in constructor
5. Document in this README
6. Follow the variant template (see COMPONENT_ORGANIZATION.md)
