# Documentation

Minimal set of docs for day-to-day work. Everything else lives in **[archive/](archive/)** (old plans, research, signal-quality specs, OpenBCI integration notes, legacy MySQL schema sketch).

| Document | Purpose |
|----------|---------|
| [CONTRIBUTING.md](CONTRIBUTING.md) | Branches, PRs, review |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Pages, services, frontend layout, data flow |
| [TESTING_PROTOCOL.md](TESTING_PROTOCOL.md) | Research / trial protocol |
| [METADATA_GENERATION.md](METADATA_GENERATION.md) | `generate_metadata.py` / `pattern_metadata.json` |
| [SURVEY_V2_MIGRATION.md](SURVEY_V2_MIGRATION.md) | Survey v2 schema, migration, and API shape |
| [AUDIT_2026-06-11.md](AUDIT_2026-06-11.md) | Code/UX/security audit (pre-IRB, pre-scale) |
| [DATA_STORAGE_PLAN.md](DATA_STORAGE_PLAN.md) | WashU Box backup architecture + IRB open questions |
| [CYBERSEC_RESPONSE.md](CYBERSEC_RESPONSE.md) | Cybersec follow-up: FileVault, Entra SSO/RBAC, pseudonyms, subject access |

**Database:** [`../schema_v2.sql`](../schema_v2.sql) (SQLite, active). Legacy v1: [`../schema.sql`](../schema.sql). **EEG / signal quality:** `eeg_server.py`, `signal_quality.py`, and `js/` (no separate living spec).
