const bcrypt = require('bcryptjs');

const users = new Map();
const rooms = new Map();
const battles = new Map();
const sessions = new Map();
const todos = new Map();
const dailyLogs = new Map();

function genId(prefix = '') {
  return prefix + Math.random().toString(36).slice(2, 10);
}

function genKzenId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function today() { return new Date().toISOString().slice(0, 10); }
function weekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().slice(0, 10);
}
function monthStart() { return new Date().toISOString().slice(0, 7); }

async function createUser({ username, email, password, mode, year, school, major }) {
  const key = username.toLowerCase();
  if ([...users.values()].some(u => u.username.toLowerCase() === key))
    throw new Error('Username taken');
  if ([...users.values()].some(u => u.email.toLowerCase() === email.toLowerCase()))
    throw new Error('Email already registered');

  const hash = await bcrypt.hash(password, 12);
  const user = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    username,
    email,
    password_hash: hash,
    kzen_id: genKzenId(),
    mode: mode || 'student',
    year: year || 'freshman',
    school: school || 'SSE',
    major: major || '',
    xp_total: 0,
    xp_daily: 0,
    xp_weekly: 0,
    xp_monthly: 0,
    last_daily_reset: null,
    last_weekly_reset: null,
    last_monthly_reset: null,
    streak: 0,
    streak_freezes: 1,
    last_active: null,
    sessions: 0,
    battles_won: 0,
    friends: [],
    theme: 'ink',
    dark: true,
    status: 'focus',
    auto_status: true,
    last_ping: Date.now(),
    daily_goal_xp: 60,
    notif_prefs: { battles: true, friends: true, rooms: true, methods: true },
    created: Date.now(),
  };
  users.set(user.id, user);
  return user;
}

async function verifyPassword(identifier, password) {
  const user = [...users.values()].find(
    u =>
      u.username.toLowerCase() === identifier.toLowerCase() ||
      u.email.toLowerCase() === identifier.toLowerCase()
  );
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.password_hash);
  return ok ? user : null;
}

async function changePassword(userId, oldPw, newPw) {
  const user = users.get(userId);
  if (!user) throw new Error('User not found');
  const ok = await bcrypt.compare(oldPw, user.password_hash);
  if (!ok) throw new Error('Current password is wrong');
  if (newPw.length < 8) throw new Error('New password must be 8+ chars');
  user.password_hash = await bcrypt.hash(newPw, 12);
  return true;
}

function getUser(id) { return users.get(id); }
function getUserByKzenId(k) { return [...users.values()].find(u => u.kzen_id === k); }
function getUserByUsername(n) {
  return [...users.values()].find(u => u.username.toLowerCase() === n.toLowerCase());
}

function updateUser(id, patch) {
  const u = users.get(id);
  if (!u) return null;
  Object.assign(u, patch);
  return u;
}

function removeFriend(userId, kzenId) {
  const u = users.get(userId);
  const other = getUserByKzenId(kzenId);
  if (!u || !other) return false;
  u.friends = u.friends.filter(id => id !== other.id);
  other.friends = other.friends.filter(id => id !== userId);
  return true;
}

function applyStreakOnLogin(user) {
  const t = today();
  if (!user.last_active) { user.streak = 1; user.last_active = t; return; }
  if (user.last_active === t) return;

  const last = new Date(user.last_active);
  const now = new Date();
  const diff = Math.round((now - last) / 86400000);

  if (diff === 1) user.streak += 1;
  else if (diff === 2 && user.streak_freezes > 0) {
    user.streak_freezes -= 1;
    user.streak += 1;
  } else user.streak = 1;

  user.last_active = t;
  if (now.getDay() === 1) user.streak_freezes = Math.min(1, user.streak_freezes + 1);
}

function resetPeriodsIfNeeded(user) {
  const t = today();
  const w = weekStart();
  const m = monthStart();
  if (user.last_daily_reset !== t) { user.xp_daily = 0; user.last_daily_reset = t; }
  if (user.last_weekly_reset !== w) { user.xp_weekly = 0; user.last_weekly_reset = w; }
  if (user.last_monthly_reset !== m) { user.xp_monthly = 0; user.last_monthly_reset = m; }
}

function addXp(user, amount) {
  resetPeriodsIfNeeded(user);
  user.xp_total += amount;
  user.xp_daily += amount;
  user.xp_weekly += amount;
  user.xp_monthly += amount;
}

function createRoom({ name, subject, maxPeople, cameraRequired, voiceCycle, ownerId, sessionLength }) {
  const clean = name.trim();
  if (!clean) throw new Error('Name required');
  if ([...rooms.values()].some(r => r.name.toLowerCase() === clean.toLowerCase()))
    throw new Error('Room name taken');
  const allowed = ['25-5', '50-10', '120-30'];
  const cycle = allowed.includes(voiceCycle) ? voiceCycle : '25-5';
  const len = [25, 50, 90, 120].includes(sessionLength) ? sessionLength : 50;
  const now = Date.now();
  const room = {
    id: genId('r_'),
    name: clean,
    subject: subject || 'General',
    maxPeople: Math.min(20, Math.max(2, maxPeople || 10)),
    cameraRequired: !!cameraRequired,
    voiceCycle: cycle,
    sessionLength: len,
    sessionStart: now,
    sessionEnd: now + len * 60 * 1000,
    ownerId,
    members: new Set(),
    presence: new Map(),
    voicePhase: 'focus',
    phaseStart: now,
    created: now,
  };
  rooms.set(room.id, room);
  return room;
}

function listRooms() {
  return [...rooms.values()].map(r => ({
    id: r.id, name: r.name, subject: r.subject, maxPeople: r.maxPeople,
    cameraRequired: r.cameraRequired, voiceCycle: r.voiceCycle,
    voicePhase: r.voicePhase, members: r.members.size,
    sessionLength: r.sessionLength,
    sessionStart: r.sessionStart,
    sessionEnd: r.sessionEnd,
    remaining: Math.max(0, r.sessionEnd - Date.now()),
  }));
}

function deleteRoom(id) { rooms.delete(id); }
function getRoom(id) { return rooms.get(id); }

function getLeaderboard(period = 'today', limit = 50) {
  const field = period === 'today' ? 'xp_daily'
    : period === 'week' ? 'xp_weekly'
      : period === 'month' ? 'xp_monthly'
        : 'xp_total';
  return [...users.values()]
    .map(u => {
      resetPeriodsIfNeeded(u); return {
        username: u.username, kzenId: u.kzen_id,
        xp: u[field], streak: u.streak, battles_won: u.battles_won,
      };
    })
    .sort((a, b) => b.xp - a.xp)
    .slice(0, limit);
}

function getTodos(userId) {
  if (!todos.has(userId)) todos.set(userId, []);
  return todos.get(userId);
}

function addTodo(userId, text) {
  const list = getTodos(userId);
  const item = { id: genId('t_'), text, done: false, bonus_claimed: false, created: Date.now() };
  list.push(item);
  return item;
}

function toggleTodo(userId, todoId, inSession) {
  const list = getTodos(userId);
  const t = list.find(x => x.id === todoId);
  if (!t) return null;
  t.done = !t.done;
  const user = users.get(userId);
  let bonus = 0;
  if (t.done && inSession && !t.bonus_claimed && user) {
    const countToday = list.filter(x => x.bonus_claimed && x.bonus_date === today()).length;
    if (countToday < 3) {
      t.bonus_claimed = true;
      t.bonus_date = today();
      addXp(user, 10);
      bonus = 10;
      trackDailyEvent(userId, 'todo_bonus');
    }
  }
  return { todo: t, bonus };
}

function deleteTodo(userId, todoId) {
  const list = getTodos(userId);
  const idx = list.findIndex(x => x.id === todoId);
  if (idx >= 0) list.splice(idx, 1);
}

const DAILY_POOL = [
  { id: 'focus30', title: 'Focus for 30 minutes straight', reward: 30, type: 'time' },
  { id: 'focus60', title: 'Focus for 60 minutes straight', reward: 70, type: 'time' },
  { id: 'method2', title: 'Complete 2 study methods', reward: 25, type: 'method' },
  { id: 'method3', title: 'Complete 3 study methods', reward: 40, type: 'method' },
  { id: 'cam15', title: 'Study 15 min with camera on', reward: 20, type: 'cam' },
  { id: 'cam45', title: 'Study 45 min with camera on', reward: 50, type: 'cam' },
  { id: 'todo2', title: 'Complete 2 tasks during a focus session', reward: 20, type: 'todo' },
  { id: 'room1', title: 'Study in a room with someone else', reward: 30, type: 'room' },
  { id: 'duel1', title: 'Start or accept a duel', reward: 25, type: 'duel' },
  { id: 'early', title: 'Study before noon', reward: 20, type: 'time_of_day' },
  { id: 'night', title: 'Study after 9pm', reward: 20, type: 'time_of_day' },
  { id: 'streak3', title: 'Show up 3 days in a row', reward: 30, type: 'streak' },
  { id: 'streak7', title: 'Show up 7 days in a row', reward: 100, type: 'streak' },
  { id: 'session2', title: 'Run 2 sessions today', reward: 25, type: 'session' },
  { id: 'session4', title: 'Run 4 sessions today', reward: 60, type: 'session' },
  { id: 'blurt', title: 'Blurt what you studied on paper', reward: 15, type: 'self' },
  { id: 'feyn', title: 'Explain a concept out loud', reward: 15, type: 'self' },
  { id: 'q3', title: 'Write 3 questions on today\'s topic', reward: 15, type: 'self' },
  { id: 'plan', title: 'Plan review for day 2, 3, 5, 7', reward: 15, type: 'self' },
  { id: 'total60', title: 'Earn 60 xp today', reward: 25, type: 'total_xp' },
  { id: 'total150', title: 'Earn 150 xp today', reward: 60, type: 'total_xp' },
  { id: 'total300', title: 'Earn 300 xp today', reward: 120, type: 'total_xp' },
  { id: 'solo25', title: 'Finish a full 25-min solo commit', reward: 40, type: 'solo' },
  { id: 'solo50', title: 'Finish a full 50-min solo commit', reward: 90, type: 'solo' },
  { id: 'quiet', title: 'Do a focus block with no phone', reward: 20, type: 'self' },
  { id: 'earlybird', title: 'First task of the day before 10am', reward: 25, type: 'time_of_day' },
  { id: 'battle_w', title: 'Win a duel', reward: 80, type: 'duel' },
  { id: 'camera_ok', title: 'Full session without getting distracted', reward: 40, type: 'cam' },
];

function seedRand(seed) {
  let x = seed;
  return () => { x = (x * 9301 + 49297) % 233280; return x / 233280; };
}

function hashCode(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function dailyTasksFor(userId) {
  const t = today();
  const key = userId + ':' + t;
  if (!dailyLogs.has(key)) {
    const seed = hashCode(String(userId) + t);
    const rand = seedRand(seed);
    const pool = [...DAILY_POOL];
    const picked = [];
    for (let i = 0; i < 3; i++) {
      const idx = Math.floor(rand() * pool.length);
      picked.push({ ...pool.splice(idx, 1)[0], done: false, progress: 0 });
    }
    dailyLogs.set(key, { tasks: picked, counters: {}, pendingRewards: [] });
  }
  return dailyLogs.get(key);
}

function trackDailyEvent(userId, event, meta = {}) {
  const log = dailyTasksFor(userId);
  const user = users.get(userId);
  if (!user) return;

  log.counters[event] = (log.counters[event] || 0) + (meta.amount || 1);

  log.tasks.forEach(task => {
    if (task.done) return;
    let hit = false;
    switch (task.type) {
      case 'time':
        if (event === 'session_end' && meta.duration >= (task.id === 'focus30' ? 30 : 60)) hit = true;
        break;
      case 'method':
        if (event === 'method_done') {
          task.progress = (task.progress || 0) + 1;
          if (task.progress >= (task.id === 'method2' ? 2 : 3)) hit = true;
        }
        break;
      case 'cam':
        if (event === 'session_end') {
          if (task.id === 'cam15' && meta.camSeconds >= 15 * 60) hit = true;
          if (task.id === 'cam45' && meta.camSeconds >= 45 * 60) hit = true;
          if (task.id === 'camera_ok' && meta.duration >= 25 && meta.camDistractedSec < 10 && meta.camSeconds > 0) hit = true;
        }
        break;
      case 'todo':
        if (event === 'todo_bonus') {
          task.progress = (task.progress || 0) + 1;
          if (task.progress >= 2) hit = true;
        }
        break;
      case 'room':
        if (event === 'room_joined_with_others') hit = true;
        break;
      case 'duel':
        if (task.id === 'duel1' && event === 'duel_start') hit = true;
        if (task.id === 'battle_w' && event === 'duel_win') hit = true;
        break;
      case 'time_of_day':
        if (event === 'session_start') {
          const hour = new Date().getHours();
          if (task.id === 'early' && hour < 12) hit = true;
          if (task.id === 'night' && hour >= 21) hit = true;
          if (task.id === 'earlybird' && hour < 10) hit = true;
        }
        break;
      case 'streak':
        if (event === 'login') {
          if (task.id === 'streak3' && user.streak >= 3) hit = true;
          if (task.id === 'streak7' && user.streak >= 7) hit = true;
        }
        break;
      case 'session':
        if (event === 'session_end') {
          task.progress = (task.progress || 0) + 1;
          if (task.id === 'session2' && task.progress >= 2) hit = true;
          if (task.id === 'session4' && task.progress >= 4) hit = true;
        }
        break;
      case 'total_xp':
        if (event === 'xp_check') {
          const target = task.id === 'total60' ? 60 : task.id === 'total150' ? 150 : 300;
          if (user.xp_daily >= target) hit = true;
        }
        break;
      case 'solo':
        if (event === 'solo_commit_done') {
          const target = task.id === 'solo25' ? 25 : 50;
          if (meta.duration >= target) hit = true;
        }
        break;
    }
    if (hit) {
      task.done = true;
      addXp(user, task.reward);
      log.pendingRewards.push({ task: task.title, reward: task.reward });
    }
  });
}

function pullRewards(userId) {
  const log = dailyTasksFor(userId);
  const rewards = log.pendingRewards || [];
  log.pendingRewards = [];
  return rewards;
}

module.exports = {
  createUser, verifyPassword, changePassword,
  getUser, getUserByKzenId, getUserByUsername, updateUser, removeFriend,
  applyStreakOnLogin, resetPeriodsIfNeeded, addXp,
  createRoom, listRooms, deleteRoom, getRoom,
  getLeaderboard,
  getTodos, addTodo, toggleTodo, deleteTodo,
  dailyTasksFor, trackDailyEvent, pullRewards,
  users, rooms, battles, sessions, genId,
};
