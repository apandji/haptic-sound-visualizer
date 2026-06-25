-- Exploratory queries for 7643ha (haptics visualizer export).
-- CSV outputs: run `./run-queries.sh` from this directory.

-- Q1: Self-report scales by haptic pattern
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

-- Q2: Mood counts by pattern
SELECT p.name AS pattern_name,
       r.mood,
       COUNT(*) AS n
FROM trial_survey_responses r
JOIN trials t ON t.trial_id = r.trial_id
JOIN patterns p ON p.pattern_id = t.pattern_id
GROUP BY p.pattern_id, p.name, r.mood
ORDER BY p.name, n DESC;

-- Q3: Mean absolute band power by phase
SELECT phase,
       COUNT(*) AS n_rows,
       ROUND(AVG(delta_abs), 4) AS avg_delta_abs,
       ROUND(AVG(theta_abs), 4) AS avg_theta_abs,
       ROUND(AVG(alpha_abs), 4) AS avg_alpha_abs,
       ROUND(AVG(beta_abs), 4) AS avg_beta_abs,
       ROUND(AVG(gamma_abs), 4) AS avg_gamma_abs
FROM brainwave_readings
GROUP BY phase;

-- Q4: EEG row coverage per trial and phase
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

-- Q5: Sessions by location
SELECT l.location_id,
       l.name AS location_name,
       COUNT(s.session_id) AS n_sessions
FROM locations l
LEFT JOIN sessions s ON s.location_id = l.location_id
GROUP BY l.location_id, l.name
ORDER BY n_sessions DESC;
