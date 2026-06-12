/* ═══════════════════════════════════════════
   KIRO v3 — backend/src/index.js
   Express + WebSocket + bcrypt + JWT
   Real room sync, real auth, XP validation
   ═══════════════════════════════════════════ */
const express   = require('express');
const http      = require('http');
const WebSocket = require('ws');
const cors      = require('cors');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const db        = require('./db');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });
const PORT   = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'kiro-dev-secret-change-in-prod';

app.use(cors({ origin: '*' }));
app.use(express.json());

// ── In-memory room state ───────────────────
// rooms[roomId] = Map<ws, { userId, username, xp, focusing, cameraOn }>
const rooms = {};

function getRoomClients(roomId) {
  if (!rooms[roomId]) rooms[roomId] = new Map();
  return rooms[roomId];
}

function roomUserList(roomId) {
  const clients = getRoomClients(roomId);
  const list = [];
  clients.forEach(data => list.push({
    username: data.username,
    xp: data.xp,
    focusing: data.focusing,
    cameraOn: data.cameraOn,
    status: data.status || 'focus',
  }));
  return list;
}

function broadcastToRoom(roomId, msg, except = null) {
  const payload = JSON.stringify(msg);
  getRoomClients(roomId).forEach((_, ws) => {
    if (ws !== except && ws.readyState === WebSocket.OPEN) ws.send(payload);
  });
}

function broadcastRoomUpdate(roomId) {
  const users = roomUserList(roomId);
  const count = users.length;
  // Update room count in DB
  db.updateRoomCount(roomId, count).catch(() => {});
  broadcastToRoom(roomId, { type: 'room_users', users, count });
  // Also broadcast to lobby so room cards update live
  broadcastLobby({ type: 'room_count_update', roomId, count });
}

// Lobby: all connected ws not in a room
const lobbyClients = new Set();

function broadcastLobby(msg) {
  const payload = JSON.stringify(msg);
  lobbyClients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(payload);
  });
}

function totalLive() {
  let n = 0;
  Object.values(rooms).forEach(m => { n += m.size; });
  n += lobbyClients.size;
  return n;
}

function broadcastLiveCount() {
  const count = totalLive();
  const payload = JSON.stringify({ type: 'live_count', count });
  wss.clients.forEach(ws => { if (ws.readyState === WebSocket.OPEN) ws.send(payload); });
}

// ── Rate limiter ───────────────────────────
const rateLimits = new Map();
function isRateLimited(ws) {
  const now = Date.now();
  let r = rateLimits.get(ws);
  if (!r || now > r.reset) { r = { count: 0, reset: now + 1000 }; rateLimits.set(ws, r); }
  return ++r.count > 30;
}

// ── XP validation ──────────────────────────
// Max XP/sec is 2.4 (2x mult × 1.2 camera) — we allow 3 for clock drift
const MAX_XP_PER_SEC = 3;
function validateXP(reported, elapsed) {
  return reported <= elapsed * MAX_XP_PER_SEC + 10; // +10 tolerance
}

// ── WebSocket ──────────────────────────────
wss.on('connection', (ws, req) => {
  let session = { userId: null, username: null, roomId: null, joinedAt: Date.now(), lastXp: 0 };
  lobbyClients.add(ws);
  broadcastLiveCount();

  ws.on('message', raw => {
    if (isRateLimited(ws)) return;
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {

      case 'auth': {
        // Client sends JWT on connect
        try {
          const payload = jwt.verify(msg.token, JWT_SECRET);
          session.userId   = payload.userId;
          session.username = payload.username;
          ws.send(JSON.stringify({ type: 'auth_ok', username: session.username }));
        } catch {
          ws.send(JSON.stringify({ type: 'auth_fail' }));
        }
        break;
      }

      case 'join_room': {
        if (!session.username) return;
        const roomId = String(msg.roomId).slice(0, 40);

        // Leave previous room
        if (session.roomId) {
          getRoomClients(session.roomId).delete(ws);
          broadcastRoomUpdate(session.roomId);
        }
        lobbyClients.delete(ws);

        session.roomId  = roomId;
        session.lastXp  = 0;
        session.joinedAt= Date.now();

        getRoomClients(roomId).set(ws, {
          userId:   session.userId,
          username: session.username,
          xp:       0,
          focusing: false,
          cameraOn: false,
          status:   'idle',
        });

        broadcastRoomUpdate(roomId);
        broadcastLiveCount();

        // Send current room state to joiner
        ws.send(JSON.stringify({ type: 'room_joined', users: roomUserList(roomId) }));
        break;
      }

      case 'xp_update': {
        if (!session.roomId || !session.username) return;
        const xp      = parseInt(msg.xp) || 0;
        const elapsed = (Date.now() - session.joinedAt) / 1000;

        if (!validateXP(xp, elapsed)) {
          ws.send(JSON.stringify({ type: 'xp_invalid', message: 'XP rate too high' }));
          return;
        }

        session.lastXp = xp;
        const clients = getRoomClients(session.roomId);
        const data    = clients.get(ws);
        if (data) { data.xp = xp; clients.set(ws, data); }

        // Broadcast every 5 XP to reduce traffic
        if (xp % 5 === 0) broadcastRoomUpdate(session.roomId);
        break;
      }

      case 'focus_status': {
        if (!session.roomId) return;
        const clients = getRoomClients(session.roomId);
        const data    = clients.get(ws);
        if (data) {
          data.focusing = !!msg.focusing;
          data.cameraOn = !!msg.cameraOn;
          data.status   = msg.status || 'idle';
          clients.set(ws, data);
        }
        broadcastRoomUpdate(session.roomId);
        break;
      }

      case 'leave_room': {
        if (session.roomId) {
          // Save final XP
          if (session.lastXp > 0 && session.userId) {
            db.addXP(session.userId, session.lastXp).catch(() => {});
          }
          getRoomClients(session.roomId).delete(ws);
          broadcastRoomUpdate(session.roomId);
          session.roomId = null;
        }
        lobbyClients.add(ws);
        broadcastLiveCount();
        break;
      }

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;
    }
  });

  ws.on('close', () => {
    if (session.roomId) {
      if (session.lastXp > 0 && session.userId) {
        db.addXP(session.userId, session.lastXp).catch(() => {});
      }
      getRoomClients(session.roomId).delete(ws);
      broadcastRoomUpdate(session.roomId);
    }
    lobbyClients.delete(ws);
    rateLimits.delete(ws);
    broadcastLiveCount();
  });

  ws.on('error', () => {});
});

// ── Auth middleware ────────────────────────
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ ok: false, error: 'No token' });
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ ok: false, error: 'Invalid token' });
  }
}

// ── REST: Auth ─────────────────────────────
app.post('/api/register', async (req, res) => {
  const { username, email, password, mode, year, school, major } = req.body;
  if (!username || !email || !password) return res.status(400).json({ ok: false, error: 'Missing fields' });
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) return res.status(400).json({ ok: false, error: 'Invalid username' });
  if (password.length < 8) return res.status(400).json({ ok: false, error: 'Password too short' });

  try {
    const existing = await db.getUserByUsername(username);
    if (existing) return res.status(409).json({ ok: false, error: 'Username taken' });

    const existingEmail = await db.getUserByEmail(email);
    if (existingEmail) return res.status(409).json({ ok: false, error: 'Email already registered' });

    const hash   = await bcrypt.hash(password, 12);
    const userId = await db.createUser({ username, email, hash, mode: mode||'student', year: year||'freshman', school: school||'SSE', major: major||'' });
    const userID = `KIRO#${String(userId).padStart(4, '0')}`;
    await db.setUserKiroID(userId, userID);

    const token = jwt.sign({ userId, username, userID }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ ok: true, token, username, userID, userId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) return res.status(400).json({ ok: false, error: 'Missing fields' });

  try {
    const user = await db.getUserByUsername(identifier) || await db.getUserByEmail(identifier);
    if (!user) return res.status(401).json({ ok: false, error: 'Account not found' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ ok: false, error: 'Wrong password' });

    await db.updateLastSeen(user.id);
    const token = jwt.sign({ userId: user.id, username: user.username, userID: user.kiro_id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ ok: true, token, username: user.username, userID: user.kiro_id, userId: user.id, mode: user.mode, year: user.year, school: user.school, major: user.major });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

app.get('/api/me', requireAuth, async (req, res) => {
  try {
    const user = await db.getUserById(req.user.userId);
    if (!user) return res.status(404).json({ ok: false, error: 'Not found' });
    res.json({ ok: true, user: { username: user.username, userID: user.kiro_id, xp_total: user.xp_total, xp_daily: user.xp_daily, hp: user.hp, streak: user.streak, sessions: user.sessions, mode: user.mode, year: user.year, school: user.school, major: user.major } });
  } catch { res.status(500).json({ ok: false, error: 'Server error' }); }
});

// ── REST: Rooms ────────────────────────────
app.get('/api/rooms', async (req, res) => {
  try {
    const dbRooms = await db.getRooms();
    const enriched = dbRooms.map(r => ({
      ...r,
      users: getRoomClients(r.id).size,
    }));
    res.json({ ok: true, rooms: enriched });
  } catch { res.status(500).json({ ok: false, error: 'Server error' }); }
});

app.post('/api/rooms', requireAuth, async (req, res) => {
  const { name, subject, maxUsers, cameraRequired } = req.body;
  if (!name || !subject) return res.status(400).json({ ok: false, error: 'Name and subject required' });
  if (name.length > 40) return res.status(400).json({ ok: false, error: 'Name too long' });
  const max = Math.min(20, Math.max(2, parseInt(maxUsers) || 10));

  try {
    const existing = await db.getRoomByName(name);
    if (existing) return res.status(409).json({ ok: false, error: 'Room name already taken — choose another' });

    const room = await db.createRoom({ name, subject, maxUsers: max, cameraRequired: !!cameraRequired, creatorId: req.user.userId, creatorName: req.user.username });
    broadcastLobby({ type: 'new_room', room: { ...room, users: 0 } });
    res.json({ ok: true, room });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// ── REST: Leaderboard ─────────────────────
app.get('/api/leaderboard', async (req, res) => {
  const period = req.query.period === 'monthly' ? 'monthly' : 'daily';
  try {
    const rows = await db.getLeaderboard(period);
    res.json({ ok: true, data: rows });
  } catch { res.status(500).json({ ok: false, error: 'Server error' }); }
});

// ── REST: Friends ──────────────────────────
app.get('/api/users/search', requireAuth, async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.status(400).json({ ok: false, error: 'Query too short' });
  try {
    const users = await db.searchUsers(q);
    res.json({ ok: true, users });
  } catch { res.status(500).json({ ok: false, error: 'Server error' }); }
});

app.post('/api/friends', requireAuth, async (req, res) => {
  const { friendId } = req.body;
  try {
    await db.addFriend(req.user.userId, friendId);
    res.json({ ok: true });
  } catch { res.status(500).json({ ok: false, error: 'Server error' }); }
});

app.get('/api/friends', requireAuth, async (req, res) => {
  try {
    const friends = await db.getFriends(req.user.userId);
    res.json({ ok: true, friends });
  } catch { res.status(500).json({ ok: false, error: 'Server error' }); }
});

// ── REST: XP / HP ─────────────────────────
app.post('/api/xp', requireAuth, async (req, res) => {
  const { xp } = req.body;
  if (typeof xp !== 'number' || xp < 0 || xp > 10000) return res.status(400).json({ ok: false, error: 'Invalid XP' });
  try {
    await db.addXP(req.user.userId, xp);
    res.json({ ok: true });
  } catch { res.status(500).json({ ok: false, error: 'Server error' }); }
});

app.post('/api/hp', requireAuth, async (req, res) => {
  const { hp } = req.body;
  if (typeof hp !== 'number') return res.status(400).json({ ok: false, error: 'Invalid HP' });
  try {
    await db.updateHP(req.user.userId, Math.max(0, Math.min(100, hp)));
    res.json({ ok: true });
  } catch { res.status(500).json({ ok: false, error: 'Server error' }); }
});

app.get('/health', (req, res) => res.json({ ok: true, live: totalLive() }));

server.listen(PORT, () => {
  console.log(`\n  ╔══════════════════════════════╗`);
  console.log(`  ║  KIRO v3 — Port ${PORT}          ║`);
  console.log(`  ║  Real auth + WS rooms ready  ║`);
  console.log(`  ╚══════════════════════════════╝\n`);
});
