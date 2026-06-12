const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const http = require('http');
const { WebSocketServer } = require('ws');
const db = require('./db');

const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET === 'kaizen-dev-secret-change-in-prod') {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_SECRET must be set in production.');
    process.exit(1);
  }
  console.warn('WARN: Using dev JWT secret. Set JWT_SECRET env var before deploying.');
}
const JWT_SECRET = SECRET || 'kaizen-dev-secret-' + Math.random();
const PORT = process.env.PORT || 3001;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000').split(',').map(s => s.trim());

const app = express();
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes('*')) return cb(null, true);
    cb(new Error('CORS: origin not allowed'));
  },
  credentials: false,
}));

app.use(express.json({ limit: '256kb' }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: { ok: false, error: 'Too many attempts. Wait 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  message: { ok: false, error: 'Too many requests. Slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const sign = (p) => jwt.sign(p, JWT_SECRET, { expiresIn: '30d' });
const verify = (t) => { try { return jwt.verify(t, JWT_SECRET); } catch { return null; } };

function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ ok: false, error: 'No token' });
  const p = verify(h.slice(7));
  if (!p) return res.status(401).json({ ok: false, error: 'Bad token' });
  req.user = db.getUser(p.userId);
  if (!req.user) return res.status(401).json({ ok: false, error: 'User gone' });
  next();
}

app.get('/health', (req, res) => res.json({ ok: true, users: db.users.size, rooms: db.rooms.size }));

app.post('/api/register', authLimiter, async (req, res) => {
  try {
    const { username, email, password, mode, year, school, major } = req.body;
    if (!username || !email || !password) return res.status(400).json({ ok: false, error: 'Missing fields' });
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) return res.status(400).json({ ok: false, error: 'Username: 3-20 chars' });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ ok: false, error: 'Invalid email' });
    if (password.length < 8) return res.status(400).json({ ok: false, error: 'Password: min 8 chars' });

    const user = await db.createUser({ username, email, password, mode, year, school, major });
    db.applyStreakOnLogin(user);
    db.trackDailyEvent(user.id, 'login');
    const token = sign({ userId: user.id });
    res.json({ ok: true, token, user: publicUser(user) });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.post('/api/login', authLimiter, async (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) return res.status(400).json({ ok: false, error: 'Missing fields' });
  const user = await db.verifyPassword(identifier, password);
  if (!user) return res.status(401).json({ ok: false, error: 'Wrong credentials' });
  db.applyStreakOnLogin(user);
  db.resetPeriodsIfNeeded(user);
  db.trackDailyEvent(user.id, 'login');
  const token = sign({ userId: user.id });
  res.json({ ok: true, token, user: publicUser(user) });
});

app.get('/api/me', auth, (req, res) => {
  db.resetPeriodsIfNeeded(req.user);
  res.json({ ok: true, user: publicUser(req.user) });
});

app.post('/api/prefs', auth, (req, res) => {
  const { theme, dark, status, auto_status, daily_goal_xp, notif_prefs } = req.body;
  db.updateUser(req.user.id, {
    ...(theme !== undefined && { theme }),
    ...(dark !== undefined && { dark }),
    ...(status !== undefined && { status }),
    ...(auto_status !== undefined && { auto_status }),
    ...(daily_goal_xp !== undefined && { daily_goal_xp }),
    ...(notif_prefs !== undefined && { notif_prefs }),
  });
  res.json({ ok: true });
});

app.post('/api/change-password', authLimiter, auth, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    await db.changePassword(req.user.id, oldPassword, newPassword);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.get('/api/rooms', auth, (req, res) => res.json({ ok: true, rooms: db.listRooms() }));

app.post('/api/rooms', writeLimiter, auth, (req, res) => {
  try {
    const { name, subject, maxPeople, cameraRequired, voiceCycle, sessionLength } = req.body;
    const room = db.createRoom({ name, subject, maxPeople, cameraRequired, voiceCycle, sessionLength, ownerId: req.user.id });
    broadcast({ type: 'room:new', room: publicRoom(room) });
    res.json({ ok: true, room: publicRoom(room) });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.get('/api/leaderboard', (req, res) => {
  const period = ['today', 'week', 'month', 'all'].includes(req.query.period) ? req.query.period : 'today';
  res.json({ ok: true, period, board: db.getLeaderboard(period) });
});

app.get('/api/pulse', auth, (req, res) => {
  const user = db.getUser(req.user.id);
  if (!user) return res.status(401).json({ ok: false });
  const now = Date.now();
  const active = [...db.users.values()].filter(u => u.id !== user.id && wsIndex.has(u.id));
  const school_online = active.filter(u => u.school === user.school).length;
  const major_online = active.filter(u => u.major && user.major && u.major.toLowerCase() === user.major.toLowerCase()).length;
  const rooms = db.listRooms().filter(r => r.members > 0).sort((a, b) => b.members - a.members);
  const hotRoom = rooms[0] || null;
  const top3 = db.getLeaderboard('today', 3);
  res.json({ ok: true, school: user.school, major: user.major, school_online, major_online, hotRoom, top3 });
});



app.get('/api/search', auth, (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase();
  if (!q) return res.json({ ok: true, results: [] });
  const results = [...db.users.values()]
    .filter(u => u.id !== req.user.id && (u.username.toLowerCase().includes(q) || u.kzen_id.toLowerCase().includes(q)))
    .slice(0, 10)
    .map(u => ({
      username: u.username, kzenId: u.kzen_id, xp_total: u.xp_total,
      streak: u.streak, status: u.status, online: wsIndex.has(u.id),
    }));
  res.json({ ok: true, results });
});

app.post('/api/friends/:kzenId', writeLimiter, auth, (req, res) => {
  const target = db.getUserByKzenId(req.params.kzenId);
  if (!target) return res.status(404).json({ ok: false, error: 'Not found' });
  if (target.id === req.user.id) return res.status(400).json({ ok: false, error: 'Cannot add yourself' });
  if (!req.user.friends.includes(target.id)) req.user.friends.push(target.id);
  if (!target.friends.includes(req.user.id)) target.friends.push(req.user.id);
  res.json({ ok: true });
});

app.delete('/api/friends/:kzenId', auth, (req, res) => {
  const ok = db.removeFriend(req.user.id, req.params.kzenId);
  res.json({ ok });
});

app.get('/api/friends', auth, (req, res) => {
  const list = req.user.friends
    .map(id => db.getUser(id))
    .filter(Boolean)
    .map(u => ({
      username: u.username, kzenId: u.kzen_id,
      xp_total: u.xp_total, xp_daily: u.xp_daily,
      streak: u.streak, status: u.status, online: wsIndex.has(u.id),
    }));
  res.json({ ok: true, friends: list });
});

app.get('/api/todos', auth, (req, res) => res.json({ ok: true, todos: db.getTodos(req.user.id) }));

app.post('/api/todos', writeLimiter, auth, (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ ok: false, error: 'Text required' });
  if (text.length > 140) return res.status(400).json({ ok: false, error: 'Too long' });
  const t = db.addTodo(req.user.id, text.trim());
  res.json({ ok: true, todo: t });
});

app.patch('/api/todos/:id', auth, (req, res) => {
  const r = db.toggleTodo(req.user.id, req.params.id, !!req.body.inSession);
  if (!r) return res.status(404).json({ ok: false });
  res.json({ ok: true, ...r });
});

app.delete('/api/todos/:id', auth, (req, res) => {
  db.deleteTodo(req.user.id, req.params.id);
  res.json({ ok: true });
});

app.get('/api/daily', auth, (req, res) => {
  const log = db.dailyTasksFor(req.user.id);
  const rewards = db.pullRewards(req.user.id);
  res.json({ ok: true, tasks: log.tasks, rewards });
});

function publicUser(u) {
  return {
    id: u.id, username: u.username, email: u.email,
    kzenId: u.kzen_id, mode: u.mode, year: u.year, school: u.school, major: u.major,
    xp_total: u.xp_total, xp_daily: u.xp_daily, xp_weekly: u.xp_weekly, xp_monthly: u.xp_monthly,
    streak: u.streak, streak_freezes: u.streak_freezes,
    sessions: u.sessions, battles_won: u.battles_won,
    theme: u.theme, dark: u.dark, status: u.status, auto_status: u.auto_status,
    daily_goal_xp: u.daily_goal_xp, notif_prefs: u.notif_prefs,
  };
}

function publicRoom(r) {
  return {
    id: r.id, name: r.name, subject: r.subject, maxPeople: r.maxPeople,
    cameraRequired: r.cameraRequired, voiceCycle: r.voiceCycle, voicePhase: r.voicePhase,
    members: r.members.size,
    sessionLength: r.sessionLength,
    sessionStart: r.sessionStart,
    sessionEnd: r.sessionEnd,
    remaining: Math.max(0, r.sessionEnd - Date.now()),
  };
}

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });
const wsIndex = new Map();
const xpTracker = new Map();

function broadcast(msg, except) {
  const s = JSON.stringify(msg);
  wss.clients.forEach(c => { if (c.readyState === 1 && c !== except) c.send(s); });
}
function sendTo(userId, msg) {
  const c = wsIndex.get(userId);
  if (c && c.readyState === 1) c.send(JSON.stringify(msg));
}
function broadcastRoom(roomId, msg, except) {
  const room = db.getRoom(roomId);
  if (!room) return;
  const s = JSON.stringify(msg);
  room.members.forEach(uid => {
    const c = wsIndex.get(uid);
    if (c && c !== except && c.readyState === 1) c.send(s);
  });
}

function notifyFriendsStatus(user) {
  user.friends.forEach(fid => sendTo(fid, { type: 'friend:status', kzenId: user.kzen_id, status: user.status, online: true }));
}

setInterval(() => {
  const now = Date.now();
  db.users.forEach(u => {
    if (!u.auto_status) return;
    if (!wsIndex.has(u.id)) {
      if (u.status !== 'away') { u.status = 'away'; notifyFriendsStatus(u); }
      return;
    }
    const sess = db.sessions.get(u.id);
    if (sess) {
      const newStatus = sess.onBreak ? 'break' : 'focus';
      if (u.status !== newStatus) { u.status = newStatus; notifyFriendsStatus(u); }
    } else {
      const idleFor = now - u.last_ping;
      const goalMet = u.xp_daily >= u.daily_goal_xp;
      const newStatus = goalMet ? 'done' : (idleFor > 120000 ? 'break' : 'focus');
      if (u.status !== newStatus) { u.status = newStatus; notifyFriendsStatus(u); }
    }
  });
}, 15000);

setInterval(() => {
  const now = Date.now();
  db.rooms.forEach(room => {
    if (now >= room.sessionEnd) {
      room.sessionStart = now;
      room.sessionEnd = now + room.sessionLength * 60 * 1000;
      room.phaseStart = now;
      room.voicePhase = 'focus';
      broadcastRoom(room.id, {
        type: 'room:session_restart',
        roomId: room.id,
        sessionStart: room.sessionStart,
        sessionEnd: room.sessionEnd,
      });
      broadcast({ type: 'room:update', room: publicRoom(room) });
      return;
    }

    const [focusMin, breakMin] = room.voiceCycle.split('-').map(Number);
    const elapsed = (now - room.phaseStart) / 60000;
    if (room.voicePhase === 'focus' && elapsed >= focusMin) {
      room.voicePhase = 'break';
      room.phaseStart = now;
      broadcastRoom(room.id, { type: 'room:phase', roomId: room.id, phase: 'break' });
    } else if (room.voicePhase === 'break' && elapsed >= breakMin) {
      room.voicePhase = 'focus';
      room.phaseStart = now;
      broadcastRoom(room.id, { type: 'room:phase', roomId: room.id, phase: 'focus' });
    }
  });
}, 5000);

setInterval(() => {
  db.rooms.forEach(room => {
    if (room.members.size === 0) return;
    const presence = [];
    room.members.forEach(uid => {
      const u = db.getUser(uid);
      if (!u) return;
      const p = room.presence.get(uid) || {};
      presence.push({
        userId: uid,
        username: u.username,
        kzenId: u.kzen_id,
        status: u.status,
        sessionXp: p.sessionXp || 0,
        camera: !!p.camera,
        distracted: !!p.distracted,
      });
    });
    broadcastRoom(room.id, { type: 'room:presence', roomId: room.id, presence });
  });
}, 2000);

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://x');
  const token = url.searchParams.get('token');
  const p = token ? verify(token) : null;
  const user = p ? db.getUser(p.userId) : null;

  if (!user) {
    ws.send(JSON.stringify({ type: 'auth:fail' }));
    ws.close();
    return;
  }

  ws.userId = user.id;
  wsIndex.set(user.id, ws);
  user.last_ping = Date.now();
  ws.send(JSON.stringify({ type: 'auth:ok', user: publicUser(user) }));
  user.friends.forEach(fid => sendTo(fid, { type: 'friend:online', kzenId: user.kzen_id }));

  ws.on('message', (raw) => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    user.last_ping = Date.now();
    handleMessage(ws, user, msg);
  });

  ws.on('close', () => {
    wsIndex.delete(user.id);
    db.rooms.forEach(r => {
      if (r.members.has(user.id)) {
        r.members.delete(user.id);
        r.presence.delete(user.id);
        broadcastRoom(r.id, { type: 'room:leave', roomId: r.id, userId: user.id, username: user.username });
      }
    });
    if (user.auto_status) { user.status = 'away'; notifyFriendsStatus(user); }
    user.friends.forEach(fid => sendTo(fid, { type: 'friend:offline', kzenId: user.kzen_id }));
    db.battles.forEach((b, id) => {
      if (b.players.includes(user.id) && b.status === 'active') endBattle(id, user.id);
    });
  });
});

function handleMessage(ws, user, msg) {
  switch (msg.type) {
    case 'room:join':         return joinRoom(ws, user, msg.roomId);
    case 'room:leave':        return leaveRoom(ws, user, msg.roomId);
    case 'room:presence':     return updatePresence(user, msg);
    case 'xp:tick':           return handleXpTick(user, msg);
    case 'session:start':     return startSession(user, msg);
    case 'session:end':       return endSession(user, msg);
    case 'session:method':    return methodDone(user, msg);
    case 'status:set':        return setStatus(user, msg.status);
    case 'battle:challenge':  return challengeBattle(user, msg);
    case 'battle:accept':     return acceptBattle(user, msg.battleId);
    case 'battle:decline':    return declineBattle(user, msg.battleId);
    case 'battle:xp':         return battleXp(user, msg);
    case 'battle:forfeit':    return forfeitBattle(user, msg.battleId);
    case 'rtc:offer':
    case 'rtc:answer':
    case 'rtc:ice':           return relayRtc(user, msg);
    case 'ping':              return;
  }
}

function relayRtc(user, msg) {
  if (!msg.roomId || !msg.to) return;
  const room = db.getRoom(msg.roomId);
  if (!room) return;
  if (!room.members.has(user.id) || !room.members.has(msg.to)) return;
  const target = db.getUser(msg.to);
  if (!target) return;
  const targetWs = wsIndex.get(target.id);
  if (!targetWs || targetWs.readyState !== 1) return;
  const payloadStr = JSON.stringify(msg.payload || {});
  if (payloadStr.length > 32000) return;
  targetWs.send(JSON.stringify({
    type: msg.type,
    from: user.id,
    fromUsername: user.username,
    roomId: msg.roomId,
    payload: msg.payload,
  }));
}

function updatePresence(user, msg) {
  const room = db.getRoom(msg.roomId);
  if (!room || !room.members.has(user.id)) return;
  const prev = room.presence.get(user.id) || {};
  room.presence.set(user.id, {
    ...prev,
    sessionXp: msg.sessionXp || prev.sessionXp || 0,
    camera: msg.camera !== undefined ? !!msg.camera : prev.camera,
    distracted: msg.distracted !== undefined ? !!msg.distracted : prev.distracted,
  });
}

function joinRoom(ws, user, roomId) {
  const room = db.getRoom(roomId);
  if (!room) return ws.send(JSON.stringify({ type: 'error', error: 'Room not found' }));
  if (room.members.size >= room.maxPeople) return ws.send(JSON.stringify({ type: 'error', error: 'Room full' }));

  const wasEmpty = room.members.size === 0;
  room.members.add(user.id);
  room.presence.set(user.id, { sessionXp: 0, camera: false, distracted: false });

  const members = [...room.members].map(id => {
    const u = db.getUser(id);
    return { userId: id, username: u.username, kzenId: u.kzen_id, status: u.status };
  });

  ws.send(JSON.stringify({
    type: 'room:joined',
    room: publicRoom(room),
    members,
    phaseStart: room.phaseStart,
    sessionStart: room.sessionStart,
    sessionEnd: room.sessionEnd,
    peers: members.filter(m => m.userId !== user.id).map(m => m.userId),
  }));
  broadcastRoom(roomId, {
    type: 'room:join',
    roomId,
    user: { userId: user.id, username: user.username, kzenId: user.kzen_id, status: user.status },
  }, ws);
  broadcast({ type: 'room:update', room: publicRoom(room) });
  if (!wasEmpty) db.trackDailyEvent(user.id, 'room_joined_with_others');
}

function leaveRoom(ws, user, roomId) {
  const room = db.getRoom(roomId);
  if (!room) return;
  room.members.delete(user.id);
  room.presence.delete(user.id);
  broadcastRoom(roomId, { type: 'room:leave', roomId, userId: user.id, username: user.username });
  broadcast({ type: 'room:update', room: publicRoom(room) });
  if (room.members.size === 0 && room.ownerId === user.id) {
    db.deleteRoom(roomId);
    broadcast({ type: 'room:delete', roomId });
  }
}

function handleXpTick(user, msg) {
  const amount = Math.min(3, Math.max(0, Math.floor(msg.amount || 0)));
  const now = Date.now();
  const last = xpTracker.get(user.id) || 0;
  if (now - last < 800) return;
  xpTracker.set(user.id, now);
  db.addXp(user, amount);
  const sess = db.sessions.get(user.id);
  if (sess && sess.roomId) sess.roomXpEarned += amount;
  db.trackDailyEvent(user.id, 'xp_check');
  sendTo(user.id, { type: 'xp:update', xp_total: user.xp_total, xp_daily: user.xp_daily });
  const rewards = db.pullRewards(user.id);
  if (rewards.length) sendTo(user.id, { type: 'daily:reward', rewards });
}

function startSession(user, msg) {
  db.sessions.set(user.id, {
    start: Date.now(), cameraSeconds: 0, cameraDistractedSec: 0,
    methodsCompleted: 0, onBreak: false, subject: msg.subject || null,
    soloCommit: msg.soloCommit || 0,
    roomId: msg.roomId || null,
    roomJoinedAt: msg.roomId ? Date.now() : null,
    roomXpEarned: 0,
  });
  user.sessions += 1;
  db.trackDailyEvent(user.id, 'session_start');
}

function endSession(user, msg) {
  const s = db.sessions.get(user.id);
  if (!s) return;
  const duration = Math.floor((Date.now() - s.start) / 60000);
  db.trackDailyEvent(user.id, 'session_end', {
    duration, camSeconds: msg.camSeconds || s.cameraSeconds,
    camDistractedSec: msg.camDistractedSec || 0, subject: s.subject,
  });

  if (s.soloCommit > 0 && duration >= s.soloCommit) {
    db.trackDailyEvent(user.id, 'solo_commit_done', { duration });
  }

  if (s.roomId) {
    const room = db.getRoom(s.roomId);
    if (room) {
      const roomSessionMinsLeft = (room.sessionEnd - Date.now()) / 60000;
      if (roomSessionMinsLeft > 1 && s.roomXpEarned > 0) {
        const penalty = Math.floor(s.roomXpEarned / 2);
        user.xp_total = Math.max(0, user.xp_total - penalty);
        user.xp_daily = Math.max(0, user.xp_daily - penalty);
        user.xp_weekly = Math.max(0, user.xp_weekly - penalty);
        user.xp_monthly = Math.max(0, user.xp_monthly - penalty);
        sendTo(user.id, {
          type: 'room:penalty',
          penalty,
          reason: `left the room early · lost half of the ${s.roomXpEarned} xp earned there`,
        });
        sendTo(user.id, { type: 'xp:update', xp_total: user.xp_total, xp_daily: user.xp_daily });
      }
    }
  }

  sendTo(user.id, { type: 'session:end', duration, xp_gained: msg.xp_gained || 0 });
  const rewards = db.pullRewards(user.id);
  if (rewards.length) sendTo(user.id, { type: 'daily:reward', rewards });
  db.sessions.delete(user.id);
}

function methodDone(user, msg) {
  db.trackDailyEvent(user.id, 'method_done');
  const rewards = db.pullRewards(user.id);
  if (rewards.length) sendTo(user.id, { type: 'daily:reward', rewards });
}

function setStatus(user, status) {
  if (!['focus', 'break', 'done', 'away'].includes(status)) return;
  user.status = status;
  user.auto_status = false;
  notifyFriendsStatus(user);
  db.rooms.forEach(r => {
    if (r.members.has(user.id)) broadcastRoom(r.id, { type: 'room:status', userId: user.id, status });
  });
}

function challengeBattle(user, msg) {
  const target = db.getUserByKzenId(msg.kzenId) || db.getUserByUsername(msg.kzenId);
  if (!target) return sendTo(user.id, { type: 'battle:fail', error: 'Player not found' });
  if (target.id === user.id) return sendTo(user.id, { type: 'battle:fail', error: 'Cannot challenge yourself' });
  if (!wsIndex.has(target.id)) return sendTo(user.id, { type: 'battle:fail', error: 'Player offline' });

  const duration = [25, 50, 120].includes(msg.duration) ? msg.duration : 25;
  const battleId = db.genId('b_');
  const battle = {
    id: battleId, players: [user.id, target.id], duration,
    status: 'pending', xp: { [user.id]: 0, [target.id]: 0 },
    start: null, end: null, challenger: user.id,
  };
  db.battles.set(battleId, battle);

  sendTo(target.id, {
    type: 'battle:invite', battleId,
    from: { username: user.username, kzenId: user.kzen_id }, duration,
  });
  sendTo(user.id, { type: 'battle:sent', battleId, target: target.username });
}

function acceptBattle(user, battleId) {
  const b = db.battles.get(battleId);
  if (!b || b.status !== 'pending' || !b.players.includes(user.id)) return;
  b.status = 'active';
  b.start = Date.now();
  b.end = b.start + b.duration * 60 * 1000;

  b.players.forEach(pid => {
    db.trackDailyEvent(pid, 'duel_start');
    sendTo(pid, {
      type: 'battle:start', battleId, duration: b.duration,
      opponent: b.players.filter(x => x !== pid).map(x => {
        const o = db.getUser(x);
        return { username: o.username, kzenId: o.kzen_id };
      })[0],
    });
  });

  setTimeout(() => {
    if (db.battles.get(battleId)?.status === 'active') endBattle(battleId);
  }, b.duration * 60 * 1000 + 500);
}

function declineBattle(user, battleId) {
  const b = db.battles.get(battleId);
  if (!b) return;
  b.players.forEach(pid => sendTo(pid, { type: 'battle:declined', battleId }));
  db.battles.delete(battleId);
}

function battleXp(user, msg) {
  const b = db.battles.get(msg.battleId);
  if (!b || b.status !== 'active' || !b.players.includes(user.id)) return;
  const amt = Math.min(3, Math.max(0, Math.floor(msg.amount || 0)));
  b.xp[user.id] = (b.xp[user.id] || 0) + amt;
  b.players.forEach(pid => sendTo(pid, { type: 'battle:tick', battleId: b.id, xp: b.xp }));
}

function forfeitBattle(user, battleId) { endBattle(battleId, user.id); }

function endBattle(battleId, forfeiterId) {
  const b = db.battles.get(battleId);
  if (!b || b.status !== 'active') return;
  b.status = 'done';

  let winnerId, loserId;
  if (forfeiterId) {
    loserId = forfeiterId;
    winnerId = b.players.find(p => p !== forfeiterId);
  } else {
    const [a, c] = b.players;
    winnerId = b.xp[a] >= b.xp[c] ? a : c;
    loserId = b.players.find(p => p !== winnerId);
  }

  const winner = db.getUser(winnerId);
  const pot = (b.xp[winnerId] || 0) + (b.xp[loserId] || 0);

  if (winner) {
    db.addXp(winner, b.xp[loserId] || 0);
    winner.battles_won += 1;
    db.trackDailyEvent(winnerId, 'duel_win');
  }

  b.players.forEach(pid => {
    sendTo(pid, {
      type: 'battle:end', battleId,
      winner: winner ? winner.username : null,
      forfeit: !!forfeiterId, xp: b.xp, pot,
    });
  });

  db.battles.delete(battleId);
}

server.listen(PORT, () => {
  console.log('');
  console.log('  kaizen v2.01  ·  port ' + PORT);
  console.log('  http api   ready');
  console.log('  ws /ws     ready');
  console.log('');
});
