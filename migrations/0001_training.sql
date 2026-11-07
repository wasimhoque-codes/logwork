PRAGMA foreign_keys = ON;

CREATE TABLE datasets (
  id TEXT PRIMARY KEY,
  state TEXT NOT NULL CHECK(state IN ('staging','active','archived')),
  revision INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  import_hash TEXT UNIQUE
);
CREATE TABLE owner_profile (
  id TEXT PRIMARY KEY CHECK(id = 'owner'),
  active_dataset_id TEXT REFERENCES datasets(id),
  email TEXT NOT NULL
);
CREATE TABLE settings (
  dataset_id TEXT PRIMARY KEY REFERENCES datasets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL CHECK(unit IN ('kg','lb')),
  auto_rest INTEGER NOT NULL CHECK(auto_rest IN (0,1))
);
CREATE TABLE programmes (
  dataset_id TEXT PRIMARY KEY REFERENCES datasets(id) ON DELETE CASCADE,
  week INTEGER NOT NULL CHECK(week BETWEEN 1 AND 16),
  status TEXT NOT NULL CHECK(status IN ('active','complete')),
  saturday_two_sets INTEGER NOT NULL CHECK(saturday_two_sets IN (0,1)),
  saturday_core TEXT NOT NULL CHECK(saturday_core IN ('none','dead-bug','knee-raise')),
  extra_slot TEXT
);
CREATE TABLE week_attempts (
  dataset_id TEXT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  position INTEGER NOT NULL,
  week INTEGER NOT NULL CHECK(week BETWEEN 1 AND 16),
  started TEXT NOT NULL,
  ended TEXT,
  decision TEXT CHECK(decision IN ('advance','repeat','complete','restart')),
  PRIMARY KEY(dataset_id,id),
  UNIQUE(dataset_id,position)
);
CREATE TABLE exercise_choices (
  dataset_id TEXT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  slot TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  setup TEXT NOT NULL,
  support_cm REAL,
  core_level TEXT NOT NULL,
  PRIMARY KEY(dataset_id,slot)
);
CREATE TABLE sessions (
  dataset_id TEXT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  position INTEGER NOT NULL,
  workout_id TEXT NOT NULL,
  program_id TEXT NOT NULL CHECK(program_id = 'programme-16'),
  workout_snapshot TEXT NOT NULL CHECK(json_valid(workout_snapshot)),
  date TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER CHECK(ended_at IS NULL OR ended_at >= started_at),
  phase TEXT NOT NULL CHECK(phase = 'full'),
  week INTEGER NOT NULL CHECK(week BETWEEN 1 AND 16),
  attempt_id TEXT NOT NULL,
  note TEXT NOT NULL,
  feedback TEXT CHECK(feedback IS NULL OR json_valid(feedback)),
  warmup TEXT CHECK(warmup IS NULL OR json_valid(warmup)),
  cooldown TEXT CHECK(cooldown IS NULL OR json_valid(cooldown)),
  resume TEXT CHECK(resume IS NULL OR json_valid(resume)),
  PRIMARY KEY(dataset_id,id),
  FOREIGN KEY(dataset_id,attempt_id) REFERENCES week_attempts(dataset_id,id)
);
CREATE UNIQUE INDEX one_active_session ON sessions(dataset_id) WHERE ended_at IS NULL;
CREATE INDEX session_dates ON sessions(dataset_id,date,started_at);
CREATE INDEX session_attempts ON sessions(dataset_id,attempt_id);
CREATE TABLE session_exercises (
  dataset_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  exercise_id TEXT NOT NULL,
  name TEXT NOT NULL,
  mode TEXT NOT NULL CHECK(mode IN ('external','bodyweight','assistance')),
  note TEXT NOT NULL,
  identity_key TEXT NOT NULL,
  prescription TEXT NOT NULL CHECK(json_valid(prescription)),
  PRIMARY KEY(dataset_id,session_id,position),
  FOREIGN KEY(dataset_id,session_id) REFERENCES sessions(dataset_id,id) ON DELETE CASCADE
);
CREATE INDEX exercise_history ON session_exercises(dataset_id,identity_key,session_id);
CREATE TABLE exercise_sets (
  dataset_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  exercise_position INTEGER NOT NULL,
  position INTEGER NOT NULL CHECK(position BETWEEN 0 AND 9),
  weight_kg REAL CHECK(weight_kg IS NULL OR weight_kg BETWEEN 0 AND 2000),
  reps INTEGER NOT NULL CHECK(reps BETWEEN 0 AND 1000),
  rir INTEGER CHECK(rir IS NULL OR rir BETWEEN 0 AND 10),
  done INTEGER NOT NULL CHECK(done IN (0,1)),
  CHECK(done = 0 OR (weight_kg IS NOT NULL AND reps > 0)),
  PRIMARY KEY(dataset_id,session_id,exercise_position,position),
  FOREIGN KEY(dataset_id,session_id,exercise_position) REFERENCES session_exercises(dataset_id,session_id,position) ON DELETE CASCADE
);
CREATE TABLE body_entries (
  dataset_id TEXT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  position INTEGER NOT NULL,
  date TEXT NOT NULL,
  kg REAL NOT NULL CHECK(kg BETWEEN 20 AND 500),
  PRIMARY KEY(dataset_id,id),
  UNIQUE(dataset_id,date)
);
CREATE TABLE recovery_entries (
  dataset_id TEXT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  position INTEGER NOT NULL,
  date TEXT NOT NULL,
  activity TEXT NOT NULL CHECK(activity IN ('walking','cycling')),
  cardio INTEGER NOT NULL CHECK(cardio BETWEEN 0 AND 300),
  mobility INTEGER NOT NULL CHECK(mobility BETWEEN 0 AND 300),
  note TEXT NOT NULL,
  week INTEGER NOT NULL CHECK(week BETWEEN 1 AND 16),
  attempt_id TEXT NOT NULL,
  PRIMARY KEY(dataset_id,id),
  FOREIGN KEY(dataset_id,attempt_id) REFERENCES week_attempts(dataset_id,id)
);
CREATE TABLE record_versions (
  dataset_id TEXT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  record_key TEXT NOT NULL,
  revision INTEGER NOT NULL,
  deleted INTEGER NOT NULL CHECK(deleted IN (0,1)),
  PRIMARY KEY(dataset_id,record_key)
);
CREATE TABLE mutation_receipts (
  dataset_id TEXT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  mutation_id TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  revision INTEGER NOT NULL,
  PRIMARY KEY(dataset_id,mutation_id)
);
-- A failed guard aborts the whole D1 batch, including all subsequent writes.
CREATE TABLE write_guards (id TEXT PRIMARY KEY, valid INTEGER NOT NULL CHECK(valid = 1));
CREATE TABLE import_stages (
  id TEXT PRIMARY KEY REFERENCES datasets(id) ON DELETE CASCADE,
  expected_dataset_id TEXT,
  expected_revision INTEGER NOT NULL,
  activated INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
