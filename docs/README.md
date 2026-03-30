# Documentation

Minimal set of docs for day-to-day work. Everything else lives in **[archive/](archive/)** (old plans, research, signal-quality specs, OpenBCI integration notes, legacy MySQL schema sketch).

| Document | Purpose |
|----------|---------|
| [CONTRIBUTING.md](CONTRIBUTING.md) | Branches, PRs, review |
| [COMPONENT_ARCHITECTURE.md](COMPONENT_ARCHITECTURE.md) | Frontend architecture |
| [COMPONENT_ORGANIZATION.md](COMPONENT_ORGANIZATION.md) | Where files live |
| [TESTING_PROTOCOL.md](TESTING_PROTOCOL.md) | Research / trial protocol |
| [METADATA_GENERATION.md](METADATA_GENERATION.md) | `generate_metadata.py` / `pattern_metadata.json` |
| [SURVEY_UI_REDESIGN_BACKLOG.md](SURVEY_UI_REDESIGN_BACKLOG.md) | Survey UI — backlog only |

**Database:** [`../schema.sql`](../schema.sql) (SQLite). **EEG / signal quality:** `eeg_server.py`, `signal_quality.py`, and `js/` (no separate living spec).
