# Critical Questions for Implementation

**Status:** Must Answer Before MVP Implementation  
**Last Updated:** January 28, 2026

---

## 🔴 CRITICAL - Blocks Core Functionality

### 1. Survey Options Definition
**Why Critical:** Cannot implement survey UI without knowing what A, B, C, D represent

**Question:** What are the actual 4 options for "What does this pattern feel like?"

**Options:**
- [ ] Need research team input
- [ ] Placeholder options for now (can update later)
- [ ] Define based on research goals

**Impact:** Blocks survey implementation entirely

---

### 2. Survey Completion Detection
**Why Critical:** Researcher needs to know when to proceed; affects workflow

**Question:** How does researcher know when participant is done with survey?

**Options:**
- [ ] Participant clicks "Done" or "Submit" button
- [ ] Researcher sees selections and clicks "Continue" when ready
- [ ] Automatic after participant selects (with delay?)
- [ ] Other: _______________

**Impact:** Affects survey UI design and workflow flow

---

### 3. Survey Validation & UI
**Why Critical:** Need to know how to enforce "required" survey

**Questions:**
- **Multi-select UI:** Checkboxes? Radio buttons? Buttons?
- **Validation:** Ensure at least one option selected before proceeding?
- **Overlay design:** Full-screen overlay? Partial overlay? How to ensure participant can interact?

**Impact:** Affects survey UI implementation

---

### 4. Skip Test Handling
**Why Critical:** Affects data structure and session metadata

**Question:** If audio fails and test is skipped:
- Is a test record created with `status: "skipped"`?
- Or is it not recorded at all?
- Should skipped tests be counted in `session_metadata.tests_skipped`?

**Impact:** Affects data structure and session tracking

---

### 5. Queue Modification Mid-Session
**Why Critical:** Affects data integrity and workflow

**Question:** Can researcher modify queue (add/remove patterns) mid-session?

**If YES:**
- When can they modify? (Only at checkpoints? Anytime?)
- What if current test is running? (Block until test completes?)
- How does this affect `session_metadata.total_tests`?

**If NO:**
- What if researcher realizes wrong pattern was queued?
- Can they skip to next pattern?

**Impact:** Affects queue management and session data structure

---

## 🟡 HIGH PRIORITY - Affects User Experience

### 6. Audio Retry Details
**Why Important:** Need specific retry logic for error handling

**Questions:**
- How many retry attempts? (e.g., 3 attempts?)
- Timeout duration between retries? (e.g., 2 seconds?)
- After final failure, how long before showing skip option?

**Impact:** Error handling implementation

---

### 7. Skip Test UI
**Why Important:** Need to know how researcher triggers skip

**Question:** How should skip option be presented?

**Options:**
- [ ] Button in error dialog
- [ ] Keyboard shortcut (e.g., 'S' key)
- [ ] Menu option
- [ ] Other: _______________

**Impact:** UI design for error handling

---

### 8. Checkpoint Information Display
**Why Important:** Researcher needs clear information at checkpoints

**Question:** What specific information should be displayed at checkpoint?

**Suggested:**
- Current test number (e.g., "Test 3 of 8")
- Next pattern name
- Session progress (visual indicator?)
- Time elapsed / estimated remaining?
- EEG connection status?
- Other: _______________

**Impact:** Checkpoint UI design

---

### 9. Survey Failure Handling
**Why Important:** Need to handle edge case

**Question:** What if survey can't be submitted or participant doesn't complete?

**Options:**
- [ ] Test saved without survey response (marked as incomplete?)
- [ ] Test not saved (requires survey to complete)
- [ ] Researcher can manually add survey response later
- [ ] Other: _______________

**Impact:** Data integrity and error recovery

---

## 🟢 MEDIUM PRIORITY - Can Have Defaults

### 10. Computer List Storage
**Why Medium:** Can default to localStorage, refine later

**Question:** Where should computer list be stored?

**Options:**
- [ ] localStorage (default for MVP)
- [ ] Config file (JSON)
- [ ] Hardcoded in code
- [ ] Other: _______________

**Impact:** Can use localStorage as default, change later

---

### 11. Progress Display
**Why Medium:** Can use simple counter, enhance later

**Question:** What progress info should be displayed?

**Options:**
- [ ] Simple counter ("Test 3 of 8")
- [ ] Progress bar
- [ ] Estimated time remaining
- [ ] Combination: _______________

**Impact:** Can start with simple counter, enhance later

---

### 12. Break Duration
**Why Medium:** Can default to no minimum, add later

**Question:** Should there be a minimum break time between tests?

**Options:**
- [ ] No minimum (researcher controls)
- [ ] Minimum 30 seconds
- [ ] Minimum 1 minute
- [ ] Other: _______________

**Impact:** Can default to no minimum for MVP

---

## Summary: What's Needed for MVP

### Must Answer Before Coding:
1. ✅ Survey options (A, B, C, D definitions) - **BLOCKS SURVEY**
2. ✅ Survey completion detection - **BLOCKS WORKFLOW**
3. ✅ Survey UI design (checkboxes, validation) - **BLOCKS SURVEY**
4. ✅ Skip test handling (create record or not) - **AFFECTS DATA STRUCTURE**
5. ✅ Queue modification mid-session - **AFFECTS WORKFLOW**

### Can Default/Defer:
- Audio retry details (can use defaults: 3 attempts, 2s timeout)
- Skip test UI (can use button in dialog)
- Computer list storage (can use localStorage)
- Progress display (can use simple counter)
- Break duration (can default to no minimum)

---

**Recommendation:** Focus on answering the 5 critical questions first, then proceed with MVP implementation using defaults for the rest.
