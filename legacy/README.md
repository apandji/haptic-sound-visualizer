# Legacy Files

This folder contains archived files from the old `index.html` TEST page implementation.

## Status: DEPRECATED

The main application is now at `/index.html` (formerly `library.html`).

## Contents

- `index.html` - Old TEST page (deprecated)
- `app.js` - Old main application logic
- `js/` - Old JavaScript modules:
  - `main.js`, `main-simple.js` - Old entry points
  - `audioProcessor.js` - Old audio processing
  - `visualizations-simple.js` - Old visualizations
  - `ui/` - Old UI components (`controls.js`, `fileManager.js`)
  - `visualizations/` - Old visualization modules

## Why Archived?

The new architecture uses:
- Component-based design (`/js/components/`)
- Module-based design (`/js/modules/`)
- Better separation of concerns
- `library.html` as the main entry point (now renamed to `index.html`)

## Using Legacy Features

If you need to access the legacy TEST page:
1. Navigate to `/legacy/index.html`
2. Note: Some features may not work as expected since paths have been adjusted

## Migration

To migrate code from legacy to new architecture:
- UI components → `/js/components/base/`
- Non-UI logic → `/js/modules/`
- See `/docs/COMPONENT_ORGANIZATION.md` for guidelines
