# Testing Protocol

**Status:** Draft - Under Review  
**Last Updated:** January 28, 2026  
**Purpose:** Define the end-to-end testing protocol for EEG data collection with audio pattern playback

---

## Overview

This document outlines the complete testing protocol for collecting EEG data while participants experience haptic sound patterns. The protocol ensures consistent data collection, proper device verification, and systematic participant feedback.

---

## Testing Workflow

### Phase 1: Preparation

#### 1.1 Pattern Selection & Queueing

**Goal:** Researcher selects sequence of audio patterns to test

**Process:**
- Researcher switches to **Test Mode**
- Interface similar to Library Mode:
  - File browser with filters/search
  - Ability to select multiple files
- Selected files appear in **"Queued Patterns"** panel (right side)
- Researcher can:
  - Add files to queue (click or drag)
  - Remove files from queue
  - Reorder files (drag to reorder)
  - Clear entire queue

**⚠️ Workflow Order:** Queue must be created BEFORE EEG verification and session start (not flexible)

**Decisions:**
- ✅ **Selection method:** Click to add, drag-and-drop. Explore shift+click for multi-select
- ✅ **Queue visibility:** Queue shows file metadata (duration, RMS, etc.)
- ✅ **Queue limits:** No limit for now (may be needed in future)
- ✅ **Queue persistence:** Queue saved/restored between sessions

**Questions/Considerations:**
- ❓ **Multi-select:** How to implement shift+click multi-select? (Technical feasibility)
- ❓ **Queue editing:** Can researcher modify queue mid-session? (Not yet decided)

---

#### 1.2 EEG Device Connection & Verification

**Goal:** Verify EEG device is properly connected and functioning

**Process:**
- Researcher clicks **"Connect Ganglion"** button
- System initiates Bluetooth connection
- Once connected, device verification begins:
  - Check all 4 channels are receiving data
  - Verify signal quality (impedance, noise levels)
  - Display real-time channel activity
  - Show signal quality indicators (green/yellow/red)

**Verification Criteria:**
- All 4 channels showing data
- Data flowing (not all zeros)
- Stable connection (no dropouts)

**Decisions:**
- ✅ **Verification timing:** Once per session (before starting tests, after queue is created)
- ✅ **Failure handling:** If verification fails, researcher can override
- ✅ **Re-verification:** Can re-run verification mid-session (between tests)
- ✅ **Visual feedback:** Panel showing live EEG data (clickable to expand/collapse)
- ✅ **Disconnection handling:** If EEG disconnects/fails mid-test, log the event and continue
- ✅ **EEG optional:** Session can start without EEG connected, but this must be noted in metadata

**Questions/Considerations:**
- ❓ **Quality thresholds:** What are acceptable impedance/noise levels? (To be determined with device)
- ❓ **Disconnection logging:** What specific information should be logged? (timestamp, channel affected, duration, etc.)
- ❓ **Live data panel:** Should panel be collapsible? Always visible? What data to show? (raw values, waveforms, quality indicators?)

---

### Phase 2: Test Execution

#### 2.1 Session Initialization

**Goal:** Start a new testing session

**Process:**
- **Prerequisites:** Queue must have at least 1 pattern, EEG verification should be completed (but can be skipped)
- Researcher clicks **"Start Session"** button
- System validates:
  - Queue is not empty (block if empty)
  - EEG connection status (warn if not connected, but allow proceed)
- System creates new `session_id`
- System auto-generates `participant_id` (UUID) - handles duplicate names
- Researcher enters session information:
  - Participant name (required, text input)
  - Researcher name (required, dropdown: pandji, noah, jonathan, long)
  - Computer name/identifier (required, dropdown list - defaults to lab's primary iMac)
  - Notes/observations (optional, text input)
- System auto-captures computer hardware info (platform, OS, screen, CPU, RAM)
- System checks for duplicate participant IDs (should not occur with UUIDs, but validation included)
- System captures session metadata:
  - Session ID
  - Browser information (auto-captured)
  - Researcher name (selected from dropdown)
  - Device information (EEG device, connection status)
  - Computer information:
    - Computer name/identifier (researcher-selected at session start)
    - Platform, OS, screen resolution, hardware specs (auto-captured)
  - Start time
  - EEG connection status (connected/not_connected)
- System displays session info:
  - Session ID
  - Start time
  - Number of queued patterns
  - EEG connection status
  - Current status

**Decisions:**
- ✅ **Participant info:** Participant ID (auto-generated UUID, required), Name (required), Notes (optional)
- ✅ **Participant ID validation:** System checks for duplicate IDs (unlikely with UUIDs, but validation included)
- ✅ **Researcher name:** Dropdown selection (pandji, noah, jonathan, long) - stored values
- ✅ **Session metadata:** session_id, browser, researcher, device, EEG connection status
- ✅ **Session pause/resume:** Cannot be paused and resumed later
- ✅ **Session cancellation:** Researcher can cancel before starting tests
- ✅ **Session prerequisites:** Queue must have at least 1 pattern (blocked if empty), EEG connection optional but noted in metadata
- ✅ **Computer information:** Capture computer identifier and hardware info
  - Computer name/identifier: Researcher-selected from dropdown (e.g., "iMac #1")
  - Platform/OS: Auto-captured via browser APIs (navigator.platform, user agent)
  - Screen resolution: Auto-captured (screen.width x screen.height)
  - Hardware specs: Auto-captured (navigator.hardwareConcurrency, navigator.deviceMemory)

**Decisions:**
- ✅ **Computer identifier input:** Dropdown list at session start, defaults to lab's primary iMac
- ✅ **Computer list management:** System maintains list of available computers (can be expanded as needed)

**Decisions:**
- ✅ **Researcher list:** Stored values: pandji, noah, jonathan, long (dropdown selection)

**Questions/Considerations:**
- ❓ **Computer list storage:** Where should computer list be stored? (localStorage? config file? hardcoded?)
- ❓ **Adding new computers:** How should researchers add new computers to the list? (Admin interface? Config file?)
- ❓ **Auto-captured vs manual:** 
  - ✅ **Auto-captured:** Platform, OS, screen resolution, hardware concurrency, device memory
  - ❌ **Not available via web APIs:** Computer serial number, MAC address, exact computer hostname (privacy/security restrictions)
  - ✅ **Manual entry:** Computer identifier/name (e.g., "iMac #1", "Lab Computer A")
- ❓ **Browser info:** What specific browser details? (User agent, version, Web Bluetooth support?)
- ❓ **Device info:** What device details? (Ganglion firmware version, serial number?)
- ❓ **Audio device:** Should we capture audio output device? (May require user permission)

---

#### 2.2 Individual Test Protocol

**Goal:** Execute standardized test for each audio pattern

**Protocol (per pattern):**

1. **Baseline Phase (30 seconds)**
   - No audio playback
   - Record EEG data continuously
   - Display countdown timer
   - Tag all samples with `phase: "baseline"`

2. **Testing Phase (30 seconds)**
   - Start audio pattern playback
   - Continue recording EEG data
   - Display countdown timer
   - Tag all samples with `phase: "testing"` and `audio_time_offset`
   - Audio handling:
     - If pattern < 30s: Seamless loop (no gaps) for entire 30 seconds
     - If pattern > 30s: Apply 5-second fade-out starting at 25s, cut at 30s
   - `audio_time_offset`: Milliseconds from testing phase start to actual audio playback start (for synchronization)

3. **Test Completion**
   - Stop audio playback
   - Stop recording
   - Save test data with `test_id`
   - Display completion confirmation

**Decisions:**
- ✅ **Audio duration handling:**
  - If pattern < 30s: Seamless loop for entire 30 seconds (no gaps, no silence between loops)
  - If pattern > 30s: Apply 5-second fade-out starting at 25s, cut at 30 seconds
- ✅ **Audio timing:** If audio fails to start, retry 5 times. Give researcher option to skip test. Do not record data if skipped.
- ✅ **Audio retry:** 5 retry attempts
- ✅ **Skip test UI:** Button presented in error dialog
- ✅ **Audio time offset:** `audio_time_offset` = milliseconds from start of testing phase to when audio actually started playing. Used for synchronizing EEG samples with audio playback.
- ✅ **Countdown display:** 
  - Displayed on interface
  - Researcher ensures computer screen is not facing participant
  - Researcher and participant in same room
- ✅ **EEG interruption:** If EEG disconnects mid-test, continue but log when disconnection occurred in data.
- ✅ **Test abort:** 
  - If aborted mid-baseline: Discard all data (no test record created)
  - If aborted mid-testing: Save baseline + partial testing data, flag as "aborted"
  - Minimum data to save: Must have completed baseline phase (30s) to save test
- ✅ **Abort flag:** Stored in `test_metadata.status = "aborted"`

**Questions/Considerations:**
- ❓ **Screen positioning:** Should there be a UI indicator/reminder about screen positioning?

---

#### 2.3 Post-Test Survey

**Goal:** Collect qualitative feedback after each pattern

**Process:**
- After test completes, display survey
- Question: **"What does this pattern feel like?"**
- Present 4 multi-choice options (options TBD)
- Participant selects answer(s)
- Researcher clicks "Continue" or "Next"

**Decisions:**
- ✅ **Survey timing:** Immediately after each test
- ✅ **Survey options:** A, B, C, D (placeholder options for now, specific definitions TBD)
- ✅ **Multi-select:** Yes, participant can select multiple options
- ✅ **Multi-select UI:** Buttons (not checkboxes)
- ✅ **Required vs optional:** Participant CANNOT skip survey (required)
- ✅ **Survey validation:** Require at least one option selected before proceeding
- ✅ **Survey data linkage:** Link survey response to specific `test_id`
- ✅ **Survey display:** Full-screen overlay
- ✅ **Participant interaction:** Participant interacts with survey directly
- ✅ **Survey completion:** Participant clicks "Complete Survey" button when done
- ✅ **Researcher awareness:** Researcher knows participant is done when participant clicks "Complete Survey" on final test in session

**Questions/Considerations:**
- ❓ **Survey options definition:** What are the actual A, B, C, D options? (Placeholder for now, need research team input)
- ❓ **Pattern status display:** How to show pattern playing status (or not playing) while survey overlay is full-screen? (Need visual design solution - e.g., small indicator in corner, audio waveform visualization, etc.)
- ❓ **Survey timing:** Should there be a time limit? Or can participant take as long as needed?
- ❓ **Survey instructions:** Should there be instructions displayed on survey overlay? (e.g., "Select one or more options that describe how this pattern feels")

---

#### 2.4 Inter-Test Checkpoint

**Goal:** Researcher-controlled transition between tests

**Process:**
- After survey completion (participant clicks "Complete Survey"), display checkpoint
- Show checkpoint information:
  - Current test number (e.g., "Test 3 of 8")
  - Next pattern name
  - Session progress
- Researcher must manually press **"Continue to Next Test"** or **Enter** key
- System prepares next test

**Decisions:**
- ✅ **Checkpoint purpose:** Allow participant break, researcher verification, device check
- ✅ **Queue modification:** Researcher CANNOT modify queue during session

**Decisions:**
- ✅ **Checkpoint info displayed:**
  - Current test number (e.g., "Test 3 of 8")
  - Next pattern name
  - Session progress

**Questions/Considerations:**
- ❓ **Break duration:** Should there be a minimum break time?
- ❓ **Checkpoint skip:** Can researcher skip checkpoint? (For automated testing)
- ❓ **Error recovery:** What if researcher wants to go back to previous test?
- ❓ **Wrong pattern queued:** If researcher realizes wrong pattern was queued mid-session, what are the options? (Skip that test? Continue anyway?)

---

### Phase 3: Session Completion

#### 3.1 Complete All Tests

**Goal:** Execute protocol for all queued patterns

**Process:**
- Repeat Phase 2.2-2.4 for each pattern in queue
- System tracks:
  - Tests completed
  - Tests remaining
  - Session duration
- Display progress indicator

**Decisions:**
- ✅ **Queue modification:** Researcher CANNOT modify queue during session

**Questions/Considerations:**
- ❓ **Progress display:** Real-time progress bar? Test counter?
- ❓ **Session duration:** Estimated time remaining?
- ❓ **Test skipping:** Can researcher skip a test? Mark as "skipped"?
- ❓ **Test retry:** Can researcher re-run a specific test?

---

#### 3.2 Session Finalization

**Goal:** Complete and save session data

**Process:**
- After all tests complete, display session summary:
  - Total tests completed
  - Session duration
  - Data quality summary
- Researcher clicks **"End Session"**
- System:
  - Saves all session data
  - Closes session (`ended_at` timestamp)
  - Displays completion message
  - Option to export data

**Questions/Considerations:**
- ❓ **Session summary:** What statistics should be shown?
- ❓ **Data export:** Export immediately? Or later in Analysis mode?
- ❓ **Session review:** Can researcher review session before ending?
- ❓ **Session continuation:** Can researcher add more tests before ending?
- ❓ **Data validation:** Validate data before saving? Show warnings?

---

## Session Time Estimation

**Current Implementation:**
- Session duration is estimated based on pattern count and timing configuration
- Configuration file: `js/modules/sessionTimingConfig.json`
- Formula: `calibrationDuration + (patternCount × (baselineDuration + stimulationDuration + taggingDuration))`
- Default timings:
  - Calibration: 60 seconds
  - Baseline per pattern: 30 seconds
  - Stimulation per pattern: 30 seconds
  - Tagging per pattern: 10 seconds

**Future Improvements (TODO):**
- Load configuration from database/API instead of static JSON file
- Allow per-pattern timing variations based on pattern metadata (e.g., longer patterns may need more time)
- Support different timing profiles (e.g., "quick test" vs "full session" modes)
- Account for participant-specific factors (e.g., first-time participants may need more time)
- Real-time adjustment based on actual trial durations (learn from past sessions)
- Consider pattern complexity or duration in estimates
- Add buffer time for transitions between patterns

**Configuration File:**
Edit `js/modules/sessionTimingConfig.json` to adjust timing values. The file is loaded automatically when using `SessionTimeEstimator.create()`.

---

## Data Structure

### Session Structure

```javascript
{
  "session_id": "uuid-v4",
  "created_at": "ISO-8601-timestamp",
  "ended_at": "ISO-8601-timestamp",
  "participant_info": {
    "participant_id": "uuid-v4", // Auto-generated UUID to handle duplicate names
    "name": "required-string",
    "notes": "optional-notes"
  },
  "researcher_info": {
    "researcher_name": "pandji|noah|jonathan|long" // Selected from dropdown
  },
  "device_info": {
    "device_type": "OpenBCI_Ganglion",
    "verification_status": "passed|failed|skipped|not_connected",
    "verification_timestamp": "ISO-8601-timestamp",
    "connection_status": "connected|not_connected" // At session start
  },
  "tests": [
    // Array of test objects (see below)
  ],
  "session_metadata": {
    "total_tests": 8,
    "tests_completed": 8,
    "tests_skipped": 0,
    "tests_aborted": 0,
    "total_duration_ms": 480000,
    "browser": "Chrome 120.0.0.0",
    "researcher": "Researcher Name",
    "device": "OpenBCI_Ganglion_v1.0",
    "computer_info": {
      "computer_name": "iMac #1", // Selected from dropdown (defaults to lab's primary iMac)
      "platform": "MacIntel", // Auto-captured via navigator.platform
      "os": "macOS", // Parsed from user agent
      "screen_resolution": "2560x1440", // Auto-captured via screen.width x screen.height
      "hardware_concurrency": 8, // Auto-captured CPU cores
      "device_memory": 16 // Auto-captured RAM in GB (if available)
    },
    "environment_notes": "optional"
  }
}
```

### Test Structure

```javascript
{
  "test_id": "uuid-v4",
  "session_id": "uuid-v4",
  "test_number": 1,
  "audio_file": {
    "filename": "pattern_001.mp3",
    "path": "/audio_files/pattern_001.mp3",
    "metadata": { /* audio metadata */ }
  },
  "baseline": {
    "start_time": "ISO-8601-timestamp",
    "end_time": "ISO-8601-timestamp",
    "duration_ms": 30000,
    "eeg_samples": [ /* EEG data */ ]
  },
  "testing": {
    "start_time": "ISO-8601-timestamp",
    "end_time": "ISO-8601-timestamp",
    "duration_ms": 30000,
    "audio_start_time": "ISO-8601-timestamp",
    "eeg_samples": [ /* EEG data */ ]
  },
  "survey_response": {
    "question": "What does this pattern feel like?",
    "selected_options": ["A", "B"], // Multi-select buttons: A, B, C, D (placeholder options)
    "response_time": "ISO-8601-timestamp",
    "required": true, // Cannot be skipped
    "completed": true // false if survey failed/missing
  },
  "test_metadata": {
    "status": "completed|skipped|aborted",
    "quality_issues": [],
    "eeg_disconnection_events": [
      {
        "timestamp": "ISO-8601-timestamp",
        "duration_ms": 1234,
        "channels_affected": [1, 2]
      }
    ],
    "audio_retry_count": 0, // Number of retry attempts if audio failed initially
    "notes": "optional-researcher-notes"
  }
}
```

---

## User Interface Considerations

### Researcher View vs Participant View

**Decisions:**
- ✅ **Same room:** Researcher and participant are in the same room
- ✅ **Screen positioning:** Researcher ensures computer screen is not facing participant
- ✅ **View design:** Single interface, researcher manages screen positioning to prevent participant from seeing controls

**Questions/Considerations:**
- ❓ **Participant visibility:** Should there be a "Participant View" mode that hides controls? Or rely on screen positioning?
- ❓ **UI indicators:** Should there be visual indicators when in "test execution" vs "setup" mode?
- ❓ **Survey overlay:** How to ensure participant can interact with survey overlay without seeing researcher controls?

---

## Error Handling & Edge Cases

### Device Connection Issues

- **EEG disconnects mid-test:** Abort test? Continue without EEG? Retry connection?
- **EEG connection fails:** Can researcher proceed without EEG? (For testing survey only)
- **Poor signal quality:** Warn researcher? Block test? Allow override?

### Audio Playback Issues

- **Audio file missing:** Skip test? Show error? Retry?
- **Audio fails to play:** Retry? Skip? Use fallback?
- **Browser audio restrictions:** Handle autoplay policies?

### Participant Issues

- **Participant needs break:** Pause session? Skip to checkpoint?
- **Participant wants to stop:** Abort session? Save partial data?
- **Participant distraction:** Can researcher mark test as "invalid"?

### System Issues

- **Browser crash:** Can session be recovered?
- **Network issues:** (If using remote storage) Queue data locally?
- **Storage full:** Warn researcher? Prevent new tests?

---

## Open Questions & Decisions Needed

### High Priority

1. ✅ ~~**Survey Options:** What are the 4 multi-choice options for "What does this pattern feel like?"?~~ → **RESOLVED:** A, B, C, D (placeholder options, specific definitions TBD)
2. ✅ ~~**Survey Completion:** How does researcher know participant is done?~~ → **RESOLVED:** Participant clicks "Complete Survey" button
3. ✅ ~~**Survey UI:** Multi-select UI design~~ → **RESOLVED:** Multi-select buttons, full-screen overlay, require at least one selection
4. ✅ ~~**Audio Duration Handling:** How to handle patterns < 30s or > 30s?~~ → **RESOLVED:** Seamless loop if <30s, 5s fade-out + cut if >30s
5. ✅ ~~**Audio Retry:** How many retry attempts?~~ → **RESOLVED:** 5 retry attempts
6. ✅ ~~**Skip Test UI:** How to present skip option?~~ → **RESOLVED:** Button in error dialog
7. ✅ ~~**Skip Test Handling:** Create record or not?~~ → **RESOLVED:** Create test record with status "skipped", count in metadata
8. ✅ ~~**Queue Modification:** Can queue be modified mid-session?~~ → **RESOLVED:** Cannot modify queue during session
9. ✅ ~~**Survey Failure:** What if survey can't be completed?~~ → **RESOLVED:** Save brain data, don't include survey for that test_id
10. **View Separation:** Researcher view vs participant view - how to handle? (Screen positioning handled, but UI design TBD)
11. **Verification Thresholds:** What are acceptable EEG signal quality levels? (To be determined with device)
12. ✅ ~~**Dummy Data:** What should dummy EEG data look like for development?~~ → **RESOLVED:** Any data flowing (not all zeros)

### Medium Priority

6. ✅ ~~**Queue Management:** Can queue be modified mid-session?~~ → **RESOLVED:** Cannot modify queue during session
7. **Test Retry:** Can individual tests be re-run? (Not yet decided)
8. ✅ ~~**Session Pause:** Can sessions be paused and resumed?~~ → **RESOLVED:** Cannot be paused/resumed
9. **Break Duration:** Should there be enforced breaks between tests? (Checkpoint allows breaks, but duration TBD)
10. ✅ ~~**Participant Info:** What participant metadata is required?~~ → **RESOLVED:** Participant ID (auto-generated UUID, required), Name (required), Notes (optional)
11. ✅ ~~**Participant ID format:** How should participant_id be generated?~~ → **RESOLVED:** Auto-generated UUID
12. ✅ ~~**Participant ID validation:** Should system check for duplicate IDs?~~ → **RESOLVED:** Yes, system checks for duplicates
13. ✅ ~~**Checkpoint Info:** What information should be displayed?~~ → **RESOLVED:** Current test number, next pattern name, session progress

### Low Priority

11. **Export Format:** When/how to export session data?
12. **Progress Indicators:** What progress info should be displayed?
13. ✅ ~~**Error Recovery:** How to handle various error scenarios?~~ → **PARTIALLY RESOLVED:** Audio retry/skip, EEG log and continue, abort with flag
14. **Accessibility:** Any accessibility considerations for participant interface?
15. **Multi-select Implementation:** Technical feasibility of shift+click multi-select
16. **Live EEG Panel:** Design and functionality of collapsible live data panel
17. **Screen Position Reminder:** UI indicator for researcher about screen positioning
18. ✅ ~~**Additional Session Metadata:** What other metadata fields would be useful?~~ → **RESOLVED:** Computer info (name, platform, OS, screen, hardware) - see decisions above
19. ✅ ~~**Computer Identifier Input:** When should researcher enter computer name?~~ → **RESOLVED:** Dropdown at session start, defaults to lab's primary iMac
20. **Computer List Management:** Where should computer list be stored? How to add new computers?
20. **Audio Device Capture:** Should we capture audio output device? (May require user permission)

---

## Implementation Phases

### Phase 1: MVP (Current Focus)
- ✅ Pattern queue interface
- ✅ Basic session management
- ⏳ Dummy EEG data display
- ⏳ Basic test protocol (30s baseline + 30s testing)
- ⏳ Simple survey (4 options)
- ⏳ Checkpoint between tests
- ⏳ Session save

### Phase 2: Device Integration
- ⏳ Real EEG device connection
- ⏳ Signal quality verification
- ⏳ Real-time EEG data display
- ⏳ Data quality monitoring

### Phase 3: Enhanced Features
- ⏳ Session pause/resume
- ⏳ Test retry functionality
- ⏳ Advanced error handling
- ⏳ Dual-screen support
- ⏳ Enhanced survey options

---

## Next Steps

1. ✅ ~~**Define survey options**~~ → **PARTIAL:** A, B, C, D format decided, specific options TBD
2. ✅ ~~**Clarify audio duration handling**~~ → **RESOLVED:** Loop if <30s, cut if >30s
3. **Design UI mockups** - Researcher vs participant views, overlay design
4. **Define verification criteria** - EEG signal quality thresholds (with device)
5. ✅ ~~**Create dummy data generator**~~ → **RESOLVED:** Any flowing data (not zeros)
6. **Prototype test flow** - Build MVP workflow with decisions above
7. **User testing** - Test with researchers before EEG integration
8. **Implement multi-select** - Shift+click functionality for pattern selection
9. **Design live EEG panel** - Collapsible panel with real-time data display
10. **Define additional metadata** - Browser, device, OS details to capture

---

## Notes

- This protocol is designed to be flexible and accommodate research needs
- All decisions should be validated with research team and participants
- Protocol may evolve based on initial testing and feedback
- Consider IRB requirements when finalizing participant interaction flow

---

## Questions & Concerns

### Workflow Order & Dependencies

**✅ RESOLVED:**
1. **Order of operations:** Required sequence (NOT flexible):
   - Step 1: Create queue (at least 1 pattern required)
   - Step 2: EEG verification (optional, but recommended)
   - Step 3: Start session
   
2. **Session start validation:**
   - ✅ Queue must have at least 1 pattern (blocked if empty)
   - ✅ EEG connection optional (can start without EEG, but status noted in metadata)
   - ✅ System validates prerequisites before allowing session start

### Data Integrity & Partial Data

**✅ RESOLVED:**
3. **Aborted test data:**
   - ✅ If aborted during baseline: Discard all data (no test record created)
   - ✅ If aborted during testing: Save baseline + partial testing data, flag as "aborted"
   - ✅ Minimum data required: Must have completed baseline phase (30s) to save test

4. **Skipped test handling:** If audio fails and test is skipped:
   - ✅ Test record created with `status: "skipped"`
   - ✅ Skipped tests counted in `session_metadata.tests_skipped`

5. **Survey failure:** What if survey can't be submitted?
   - ✅ Save brain data (EEG data)
   - ✅ Do not include survey response for that `test_id`
   - ✅ Test saved without survey (marked as incomplete or survey_missing flag?)

### Audio Technical Details

**✅ RESOLVED:**
6. **Audio looping:** 
   - ✅ Seamless looping (no gaps, no silence between loops)
   - ✅ `audio_time_offset` calculated from testing phase start to first audio playback start (does not reset on loops)
   - ✅ For patterns < 30s: Loop seamlessly for entire 30 seconds

7. **Audio cutting:** 
   - ✅ 5-second fade-out starting at 25s, cut at 30s
   - ✅ Prevents jarring mid-note cuts

8. **Audio timing precision:** 
   - ✅ `audio_time_offset` = milliseconds from testing phase start to actual audio playback start
   - ✅ Used for synchronizing EEG samples with audio playback
   - ✅ Audio retry: 5 retry attempts if audio fails to start
   - ✅ Skip test UI: Button presented in error dialog
   - ❓ What's the acceptable variance between intended and actual audio start time? (TBD)

### Survey User Experience

**✅ RESOLVED:**
9. **Survey completion detection:**
   - ✅ Participant clicks "Complete Survey" button when done
   - ✅ Researcher knows participant is done when participant clicks "Complete Survey" on final test in session
   - ❓ What if participant takes a long time? (No time limit mentioned)

10. **Survey validation:**
   - ✅ Require at least one option selected before "Complete Survey" button is enabled
   - ✅ Participant clicks "Complete Survey" button
   - ❓ Can researcher see survey responses before participant clicks "Complete Survey"?

11. **Survey UI clarity:**
   - ✅ Full-screen overlay with multi-select buttons (A, B, C, D)
   - ❓ How to show pattern playing status while survey overlay is full-screen? (Visual design needed)
   - ❓ Should there be instructions displayed on survey overlay?

### Session Management

**✅ RESOLVED:**
12. **Researcher name:** 
   - ✅ Dropdown selection from stored values: pandji, noah, jonathan, long
   - ✅ Selected at session start

13. **Session cancellation:** If researcher cancels before starting tests:
   - ❓ Is any data saved? (Session record with 0 tests?) Or completely discarded?
   - ❓ Can they recover cancelled session?

14. ✅ ~~**Queue modification:** Can queue be modified mid-session?~~ → **RESOLVED:** Cannot modify queue during session
   - ❓ **Wrong pattern queued:** What if researcher realizes wrong pattern was queued? (Skip that test? Continue anyway?)

### Error Recovery & Edge Cases

**Critical Concerns:**
15. **Browser crash recovery:**
   - Is there auto-save during session? (Save after each test?)
   - Can session be recovered after crash?
   - What data is lost if crash occurs mid-test?

16. **Storage full:** What happens if storage fills up mid-session?
   - Warn researcher? Prevent new tests?
   - Can they export partial session and continue?

17. **Checkpoint accidental advance:**
   - What if researcher accidentally presses Enter at checkpoint?
   - Can they go back to previous test?
   - Should there be a confirmation dialog?

### EEG Data Quality

**Data Quality Concerns:**
18. **EEG disconnection timing:**
   - If disconnects during baseline vs testing, should handling differ?
   - What if reconnects before phase ends? Continue recording?

19. **Partial EEG data:**
   - If EEG disconnects for 5 seconds during 30s baseline, is that acceptable?
   - What's the minimum data quality threshold? (e.g., 90% of samples present?)

20. **Verification override:**
   - If researcher overrides failed verification, should this be prominently logged?
   - Should overridden sessions be flagged in analysis?

### Survey Options

**✅ RESOLVED:**
21. **Survey options:** 
   - ✅ A, B, C, D as placeholder options for now
   - ✅ Specific definitions TBD (need research team input)
   - ✅ Multi-select buttons (participant can select multiple)
   - ❓ Should options be randomized? Or fixed order?

### UI/UX Clarity

**Decisions:**
22. **Participant view:** 
   - ✅ Researcher and participant in same room
   - ✅ Researcher ensures screen positioning (screen not facing participant)
   - ❓ Should there be a "Participant View" mode that hides controls? Or rely on screen positioning?

23. **Progress visibility:** During test execution:
   - ❓ What should researcher see? (Queue, current test, EEG data, controls?)
   - ❓ What should participant see? (Nothing? Just countdown? Survey overlay?)
   - ✅ Screen positioning prevents participant from seeing researcher controls

---

**Document Status:** Draft - Ready for Review and Refinement
