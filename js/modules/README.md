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

- **audioPlayer.js** ✅ - Audio playback logic using p5.SoundFile
  - `new AudioPlayer({ loadSoundFn, onLoad, onPlay, onPause, onStop, onEnd, defaultLoop })` - Create AudioPlayer instance
  - `loadFile(filePath)` - Load audio file (returns Promise)
  - `play()` - Start/resume playback
  - `pause()` - Pause playback
  - `stop()` - Stop playback
  - `setLoop(loop)` - Enable/disable looping
  - `setLoopDuration(duration)` - Set loop duration in seconds (e.g., 30 for 30-second loop, null to disable)
  - `getLoopDuration()` - Get current loop duration setting (number or null)
  - `checkLoopDuration()` - Check if duration exceeded and stop if needed (call periodically from draw loop)
  - `getElapsedTime()` - Get elapsed time since playback started (for loop duration)
  - `getRemainingLoopTime()` - Get remaining time until loop duration ends
  - `getCurrentTime()` - Get current playback time (seconds)
  - `getDuration()` - Get audio duration (seconds)
  - `isPlaying()` - Check if playing
  - `isLoaded()` - Check if file is loaded
  - `getSoundFile()` - Get p5.SoundFile instance
  - `getCurrentFilePath()` - Get current file path (string or null)
  - `getLoop()` - Get current loop state
  - `destroy()` - Cleanup
  - **Example**: `dev/modules-examples/audio-player.example.html`

- **sessionTimeEstimator.js** ✅ - Session duration estimation based on pattern count
  - `new SessionTimeEstimator(config)` - Create estimator with optional config override
  - `SessionTimeEstimator.create(configPath)` - Create instance with config loaded from JSON file (async)
  - `calculateDuration(patternCount)` - Calculate total duration in seconds
  - `formatDuration(seconds)` - Format duration as human-readable string
  - `getEstimate(patternCount)` - Get full estimate object with formatted duration
  - `updateConfig(newConfig)` - Update timing configuration
  - `getConfig()` - Get current configuration
  - **Config File**: `sessionTimingConfig.json` - Edit this file to adjust timing values
  - **Example**: See `dev/components-examples/session-info.example.html`
  - **Documentation**: See `docs/TESTING_PROTOCOL.md` for timing details and future improvements

### Planned Modules

- **SessionManager** - Manages test sessions and trials (localStorage persistence)
  - `createSession(sessionData)` - Create new session
  - `getSession(sessionId)` - Get session by ID
  - `addTrial(sessionId, trialData)` - Add trial to session
  - `getTrials(sessionId)` - Get all trials for session
  - `saveSession(session)` - Persist session to localStorage
  - `loadSessions()` - Load all sessions from localStorage
  - See `docs/database_schema.txt` for data structure reference

- **fileLoader.js** - File loading utilities

---

## Adding a New Module

1. Create module file: `moduleName.js`
2. Export class or functions
3. Keep DOM manipulation minimal
4. Document API in this README
5. Follow module patterns (see COMPONENT_ORGANIZATION.md)
