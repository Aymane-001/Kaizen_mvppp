/* ═══════════════════════════════════════════════
   KIRO — db.js
   PostgreSQL database layer.
   All queries go through this file.
   ═══════════════════════════════════════════════ */

const { Pool } = require('pg');

// Connection pool — reads from environment variables
// Set these in your .env or shell before starting
const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'kiro',
  user:     process.env.DB_USER     || 'kiro_user',
  password: process.env.DB_PASSWORD || 'changeme',
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

// ─────────────────────────────────────────────
// INIT — create tables if they don't exist
// Run once on startup
// ─────────────────────────────────────────────
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id           SERIAL PRIMARY KEY,
      username     TEXT UNIQUE NOT NULL,
      xp_daily     INTEGER DEFAULT 0,
      xp_monthly   INTEGER DEFAULT 0,
      xp_total     INTEGER DEFAULT 0,
      streak       INTEGER DEFAULT 0,
      sessions     INTEGER DEFAULT 0,
      last_seen    TIMESTAMPTZ DEFAULT NOW(),
      created_at   TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id           SERIAL PRIMARY KEY,
      username     TEXT NOT NULL,
      room_id      TEXT NOT NULL,
      xp_earned    INTEGER DEFAULT 0,
      duration_sec INTEGER DEFAULT 0,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('[DB] Tables ready');

  // Schedule daily XP reset at midnight
  scheduleDailyReset();
}

// ─────────────────────────────────────────────
// QUERIES
// ─────────────────────────────────────────────

// Create or return existing user
async function upsertUser(username) {
  const result = await pool.query(`
    INSERT INTO users (username)
    VALUES ($1)
    ON CONFLICT (username) DO UPDATE
      SET last_seen = NOW()
    RETURNING *
  `, [username]);
  return result.rows[0];
}

// Update user XP (adds to existing)
async function updateXP(username, xpToAdd) {
  if (!username || !xpToAdd || xpToAdd <= 0) return;
  await pool.query(`
    UPDATE users
    SET
      xp_daily   = xp_daily   + $2,
      xp_monthly = xp_monthly + $2,
      xp_total   = xp_total   + $2,
      last_seen  = NOW()
    WHERE username = $1
  `, [username, xpToAdd]);
}

// Get leaderboard for a time period
async function getLeaderboard(period = 'daily') {
  const col = period === 'monthly' ? 'xp_monthly' : 'xp_daily';
  const result = await pool.query(`
    SELECT username, ${col} as xp
    FROM users
    WHERE ${col} > 0
    ORDER BY ${col} DESC
    LIMIT 50
  `);
  return result.rows;
}

// Get a single user's stats
async function getUser(username) {
  const result = await pool.query(
    'SELECT * FROM users WHERE username = $1',
    [username]
  );
  return result.rows[0] || null;
}

// Log a completed session
async function logSession(username, roomId, xpEarned, durationSec) {
  await pool.query(`
    INSERT INTO sessions (username, room_id, xp_earned, duration_sec)
    VALUES ($1, $2, $3, $4)
  `, [username, roomId, xpEarned, durationSec]);

  // Increment session count
  await pool.query(`
    UPDATE users SET sessions = sessions + 1 WHERE username = $1
  `, [username]);
}

// ─────────────────────────────────────────────
// SCHEDULED RESETS
// ─────────────────────────────────────────────
function scheduleDailyReset() {
  // Reset daily XP every 24h from startup
  // In production: use a cron job (e.g. node-cron) for exact midnight reset
  const MS_24H = 24 * 60 * 60 * 1000;
  setInterval(async () => {
    try {
      await pool.query('UPDATE users SET xp_daily = 0');
      console.log('[DB] Daily XP reset complete');
    } catch (err) {
      console.error('[DB] Daily reset failed:', err.message);
    }
  }, MS_24H);

  // Reset monthly XP every 30 days
  const MS_30D = 30 * MS_24H;
  setInterval(async () => {
    try {
      await pool.query('UPDATE users SET xp_monthly = 0');
      console.log('[DB] Monthly XP reset complete');
    } catch (err) {
      console.error('[DB] Monthly reset failed:', err.message);
    }
  }, MS_30D);
}

// Initialize on first import
initDB().catch(err => {
  console.warn('[DB] Could not connect to PostgreSQL:', err.message);
  console.warn('[DB] Running without database — data will not persist.');
});

module.exports = { upsertUser, updateXP, getLeaderboard, getUser, logSession };
