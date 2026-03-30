# Signal Quality Widget - Prioritized Requirements (Based on signal_quality.py)

**Date**: February 3, 2026  
**Source**: `signal_quality.py` - Python reference implementation

**Note**: The shipped app now uses RMS-only quality classification. The standalone Python script still includes extra line-noise logic, but that is intentionally not part of the app path.

---

## ✅ Already Implemented

- Basic signal quality display (RMS, Quality)
- Intercom-style floating widget
- Mock data integration
- Real-time updates (1s interval)
- Quality classification (good/ok/poor)

---

## Priority 1: Core Features from Python Script ⭐ **CRITICAL**

These features are directly from `signal_quality.py` and should be implemented first.

### 1.1 Data Validation & Error Handling ⭐⭐⭐

**Source**: `signal_quality.py` lines 138-144

**What Python Does**:
```python
data = board.get_current_board_data(n_win)
if data is None or not hasattr(data, "ndim") or data.ndim < 2 or data.shape[1] < int(0.8 * n_win):
    continue
```

**Requirement**: Validate data before processing

**Checks Needed**:
- ✅ Data is not None
- ✅ Data has correct dimensions (channels × samples)
- ✅ Data has minimum required samples (80% of window size)
- ✅ Timestamp channel has data

**Implementation**:
```javascript
validateData(data, expectedWindowSize) {
    if (!data || !data.shape || data.shape.length < 2) {
        return { valid: false, reason: 'Invalid data structure' };
    }
    if (data.shape[1] < expectedWindowSize * 0.8) {
        return { valid: false, reason: 'Insufficient samples' };
    }
    return { valid: true };
}
```

**UI**: Show "Waiting for data..." or "Insufficient data" when validation fails

---

### 1.2 Window Length Configuration ⭐⭐⭐

**Source**: `signal_quality.py` line 24 - `--window_sec` parameter (default 2.0s)

**What Python Does**:
```python
p.add_argument("--window_sec", type=float, default=2.0, help="PSD window length in seconds (default 2s).")
n_win = max(8, int(round(args.window_sec * fs)))
```

**Requirement**: Allow configuration of PSD window length

**Current**: Hardcoded to 2.0 seconds

**Implementation**:
- Add `windowLength` option to constructor (default: 2.0)
- Calculate window size: `max(8, Math.round(windowLength * samplingRate))`
- Add to settings panel (optional UI)

**Impact**: Longer window = smoother PSD but slower response

---

### 1.3 Update Interval Configuration ⭐⭐

**Source**: `signal_quality.py` line 23 - `--update_sec` parameter (default 1.0s)

**What Python Does**:
```python
p.add_argument("--update_sec", type=float, default=1.0, help="Update UI every N seconds (default 1s).")
time.sleep(args.update_sec)
```

**Requirement**: Allow configuration of update frequency

**Current**: ✅ Already implemented (default 1s)

**Enhancement**: Make it more prominent in API, add to settings

---

### 1.4 Channel Configuration ⭐⭐⭐

**Source**: `signal_quality.py` lines 26-31, 101-106, 125-126

**What Python Does**:
```python
p.add_argument("--quality_channels", type=str, default="", help="Comma-separated channel indexes...")
quality_ch = parse_quality_channels(args.quality_channels, eeg_ch)
quality_labels = [f"CH{idx + 1}" for idx in range(len(quality_ch))]
```

**Requirement**: Allow selecting which channels to monitor

**Current**: Always shows all 4 channels

**Implementation**:
- Add `qualityChannels` option: `[0, 1, 2, 3]` or `null` for all
- Filter channels before calculating quality
- Update table to show only selected channels
- Generate labels: `CH1`, `CH2`, etc. based on selected indices

**Use Case**: Researcher may want to monitor only specific channels

---

### 1.5 Sampling Rate Display ⭐⭐

**Source**: `signal_quality.py` line 121

**What Python Does**:
```python
fs = BoardShim.get_sampling_rate(board_id)
```

**Requirement**: Display device sampling rate

**Implementation**:
- Get sampling rate when device connects
- Display in connection status: "Connected (200 Hz)"
- Useful for verification and debugging

**Note**: For mock data, use default Ganglion rate (200 Hz)

---

### 1.6 PSD Calculation Details ⭐⭐⭐

**Source**: `signal_quality.py` lines 39-49

**What Python Does**:
```python
nfft = DataFilter.get_nearest_power_of_two(n_samp)
if nfft >= n_samp:
    nfft = nfft // 2
nfft = max(8, nfft)
overlap = nfft // 2
psd, freqs = DataFilter.get_psd_welch(sig, nfft, overlap, fs, WINDOW)
```

**Requirement**: Match Python's PSD calculation exactly

**Current**: Using simplified calculation from CSV data

**Implementation** (when real data available):
- Calculate FFT size: nearest power of 2, then halve if needed, minimum 8
- Use 50% overlap
- Use Welch's method with Hanning window
- Calculate band powers using trapezoidal integration

**Note**: For mock data, current approach is fine. This becomes critical when integrating real device.

---

### 1.7 Band Power Calculation ⭐⭐⭐

**Source**: `signal_quality.py` lines 51-66

**What Python Does**:
```python
def band_power(f0, f1):
    idx = np.logical_and(freqs >= f0, freqs <= f1)
    if not np.any(idx):
        return 0.0
    val = float(np.trapz(psd[idx], freqs[idx]))
    if not np.isfinite(val):
        return 0.0
    return val

total_1_45 = band_power(1.0, 45.0)
rms_uV = float(np.sqrt(total_1_45))
```

**Requirement**: Match Python's band power calculation

**Current**: Using `total_1_45_uV2` from CSV directly

**Implementation**:
- Calculate total power (1-45 Hz) using trapezoidal integration
- Handle edge cases: no data in band, non-finite values
- Calculate RMS: `sqrt(total_power)`

**Note**: Current mock implementation is acceptable, but should match this RMS calculation when real data is available.

---

### 1.8 Quality Thresholds (Exact Match) ⭐⭐⭐

**Source**: `signal_quality.py` lines 68-73

**What Python Does**:
```python
if 5.0 <= rms_uV <= 100.0:
    quality = "good"
elif 100.0 < rms_uV <= 150.0:
    quality = "ok"
else:
    quality = "poor"
```

**Requirement**: ✅ Already implemented correctly

**Verification**: Ensure thresholds match exactly:
- Good: `5.0 ≤ RMS ≤ 100.0 μV`
- OK: `100.0 < RMS ≤ 150.0 μV`
- Poor: Everything else

---

### 1.9 Connection Lifecycle Management ⭐⭐⭐

**Source**: `signal_quality.py` lines 118-119, 158-160

**What Python Does**:
```python
board.prepare_session()
board.start_stream()
# ... data collection ...
board.stop_stream()
board.release_session()
```

**Requirement**: Match Python's connection lifecycle

**Current**: Simple `start()` / `stop()` methods

**Enhancement**: Add more granular states:
- `prepare()` - Prepare session (equivalent to `prepare_session()`)
- `startStream()` - Start streaming (equivalent to `start_stream()`)
- `stopStream()` - Stop streaming (equivalent to `stop_stream()`)
- `release()` - Release session (equivalent to `release_session()`)

**States**:
- **Disconnected**: No connection
- **Preparing**: `prepare_session()` called
- **Streaming**: `start_stream()` called, receiving data
- **Stopped**: `stop_stream()` called, but session still prepared
- **Released**: `release_session()` called

---

### 1.10 Error Handling & Graceful Degradation ⭐⭐⭐

**Source**: `signal_quality.py` lines 152-161

**What Python Does**:
```python
except KeyboardInterrupt:
    print("\nStopped manually.")
except Exception:
    import traceback
    traceback.print_exc()
finally:
    if board.is_prepared():
        board.stop_stream()
        board.release_session()
        print("Board session released.")
```

**Requirement**: Handle errors gracefully

**Implementation**:
- Try-catch around data collection
- Always cleanup in `finally` block
- Show error state in UI
- Log errors to console
- Allow recovery (retry connection)

**UI States**:
- **Error**: Red status dot, error message in panel
- **Recovering**: Yellow status dot, "Reconnecting..." message

---

## Priority 2: Enhanced Features (Beyond Python Script)

These are enhancements that would improve the widget but aren't in the Python script.

### 2.1 Connection State Details ⭐⭐

**Enhancement**: More granular connection states (see 1.9)

### 2.2 Timestamp Display ⭐

**Enhancement**: Show "Last update: HH:MM:SS" to verify data is flowing

### 2.3 Quality History (Last N Readings) ⭐

**Enhancement**: Keep buffer of last N readings (e.g., last 10) for trend analysis

**Note**: Python script doesn't show history, but could be useful

---

## Priority 3: Integration Features

### 3.1 Integration with Test Flow ⭐⭐

**Requirement**: Widget should be aware of test session state

**Implementation**: Listen to `TestSession` phase changes, update context

---

## Implementation Order

### Phase 1: Core Python Features (This Week)
1. ✅ Data validation & error handling (1.1)
2. ✅ Window length configuration (1.2)
3. ✅ Channel configuration (1.4)
4. ✅ Sampling rate display (1.5)
5. ✅ Connection lifecycle management (1.9)
6. ✅ Error handling & graceful degradation (1.10)

### Phase 2: Algorithm Accuracy (When Real Data Available)
1. PSD calculation details (1.6)
2. Band power calculation (1.7)
3. Verify quality thresholds match (1.8)

### Phase 3: Enhancements
1. Quality history
2. Timestamp display
3. Integration with test flow

---

## Summary: What's Missing from Current Implementation

### Critical (Must Have)
- ❌ Data validation (check data shape, size before processing)
- ❌ Window length configuration (currently hardcoded)
- ❌ Channel configuration (currently shows all channels)
- ❌ Connection lifecycle states (currently simple start/stop)
- ❌ Error handling (try-catch, cleanup, recovery)

### Important (Should Have)
- ⚠️ Sampling rate display (show device rate)
- ⚠️ PSD calculation accuracy (when real data available)
- ⚠️ Band power calculation accuracy (when real data available)

### Nice to Have
- Quality history buffer
- Timestamp display
- Integration with test flow

---

## Next Steps

1. **Implement data validation** - Add checks before processing data
2. **Add window length config** - Make PSD window configurable
3. **Add channel selection** - Allow choosing which channels to monitor
4. **Enhance connection states** - More granular lifecycle management
5. **Improve error handling** - Try-catch, cleanup, error states

These features directly match what the Python script does and are essential for production use.
