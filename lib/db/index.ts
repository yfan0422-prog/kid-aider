import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

let db: Database.Database | null = null;

export function getDataDir(): string {
  return process.env.DATA_DIR || path.join(process.cwd(), "data");
}

export function getDb(): Database.Database {
  if (db) return db;

  const dataDir = getDataDir();
  const dbPath = path.join(dataDir, "db", "kid-aider.db");
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
      mode TEXT NOT NULL DEFAULT 'creative',
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
      enabled INTEGER DEFAULT 1,
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

    CREATE TABLE IF NOT EXISTS usage_config (
      id                  INTEGER PRIMARY KEY CHECK(id = 1),
      daily_limit_min     INTEGER,
      quiet_start         TEXT,
      quiet_end           TEXT,
      filter_enabled      INTEGER DEFAULT 0,
      restrictions_paused INTEGER DEFAULT 0,
      updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS usage_log (
      id          TEXT PRIMARY KEY,
      date        TEXT NOT NULL,
      total_sec   INTEGER NOT NULL DEFAULT 0,
      UNIQUE(date)
    );

    CREATE TABLE IF NOT EXISTS filtered_words (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS voice_sessions (
      id            TEXT PRIMARY KEY,
      session_id    TEXT,
      audio_path    TEXT NOT NULL,
      transcript    TEXT,
      asr_model     TEXT NOT NULL,
      asr_time_ms   INTEGER,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS emotion_log (
      id             TEXT PRIMARY KEY,
      session_id     TEXT,
      source         TEXT NOT NULL CHECK(source IN ('voice', 'text', 'fused')),
      emotion        TEXT NOT NULL,
      confidence     REAL,
      voice_features TEXT,
      text_snippet   TEXT,
      model_used     TEXT NOT NULL DEFAULT 'rule',
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_voice_sessions_session ON voice_sessions(session_id);
    CREATE INDEX IF NOT EXISTS idx_emotion_log_session ON emotion_log(session_id);

    CREATE TABLE IF NOT EXISTS works (
      id               TEXT PRIMARY KEY,
      child_id         TEXT NOT NULL DEFAULT '',
      type             TEXT NOT NULL CHECK(type IN ('photo','video')),
      file_path        TEXT NOT NULL,
      mime_type        TEXT NOT NULL,
      title            TEXT DEFAULT '',
      description      TEXT DEFAULT '',
      ai_encouragement TEXT DEFAULT '',
      size_bytes       INTEGER DEFAULT 0,
      created_at       TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_works_child ON works(child_id);

    CREATE TABLE IF NOT EXISTS child_profile (
      id                TEXT PRIMARY KEY,
      ability_creativity    REAL DEFAULT 0.5,
      ability_logical       REAL DEFAULT 0.5,
      ability_focus         REAL DEFAULT 0.5,
      ability_expression    REAL DEFAULT 0.5,
      ability_curiosity     REAL DEFAULT 0.5,
      ability_updated_at    TEXT,
      interest_tags         TEXT DEFAULT '[]',
      interest_updated_at   TEXT,
      emotion_baseline      TEXT DEFAULT '{}',
      emotion_updated_at    TEXT,
      preferred_time_range  TEXT,
      avg_session_minutes   REAL,
      engagement_trend      TEXT DEFAULT 'stable',
      total_sessions        INTEGER DEFAULT 0,
      last_session_at       TEXT,
      deep_analysis_at      TEXT,
      created_at            TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS profile_updates (
      id            TEXT PRIMARY KEY,
      trigger       TEXT NOT NULL CHECK(trigger IN ('session_start', 'session_end', 'deep_analysis')),
      changes       TEXT NOT NULL,
      snapshot      TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT OR IGNORE INTO usage_config (id) VALUES (1);

    INSERT OR IGNORE INTO filtered_words (word) VALUES
    ('暴力'),('自杀'),('自残'),('毒品'),('色情'),('赌博'),
    ('恐怖主义'),('种族歧视'),('虐待'),('枪支'),
    ('炸弹'),('炸药'),('毒药'),('酗酒'),('吸烟'),
    ('诈骗'),('黑客'),('盗版'),('欺凌'),('裸体');

    CREATE INDEX IF NOT EXISTS idx_snapshots_week ON competency_snapshots(week_start);
    CREATE INDEX IF NOT EXISTS idx_evidence_dimension ON evidence_events(dimension);
    CREATE INDEX IF NOT EXISTS idx_evidence_created ON evidence_events(created_at);
    CREATE INDEX IF NOT EXISTS idx_badges_dimension ON badges(dimension);
    CREATE INDEX IF NOT EXISTS idx_badges_earned ON badges(earned_at);
    CREATE INDEX IF NOT EXISTS idx_usage_log_date ON usage_log(date);

    CREATE TABLE IF NOT EXISTS topic_catalog (
      id            TEXT PRIMARY KEY,
      title         TEXT NOT NULL,
      summary       TEXT NOT NULL,
      cover_image   TEXT,
      category      TEXT NOT NULL,
      age_group     TEXT NOT NULL,
      language      TEXT NOT NULL DEFAULT 'zh-CN',
      interest_tag  TEXT,
      source        TEXT NOT NULL DEFAULT 'seed',
      sort_order    INTEGER DEFAULT 0,
      is_active     INTEGER DEFAULT 1,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS topic_contents (
      id              TEXT PRIMARY KEY,
      topic_id        TEXT NOT NULL REFERENCES topic_catalog(id),
      age_group       TEXT NOT NULL,
      language        TEXT NOT NULL DEFAULT 'zh-CN',
      version         INTEGER NOT NULL DEFAULT 1,
      intro_text      TEXT NOT NULL,
      challenges      TEXT NOT NULL,
      project_prompt  TEXT,
      image_prompts   TEXT,
      generation_rule_version TEXT NOT NULL,
      is_active       INTEGER NOT NULL DEFAULT 1,
      generated_at    TEXT NOT NULL,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_topic_content_version
      ON topic_contents(topic_id, age_group, language, version);

    CREATE INDEX IF NOT EXISTS idx_topic_contents_active
      ON topic_contents(topic_id, is_active);

    CREATE INDEX IF NOT EXISTS idx_topic_catalog_category
      ON topic_catalog(category);

    CREATE INDEX IF NOT EXISTS idx_topic_catalog_age
      ON topic_catalog(age_group);

    CREATE INDEX IF NOT EXISTS idx_topic_catalog_language
      ON topic_catalog(language);

    CREATE INDEX IF NOT EXISTS idx_topic_catalog_source
      ON topic_catalog(source);

    CREATE TABLE IF NOT EXISTS topic_suggestions (
      id              TEXT PRIMARY KEY,
      interest_tag    TEXT NOT NULL,
      candidate_title TEXT NOT NULL,
      viability_score REAL NOT NULL,
      viability_reason TEXT,
      status          TEXT NOT NULL DEFAULT 'pending',
      reviewed_at     TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_topic_suggestions_status
      ON topic_suggestions(status);

    CREATE TABLE IF NOT EXISTS user_account (
      id              TEXT PRIMARY KEY,
      display_name    TEXT NOT NULL DEFAULT '小小探索者',
      avatar_emoji    TEXT DEFAULT '🧒',
      age_group       TEXT NOT NULL DEFAULT '10-12',
      language        TEXT NOT NULL DEFAULT 'zh-CN',
      total_points    INTEGER NOT NULL DEFAULT 0,
      current_streak  INTEGER NOT NULL DEFAULT 0,
      longest_streak  INTEGER NOT NULL DEFAULT 0,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_activity (
      id              TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL,
      action_type     TEXT NOT NULL,
      action_target   TEXT,
      points          INTEGER NOT NULL,
      note            TEXT,
      created_at      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_daily_activity_user_date
      ON daily_activity(user_id, created_at);

    CREATE TABLE IF NOT EXISTS badge_def (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      description     TEXT NOT NULL,
      icon            TEXT NOT NULL,
      category        TEXT NOT NULL,
      rarity          TEXT NOT NULL DEFAULT 'common',
      points_value    INTEGER NOT NULL DEFAULT 0,
      unlock_rule     TEXT NOT NULL,
      sort_order      INTEGER DEFAULT 0,
      created_at      TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS badge_unlock (
      id              TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL,
      badge_id        TEXT NOT NULL REFERENCES badge_def(id),
      unlocked_at     TEXT NOT NULL,
      UNIQUE(user_id, badge_id)
    );
    CREATE INDEX IF NOT EXISTS idx_badge_unlock_user ON badge_unlock(user_id);
  `);

  // P8b: schema migration for topic→project integration
  try { db.exec("ALTER TABLE projects ADD COLUMN source TEXT DEFAULT 'funnel'"); } catch {}
  try { db.exec("ALTER TABLE sessions ADD COLUMN mode TEXT NOT NULL DEFAULT 'creative'"); } catch {}
  try { db.exec("ALTER TABLE projects ADD COLUMN source_topic_id TEXT"); } catch {}
  try { db.exec("ALTER TABLE milestones ADD COLUMN challenge_json TEXT"); } catch {}

  // Model profile enable/disable toggle
  try { db.exec("ALTER TABLE model_profiles ADD COLUMN enabled INTEGER DEFAULT 1"); } catch {}

  // 多子账号迁移（P9）
  try { migrateToMultiChild(db); } catch { /* migration failure is non-fatal */ }

  // 兜底：把历史遗留的无归属会话（child_id=''）归属到第一个孩子。
  // 迁移只跑一次（user_version>=1 后跳过），此处幂等补账，保证存量会话可被历史列表检索。
  try {
    const firstAccount = db.prepare("SELECT id FROM user_account ORDER BY created_at ASC LIMIT 1").get() as { id: string } | undefined;
    if (firstAccount) {
      db.prepare("UPDATE sessions SET child_id = ? WHERE child_id = ''").run(firstAccount.id);
    }
  } catch { /* backfill failure is non-fatal */ }

  return db;
}

function migrateToMultiChild(db: Database.Database): void {
  // 检测迁移是否已执行（user_account 表已存在的跳过）
  const migrated = db.pragma("user_version", { simple: true }) as number;
  if (migrated >= 1) return;

  const tables = [
    "sessions",
    "projects",
    "voice_sessions",
    "emotion_log",
    "child_profile",
    "profile_updates",
    "competency_snapshots",
    "evidence_events",
  ];

  for (const table of tables) {
    // 检测列是否存在
    const hasColumn = db.prepare(
      `SELECT COUNT(*) as c FROM pragma_table_info(?) WHERE name = 'child_id'`
    ).get(table) as { c: number };
    if (hasColumn.c > 0) continue;

    db.exec(`ALTER TABLE ${table} ADD COLUMN child_id TEXT NOT NULL DEFAULT ''`);
  }

  // 存量数据归属到第一个用户
  const firstAccount = db.prepare("SELECT id FROM user_account LIMIT 1").get() as { id: string } | undefined;
  if (firstAccount) {
    for (const table of tables) {
      db.prepare(`UPDATE ${table} SET child_id = ? WHERE child_id = ''`).run(firstAccount.id);
    }
  }

  // 创建索引
  const indexes = [
    "CREATE INDEX IF NOT EXISTS idx_sessions_child ON sessions(child_id)",
    "CREATE INDEX IF NOT EXISTS idx_projects_child ON projects(child_id)",
    "CREATE INDEX IF NOT EXISTS idx_voice_child ON voice_sessions(child_id)",
    "CREATE INDEX IF NOT EXISTS idx_emotion_child ON emotion_log(child_id)",
    "CREATE INDEX IF NOT EXISTS idx_profile_child ON child_profile(child_id)",
    "CREATE INDEX IF NOT EXISTS idx_updates_child ON profile_updates(child_id)",
    "CREATE INDEX IF NOT EXISTS idx_comp_child ON competency_snapshots(child_id)",
    "CREATE INDEX IF NOT EXISTS idx_evidence_child ON evidence_events(child_id)",
  ];
  for (const idx of indexes) {
    db.exec(idx);
  }

  // 标记迁移完成
  db.pragma("user_version = 1");
}
