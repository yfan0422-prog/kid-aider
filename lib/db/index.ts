import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const dbPath = path.join(process.cwd(), "data", "kid-aider.db");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT DEFAULT '',
      age_group TEXT NOT NULL DEFAULT '10-12',
      status TEXT NOT NULL DEFAULT 'active',
      funnel_step INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('child','guide','system')),
      content TEXT NOT NULL,
      strategy_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS requirement_nodes (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      layer INTEGER NOT NULL CHECK(layer BETWEEN 1 AND 5),
      label TEXT NOT NULL,
      content TEXT NOT NULL,
      parent_id TEXT REFERENCES requirement_nodes(id) ON DELETE SET NULL,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS solution_packs (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      version INTEGER NOT NULL DEFAULT 1,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS model_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider TEXT NOT NULL CHECK(provider IN ('openai','anthropic','custom')),
      base_url TEXT NOT NULL,
      api_key TEXT NOT NULL,
      model TEXT NOT NULL,
      assigned_roles TEXT NOT NULL DEFAULT '["dialogue"]',
      params TEXT NOT NULL DEFAULT '{"temperature":0.7,"max_tokens":2048}',
      is_default INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_requirements_session ON requirement_nodes(session_id);
    CREATE INDEX IF NOT EXISTS idx_packs_session ON solution_packs(session_id);

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tracks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'software',
      sort_order INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS milestones (
      id TEXT PRIMARY KEY,
      track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      completed_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      milestone_id TEXT NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      what_to_do TEXT NOT NULL,
      how_hint TEXT DEFAULT '',
      difficulty INTEGER DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'pending',
      completed_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS check_ins (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      summary TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(project_id, date)
    );

    CREATE TABLE IF NOT EXISTS reflections (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      trigger_ref TEXT,
      q1 TEXT DEFAULT '',
      q2 TEXT DEFAULT '',
      q3 TEXT DEFAULT '',
      q4 TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_logs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      detail TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tracks_project ON tracks(project_id);
    CREATE INDEX IF NOT EXISTS idx_milestones_track ON milestones(track_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_milestone ON tasks(milestone_id);
    CREATE INDEX IF NOT EXISTS idx_check_ins_project_date ON check_ins(project_id, date);
    CREATE INDEX IF NOT EXISTS idx_reflections_project ON reflections(project_id);
    CREATE INDEX IF NOT EXISTS idx_project_logs_project ON project_logs(project_id);

    CREATE TABLE IF NOT EXISTS competency_snapshots (
      id          TEXT PRIMARY KEY,
      week_start  TEXT NOT NULL,
      dimension   TEXT NOT NULL CHECK(dimension IN (
                    'clarification','decomposition','execution',
                    'reflection','creativity','persistence'
                  )),
      score       INTEGER NOT NULL CHECK(score BETWEEN 0 AND 100),
      score_type  TEXT NOT NULL CHECK(score_type IN ('rule','ai')),
      evidence    TEXT NOT NULL DEFAULT '[]',
      created_at  TEXT NOT NULL,
      UNIQUE(week_start, dimension)
    );

    CREATE TABLE IF NOT EXISTS evidence_events (
      id           TEXT PRIMARY KEY,
      dimension    TEXT NOT NULL,
      event_type   TEXT NOT NULL,
      source_table TEXT NOT NULL,
      source_id    TEXT NOT NULL,
      payload      TEXT NOT NULL DEFAULT '{}',
      created_at   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS badges (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      label       TEXT NOT NULL,
      tier        TEXT NOT NULL CHECK(tier IN ('silver','gold')),
      dimension   TEXT,
      category    TEXT NOT NULL CHECK(category IN ('competency','achievement')),
      description TEXT NOT NULL,
      icon        TEXT NOT NULL,
      earned_at   TEXT,
      created_at  TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_snapshots_week ON competency_snapshots(week_start);
    CREATE INDEX IF NOT EXISTS idx_evidence_dimension ON evidence_events(dimension);
    CREATE INDEX IF NOT EXISTS idx_evidence_created ON evidence_events(created_at);
    CREATE INDEX IF NOT EXISTS idx_badges_dimension ON badges(dimension);
    CREATE INDEX IF NOT EXISTS idx_badges_earned ON badges(earned_at);
  `);

  return db;
}
