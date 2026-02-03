# PatternExplorer Variations: Code Examples

## Quick Reference: How Each Variant Works

### 1. Base PatternExplorer (Current)
```javascript
// Simple file list - no filters, no selection, no drag-drop
const explorer = new PatternExplorer({
  containerId: 'fileList',
  files: allFiles,
  metadata: metadata,
  onFileClick: (file) => {
    console.log('File clicked:', file.name);
  },
  onFilePreview: (file) => {
    playAudio(file.path);
  }
});

explorer.render(allFiles);
```

---

### 2. PatternExplorerWithFilters
```javascript
// File list + filters (search + sliders)
const explorer = new PatternExplorerWithFilters({
  containerId: 'fileList',
  filterContainerId: 'filterPanel',
  files: allFiles,
  metadata: metadata,
  onFileClick: (file) => {
    console.log('File clicked:', file.name);
  },
  onFilePreview: (file) => {
    playAudio(file.path);
  }
});

// Filters are automatically applied
// When user changes filters, file list updates automatically
```

**HTML**:
```html
<div id="filterPanel"></div>  <!-- FilterPanel renders here -->
<div id="fileList"></div>      <!-- PatternExplorer renders here -->
```

---

### 3. PatternExplorerSelectable
```javascript
// File list + multi-select (checkboxes)
const explorer = new PatternExplorerSelectable({
  containerId: 'fileList',
  files: allFiles,
  metadata: metadata,
  onFileClick: (file) => {
    console.log('File clicked:', file.name);
  },
  onSelectionChange: (selectedFiles) => {
    console.log('Selected files:', selectedFiles);
    // Update UI, enable/disable buttons, etc.
  }
});

// Get selected files
const selected = explorer.getSelected();
console.log(`${selected.length} files selected`);

// Programmatically select files
explorer.select(file1);
explorer.select(file2);
explorer.clearSelection();
```

**Visual**: File items show checkboxes, selected items are highlighted

---

### 4. PatternExplorerTestMode (Full Featured)
```javascript
// File list + filters + selection + drag-drop
const testExplorer = new PatternExplorerTestMode({
  containerId: 'fileList',
  filterContainerId: 'filterPanel',
  files: allFiles,
  metadata: metadata,
  
  // Drop zones for drag & drop
  dropZones: [
    {
      id: 'test-queue',
      label: 'Test Queue',
      onDrop: (file) => {
        addToTestQueue(file);
        showNotification(`Added ${file.name} to queue`);
      }
    },
    {
      id: 'test-area',
      label: 'Test Area',
      onDrop: (file) => {
        startTest(file);
      }
    }
  ],
  
  // Selection callbacks
  onSelectionChange: (selectedFiles) => {
    updateQueueCount(selectedFiles.length);
    enableQueueActions(selectedFiles.length > 0);
  },
  
  // File callbacks
  onFileClick: (file) => {
    previewFile(file);
  },
  onFilePreview: (file) => {
    playPreview(file);
  }
});

// Get selected files
const selected = testExplorer.getSelected();

// Add all selected to queue
selected.forEach(file => {
  addToTestQueue(file);
});
```

**HTML**:
```html
<!-- Filters -->
<div id="filterPanel"></div>

<!-- File List -->
<div id="fileList"></div>

<!-- Drop Zones -->
<div id="test-queue" class="drop-zone">
  <h3>Test Queue</h3>
  <div class="queue-items"></div>
</div>

<div id="test-area" class="drop-zone">
  <h3>Test Area</h3>
  <p>Drag files here to test</p>
</div>
```

---

## Visual Comparison

### PatternExplorer (Base)
```
┌─────────────────────┐
│ PATTERN EXPLORER    │
├─────────────────────┤
│ [▶] file1.mp3       │
│ [▶] file2.mp3       │
│ [▶] file3.mp3       │
└─────────────────────┘
```

### PatternExplorerWithFilters
```
┌─────────────────────┐
│ FILTERS             │
├─────────────────────┤
│ [Search box...]     │
│ RMS: [====●──●====] │
│ Duration: [●──●]    │
│ [Reset]             │
└─────────────────────┘
┌─────────────────────┐
│ PATTERN EXPLORER    │
├─────────────────────┤
│ [▶] file1.mp3       │
│ [▶] file2.mp3       │
└─────────────────────┘
```

### PatternExplorerSelectable
```
┌─────────────────────┐
│ PATTERN EXPLORER    │
├─────────────────────┤
│ ☑ [▶] file1.mp3     │ ← Selected
│ ☐ [▶] file2.mp3     │
│ ☑ [▶] file3.mp3     │ ← Selected
└─────────────────────┘
```

### PatternExplorerTestMode
```
┌─────────────────────┐
│ FILTERS             │
├─────────────────────┤
│ [Search...]         │
│ [Sliders...]       │
└─────────────────────┘
┌─────────────────────┐
│ PATTERN EXPLORER    │
├─────────────────────┤
│ ☑ [▶] file1.mp3     │ ← Drag me!
│ ☐ [▶] file2.mp3     │
│ ☑ [▶] file3.mp3     │ ← Drag me!
└─────────────────────┘
         ↓ ↓ ↓
┌─────────────────────┐
│ TEST QUEUE          │
│ (Drop files here)   │
└─────────────────────┘
```

---

## Usage by Page

### Library Page
```javascript
// Simple: filters + file list
const libraryExplorer = new PatternExplorerWithFilters({
  containerId: 'fileList',
  filterContainerId: 'filterPanel',
  files: allFiles,
  metadata: metadata,
  onFileClick: (file) => {
    loadFileForPreview(file);
  },
  onFilePreview: (file) => {
    playPreview(file);
  }
});
```

### Test Page
```javascript
// Full featured: filters + selection + drag-drop
const testExplorer = new PatternExplorerTestMode({
  containerId: 'fileList',
  filterContainerId: 'filterPanel',
  files: allFiles,
  metadata: metadata,
  dropZones: [
    { id: 'test-queue', onDrop: addToQueue }
  ],
  onSelectionChange: (selected) => {
    updateQueueUI(selected);
  },
  onFilePreview: (file) => {
    playPreview(file);
  }
});
```

### Analysis Page
```javascript
// Maybe just selection (no drag-drop needed)
const analysisExplorer = new PatternExplorerSelectable({
  containerId: 'fileList',
  files: allFiles,
  metadata: metadata,
  onSelectionChange: (selected) => {
    analyzeFiles(selected);
  }
});
```

---

## Migration Path

### Current Code (app.js)
```javascript
// Everything in one place
function setupFilters() { /* ... */ }
function applyFilters() { /* ... */ }
function renderFileList() { /* ... */ }
```

### New Code (Component-Based)
```javascript
// Library page
const explorer = new PatternExplorerWithFilters({
  containerId: 'fileList',
  filterContainerId: 'filterPanel',
  files: allFiles,
  metadata: metadata,
  onFileClick: loadFile,
  onFilePreview: playPreview
});

// Test page
const testExplorer = new PatternExplorerTestMode({
  containerId: 'fileList',
  filterContainerId: 'filterPanel',
  files: allFiles,
  metadata: metadata,
  dropZones: [{ id: 'queue', onDrop: addToQueue }],
  onSelectionChange: updateQueue
});
```

---

## Key Benefits

1. **Clear API**: Each variant has a clear purpose
2. **Easy to Use**: Just instantiate the right variant
3. **Flexible**: Can create custom variants if needed
4. **Testable**: Each piece can be tested independently
5. **Maintainable**: Changes are localized to specific components
