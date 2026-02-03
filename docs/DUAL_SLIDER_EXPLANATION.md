# DualSlider Component Explanation

## What is DualSlider?

**DualSlider** is a **range slider with two handles** (min and max) that allows users to select a range of values. It's used in the filter panel to filter audio files by metadata ranges (RMS, Duration, Balance, Movement).

## Visual Example

```
RMS: (0.100-0.500)
[====●──────────●====]
     ↑          ↑
   Min        Max
  Handle    Handle
```

The filled area between the handles represents the selected range.

---

## Current Implementation

Currently, the dual slider functionality exists in `app.js` as the `initDualSlider()` function (lines 843-985). It's used for filtering audio files by:

1. **RMS** (Root Mean Square) - Audio amplitude/volume
   - Range: 0.0 to 1.0
   - Step: 0.01

2. **Duration** - Length of audio file
   - Range: ~1.5 to ~35 seconds
   - Step: 0.1

3. **Balance** - Stereo left/right balance
   - Range: -1.0 (left) to 1.0 (right)
   - Step: 0.01

4. **Movement** - How much stereo field changes over time
   - Range: 0.0 to ~0.86
   - Step: 0.01

---

## How It Works

### HTML Structure
```html
<div class="dual-slider" id="rms_slider" data-min="0" data-max="1" data-step="0.01">
    <div class="slider-track"></div>           <!-- Background track -->
    <div class="slider-handle slider-handle-min"></div>  <!-- Left handle -->
    <div class="slider-handle slider-handle-max"></div>  <!-- Right handle -->
    <div class="slider-range"></div>           <!-- Filled range between handles -->
</div>
<label>RMS <span id="rms_display">(0.0-1.0)</span></label>
```

### Functionality

1. **Two Handles**: 
   - Left handle = minimum value
   - Right handle = maximum value

2. **Visual Feedback**:
   - Track shows full range
   - Range bar fills between handles
   - Display shows current values: `(min-max)`

3. **Interaction**:
   - **Drag handles** to adjust min/max
   - **Click track** to move nearest handle
   - **Mouse/touch** support
   - Handles can't cross each other

4. **Value Calculation**:
   - Converts mouse position to value
   - Snaps to step increments
   - Updates display with formatted values

---

## Why Extract It?

Currently, the dual slider code is:
- ❌ Embedded in `app.js` (hard to reuse)
- ❌ Tightly coupled to filter logic
- ❌ Not reusable for other purposes
- ❌ Hard to test independently

**Extracting it as a component** will:
- ✅ Make it reusable
- ✅ Separate concerns (UI vs logic)
- ✅ Easier to test
- ✅ Can be used in other parts of the app

---

## Component API (Planned)

```javascript
const slider = new DualSlider({
  containerId: 'slider-container',
  min: 0,              // Minimum possible value
  max: 1,              // Maximum possible value
  step: 0.01,          // Step increment
  label: 'RMS',        // Display label
  initialMin: 0,       // Starting min value
  initialMax: 1,       // Starting max value
  formatValue: (val) => val.toFixed(3),  // Custom formatting
  onChange: (min, max) => {
    console.log(`Range changed: ${min} - ${max}`);
    // Apply filters, update UI, etc.
  }
});

// Get current values
const { min, max } = slider.getValues();

// Set values programmatically
slider.setValues(0.1, 0.5);

// Reset to full range
slider.reset();
```

---

## Use Cases

### 1. Filter Panel (Current)
```javascript
// RMS filter
const rmsSlider = new DualSlider({
  containerId: 'rms_slider',
  min: 0,
  max: 1,
  step: 0.01,
  label: 'RMS',
  onChange: (min, max) => {
    applyFilters({ rms: [min, max] });
  }
});
```

### 2. Other Potential Uses
- Volume range selector
- Time range picker
- Frequency range filter
- Any numeric range selection

---

## Features

### ✅ Current Features
- Two handles (min/max)
- Visual range indicator
- Value display
- Mouse drag support
- Click track to move handles
- Step snapping
- Prevents handles from crossing

### 🆕 Planned Features (Component Version)
- Keyboard accessibility (arrow keys)
- Touch support (mobile)
- Custom formatting
- Custom styling via CSS
- Programmatic value setting
- Reset functionality
- Event callbacks

---

## Example Usage in FilterPanel

```javascript
// FilterPanel would create multiple DualSliders
const filterPanel = new FilterPanel({
  containerId: 'filterPanel',
  filters: {
    rms: {
      min: 0,
      max: 1,
      step: 0.01,
      label: 'RMS'
    },
    duration: {
      min: 0,
      max: 50,
      step: 0.1,
      label: 'Duration'
    }
  },
  onFilterChange: (filters) => {
    // filters = {
    //   rms: [0.1, 0.5],
    //   duration: [2, 10]
    // }
    applyFilters(filters);
  }
});
```

---

## Summary

**DualSlider** is a reusable UI component that:
- Provides a **range selector** with two handles
- Currently used for **filtering audio files** by metadata
- Will be extracted from `app.js` into a standalone component
- Can be reused anywhere you need range selection

It's essentially a **"from X to Y"** slider that lets users visually select a range of numeric values.
