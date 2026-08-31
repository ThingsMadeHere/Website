const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ||
    'postgresql://mchs_admin:admin_password@localhost:5432/mchs_db',
});

// Initialize schema on startup
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS site_users (
      device_id   TEXT        PRIMARY KEY,
      matrix_id   TEXT        UNIQUE NOT NULL,
      username    TEXT        UNIQUE NOT NULL,
      verified    BOOLEAN     NOT NULL DEFAULT FALSE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log('DB schema ready');
}

module.exports = { pool, initDb };
