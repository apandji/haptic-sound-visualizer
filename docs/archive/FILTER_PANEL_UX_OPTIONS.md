# FilterPanel UX Options

## Current Approach: Always Visible
- Filters always shown in sidebar
- Takes up vertical space
- Always accessible

## Option 1: Collapsible Filter Panel (Recommended)

### Concept
Filters are hidden by default, can be expanded with a toggle button.

### Pros
- ✅ Saves vertical space (more room for file list)
- ✅ Cleaner PatternExplorer when filters not needed
- ✅ Filters still easily accessible
- ✅ Common UX pattern (users understand it)
- ✅ Can remember collapsed/expanded state

### Cons
- ❌ One extra click to access filters
- ❌ If filters are used frequently, might be annoying

### Implementation
```javascript
// FilterPanel with collapsible option
new FilterPanel({
  containerId: 'filterPanel',
  metadata: metadata,
  compact: true,
  collapsible: true,        // Enable collapsible
  defaultCollapsed: true,   // Start collapsed
  onToggle: (isCollapsed) => {
    // Optional: save state to localStorage
  }
});
```

### Visual Design
```
┌─────────────────────┐
│ PATTERN EXPLORER    │
├─────────────────────┤
│ [▼] FILTERS         │ ← Click to expand
│                     │
│ [File list...]      │
│ [File list...]      │
│ [File list...]      │
└─────────────────────┘

When expanded:
┌─────────────────────┐
│ PATTERN EXPLORER    │
├─────────────────────┤
│ [▲] FILTERS         │ ← Click to collapse
│ [Search...]         │
│ RMS: [====●──●====] │
│ Duration: [●──●]     │
│ Balance: [●──●]     │
│ Movement: [●──●]    │
│ [RESET]             │
├─────────────────────┤
│ [File list...]      │
│ [File list...]      │
└─────────────────────┘
```

---

## Option 2: Filter Icon/Button

### Concept
Small filter icon/button that opens a popover/dropdown with filters.

### Pros
- ✅ Takes minimal space
- ✅ Very clean PatternExplorer
- ✅ Can overlay on top

### Cons
- ❌ Filters hidden behind click
- ❌ Popover might feel disconnected
- ❌ Harder to see filter state at a glance

---

## Option 3: Horizontal Filter Bar

### Concept
Filters in a horizontal bar above file list (like tabs).

### Pros
- ✅ Different layout option
- ✅ Can be sticky

### Cons
- ❌ Takes horizontal space
- ❌ Might be cramped
- ❌ Less intuitive for vertical sidebar

---

## Recommendation: Collapsible Filter Panel

**Why:**
1. **Best balance** - Saves space but keeps filters accessible
2. **Familiar pattern** - Users understand expand/collapse
3. **Flexible** - Can start expanded or collapsed
4. **Clean** - PatternExplorer looks cleaner when collapsed
5. **Space efficient** - More room for file list

**Implementation:**
- Add collapsible header with toggle button
- Smooth expand/collapse animation
- Remember state (localStorage)
- Icon: ▼ when collapsed, ▲ when expanded

---

## Visual Comparison

### Always Visible (Current)
```
┌─────────────────────┐
│ PATTERN EXPLORER    │
├─────────────────────┤
│ [Search...]         │
│ RMS: [====●──●====] │
│ Duration: [●──●]     │
│ Balance: [●──●]     │
│ Movement: [●──●]    │
│ [RESET]             │
├─────────────────────┤
│ [File list...]      │ ← Less space
│ [File list...]      │
│ [File list...]      │
└─────────────────────┘
```

### Collapsible (Proposed)
```
┌─────────────────────┐
│ PATTERN EXPLORER    │
├─────────────────────┤
│ [▼] FILTERS         │ ← Collapsed
├─────────────────────┤
│ [File list...]      │ ← More space!
│ [File list...]      │
│ [File list...]      │
│ [File list...]      │
│ [File list...]      │
└─────────────────────┘
```

---

## Implementation Plan

### Add to FilterPanel
1. Add `collapsible` option
2. Add `defaultCollapsed` option
3. Create collapsible header with toggle
4. Add expand/collapse animation
5. Optional: Save state to localStorage

### Integration with PatternExplorer
- PatternExplorerWithFilters can pass `collapsible: true`
- Or PatternExplorer can wrap FilterPanel in collapsible container

---

## User Preference

**Question for user:**
- Do you want filters always visible, or collapsible?
- If collapsible, should they start collapsed or expanded?
- Should the state be remembered (localStorage)?
