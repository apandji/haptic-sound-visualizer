# OpenBCI Ganglion Integration: Brainstorming Document

**Project**: Haptic Sound Visualizer with EEG Data Collection  
**Date**: January 28, 2026  
**Purpose**: Brainstorming document for integrating OpenBCI Ganglion board to capture brain wave data during audio pattern testing

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Application Modes](#application-modes)
3. [Data Model & Structure](#data-model--structure)
4. [Data Security Considerations](#data-security-considerations)
5. [Technical Implementation](#technical-implementation)
6. [Data Flow](#data-flow)
7. [Storage Architecture](#storage-architecture)
8. [Analysis Mode Features](#analysis-mode-features)
9. [Connection & Hardware](#connection--hardware)
10. [Challenges & Considerations](#challenges--considerations)
11. [Implementation Phases](#implementation-phases)
12. [Open Questions](#open-questions)

---

## Architecture Overview

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Web Application                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │ Library  │  │   Test   │  │ Analysis │                 │
│  │   Mode   │→ │   Mode   │→ │   Mode   │                 │
│  └──────────┘  └──────────┘  └──────────┘                 │
└─────────────────────────────────────────────────────────────┘
         │                │                    │
         │                │                    │
         ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│              OpenBCI Ganglion Board (BLE)                   │
│        4 Channels @ ~200 Hz per channel                     │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│              Data Storage Layer                             │
│  (Local Browser Storage / Secure Server)                    │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

1. **Frontend Web Application** (Browser-based)
   - Three distinct modes: Library, Test, Analysis
   - Web Bluetooth API for Ganglion connection
   - Real-time data buffering during tests
   - Post-processing analysis tools

2. **OpenBCI Ganglion Board**
   - 4-channel EEG acquisition
   - Bluetooth Low Energy (BLE) connectivity
   - ~200 Hz sampling rate per channel
   - Requires proper electrode placement and impedance checking

3. **Data Storage System**
   - Session and test data organization
   - Secure storage for research data
   - Export capabilities for analysis tools

---

## Application Modes

### Mode 1: Library Mode (Current Functionality)

**Purpose**: Browse, filter, and preview audio patterns

**Features**:
- File browser with filtering (RMS, duration, balance, movement)
- Audio playback with visualization
- Pattern metadata display
- Multiple visualization modes (waveform, spectrum, etc.)

**No Changes Needed**: This mode remains as-is for pattern exploration

---

### Mode 2: Test Mode (Enhanced)

**Purpose**: Conduct EEG data collection sessions with audio pattern playback

**Current Flow**:
1. User selects audio pattern from Library
2. Click "MANUAL TEST" button
3. **Baselining Phase** (30 seconds): No audio, capture baseline EEG
4. **Testing Phase** (30 seconds): Audio plays, capture EEG during stimulation
5. Test completes, data saved

**Enhanced Features Needed**:

#### A. Connection Management
- **Connect Ganglion Button**: Initiate BLE connection
- **Connection Status Indicator**: 
  - Disconnected (gray)
  - Connecting (yellow)
  - Connected (green)
  - Error (red)
- **Channel Quality Indicators**: Show impedance/signal quality for each of 4 channels
- **Disconnect Button**: Safely disconnect device

#### B. Session Management
- **Start Session**: Create new session_id
- **Session Info Display**: Show current session ID, number of tests completed
- **End Session**: Close session, prepare for export

#### C. Test Execution
- **Pre-Test Validation**:
  - Ganglion must be connected
  - All channels should show acceptable signal quality
  - Audio file must be loaded
- **During Test**:
  - Record all 4 channels continuously
  - Tag samples with phase ("baseline" vs "testing")
  - Tag testing samples with audio playback time offset
  - Display real-time channel activity (optional, minimal)
- **Post-Test**:
  - Save test data with test_id
  - Show test completion confirmation
  - Option to run another test in same session

#### D. Multi-Test Sessions
- User can run multiple tests within one session
- Each test gets unique test_id
- All tests linked to same session_id
- Session persists until explicitly ended

---

### Mode 3: Analysis Mode (New)

**Purpose**: Review, analyze, and export collected EEG data

**Features**:

#### A. Session Browser
- List all sessions with metadata:
  - Session ID
  - Date/time created
  - Number of tests
  - Duration
  - Status (complete/in-progress)
- Filter/search sessions
- Select session to analyze

#### B. Test Viewer
- List all tests within selected session
- Show test metadata:
  - Test ID
  - Audio file name
  - Audio metadata (RMS, duration, etc.)
  - Baseline duration
  - Testing duration
  - Timestamp

#### C. EEG Data Visualization
- **Time Series View**:
  - Display all 4 channels as separate waveforms
  - Synchronized time axis
  - Highlight baseline vs testing phases
  - Show audio playback timeline overlay
  - Zoom/pan controls
  - Channel toggle (show/hide individual channels)

- **Spectral Analysis**:
  - Frequency spectrum for each channel
  - Spectrogram (time-frequency representation)
  - Power spectral density (PSD) plots
  - Compare baseline vs testing phases
  - Frequency band analysis (delta, theta, alpha, beta, gamma)

- **Statistical Analysis**:
  - Mean, variance, standard deviation per channel
  - Comparison metrics: baseline vs testing
  - Effect size calculations
  - Statistical significance testing (if applicable)

- **Cross-Channel Analysis**:
  - Channel correlation matrix
  - Coherence analysis between channels
  - Phase relationships

#### D. Export Capabilities
- **JSON Export**: Full structured data with metadata
- **CSV Export**: Time series data for spreadsheet analysis
- **EDF/EDF+ Export**: Standard EEG format for professional tools
- **Summary Report**: PDF with key metrics and visualizations

#### E. Comparison Tools
- Compare multiple tests side-by-side
- Compare baseline vs testing within same test
- Aggregate statistics across tests in session
- Cross-session comparisons

---

## Data Model & Structure

### Session Structure

```javascript
{
  "session_id": "uuid-v4",           // Unique session identifier
  "created_at": "ISO-8601-timestamp", // Session start time
  "ended_at": "ISO-8601-timestamp",   // Session end time (null if active)
  "user_id": "optional-user-id",      // If user authentication exists
  "device_info": {
    "device_type": "OpenBCI_Ganglion",
    "firmware_version": "string",
    "sampling_rate": 200,              // Hz per channel
    "channels": 4
  },
  "tests": [
    // Array of test objects (see below)
  ],
  "metadata": {
    "notes": "optional-session-notes",
    "environment": "lab/home/etc",
    "participant_id": "if-applicable"
  }
}
```

### Test Structure (Primary Key: test_id)

```javascript
{
  "test_id": "uuid-v4",               // PRIMARY KEY - Unique test identifier
  "session_id": "uuid-v4",            // Foreign key to session
  "test_number": 1,                   // Sequential number within session
  "created_at": "ISO-8601-timestamp", // Test start time
  
  // Audio information
  "audio_file": {
    "filename": "pattern_001.mp3",
    "path": "/audio_files/pattern_001.mp3",
    "metadata": {
      "rms_mean": 0.123,
      "duration": 5.5,
      "balance": 0.0,
      "movement": 0.45,
      // ... other audio metadata
    }
  },
  
  // Timing information
  "timing": {
    "baseline_start": "ISO-8601-timestamp",
    "baseline_end": "ISO-8601-timestamp",
    "baseline_duration_ms": 30000,
    "testing_start": "ISO-8601-timestamp",
    "testing_end": "ISO-8601-timestamp",
    "testing_duration_ms": 30000,
    "audio_start_offset_ms": 0,        // When audio actually started relative to testing_start
    "audio_end_offset_ms": 5500        // When audio ended relative to testing_start
  },
  
  // EEG Data
  "eeg_data": {
    "channels": ["CH1", "CH2", "CH3", "CH4"],
    "sampling_rate": 200,              // Hz
    "samples": [
      {
        "timestamp": "ISO-8601-timestamp",
        "relative_time_ms": 0,          // Relative to test start
        "phase": "baseline",            // or "testing"
        "audio_time_offset_ms": null,   // null during baseline, ms offset during testing
        "ch1": 1234.5,                  // Microvolts (μV)
        "ch2": 2345.6,
        "ch3": 3456.7,
        "ch4": 4567.8
      },
      // ... ~12,000 samples for 60-second test (200 Hz * 4 channels * 60s)
    ],
    "total_samples": 12000,
    "data_quality": {
      "ch1": {"impedance": "good", "noise_level": "low"},
      "ch2": {"impedance": "good", "noise_level": "low"},
      "ch3": {"impedance": "fair", "noise_level": "medium"},
      "ch4": {"impedance": "good", "noise_level": "low"}
    }
  },
  
  // Analysis results (computed post-test)
  "analysis": {
    "baseline_stats": {
      "ch1": {"mean": 0.0, "std": 12.5, "variance": 156.25},
      "ch2": {"mean": 0.0, "std": 15.2, "variance": 231.04},
      // ... for all channels
    },
    "testing_stats": {
      // Same structure as baseline_stats
    },
    "comparison": {
      // Statistical comparisons between baseline and testing
    }
  },
  
  "metadata": {
    "notes": "optional-test-notes",
    "artifacts_detected": false,
    "quality_issues": []
  }
}
```

### Data Relationships

```
Session (1) ──→ (Many) Tests
  session_id          test_id (PK)
                      session_id (FK)
```

- One session can contain multiple tests
- Each test has unique test_id (primary key)
- Each test references session_id (foreign key)
- Tests are ordered sequentially within session

---

## Data Security Considerations

### Research Data Security Requirements

For university research projects, data security is critical. Consider the following:

#### 1. Data Classification

**Sensitive Data Types**:
- **EEG Data**: Physiological data that could reveal health information
- **Session Metadata**: May include participant identifiers
- **Timestamps**: Can reveal patterns of behavior
- **Audio Patterns**: May be proprietary research materials

**Classification Level**: Likely **Confidential** or **Restricted** (university-dependent)

#### 2. Storage Security

**Option A: Local Browser Storage Only**
- **Pros**: 
  - No server infrastructure needed
  - Data never leaves user's device
  - Simple implementation
- **Cons**:
  - No centralized backup
  - Data lost if browser cleared
  - Difficult to share between researchers
  - No access controls

**Option B: Encrypted Local Storage + Optional Secure Server**
- **Pros**:
  - Data encrypted at rest locally
  - Option to sync to secure server
  - Better for multi-user research
- **Cons**:
  - More complex implementation
  - Requires encryption key management

**Option C: Secure University Server**
- **Pros**:
  - Centralized, secure storage
  - Access controls and audit logs
  - Backup and disaster recovery
  - Compliance with university IT policies
- **Cons**:
  - Requires IT department coordination
  - More complex architecture
  - May require authentication/authorization

**Recommendation**: Start with **Option B** (encrypted local + optional secure sync), plan for **Option C** if needed

#### 3. Encryption Requirements

**At Rest**:
- Encrypt all stored data (IndexedDB, localStorage, or server database)
- Use AES-256 encryption
- Store encryption keys securely (not in code)
- Consider hardware security modules (HSM) for key storage on server

**In Transit**:
- Always use HTTPS/TLS for web connections
- Use secure WebSocket (WSS) if real-time server sync needed
- Encrypt BLE communication (handled by Web Bluetooth API)

**Key Management**:
- Never hardcode encryption keys
- Use environment variables or secure key management service
- Rotate keys periodically
- Separate keys for different data types if needed

#### 4. Access Controls

**User Authentication** (if multi-user):
- University SSO integration (if available)
- Role-based access control (RBAC):
  - **Researcher**: Full access to own sessions
  - **Principal Investigator**: Access to all sessions in project
  - **Participant**: View-only access to own sessions
  - **Admin**: System administration

**Session-Level Access**:
- Each session tagged with owner/researcher
- Access control lists (ACLs) for sharing
- Audit logs for access attempts

#### 5. Data Anonymization

**For Export/Sharing**:
- Option to anonymize participant identifiers
- Remove or hash PII (personally identifiable information)
- Generate anonymized session IDs for publications
- Separate "raw" and "anonymized" export options

#### 6. Compliance Considerations

**Regulations to Consider**:
- **HIPAA** (if health-related): May apply if collecting health data
- **FERPA** (if student data): Educational records privacy
- **GDPR** (if EU participants): European data protection
- **University IRB Requirements**: Institutional Review Board protocols
- **Data Retention Policies**: How long to keep data

**IRB Considerations**:
- Data collection methods must be approved
- Participant consent forms may be required
- Data handling procedures must be documented
- May need data use agreements (DUAs)

#### 7. Audit Logging

**What to Log**:
- Session creation/deletion
- Test execution
- Data access (who, when, what)
- Export events
- Connection/disconnection events
- Authentication events

**Log Storage**:
- Immutable logs (append-only)
- Secure log storage (encrypted)
- Retention period per university policy

#### 8. Backup & Disaster Recovery

**Local Storage**:
- Encourage regular exports
- Provide easy backup functionality
- Warn users about data loss risks

**Server Storage**:
- Regular automated backups
- Off-site backup storage
- Test restore procedures
- Version control for data (if applicable)

#### 9. Data Export Security

**Export Formats**:
- Encrypted export files (password-protected ZIP)
- Signed exports (digital signatures for integrity)
- Watermarking (for tracking if data leaked)

**Export Controls**:
- Limit export frequency (prevent bulk downloads)
- Require authentication for exports
- Log all export events
- Option to redact sensitive fields

#### 10. Recommendations for Data Experts Consultation

**Questions to Discuss**:
1. What is the official data classification level?
2. What encryption standards are required?
3. Does the university have secure storage infrastructure we can use?
4. What are the IRB requirements for this study?
5. What data retention policies apply?
6. Are there specific compliance requirements (HIPAA, FERPA, GDPR)?
7. What authentication/authorization systems are available?
8. What are the backup and disaster recovery requirements?
9. What audit logging is required?
10. Who needs access to the data, and at what level?

**Key Stakeholders to Involve**:
- University IT Security Office
- Research Compliance Office
- IRB (Institutional Review Board)
- Data Privacy Officer
- Principal Investigator
- Legal/Compliance team

---

## Technical Implementation

### Connection Architecture

#### Web Bluetooth API Integration

```javascript
// Pseudo-code structure (NOT actual implementation)

class GanglionConnection {
  constructor() {
    this.device = null;
    this.server = null;
    this.service = null;
    this.characteristic = null;
    this.isConnected = false;
    this.dataBuffer = [];
  }
  
  async connect() {
    // Request BLE device
    // Connect to Ganglion service
    // Subscribe to data characteristic
    // Start data stream
  }
  
  onDataReceived(data) {
    // Parse Ganglion data packet
    // Extract 4 channel values
    // Add timestamp
    // Buffer data
  }
  
  disconnect() {
    // Unsubscribe from characteristic
    // Close connection
  }
}
```

#### OpenBCI JavaScript SDK

**Libraries to Investigate**:
- `openbci-js` (if available/updated for Ganglion)
- `openbci-ganglion` (Ganglion-specific library)
- Custom implementation using Web Bluetooth API

**Data Packet Structure** (Ganglion-specific):
- Each packet contains samples for all 4 channels
- Packet format: `[sample1_ch1, sample1_ch2, sample1_ch3, sample1_ch4, sample2_ch1, ...]`
- Timestamp added on receipt (not from device)

### Data Buffering Strategy

**During Test**:
- Buffer all incoming EEG samples in memory
- Tag each sample with:
  - Absolute timestamp
  - Relative time (ms from test start)
  - Phase ("baseline" or "testing")
  - Audio time offset (if in testing phase)

**Memory Considerations**:
- 60-second test: ~12,000 samples
- Each sample: ~100 bytes (with metadata)
- Total per test: ~1.2 MB
- 10 tests per session: ~12 MB (manageable)
- Consider streaming to IndexedDB for longer sessions

**After Test**:
- Process and structure data
- Calculate basic statistics
- Store in IndexedDB (browser) or send to server
- Clear memory buffer

### Synchronization Strategy

**Audio-EEG Synchronization**:
1. Record `audioStartTime` when audio.play() is called
2. Record `testingPhaseStartTime` when testing phase begins
3. For each EEG sample during testing:
   - Calculate `audioTimeOffset = sampleTime - audioStartTime`
   - If audio hasn't started yet: `audioTimeOffset = null`
   - If audio ended: `audioTimeOffset = null` (or negative)

**Timestamp Precision**:
- Use `performance.now()` for high-precision timestamps
- Convert to ISO-8601 for storage
- Maintain millisecond precision

---

## Data Flow

### Test Execution Flow

```
1. User selects audio pattern (Library Mode)
   ↓
2. User clicks "Connect Ganglion" (Test Mode)
   ↓
3. Browser requests BLE device via Web Bluetooth API
   ↓
4. User selects Ganglion device from system dialog
   ↓
5. Connection established, data stream starts
   ↓
6. Channel quality indicators update in real-time
   ↓
7. User clicks "MANUAL TEST"
   ↓
8. System validates: connected + good signal quality
   ↓
9. Create new test_id, start recording EEG data
   ↓
10. BASELINING PHASE (30s)
    - Record all EEG samples
    - Tag with phase="baseline"
    - Display countdown
    ↓
11. TESTING PHASE (30s)
    - Start audio playback
    - Record audio start timestamp
    - Continue recording EEG samples
    - Tag with phase="testing"
    - Tag with audio_time_offset
    - Display countdown
    ↓
12. Test completes
    - Stop audio
    - Stop recording
    - Process data (calculate stats)
    - Save to storage (IndexedDB or server)
    - Show completion message
    ↓
13. Option to run another test (same session)
    OR
    End session and move to Analysis Mode
```

### Data Storage Flow

```
During Test:
  EEG Samples → Memory Buffer → (Tagged with metadata)

After Test:
  Memory Buffer → Process & Structure → IndexedDB (local)
                                      OR
                                      → Secure Server (via API)
  
For Analysis:
  IndexedDB/Server → Load Test Data → Analysis Engine → Visualizations
```

---

## Storage Architecture

### Option 1: Browser-Only (IndexedDB)

**Technology**: IndexedDB API

**Structure**:
```
Database: "eeg_data"
  Object Store: "sessions"
    Key: session_id
    Value: Session object
  
  Object Store: "tests"
    Key: test_id (PRIMARY KEY)
    Value: Test object
    Index: session_id (for querying tests by session)
  
  Object Store: "eeg_samples"
    Key: [test_id, sample_index]
    Value: Sample object
    Index: test_id (for querying all samples for a test)
```

**Pros**:
- No server needed
- Fast local access
- Works offline
- Simple deployment

**Cons**:
- Limited storage (browser-dependent, typically 50MB-1GB)
- No centralized access
- Data lost if browser cleared
- No multi-user support

**Use Case**: Single-user research, prototype, or when server unavailable

---

### Option 2: Hybrid (IndexedDB + Secure Server)

**Technology**: IndexedDB + REST API + Secure Database

**Structure**:
- Local: IndexedDB for caching and offline capability
- Server: PostgreSQL/MySQL with encryption at rest
- Sync: Periodic or manual sync to server

**Pros**:
- Best of both worlds
- Offline capability
- Centralized backup
- Multi-user support
- Better security controls

**Cons**:
- More complex
- Requires server infrastructure
- Sync logic needed

**Use Case**: Production research system, multi-user studies

---

### Option 3: Server-Only

**Technology**: REST API + Secure Database

**Structure**:
- All data stored on secure university server
- Browser acts as client only
- Real-time or batch upload during tests

**Pros**:
- Centralized security
- Full access controls
- Audit logging
- Backup/disaster recovery
- Compliance-ready

**Cons**:
- Requires constant internet
- More complex setup
- IT department coordination needed

**Use Case**: Formal research studies, compliance-critical projects

---

### Recommended Approach: Start Hybrid, Plan for Server

**Phase 1**: IndexedDB only (MVP)
- Get system working
- Validate data collection
- Test analysis features

**Phase 2**: Add secure server sync
- Encrypted upload to university server
- Optional sync (user-initiated)
- Maintain local copy

**Phase 3**: Full server integration (if needed)
- Real-time sync
- Full access controls
- Compliance features

---

## Analysis Mode Features

### Data Loading

**Session Selection**:
- List all available sessions
- Filter by date, number of tests, status
- Search by session ID or metadata
- Load selected session

**Test Selection**:
- List all tests in session
- Show test metadata (audio file, timestamps)
- Select one or multiple tests for analysis
- Load EEG data for selected tests

### Visualization Types

#### 1. Time Series Waveform

**Display**:
- 4 separate waveform plots (one per channel)
- Or overlay all channels (with color coding)
- X-axis: Time (seconds or milliseconds)
- Y-axis: Amplitude (microvolts, μV)

**Features**:
- Zoom in/out (time axis)
- Pan left/right
- Highlight baseline vs testing phases (color coding)
- Show audio playback timeline overlay
- Vertical markers for phase transitions
- Channel toggle (show/hide individual channels)
- Cursor with value readout

**Libraries**: Chart.js, D3.js, Plotly.js, or custom Canvas/SVG

#### 2. Spectrogram

**Display**:
- Time-frequency heatmap
- X-axis: Time
- Y-axis: Frequency (Hz)
- Color: Power/amplitude

**Features**:
- Per-channel spectrograms
- Frequency range selection (e.g., 0-50 Hz, 0-100 Hz)
- Window size adjustment (FFT parameters)
- Overlay option (all channels)

**Libraries**: Custom FFT + Canvas, or specialized EEG libraries

#### 3. Power Spectral Density (PSD)

**Display**:
- Frequency domain plot
- X-axis: Frequency (Hz)
- Y-axis: Power (dB or linear)

**Features**:
- Separate plots for baseline vs testing
- Frequency band highlighting (delta, theta, alpha, beta, gamma)
- Per-channel PSD
- Comparison view (baseline vs testing overlay)
- Statistical significance indicators

#### 4. Statistical Summary

**Display**:
- Tables with key metrics
- Per-channel statistics
- Baseline vs testing comparisons

**Metrics**:
- Mean, median, mode
- Standard deviation, variance
- Min, max, range
- Skewness, kurtosis
- Effect size (Cohen's d)
- Statistical tests (t-test, etc.)

#### 5. Channel Correlation Matrix

**Display**:
- Heatmap showing correlations between channels
- Values: -1 to +1 correlation coefficient

**Features**:
- Baseline vs testing comparison
- Statistical significance

#### 6. Coherence Analysis

**Display**:
- Frequency-domain coherence between channel pairs
- Shows phase relationships

**Features**:
- Select channel pairs
- Frequency range selection

### Analysis Tools

#### Comparison Tools

**Baseline vs Testing**:
- Side-by-side waveform comparison
- Statistical difference highlighting
- Effect size visualization

**Test vs Test**:
- Compare multiple tests
- Aggregate statistics
- Trend analysis across tests

**Session Aggregation**:
- Average across all tests in session
- Variance analysis
- Outlier detection

#### Filtering & Processing

**Pre-processing Options**:
- High-pass filter (remove DC drift)
- Low-pass filter (remove high-frequency noise)
- Notch filter (remove 60 Hz line noise)
- Artifact removal (eye blinks, muscle)

**Note**: Advanced filtering may require server-side processing or WebAssembly

#### Export Options

**Formats**:
- **JSON**: Full structured data
- **CSV**: Time series (one row per sample)
- **EDF/EDF+**: Standard EEG format (requires conversion library)
- **PDF Report**: Summary with visualizations

**Content Options**:
- Raw data only
- Processed data only
- Both raw and processed
- Anonymized version
- Summary statistics only

---

## Connection & Hardware

### OpenBCI Ganglion Specifications

**Channels**: 4 channels
**Sampling Rate**: ~200 Hz per channel (configurable)
**Resolution**: 24-bit ADC
**Input Range**: ±4.5 V (with gain)
**Connection**: Bluetooth Low Energy (BLE)
**Power**: Battery-powered (rechargeable)

### Connection Requirements

**Browser Support**:
- Chrome/Edge: Full Web Bluetooth support
- Firefox: Limited/experimental support
- Safari: No Web Bluetooth support (as of 2026)
- **Recommendation**: Chrome/Edge for primary use

**System Requirements**:
- Operating system with BLE support (Windows 10+, macOS, Linux with BlueZ)
- BLE adapter (built-in or USB dongle)
- HTTPS or localhost (Web Bluetooth security requirement)

**Connection Process**:
1. User clicks "Connect Ganglion"
2. Browser shows system BLE device picker
3. User selects "Ganglion" device
4. Browser connects to device
5. Application subscribes to data characteristic
6. Data stream begins

### Signal Quality Monitoring

**Impedance Checking**:
- Ganglion can measure electrode impedance
- Display impedance values for each channel
- Color coding: Green (good), Yellow (fair), Red (poor)
- Warn user if impedance too high

**Noise Detection**:
- Monitor signal variance
- Detect excessive noise
- Alert user to potential issues
- Option to reject test if quality too poor

**Real-time Monitoring** (minimal during test):
- Simple waveform preview (optional)
- Signal quality indicators
- Connection status
- Sample rate monitoring

---

## Challenges & Considerations

### Technical Challenges

#### 1. Browser Compatibility
- **Issue**: Web Bluetooth API not universally supported
- **Mitigation**: 
  - Primary: Chrome/Edge
  - Fallback: Desktop app (Electron) if needed
  - Clear browser requirements in documentation

#### 2. BLE Connection Stability
- **Issue**: Bluetooth connections can drop
- **Mitigation**:
  - Implement reconnection logic
  - Detect disconnections quickly
  - Warn user if connection lost during test
  - Option to pause/resume test

#### 3. Data Volume
- **Issue**: Large amounts of data (12K samples per test)
- **Mitigation**:
  - Efficient data structures
  - Streaming to IndexedDB during test
  - Compression for storage/export
  - Pagination in Analysis mode

#### 4. Timestamp Precision
- **Issue**: Need accurate synchronization
- **Mitigation**:
  - Use `performance.now()` for high precision
  - Account for processing delays
  - Validate synchronization post-test

#### 5. Real-time Processing
- **Issue**: Analysis mode needs to process large datasets
- **Mitigation**:
  - Web Workers for background processing
  - Progressive loading/rendering
  - Caching of computed results
  - Consider WebAssembly for heavy computations

### Research Challenges

#### 1. Artifact Contamination
- **Issue**: Eye blinks, muscle activity, electrical noise
- **Consideration**: 
  - Document artifact detection methods
  - Provide filtering options
  - Note limitations in analysis

#### 2. Baseline Validity
- **Issue**: 30-second baseline may not be sufficient
- **Consideration**:
  - Allow configurable baseline duration
  - Provide baseline quality metrics
  - Note limitations in documentation

#### 3. Audio Timing Variability
- **Issue**: Browser audio playback timing can vary
- **Consideration**:
  - Use Web Audio API for precise timing
  - Validate audio timing post-test
  - Document timing accuracy

#### 4. Participant Variability
- **Issue**: Individual differences in EEG responses
- **Consideration**:
  - Collect demographic data (if IRB approved)
  - Allow for individual vs group analysis
  - Statistical methods account for variability

### Operational Challenges

#### 1. Electrode Setup
- **Issue**: Proper electrode placement critical
- **Mitigation**:
  - Provide setup instructions
  - Include impedance checking
  - Visual guides for placement

#### 2. Test Environment
- **Issue**: Electrical interference, movement
- **Mitigation**:
  - Document environmental requirements
  - Provide best practices guide
  - Note environmental factors in metadata

#### 3. Data Management
- **Issue**: Organizing many sessions/tests
- **Mitigation**:
  - Good UI for browsing sessions
  - Search and filter capabilities
  - Export/backup functionality
  - Clear naming conventions

---

## Implementation Phases

### Phase 1: Foundation (MVP)

**Goal**: Basic EEG data collection

**Tasks**:
1. Research OpenBCI Ganglion Web Bluetooth protocol
2. Implement basic BLE connection
3. Receive and parse data packets
4. Integrate recording into existing test flow
5. Store data in IndexedDB
6. Basic data structure (session_id, test_id)

**Deliverables**:
- Working connection to Ganglion
- Data collection during test
- Basic storage
- Simple export (JSON)

**Timeline**: 2-3 weeks

---

### Phase 2: Data Management

**Goal**: Robust data storage and organization

**Tasks**:
1. Implement session management UI
2. Multi-test session support
3. Enhanced data structure
4. IndexedDB optimization
5. Data validation and quality checks
6. Basic error handling

**Deliverables**:
- Session browser
- Test management within sessions
- Improved data model
- Data quality indicators

**Timeline**: 1-2 weeks

---

### Phase 3: Analysis Mode - Basic

**Goal**: View and export collected data

**Tasks**:
1. Create Analysis mode UI
2. Session/test browser
3. Basic time series visualization (waveform)
4. Simple statistics display
5. Export functionality (JSON, CSV)

**Deliverables**:
- Analysis mode interface
- Waveform viewer
- Basic statistics
- Export capabilities

**Timeline**: 2-3 weeks

---

### Phase 4: Analysis Mode - Advanced

**Goal**: Comprehensive analysis tools

**Tasks**:
1. Spectrogram visualization
2. Power spectral density plots
3. Statistical comparisons (baseline vs testing)
4. Channel correlation analysis
5. Filtering options
6. Comparison tools (test vs test)

**Deliverables**:
- Advanced visualizations
- Statistical analysis tools
- Comparison features

**Timeline**: 3-4 weeks

---

### Phase 5: Security & Compliance

**Goal**: Secure data handling

**Tasks**:
1. Implement encryption (at rest)
2. Secure server integration (if needed)
3. Access controls (if multi-user)
4. Audit logging
5. Data anonymization tools
6. Compliance documentation

**Deliverables**:
- Encrypted storage
- Secure sync (if applicable)
- Compliance features
- Documentation

**Timeline**: 2-3 weeks (parallel with other phases)

---

### Phase 6: Polish & Optimization

**Goal**: Production-ready system

**Tasks**:
1. Performance optimization
2. UI/UX improvements
3. Error handling refinement
4. Documentation
5. User guides
6. Testing

**Deliverables**:
- Polished interface
- Complete documentation
- Tested system

**Timeline**: 2 weeks

---

## Open Questions

### Technical Questions

1. **OpenBCI SDK**: Is there an updated JavaScript SDK for Ganglion, or do we need to implement Web Bluetooth directly?

2. **Data Format**: What is the exact packet format from Ganglion? Need to verify parsing logic.

3. **Sampling Rate**: Is 200 Hz fixed, or configurable? What are the trade-offs?

4. **Storage Limits**: What are realistic storage limits for IndexedDB? How many tests can we store locally?

5. **Performance**: Can browser handle real-time FFT for spectrograms, or do we need WebAssembly?

### Research Questions

6. **Baseline Duration**: Is 30 seconds sufficient, or should it be configurable/longer?

7. **Audio Timing**: How critical is millisecond-precision synchronization? What's acceptable variance?

8. **Channel Selection**: Are all 4 channels always used, or should users be able to disable channels?

9. **Artifact Handling**: What level of artifact detection/removal is needed? Manual or automatic?

10. **Analysis Depth**: What statistical analyses are required? Basic descriptive stats, or advanced (t-tests, ANOVA, etc.)?

### Security Questions

11. **Data Classification**: What is the official classification level? (To be determined with data experts)

12. **Storage Location**: Local only, or university server required? (To be determined with IT/security)

13. **Encryption**: What encryption standards are required? (To be determined with security team)

14. **Access Control**: Single-user or multi-user? What authentication needed? (To be determined with PI)

15. **IRB Requirements**: What specific IRB requirements apply? (To be determined with IRB)

### Operational Questions

16. **User Training**: What training materials needed for electrode setup, test execution?

17. **Troubleshooting**: What common issues should we anticipate? How to handle them?

18. **Data Backup**: How often should users backup? Automated or manual?

19. **Export Frequency**: Any limits on export frequency? Bulk export allowed?

20. **Support**: Who provides technical support? What's the escalation path?

---

## Next Steps

### Immediate Actions

1. **Consult with Data Experts**:
   - Schedule meeting with IT Security
   - Discuss with Research Compliance
   - Review IRB requirements
   - Determine data classification

2. **Technical Research**:
   - Investigate OpenBCI Ganglion Web Bluetooth protocol
   - Test Web Bluetooth API compatibility
   - Research JavaScript EEG libraries
   - Prototype basic connection

3. **Requirements Refinement**:
   - Finalize data model based on research needs
   - Determine analysis requirements
   - Define success criteria
   - Prioritize features

4. **Architecture Decision**:
   - Choose storage approach (local/server/hybrid)
   - Determine security requirements
   - Plan implementation phases
   - Allocate resources

### Documentation to Create

1. **Technical Specification**: Detailed implementation plan
2. **Data Model Specification**: Complete schema documentation
3. **Security Plan**: Based on expert consultation
4. **User Guide**: For researchers using the system
5. **Setup Guide**: For electrode placement and connection
6. **Troubleshooting Guide**: Common issues and solutions

---

## Appendix

### Useful Resources

**OpenBCI Documentation**:
- OpenBCI Ganglion User Guide
- OpenBCI Forum/Community
- GitHub repositories

**Web Bluetooth API**:
- MDN Web Docs
- Chrome Web Bluetooth Samples
- Web Bluetooth Specification

**EEG Analysis**:
- EEG analysis libraries (JavaScript)
- Signal processing resources
- Research papers on EEG analysis methods

**Data Security**:
- University IT Security policies
- Research data management guidelines
- IRB protocols and requirements

---

**Document Status**: Draft for Review  
**Last Updated**: January 28, 2026  
**Next Review**: After consultation with data experts and technical research
