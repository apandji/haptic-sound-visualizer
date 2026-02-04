# Component Variants

Variants are composed components that combine multiple base components to create specific use cases.

## Variants

### Implemented Variants

- **PatternExplorerWithFilters** ✅ - PatternExplorer + FilterPanel (inline)
  - Automatically wires FilterPanel to PatternExplorer
  - Applies filters when FilterPanel changes
  - Updates PatternExplorer file list automatically
  - Single API for both components
  - **Example**: `dev/components-examples/pattern-explorer-with-filters.example.html`
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

- **PatternExplorerWithSelection** ✅ - PatternExplorer + FilterPanel + selection icons (plus/checkmark) + PatternQueue integration
  - Includes all FilterPanel features (search, metadata filters, collapsible)
  - Adds plus icon to each pattern item
  - Plus icon changes to checkmark when added to queue
  - Clicking checkmark removes from queue
  - Integrates with PatternQueue component
  - Shows pattern count (filtered / total)
  - **Example**: `dev/components-examples/pattern-explorer-with-selection.example.html`
  - **API**:
    ```javascript
    new PatternExplorerWithSelection({
      containerId: 'fileList',
      filterContainerId: 'filterPanel',
      queue: queue,  // PatternQueue component instance
      files: allFiles,
      metadata: metadata,
      compact: true,
      collapsible: true,
      defaultCollapsed: true,
      onSelectionChange: (file, isAdded) => {
        // Called when item added/removed from queue
      },
      onFilterChange: (filters, filteredFiles) => {
        // Called when filters change
      },
      onFileClick: (file) => {},
      onFilePreview: (file, isPlaying) => {}
    })
    ```

### Planned Variants

- **PatternExplorerTestMode** - PatternExplorer + FilterPanel + PatternExplorerWithSelection + PatternQueue (full Test page)

---

## Adding a New Variant

1. Create variant file: `VariantName.js`
2. Import base components from `../base/`
3. Import modules from `../../modules/`
4. Compose components in constructor
5. Document in this README
6. Follow the variant template (see COMPONENT_ORGANIZATION.md)
