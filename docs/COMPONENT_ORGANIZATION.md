# Component Organization Guide

## Directory Structure

```
js/
├── components/
│   ├── base/                          # Base components (standalone, reusable)
│   │   ├── PatternExplorer.js        # File list component
│   │   ├── FilterPanel.js            # Filters component
│   │   ├── DualSlider.js             # Dual-handle slider
│   │   ├── Visualizer.js             # p5.js visualizer
│   │   └── AudioControls.js          # Playback controls
│   │
│   ├── variants/                      # Composed variants (combine base components)
│   │   ├── PatternExplorerWithFilters.js
│   │   ├── PatternExplorerSelectable.js
│   │   └── PatternExplorerTestMode.js
│   │
│   ├── examples/                      # Example/test pages for components
│   │   ├── pattern-explorer.example.html
│   │   ├── filter-panel.example.html
│   │   └── dual-slider.example.html
│   │
│   └── README.md                      # Component documentation
│
├── modules/                           # Utility modules (non-UI logic)
│   ├── SelectionManager.js           # Multi-select state management
│   ├── DragDropManager.js            # Drag & drop logic
│   ├── filters.js                    # Filter application logic
│   ├── fileLoader.js                 # File loading utilities
│   └── audioPlayer.js                # Audio playback logic
│
├── pages/                            # Page-specific logic
│   ├── library.js                    # Library page
│   ├── test.js                       # Test page
│   └── analyze.js                    # Analysis page
│
└── utils/                            # General utilities
    ├── dom.js                        # DOM helpers
    └── events.js                     # Event utilities

css/
├── components/
│   ├── base/                         # Base component styles
│   │   ├── pattern-explorer.css
│   │   ├── filter-panel.css
│   │   ├── dual-slider.css
│   │   └── visualizer.css
│   │
│   └── variants/                     # Variant-specific overrides
│       └── pattern-explorer-test-mode.css
│
└── styles.css                        # Global/base styles
```

## Naming Conventions

### Files
- **Components**: `PascalCase.js` (e.g., `PatternExplorer.js`)
- **Modules**: `camelCase.js` (e.g., `selectionManager.js`)
- **CSS**: `kebab-case.css` (e.g., `pattern-explorer.css`)
- **Examples**: `component-name.example.html`

### Classes
- **Components**: `PascalCase` (e.g., `class PatternExplorer`)
- **Modules**: `PascalCase` (e.g., `class SelectionManager`)

### Directories
- **Components**: `kebab-case` (e.g., `pattern-explorer/`)
- **Modules**: `kebab-case` (e.g., `selection-manager/`)

## Component Categories

### Base Components (`js/components/base/`)
**Purpose**: Standalone, reusable UI components

**Characteristics**:
- Self-contained (own HTML structure, CSS, JS)
- No dependencies on other components
- Can be used independently
- Follow single responsibility principle

**Examples**:
- `PatternExplorer` - Renders file list
- `FilterPanel` - Renders filters
- `DualSlider` - Renders dual-handle slider
- `Visualizer` - Renders visualization

### Variants (`js/components/variants/`)
**Purpose**: Composed components that combine base components

**Characteristics**:
- Combine multiple base components
- Add specific functionality
- Page-specific or use-case-specific
- Delegate to base components

**Examples**:
- `PatternExplorerWithFilters` - PatternExplorer + FilterPanel
- `PatternExplorerSelectable` - PatternExplorer + SelectionManager
- `PatternExplorerTestMode` - PatternExplorer + FilterPanel + SelectionManager + DragDropManager

### Modules (`js/modules/`)
**Purpose**: Non-UI logic, state management, utilities

**Characteristics**:
- No DOM manipulation (or minimal)
- Reusable logic
- Can be used by multiple components
- Pure functions or stateful managers

**Examples**:
- `SelectionManager` - Manages selection state
- `DragDropManager` - Manages drag & drop state
- `filters.js` - Filter application logic
- `fileLoader.js` - File loading utilities

## File Organization Rules

### 1. One Component Per File
```
✅ PatternExplorer.js (contains PatternExplorer class)
❌ PatternExplorer.js (contains PatternExplorer + FilterPanel + helpers)
```

### 2. Related Files Grouped
```
✅ js/components/base/PatternExplorer.js
✅ css/components/base/pattern-explorer.css
✅ js/components/examples/pattern-explorer.example.html
```

### 3. Clear Separation
```
✅ Base components in js/components/base/
✅ Variants in js/components/variants/
✅ Modules in js/modules/
```

### 4. Consistent Imports
```javascript
// Import base components
import { PatternExplorer } from './base/PatternExplorer.js';
import { FilterPanel } from './base/FilterPanel.js';

// Import modules
import { SelectionManager } from '../../modules/SelectionManager.js';
import { applyFilters } from '../../modules/filters.js';

// Import variants
import { PatternExplorerWithFilters } from './variants/PatternExplorerWithFilters.js';
```

## Component File Structure

### Base Component Template
```javascript
/**
 * ComponentName Component
 * Brief description of what it does
 */
class ComponentName {
  constructor(options = {}) {
    // Initialize properties
    this.containerId = options.containerId;
    this.container = document.getElementById(this.containerId);
    
    // Initialize component
    this.init();
  }
  
  init() {
    // Setup DOM, event listeners, etc.
  }
  
  render(data) {
    // Render component
  }
  
  update(data) {
    // Update component state
  }
  
  destroy() {
    // Cleanup
  }
}

// Export if using modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ComponentName;
}
```

### Variant Component Template
```javascript
/**
 * VariantName Component
 * Composes: BaseComponent1, BaseComponent2
 * Purpose: Specific use case description
 */
class VariantName {
  constructor(options = {}) {
    // Create base components
    this.baseComponent1 = new BaseComponent1({
      containerId: options.containerId1,
      // ... options
    });
    
    this.baseComponent2 = new BaseComponent2({
      containerId: options.containerId2,
      // ... options
    });
    
    // Wire them together
    this.setupConnections();
  }
  
  setupConnections() {
    // Connect components via callbacks
  }
  
  destroy() {
    this.baseComponent1.destroy();
    this.baseComponent2.destroy();
  }
}
```

## CSS Organization

### Base Component Styles
```css
/* css/components/base/pattern-explorer.css */

/* Component root */
.pattern-explorer {
  /* ... */
}

/* Component elements */
.pattern-explorer__file-item {
  /* ... */
}

.pattern-explorer__play-button {
  /* ... */
}
```

### Variant Overrides
```css
/* css/components/variants/pattern-explorer-test-mode.css */

/* Override base styles */
.pattern-explorer-test-mode .pattern-explorer__file-item {
  /* ... */
}

/* Add variant-specific styles */
.pattern-explorer-test-mode__drop-zone {
  /* ... */
}
```

## Documentation Structure

### Component README
Each component should have:
1. **Purpose** - What it does
2. **API** - Constructor options, methods
3. **Usage** - Code examples
4. **Dependencies** - What it needs
5. **Examples** - Link to example file

### Example File
Each component should have an example file:
- `js/components/examples/component-name.example.html`
- Standalone HTML file
- Can be opened directly in browser
- Shows component in isolation
- Includes test data

## Import/Export Strategy

### Option 1: ES6 Modules (Recommended for Future)
```javascript
// PatternExplorer.js
export class PatternExplorer { }

// Usage
import { PatternExplorer } from './components/base/PatternExplorer.js';
```

### Option 2: Global Classes (Current Approach)
```javascript
// PatternExplorer.js
class PatternExplorer { }

// Usage (in HTML)
<script src="js/components/base/PatternExplorer.js"></script>
<script>
  const explorer = new PatternExplorer({ ... });
</script>
```

**Current Status**: Using Option 2 (global classes)
**Future**: Can migrate to ES6 modules when ready

## Migration Plan

### Phase 1: Organize Existing Components
1. Move `PatternExplorer.js` → `js/components/base/PatternExplorer.js`
2. Move `pattern-explorer.css` → `css/components/base/pattern-explorer.css`
3. Update imports in HTML files

### Phase 2: Create New Structure
1. Create `js/components/variants/` directory
2. Create `js/modules/` directory
3. Create `js/components/examples/` directory

### Phase 3: Build New Components
1. Create `FilterPanel` in `js/components/base/`
2. Create `DualSlider` in `js/components/base/`
3. Create `SelectionManager` in `js/modules/`

### Phase 4: Create Variants
1. Create `PatternExplorerWithFilters` in `js/components/variants/`
2. Create `PatternExplorerSelectable` in `js/components/variants/`
3. Create `PatternExplorerTestMode` in `js/components/variants/`

## Benefits of This Organization

1. **Clear Structure** - Easy to find files
2. **Scalable** - Easy to add new components
3. **Maintainable** - Related files grouped together
4. **Testable** - Components isolated
5. **Reusable** - Base components can be used anywhere
6. **Documented** - Clear purpose for each directory

## Quick Reference

### Where to put what?

| Type | Location | Example |
|------|----------|---------|
| Standalone UI component | `js/components/base/` | `PatternExplorer.js` |
| Composed component | `js/components/variants/` | `PatternExplorerWithFilters.js` |
| Non-UI logic | `js/modules/` | `SelectionManager.js` |
| Page logic | `js/pages/` | `library.js` |
| Component CSS | `css/components/base/` | `pattern-explorer.css` |
| Variant CSS | `css/components/variants/` | `pattern-explorer-test-mode.css` |
| Example/test page | `js/components/examples/` | `pattern-explorer.example.html` |
