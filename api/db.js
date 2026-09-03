const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'mchs.db');
const db = new Database(dbPath);

// Initialize schema on startup
async function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS site_users (
      device_id   TEXT        PRIMARY KEY,
      matrix_id   TEXT        UNIQUE NOT NULL,
      username    TEXT        UNIQUE NOT NULL,
      verified    INTEGER     NOT NULL DEFAULT 0,
      created_at  TEXT        NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS calendar_events (
      id          INTEGER     PRIMARY KEY AUTOINCREMENT,
      title       TEXT        NOT NULL,
      description TEXT,
      date        TEXT        NOT NULL,
      location    TEXT,
      type        TEXT        DEFAULT 'meeting',
      status      TEXT        DEFAULT 'pending',
      proposed_by TEXT,
      created_at  TEXT        NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS event_votes (
      id          INTEGER     PRIMARY KEY AUTOINCREMENT,
      event_id    INTEGER     NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
      matrix_id   TEXT        NOT NULL,
      vote        INTEGER     NOT NULL,
      created_at  TEXT        NOT NULL DEFAULT (datetime('now')),
      UNIQUE(event_id, matrix_id)
    );
  `);
  console.log('DB schema ready');
}

// Wrap SQLite methods to match PostgreSQL pool interface
const pool = {
  query: async (sql, params = []) => {
    // Convert PostgreSQL-style parameters ($1, $2, etc.) to SQLite-style (?)
    const sqliteSql = sql.replace(/\$\d+/g, '?');
    
    const stmt = db.prepare(sqliteSql);
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      const rows = stmt.all(...params);
      // Convert SQLite integer booleans to JavaScript booleans
      rows.forEach(row => {
        if (row.verified !== undefined) {
          row.verified = row.verified === 1;
        }
      });
      return { rows };
    } else {
      stmt.run(...params);
      return { rowCount: db.changes };
    }
  }
};

module.exports = { pool, initDb };
