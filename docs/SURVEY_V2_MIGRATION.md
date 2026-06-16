# Survey v2 Migration

This document describes the database migration and application changes that replaced the legacy **Direction** and **Texture** survey steps with unified **Binary actions** (Step 2 — Actions) and **Vibes** (Step 11).

Date: 2026-06-09

## Summary

| Before (v1) | After (v2) |
|-------------|------------|
| `haptic_research.db` | `haptic_research_v2.db` (active) |
| Step: Direction (`leftRight`, `upDown`, `forwardBackward`) | Binary choices under **Actions** (`binaryActions` keyed by pair id) |
| Step: Texture (`temperature`, `hardness`, `surface` facets) | **Vibes** (`vibes` keyed by pair id, e.g. `hot_cold`) |
| Tables: `trial_survey_directions`, `trial_survey_textures` | Tables: `trial_survey_binary_actions`, `trial_survey_vibes` |

All historical data was migrated. The original database was frozen as a read-only backup.

## Frozen backup

- **File:** `backups/haptic_research_frozen_2026-06-08T183753Z.db`
- **Purpose:** Point-in-time snapshot of `haptic_research.db` before v2 migration.
- **Do not modify** this file; use it only for audit or recovery reference.

## Active database

- **File:** `haptic_research_v2.db`
- **Schema:** `schema_v2.sql`
- **Application default:** `db_handler.DB_PATH` points to `haptic_research_v2.db`
- **Fresh install:** `create_database.py` creates an empty v2 database from `schema_v2.sql`

## Migration script

Run once (already executed for the current dataset):

```bash
python migrate_to_v2.py
```

The script:

1. Copies all non-survey tables verbatim (sessions, trials, brainwave readings, tags, etc.)
2. Migrates `trial_survey_directions` → `trial_survey_binary_actions` (axis → `pair_id`)
3. Migrates `trial_survey_textures` → `trial_survey_vibes` (facet → `pair_id`)
4. Verifies row counts match before completing

### Legacy → v2 mapping

**Directions → binary actions** (axis names already matched pair ids):

| Legacy axis | v2 `pair_id` |
|-------------|--------------|
| `left_right` | `left_right` |
| `up_down` | `up_down` |
| `forward_backward` | `forward_backward` |

**Textures → vibes** (facets removed; pair ids used instead):

| Legacy facet | v2 `pair_id` |
|--------------|--------------|
| `temperature` | `hot_cold` |
| `hardness` | `hard_soft` |
| `surface` | `smooth_rough` |

### Verified counts (migration run)

| Entity | v1 backup | v2 |
|--------|-----------|-----|
| Sessions | 11 | 11 |
| Trials | 33 | 33 |
| Survey responses | 31 | 31 |
| Direction / binary action rows | 50 | 50 |
| Texture / vibe rows | 86 | 86 |
| Action rows | 45 | 45 |
| Brainwave readings | 17,825 | 17,825 |

Migrated vibe data uses only `hot_cold`, `hard_soft`, and `smooth_rough` (the three pairs that had legacy responses). New sessions can use all vibe pairs defined in the taxonomy.

## Taxonomy (shared source of truth)

- **Python:** `survey_taxonomy.py`
- **Frontend:** `js/modules/surveyTaxonomy.js`

### Binary action pairs (Step 2 — Actions)

Spatial (migrated from Direction):

- `left_right`, `up_down`, `forward_backward`

Semantic (new in v2 UI):

- `stop_start`, `faster_slower`, `pull_push`, `continue_abort`, `tighten_loosen`, `relax_focus`

### Vibe pairs (Step 11 — Vibes)

Includes migrated texture data plus additional pairs for new responses:

- `hot_cold`, `hard_soft`, `smooth_rough`, `safe_danger`, `long_short`, `expected_unknown`, `rain_shine`, `bright_dark`, `recognizable_unrecognizable`, `welcoming_unwelcoming`, `open_closed`

## Survey UI changes

**Step 2 — Actions**

- Prompt: *What action does this pattern suggest you do?*
- Section 1: all binary pairs in one panel
- Section 2: predefined other actions, recent actions, optional custom text
- Binary choices and other actions are **optional** (blank allowed)

**Step 11 — Vibes**

- Prompt: *If this pattern had a vibe to it, what would it be?*
- All vibe pairs in one panel; fully optional

**API payload shape** (per trial `surveyResponse`):

```json
{
  "urgency": 0.72,
  "intensity": 0.61,
  "confidence": 0.88,
  "binaryActions": { "left_right": "Left", "relax_focus": "Focus" },
  "action": { "predefined": ["Lean"], "custom": [] },
  "emotion": { "mood": "Happy", "...": "..." },
  "vibes": { "hot_cold": "Hot", "smooth_rough": "Smooth" }
}
```

### Backward compatibility on save

`db_handler.create_trial_survey_response` still accepts legacy `direction` and `texture` keys from older clients and maps them into `binaryActions` / `vibes` before writing v2 tables.

## Analyze UI changes

- **Binary actions** heatmap replaces “Perceived direction”
- **Vibes** heatmap replaces “Texture”
- Trial list column renamed from Texture → Vibes
- Tag derivation uses `binary:*` and `vibe:*` prefixes instead of `direction:*` and `texture:*`

Updated files include:

- `js/analyze/constants.js`
- `js/modules/analysisDataProcessor.js`
- `js/components/base/subjectiveProfilePanel.js`
- `js/components/base/trialsListView.js`
- `analyze.html`

## Files added or modified

| File | Role |
|------|------|
| `migrate_to_v2.py` | One-shot v1 → v2 data migration |
| `schema_v2.sql` | v2 schema (no legacy direction/texture tables) |
| `survey_taxonomy.py` | Pair definitions + validation |
| `js/modules/surveyTaxonomy.js` | Frontend pair lists |
| `db_handler.py` | Read/write v2; legacy save compat |
| `js/components/base/trialTagsSurvey.js` | Actions + Vibes survey steps |
| `js/components/base/trialDetailView.js` | Per-trial survey drill-down (binary + vibes) |
| `create_database.py` | Creates empty v2 DB |
| `.gitignore` | Ignores live `.db` files; keeps `backups/` tracked |

Legacy `haptic_research.db` and `schema.sql` remain in the repo for reference but are no longer used by the running app.

## Re-running migration

If you need to rebuild v2 from the frozen backup:

1. Copy `backups/haptic_research_frozen_2026-06-08T183753Z.db` over `haptic_research.db` (optional; script reads source path)
2. Delete or rename `haptic_research_v2.db`
3. Run `python migrate_to_v2.py`
4. Confirm printed verification counts

## Notes for future work

- Live SQLite files (`haptic_research.db`, `haptic_research_v2.db`) are listed in `.gitignore`; frozen backups under `backups/` are tracked
- Legacy v1 tables are not recreated in v2; historical direction/texture rows live only in the frozen backup and as migrated binary/vibe rows in v2
