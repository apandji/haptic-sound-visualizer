# Components Directory

This directory contains reusable UI components organized into base components, variants, and examples.

## Structure

```
components/
├── base/              # Standalone, reusable components
├── variants/          # Composed components (combine base components)
├── examples/          # Example/test pages for components
└── README.md          # This file
```

## Base Components (`base/`)

Standalone UI components that can be used independently.

- **PatternExplorer** - File list with tooltips and play buttons
- **DualSlider** - Dual-handle range slider (planned)
- **FilterPanel** - Search + filter sliders (planned)
- **Visualizer** - p5.js audio visualization (planned)
- **AudioControls** - Playback controls (planned)

See `base/README.md` for details.

## Variants (`variants/`)

Composed components that combine multiple base components.

- **PatternExplorerWithFilters** - PatternExplorer + FilterPanel (planned)
- **PatternExplorerSelectable** - PatternExplorer + SelectionManager (planned)
- **PatternExplorerTestMode** - Full featured for Test page (planned)

See `variants/README.md` for details.

## Examples (`examples/`)

Standalone HTML pages for testing components in isolation.

- `pattern-explorer.example.html` - Test PatternExplorer component
- `dual-slider.example.html` - Test DualSlider component (planned)
- `filter-panel.example.html` - Test FilterPanel component (planned)

## Usage

### Base Component
```javascript
// Import base component
<script src="js/components/base/PatternExplorer.js"></script>

// Use it
const explorer = new PatternExplorer({
  containerId: 'fileList',
  files: [...],
  metadata: {...}
});
```

### Variant Component
```javascript
// Import variant
<script src="js/components/variants/PatternExplorerWithFilters.js"></script>

// Use it
const explorer = new PatternExplorerWithFilters({
  containerId: 'fileList',
  filterContainerId: 'filterPanel',
  files: [...],
  metadata: {...}
});
```

## Documentation

- **Organization Guide**: `docs/COMPONENT_ORGANIZATION.md`
- **Architecture Plan**: `docs/COMPONENT_ARCHITECTURE.md`
- **Variations Guide**: `docs/PATTERN_EXPLORER_VARIATIONS.md`
- **Phase 1 Plan**: `docs/PHASE_1_PLAN.md`

## Creating New Components

1. **Base Component**: Add to `base/` directory
2. **Variant**: Add to `variants/` directory
3. **Example**: Add to `examples/` directory
4. **CSS**: Add to `css/components/base/` or `css/components/variants/`
5. **Document**: Update relevant README files

See `docs/COMPONENT_ORGANIZATION.md` for detailed guidelines.
