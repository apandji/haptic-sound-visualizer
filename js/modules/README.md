# Modules

Modules contain non-UI logic, state management, and utilities that can be used by multiple components.

## Modules

### Implemented Modules

- **filters.js** ✅ - Pure filter application logic
  - `applyFilters(files, filters, metadata)` - Apply all filters
  - `filterBySearch(files, searchQuery)` - Filter by search term
  - `filterByMetadata(files, filters, metadata)` - Filter by metadata ranges
  - `filterByRange(value, range, defaultMin, defaultMax)` - Check if value is in range
  - `calculateRanges(metadata)` - Calculate min/max ranges from metadata
  - **Example**: `dev/modules-examples/filters.example.html`

### Planned Modules

- **SelectionManager** - Manages multi-select state
- **DragDropManager** - Manages drag & drop state
- **fileLoader.js** - File loading utilities
- **audioPlayer.js** - Audio playback logic

---

## Adding a New Module

1. Create module file: `moduleName.js`
2. Export class or functions
3. Keep DOM manipulation minimal
4. Document API in this README
5. Follow module patterns (see COMPONENT_ORGANIZATION.md)
