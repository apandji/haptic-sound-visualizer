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
    file_path      TEXT NOT NULL,
    duration_ms    INTEGER,
    description    TEXT,
    metadata_json  TEXT
);

CREATE TABLE tags (
    tag_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    tag_name    TEXT NOT NULL UNIQUE,
    category    TEXT,
    description TEXT
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
    FOREIGN KEY (session_id) REFERENCES sessions(session_id),
    FOREIGN KEY (pattern_id) REFERENCES patterns(pattern_id)
);

CREATE TABLE trial_tags (
    trial_id    INTEGER NOT NULL,
    tag_id      INTEGER NOT NULL,
    intensity   INTEGER CHECK (intensity BETWEEN 1 AND 4),
    selected_at DATETIME,
    PRIMARY KEY (trial_id, tag_id),
    FOREIGN KEY (trial_id) REFERENCES trials(trial_id),
    FOREIGN KEY (tag_id) REFERENCES tags(tag_id)
);

CREATE TABLE brainwave_readings (
    reading_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    trial_id        INTEGER NOT NULL,
    timestamp_ms    INTEGER NOT NULL,
    phase           TEXT NOT NULL CHECK (phase IN ('relaxation', 'stimulus', 'selection')),
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
