// One-time migration: SQLite → PostgreSQL
// Run BEFORE removing better-sqlite3 from node_modules:
//
//   DATABASE_URL=postgresql://user:pass@host/dbname node migrate.js
//
// Requires both better-sqlite3 (already installed) and pg (npm install pg).

import Database from "better-sqlite3";
import pg from "pg";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;

const sqliteDb = new Database(join(__dirname, "data", "dikanish.sqlite"), { readonly: true });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  const client = await pool.connect();
  try {
    // ── Create tables ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS state_log (
        id BIGSERIAL PRIMARY KEY,
        key TEXT NOT NULL,
        updated_at INTEGER DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `);

    // ── state ──
    const stateRows = sqliteDb.prepare("SELECT key, value, updated_at FROM state").all();
    let stateCount = 0;
    for (const row of stateRows) {
      await client.query(
        `INSERT INTO state (key, value, updated_at) VALUES ($1, $2, $3)
         ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
        [row.key, row.value, row.updated_at]
      );
      stateCount++;
    }
    console.log(`state: ${stateCount} rows copied`);

    // ── state_log ──
    // id is BIGSERIAL — let PostgreSQL generate new IDs; copy key + updated_at only
    const logRows = sqliteDb.prepare("SELECT key, updated_at FROM state_log").all();
    let logCount = 0;
    for (const row of logRows) {
      await client.query(
        "INSERT INTO state_log (key, updated_at) VALUES ($1, $2)",
        [row.key, row.updated_at]
      );
      logCount++;
    }
    console.log(`state_log: ${logCount} rows copied`);

    // ── refresh_tokens ──
    const tokenRows = sqliteDb.prepare("SELECT id, user_id, expires_at FROM refresh_tokens").all();
    let tokenCount = 0;
    for (const row of tokenRows) {
      await client.query(
        `INSERT INTO refresh_tokens (id, user_id, expires_at) VALUES ($1, $2, $3)
         ON CONFLICT(id) DO NOTHING`,
        [row.id, row.user_id, row.expires_at]
      );
      tokenCount++;
    }
    console.log(`refresh_tokens: ${tokenCount} rows copied`);

    console.log("Migration complete.");
  } finally {
    client.release();
    await pool.end();
    sqliteDb.close();
  }
}

migrate().catch(e => {
  console.error("Migration failed:", e);
  process.exit(1);
});
