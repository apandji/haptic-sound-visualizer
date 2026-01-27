# Product Requirements Document: Haptic Sound Pattern Visualizer

## 1. Project Overview

### 1.1 Purpose
Create an interactive web-based dashboard to upload, analyze, and visualize sound files that drive haptic vibrations on a Woojer vest. The visualizer will enable users to explore haptic patterns through multiple visualization modes, helping to understand and present haptic experiences at conferences and demonstrations.

### 1.2 Background
- **Hardware**: Woojer vest translates audio signals into haptic vibrations
- **Input**: Sound files (audio formats: WAV, MP3, etc.) that drive haptic patterns
- **Current State**: Collection of sound files without visual representation
- **Goal**: Create a Replit-style dashboard with multiple visualization modes using p5.js to represent haptic patterns visually
- **Use Case**: Conference presentation and demonstration of haptic experiences

### 1.3 Key Value Proposition
- Visualize haptic patterns that are otherwise invisible
- Multiple visualization modes for different perspectives
- Interactive exploration of sound/haptic data
- Professional presentation tool for conferences

---

## 2. Data Structure

### 2.1 Input File Format
- **Supported Formats**: WAV, MP3, OGG, M4A (common audio formats)
- **File Characteristics**: 
  - Variable duration (seconds to minutes)
  - Mono or stereo audio
  - Various sample rates (44.1kHz, 48kHz, etc.)
- **File Naming**: May include pattern identifiers or descriptive names

### 2.2 Audio Data Processing
- **Audio Analysis**: Extract audio features for visualization:
  - **Waveform**: Raw amplitude over time
  - **Frequency Spectrum**: FFT analysis for frequency content
  - **Amplitude Envelope**: Overall volume/intensity over time
  - **Frequency Bands**: Low, mid, high frequency components (relevant for haptics)
  - **Peak Detection**: Identify significant haptic events/transients

### 2.3 Haptic-Relevant Features
- **Low Frequency Emphasis**: Woojer vest primarily responds to low frequencies
- **Bass Content**: Sub-bass and bass frequencies (20-250 Hz) drive haptic response
- **Transient Detection**: Sudden amplitude changes create distinct haptic sensations
- **Rhythm Patterns**: Beat detection for rhythmic haptic patterns

---

## 3. Functional Requirements

### 3.1 File Upload & Management
- **FR-1.1**: Provide drag-and-drop file upload interface
- **FR-1.2**: Support multiple file uploads in a single session
- **FR-1.3**: Display list of uploaded files with metadata:
  - Filename
  - Duration
  - File size
  - Sample rate
- **FR-1.4**: Allow selection of active file for visualization
- **FR-1.5**: Support file deletion/removal from session
- **FR-1.6**: Auto-play audio when file is selected (optional toggle)

### 3.2 Audio Playback Controls
- **FR-2.1**: Play/Pause button
- **FR-2.2**: Stop button (reset to beginning)
- **FR-2.3**: Seek/scrub bar with time display
- **FR-2.4**: Volume control slider
- **FR-2.5**: Playback speed control (0.5x, 1x, 1.5x, 2x)
- **FR-2.6**: Loop toggle (repeat playback)
- **FR-2.7**: Current time / Total duration display

### 3.3 Visualization Modes

#### 3.3.1 Waveform Visualization
- **FR-3.1**: Display traditional waveform (amplitude over time)
- **FR-3.2**: Show stereo channels separately (if stereo file)
- **FR-3.3**: Zoom controls for detailed view
- **FR-3.4**: Playhead indicator synchronized with playback
- **FR-3.5**: Color-coded amplitude levels

#### 3.3.2 Frequency Spectrum Visualization
- **FR-3.6**: Real-time FFT frequency spectrum display
- **FR-3.7**: Logarithmic frequency scale (more relevant for audio)
- **FR-3.8**: Highlight low-frequency range (20-250 Hz) where haptics are strongest
- **FR-3.9**: Color gradient indicating frequency intensity
- **FR-3.10**: Waterfall/spectrogram view option (frequency over time)

#### 3.3.3 Haptic Intensity Visualization
- **FR-3.11**: Visualize haptic intensity over time (low-frequency emphasis)
- **FR-3.12**: Band-pass filter visualization showing bass content (20-250 Hz)
- **FR-3.13**: Intensity heatmap or gradient visualization
- **FR-3.14**: Peak markers for strong haptic events

#### 3.3.4 3D/Abstract Visualization
- **FR-3.15**: Creative p5.js visualization responding to audio
- **FR-3.16**: Particle systems driven by frequency/amplitude
- **FR-3.17**: Geometric shapes that react to haptic patterns
- **FR-3.18**: Abstract art representation of haptic experience

#### 3.3.5 Multi-View Dashboard
- **FR-3.19**: Display multiple visualization modes simultaneously
- **FR-3.20**: Grid layout with resizable panels
- **FR-3.21**: Toggle individual visualizations on/off
- **FR-3.22**: Synchronized playback across all views

### 3.4 Visualization Controls
- **FR-4.1**: Mode selector (dropdown or tabs) to switch visualization types
- **FR-4.2**: Visualization-specific settings:
  - Color scheme selector
  - Sensitivity/gain controls
  - Smoothing factor
  - Update rate (FPS)
- **FR-4.3**: Fullscreen mode for presentations
- **FR-4.4**: Export visualization as image (PNG) or video (MP4)
- **FR-4.5**: Reset zoom/pan controls

### 3.5 Analysis Tools
- **FR-5.1**: Display audio statistics:
  - Peak amplitude
  - RMS (Root Mean Square) level
  - Dynamic range
  - Frequency distribution summary
- **FR-5.2**: Haptic pattern analysis:
  - Number of significant haptic events
  - Average haptic intensity
  - Haptic pattern rhythm/tempo
- **FR-5.3**: Time markers/annotations for key moments
- **FR-5.4**: Comparison mode (side-by-side visualization of multiple files)

---

## 4. User Interface Requirements

### 4.1 Layout (Replit-Style Dashboard)
- **UI-1.1**: Clean, modern interface with sidebar navigation
- **UI-1.2**: Main content area with visualization canvas
- **UI-1.3**: Control panel with playback and visualization settings
- **UI-1.4**: File browser/manager panel
- **UI-1.5**: Responsive layout (works on desktop, tablet, large displays)
- **UI-1.6**: Collapsible panels for flexible workspace

### 4.2 Visual Design
- **UI-2.1**: Dark theme option (better for presentations)
- **UI-2.2**: High contrast visualizations for visibility
- **UI-2.3**: Smooth animations and transitions
- **UI-2.4**: Professional appearance suitable for conference demos
- **UI-2.5**: Customizable color schemes

### 4.3 User Experience
- **UI-3.1**: Fast file loading and processing
- **UI-3.2**: Real-time visualization updates during playback
- **UI-3.3**: Smooth playback without lag
- **UI-3.4**: Intuitive controls requiring minimal learning curve
- **UI-3.5**: Keyboard shortcuts for common actions (spacebar = play/pause)

---

## 5. Technical Requirements

### 5.1 Technology Stack
- **Frontend Framework**: 
  - **Option A**: Pure HTML/CSS/JavaScript with p5.js (lightweight, simple)
  - **Option B**: React/Vue with p5.js integration (more scalable)
  - **Option C**: Streamlit with p5.js embedded (consistent with brainwave dashboard)
- **Visualization Library**: **p5.js** (primary requirement)
- **Audio Processing**: 
  - Web Audio API (native browser API)
  - p5.sound library (p5.js audio extension)
- **File Handling**: 
  - FileReader API for local file uploads
  - Optional: Web Audio API for audio decoding
- **UI Framework**: 
  - Tailwind CSS or similar (for modern styling)
  - Or Streamlit components (if using Streamlit)

### 5.2 Audio Processing
- **TR-1.1**: Decode audio files in browser (no server required for MVP)
- **TR-1.2**: Real-time audio analysis during playback
- **TR-1.3**: FFT analysis for frequency spectrum
- **TR-1.4**: Buffer audio data for smooth playback
- **TR-1.5**: Handle various audio formats and sample rates
- **TR-1.6**: Low-latency processing for real-time visualization

### 5.3 Performance
- **TR-2.1**: Smooth 60 FPS visualization updates
- **TR-2.2**: Handle audio files up to 10 minutes without performance degradation
- **TR-2.3**: Efficient memory management for large files
- **TR-2.4**: Responsive UI even during intensive visualization rendering

### 5.4 Browser Compatibility
- **TR-3.1**: Support modern browsers (Chrome, Firefox, Safari, Edge)
- **TR-3.2**: Graceful degradation for older browsers
- **TR-3.3**: Mobile browser support (optional, desktop primary)

### 5.5 Deployment
- **TR-4.1**: Static hosting (GitHub Pages, Netlify, Vercel)
- **TR-4.2**: No backend required for MVP (client-side processing)
- **TR-4.3**: Easy sharing via URL
- **TR-4.4**: Offline capability (Progressive Web App optional)

---

## 6. Non-Functional Requirements

### 6.1 Usability
- **NFR-1.1**: Intuitive interface for non-technical users
- **NFR-1.2**: Clear visual feedback for all interactions
- **NFR-1.3**: Accessible controls and visualizations
- **NFR-1.4**: Helpful tooltips and labels

### 6.2 Performance
- **NFR-2.1**: Fast initial load time (< 3 seconds)
- **NFR-2.2**: Smooth playback without stuttering
- **NFR-2.3**: Responsive controls (no lag)

### 6.3 Presentation Quality
- **NFR-3.1**: High-quality visualizations suitable for projection
- **NFR-3.2**: Professional appearance for conference demos
- **NFR-3.3**: Fullscreen mode for presentations
- **NFR-3.4**: Export capabilities for documentation

### 6.4 Maintainability
- **NFR-4.1**: Clean, well-documented code
- **NFR-4.2**: Modular design for easy feature additions
- **NFR-4.3**: Extensible visualization system

---

## 7. Out of Scope (MVP)

The following features are **explicitly excluded** from the initial version:

- Audio editing capabilities (trim, fade, etc.)
- Advanced audio effects processing
- Cloud storage integration
- User accounts/authentication
- Collaborative features
- Mobile app version
- Real-time haptic device integration (Woojer API)
- Advanced statistical analysis
- Batch processing of multiple files
- Audio format conversion

---

## 8. Success Criteria

### 8.1 MVP Success Metrics
- ✅ Upload and load audio files successfully
- ✅ Play audio with synchronized visualization
- ✅ Display at least 3 different visualization modes:
  - Waveform
  - Frequency spectrum
  - Haptic-focused visualization
- ✅ Smooth, real-time visualization updates
- ✅ Professional appearance suitable for conference demo
- ✅ Intuitive controls requiring minimal explanation

### 8.2 User Acceptance
- Users can upload files without assistance
- Visualizations clearly represent haptic patterns
- Interface is intuitive for conference demonstrations
- Performance is smooth for typical audio file sizes
- Visualizations are visually appealing and engaging

---

## 9. Design Decisions (To Be Resolved)

### 9.1 Technology Stack
- **Decision Needed**: Pure JavaScript/p5.js vs. React/Vue vs. Streamlit
- **Considerations**: 
  - Pure JS: Simplest, fastest to implement, best p5.js integration
  - React/Vue: More scalable, better component structure
  - Streamlit: Consistent with existing dashboard, but p5.js integration may be complex

### 9.2 Visualization Modes Priority
- **Decision Needed**: Which visualizations to implement first
- **Recommendation**: Start with waveform, frequency spectrum, and haptic intensity

### 9.3 File Storage
- **Decision Needed**: Client-side only vs. optional server storage
- **Recommendation**: Client-side only for MVP (simpler, no backend)

### 9.4 Presentation Mode
- **Decision Needed**: Separate presentation mode vs. fullscreen toggle
- **Recommendation**: Fullscreen toggle with simplified controls

---

## 10. Implementation Phases

### Phase 1: Core Functionality (MVP)
1. File upload interface (drag-and-drop)
2. Audio file loading and decoding
3. Basic audio playback controls
4. Waveform visualization (p5.js)
5. Frequency spectrum visualization (p5.js)
6. Simple UI layout

### Phase 2: Advanced Visualizations
1. Haptic intensity visualization (low-frequency emphasis)
2. Spectrogram/waterfall view
3. Creative/abstract p5.js visualization
4. Multi-view dashboard layout

### Phase 3: Polish & Presentation Features
1. Fullscreen mode
2. Export capabilities (image/video)
3. Visualization settings/controls
4. UI/UX improvements
5. Performance optimization

### Phase 4: Enhanced Features (Post-MVP)
1. Comparison mode (multiple files)
2. Time markers/annotations
3. Advanced analysis tools
4. Custom visualization modes

---

## 11. Appendix

### 11.1 Woojer Vest Specifications
- **Frequency Response**: Primarily responds to low frequencies (20-250 Hz)
- **Haptic Translation**: Audio amplitude → vibration intensity
- **Channels**: Multiple haptic zones on the vest

### 11.2 Audio Visualization Best Practices
- **Low Frequency Emphasis**: Highlight bass frequencies for haptic relevance
- **Real-time Updates**: Visualizations should update smoothly during playback
- **Color Coding**: Use intuitive color schemes (e.g., blue for low, red for high)
- **Synchronization**: All visualizations must sync with playback position

### 11.3 p5.js Capabilities
- **Graphics**: 2D and 3D rendering
- **Audio**: p5.sound library for audio analysis
- **FFT**: Built-in FFT analysis for frequency spectrum
- **Performance**: Efficient for real-time visualizations

### 11.4 Conference Use Case
- **Scenario**: Live demonstration of haptic patterns
- **Requirements**: 
  - Large, visible visualizations
  - Smooth playback
  - Professional appearance
  - Easy file switching
  - Fullscreen capability

### 11.5 Sample File Structure
```
haptic-visualizer/
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── main.js
│   ├── audioProcessor.js
│   ├── visualizations/
│   │   ├── waveform.js
│   │   ├── spectrum.js
│   │   └── haptic.js
│   └── ui/
│       ├── controls.js
│       └── fileManager.js
├── lib/
│   └── p5.min.js
├── README.md
└── PRD_HAPTIC_VISUALIZER.md
```

---

## Document Version
- **Version**: 1.0
- **Date**: 2025-01-27
- **Status**: Draft - Ready for Review
- **Last Updated**: Initial draft based on requirements

---

## Notes
- This PRD is a living document and should be updated as requirements evolve
- Focus on conference presentation use case for MVP
- p5.js is a core requirement for creative visualizations
- Consider Replit-style dashboard layout for familiarity
- Future enhancements can include real-time Woojer integration
