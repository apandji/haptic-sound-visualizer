# Technology Research: OpenBCI Ganglion Browser Integration

**Date**: February 3, 2026  
**Goal**: Connect OpenBCI Ganglion device to web application from browser

---

## Executive Summary

**Primary Recommendation**: Use **Web Bluetooth API** with JavaScript library (`ganglion-ble` or fork)

**Alternative**: Python backend service with WebSocket communication

**Not Viable**: BrainFlow JavaScript/WebAssembly (doesn't exist)

---

## Option 1: Web Bluetooth API ⭐ **RECOMMENDED**

### Library: `ganglion-ble`

**Repository**: https://github.com/neurosity/ganglion-ble  
**Status**: Archived (July 29, 2020) but functional  
**Maintainer**: Neurosity (originally)

**Features**:
- Pure JavaScript Web Bluetooth client for Ganglion
- Async/await API
- Streams 4-channel EEG data with timestamps
- No backend required

**Usage Example**:
```javascript
import Ganglion from 'ganglion-ble';

const ganglion = new Ganglion();
await ganglion.connect();
await ganglion.start();
ganglion.stream.subscribe(sample => {
    // sample contains 4-channel EEG data + timestamp
    console.log(sample);
});
```

**Pros**:
- ✅ Direct browser connection (no backend)
- ✅ Pure JavaScript (fits our stack)
- ✅ Simple API
- ✅ Real-time streaming
- ✅ Works with Ganglion's Bluetooth capability

**Cons**:
- ⚠️ Library is archived (may need maintenance/fork)
- ⚠️ Requires HTTPS (secure context)
- ⚠️ Requires user interaction to connect (security requirement)
- ⚠️ Browser support: Chrome/Edge only (not Safari/Firefox)

**Browser Support**:
- ✅ Chrome 56+
- ✅ Edge 79+
- ❌ Safari (not supported)
- ❌ Firefox (not supported)

**Installation**:
```bash
npm install ganglion-ble
```

**Requirements**:
- HTTPS (or localhost for development)
- User gesture to initiate connection
- Chrome/Edge browser

---

### Alternative: `openbci-ganglion-js`

**Repository**: https://github.com/openbci-archive/openbci-ganglion-js  
**Status**: Archived (part of OpenBCI archive)

Similar functionality to `ganglion-ble`, also uses Web Bluetooth API.

---

## Option 2: Web Serial API

**Documentation**: https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API

**Status**: Experimental, limited browser support

**Features**:
- Connect to USB serial devices
- Direct browser communication
- No backend required

**Pros**:
- ✅ Direct browser connection
- ✅ Can connect to USB devices

**Cons**:
- ⚠️ Chrome/Edge only (not Safari/Firefox)
- ⚠️ Requires HTTPS
- ⚠️ Requires user interaction
- ⚠️ May not work with Ganglion's Bluetooth dongle (designed for USB serial)

**Browser Support**:
- ✅ Chrome 80+
- ✅ Edge 80+
- ❌ Safari (not supported)
- ❌ Firefox (not supported)

**Usage Example**:
```javascript
const port = await navigator.serial.requestPort();
await port.open({ baudRate: 115200 });
const reader = port.readable.getReader();
// Read data...
```

**Viability for Ganglion**: ⚠️ **UNCERTAIN** - Ganglion uses Bluetooth, not USB serial. May not be applicable unless using USB dongle in serial mode.

---

## Option 3: BrainFlow JavaScript/WebAssembly ❌ **NOT AVAILABLE**

**Research Finding**: BrainFlow does **NOT** have a JavaScript/WebAssembly version for browser use.

**BrainFlow Supports**:
- ✅ Python
- ✅ C++
- ✅ Node.js (server-side)
- ❌ Browser/WebAssembly (not available)

**Conclusion**: Cannot use BrainFlow directly in browser. Would need backend approach if using BrainFlow.

---

## Option 4: Python Backend + WebSocket ✅ **VIABLE ALTERNATIVE**

### Architecture

```
Browser (JavaScript)
    ↓ (WebSocket)
Python Backend Service
    ↓ (BrainFlow)
OpenBCI Ganglion Device
```

### Implementation Approach

1. **Backend Service** (Python):
   - Run `signal_quality.py` as service
   - Connect to Ganglion via BrainFlow
   - Calculate signal quality metrics
   - Stream data via WebSocket

2. **Frontend** (JavaScript):
   - Connect to backend via WebSocket
   - Receive signal quality data
   - Display in UI component

**Pros**:
- ✅ Can use existing Python code (`signal_quality.py`)
- ✅ Works with BrainFlow (proven solution)
- ✅ Cross-browser compatible (WebSocket standard)
- ✅ Can run on any platform (Windows/Mac/Linux)
- ✅ More control over error handling

**Cons**:
- ❌ Requires backend infrastructure
- ❌ More complex architecture
- ❌ Additional deployment/maintenance
- ❌ Network latency (minimal but present)

**Technology Stack**:
- **Backend**: Python + BrainFlow + WebSocket server (e.g., `websockets` library)
- **Frontend**: JavaScript WebSocket client

**Example Backend**:
```python
import asyncio
import websockets
from signal_quality import compute_channel_quality, connect_to_ganglion

async def handle_client(websocket, path):
    board = connect_to_ganglion()
    while True:
        data = board.get_current_board_data(n_win)
        qualities = compute_channel_quality(data, fs)
        await websocket.send(json.dumps(qualities))
        await asyncio.sleep(1.0)  # 1 second updates

start_server = websockets.serve(handle_client, "localhost", 8765)
asyncio.get_event_loop().run_until_complete(start_server)
```

**Example Frontend**:
```javascript
const ws = new WebSocket('ws://localhost:8765');
ws.onmessage = (event) => {
    const qualities = JSON.parse(event.data);
    signalQualityVisualizer.update(qualities);
};
```

---

## Comparison Matrix

| Option | Backend Required | Browser Support | Complexity | Status |
|--------|-----------------|-----------------|------------|--------|
| **Web Bluetooth** | ❌ No | Chrome/Edge only | Low | ⭐ Recommended |
| **Web Serial** | ❌ No | Chrome/Edge only | Medium | ⚠️ May not work |
| **BrainFlow JS** | ❌ No | N/A | N/A | ❌ Not available |
| **Python Backend** | ✅ Yes | All browsers | Medium-High | ✅ Viable |

---

## Recommendation

### Primary Approach: Web Bluetooth API

**Rationale**:
1. Simplest architecture (no backend)
2. Direct browser connection
3. Pure JavaScript (fits our stack)
4. Real-time streaming
5. Libraries exist (even if archived)

**Action Items**:
1. Test `ganglion-ble` library with Ganglion device
2. If library has issues, consider:
   - Forking and maintaining it
   - Using `openbci-ganglion-js` as alternative
   - Contributing fixes back to community
3. Implement PSD calculation in JavaScript (port from Python)
4. Build signal quality component using Web Bluetooth

**Fallback**: If Web Bluetooth doesn't work or browser support is insufficient:
- Implement Python backend + WebSocket approach
- Use existing `signal_quality.py` code
- Stream data to frontend

---

## Implementation Considerations

### Web Bluetooth Limitations

1. **Browser Support**: Chrome/Edge only
   - **Impact**: Users on Safari/Firefox cannot use feature
   - **Mitigation**: Show message "Please use Chrome/Edge" or implement backend fallback

2. **HTTPS Requirement**: 
   - **Impact**: Must serve over HTTPS (or localhost)
   - **Mitigation**: Use HTTPS in production, localhost for development

3. **User Interaction Required**:
   - **Impact**: Cannot auto-connect, user must click button
   - **Mitigation**: Add "Connect Device" button in UI

4. **Archived Library**:
   - **Impact**: May have bugs, no updates
   - **Mitigation**: Fork library, maintain ourselves, or find active alternative

### PSD Calculation in JavaScript

Since we can't use BrainFlow in browser, we need to port PSD calculation:

**Required Libraries**:
- FFT library: `fft.js` or `dsp.js` or Web Audio API
- Signal processing: Custom Welch's method implementation

**Algorithm** (from Python):
1. Get raw EEG data (4 channels × samples)
2. Apply Hanning window
3. Calculate FFT
4. Compute PSD using Welch's method
5. Calculate band powers (1-45 Hz total, 55-65 Hz for 60Hz noise)
6. Calculate RMS and relative power
7. Classify quality

---

## Next Steps

1. ✅ **Research Complete** - Documented options
2. ⏳ **Test Web Bluetooth** - Try `ganglion-ble` with actual device
3. ⏳ **Port PSD Calculation** - Implement in JavaScript if using Web Bluetooth
4. ⏳ **Decide Architecture** - Web Bluetooth vs Backend based on testing
5. ⏳ **Get Collaborator Input** - Confirm approach and get technical details

---

## References

- [ganglion-ble GitHub](https://github.com/neurosity/ganglion-ble)
- [openbci-ganglion-js GitHub](https://github.com/openbci-archive/openbci-ganglion-js)
- [Web Bluetooth API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API)
- [Web Serial API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API)
- [BrainFlow Documentation](https://brainflow.org/)
- [OpenBCI Ganglion Getting Started](https://docs.openbci.com/GettingStarted/Boards/GanglionGS/)
