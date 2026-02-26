# Phase 1: FilterPanel Component

## Goal
Extract filter functionality from `app.js` into a reusable `FilterPanel` component.

## Tasks

### 1. Create DualSlider Component
**File**: `js/components/base/DualSlider.js`  
**CSS**: `css/components/base/dualSlider.css`  
**Example**: `js/components/examples/dual-slider.example.html`

**Purpose**: Reusable dual-handle range slider component

**API**:
```javascript
new DualSlider({
  containerId: 'slider-container',
  min: 0,
  max: 1,
  step: 0.01,
  label: 'RMS',
  initialMin: 0,
  initialMax: 1,
  onChange: (min, max) => {
    console.log(`Range: ${min} - ${max}`);
  }
})
```

**Features**:
- Two handles (min/max)
- Visual range indicator
- Value display
- Keyboard accessible
- Touch/mouse support

---

### 2. Create FilterPanel Component
**File**: `js/components/base/FilterPanel.js`  
**CSS**: `css/components/base/filter-panel.css`  
**Example**: `js/components/examples/filter-panel.example.html`

**Purpose**: Search box + multiple dual sliders for filtering

**API**:
```javascript
new FilterPanel({
  containerId: 'filterPanel',
  metadata: {...}, // For calculating ranges
  filters: {
    rms: { min: 0, max: 1, step: 0.01, label: 'RMS' },
    duration: { min: 0, max: 10, step: 0.1, label: 'Duration' },
    balance: { min: -1, max: 1, step: 0.01, label: 'Balance' },
    movement: { min: 0, max: 1, step: 0.01, label: 'Movement' }
  },
  onFilterChange: (filters) => {
    // filters = { search: '', rms: [min, max], duration: [min, max], ... }
    applyFilters(filters);
  },
  onReset: () => {
    console.log('Filters reset');
  }
})
```

**Features**:
- Search input box
- Multiple DualSlider instances (RMS, Duration, Balance, Movement)
- Reset button
- Filter change callbacks
- Get/set filter values programmatically

---

### 3. Create Filter Application Module
**File**: `js/modules/filters.js`

**Purpose**: Pure functions for applying filters to file lists

**API**:
```javascript
// Apply filters to file list
const filteredFiles = applyFilters(allFiles, filters, metadata);

// filters = {
//   search: 'test',
//   rms: [0.1, 0.5],
//   duration: [2, 10],
//   balance: [-0.5, 0.5],
//   movement: [0, 1]
// }
```

**Functions**:
- `applyFilters(files, filters, metadata)` - Apply all filters
- `filterBySearch(files, searchQuery)` - Filter by search term
- `filterByMetadata(files, filters, metadata)` - Filter by metadata ranges
- `calculateRanges(metadata)` - Calculate min/max for sliders

---

### 4. Create PatternExplorerWithFilters Variant
**File**: `js/components/variants/PatternExplorerWithFilters.js`

**Purpose**: Compose PatternExplorer + FilterPanel

**API**:
```javascript
new PatternExplorerWithFilters({
  containerId: 'fileList',
  filterContainerId: 'filterPanel',
  files: allFiles,
  metadata: metadata,
  onFileClick: (file) => {},
  onFilePreview: (file) => {}
})
```

**Features**:
- Automatically wires FilterPanel to PatternExplorer
- Applies filters when FilterPanel changes
- Updates PatternExplorer file list
- Single API for both components

---

## Implementation Steps

### Step 1: Extract DualSlider from app.js
1. Find dual slider code in `app.js` (around line 843-985)
2. Extract into `DualSlider` component
3. Create CSS file
4. Create example/test page
5. Test independently

### Step 2: Extract FilterPanel from app.js
1. Find filter setup code in `app.js` (around line 787-841)
2. Extract into `FilterPanel` component
3. Use `DualSlider` component
4. Create CSS file
5. Create example/test page
6. Test independently

### Step 3: Extract Filter Logic
1. Find `applyFilters` function in `app.js` (around line 1005-1056)
2. Extract into `js/modules/filters.js`
3. Make it pure (no DOM dependencies)
4. Test with unit tests or example

### Step 4: Create Variant
1. Create `PatternExplorerWithFilters` class
2. Compose PatternExplorer + FilterPanel
3. Wire them together
4. Test with example page

### Step 5: Integration
1. Update Library page to use `PatternExplorerWithFilters`
2. Remove old filter code from `app.js`
3. Test end-to-end

---

## File Structure After Phase 1

```
js/
├── components/
│   ├── base/
│   │   ├── PatternExplorer.js          ✅ (exists)
│   │   ├── DualSlider.js                🆕
│   │   └── FilterPanel.js               🆕
│   ├── variants/
│   │   └── PatternExplorerWithFilters.js 🆕
│   └── examples/
│       ├── pattern-explorer.example.html ✅ (exists)
│       ├── dual-slider.example.html      🆕
│       └── filter-panel.example.html     🆕
│
└── modules/
    └── filters.js                        🆕

css/
└── components/
    └── base/
        ├── patternExplorer.css          ✅ (exists)
        ├── dualSlider.css               🆕
        └── filterPanel.css              🆕
```

---

## Testing Strategy

1. **Component Isolation**: Test each component independently
2. **Example Pages**: Create standalone HTML pages for each component
3. **Integration**: Test composed variant
4. **End-to-End**: Test on Library page

---

## Success Criteria

- ✅ DualSlider component works independently
- ✅ FilterPanel component works independently
- ✅ Filter logic is pure and testable
- ✅ PatternExplorerWithFilters composes both components
- ✅ Library page uses new variant
- ✅ Old filter code removed from app.js
- ✅ All functionality preserved

---

## Next Steps After Phase 1

- ✅ Phase 2: SelectionManager - COMPLETE (implemented as integrated selection in `PatternExplorerWithSelection`)
- ✅ Phase 3: DragDropManager - COMPLETE (implemented as queue reordering in `PatternQueue`)
- ✅ Phase 4: PatternExplorerTestMode - COMPLETE (implemented as `PatternExplorerWithSelection` variant)
