# Signal Quality Widget - Additional Requirements

**Date**: February 3, 2026  
**Based on**: `signal_quality.py` and `docs/archive/database_schema.txt` (legacy; prefer `schema.sql`)

---

## Current Implementation Status

✅ **Implemented**:
- Basic signal quality display (RMS, 60Hz, Quality)
- Intercom-style floating widget
- Mock data integration
- Real-time updates (1s interval)
- Quality classification (good/ok/poor)

---

## Additional Requirements Identified

### 1. Frequency Band Visualization ⭐ **HIGH PRIORITY**

**Source**: `database_schema.txt` - `brainwave_readings` table stores frequency bands

**Requirement**: Display frequency band power breakdown per channel

**Data Available**:
- `delta_abs`, `theta_abs`, `alpha_abs`, `beta_abs`, `gamma_abs` (absolute power)
- `delta_rel`, `theta_rel`, `alpha_rel`, `beta_rel`, `gamma_rel` (relative power)

**Implementation**:
- Add expandable section in panel showing band powers
- Display as bars or table
- Show both absolute (μV²) and relative (%) values
- Color-code bands (delta=blue, theta=green, alpha=orange, beta=red, gamma=purple)

**UI Options**:
- **Option A**: Expandable "Frequency Bands" section below main table
- **Option B**: Click channel row to show band breakdown
- **Option C**: Separate tab/view for detailed band analysis

**Recommendation**: **Option A** - Expandable section, keeps main view clean

---

### 2. Channel Configuration ⭐ **MEDIUM PRIORITY**

**Source**: `signal_quality.py` line 26-31 - `--quality_channels` parameter

**Requirement**: Allow configuration of which channels to monitor

**Current**: Always shows all 4 channels (CH1-CH4)

**Implementation**:
- Add settings/configuration panel
- Allow enabling/disabling specific channels
- Store configuration in component state
- Update table to show only enabled channels

**Use Case**: Researcher may want to focus on specific channels or disable noisy channels

---

### 3. Trial/Phase Context Display ⭐ **HIGH PRIORITY**

**Source**: `database_schema.txt` - `brainwave_readings.trial_id` links to trials

**Requirement**: Show current trial/phase context in widget

**Data Available**:
- Current trial ID
- Current phase (calibration, baseline, stimulation)
- Pattern name being tested

**Implementation**:
- Add context bar in expanded panel header
- Display: "Trial 1 of 5 - Baseline Phase" or "Calibration"
- Show pattern name during stimulation
- Update automatically as test progresses

**UI**:
```
┌─────────────────────────────────────┐
│ Signal Quality          [×]         │
│ Trial 1 of 5 - Baseline Phase       │
├─────────────────────────────────────┤
│ Channel | RMS_μV | 60Hz_rel | Quality│
│ ...
```

---

### 4. Data Validation & Error Handling ⭐ **HIGH PRIORITY**

**Source**: `signal_quality.py` line 138-144 - Data validation checks

**Requirement**: Handle invalid/missing data gracefully

**Checks Needed**:
- Data shape validation (channels × samples)
- Minimum data size check (80% of window size)
- Timestamp validation
- NaN/Infinity checks
- Missing channel data

**Implementation**:
- Show "No data" or "Insufficient data" message
- Display last known good reading timestamp
- Show error indicator in status dot
- Log validation errors to console

**UI States**:
- **Valid Data**: Normal display
- **Insufficient Data**: Show warning, keep last values
- **No Data**: Show "Waiting for data..." message
- **Error**: Show error message, red status dot

---

### 5. Sampling Rate Display ⭐ **MEDIUM PRIORITY**

**Source**: `signal_quality.py` line 121 - `BoardShim.get_sampling_rate()`

**Requirement**: Display device sampling rate

**Implementation**:
- Show in connection status area
- Format: "Connected (200 Hz)" or "Connected (Sampling: 200 Hz)"
- Update when device connects
- Useful for debugging and verification

---

### 6. Window Length Configuration ⭐ **LOW PRIORITY**

**Source**: `signal_quality.py` line 24 - `--window_sec` parameter (default 2.0s)

**Requirement**: Allow configuration of PSD window length

**Current**: Hardcoded to 2.0 seconds

**Implementation**:
- Add to settings panel
- Range: 1.0 - 5.0 seconds (typical values)
- Default: 2.0 seconds
- Tooltip explaining impact (longer = smoother but slower response)

**Note**: This affects PSD calculation accuracy vs. responsiveness trade-off

---

### 7. Quality History/Trends ⭐ **MEDIUM PRIORITY**

**Source**: `signal_quality.py` line 25 - `--max_rows` parameter (shows recent rows)

**Requirement**: Display quality history over time

**Implementation Options**:
- **Option A**: Simple list of last N readings (e.g., last 10)
- **Option B**: Mini graph showing quality trend (good/ok/poor over time)
- **Option C**: Full history panel with scrollable list

**Recommendation**: **Option B** - Mini trend graph, visual and compact

**Data to Track**:
- Timestamp of each reading
- Quality state per channel
- RMS values over time
- 60Hz relative power over time

**Storage**: Keep in-memory buffer (last 60 seconds = 60 readings at 1s interval)

---

### 8. Timestamp Display ⭐ **LOW PRIORITY**

**Source**: `signal_quality.py` line 142 - Timestamp channel

**Requirement**: Show when last reading was received

**Implementation**:
- Add "Last update: HH:MM:SS" in status area
- Update on each quality update
- Show time since last update if stale (> 2 seconds)

**Use Case**: Helps identify if data stream has stopped

---

### 9. Phase-Aware Quality Tracking ⭐ **HIGH PRIORITY**

**Source**: `docs/archive/TEST_EXECUTION_FLOW_DESIGN.md` - Phases: calibration, baseline, stimulation

**Requirement**: Track quality separately per phase

**Implementation**:
- Store quality metrics per phase
- Show phase-specific quality summary
- Display: "Calibration: Good | Baseline: OK | Stimulation: Good"
- Help identify if quality degrades during specific phases

**Data Structure**:
```javascript
{
    calibration: { avgQuality: 'good', channels: [...] },
    baseline: { avgQuality: 'ok', channels: [...] },
    stimulation: { avgQuality: 'good', channels: [...] }
}
```

---

### 10. Connection State Details ⭐ **MEDIUM PRIORITY**

**Source**: `signal_quality.py` line 118-119, 158-160 - Connection lifecycle

**Requirement**: More granular connection states

**Current**: Simple connected/disconnected

**States Needed**:
- **Disconnected**: No device detected
- **Connecting**: Attempting to connect
- **Connected**: Device connected, not streaming yet
- **Streaming**: Receiving data
- **Error**: Connection failed or device error
- **Reconnecting**: Attempting to reconnect after error

**Implementation**:
- Update status text and color
- Show appropriate icon/indicator
- Handle state transitions smoothly

---

### 11. Data Persistence ⭐ **LOW PRIORITY**

**Source**: `database_schema.txt` - No `signal_quality` table exists

**Requirement**: Decide if quality metrics should be stored

**Options**:
- **Option A**: Don't store (only display real-time)
- **Option B**: Store in `brainwave_readings` table (add quality columns)
- **Option C**: New `signal_quality_readings` table

**Recommendation**: **Option A** for now, can add storage later if needed

**If storing**:
- Store quality metrics with each reading
- Link to `trial_id`
- Enable quality analysis post-session

---

### 12. Band Power Integration ⭐ **HIGH PRIORITY**

**Source**: `data/ganglion_sample_data.csv` - Contains band power data

**Requirement**: Use actual band power data from readings

**Current**: Only uses `total_1_45_uV2` for RMS calculation

**Enhancement**:
- When real data is available, use actual band powers
- Calculate RMS from sum of band powers: `sqrt(delta + theta + alpha + beta + gamma)`
- Display individual band contributions
- Show relative power distribution

**Data Flow**:
```
EEG Data → Band Powers (delta, theta, alpha, beta, gamma)
         → Calculate RMS from bands
         → Calculate 60Hz (if available)
         → Display in widget
```

---

### 13. Quality Threshold Configuration ⭐ **LOW PRIORITY**

**Source**: `signal_quality.py` line 68-73 - Hardcoded thresholds

**Requirement**: Allow customization of quality thresholds

**Current Thresholds** (hardcoded):
- Good: `3.0 ≤ RMS ≤ 100.0 μV` AND `60Hz_rel < 0.3`
- OK: `0.5 ≤ RMS ≤ 300.0 μV` AND `60Hz_rel < 0.6`
- Poor: Everything else

**Implementation**:
- Add settings panel
- Allow researcher to adjust thresholds
- Save to localStorage or config file
- Tooltip explaining each threshold

**Use Case**: Different research protocols may need different thresholds

---

### 14. Integration with Test Flow ⭐ **HIGH PRIORITY**

**Source**: `test.html` - Test execution flow

**Requirement**: Widget should be aware of test session state

**Integration Points**:
- **Test Setup Page**: Show widget when device connects
- **Calibration Phase**: Monitor quality during calibration
- **Baseline Phase**: Show quality during baseline
- **Stimulation Phase**: Show quality during stimulation
- **Between Trials**: Continue monitoring

**Implementation**:
- Listen to `TestSession` phase changes
- Update context display automatically
- Optionally pause/resume based on phase
- Show phase-specific quality requirements

**API Integration**:
```javascript
signalQuality.setTrialContext({
    trialId: 1,
    trialNumber: 1,
    totalTrials: 5,
    phase: 'baseline',
    patternName: 'A_80_5.mp3'
});
```

---

### 15. Alert/Warning System ⭐ **MEDIUM PRIORITY**

**Requirement**: Alert researcher when quality drops

**Triggers**:
- Quality changes from "good" to "ok" or "poor"
- Quality drops below threshold during critical phase
- Connection lost during trial
- All channels show "poor" quality

**Implementation**:
- Visual alert (badge, animation)
- Optional sound alert (configurable)
- Notification in expanded panel
- Log to console

**UI**:
- Red pulsing indicator on minimized button
- Warning banner in expanded panel
- "Quality Alert" notification

---

### 16. Data Export ⭐ **LOW PRIORITY**

**Requirement**: Export quality metrics for analysis

**Implementation**:
- "Export" button in expanded panel
- Export as CSV or JSON
- Include: timestamps, channel qualities, band powers, phase context
- Useful for post-session analysis

---

## Priority Summary

### High Priority (Implement Soon)
1. ✅ Frequency Band Visualization
2. ✅ Trial/Phase Context Display
3. ✅ Data Validation & Error Handling
4. ✅ Phase-Aware Quality Tracking
5. ✅ Band Power Integration
6. ✅ Integration with Test Flow

### Medium Priority (Implement Next)
1. Channel Configuration
2. Sampling Rate Display
3. Quality History/Trends
4. Connection State Details
5. Alert/Warning System

### Low Priority (Nice to Have)
1. Window Length Configuration
2. Timestamp Display
3. Data Persistence
4. Quality Threshold Configuration
5. Data Export

---

## Implementation Plan

### Phase 1: Core Enhancements (Week 1)
- Frequency band visualization
- Trial/phase context display
- Data validation & error handling
- Integration with test flow

### Phase 2: Advanced Features (Week 2)
- Quality history/trends
- Connection state details
- Alert/warning system
- Channel configuration

### Phase 3: Polish (Week 3)
- Quality threshold configuration
- Data export
- Window length configuration
- Data persistence (if needed)

---

## Questions for User

1. **Frequency Bands**: Should we show all 5 bands (delta, theta, alpha, beta, gamma) or just key ones?
2. **Quality History**: How long should we keep history? (Last 60 seconds? Full session?)
3. **Alerts**: Should alerts be visual only, or also audio?
4. **Data Storage**: Do we need to store quality metrics in database, or is real-time display sufficient?
5. **Phase Integration**: Should widget automatically update based on test phase, or manual control?

---

## Notes

- All requirements are based on analysis of `signal_quality.py` and `database_schema.txt`
- Some features may require backend support (e.g., data persistence)
- Mock data implementation should be enhanced to include band powers
- Real device integration will unlock additional features (actual band powers, impedance, etc.)
