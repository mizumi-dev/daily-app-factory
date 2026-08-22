-- 日刊アプリ工房 D1 初期スキーマ（設計書 §06 準拠）

CREATE TABLE IF NOT EXISTS apps (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  tagline TEXT NOT NULL,
  description TEXT NOT NULL,
  axis TEXT NOT NULL,
  origin TEXT NOT NULL,
  brief_id INTEGER,
  signal_ref TEXT,
  published_at TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  gen_cost_usd REAL NOT NULL,
  gen_attempts INTEGER NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  reactions INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'live'
);

CREATE TABLE IF NOT EXISTS app_tags (
  slug TEXT NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (slug, tag)
);
CREATE INDEX IF NOT EXISTS idx_tag ON app_tags(tag);

CREATE TABLE IF NOT EXISTS briefs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT UNIQUE NOT NULL,
  text TEXT NOT NULL,
  axis_hint TEXT,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL,
  reject_note TEXT,
  result_slug TEXT
);
CREATE INDEX IF NOT EXISTS idx_queue ON briefs(status, created_at);

CREATE TABLE IF NOT EXISTS signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  url TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  need TEXT NOT NULL,
  score REAL NOT NULL,
  collected_at TEXT NOT NULL,
  used_by TEXT
);

CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  axis TEXT,
  outcome TEXT,
  barren INTEGER NOT NULL DEFAULT 0,
  stage_failed TEXT,
  tokens_in INTEGER,
  tokens_out INTEGER,
  cost_usd REAL,
  log TEXT
);

CREATE TABLE IF NOT EXISTS directives_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 全文検索（日本語は trigram トークナイザで対応予定。D1 で動かない場合は unicode61 + LIKE に切替）
CREATE VIRTUAL TABLE IF NOT EXISTS apps_fts USING fts5(
  slug UNINDEXED,
  title,
  tagline,
  description,
  tags,
  tokenize = 'trigram'
);
