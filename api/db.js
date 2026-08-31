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
  `);
  console.log('DB schema ready');
}

// Wrap SQLite methods to match PostgreSQL pool interface
const pool = {
  query: async (sql, params = []) => {
    const stmt = db.prepare(sql);
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      return { rows: stmt.all(...params) };
    } else {
      stmt.run(...params);
      return { rowCount: db.changes };
    }
  }
};

module.exports = { pool, initDb };
