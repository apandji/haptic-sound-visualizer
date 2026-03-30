# UI Elevation Plan: From Engineer-Y to Design-Forward

This document is a **design audit** and **prioritized improvement plan** for the Haptic Sound Visualizer UI. The goal is to elevate both **visual design** and **interaction design** without breaking any existing functionality. All recommendations assume **CSS- and markup-only changes where possible**; JS changes only when adding new behavior (e.g. micro-interactions) and must preserve current behavior.

---

## 1. Current State Audit

### What Feels “Engineer-Y”

- **Typography**: Monospace stack everywhere (`SF Mono`, `Monaco`, `Roboto Mono`, `Courier New`) reads like a terminal/IDE. It’s consistent but not distinctive or warm.
- **Navigation**: Plain text links with pipe separators (`Explore | Test | Analyze`) — functional but minimal and generic.
- **Hierarchy**: Relies heavily on uppercase labels, small font sizes (10–13px), and gray (#999, #666). Section titles don’t feel like a clear “design system.”
- **Color**: Mostly neutrals (#fff, #fafafa, #e0e0e0, #333, #666, #999) with black for primary actions and red for destructive. No accent or brand color; no sense of “research / science / sound” personality.
- **Spacing and rhythm**: 4px-based scale is good, but many components feel cramped (e.g. filter panel, queue items). Little breathing room.
- **Controls**: Buttons are small, sharp (border-radius 0 or 2px), and text-heavy (lots of UPPERCASE). Dropdowns and inputs are bare-bones.
- **Feedback**: Limited use of motion. Loading is a simple spinner; success/error messages are plain. No subtle transitions on state change (e.g. phase changes in test execution).
- **Empty and placeholder states**: “Select a pattern to preview” / “Load session data to begin analysis” are plain centered text with no illustration or guidance.
- **Charts (Analyze)**: Plotly defaults; cards are white boxes with thin borders. Functional but not intentionally styled to match a cohesive look.
- **Global styles**: `css/styles.css` defines a dark theme that is **not used**; pages use light theme only. Dead code and potential confusion.

### What Already Works Well

- Clear three-page structure (Explore → Test → Analyze) and consistent layout patterns.
- Sticky filter panel and scrollable file list.
- Test execution overlay has clear phase labels and countdown.
- Session info form is logically grouped.
- Responsive considerations exist (e.g. test overlay media queries).

---

## 2. Improvement Plan by Effort

### Low effort (CSS/markup only, minimal risk)


| #                       | Area                   | Change                                                                                                                                                                                                                                                                                                                                                                                          | Why                                                  | Status   |
| ----------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------- |
| L1                      | **Typography**         | Introduce a **sans-serif for UI** (e.g. Inter, DM Sans, or system -apple-system, Segoe UI) for body, labels, buttons. Keep monospace only for **data** (file names, timestamps, IDs, code).                                                                                                                                                                                                     | Reduces “terminal” feel while keeping data readable. | **Done** |
| L2                      | **CSS variables**      | Add a single **design-tokens file** (e.g. `css/design-tokens.css`) used by all pages: colors, type scale, spacing, radii, shadows. Replace hardcoded hex/spacing in component CSS over time.                                                                                                                                                                                                    | Consistency and one place to tune the system.        | **Done** |
| *(L1+L2 done)*          | **Implemented**        | `css/design-tokens.css`: Geist Sans (UI) + Geist Mono (data), type scale 1.2 from 16px, 4px spacing scale, color/radius/shadow tokens. All pages load tokens first; body uses `var(--font-sans)`; data uses `var(--font-mono)`.                                                                                                                                                                 | **Done**                                             |          |
| *(L3+L4+L5+L6+L8 done)* | **Implemented**        | **Nav:** pill/tab active state, no pipes, more padding, `--shadow-sm` on header. **Page titles:** `--text-xl`, more padding. **Buttons/inputs:** min-height 2.25rem, `--radius-md`, `--focus-ring`. **Cards/panels:** queue, session info, analyze chart cards use `--radius-lg`, `--shadow-md`. **Sidebars:** `--shadow-sm`, token colors. **Empty states:** more padding, `--font-size-base`. | **Done**                                             |          |
| L3                      | **Navigation**         | Replace pipe separators with a subtle visual treatment: e.g. pill/tab style for active state (background or underline), more padding, optional icon or badge. Keep same links and URLs.                                                                                                                                                                                                         | Feels like an app nav instead of a text menu.        | **Done** |
| L4                      | **Page titles**        | Slightly larger, optional soft color or weight so “Preview Patterns” / “Setup Test” / “Analyze Results” feel like real headings, not labels.                                                                                                                                                                                                                                                    | Clearer hierarchy.                                   | **Done** |
| L5                      | **Buttons (primary)**  | Slightly larger tap targets (e.g. min-height 36px), subtle border-radius (4–6px) where it’s currently 0, one consistent hover/focus ring.                                                                                                                                                                                                                                                       | More approachable and accessible.                    | **Done** |
| L6                      | **Inputs and selects** | Same border-radius and focus ring as buttons; consistent padding.                                                                                                                                                                                                                                                                                                                               | Cohesive form feel.                                  | **Done** |
| L7                      | **Empty states**       | Add a short supporting line or icon (CSS background-image or inline SVG) so “Select a pattern” / “Load session data” feel intentional, not bare.                                                                                                                                                                                                                                                | Less “blank app” feeling.                            |          |
| L8                      | **Cards and panels**   | One standard **subtle shadow** (e.g. 0 1px 3px rgba(0,0,0,0.08)) and optional 6–8px radius for queue, session info, chart cards.                                                                                                                                                                                                                                                                | Depth and polish without changing layout.            | **Done** |
| L9                      | **Remove dead CSS**    | Stop linking or refactor `styles.css` so the app doesn’t depend on unused dark-theme variables.                                                                                                                                                                                                                                                                                                 | Less confusion, smaller payload.                     | **Done** |


**Functionality preserved:** No JS behavior changes; only class names and structure kept, styling updated.

---

### Mid effort (CSS + small markup/JS, some new behavior)


| #           | Area                                | Change                                                                                                                                                                                                                                                                                                                                                                   | Why                                                   | Status          |
| ----------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- | --------------- |
| M1          | **Accent color**                    | Define one accent (e.g. blue or teal) for links, active nav, optional chart highlights. Use in `:focus-visible` and key interactive elements.                                                                                                                                                                                                                            | Gives a “product” feel and improves focus visibility. | **Done**        |
| M2          | **Test execution overlay**          | Soft background gradient or color per phase (calibration / baseline / stimulation / survey), and a **short transition** (e.g. fade or slight slide) when switching phases.                                                                                                                                                                                               | Reduces abruptness; reinforces phase context.         | **Done**        |
| M3          | **Loading and status**              | Replace default spinner with a simple branded loader (same colors as design tokens). Add a **brief success state** (e.g. checkmark + fade) after session save or data load where it makes sense.                                                                                                                                                                         | Clearer feedback.                                     | **Done**        |
| *(M3 done)* | **Implemented**                     | **Loader:** `design-tokens.css` has `.loading-spinner` (accent color, token border). **Test page:** `.loading-state` uses it; trial-tags survey loading view shows spinner + text. **Session start / export / db save messages:** Token colors (`--color-success-bg/border`, `--color-error-`*), `messageSlideIn` animation, success ✓ and error ! icons via `::before`. | **Done**                                              |                 |
| M4          | **File list and queue**             | Refine hover/selected state: light accent tint or left border for selected; smooth background transition. Optional drag handle affordance (visual only if drag already works).                                                                                                                                                                                           | Clearer selection and interaction affordance.         | **Done**        |
| M5          | **Confirmation dialog**             | Softer overlay (e.g. blur or darker overlay), rounded dialog, consistent button styles with primary/secondary.                                                                                                                                                                                                                                                           | Feels part of the app, not a raw modal.               | **Done**        |
| M6          | **Analyze charts**                  | Apply a **chart theme** (Plotly layout): same font family as UI, colors from design tokens, grid lines and labels softer. Optional card header for each chart (e.g. “Band power over time”).                                                                                                                                                                             | Cohesive analyze page.                                | **Done**        |
| *(M6 done)* | **Implemented**                     | Plotly theme (Geist Sans, token colors) in config; time series/radar/box use it. Card titles per chart.                                                                                                                                                                                                                                                                  | —                                                     | **Done**        |
| M7          | **Session start / export messages** | Same success/error styling as design tokens; optional icon and animation (slide-in) for consistency with M3.                                                                                                                                                                                                                                                             | Unified feedback language.                            | **Done**        |
| M8          | **Audio progress bar (test)**       | When visible, subtle entrance animation (slide up). Optional very subtle glow or color on progress fill.                                                                                                                                                                                                                                                                 | Feels responsive and intentional.                     | **Done**        |


**Functionality preserved:** Same flows and data; only visuals and optional light JS (e.g. add/remove class for success state).

---

### High effort (larger refactors or new patterns)


| #   | Area                       | Change                                                                                                                                                         | Why                                              | Status          |
| --- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | --------------- |
| H1  | **Design system**          | Formalize components (buttons, inputs, cards, badges) in a small living doc or Storybook-style dev pages; ensure every page uses tokens and shared components. | Prevents drift and speeds future changes.        | **Not started** |
| H2  | **Responsive layout**      | Define breakpoints and behaviors for Explore/Test/Analyze (e.g. collapsible sidebars, stacked layout on small screens).                                        | Usable on tablets and smaller windows.           | **Not started** |
| H3  | **Test flow UX**           | Optional “stepper” or progress indicator for calibration → baseline → stimulation → survey; clearer “next step” and back.                                      | Reduces anxiety and improves flow comprehension. | **Not started** |
| H4  | **Onboarding / first-run** | Optional short tooltip or one-time hint for “Add patterns to queue” or “Start session” for new users.                                                          | Lowers barrier without changing core flow.       | **Not started** |
| H5  | **Accessibility pass**     | Contrast (WCAG AA), focus order, aria-labels, reduced-motion preference.                                                                                       | Inclusive and professional.                      | **Not started** |
| H6  | **Dark mode**              | Use the existing dark variables in `styles.css` (or new tokens) and toggle via class on `<html>` or `body`; ensure charts and overlays adapt.                  | Preference and comfort.                          | **Not started** |


**Functionality preserved:** All existing features and data flows remain; new patterns are additive (e.g. stepper is visual/organizational only unless you choose to add “back” behavior).

---

## 3. Safety Rules (Do Not Break Functionality)

- **Do not** remove or rename IDs/classes that JS depends on (e.g. `#filterPanel`, `#fileList`, `#queue`, `#sessionInfo`, `#testExecutionOverlay`, `#p5-container`). Prefer **adding** classes for new styling.
- **Do not** change form field names, button IDs, or data attributes used by scripts. Style only.
- **Do not** alter the order or visibility logic of overlay phases; only change visuals and transitions.
- **Do not** change API contracts, localStorage keys, or session structure.
- **Do** test after each change: Explore (filter, select, play, visualize), Test (queue, session form, start, calibration, baseline, stimulation, survey, abort, save), Analyze (load, charts, pattern selection).
- **Do** keep design tokens and new CSS in separate files or clearly commented sections so rollback is easy.

---

## 4. Suggested Implementation Order

1. **Foundation (low effort)**
  - L2 (design tokens), L1 (typography), L9 (remove dead CSS).  
  - Then L3 (nav), L5/L6 (buttons/inputs), L8 (cards).
2. **Polish (low + mid)**
  - L4, L7 (titles, empty states), M1 (accent), M2 (overlay phases), M3 (loading/success).
3. **Consistency (mid)**
  - M4 (list/queue), M5 (dialog), M6 (charts), M7/M8 (messages, progress bar).
4. **Larger bets (high)**
  - After the above, H1 (design system), then H2/H3/H4/H5/H6 as needed.

---

## 5. Quick Reference: Key Selectors to Avoid Changing

When applying styles, avoid removing or renaming these so JS keeps working:

- `#filterPanel`, `#fileList`, `#queue`, `#sessionInfo`, `#audioControlsContainer`, `#p5-container`
- `#testExecutionOverlay`, `#customConfirmOverlay`, `#customConfirmTitle`, `#customConfirmMessage`, `#customConfirmCancel`, `#customConfirmConfirm`
- `#audioProgressBar`, `#audioProgressFill`, `#audioProgressFile`, `#audioProgressTime`
- `#dataLoader`, `#patternList`, `#analyzePlaceholder`, `#analyzeContent`, `#summaryStats`, chart container IDs
- Classes: `.active`, `.hidden`, `.show`, phase classes (e.g. `.test-execution-overlay__phase--calibration`), `.file-item.active`

Use **additional** classes (e.g. `.nav-link--active` in addition to `.active`) if you want new styling without touching JS.

---

*Document version: 1.0. Last updated: 2026-03-17.*