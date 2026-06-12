/* ═══════════════════════════════════════════════
   KIRO — Backend Server
   Express (REST API) + WebSocket (real-time)
   Port 3001
   ═══════════════════════════════════════════════ */

const express    = require('express');
const http       = require('http');
const WebSocket  = require('ws');
const cors       = require('cors');
const db         = require('./db');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3001;

// ─────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────
app.use(cors({ origin: '*' }));  // In production: restrict to your domain
app.use(express.json());

// ─────────────────────────────────────────────
// IN-MEMORY ROOM STATE
// rooms = { roomId: Map<ws, { username, xp, focusing }> }
// ─────────────────────────────────────────────
const rooms = {};

function getRoomClients(roomId) {
  if (!rooms[roomId]) rooms[roomId] = new Map();
  return rooms[roomId];
}

function broadcastToRoom(roomId, message, exceptWs = null) {
  const clients = getRoomClients(roomId);
  const payload = JSON.stringify(message);
  clients.forEach((data, ws) => {
    if (ws !== exceptWs && ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  });
}

function broadcastRoomUsers(roomId) {
  const clients = getRoomClients(roomId);
  const users = [];
  clients.forEach((data) => {
    users.push({ username: data.username, xp: data.xp, focusing: data.focusing });
  });

  broadcastToRoom(roomId, {
    type: 'room_users',
    users,
    count: users.length,
  });
}

// Total live count across all rooms
function getTotalLiveCount() {
  let total = 0;
  Object.values(rooms).forEach(clients => { total += clients.size; });
  return total;
}

function broadcastLiveCount() {
  const count = getTotalLiveCount();
  wss.clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'live_count', count }));
    }
  });
}

// ─────────────────────────────────────────────
// RATE LIMITING (simple in-memory)
// ─────────────────────────────────────────────
const rateLimits = new Map(); // ws → { count, resetAt }

function isRateLimited(ws) {
  const now = Date.now();
  let record = rateLimits.get(ws);

  if (!record || now > record.resetAt) {
    record = { count: 0, resetAt: now + 1000 }; // 1 second window
    rateLimits.set(ws, record);
  }

  record.count++;
  return record.count > 20; // max 20 messages/second
}

// ─────────────────────────────────────────────
// WEBSOCKET HANDLER
// ─────────────────────────────────────────────
wss.on('connection', (ws, req) => {
  console.log(`[WS] New connection from ${req.socket.remoteAddress}`);

  let userRoomId  = null;
  let userSession = { username: 'Anonymous', xp: 0, focusing: false };

  ws.on('message', (raw) => {
    // Rate limit check
    if (isRateLimited(ws)) {
      ws.send(JSON.stringify({ type: 'error', message: 'Rate limited — slow down' }));
      return;
    }

    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      return;
    }

    switch (msg.type) {

      case 'join': {
        // Validate
        if (!msg.room || !msg.username) return;
        const username = String(msg.username).slice(0, 20).trim();
        if (!username) return;

        userRoomId = String(msg.room).slice(0, 30);
        userSession = { username, xp: 0, focusing: false };

        const clients = getRoomClients(userRoomId);
        clients.set(ws, userSession);

        console.log(`[WS] ${username} joined room: ${userRoomId}`);
        broadcastRoomUsers(userRoomId);
        broadcastLiveCount();

        // Persist user to DB (fire and forget)
        db.upsertUser(username).catch(console.error);
        break;
      }

      case 'xp_update': {
        if (!userRoomId) return;
        const xp = parseInt(msg.xp) || 0;
        if (xp < 0 || xp > 999999) return; // sanity check

        userSession.xp = xp;
        const clients = getRoomClients(userRoomId);
        clients.set(ws, userSession);

        // Broadcast updated user list every 5 XP to avoid spam
        if (xp % 5 === 0) {
          broadcastRoomUsers(userRoomId);
        }

        // Persist XP to DB every 30 XP
        if (xp % 30 === 0) {
          db.updateXP(userSession.username, xp).catch(console.error);
        }
        break;
      }

      case 'focus_status': {
        if (!userRoomId) return;
        userSession.focusing = !!msg.focusing;
        const clients = getRoomClients(userRoomId);
        clients.set(ws, userSession);
        broadcastRoomUsers(userRoomId);
        break;
      }

      default:
        break;
    }
  });

  ws.on('close', () => {
    if (userRoomId) {
      const clients = getRoomClients(userRoomId);
      clients.delete(ws);
      console.log(`[WS] ${userSession.username} left room: ${userRoomId}`);

      // Save final XP
      if (userSession.xp > 0) {
        db.updateXP(userSession.username, userSession.xp).catch(console.error);
      }

      broadcastRoomUsers(userRoomId);
      broadcastLiveCount();

      // Cleanup empty rooms
      if (clients.size === 0) delete rooms[userRoomId];
    }
    rateLimits.delete(ws);
  });

  ws.on('error', (err) => {
    console.error('[WS] Error:', err.message);
  });
});

// ─────────────────────────────────────────────
// REST API ROUTES
// ─────────────────────────────────────────────

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', liveUsers: getTotalLiveCount() });
});

// Get leaderboard
app.get('/api/leaderboard', async (req, res) => {
  const period = req.query.period === 'monthly' ? 'monthly' : 'daily';
  try {
    const rows = await db.getLeaderboard(period);
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'DB error' });
  }
});

// Get room stats
app.get('/api/rooms', (req, res) => {
  const stats = Object.entries(rooms).map(([id, clients]) => ({
    id,
    userCount: clients.size,
  }));
  res.json({ ok: true, data: stats });
});

// Update user XP (called from client on session end)
app.post('/api/xp', async (req, res) => {
  const { username, xp } = req.body;
  if (!username || typeof xp !== 'number') {
    return res.status(400).json({ ok: false, error: 'username and xp required' });
  }
  try {
    await db.updateXP(username, xp);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'DB error' });
  }
});

// ─────────────────────────────────────────────
// START
// ─────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════╗
  ║   KIRO Backend  — Port ${PORT}       ║
  ║   WebSocket + REST API ready      ║
  ╚═══════════════════════════════════╝
  `);
});
