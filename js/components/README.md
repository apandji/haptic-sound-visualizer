# Components Directory

This directory contains reusable UI components organized into base components, variants, and examples.

## Structure

```
components/
├── base/              # Standalone, reusable components
├── variants/          # Composed components (combine base components)
└── README.md          # This file
```

**Note**: Example/test files are located in `/dev/components-examples/` and `/dev/modules-examples/`

## Base Components (`base/`)

Standalone UI components that can be used independently.

- **PatternExplorer** ✅ - File list with tooltips and play buttons
- **DualSlider** ✅ - Dual-handle range slider
- **FilterPanel** ✅ - Search + filter sliders
- **PatternQueue** ✅ - Queue of selected patterns with drag & drop reordering
- **SessionInfo** ✅ - Form for collecting session metadata
- **Visualizer** ✅ - p5.js audio visualization
- **AudioControls** ✅ - Playback controls

See `base/README.md` for details.

## Variants (`variants/`)

Composed components that combine multiple base components.

- **PatternExplorerWithFilters** ✅ - PatternExplorer + FilterPanel (inline)
- **PatternExplorerWithSelection** ✅ - PatternExplorer + selection icons + Queue integration
- **PatternExplorerTestMode** - Full featured for Test page (planned)

See `variants/README.md` for details.

## Usage

### Base Component
```javascript
// Import base component
<script src="js/components/base/patternExplorer.js"></script>

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
<script src="js/components/variants/patternExplorerWithFilters.js"></script>

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
3. **Example**: Add to `dev/components-examples/` directory
4. **CSS**: Add to `css/components/base/` or `css/components/variants/`
5. **Document**: Update relevant README files

See `docs/COMPONENT_ORGANIZATION.md` for detailed guidelines.
