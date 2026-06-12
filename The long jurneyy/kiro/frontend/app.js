/* ═══════════════════════════════════════════════
   KIRO — app.js
   All frontend logic: state, screens, XP, timer,
   WebSocket connection, leaderboard, profile.
   ═══════════════════════════════════════════════ */

// ─────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────
const State = {
  username: '',
  theme: 'blue',
  mode: 'social',       // 'social' | 'solo'
  xp: 0,
  totalXp: 0,
  streak: 0,
  sessions: 0,
  currentRoom: null,
  isFocusing: false,
  focusSeconds: 0,
  timerInterval: null,
  // Solo mode
  isSoloFocusing: false,
  soloSeconds: 0,
  soloXp: 0,
  soloInterval: null,
};

// ─────────────────────────────────────────────
// MULTIPLIER SYSTEM
// ─────────────────────────────────────────────
function getMultiplier(minutes) {
  if (minutes >= 50) return { rate: 2.0,  label: '2×' };
  if (minutes >= 25) return { rate: 1.5,  label: '1.5×' };
  if (minutes >= 10) return { rate: 1.2,  label: '1.2×' };
  return               { rate: 1.0,  label: '1×' };
}

// ─────────────────────────────────────────────
// ROOMS DATA (static for MVP — replace with API)
// ─────────────────────────────────────────────
const ROOMS = [
  { id: 'math',    name: 'Mathematics', emoji: '📐', desc: 'Calculus, algebra, proofs', users: 12, max: 20 },
  { id: 'cs',      name: 'Computer Science', emoji: '💻', desc: 'Algorithms, systems, code', users: 9,  max: 20 },
  { id: 'physics', name: 'Physics', emoji: '⚛️', desc: 'Classical & quantum', users: 7,  max: 15 },
  { id: 'lang',    name: 'Languages', emoji: '🌍', desc: 'Vocabulary, grammar, writing', users: 14, max: 20 },
  { id: 'bio',     name: 'Biology', emoji: '🧬', desc: 'Life sciences, anatomy', users: 5,  max: 15 },
  { id: 'open',    name: 'Open Room', emoji: '✨', desc: 'Any subject, just focus', users: 21, max: 30 },
];

// ─────────────────────────────────────────────
// FAKE USERS FOR ROOMS (MVP placeholder)
// ─────────────────────────────────────────────
const FAKE_USERS = [
  { name: 'Sara',   xp: 340, focusing: true  },
  { name: 'Karim',  xp: 210, focusing: false },
  { name: 'Lena',   xp: 180, focusing: true  },
  { name: 'Omar',   xp: 490, focusing: true  },
  { name: 'Nadia',  xp: 95,  focusing: false },
  { name: 'Yassin', xp: 270, focusing: true  },
];

// ─────────────────────────────────────────────
// LEADERBOARD DATA (MVP — mix fake + current user)
// ─────────────────────────────────────────────
const LEADERBOARD = {
  daily: [
    { name: 'Omar',   xp: 490 },
    { name: 'Sara',   xp: 340 },
    { name: 'Yassin', xp: 270 },
    { name: 'Karim',  xp: 210 },
    { name: 'Lena',   xp: 180 },
    { name: 'Nadia',  xp: 95  },
  ],
  monthly: [
    { name: 'Omar',   xp: 8420 },
    { name: 'Yassin', xp: 7100 },
    { name: 'Sara',   xp: 6540 },
    { name: 'Lena',   xp: 5200 },
    { name: 'Karim',  xp: 4300 },
    { name: 'Nadia',  xp: 3100 },
  ],
};

// ─────────────────────────────────────────────
// PERSISTENCE (localStorage)
// ─────────────────────────────────────────────
function saveState() {
  localStorage.setItem('kiro_username', State.username);
  localStorage.setItem('kiro_theme',    State.theme);
  localStorage.setItem('kiro_xp',       State.totalXp);
  localStorage.setItem('kiro_streak',   State.streak);
  localStorage.setItem('kiro_sessions', State.sessions);
  localStorage.setItem('kiro_last',     Date.now());
}

function loadState() {
  State.username  = localStorage.getItem('kiro_username') || '';
  State.theme     = localStorage.getItem('kiro_theme')    || 'blue';
  State.totalXp   = parseInt(localStorage.getItem('kiro_xp'))       || 0;
  State.streak    = parseInt(localStorage.getItem('kiro_streak'))    || 0;
  State.sessions  = parseInt(localStorage.getItem('kiro_sessions'))  || 0;

  // Streak decay: reset if >48h inactive
  const last = parseInt(localStorage.getItem('kiro_last')) || 0;
  const hoursAgo = (Date.now() - last) / (1000 * 60 * 60);
  if (hoursAgo > 48 && State.streak > 0) {
    State.streak = 0;
    saveState();
  }
}

// ─────────────────────────────────────────────
// THEME SYSTEM
// ─────────────────────────────────────────────
const THEME_COLORS = {
  blue:   '#3b82f6',
  green:  '#10b981',
  orange: '#f59e0b',
  red:    '#ef4444',
  purple: '#8b5cf6',
  cozy:   '#c4956a',
};

function applyTheme(theme) {
  State.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);

  // Mark active swatch on all theme grids
  document.querySelectorAll('.theme-swatch').forEach(s => {
    s.classList.toggle('active', s.dataset.theme === theme);
  });
  saveState();
}

// Attach theme swatch listeners
document.querySelectorAll('.theme-swatch').forEach(btn => {
  btn.addEventListener('click', () => applyTheme(btn.dataset.theme));
});

// ─────────────────────────────────────────────
// SCREEN NAVIGATION
// ─────────────────────────────────────────────
function goTo(screenName) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById('screen-' + screenName);
  if (target) {
    target.classList.add('active');
    // Trigger reflow for animation
    target.style.display = 'flex';
    requestAnimationFrame(() => target.classList.add('active'));
  }
}

// ─────────────────────────────────────────────
// ONBOARDING
// ─────────────────────────────────────────────
let selectedMode = 'social';

document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedMode = btn.dataset.mode;
  });
});

document.getElementById('btn-start').addEventListener('click', () => {
  const username = document.getElementById('inp-username').value.trim();
  if (!username) {
    document.getElementById('inp-username').focus();
    document.getElementById('inp-username').style.borderColor = 'var(--red)';
    setTimeout(() => document.getElementById('inp-username').style.borderColor = '', 1500);
    return;
  }

  State.username = username;
  State.mode = selectedMode;
  saveState();

  if (selectedMode === 'solo') {
    startSoloMode();
  } else {
    renderRooms();
    document.getElementById('rooms-username').textContent = username;
    goTo('rooms');
  }
});

// ─────────────────────────────────────────────
// ROOMS
// ─────────────────────────────────────────────
function renderRooms() {
  const grid = document.getElementById('rooms-grid');
  grid.innerHTML = '';

  ROOMS.forEach(room => {
    const card = document.createElement('div');
    card.className = 'room-card';
    card.innerHTML = `
      <div class="room-header">
        <span class="room-emoji">${room.emoji}</span>
        <span class="room-badge">${room.users}/${room.max}</span>
      </div>
      <div>
        <div class="room-name">${room.name}</div>
        <div class="room-desc">${room.desc}</div>
      </div>
      <div class="room-footer">
        <div class="room-users">
          <div class="user-avatars">
            ${generateMiniAvatars(room.users)}
          </div>
          <span>${room.users} studying</span>
        </div>
        <button class="join-btn" data-room="${room.id}">Join</button>
      </div>
    `;
    card.querySelector('.join-btn').addEventListener('click', () => joinRoom(room));
    grid.appendChild(card);
  });
}

function generateMiniAvatars(count) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const show = Math.min(count, 4);
  let html = '';
  for (let i = 0; i < show; i++) {
    html += `<div class="mini-avatar">${letters[Math.floor(Math.random() * 26)]}</div>`;
  }
  return html;
}

// ─────────────────────────────────────────────
// JOIN ROOM → FOCUS SCREEN
// ─────────────────────────────────────────────
function joinRoom(room) {
  State.currentRoom = room;
  State.xp = 0;
  State.focusSeconds = 0;
  State.isFocusing = false;

  document.getElementById('focus-room-name').textContent = room.name;
  document.getElementById('xp-value').textContent = '0';
  document.getElementById('focus-xp-display').textContent = '0 XP';
  document.getElementById('timer-display').textContent = '00:00';
  document.getElementById('timer-mult').textContent = '1×';
  document.getElementById('ring-fill').style.strokeDashoffset = '339.3';
  document.getElementById('toggle-label').textContent = 'Start Focusing';
  document.getElementById('toggle-icon').textContent = '▶';
  document.getElementById('status-text').textContent = 'Press to start';
  document.getElementById('status-dot').className = 'status-dot idle';
  document.getElementById('focus-toggle').className = 'focus-toggle';

  renderRoomUsers();
  goTo('focus');

  // WebSocket: try to connect to backend
  connectWS(room.id);
}

function renderRoomUsers() {
  const list = document.getElementById('users-list');
  list.innerHTML = '';

  // Add current user first
  const meItem = document.createElement('li');
  meItem.className = 'user-row';
  meItem.id = 'user-row-me';
  meItem.innerHTML = `
    <span class="status-dot idle" id="my-status-dot"></span>
    <div class="user-avatar-sm">${State.username[0].toUpperCase()}</div>
    <div class="user-info">
      <div class="user-name-sm">${State.username} (you)</div>
      <div class="user-xp-sm" id="my-user-xp">0 XP</div>
    </div>
  `;
  list.appendChild(meItem);

  // Add fake users
  FAKE_USERS.forEach(u => {
    const li = document.createElement('li');
    li.className = 'user-row';
    li.innerHTML = `
      <span class="status-dot ${u.focusing ? 'focusing' : 'distracted'}"></span>
      <div class="user-avatar-sm">${u.name[0]}</div>
      <div class="user-info">
        <div class="user-name-sm">${u.name}</div>
        <div class="user-xp-sm">${u.xp} XP</div>
      </div>
    `;
    list.appendChild(li);
  });
}

// ─────────────────────────────────────────────
// FOCUS TIMER LOGIC
// ─────────────────────────────────────────────
function toggleFocus() {
  State.isFocusing = !State.isFocusing;
  const btn = document.getElementById('focus-toggle');
  const dot = document.getElementById('status-dot');
  const myDot = document.getElementById('my-status-dot');

  if (State.isFocusing) {
    btn.className = 'focus-toggle';
    document.getElementById('toggle-icon').textContent = '⏸';
    document.getElementById('toggle-label').textContent = 'Pause';
    dot.className = 'status-dot focusing';
    if (myDot) myDot.className = 'status-dot focusing';
    document.getElementById('status-text').textContent = 'Focusing — XP accumulating';

    if (!State.timerInterval) {
      State.timerInterval = setInterval(tickFocus, 1000);
    }
  } else {
    btn.className = 'focus-toggle paused';
    document.getElementById('toggle-icon').textContent = '▶';
    document.getElementById('toggle-label').textContent = 'Resume';
    dot.className = 'status-dot idle';
    if (myDot) myDot.className = 'status-dot idle';
    document.getElementById('status-text').textContent = 'Paused';

    clearInterval(State.timerInterval);
    State.timerInterval = null;
  }
}

function tickFocus() {
  if (!State.isFocusing) return;

  State.focusSeconds++;
  const minutes = Math.floor(State.focusSeconds / 60);
  const mult = getMultiplier(minutes);

  // Add XP
  State.xp = Math.round(State.xp + mult.rate);
  State.totalXp = State.xp; // simplified: session XP = total for MVP

  // Update timer display
  const mm = String(minutes).padStart(2, '0');
  const ss = String(State.focusSeconds % 60).padStart(2, '0');
  document.getElementById('timer-display').textContent = `${mm}:${ss}`;
  document.getElementById('timer-mult').textContent = mult.label;

  // Update XP displays
  document.getElementById('xp-value').textContent = State.xp;
  document.getElementById('focus-xp-display').textContent = `${State.xp} XP`;
  const myXp = document.getElementById('my-user-xp');
  if (myXp) myXp.textContent = `${State.xp} XP`;

  // Animate ring: max ring at 60 min = 3600 sec
  const progress = Math.min(State.focusSeconds / 3600, 1);
  const offset = 339.3 * (1 - progress);
  document.getElementById('ring-fill').style.strokeDashoffset = offset;

  // Send XP update to backend
  wsSend({ type: 'xp_update', xp: State.xp, username: State.username });
}

function leaveRoom() {
  clearInterval(State.timerInterval);
  State.timerInterval = null;
  State.isFocusing = false;

  // Award XP and update streak
  if (State.xp > 0) {
    State.totalXp += State.xp;
    State.sessions++;
    const lastDate = localStorage.getItem('kiro_last_date');
    const today = new Date().toDateString();
    if (lastDate !== today) {
      State.streak++;
      localStorage.setItem('kiro_last_date', today);
    }
    saveState();
  }

  wsDisconnect();
  goTo('rooms');
}

// ─────────────────────────────────────────────
// SOLO MODE
// ─────────────────────────────────────────────
function startSoloMode() {
  State.soloSeconds = 0;
  State.soloXp = 0;
  State.isSoloFocusing = false;

  document.getElementById('solo-timer').textContent = '00:00';
  document.getElementById('solo-mult').textContent = '1×';
  document.getElementById('solo-xp').textContent = '0';
  document.getElementById('solo-xp-display').textContent = '0 XP';
  document.getElementById('solo-greeting').textContent = 'Ready when you are.';
  document.getElementById('solo-icon').textContent = '▶';
  document.getElementById('solo-label').textContent = 'Start Session';
  document.getElementById('solo-toggle').className = 'solo-btn';

  goTo('solo');
}

function toggleSolo() {
  State.isSoloFocusing = !State.isSoloFocusing;
  const btn = document.getElementById('solo-toggle');

  if (State.isSoloFocusing) {
    btn.className = 'solo-btn';
    document.getElementById('solo-icon').textContent = '⏸';
    document.getElementById('solo-label').textContent = 'Pause';
    document.getElementById('solo-greeting').textContent = "You're in the zone 🔥";

    if (!State.soloInterval) {
      State.soloInterval = setInterval(tickSolo, 1000);
    }
  } else {
    btn.className = 'solo-btn paused';
    document.getElementById('solo-icon').textContent = '▶';
    document.getElementById('solo-label').textContent = 'Resume';
    document.getElementById('solo-greeting').textContent = 'Take a breath. Come back soon.';

    clearInterval(State.soloInterval);
    State.soloInterval = null;
  }
}

function tickSolo() {
  if (!State.isSoloFocusing) return;
  State.soloSeconds++;
  const minutes = Math.floor(State.soloSeconds / 60);
  const mult = getMultiplier(minutes);

  State.soloXp = Math.round(State.soloXp + mult.rate);

  const mm = String(minutes).padStart(2, '0');
  const ss = String(State.soloSeconds % 60).padStart(2, '0');
  document.getElementById('solo-timer').textContent = `${mm}:${ss}`;
  document.getElementById('solo-mult').textContent = mult.label;
  document.getElementById('solo-xp').textContent = State.soloXp;
  document.getElementById('solo-xp-display').textContent = `${State.soloXp} XP`;
}

function leaveSolo() {
  clearInterval(State.soloInterval);
  State.soloInterval = null;
  State.isSoloFocusing = false;

  if (State.soloXp > 0) {
    State.totalXp += State.soloXp;
    State.sessions++;
    const lastDate = localStorage.getItem('kiro_last_date');
    const today = new Date().toDateString();
    if (lastDate !== today) {
      State.streak++;
      localStorage.setItem('kiro_last_date', today);
    }
    saveState();
  }

  goTo('onboarding');
}

// ─────────────────────────────────────────────
// LEADERBOARD
// ─────────────────────────────────────────────
let currentTab = 'daily';

function switchTab(tab) {
  currentTab = tab;
  document.getElementById('tab-daily').classList.toggle('active', tab === 'daily');
  document.getElementById('tab-monthly').classList.toggle('active', tab === 'monthly');
  renderLeaderboard(tab);
}

function renderLeaderboard(tab) {
  const list = document.getElementById('lb-list');
  list.innerHTML = '';

  // Inject user's current XP into leaderboard
  const userData = { name: State.username, xp: State.totalXp, isMe: true };
  let rows = [...LEADERBOARD[tab]];

  // Insert user and sort
  rows.push({ name: State.username, xp: State.totalXp, isMe: true });
  rows.sort((a, b) => b.xp - a.xp);
  // Remove duplicate if user name matches a fake
  const seen = new Set();
  rows = rows.filter(r => {
    if (seen.has(r.name)) return false;
    seen.add(r.name);
    return true;
  });

  const rankClasses = ['gold', 'silver', 'bronze'];

  rows.forEach((user, i) => {
    const rank = i + 1;
    const div = document.createElement('div');
    div.className = 'lb-row' + (user.isMe ? ' me' : '');
    div.innerHTML = `
      <span class="lb-rank ${rankClasses[i] || ''}">${rank <= 3 ? ['🥇','🥈','🥉'][i] : rank}</span>
      <div class="lb-avatar">${user.name[0].toUpperCase()}</div>
      <span class="lb-name">${user.name}${user.isMe ? ' (you)' : ''}</span>
      <div style="text-align:right">
        <div class="lb-xp">${user.xp.toLocaleString()}</div>
        <div class="lb-xp-label">XP</div>
      </div>
    `;
    list.appendChild(div);
  });
}

// ─────────────────────────────────────────────
// PROFILE
// ─────────────────────────────────────────────
function renderProfile() {
  document.getElementById('profile-letter').textContent = State.username[0]?.toUpperCase() || '?';
  document.getElementById('profile-name').textContent = State.username;
  document.getElementById('stat-xp').textContent = State.totalXp.toLocaleString();
  document.getElementById('stat-streak').textContent = State.streak + '🔥';
  document.getElementById('stat-sessions').textContent = State.sessions;

  // Calculate rank from leaderboard
  const allXp = LEADERBOARD.daily.map(u => u.xp);
  allXp.push(State.totalXp);
  allXp.sort((a, b) => b - a);
  const rank = allXp.indexOf(State.totalXp) + 1;
  document.getElementById('stat-rank').textContent = `#${rank}`;
}

function resetProfile() {
  if (!confirm('Reset all your progress? This cannot be undone.')) return;
  localStorage.clear();
  location.reload();
}

// ─────────────────────────────────────────────
// WEBSOCKET (connects to backend)
// ─────────────────────────────────────────────
let ws = null;

function connectWS(roomId) {
  const wsUrl = `ws://${location.hostname}:3001`;
  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      wsSend({ type: 'join', room: roomId, username: State.username });
      console.log('[Kiro WS] Connected to', wsUrl);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleWSMessage(msg);
      } catch (e) {
        console.warn('[Kiro WS] Bad message:', event.data);
      }
    };

    ws.onclose = () => console.log('[Kiro WS] Disconnected');
    ws.onerror = () => console.log('[Kiro WS] Could not connect — offline mode');
  } catch (e) {
    console.log('[Kiro WS] WebSocket unavailable — running offline');
  }
}

function wsSend(data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function wsDisconnect() {
  if (ws) { ws.close(); ws = null; }
}

function handleWSMessage(msg) {
  switch (msg.type) {
    case 'room_users':
      // Update live user list from server
      // For MVP: just update the live count
      break;
    case 'live_count':
      document.getElementById('live-count').textContent =
        `${msg.count} people studying right now`;
      break;
  }
}

// ─────────────────────────────────────────────
// NAVIGATION HOOKS (called from HTML onclick)
// ─────────────────────────────────────────────
function goTo(screen) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.style.display = 'none';
  });

  const target = document.getElementById('screen-' + screen);
  if (!target) return;
  target.style.display = 'flex';

  // Trigger animation
  requestAnimationFrame(() => {
    requestAnimationFrame(() => target.classList.add('active'));
  });

  // Per-screen setup
  if (screen === 'leaderboard') {
    renderLeaderboard(currentTab);
  }
  if (screen === 'profile') {
    renderProfile();
    // Update theme swatches on profile page
    document.querySelectorAll('.theme-swatch').forEach(s => {
      s.classList.toggle('active', s.dataset.theme === State.theme);
    });
  }
  if (screen === 'rooms') {
    renderRooms();
    document.getElementById('rooms-username').textContent = State.username;
  }
}

// ─────────────────────────────────────────────
// NOTIFICATIONS (push prompt on load)
// ─────────────────────────────────────────────
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    setTimeout(() => {
      Notification.requestPermission();
    }, 5000); // Ask after 5 seconds, not immediately
  }
}

function sendNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/icon.png' });
  }
}

// Study reminder — every 4 hours if idle
function scheduleReminders() {
  setInterval(() => {
    const last = parseInt(localStorage.getItem('kiro_last')) || 0;
    const hoursAgo = (Date.now() - last) / (1000 * 60 * 60);
    if (hoursAgo > 4) {
      sendNotification('Kiro 📚', `${State.username}, people are studying right now. Join them!`);
    }
  }, 1000 * 60 * 60 * 4); // check every 4 hours
}

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
function init() {
  loadState();
  applyTheme(State.theme);

  // Hide all screens first
  document.querySelectorAll('.screen').forEach(s => {
    s.style.display = 'none';
    s.classList.remove('active');
  });

  // If user already onboarded, go straight to rooms
  if (State.username) {
    document.getElementById('inp-username').value = State.username;
    renderRooms();
    document.getElementById('rooms-username').textContent = State.username;
    goTo('rooms');
  } else {
    goTo('onboarding');
  }

  requestNotificationPermission();
  scheduleReminders();
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
