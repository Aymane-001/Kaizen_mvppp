/* ═══════════════════════════════════════════
   KIRO v3 — backend/src/db.js
   PostgreSQL — all queries
   ═══════════════════════════════════════════ */
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'kiro',
  user:     process.env.DB_USER     || 'kiro_user',
  password: process.env.DB_PASSWORD || 'changeme',
});

pool.on('error', err => console.error('[DB] Pool error:', err.message));

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      username      TEXT UNIQUE NOT NULL,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      kiro_id       TEXT UNIQUE,
      mode          TEXT DEFAULT 'student',
      year          TEXT DEFAULT 'freshman',
      school        TEXT DEFAULT 'SSE',
      major         TEXT DEFAULT '',
      xp_daily      INTEGER DEFAULT 0,
      xp_monthly    INTEGER DEFAULT 0,
      xp_total      INTEGER DEFAULT 0,
      hp            INTEGER DEFAULT 100,
      streak        INTEGER DEFAULT 0,
      sessions      INTEGER DEFAULT 0,
      last_seen     TIMESTAMPTZ DEFAULT NOW(),
      last_study    TIMESTAMPTZ,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id              TEXT PRIMARY KEY,
      name            TEXT UNIQUE NOT NULL,
      subject         TEXT NOT NULL,
      max_users       INTEGER DEFAULT 10,
      camera_required BOOLEAN DEFAULT false,
      creator_id      INTEGER REFERENCES users(id),
      creator_name    TEXT,
      active          BOOLEAN DEFAULT true,
      user_count      INTEGER DEFAULT 0,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS friends (
      user_id    INTEGER REFERENCES users(id),
      friend_id  INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, friend_id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id           SERIAL PRIMARY KEY,
      user_id      INTEGER REFERENCES users(id),
      room_id      TEXT,
      xp_earned    INTEGER DEFAULT 0,
      duration_sec INTEGER DEFAULT 0,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('[DB] Tables ready');
  scheduleDailyReset();
}

// ── Users ──────────────────────────────────
async function createUser({ username, email, hash, mode, year, school, major }) {
  const r = await pool.query(
    `INSERT INTO users (username, email, password_hash, mode, year, school, major)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [username, email, hash, mode, year, school, major]
  );
  return r.rows[0].id;
}

async function setUserKiroID(userId, kiroId) {
  await pool.query('UPDATE users SET kiro_id=$1 WHERE id=$2', [kiroId, userId]);
}

async function getUserByUsername(username) {
  const r = await pool.query('SELECT * FROM users WHERE LOWER(username)=LOWER($1)', [username]);
  return r.rows[0] || null;
}

async function getUserByEmail(email) {
  const r = await pool.query('SELECT * FROM users WHERE LOWER(email)=LOWER($1)', [email]);
  return r.rows[0] || null;
}

async function getUserById(id) {
  const r = await pool.query('SELECT * FROM users WHERE id=$1', [id]);
  return r.rows[0] || null;
}

async function updateLastSeen(id) {
  await pool.query('UPDATE users SET last_seen=NOW() WHERE id=$1', [id]);
}

async function searchUsers(q) {
  const r = await pool.query(
    `SELECT username, kiro_id, xp_total, streak FROM users
     WHERE LOWER(username) LIKE LOWER($1) OR LOWER(kiro_id) LIKE LOWER($1)
     LIMIT 5`,
    [`%${q}%`]
  );
  return r.rows;
}

// ── XP / HP ───────────────────────────────
async function addXP(userId, amount) {
  await pool.query(
    `UPDATE users SET
      xp_daily   = xp_daily   + $2,
      xp_monthly = xp_monthly + $2,
      xp_total   = xp_total   + $2,
      last_seen  = NOW(),
      last_study = NOW()
     WHERE id=$1`,
    [userId, amount]
  );
}

async function updateHP(userId, hp) {
  await pool.query('UPDATE users SET hp=$2 WHERE id=$1', [userId, hp]);
}

async function incrementStreak(userId) {
  await pool.query('UPDATE users SET streak=streak+1 WHERE id=$1', [userId]);
}

async function incrementSessions(userId) {
  await pool.query('UPDATE users SET sessions=sessions+1 WHERE id=$1', [userId]);
}

// ── Rooms ──────────────────────────────────
async function createRoom({ name, subject, maxUsers, cameraRequired, creatorId, creatorName }) {
  const id = 'room_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
  const r  = await pool.query(
    `INSERT INTO rooms (id, name, subject, max_users, camera_required, creator_id, creator_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [id, name, subject, maxUsers, cameraRequired, creatorId, creatorName]
  );
  return r.rows[0];
}

async function getRooms() {
  const r = await pool.query(
    'SELECT * FROM rooms WHERE active=true ORDER BY created_at DESC LIMIT 50'
  );
  return r.rows;
}

async function getRoomByName(name) {
  const r = await pool.query('SELECT * FROM rooms WHERE LOWER(name)=LOWER($1)', [name]);
  return r.rows[0] || null;
}

async function updateRoomCount(roomId, count) {
  await pool.query('UPDATE rooms SET user_count=$2 WHERE id=$1', [roomId, count]);
}

// ── Friends ────────────────────────────────
async function addFriend(userId, friendId) {
  await pool.query(
    'INSERT INTO friends (user_id, friend_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
    [userId, friendId]
  );
  await pool.query(
    'INSERT INTO friends (user_id, friend_id) VALUES ($2,$1) ON CONFLICT DO NOTHING',
    [userId, friendId]
  );
}

async function getFriends(userId) {
  const r = await pool.query(
    `SELECT u.username, u.kiro_id, u.xp_total, u.streak, u.last_seen
     FROM friends f JOIN users u ON f.friend_id=u.id
     WHERE f.user_id=$1`,
    [userId]
  );
  return r.rows;
}

// ── Leaderboard ───────────────────────────
async function getLeaderboard(period = 'daily') {
  const col = period === 'monthly' ? 'xp_monthly' : 'xp_daily';
  const r = await pool.query(
    `SELECT username, kiro_id, ${col} as xp FROM users
     WHERE ${col} > 0 ORDER BY ${col} DESC LIMIT 50`
  );
  return r.rows;
}

// ── Resets ────────────────────────────────
function scheduleDailyReset() {
  setInterval(async () => {
    try {
      await pool.query('UPDATE users SET xp_daily=0');
      // HP decay for users who didn't study
      await pool.query(`
        UPDATE users SET hp=GREATEST(0, hp-10)
        WHERE last_study IS NULL OR last_study < NOW() - INTERVAL '24 hours'
      `);
      console.log('[DB] Daily reset done');
    } catch(e) { console.error('[DB] Daily reset error:', e.message); }
  }, 24 * 60 * 60 * 1000);

  setInterval(async () => {
    try { await pool.query('UPDATE users SET xp_monthly=0'); console.log('[DB] Monthly reset done'); }
    catch(e) { console.error('[DB] Monthly reset error:', e.message); }
  }, 30 * 24 * 60 * 60 * 1000);
}

initDB().catch(err => console.warn('[DB] No PostgreSQL — running without persistence:', err.message));

module.exports = {
  createUser, setUserKiroID, getUserByUsername, getUserByEmail, getUserById,
  updateLastSeen, searchUsers,
  addXP, updateHP, incrementStreak, incrementSessions,
  createRoom, getRooms, getRoomByName, updateRoomCount,
  addFriend, getFriends,
  getLeaderboard,
};
