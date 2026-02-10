# Questions for OpenBCI Ganglion Integration

**Date**: February 3, 2026  
**Context**: Integrating OpenBCI Ganglion device into web-based haptic-sound-visualizer application  
**Reference**: `signal_quality.py` implementation

---

## Technical Integration Questions

### Q1: BrainFlow JavaScript Availability
We're building a web application (JavaScript/HTML/CSS) and need to connect to the Ganglion device from a browser. 

**Questions:**
- Does BrainFlow have a JavaScript/WebAssembly version we can use directly in the browser?
- If not, what's the recommended approach for web integration?
- Are there any JavaScript-native alternatives you'd recommend for connecting to OpenBCI devices?

**Context**: Your `signal_quality.py` uses BrainFlow's Python library. We need to know if there's a browser-compatible version or if we need a different approach (backend service, Electron, etc.).

---

### Q2: Connection Method & Device Detection
**Questions:**
- How does the Ganglion connect to the computer? (USB dongle? Bluetooth? Both?)
- What's the serial port/connection identifier format? 
  - Windows: `COM5` (as in your script)?
  - Mac/Linux: `/dev/ttyUSB0` or similar?
- Can we detect available Ganglion devices programmatically? If so, how?
- Is there a way to list all connected OpenBCI devices?

**Context**: We need to detect when a device is connected to show the signal quality component automatically.

---

### Q3: Data Format & Sampling Rate
**Questions:**
- What's the exact sampling rate for Ganglion? (Your script uses `BoardShim.get_sampling_rate(board_id)`)
- What's the data format/structure? (channels × samples array? Other format?)
- What units are the raw values? (μV? V? ADC counts?)
- Are timestamps included in the data stream? If so, what format?
- What's the data type? (float32? int16?)

**Context**: We need to understand the data format to process it in JavaScript and calculate signal quality metrics.

---

### Q4: Channel Configuration
**Questions:**
- How many channels does Ganglion have? (Your script suggests 4 EEG channels)
- What are the channel names/labels? (CH1-CH4? Or anatomical names like Fp1, Fp2, etc.?)
- Can we configure which channels to monitor for quality? (Your script has `--quality_channels` parameter)
- Are all channels always active, or can we enable/disable specific channels?

**Context**: We need to display quality for each channel and understand the channel mapping.

---

### Q5: Signal Quality Algorithm & Thresholds
**Questions:**
- Are the quality thresholds (RMS: 3-100 μV for "good", 60Hz_rel < 0.3) device-specific or universal?
- Should these thresholds be configurable, or are they standard for Ganglion?
- Are there other quality metrics we should consider? (e.g., impedance, signal-to-noise ratio, line noise at other frequencies)
- Why 60Hz specifically? (Is this for 60Hz power line noise in North America? Should we also check 50Hz for Europe?)

**Context**: We want to ensure our quality classification matches your implementation and understand if thresholds should be adjustable.

---

### Q6: Performance & Real-time Requirements
**Questions:**
- What's the minimum update frequency for useful quality feedback? (Your script defaults to 1 second)
- How much data do we need to buffer for accurate PSD calculation? (Your script uses 2-second window)
- What's the acceptable latency between device and display? (e.g., < 100ms? < 500ms?)
- Are there any performance considerations we should be aware of? (CPU usage, memory, etc.)

**Context**: We need to balance real-time feedback with performance, especially in a browser environment.

---

### Q7: Error Handling & Connection Management
**Questions:**
- What errors can occur during connection/streaming? (Common failure modes?)
- How do we detect device disconnection? (Does BrainFlow throw exceptions? Return null? Set a flag?)
- Should we implement auto-reconnect if connection drops? Or is manual reconnection preferred?
- What happens if we try to connect when device is already in use by another application?

**Context**: We need robust error handling for production use, especially during active test sessions.

---

### Q8: Platform Compatibility
**Questions:**
- Does BrainFlow/Ganglion work on Windows/Mac/Linux? Any platform-specific considerations?
- Are there any browser-specific requirements or limitations?
- Do we need special permissions (USB/Serial port access)? How do we request these?
- Are there any security considerations for web applications accessing hardware devices?

**Context**: Our users may be on different platforms, and we need to understand compatibility and permission requirements.

---

## Integration Architecture Questions

### Q9: Backend vs Frontend Approach
We're considering two approaches:

**Option A**: Calculate signal quality in browser (JavaScript)
- Port PSD calculation to JavaScript
- Direct device connection from browser (if possible)

**Option B**: Calculate signal quality in backend (Python)
- Keep your Python implementation
- Communicate via WebSocket/HTTP
- Browser displays results

**Questions:**
- Which approach do you recommend? Why?
- If backend approach, what's the best communication protocol? (WebSocket? HTTP polling? Server-Sent Events?)
- If frontend approach, is it feasible to port the PSD calculation to JavaScript? Any gotchas?

**Context**: We want to choose the most reliable and maintainable approach.

---

### Q10: Data Collection Integration
We have an existing `EEGDataCollector` module that collects brainwave readings during test sessions. Currently it uses dummy data, but we want to replace it with real Ganglion data.

**Questions:**
- Should signal quality monitoring be separate from data collection, or integrated?
- Should quality metrics be included in the brainwave readings data we store?
- Do we need to store quality metrics historically, or just display real-time?

**Context**: We need to understand how signal quality fits into our overall data collection architecture.

---

### Q11: Calibration & Session Integration
Our test flow includes:
1. 20-second calibration phase (collecting brainwave readings)
2. Baseline phase (30 seconds)
3. Stimulation phase (30 seconds, playing audio)
4. Survey phase

**Questions:**
- Should signal quality be checked during the calibration phase? (Before starting trials?)
- Do we need a separate "signal quality check" phase before calibration?
- What's the minimum acceptable quality to proceed with a session? (All channels "good"? At least "ok"?)
- Should we monitor quality continuously during trials, or just at the start?

**Context**: We want to ensure data quality while maintaining a smooth user experience.

---

## Additional Context

### Our Current Implementation
- **Language**: JavaScript (web application)
- **Architecture**: Component-based (similar to React but vanilla JS)
- **Data Storage**: MySQL database (via backend API)
- **Current EEG Module**: `js/modules/eegDataCollector.js` (uses dummy data)

### Your Reference Implementation
- **File**: `signal_quality.py`
- **Library**: BrainFlow (Python)
- **Features**: 
  - Connects to Ganglion via serial port
  - Calculates PSD using Welch's method
  - Computes RMS and 60Hz relative power
  - Classifies quality as "good", "ok", or "poor"
  - Updates display every 1 second

### What We're Building
1. **Signal Quality Visualization Component**: Real-time display of quality metrics (like your terminal output, but in browser UI)
2. **Integration**: Connect to real device (replace dummy data)
3. **Test Flow Integration**: Show quality during calibration and trials

---

## Priority

**High Priority** (Block implementation):
- Q1: BrainFlow JavaScript availability
- Q2: Connection method & device detection
- Q3: Data format & sampling rate
- Q9: Backend vs frontend approach

**Medium Priority** (Affect design):
- Q4: Channel configuration
- Q5: Quality thresholds
- Q6: Performance requirements
- Q7: Error handling

**Lower Priority** (Can refine later):
- Q8: Platform compatibility details
- Q10: Data collection integration
- Q11: Calibration integration

---

Thank you for your help! Please feel free to answer what you can, and we can follow up on any unclear points.
