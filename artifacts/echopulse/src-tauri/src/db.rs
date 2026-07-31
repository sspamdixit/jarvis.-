use chrono::Utc;
use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

// ── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Task {
    pub id: i64,
    pub text: String,
    pub completed: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CommandLog {
    pub id: i64,
    pub query: String,
    pub source: String,
    pub reply: String,
    pub matched_pattern: Option<String>,
    pub action: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Preference {
    pub id: i64,
    pub category: String,
    pub platform: String,
    pub count: i64,
}

// ── Database ─────────────────────────────────────────────────────────────────

pub struct Db(pub Mutex<Connection>);

impl Db {
    pub fn open(path: &std::path::Path) -> Result<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).ok();
        }
        let conn = Connection::open(path)?;
        conn.execute_batch(
            "
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous  = NORMAL;

            CREATE TABLE IF NOT EXISTS tasks (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                text        TEXT    NOT NULL,
                completed   INTEGER NOT NULL DEFAULT 0,
                created_at  TEXT    NOT NULL,
                updated_at  TEXT    NOT NULL
            );

            CREATE TABLE IF NOT EXISTS command_logs (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                query           TEXT NOT NULL,
                source          TEXT NOT NULL,
                reply           TEXT NOT NULL,
                matched_pattern TEXT,
                action          TEXT,
                created_at      TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS preferences (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                category    TEXT NOT NULL,
                platform    TEXT NOT NULL,
                count       INTEGER NOT NULL DEFAULT 0,
                updated_at  TEXT NOT NULL,
                UNIQUE(category, platform)
            );

            CREATE TABLE IF NOT EXISTS config (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            ",
        )?;
        Ok(Db(Mutex::new(conn)))
    }

    // ── Config ───────────────────────────────────────────────────────────────

    pub fn get_config(&self, key: &str) -> Result<Option<String>> {
        let conn = self.0.lock().unwrap();
        let mut stmt = conn.prepare("SELECT value FROM config WHERE key = ?1")?;
        let mut rows = stmt.query(params![key])?;
        Ok(rows.next()?.map(|r| r.get(0).unwrap()))
    }

    pub fn set_config(&self, key: &str, value: &str) -> Result<()> {
        let conn = self.0.lock().unwrap();
        conn.execute(
            "INSERT INTO config (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = ?2",
            params![key, value],
        )?;
        Ok(())
    }

    // ── Tasks ────────────────────────────────────────────────────────────────

    pub fn get_tasks(&self) -> Result<Vec<Task>> {
        let conn = self.0.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, text, completed, created_at, updated_at
             FROM tasks ORDER BY created_at DESC",
        )?;
        let tasks = stmt
            .query_map([], |r| {
                Ok(Task {
                    id: r.get(0)?,
                    text: r.get(1)?,
                    completed: r.get::<_, i64>(2)? != 0,
                    created_at: r.get(3)?,
                    updated_at: r.get(4)?,
                })
            })?
            .collect::<Result<Vec<_>>>()?;
        Ok(tasks)
    }

    pub fn create_task(&self, text: &str) -> Result<Task> {
        let now = Utc::now().to_rfc3339();
        let conn = self.0.lock().unwrap();
        conn.execute(
            "INSERT INTO tasks (text, completed, created_at, updated_at) VALUES (?1, 0, ?2, ?2)",
            params![text, now],
        )?;
        Ok(Task {
            id: conn.last_insert_rowid(),
            text: text.to_string(),
            completed: false,
            created_at: now.clone(),
            updated_at: now,
        })
    }

    pub fn update_task(&self, id: i64, completed: bool) -> Result<Option<Task>> {
        let now = Utc::now().to_rfc3339();
        let conn = self.0.lock().unwrap();
        let changed = conn.execute(
            "UPDATE tasks SET completed = ?1, updated_at = ?2 WHERE id = ?3",
            params![completed as i64, now, id],
        )?;
        if changed == 0 {
            return Ok(None);
        }
        let task = conn.query_row(
            "SELECT id, text, completed, created_at, updated_at FROM tasks WHERE id = ?1",
            params![id],
            |r| {
                Ok(Task {
                    id: r.get(0)?,
                    text: r.get(1)?,
                    completed: r.get::<_, i64>(2)? != 0,
                    created_at: r.get(3)?,
                    updated_at: r.get(4)?,
                })
            },
        )?;
        Ok(Some(task))
    }

    pub fn delete_task(&self, id: i64) -> Result<()> {
        let conn = self.0.lock().unwrap();
        conn.execute("DELETE FROM tasks WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ── Command logs ─────────────────────────────────────────────────────────

    pub fn add_log(
        &self,
        query: &str,
        source: &str,
        reply: &str,
        matched_pattern: Option<&str>,
        action: Option<&str>,
    ) -> Result<CommandLog> {
        let now = Utc::now().to_rfc3339();
        let conn = self.0.lock().unwrap();
        conn.execute(
            "INSERT INTO command_logs
             (query, source, reply, matched_pattern, action, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![query, source, reply, matched_pattern, action, now],
        )?;
        Ok(CommandLog {
            id: conn.last_insert_rowid(),
            query: query.to_string(),
            source: source.to_string(),
            reply: reply.to_string(),
            matched_pattern: matched_pattern.map(str::to_string),
            action: action.map(str::to_string),
            created_at: now,
        })
    }

    pub fn get_logs(&self, limit: i64) -> Result<Vec<CommandLog>> {
        let conn = self.0.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, query, source, reply, matched_pattern, action, created_at
             FROM command_logs ORDER BY created_at DESC LIMIT ?1",
        )?;
        let logs = stmt
            .query_map(params![limit], |r| {
                Ok(CommandLog {
                    id: r.get(0)?,
                    query: r.get(1)?,
                    source: r.get(2)?,
                    reply: r.get(3)?,
                    matched_pattern: r.get(4)?,
                    action: r.get(5)?,
                    created_at: r.get(6)?,
                })
            })?
            .collect::<Result<Vec<_>>>()?;
        Ok(logs)
    }

    // ── Preferences ──────────────────────────────────────────────────────────

    pub fn get_preferences(&self) -> Result<Vec<Preference>> {
        let conn = self.0.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, category, platform, count FROM preferences ORDER BY count DESC",
        )?;
        let prefs = stmt
            .query_map([], |r| {
                Ok(Preference {
                    id: r.get(0)?,
                    category: r.get(1)?,
                    platform: r.get(2)?,
                    count: r.get(3)?,
                })
            })?
            .collect::<Result<Vec<_>>>()?;
        Ok(prefs)
    }

    pub fn upsert_preference(&self, category: &str, platform: &str) -> Result<()> {
        let now = Utc::now().to_rfc3339();
        let conn = self.0.lock().unwrap();
        conn.execute(
            "INSERT INTO preferences (category, platform, count, updated_at) VALUES (?1, ?2, 1, ?3)
             ON CONFLICT(category, platform) DO UPDATE SET count = count + 1, updated_at = ?3",
            params![category, platform, now],
        )?;
        Ok(())
    }
}
