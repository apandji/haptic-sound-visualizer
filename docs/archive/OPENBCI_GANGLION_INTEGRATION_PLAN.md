# OpenBCI Ganglion Integration Plan

**Status**: 🚧 **IN PROGRESS** - Planning Phase  
**Last Updated**: February 3, 2026  
**Collaborator**: [Name] (provided `signal_quality.py`)

---

## Overview

This document outlines the plan for integrating OpenBCI Ganglion EEG device into the haptic-sound-visualizer application, with an initial focus on building a **Signal Quality Visualization Component**.

### Goals
1. **Phase 1**: Build Signal Quality Visualization Component (this document)
2. **Phase 2**: Integrate real EEG data collection (replace dummy data)
3. **Phase 3**: Real-time visualization during test sessions
4. **Phase 4**: Data persistence and analysis

---

## Current State Analysis

### Existing Implementation
- **`js/modules/eegDataCollector.js`**: Currently uses dummy/simulated data
- **`js/modules/testSession.js`**: Collects brainwave readings during trials
- **Database Schema**: `brainwave_readings` table stores frequency band data (delta, theta, alpha, beta, gamma)
- **Test Flow**: EEG data collection happens during calibration, baseline, and stimulation phases

### Python Reference Implementation
**File**: `signal_quality.py`

**Key Functionality**:
- Connects to OpenBCI Ganglion via BrainFlow library
- Computes signal quality metrics per channel:
  - **RMS (μV)**: Root mean square amplitude (1-45 Hz band)
  - **60Hz relative power**: 60Hz noise relative to total power
  - **Quality rating**: "good", "ok", or "poor" based on thresholds
- Updates display every 1 second (configurable)
- Uses 2-second window for PSD (Power Spectral Density) calculation

**Quality Thresholds** (from Python code):
- **Good**: `3.0 ≤ RMS ≤ 100.0 μV` AND `60Hz_rel < 0.3`
- **OK**: `0.5 ≤ RMS ≤ 300.0 μV` AND `60Hz_rel < 0.6`
- **Poor**: Everything else

**Technical Details**:
- Uses Welch's method for PSD calculation
- Hanning window function
- Ganglion has 4 EEG channels (CH1-CH4)
- Sampling rate: `BoardShim.get_sampling_rate(board_id)` (typically 200 Hz for Ganglion)

---

## Signal Quality Component: Design Plan

### Component Name
**`SignalQualityVisualizer`** (or `SignalQualityMonitor`)

### File Structure
```
js/components/base/SignalQualityVisualizer.js
css/components/base/signalQualityVisualizer.css
dev/components-examples/signal-quality-visualizer.example.html
```

### Component Purpose
Display real-time signal quality metrics for each EEG channel, helping researchers:
1. **Verify device connection** before starting a session
2. **Monitor signal quality** during calibration
3. **Identify issues** (poor contact, noise, disconnection) early
4. **Ensure data quality** before committing to a trial

### UI Pattern: Intercom-Style Widget ⭐ **DECIDED**

**Design**: Floating widget that appears when device is connected
- **Minimized state**: Small button/indicator (like Intercom chat button)
- **Expanded state**: Full signal quality table
- **Auto-show**: Appears automatically when device connects
- **Position**: Fixed position (bottom-right corner, or configurable)
- **Collapsible**: Can be minimized/expanded by user

### UI Design

#### Layout Options

**Option A: Table View (Matches Python Output)** ⭐ **RECOMMENDED**
```
┌─────────────────────────────────────────┐
│ Signal Quality                          │
├──────────┬─────────┬──────────┬────────┤
│ Channel  │ RMS_μV  │ 60Hz_rel │ Quality│
├──────────┼─────────┼──────────┼────────┤
│ CH1      │  45.2   │   0.12   │  good  │
│ CH2      │  38.7   │   0.18   │  good  │
│ CH3      │ 125.3   │   0.45   │   ok   │
│ CH4      │ 350.1   │   0.78   │  poor  │
└──────────┴─────────┴──────────┴────────┘
```

**Option B: Card Grid View**
```
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│  CH1    │ │  CH2    │ │  CH3    │ │  CH4    │
│         │ │         │ │         │ │         │
│  good   │ │  good   │ │   ok    │ │  poor   │
│         │ │         │ │         │ │         │
│ RMS: 45 │ │ RMS: 39 │ │ RMS:125 │ │ RMS:350 │
└─────────┘ └─────────┘ └─────────┘ └─────────┘
```

**Option C: Visual Indicators (Minimal)**
```
CH1: ●●●●● (good)  CH2: ●●●●● (good)  CH3: ●●●○○ (ok)  CH4: ●○○○○ (poor)
```

**Recommendation**: **Option A** - Table view matches Python output, familiar to researchers, easy to scan.

#### Visual Design
- **Color coding**:
  - **Good**: Green indicator/border (`#4caf50` or `#2e7d32`)
  - **OK**: Yellow/amber indicator (`#ff9800` or `#f57c00`)
  - **Poor**: Red indicator (`#f44336` or `#c62828`)
- **Update frequency**: 1 second (configurable, default 1s)
- **Animation**: Smooth transitions when values change
- **Responsive**: Works on different screen sizes

### Component API

```javascript
const signalQuality = new SignalQualityVisualizer({
    containerId: 'signalQuality',
    updateInterval: 1000, // ms (default: 1000)
    windowLength: 2.0,     // seconds for PSD window (default: 2.0)
    onQualityChange: (channelQualities) => {
        // channelQualities = [
        //   { channel: 'CH1', rms_uV: 45.2, p60_rel: 0.12, quality: 'good' },
        //   ...
        // ]
    },
    onConnectionChange: (isConnected) => {
        // Called when device connects/disconnects
    }
});

// Methods
signalQuality.start();           // Start monitoring
signalQuality.stop();            // Stop monitoring
signalQuality.getQualities();    // Get current quality metrics
signalQuality.isConnected();     // Check connection status
signalQuality.destroy();         // Cleanup
```

---

## Technical Architecture

### Integration Points

#### 1. Browser Connection Technologies ⭐ **RESEARCH COMPLETE**

**Research Findings** (February 3, 2026):

**Option A: Web Bluetooth API** ⭐ **RECOMMENDED**
- **Library**: `ganglion-ble` (GitHub: neurosity/ganglion-ble)
- **Status**: Archived July 2020, but functional
- **Alternative**: `openbci-ganglion-js` (also archived)
- **Pros**: 
  - Direct browser connection (no backend needed)
  - Pure JavaScript
  - Works with Ganglion's Bluetooth capability
- **Cons**: 
  - Libraries are archived (may need maintenance/fork)
  - Requires HTTPS
  - Requires user interaction to connect
  - Browser support: Chrome/Edge (not Safari/Firefox)

**Option B: Web Serial API**
- **Status**: Experimental, limited browser support
- **Pros**: 
  - Can connect to USB serial devices
  - Direct browser connection
- **Cons**: 
  - Chrome/Edge only (not Safari/Firefox)
  - Requires HTTPS
  - Requires user interaction
  - May not work with Ganglion's Bluetooth dongle

**Option C: BrainFlow JavaScript**
- **Status**: ❌ **NOT AVAILABLE**
- **Finding**: BrainFlow focuses on Python/C++/Node.js, no WebAssembly/browser version
- **Conclusion**: Cannot use BrainFlow directly in browser

**Option D: Python Backend + WebSocket**
- **Status**: ✅ **VIABLE**
- **Approach**: Run Python script (`signal_quality.py`) as backend service
- **Communication**: WebSocket for real-time data
- **Pros**: 
  - Can use existing Python code
  - Works with BrainFlow
  - Cross-browser compatible
- **Cons**: 
  - Requires backend infrastructure
  - More complex architecture

**Recommendation**: **Start with Option A (Web Bluetooth)** - Use `ganglion-ble` or fork/maintain it. Fallback to Option D (backend) if Web Bluetooth doesn't meet requirements.

#### 2. Data Flow
```
OpenBCI Ganglion
    ↓ (USB/Bluetooth)
BrainFlow Library (Python or JS)
    ↓ (Raw EEG data: channels × samples)
Signal Quality Calculator
    ↓ (PSD → RMS, 60Hz power → Quality rating)
SignalQualityVisualizer Component
    ↓ (Display in UI)
```

#### 3. Signal Quality Calculation

**Algorithm** (from Python `compute_channel_quality`):
1. Get raw EEG data for channel (in μV)
2. Calculate PSD using Welch's method:
   - Window length: 2 seconds (configurable)
   - Overlap: 50%
   - Window function: Hanning
   - FFT size: Nearest power of 2 (minimum 8)
3. Calculate band powers:
   - Total power (1-45 Hz): `band_power(1.0, 45.0)`
   - 60Hz power: `band_power(55.0, 65.0)`
   - 60Hz relative: `60Hz_power / total_power`
4. Calculate RMS: `sqrt(total_power)`
5. Classify quality based on thresholds

**JavaScript Implementation Considerations**:
- Need FFT library (e.g., `fft.js`, `dsp.js`, or Web Audio API)
- Need PSD calculation (Welch's method)
- Need to handle real-time streaming data

#### 4. Connection Management

**States**:
- **Disconnected**: No device detected
- **Connecting**: Attempting to connect
- **Connected**: Device connected, streaming data
- **Error**: Connection failed or device disconnected

**Error Handling**:
- Device not found
- Connection timeout
- Data stream interruption
- Invalid data format

---

## Critical Questions

### User Decisions ✅ (Answered 2026-02-03)

1. **Where should Signal Quality component appear?**
   - ✅ **DECIDED**: Appear whenever browser detects device is connected
   - ✅ **UI Pattern**: Like Intercom button (floating/minimized widget that can expand)
   - ✅ **Behavior**: Auto-show when device connected, can be minimized/expanded

2. **When should we check signal quality?**
   - ✅ **DECIDED**: Continuously during entire session (when device is connected)

3. **What happens if signal quality is poor?**
   - ✅ **DECIDED**: Show warning but allow to continue
   - ⚠️ **TODO**: Design UX for null/dropped connection during test flow
   - **Considerations**: 
     - Should we pause trial automatically?
     - Show prominent warning overlay?
     - Allow researcher to abort trial?

4. **Update frequency preference?**
   - ⚠️ **CLARIFICATION NEEDED**: User unsure - defaulting to 1 second (matches Python script)
   - **Recommendation**: Start with 1s, make configurable if needed

5. **Should we show historical quality trends?**
   - ⚠️ **CLARIFICATION NEEDED**: User unsure - starting with current values only
   - **Recommendation**: MVP shows current values, can add trends later if needed

6. **Integration with existing EEGDataCollector?**
   - ✅ **DECIDED**: Build on top of `EEGDataCollector` (extend/enhance existing module)
   - **Approach**: Signal quality monitoring as feature of `EEGDataCollector`, not separate component

### For Collaborator (Need Answers)

#### Technical Questions

**Q1: BrainFlow JavaScript Availability**
- Does BrainFlow have a JavaScript/WebAssembly version we can use in the browser?
- If not, what's the recommended approach for web integration?
- Are there any JavaScript-native alternatives you'd recommend?

**Q2: Connection Method**
- How does the Ganglion connect? (USB dongle? Bluetooth? Both?)
- What's the serial port/connection identifier format? (e.g., `COM5` on Windows, `/dev/ttyUSB0` on Linux)
- Can we detect available devices programmatically?

**Q3: Data Format & Sampling**
- What's the exact sampling rate for Ganglion? (Python uses `BoardShim.get_sampling_rate()`)
- What's the data format? (channels × samples array?)
- What units are the raw values? (μV? V? ADC counts?)
- Are timestamps included in the data stream?

**Q4: Channel Configuration**
- How many channels does Ganglion have? (Python suggests 4 EEG channels)
- What are the channel names/labels? (CH1-CH4? Or anatomical names?)
- Can we configure which channels to monitor for quality?

**Q5: Signal Quality Algorithm**
- Are the quality thresholds (RMS, 60Hz) device-specific or universal?
- Should these thresholds be configurable?
- Are there other quality metrics we should consider? (e.g., impedance, signal-to-noise ratio)

**Q6: Performance & Real-time Requirements**
- What's the minimum update frequency for useful quality feedback?
- How much data do we need to buffer for accurate PSD calculation? (2 seconds?)
- What's the latency between device and display? (acceptable range?)

**Q7: Error Handling**
- What errors can occur during connection/streaming?
- How do we detect device disconnection?
- Should we auto-reconnect if connection drops?

**Q8: Platform Compatibility**
- Does this work on Windows/Mac/Linux?
- Any browser-specific requirements?
- Do we need special permissions (USB/Serial port access)?

#### Integration Questions

**Q9: Backend vs Frontend**
- Should signal quality calculation run in browser (JS) or backend (Python)?
- If backend, what's the communication protocol? (WebSocket? HTTP polling? SSE?)
- If frontend, can we port the Python PSD calculation to JavaScript?

**Q10: Data Collection Integration**
- Should signal quality monitoring be separate from data collection?
- Or should quality metrics be included in `brainwave_readings` table?
- Do we need to store quality metrics historically?

**Q11: Calibration Integration**
- Should signal quality be checked during the 20-second calibration phase?
- Do we need a "signal quality check" phase before calibration?
- What's the minimum acceptable quality to proceed?

---

## Implementation Phases

### Phase 1: Signal Quality Component (MVP)
**Goal**: Build UI component that displays signal quality (can use dummy data initially)

**Tasks**:
1. Create `SignalQualityVisualizer` component structure
2. Design UI (table view with color coding)
3. Implement dummy data mode (simulate 4 channels with realistic values)
4. Add update loop (1s interval)
5. Add connection state indicators
6. Create example page for testing

**Deliverables**:
- Component renders correctly
- Updates every second
- Shows good/ok/poor states with colors
- Handles connection states

**Estimated Effort**: 1-2 days

---

### Phase 2: BrainFlow Integration Research
**Goal**: Determine integration approach and prototype connection

**Tasks**:
1. Research BrainFlow JavaScript availability
2. Evaluate backend vs frontend approach
3. Prototype device connection (if possible)
4. Test data streaming
5. Document findings

**Deliverables**:
- Decision on integration approach
- Working prototype (even if limited)
- Integration guide document

**Estimated Effort**: 2-3 days (depends on approach)

**Blockers**: Need answers to Collaborator Questions Q1-Q4

---

### Phase 3: Real Signal Quality Calculation
**Goal**: Replace dummy data with real device data

**Tasks**:
1. Implement PSD calculation in JavaScript (or connect to backend)
2. Implement RMS and 60Hz relative power calculation
3. Implement quality classification
4. Connect to real device
5. Test with actual Ganglion

**Deliverables**:
- Real-time signal quality from device
- Accurate quality ratings

**Estimated Effort**: 3-5 days

**Blockers**: Need answers to Collaborator Questions Q5-Q8

---

### Phase 4: Integration with Test Flow
**Goal**: Integrate signal quality monitoring into test execution flow

**Tasks**:
1. Add signal quality check to Test Setup page
2. Show quality during calibration phase
3. Optional: Show quality during trials
4. Handle poor quality scenarios
5. Update `EEGDataCollector` to use real data

**Deliverables**:
- Signal quality integrated into test flow
- Quality checks before/during sessions

**Estimated Effort**: 2-3 days

---

### Phase 5: Polish & Error Handling
**Goal**: Robust error handling and user experience

**Tasks**:
1. Comprehensive error handling
2. Connection retry logic
3. User-friendly error messages
4. Documentation
5. Testing on different platforms

**Deliverables**:
- Production-ready component
- Error handling guide
- User documentation

**Estimated Effort**: 2-3 days

---

## Data Structure

### Signal Quality Data Format

```javascript
// Per-channel quality object
{
    channel: 'CH1',           // Channel identifier
    channelIndex: 0,          // 0-based index
    rms_uV: 45.2,             // RMS amplitude in microvolts
    p60_rel: 0.12,            // 60Hz relative power (0-1)
    quality: 'good',           // 'good' | 'ok' | 'poor'
    timestamp: 1704321000000   // Unix timestamp (ms)
}

// All channels
[
    { channel: 'CH1', rms_uV: 45.2, p60_rel: 0.12, quality: 'good', ... },
    { channel: 'CH2', rms_uV: 38.7, p60_rel: 0.18, quality: 'good', ... },
    { channel: 'CH3', rms_uV: 125.3, p60_rel: 0.45, quality: 'ok', ... },
    { channel: 'CH4', rms_uV: 350.1, p60_rel: 0.78, quality: 'poor', ... }
]
```

### Integration with Database

**Question**: Should we store signal quality metrics in the database?

**Options**:
- **A) Store in `brainwave_readings` table**: Add `signal_quality` column
- **B) New table**: `signal_quality_readings` (trial_id, timestamp, channel, quality metrics)
- **C) Don't store**: Only display real-time, don't persist

**Recommendation**: **Option B** - Separate table allows querying quality trends without bloating brainwave_readings.

---

## Dependencies

### Required Libraries

1. **FFT/PSD Calculation**:
   - Option A: `fft.js` or `dsp.js` (JavaScript)
   - Option B: Web Audio API (browser-native)
   - Option C: Backend Python (BrainFlow)

2. **Device Communication**:
   - Option A: BrainFlow JS/WASM
   - Option B: WebSocket client (if Python backend)
   - Option C: Serial port API (if browser supports)

3. **UI/Visualization**:
   - Existing CSS framework
   - No new dependencies needed

### External Services (if backend approach)
- Python backend service
- WebSocket server
- Device connection management

---

## Testing Strategy

### Unit Tests
- Signal quality calculation (PSD, RMS, 60Hz)
- Quality classification logic
- Component rendering

### Integration Tests
- Device connection/disconnection
- Data streaming
- Error handling

### Manual Testing
- Test with actual Ganglion device
- Test on different platforms (Windows/Mac/Linux)
- Test with poor signal conditions
- Test connection failures

---

## Risks & Mitigations

### Risk 1: BrainFlow JavaScript Not Available
**Impact**: High - Need alternative approach  
**Mitigation**: 
- Research alternatives early (Phase 2)
- Consider backend approach if needed
- Evaluate JavaScript-native EEG libraries

### Risk 2: Browser Security Restrictions
**Impact**: Medium - May block device access  
**Mitigation**:
- Use HTTPS for Web Serial API (if available)
- Consider Electron app for desktop
- Backend approach avoids browser restrictions

### Risk 3: Performance Issues
**Impact**: Medium - Real-time calculation may be CPU-intensive  
**Mitigation**:
- Optimize PSD calculation
- Use Web Workers for computation
- Consider backend calculation if needed

### Risk 4: Device Compatibility
**Impact**: Low - Ganglion is standard device  
**Mitigation**:
- Test with multiple devices
- Follow BrainFlow documentation
- Handle device-specific quirks

---

## Next Steps

### Immediate (This Week)
1. ✅ Create this planning document
2. ⏳ Answer User Questions (1-6)
3. ⏳ Send Collaborator Questions (Q1-Q11) to collaborator
4. ⏳ Research BrainFlow JavaScript availability

### Short-term (Next 1-2 Weeks)
1. Build Phase 1: Signal Quality Component (MVP with dummy data)
2. Research integration approach (Phase 2)
3. Get answers from collaborator
4. Prototype device connection

### Medium-term (Next Month)
1. Implement real device integration (Phase 3)
2. Integrate into test flow (Phase 4)
3. Polish and error handling (Phase 5)

---

## References

- **Python Reference**: `signal_quality.py`
- **Database Schema**: `docs/archive/database_schema.txt` (legacy sketch; use root `schema.sql`)
- **Existing EEG Module**: `js/modules/eegDataCollector.js`
- **Test Flow Design**: `docs/archive/TEST_EXECUTION_FLOW_DESIGN.md`
- **BrainFlow Documentation**: [To be added]

---

## Notes & Decisions Log

### 2026-02-03
- Created initial planning document
- Analyzed Python reference implementation
- Identified critical questions
- Proposed component design (table view recommended)

---

## Appendix: Python Code Analysis

### Key Functions

**`compute_channel_quality(raw_eeg_uV, fs)`**:
- Input: Raw EEG data (channels × samples) in μV, sampling rate
- Output: Array of quality objects per channel
- Algorithm: PSD → Band powers → RMS → Quality classification

**`print_signal_quality(ch_labels, qualities)`**:
- Displays table format
- Updates every `update_sec` (default 1s)

**`main()`**:
- Connects to Ganglion via BrainFlow
- Streams data continuously
- Calculates and displays quality metrics

### Key Constants
- **Window length**: 2 seconds (configurable)
- **Update interval**: 1 second (configurable)
- **Quality thresholds**: Hardcoded in `compute_channel_quality`
