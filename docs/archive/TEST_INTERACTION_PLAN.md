# Test Setup & Test Flow: Interaction Design Plan

This document is an **interaction design audit** and **prioritized improvement plan** for the **Test** page: **Setup** (before session start) and **Test flow** (calibration → baseline → stimulation → survey → complete). The goal is to improve clarity, feedback, and flow for the experimenter (tester) without breaking functionality. It complements the visual/system work in `UI_ELEVATION_PLAN.md`.

---

## 1. Current State Audit

### Test Setup (Before “Start Session”)

**Layout and structure**
- Three columns: **Pattern Explorer** (filters + file list) | **Queue** | **Session Info** (participant, location, equipment, experimenter, notes, Start Session).
- Clear separation of “what to play” (queue) vs “who / where” (session form). Session ID is auto-generated and shown.

**What feels unclear or brittle**
- **Discoverability of “add to queue”**: New users may not see that selecting files and an explicit “add” action (or similar) fills the queue. The queue can start empty with only an empty-state message; the link from “add patterns” to the file list is implicit (selection + add behavior).
- **Start Session gating**: Button is disabled until (1) participant selected, (2) location selected, (3) queue has at least one item. The **reason** is only in `title` tooltip (“Add at least one pattern to the queue”, “Please fill in all required fields”, “Session already started”). No inline validation message until after a failed submit in some flows.
- **Validation feedback**: Invalid required fields get a class (e.g. `session-info__input--invalid`) and a single validation message area; timing and prominence vary. No persistent “you need X before Start” summary.
- **Time estimate**: Session duration estimate exists (from session time estimator) but placement and visibility may not make the “how long this will take” obvious before starting.
- **Queue reorder / remove**: Drag-and-drop and remove work but affordances (drag handle, remove control) could be clearer. “Newly added” highlight helps; no undo for remove.
- **Empty queue**: Empty state text and hint exist; no strong call-to-action (e.g. “Select patterns from the list and add to queue” with visual tie to the file list).
- **Abandoning the page**: No prompt when navigating away or closing if the queue has items or form is filled (optional; can be deferred).

**What already works**
- Required fields (participant, location) and queue-not-empty are enforced before start.
- Session ID is visible and stable for the run.
- Queue shows order and supports reorder; play/preview from queue is available.

---

### Test Setup layout: does it make sense?

**Current layout:** Three fixed columns (≈300px | 380px | 400px): **Library** (filters + file list) | **Queue** | **Session Info** (form + Start Session).

**Pros**
- All information is visible at once; no paging.
- Clear conceptual split: “what to run” (left + center) vs “who / where / go” (right).
- Power users can scan and edit queue and form in parallel.

**Cons**
- **No obvious sequence.** The real flow is “build queue → fill session → start,” but the UI doesn’t lead the eye in that order; everything has equal visual weight.
- **Narrow columns.** On smaller viewports the three columns compete; queue and session can feel cramped.
- **“Add to queue” is understated.** The primary action (getting patterns into the queue) lives in list selection, which isn’t as visible as a big “Add selected” or “Session” area.
- **Start Session is one of many elements** in the right column; it doesn’t read as the single “you’re done with setup” action.

**Verdict:** The layout is **logical** (library → queue → session) but **not optimized for a clear “do this, then this, then start” story**. It works best for people who already know the flow.

---

### Simpler alternatives (from a UI/UX standpoint)

**Option A: Two-step flow (wizard-like)**  
1. **Step 1 – “What to run”:** One main area: file list (with filters) and queue in a single view (e.g. list left, queue right, or list above queue). One clear CTA: “Add to queue” or “Select patterns” so the relationship is obvious. Optional “Continue” when queue has ≥1 item.  
2. **Step 2 – “Session details & start”:** Participant, location, optional fields, time estimate, and a single prominent **Start Session** button. No library/queue here; “Back” to change the queue if needed.

- **Pros:** Clear sequence, less cognitive load, Start Session is the obvious end of setup.  
- **Cons:** One extra click to “continue”; power users can’t see queue and form at the same time unless you add a summary in step 2.

**Option B: Two columns, queue + session together**  
- **Left:** Library (filters + file list), same as now.  
- **Right:** Single column with **Queue** on top and **Session Info** below (or in a tab “Queue” | “Session”). Start Session at the bottom of the right column.

- **Pros:** Fewer columns; “everything you need to start” lives on the right. Natural reading order: build queue, then fill form, then start.  
- **Cons:** Right column can get long; may need collapse/scroll or tabs for session form.

**Option C: Keep three columns, strengthen hierarchy**  
- Keep the current layout but make the **sequence** and **primary action** obvious: e.g. numbered steps (“1. Add patterns” / “2. Session details”) or a compact progress strip above the layout. Make Start Session a fixed or sticky primary button so it’s always visible and reads as “done with setup.”

- **Pros:** No structural change; improves clarity with minimal refactor.  
- **Cons:** Still three columns on small screens; doesn’t fix “everything equal” on its own.

**Recommendation:**  
- For **simplest mental model** and best first-time UX: **Option A** (two-step flow).  
- For **smallest change** with better clarity: **Option C** (keep layout, add sequence + prominent Start).  
- **Option B** is a good middle ground if you’re willing to reflow to two columns and possibly group Queue + Session in one panel.

**Status:** **Option A (two-step flow) implemented.** Step 1 = “1. What to run” (library + queue + “Continue to session details”); Step 2 = “2. Session details & start” (session form + Start Session + “Back to queue”). Continue is disabled until the queue has at least one pattern.

---

### Test Flow (Calibration → Baseline → Stimulation → Survey → Complete)

**Phases and transitions**
- **Calibration**: Pre-flight checklist (numbered list), ganglion widget and channel gate in left panel; large circular “Start Test” and “Exit” on the right. Test sound button plays ~2s sample. Gate text (“2/4 good…”, “Ready: 3/4…”) below widget. Manual start always allowed.
- **Baseline**: Full-screen phase with countdown, pattern X of Y, pattern name. Tester bar (top-left) shows step, “Next: Stimulation”, and short instruction. ABORT in top bar.
- **Stimulation**: Same structure, green tint, “STIMULATION” label. Tester bar updates. Audio plays automatically.
- **Survey**: Trial tags survey in overlay; NEXT/FINISH button in top bar. Tester bar shows “Trial X of Y · Survey” and “Select tags… then Next or Finish.”
- **Complete / Aborted**: Centered message and “Return to Setup” (reload).

**What feels unclear or brittle**
- **Flow overview**: No single “you are here” stepper (e.g. Calibration → Trial 1 → Trial 2 → … → Complete). Tester bar gives current step and “next” but not the full path. After calibration, the bar is the main orientation; baseline/stimulation/survey are full-screen and can feel samey.
- **Phase transitions**: Phases change with fade/short transition; no explicit “Phase complete” or “Next: Baseline” handoff moment. Countdown ends and the next phase appears.
- **Abort vs Exit**: **Exit** (calibration) returns to setup without starting. **ABORT** (baseline/stimulation/survey) ends the session with confirmation. Naming is consistent (Exit = leave setup, Abort = end run) but confirmation copy could reinforce “partial data may be saved”.
- **Survey submission**: NEXT/FINISH is in the top bar; survey content is centered. Users must select at least one tag (and intensity where required); button disables with tooltip. No explicit “you can’t proceed without tags” in the survey body.
- **Baseline / stimulation**: Tester has nothing to do except wait; that’s correct but the screen could make “no action needed” even clearer (tester bar already says it). Countdown is the only changing element.
- **Error and recovery**: If overlay script or session init fails, user sees a validation-style message and Start resets; no retry or “what to check” guidance. EEG/audio failures are not yet surfaced with clear recovery steps in the UI.
- **Session complete**: Single “Return to Setup” and reload. No summary (e.g. “3 trials completed”) or “Save / export” reminder on the same screen.

**What already works**
- Calibration pre-flight list and Test sound sample set clear expectations.
- Channel gate and ganglion widget in one panel; gate below widget.
- Tester bar gives step, next action, and short instruction in baseline/stimulation/survey.
- ABORT is always available during run; confirmation before abort.
- Survey enforces tags and intensity; NEXT/FINISH is obvious.

---

## 2. Improvement Plan by Effort

### Low effort (copy, small layout, CSS)

| #  | Area | Change | Why |
|----|------|--------|-----|
| T1 | **Start Session disabled state** | When disabled, show a short inline hint under the button (e.g. “Add at least one pattern and choose participant & location”) in addition to `title`. | Clearer than tooltip-only; always visible. |
| T2 | **Queue empty state** | Add one line: “Select patterns from the list on the left and add them to the queue.” (or match your add interaction). | Directs new users to the correct action. |
| T3 | **Abort confirmation** | Ensure confirmation dialog copy says e.g. “Partial data may be saved. Return to setup?” (or current equivalent). | Sets expectation and reduces anxiety. |
| T4 | **Tester bar type size** | Use at least `--text-sm` for step and “Next”; avoid very small type for instruction line. | Readable at a glance (aligns with UI_ELEVATION_PLAN). |
| T5 | **Session complete screen** | Add one line: “You can export or save session data from Analyze.” (if true) or “Return to Setup to run another session.” | Clear next step. |

**Functionality preserved:** No change to validation logic, phase order, or data flow.

---

### Mid effort (markup + light JS, some new behavior)

| #  | Area | Change | Why |
|----|------|--------|-----|
| T6 | **Setup validation summary** | When Start is disabled, show a small checklist or summary (e.g. “✓ Location • ✗ Participant • ✗ Queue (add 1+)”) above or near the button. | Single place to see what’s missing. |
| T7 | **Queue “how to add”** | In empty state or header, add a short hint or icon that ties “add” to the file list (e.g. “Click + on a pattern in the list to add it here”). | Reduces confusion for first-time users. |
| T8 | **Flow stepper (light)** | In baseline/stimulation/survey, show a compact stepper (e.g. “Calibration ✓ · Trial 2 · Baseline”) in the tester bar or top of overlay. | Orientation without big UX change. |
| T9 | **Survey “must tag”** | In the survey body, add a line: “Select at least one tag (and intensity for action tags) to continue.” Near the NEXT/FINISH button or at top. | Reinforces why the button is disabled. |
| T10 | **Phase handoff** | Optional short “Phase complete” or “Next: Baseline” screen (1–2s) between phases, or a subtle transition label. | Clearer sense of progression. |
| T11 | **Session complete summary** | On “Session Complete”, show e.g. “X trials completed” and optionally “Session ID: …” before “Return to Setup”. | Confirms outcome and supports logging. |

**Functionality preserved:** Same validation rules, same phase order and data; only added feedback and copy.

---

### High effort (larger refactors or new patterns)

| #  | Area | Change | Why |
|----|------|--------|-----|
| T12 | **Full flow stepper** | Persistent stepper (e.g. horizontal or compact list) for Calibration → Trial 1 (Baseline → Stimulation → Survey) → Trial 2 → … → Complete, with current step highlighted. | Maximum orientation; may require layout/state refactor. |
| T13 | **Setup onboarding** | First-time or “queue empty” tooltip / one-time hint: “Add patterns from the list, then fill session info and click Start Session.” | Lowers barrier; needs “dismiss and don’t show again” or similar. |
| T14 | **Leave / close guard** | On Test page, prompt when user navigates away or closes tab if queue has items or session form is filled (optional). | Prevents accidental loss of setup. |
| T15 | **Error recovery** | If session start fails (e.g. overlay load error), show a short “What to try” (e.g. refresh, check console) and a Retry button. | Better than a single message and disabled Start. |
| T16 | **Accessibility (test flow)** | Focus order, aria-labels, and live regions for phase changes and countdown so screen-reader users can follow the flow. | Inclusive and professional. |

**Functionality preserved:** All existing features and data flows remain; new patterns are additive.

---

## 3. Safety Rules (Do Not Break Functionality)

- **Do not** remove or rename IDs/classes that JS depends on (e.g. `#sessionInfo`, `#queue`, `#filterPanel`, `#fileList`, `#testExecutionOverlay`, `#calibrationGateStatus`, `#calibrationWidgetContainer`, `#surveyContainer`, `#customConfirmOverlay` and its buttons). Prefer **adding** classes or ARIA for new UI.
- **Do not** change form field names, button IDs, or data attributes used by scripts (e.g. participant/location selects, session ID display, overlay phase classes).
- **Do not** alter phase order (calibration → baseline → stimulation → survey) or the conditions under which phases advance; only add feedback, copy, or visual steppers.
- **Do not** change API contracts, session/trial data structure, or localStorage keys.
- **Do** test after each change: Setup (validation, queue add/remove/reorder, Start Session), then full run (calibration, Test sound, Start Test, Exit, then full run with baseline → stimulation → survey, NEXT/FINISH, Abort, Session complete).
- **Do** keep new copy and interaction logic easy to locate (e.g. in sessionInfo, patternQueue, testExecutionOverlay, trialTagsSurvey) so rollback is straightforward.

---

## 4. Quick Reference: Key Selectors to Avoid Changing

When adding or changing interaction and copy, avoid removing or renaming these so JS keeps working:

**Setup**
- `#sessionInfo`, `#queue`, `#filterPanel`, `#fileList`
- Session form: participant select, location select, equipment, experimenter, notes, session ID display, Start button (e.g. `sessionInfo_start` or equivalent)
- Queue: `.queue__list`, `.queue__empty`, queue item structure and data attributes used for drag/drop and remove

**Test flow**
- `#testExecutionOverlay`, `#calibrationGateStatus`, `#calibrationWidgetContainer`, `#calibrationManualStartBtn`, `#calibrationAbortBtn`, `#calibrationTestSoundBtn`
- `#surveyContainer`, `.test-execution-overlay__next-btn`, overlay ABORT button
- Phase classes: `.test-execution-overlay__phase--calibration`, `--baseline`, `--stimulation`, `--survey`, `--complete`, `--aborted`
- Confirmation: `#customConfirmOverlay`, `#customConfirmTitle`, `#customConfirmMessage`, `#customConfirmCancel`, `#customConfirmConfirm`

Use **additional** classes or ARIA when you need new styling or semantics without touching existing selectors.

---

## 5. Suggested Implementation Order

1. **Quick wins (low)**  
   T1 (Start disabled hint), T2 (queue empty copy), T3 (abort confirmation copy), T4 (tester bar type), T5 (session complete line).

2. **Clarity (mid)**  
   T6 (validation summary), T9 (survey “must tag” copy), T11 (session complete summary). Then T7 (queue “how to add”), T8 (light stepper), T10 (phase handoff) if desired.

3. **Larger bets (high)**  
   T12 (full stepper), T13 (onboarding), T14 (leave guard), T15 (error recovery), T16 (accessibility) as needed.

---

*Document version: 1.0. Last updated: 2026-03-17. Scope: Test Setup and Test flow interaction design only.*
