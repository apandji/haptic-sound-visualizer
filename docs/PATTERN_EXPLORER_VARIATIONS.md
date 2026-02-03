# PatternExplorer Variations: Architecture Proposal

## Question
How should we structure PatternExplorer variations that include:
- **Filters** (search + dual sliders)
- **Multi-select** (select multiple files)
- **Drag & Drop** (drag files to queue/test area)
- **Test Page** specific features

## Recommended Approach: **Composition-Based Architecture**

### Core Principle
**Separate concerns into independent, composable pieces** rather than creating monolithic variations.

---

## Architecture Overview

### Base Component (What We Have)
```
PatternExplorer (base)
├── File list rendering
├── Tooltip display
├── Play/pause buttons
└── Basic click/hover handlers
```

### Feature Modules (New)
```
FilterPanel (component)
├── Search box
├── Dual sliders (RMS, Duration, Balance, Movement)
└── Reset button

SelectionManager (module)
├── Multi-select state
├── Selection UI (checkboxes/visual indicators)
└── Selection callbacks

DragDropManager (module)
├── Drag initiation
├── Drop zones
└── Drag/drop callbacks
```

### Composed Variants (New)
```
PatternExplorerWithFilters
├── PatternExplorer (base)
└── FilterPanel (component)

PatternExplorerSelectable
├── PatternExplorer (base)
└── SelectionManager (module)

PatternExplorerTestMode
├── PatternExplorer (base)
├── FilterPanel (component)
├── SelectionManager (module)
└── DragDropManager (module)
```

---

## Detailed Structure

### 1. PatternExplorer (Base Component) ✅
**Status**: Already exists

**Responsibilities**:
- Render file list
- Handle file clicks/hovers
- Display tooltips
- Play/pause buttons
- Progress bars (optional)

**What it DOESN'T do**:
- ❌ Filtering logic
- ❌ Selection state
- ❌ Drag & drop

**API**:
```javascript
new PatternExplorer({
  containerId: 'fileList',
  files: [...],
  metadata: {...},
  onFileClick: (file) => {},
  onFilePreview: (file) => {},
  showProgressBar: false
})
```

---

### 2. FilterPanel (New Component)

**Purpose**: Separate component for filters

**File**: `js/components/FilterPanel.js`

**Responsibilities**:
- Render search box
- Render dual sliders (RMS, Duration, Balance, Movement)
- Handle filter changes
- Reset filters

**API**:
```javascript
const filterPanel = new FilterPanel({
  containerId: 'filterPanel',
  metadata: {...}, // For calculating min/max ranges
  onFilterChange: (filters) => {
    // filters = { search: '', rms: [min, max], duration: [min, max], ... }
    // Apply filters and update PatternExplorer
  },
  onReset: () => {}
});

// Get current filter values
const filters = filterPanel.getFilters();

// Set filter values programmatically
filterPanel.setFilters({ search: 'test', rms: [0.1, 0.5] });
```

**Dependencies**:
- `DualSlider` component (reusable)

---

### 3. SelectionManager (New Module)

**Purpose**: Handle multi-select state and UI

**File**: `js/modules/SelectionManager.js`

**Responsibilities**:
- Track selected files
- Add/remove selections
- Toggle selection
- Clear selections
- Emit selection change events

**API**:
```javascript
const selectionManager = new SelectionManager({
  onSelectionChange: (selectedFiles) => {
    // selectedFiles = [file1, file2, ...]
  }
});

// Enable selection mode on PatternExplorer
patternExplorer.enableSelection(selectionManager);

// Programmatic selection
selectionManager.select(file);
selectionManager.deselect(file);
selectionManager.toggle(file);
selectionManager.clear();

// Get selections
const selected = selectionManager.getSelected();
```

**Integration with PatternExplorer**:
- PatternExplorer adds checkboxes when selection is enabled
- PatternExplorer calls `selectionManager.toggle(file)` on checkbox click
- PatternExplorer highlights selected items visually

---

### 4. DragDropManager (New Module)

**Purpose**: Handle drag & drop functionality

**File**: `js/modules/DragDropManager.js`

**Responsibilities**:
- Make file items draggable
- Register drop zones
- Handle drag start/end
- Handle drop events
- Visual feedback during drag

**API**:
```javascript
const dragDropManager = new DragDropManager({
  onDragStart: (file, event) => {
    // File being dragged
  },
  onDrop: (file, dropZone, event) => {
    // File dropped on dropZone
  },
  onDragEnd: (event) => {
    // Drag operation ended
  }
});

// Enable drag on PatternExplorer
patternExplorer.enableDragDrop(dragDropManager);

// Register drop zones (e.g., queue area)
dragDropManager.registerDropZone('queue-area', {
  onDrop: (file) => {
    // Add to queue
  }
});
```

**Integration with PatternExplorer**:
- PatternExplorer adds `draggable="true"` to file items
- PatternExplorer adds drag event listeners
- PatternExplorer provides visual feedback (opacity, cursor)

---

## Composed Variants

### PatternExplorerWithFilters

**File**: `js/components/PatternExplorerWithFilters.js`

**Purpose**: PatternExplorer + FilterPanel

**Implementation**:
```javascript
class PatternExplorerWithFilters {
  constructor(options) {
    // Create FilterPanel
    this.filterPanel = new FilterPanel({
      containerId: options.filterContainerId,
      metadata: options.metadata,
      onFilterChange: (filters) => {
        // Apply filters to files
        const filteredFiles = applyFilters(options.files, filters, options.metadata);
        // Update PatternExplorer
        this.patternExplorer.render(filteredFiles);
      }
    });
    
    // Create PatternExplorer
    this.patternExplorer = new PatternExplorer({
      containerId: options.containerId,
      files: options.files,
      metadata: options.metadata,
      onFileClick: options.onFileClick,
      onFilePreview: options.onFilePreview
    });
  }
  
  render(files) {
    this.patternExplorer.render(files);
  }
  
  updateFilters(filters) {
    this.filterPanel.setFilters(filters);
  }
  
  destroy() {
    this.filterPanel.destroy();
    this.patternExplorer.destroy();
  }
}
```

**Usage**:
```javascript
const explorer = new PatternExplorerWithFilters({
  containerId: 'fileList',
  filterContainerId: 'filterPanel',
  files: allFiles,
  metadata: metadata,
  onFileClick: (file) => {},
  onFilePreview: (file) => {}
});
```

---

### PatternExplorerSelectable

**File**: `js/components/PatternExplorerSelectable.js`

**Purpose**: PatternExplorer + SelectionManager

**Implementation**:
```javascript
class PatternExplorerSelectable {
  constructor(options) {
    // Create SelectionManager
    this.selectionManager = new SelectionManager({
      onSelectionChange: (selectedFiles) => {
        if (options.onSelectionChange) {
          options.onSelectionChange(selectedFiles);
        }
      }
    });
    
    // Create PatternExplorer with selection enabled
    this.patternExplorer = new PatternExplorer({
      containerId: options.containerId,
      files: options.files,
      metadata: options.metadata,
      enableSelection: true, // New option
      selectionManager: this.selectionManager, // Pass manager
      onFileClick: options.onFileClick,
      onFilePreview: options.onFilePreview
    });
  }
  
  getSelected() {
    return this.selectionManager.getSelected();
  }
  
  select(file) {
    this.selectionManager.select(file);
  }
  
  clearSelection() {
    this.selectionManager.clear();
  }
  
  destroy() {
    this.selectionManager.destroy();
    this.patternExplorer.destroy();
  }
}
```

---

### PatternExplorerTestMode

**File**: `js/components/PatternExplorerTestMode.js`

**Purpose**: PatternExplorer + Filters + Selection + DragDrop

**Implementation**:
```javascript
class PatternExplorerTestMode {
  constructor(options) {
    // Create FilterPanel
    this.filterPanel = new FilterPanel({
      containerId: options.filterContainerId,
      metadata: options.metadata,
      onFilterChange: (filters) => {
        const filteredFiles = applyFilters(options.files, filters, options.metadata);
        this.patternExplorer.render(filteredFiles);
      }
    });
    
    // Create SelectionManager
    this.selectionManager = new SelectionManager({
      onSelectionChange: (selectedFiles) => {
        if (options.onSelectionChange) {
          options.onSelectionChange(selectedFiles);
        }
      }
    });
    
    // Create DragDropManager
    this.dragDropManager = new DragDropManager({
      onDrop: (file, dropZone) => {
        if (options.onDrop) {
          options.onDrop(file, dropZone);
        }
      }
    });
    
    // Create PatternExplorer with all features enabled
    this.patternExplorer = new PatternExplorer({
      containerId: options.containerId,
      files: options.files,
      metadata: options.metadata,
      enableSelection: true,
      selectionManager: this.selectionManager,
      enableDragDrop: true,
      dragDropManager: this.dragDropManager,
      onFileClick: options.onFileClick,
      onFilePreview: options.onFilePreview
    });
    
    // Register drop zones
    if (options.dropZones) {
      options.dropZones.forEach(zone => {
        this.dragDropManager.registerDropZone(zone.id, zone);
      });
    }
  }
  
  getSelected() {
    return this.selectionManager.getSelected();
  }
  
  destroy() {
    this.filterPanel.destroy();
    this.selectionManager.destroy();
    this.dragDropManager.destroy();
    this.patternExplorer.destroy();
  }
}
```

**Usage**:
```javascript
const testExplorer = new PatternExplorerTestMode({
  containerId: 'fileList',
  filterContainerId: 'filterPanel',
  files: allFiles,
  metadata: metadata,
  dropZones: [
    {
      id: 'test-queue',
      onDrop: (file) => {
        addToTestQueue(file);
      }
    }
  ],
  onSelectionChange: (selectedFiles) => {
    updateQueueUI(selectedFiles);
  },
  onDrop: (file, dropZone) => {
    console.log(`Dropped ${file.name} on ${dropZone}`);
  }
});
```

---

## PatternExplorer Extensions

To support these features, we need to extend PatternExplorer with optional capabilities:

### New Options
```javascript
new PatternExplorer({
  // ... existing options ...
  
  // Selection
  enableSelection: false,
  selectionManager: null, // SelectionManager instance
  
  // Drag & Drop
  enableDragDrop: false,
  dragDropManager: null, // DragDropManager instance
  
  // Selection callbacks
  onFileSelect: (file) => {}, // When file is selected (checkbox)
  onFileDeselect: (file) => {}, // When file is deselected
})
```

### New Methods
```javascript
// Enable/disable selection mode
patternExplorer.enableSelection(selectionManager);
patternExplorer.disableSelection();

// Enable/disable drag & drop
patternExplorer.enableDragDrop(dragDropManager);
patternExplorer.disableDragDrop();

// Update selection UI
patternExplorer.updateSelectionState(file, isSelected);
```

---

## File Structure

```
js/
├── components/
│   ├── PatternExplorer.js          ✅ (base - exists)
│   ├── FilterPanel.js              🆕 (new component)
│   ├── DualSlider.js               🆕 (reusable component)
│   ├── PatternExplorerWithFilters.js 🆕 (composed variant)
│   ├── PatternExplorerSelectable.js  🆕 (composed variant)
│   └── PatternExplorerTestMode.js    🆕 (composed variant)
│
├── modules/
│   ├── SelectionManager.js         🆕 (selection logic)
│   ├── DragDropManager.js          🆕 (drag & drop logic)
│   └── filters.js                  🆕 (filter application logic)
│
└── pages/
    ├── library.js                  (uses PatternExplorerWithFilters)
    └── test.js                     (uses PatternExplorerTestMode)
```

---

## Benefits of This Approach

### ✅ Separation of Concerns
- Each feature is independent
- Easy to understand what each piece does
- Changes to one feature don't affect others

### ✅ Reusability
- FilterPanel can be used elsewhere
- SelectionManager can be used with other components
- DragDropManager is generic

### ✅ Testability
- Test each component/module independently
- Test composed variants separately
- Easier to debug issues

### ✅ Flexibility
- Mix and match features as needed
- Easy to add new features
- Can disable features without breaking code

### ✅ Maintainability
- Clear boundaries between features
- Easy to find where code lives
- Easier to refactor

### ✅ Incremental Development
- Build one piece at a time
- Test as you go
- Don't break existing functionality

---

## Implementation Order

### Phase 1: FilterPanel (Foundation)
1. Create `DualSlider` component
2. Create `FilterPanel` component
3. Create `PatternExplorerWithFilters` variant
4. Test with Library page

### Phase 2: Selection (Add Selection)
1. Create `SelectionManager` module
2. Extend `PatternExplorer` with selection support
3. Create `PatternExplorerSelectable` variant
4. Test selection functionality

### Phase 3: Drag & Drop (Add DragDrop)
1. Create `DragDropManager` module
2. Extend `PatternExplorer` with drag-drop support
3. Test drag & drop functionality

### Phase 4: Test Mode (Compose Everything)
1. Create `PatternExplorerTestMode` variant
2. Integrate with Test page
3. Test full functionality

---

## Alternative Approaches (Not Recommended)

### ❌ Option 1: Single Component with Many Options
```javascript
new PatternExplorer({
  enableFilters: true,
  enableSelection: true,
  enableDragDrop: true,
  // ... 20+ options
})
```
**Problems**: 
- Component becomes too complex
- Hard to test
- Hard to maintain
- Violates single responsibility principle

### ❌ Option 2: Inheritance
```javascript
class PatternExplorer { }
class PatternExplorerWithFilters extends PatternExplorer { }
class PatternExplorerSelectable extends PatternExplorer { }
class PatternExplorerTestMode extends PatternExplorerSelectable { }
```
**Problems**:
- Deep inheritance hierarchies
- Hard to mix features
- Tight coupling
- Hard to test

### ❌ Option 3: Separate Components
```javascript
class PatternExplorer { }
class FilterPanel { }
class SelectableFileList { }
class DragDropFileList { }
```
**Problems**:
- Code duplication
- Hard to keep in sync
- More components to maintain

---

## Recommendation

**Use Composition-Based Architecture** ✅

- Keep `PatternExplorer` as the base component
- Create separate components/modules for filters, selection, drag-drop
- Compose them into variants as needed
- Extend `PatternExplorer` with optional capabilities (selection, drag-drop)

This gives you:
- ✅ Clean separation of concerns
- ✅ Maximum reusability
- ✅ Easy to test and maintain
- ✅ Flexible and extensible

---

## Next Steps

1. **Review this proposal** - Does this approach make sense?
2. **Start with FilterPanel** - Extract filter logic from `app.js`
3. **Create `PatternExplorerWithFilters`** - Compose PatternExplorer + FilterPanel
4. **Test on Library page** - Verify it works
5. **Add Selection** - Build SelectionManager and extend PatternExplorer
6. **Add DragDrop** - Build DragDropManager and extend PatternExplorer
7. **Create Test Mode variant** - Compose everything for Test page
