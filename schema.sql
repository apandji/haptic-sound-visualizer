-- Haptic Sound Visualizer Research Database Schema (SQLite)

CREATE TABLE participants (
    participant_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    participant_code  TEXT UNIQUE NOT NULL,
    age               INTEGER,
    gender            TEXT,
    handedness        TEXT,
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes             TEXT
);

CREATE TABLE locations (
    location_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT NOT NULL,
    description    TEXT,
    address        TEXT
);

CREATE TABLE patterns (
    pattern_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT NOT NULL,
    file_path      TEXT NOT NULL UNIQUE,
    duration_ms    INTEGER,
    description    TEXT,
    metadata_json  TEXT
);

CREATE TABLE sessions (
    session_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    participant_id  INTEGER NOT NULL,
    location_id     INTEGER NOT NULL,
    session_date    DATETIME NOT NULL,
    equipment_info  TEXT,
    experimenter    TEXT,
    notes           TEXT,
    FOREIGN KEY (participant_id) REFERENCES participants(participant_id),
    FOREIGN KEY (location_id) REFERENCES locations(location_id)
);

CREATE TABLE trials (
    trial_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id     INTEGER NOT NULL,
    pattern_id     INTEGER NOT NULL,
    trial_order    INTEGER NOT NULL,
    start_time     DATETIME NOT NULL,
    end_time       DATETIME,
    notes          TEXT,
    UNIQUE (session_id, trial_order),
    FOREIGN KEY (session_id) REFERENCES sessions(session_id),
    FOREIGN KEY (pattern_id) REFERENCES patterns(pattern_id)
);

CREATE TABLE trial_survey_responses (
    response_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    trial_id       INTEGER NOT NULL UNIQUE,
    urgency        REAL NOT NULL CHECK (urgency >= 0.0 AND urgency <= 1.0),
    intensity      REAL NOT NULL CHECK (intensity >= 0.0 AND intensity <= 1.0),
    mood           TEXT NOT NULL CHECK (mood IN ('Distressed', 'Sad', 'Balanced', 'Happy', 'Ecstatic', 'Unsure')),
    anxiety        TEXT NOT NULL CHECK (anxiety IN ('Meditative', 'Relaxed', 'Steady', 'Cautious', 'Anxious', 'Unsure')),
    focus          TEXT NOT NULL CHECK (focus IN ('Scattered', 'Distracted', 'Present', 'Engaged', 'Absorbed', 'Unsure')),
    body           TEXT NOT NULL CHECK (body IN ('Tense', 'Tight', 'Neutral', 'Loose', 'Grounded', 'Unsure')),
    energy         TEXT NOT NULL CHECK (energy IN ('Depleted', 'Tired', 'Neutral', 'Energized', 'Charged', 'Unsure')),
    clarity        TEXT NOT NULL CHECK (clarity IN ('Confused', 'Foggy', 'Clear', 'Sharp', 'Lucid', 'Unsure')),
    social         TEXT NOT NULL CHECK (social IN ('Withdrawn', 'Reserved', 'Open', 'Connected', 'Expansive', 'Unsure')),
    motivation     TEXT NOT NULL CHECK (motivation IN ('Resistant', 'Reluctant', 'Willing', 'Driven', 'Compelled', 'Unsure')),
    confidence     REAL NOT NULL CHECK (confidence >= 0.0 AND confidence <= 1.0),
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trial_id) REFERENCES trials(trial_id) ON DELETE CASCADE
);

CREATE TABLE trial_survey_directions (
    response_id    INTEGER NOT NULL,
    axis           TEXT NOT NULL CHECK (axis IN ('left_right', 'up_down', 'forward_backward')),
    value          TEXT NOT NULL,
    PRIMARY KEY (response_id, axis),
    CHECK (
        (axis = 'left_right' AND value IN ('Left', 'Right')) OR
        (axis = 'up_down' AND value IN ('Up', 'Down')) OR
        (axis = 'forward_backward' AND value IN ('Forward', 'Backward'))
    ),
    FOREIGN KEY (response_id) REFERENCES trial_survey_responses(response_id) ON DELETE CASCADE
);

CREATE TABLE trial_survey_actions (
    response_id    INTEGER NOT NULL,
    action_type    TEXT NOT NULL CHECK (action_type IN ('predefined', 'custom')),
    action_value   TEXT NOT NULL,
    PRIMARY KEY (response_id, action_type, action_value),
    CHECK (
        (action_type = 'predefined' AND action_value IN ('Lean', 'Slide', 'Turn', 'Twist', 'Run', 'Jump')) OR
        (action_type = 'custom' AND LENGTH(TRIM(action_value)) > 0)
    ),
    FOREIGN KEY (response_id) REFERENCES trial_survey_responses(response_id) ON DELETE CASCADE
);

CREATE TABLE trial_survey_textures (
    response_id    INTEGER NOT NULL,
    facet          TEXT NOT NULL CHECK (facet IN ('temperature', 'hardness', 'surface')),
    value          TEXT NOT NULL,
    PRIMARY KEY (response_id, facet),
    CHECK (
        (facet = 'temperature' AND value IN ('Hot', 'Cold')) OR
        (facet = 'hardness' AND value IN ('Hard', 'Soft')) OR
        (facet = 'surface' AND value IN ('Smooth', 'Rough'))
    ),
    FOREIGN KEY (response_id) REFERENCES trial_survey_responses(response_id) ON DELETE CASCADE
);

CREATE TABLE trial_events (
    event_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    trial_id       INTEGER NOT NULL,
    event_type     TEXT NOT NULL,
    phase          TEXT,
    timestamp_ms   INTEGER,
    created_at     DATETIME,
    details_json   TEXT,
    FOREIGN KEY (trial_id) REFERENCES trials(trial_id)
);

CREATE TABLE brainwave_readings (
    reading_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    trial_id        INTEGER NOT NULL,
    timestamp_ms    INTEGER NOT NULL,
    phase           TEXT NOT NULL CHECK (phase IN ('baseline', 'stimulation')),
    signal_quality  INTEGER,
    delta_abs       REAL,
    theta_abs       REAL,
    alpha_abs       REAL,
    beta_abs        REAL,
    gamma_abs       REAL,
    delta_rel       REAL,
    theta_rel       REAL,
    alpha_rel       REAL,
    beta_rel        REAL,
    gamma_rel       REAL,
    FOREIGN KEY (trial_id) REFERENCES trials(trial_id)
);

CREATE INDEX idx_readings_trial_time ON brainwave_readings(trial_id, timestamp_ms);
CREATE INDEX idx_readings_trial_phase ON brainwave_readings(trial_id, phase);
CREATE INDEX idx_trials_session ON trials(session_id);
CREATE INDEX idx_sessions_participant ON sessions(participant_id);
CREATE INDEX idx_trial_events_trial_time ON trial_events(trial_id, timestamp_ms);
CREATE INDEX idx_trial_survey_response_trial ON trial_survey_responses(trial_id);
