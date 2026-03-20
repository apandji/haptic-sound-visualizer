# Survey UI Redesign Backlog

## Status
- Backlog only. Do not implement in this sprint.

## Context
- Survey stage currently remains functional but is a placeholder design.
- Audio now continues into Survey by design for this protocol.

## Constraints
- Keep the existing selected-tags and intensity payload contract compatible with current session persistence and analysis views.
- Preserve the current "Next/Finish" completion mechanics unless intentionally redesigned.
- Ensure compatibility with ongoing playback state during Survey.

## Non-Goals
- No schema changes for survey tags in this backlog item.
- No rewrite of trial progression logic.
- No interruption of current data collection and export flows.

## Future Redesign Targets
- Faster tag entry with lower cognitive load.
- Clearer hierarchy for primary and secondary tags.
- Better ergonomics for operator-assisted testing sessions.
- Responsive layout behavior for smaller screens.

## Dependencies
- Audio lifecycle behavior in `testExecution` must remain stable through Survey.
- Tester panel information architecture should be finalized so Survey can align with it.
