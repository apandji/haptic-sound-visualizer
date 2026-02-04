# Checkpoint System Review

## Current Implementation

### Flow
1. **Pattern completes** (baseline + stimulation phases done)
2. **Survey appears** (participant selects tags)
3. **Checkpoint appears** (researcher-controlled pause)
4. **Researcher clicks "Continue"** → Next pattern starts
5. **OR Researcher clicks "Abort"** → Session ends

### Current Checkpoint Display
- **Title**: "Pattern X Complete"
- **Pattern Name**: Shows completed pattern name
- **Next Pattern**: Shows next pattern name (or "This is the final pattern")
- **Progress**: "X of Y patterns completed"
- **Actions**: 
  - "Continue to Next Pattern" (or "Complete Session" if last)
  - "Abort Session"

---

## Questions & Considerations

### 1. **Purpose & Timing**
**Current**: Checkpoint appears after survey completion

**Questions:**
- What is the primary purpose of the checkpoint?
  - [ ] Give participant a break?
  - [ ] Allow researcher to verify equipment/EEG?
  - [ ] Review data before proceeding?
  - [ ] All of the above?
- Should there be a minimum break duration enforced?
- Can the researcher skip the checkpoint (auto-continue)?

### 2. **Information Display**
**Current**: Shows completed pattern, next pattern, progress

**Questions:**
- What information does the researcher need at this point?
- Should we show:
  - [ ] Time elapsed in session?
  - [ ] Estimated time remaining?
  - [ ] EEG connection status?
  - [ ] Data collection status (readings collected)?
  - [ ] Pattern metadata (duration, RMS, etc.)?
- Is the current information sufficient or too much?

### 3. **Actions Available**
**Current**: Continue or Abort

**Questions:**
- Should there be additional actions?
  - [ ] "Skip Next Pattern" (mark as skipped, continue to pattern after)?
  - [ ] "Retry Current Pattern" (re-run the pattern)?
  - [ ] "Pause Session" (pause indefinitely, resume later)?
  - [ ] "Review Data" (view collected readings so far)?
- Should "Abort" require confirmation?
- Should there be a way to go back to a previous pattern?

### 4. **Visual Design**
**Current**: White card with border, centered content, buttons below

**Questions:**
- Should the checkpoint be:
  - [ ] Full-screen overlay (current)?
  - [ ] Modal/dialog box?
  - [ ] Bottom panel/bar?
  - [ ] Side panel?
- Should it be more prominent or more subtle?
- Should there be visual indicators (e.g., progress bar, timeline)?

### 5. **User Experience**
**Current**: Researcher must click button to continue

**Questions:**
- Should Enter key continue (currently works)?
- Should there be keyboard shortcuts for other actions?
- Should there be a countdown timer (auto-continue after X seconds)?
- Should there be visual/audio feedback when checkpoint appears?

### 6. **Edge Cases**
**Questions:**
- What if researcher realizes wrong pattern was queued?
  - [ ] Skip it?
  - [ ] Replace it?
  - [ ] Continue anyway and note in data?
- What if EEG disconnects during checkpoint?
  - [ ] Show warning?
  - [ ] Block continue until reconnected?
  - [ ] Allow continue with warning?
- What if participant needs a longer break?
  - [ ] Pause indefinitely?
  - [ ] Set a timer?

---

## Proposed Improvements (For Discussion)

### Option A: Minimal Checkpoint
- Simple "Pattern X Complete" message
- Just "Continue" and "Abort" buttons
- Minimal information display
- **Pros**: Fast, doesn't interrupt flow
- **Cons**: Less control, less information

### Option B: Enhanced Checkpoint
- More information (time, progress, EEG status)
- Additional actions (skip, retry)
- Visual progress indicator
- **Pros**: More control, better visibility
- **Cons**: More complex, potentially slower

### Option C: Configurable Checkpoint
- Researcher can configure what appears
- Can enable/disable auto-continue
- Can customize information shown
- **Pros**: Flexible, adaptable
- **Cons**: More complex to implement

---

## Your Thoughts?

Please share:
1. What's the primary purpose of the checkpoint for your use case?
2. What information do you need to see?
3. What actions do you need?
4. How should it look/feel?
5. Any specific pain points with the current implementation?
