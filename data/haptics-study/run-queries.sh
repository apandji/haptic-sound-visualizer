#!/usr/bin/env bash
# Runs the exploratory analysis queries and writes CSVs under results/.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
DB="${ROOT}/7643ha.db"
OUT="${ROOT}/results"
mkdir -p "${OUT}"

run_csv () {
  local name="$1"
  shift
  sqlite3 "${DB}" -header -csv "$@" > "${OUT}/${name}.csv"
  echo "Wrote ${OUT}/${name}.csv"
}

run_csv "01_survey_aggregate_by_pattern" <<'SQL'
SELECT p.pattern_id,
       p.name AS pattern_name,
       COUNT(r.response_id) AS n_trials,
       ROUND(AVG(r.urgency), 3) AS avg_urgency,
       ROUND(AVG(r.intensity), 3) AS avg_intensity,
       ROUND(AVG(r.confidence), 3) AS avg_confidence
FROM patterns p
JOIN trials t ON t.pattern_id = p.pattern_id
JOIN trial_survey_responses r ON r.trial_id = t.trial_id
GROUP BY p.pattern_id, p.name
ORDER BY n_trials DESC;
SQL

run_csv "02_mood_counts_by_pattern" <<'SQL'
SELECT p.name AS pattern_name,
       r.mood,
       COUNT(*) AS n
FROM trial_survey_responses r
JOIN trials t ON t.trial_id = r.trial_id
JOIN patterns p ON p.pattern_id = t.pattern_id
GROUP BY p.pattern_id, p.name, r.mood
ORDER BY p.name, n DESC;
SQL

run_csv "03_brainwave_bands_by_phase" <<'SQL'
SELECT phase,
       COUNT(*) AS n_rows,
       ROUND(AVG(delta_abs), 4) AS avg_delta_abs,
       ROUND(AVG(theta_abs), 4) AS avg_theta_abs,
       ROUND(AVG(alpha_abs), 4) AS avg_alpha_abs,
       ROUND(AVG(beta_abs), 4) AS avg_beta_abs,
       ROUND(AVG(gamma_abs), 4) AS avg_gamma_abs
FROM brainwave_readings
GROUP BY phase;
SQL

run_csv "04_reading_coverage_per_trial_phase" <<'SQL'
SELECT t.trial_id,
       p.name AS pattern_name,
       br.phase,
       COUNT(*) AS reading_rows,
       MIN(br.timestamp_ms) AS t_min_ms,
       MAX(br.timestamp_ms) AS t_max_ms
FROM brainwave_readings br
JOIN trials t ON t.trial_id = br.trial_id
JOIN patterns p ON p.pattern_id = t.pattern_id
GROUP BY t.trial_id, p.name, br.phase
ORDER BY t.trial_id, br.phase;
SQL

run_csv "05_sessions_by_location" <<'SQL'
SELECT l.location_id,
       l.name AS location_name,
       COUNT(s.session_id) AS n_sessions
FROM locations l
LEFT JOIN sessions s ON s.location_id = l.location_id
GROUP BY l.location_id, l.name
ORDER BY n_sessions DESC;
SQL

echo "Done. Open CSVs in Cursor or @-mention them for LLM interpretation."
