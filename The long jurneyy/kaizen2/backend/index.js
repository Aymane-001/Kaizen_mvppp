const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const http = require('http');
const { WebSocketServer } = require('ws');
const db = require('./db');

const SECRET = process.env.JWT_SECRET || 'kaizen-dev-secret-change-in-prod';
const PORT = process.env.PORT || 3001;

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const sign = (p) => jwt.sign(p, SECRET, { expiresIn: '30d' });
const verify = (t) => { try { return jwt.verify(t, SECRET); } catch { return null; } };

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

app.post('/api/register', async (req, res) => {
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

app.post('/api/login', async (req, res) => {
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

app.post('/api/change-password', auth, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    await db.changePassword(req.user.id, oldPassword, newPassword);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.get('/api/rooms', auth, (req, res) => res.json({ ok: true, rooms: db.listRooms() }));

app.post('/api/rooms', auth, (req, res) => {
  try {
    const { name, subject, maxPeople, cameraRequired, voiceCycle } = req.body;
    const room = db.createRoom({ name, subject, maxPeople, cameraRequired, voiceCycle, ownerId: req.user.id });
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

app.post('/api/friends/:kzenId', auth, (req, res) => {
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

app.post('/api/todos', auth, (req, res) => {
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
  };
}

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
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
  db.rooms.forEach(room => {
    const [focusMin, breakMin] = room.voiceCycle.split('-').map(Number);
    const now = Date.now();
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
}, 10000);

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
    case 'ping':              return;
  }
}

function joinRoom(ws, user, roomId) {
  const room = db.getRoom(roomId);
  if (!room) return ws.send(JSON.stringify({ type: 'error', error: 'Room not found' }));
  if (room.members.size >= room.maxPeople) return ws.send(JSON.stringify({ type: 'error', error: 'Room full' }));

  const wasEmpty = room.members.size === 0;
  room.members.add(user.id);
  const members = [...room.members].map(id => {
    const u = db.getUser(id);
    return { username: u.username, kzenId: u.kzen_id, status: u.status };
  });
  ws.send(JSON.stringify({ type: 'room:joined', room: publicRoom(room), members, phaseStart: room.phaseStart }));
  broadcastRoom(roomId, { type: 'room:join', roomId, user: { username: user.username, kzenId: user.kzen_id, status: user.status } }, ws);
  broadcast({ type: 'room:update', room: publicRoom(room) });
  if (!wasEmpty) db.trackDailyEvent(user.id, 'room_joined_with_others');
}

function leaveRoom(ws, user, roomId) {
  const room = db.getRoom(roomId);
  if (!room) return;
  room.members.delete(user.id);
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
