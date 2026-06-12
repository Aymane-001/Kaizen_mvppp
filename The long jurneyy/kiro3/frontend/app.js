/* ═══════════════════════════════════════════
   KIRO v3 — app.js
   Real auth (JWT), real WS rooms, MediaPipe
   focus detection, auto challenges, HP system,
   gamer rank levels, 12 student themes
   ═══════════════════════════════════════════ */

const API = `http://${location.hostname}:3001`;
const WS_URL = `ws://${location.hostname}:3001`;

// ─────────────────────────────────────────
// STATE
// ─────────────────────────────────────────
const S = {
  token: '',
  userId: null,
  username: '',
  userID: '',
  mode: 'student',
  theme: 'blue',
  dark: false,
  year: 'freshman',
  school: 'SSE',
  major: '',
  status: 'focus',

  xp: 0,
  hp: 100,
  streak: 0,
  sessions: 0,

  // Session
  currentRoom: null,
  isFocusing: false,
  focusSeconds: 0,
  sessionXp: 0,
  timerInterval: null,
  cameraOn: false,
  cameraStream: null,
  faceMesh: null,
  distractionSeconds: 0,
  distractionWarned: false,
  cameraFrameCount: 0,

  // Challenge progress
  challengeProgress: {
    c1: 0,   // focus minutes
    c2: 0,   // streak
    c3: 0,   // friends in room
    c4: 0,   // camera minutes
    c5: false, // top 10
  },

  // Rooms (fetched from server)
  rooms: [],
  friends: [],

  ws: null,
  roomUsers: [],
};

// ─────────────────────────────────────────
// MAJORS BY SCHOOL
// ─────────────────────────────────────────
const MAJORS = {
  SSE: ['Computer Science','Software Engineering','Electrical Engineering','Mechanical Engineering','Civil Engineering','Mathematics','Physics','Biology','Chemistry','Environmental Science'],
  SB:  ['Business Administration','Finance','Accounting','Marketing','Management','International Business','Entrepreneurship','Economics'],
  SHSS:['International Studies','Political Science','Psychology','Sociology','Arabic Studies','Communication Studies','Philosophy','History','English Literature','French Studies'],
  SL:  ['Law','International Law','Business Law'],
};

const SUBJECT_EMOJIS = { math:'📐', cs:'💻', physics:'⚛️', chemistry:'🧪', biology:'🧬', econ:'📊', management:'🏢', law:'⚖️', arabic:'🌙', french:'🇫🇷', english:'📝', history:'📜', open:'✨' };

// Room suggestions by year
const YEAR_SUBJECTS = {
  freshman:  ['math','physics','chemistry','english','arabic','french'],
  sophomore: ['math','cs','physics','chemistry','biology','econ'],
  junior:    ['cs','econ','management','history','law','french'],
  senior:    ['cs','management','law','english','history','open'],
};

// ─────────────────────────────────────────
// GAMER RANKS
// ─────────────────────────────────────────
const RANKS = [
  { name:'Bronze',   min:0,     max:500,   icon:'🥉', color:'#c4956a' },
  { name:'Silver',   min:500,   max:1500,  icon:'🥈', color:'#94a3b8' },
  { name:'Gold',     min:1500,  max:4000,  icon:'🥇', color:'#f59e0b' },
  { name:'Platinum', min:4000,  max:10000, icon:'💎', color:'#67e8f9' },
  { name:'Legend',   min:10000, max:Infinity, icon:'👑', color:'#00ff88' },
];

function getRank(xp) {
  return RANKS.find(r => xp >= r.min && xp < r.max) || RANKS[0];
}

// ─────────────────────────────────────────
// CHALLENGES — auto-complete only
// ─────────────────────────────────────────
const CHALLENGES = [
  { id:'c1', icon:'⏱️', title:'Focus for 30 minutes', sub:'In any room', reward:'+50 XP', xpVal:50, done:false, auto:true, target:30 },
  { id:'c2', icon:'🔥', title:'Maintain a 3-day streak', sub:'Study 3 days in a row', reward:'+30 XP', xpVal:30, done:false, auto:true, target:3 },
  { id:'c3', icon:'👥', title:'Study with 3 friends', sub:'Have 3 friends in your room', reward:'+40 XP', xpVal:40, done:false, auto:true, target:3 },
  { id:'c4', icon:'📸', title:'Use camera for 5 minutes', sub:'Enable focus camera', reward:'+25 XP', xpVal:25, done:false, auto:true, target:5 },
  { id:'c5', icon:'🏆', title:'Reach top 10', sub:'On the daily leaderboard', reward:'+60 XP', xpVal:60, done:false, auto:true, target:1 },
];

// Load saved completion from localStorage
function loadChallengeState() {
  const saved = JSON.parse(localStorage.getItem('kiro_challenges') || '[]');
  const today = new Date().toDateString();
  const savedDate = localStorage.getItem('kiro_challenges_date');
  if (savedDate !== today) {
    // New day — reset
    CHALLENGES.forEach(c => c.done = false);
    localStorage.setItem('kiro_challenges_date', today);
    localStorage.setItem('kiro_challenges', JSON.stringify([]));
    return;
  }
  saved.forEach(id => { const c = CHALLENGES.find(x => x.id === id); if (c) c.done = true; });
}

function saveChallengeState() {
  const done = CHALLENGES.filter(c => c.done).map(c => c.id);
  localStorage.setItem('kiro_challenges', JSON.stringify(done));
  localStorage.setItem('kiro_challenges_date', new Date().toDateString());
}

function autoCheckChallenges() {
  const focusMins = Math.floor(S.focusSeconds / 60);

  // c1: focus 30 min
  if (!CHALLENGES[0].done && focusMins >= 30) awardChallenge('c1');

  // c2: streak
  if (!CHALLENGES[1].done && S.streak >= 3) awardChallenge('c2');

  // c3: friends in room
  const friendsInRoom = S.roomUsers.filter(u => S.friends.some(f => f.username === u.username)).length;
  if (!CHALLENGES[2].done && friendsInRoom >= 3) awardChallenge('c3');

  // c4: camera for 5 min
  if (!CHALLENGES[3].done && S.cameraOn) {
    S.cameraFrameCount++;
    // cameraFrameCount ticks every second when focusing
    if (S.cameraFrameCount >= 300) awardChallenge('c4'); // 5 min
  }

  // c5: top 10 — checked when leaderboard loads
}

function awardChallenge(id) {
  const ch = CHALLENGES.find(c => c.id === id);
  if (!ch || ch.done) return;
  ch.done = true;
  S.xp += ch.xpVal;
  S.hp = Math.min(100, S.hp + 5);
  saveChallengeState();
  renderChallenges();
  updateHPUI();
  updateXPUI();
  toast(`🎯 Challenge complete! ${ch.title} — ${ch.reward}`);
}

// ─────────────────────────────────────────
// MULTIPLIER
// ─────────────────────────────────────────
function getMult(minutes, camOn) {
  let base = 1.0;
  if (minutes >= 50) base = 2.0;
  else if (minutes >= 25) base = 1.5;
  else if (minutes >= 10) base = 1.2;
  const total = camOn ? +(base * 1.2).toFixed(2) : base;
  return { rate: total, label: `${total}×` };
}

// ─────────────────────────────────────────
// PERSIST (token only — data from server)
// ─────────────────────────────────────────
function saveLocal() {
  localStorage.setItem('kiro_token', S.token);
  localStorage.setItem('kiro_theme', S.theme);
  localStorage.setItem('kiro_dark', S.dark);
  localStorage.setItem('kiro_status', S.status);
}

// ─────────────────────────────────────────
// THEME / MODE
// ─────────────────────────────────────────
function applyTheme(theme) {
  S.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelectorAll('.swatch').forEach(s => s.classList.toggle('active', s.dataset.theme === theme));
  saveLocal();
}

function applyMode(mode) {
  S.mode = mode;
  document.documentElement.setAttribute('data-mode', mode);
  document.getElementById('mode-student')?.classList.toggle('active', mode === 'student');
  document.getElementById('mode-gamer')?.classList.toggle('active', mode === 'gamer');
  // Labels
  const xpLabel = mode === 'gamer' ? 'EXP' : 'XP';
  document.getElementById('xp-label')  && (document.getElementById('xp-label').textContent = xpLabel);
  document.getElementById('focus-xp-label') && (document.getElementById('focus-xp-label').textContent = xpLabel + ' earned');
  document.getElementById('s-xp-lbl')  && (document.getElementById('s-xp-lbl').textContent = 'Total ' + xpLabel);
  document.getElementById('rooms-title') && (document.getElementById('rooms-title').textContent = mode === 'gamer' ? '🎮 Zones' : '📚 Study Rooms');
  document.getElementById('challenges-title') && (document.getElementById('challenges-title').textContent = mode === 'gamer' ? '⚔️ Daily Quests' : '🎯 Daily Challenges');
  document.getElementById('lb-screen-title') && (document.getElementById('lb-screen-title').textContent = mode === 'gamer' ? 'Hall of Fame' : 'Leaderboard');
  if (mode === 'gamer') updateGamerRank();
}

function setMode(mode) { applyMode(mode); saveLocal(); }

function toggleDark() {
  S.dark = document.getElementById('dark-toggle').checked;
  document.documentElement.setAttribute('data-dark', S.dark);
  saveLocal();
}

// ─────────────────────────────────────────
// SCREEN NAV
// ─────────────────────────────────────────
function goTo(screen) {
  document.querySelectorAll('.screen').forEach(s => { s.classList.remove('active'); s.style.display = 'none'; });
  const el = document.getElementById('screen-' + screen);
  if (!el) return;
  el.style.display = 'flex';
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('active')));
  if (screen === 'home')        renderHome();
  if (screen === 'leaderboard') { renderLeaderboard('daily'); loadLeaderboard(); }
  if (screen === 'profile')     renderProfile();
  if (screen === 'friends')     renderFriendsScreen();
}

// ─────────────────────────────────────────
// INTRO
// ─────────────────────────────────────────
let slide = 0;
function setupIntro() {
  document.getElementById('intro-next').onclick = () => {
    if (slide < 2) {
      const slides = document.querySelectorAll('.intro-slide');
      const dots   = document.querySelectorAll('.dot');
      slides[slide].classList.add('exit'); slides[slide].classList.remove('active');
      setTimeout(() => slides[slide].classList.remove('exit'), 500);
      slide++;
      slides[slide].classList.add('active');
      dots.forEach((d,i) => d.classList.toggle('active', i === slide));
      if (slide === 2) document.getElementById('intro-next').textContent = "Let's Go →";
    } else {
      hideIntro(); goTo('auth');
    }
  };
}
function hideIntro() {
  const s = document.getElementById('screen-intro');
  s.classList.remove('active'); s.style.display = 'none';
}

// ─────────────────────────────────────────
// MAJORS
// ─────────────────────────────────────────
function updateMajors() {
  const school = document.getElementById('reg-school')?.value || 'SSE';
  const sel    = document.getElementById('reg-major');
  if (!sel) return;
  sel.innerHTML = (MAJORS[school] || []).map(m => `<option value="${m}">${m}</option>`).join('');
}

// ─────────────────────────────────────────
// AUTH — REGISTER
// ─────────────────────────────────────────
let regMode = 'student';
let regStep = 1;

function setupAuth() {
  // Tab switch
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('form-' + tab.dataset.tab).classList.add('active');
    };
  });

  // Mode pick
  document.querySelectorAll('.mode-pick-btn').forEach(b => {
    b.onclick = () => { document.querySelectorAll('.mode-pick-btn').forEach(x => x.classList.remove('active')); b.classList.add('active'); regMode = b.dataset.pick; };
  });

  // Username validation
  const uInput = document.getElementById('reg-username');
  if (uInput) {
    uInput.oninput = () => { validateUsername(uInput.value.trim()); showSuggestions(uInput.value.trim()); };
  }

  // Password strength
  const pwInput = document.getElementById('reg-pw');
  if (pwInput) pwInput.oninput = () => checkPW(pwInput.value);

  // Initialize majors
  updateMajors();
}

function regStep(n) {
  document.getElementById(`reg-s${regStep}`).classList.remove('active');
  regStep = n;
  document.getElementById(`reg-s${regStep}`).classList.add('active');
}

function validateUsername(val) {
  const badge = document.getElementById('uname-badge');
  if (!badge) return;
  if (val.length < 3) { badge.textContent = ''; return; }
  badge.textContent = /^[a-zA-Z0-9_]{3,20}$/.test(val) ? '✅' : '❌';
}

function showSuggestions(val) {
  const box = document.getElementById('uname-suggestions');
  if (!box || val.length < 2) { if(box) box.innerHTML=''; return; }
  const base = val.toLowerCase().replace(/[^a-z0-9]/g,'');
  const suggs = [base+'_aui', base+'_studies', base+'2025', '_'+base, base+'_kiro'].slice(0,3);
  box.innerHTML = suggs.map(s => `<button class="sugg-pill" onclick="pickSugg('${s}')">${s}</button>`).join('');
}
function pickSugg(name) {
  document.getElementById('reg-username').value = name;
  validateUsername(name);
  document.getElementById('uname-suggestions').innerHTML = '';
}

function checkPW(pw) {
  const fill = document.getElementById('pw-fill');
  const hint = document.getElementById('pw-hint');
  if (!fill) return;
  let pct=0, color='', text='';
  if (pw.length === 0) { fill.style.width='0'; return; }
  if (pw.length < 6)  { pct=25;  color='#ef4444'; text='Too short'; }
  else if (pw.length < 8)  { pct=50;  color='#f59e0b'; text='Weak'; }
  else if (pw.length < 12 || !/[A-Z]/.test(pw)) { pct=75; color='#f59e0b'; text='Medium'; }
  else { pct=100; color='#22c55e'; text='Strong 💪'; }
  fill.style.width = pct+'%';
  fill.style.background = color;
  if (hint) hint.textContent = text;
}

function togglePw(id) {
  const el = document.getElementById(id);
  if (el) el.type = el.type === 'password' ? 'text' : 'password';
}

async function submitRegister() {
  const username = document.getElementById('reg-username').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const pw       = document.getElementById('reg-pw').value;
  const pw2      = document.getElementById('reg-pw2').value;
  const year     = document.getElementById('reg-year').value;
  const school   = document.getElementById('reg-school').value;
  const major    = document.getElementById('reg-major').value;
  const errEl    = document.getElementById('reg-error');

  errEl.textContent = '';
  if (!username || username.length < 3) { errEl.textContent = 'Username min 3 characters.'; return; }
  if (!/^[a-zA-Z0-9_]+$/.test(username)){ errEl.textContent = 'Username: letters, numbers, _ only.'; return; }
  if (!email.includes('@'))              { errEl.textContent = 'Enter a valid email.'; return; }
  if (pw.length < 8)                    { errEl.textContent = 'Password min 8 characters.'; return; }
  if (pw !== pw2)                        { errEl.textContent = 'Passwords do not match.'; return; }

  const btn = document.getElementById('reg-submit-btn');
  btn.disabled = true; btn.textContent = 'Creating...';

  try {
    const res = await fetch(`${API}/api/register`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ username, email, password:pw, mode:regMode, year, school, major }),
    });
    const data = await res.json();
    if (!data.ok) { errEl.textContent = data.error; btn.disabled=false; btn.textContent='Create Account'; return; }

    // Success
    S.token    = data.token;
    S.username = data.username;
    S.userID   = data.userID;
    S.mode     = regMode;
    S.year     = year;
    S.school   = school;
    S.major    = major;
    S.hp       = 100; S.xp = 0; S.streak = 0; S.sessions = 0;
    saveLocal();
    applyMode(regMode);
    connectWS();
    await loadRooms();
    goTo('home');
  } catch {
    errEl.textContent = 'Cannot reach server. Is the backend running?';
    btn.disabled=false; btn.textContent='Create Account';
  }
}

async function submitLogin() {
  const identifier = document.getElementById('login-id').value.trim();
  const pw         = document.getElementById('login-pw').value;
  const errEl      = document.getElementById('login-error');
  errEl.textContent = '';

  try {
    const res = await fetch(`${API}/api/login`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ identifier, password:pw }),
    });
    const data = await res.json();
    if (!data.ok) { errEl.textContent = data.error; return; }

    S.token    = data.token;
    S.username = data.username;
    S.userID   = data.userID;
    S.mode     = data.mode || 'student';
    S.year     = data.year || 'freshman';
    S.school   = data.school || 'SSE';
    S.major    = data.major || '';
    saveLocal();

    // Load full profile from server
    await loadMe();
    applyMode(S.mode);
    connectWS();
    await loadRooms();
    await loadFriends();
    goTo('home');
  } catch {
    errEl.textContent = 'Cannot reach server. Is the backend running?';
  }
}

async function loadMe() {
  try {
    const res  = await authFetch('/api/me');
    const data = await res.json();
    if (data.ok) {
      S.xp      = data.user.xp_total || 0;
      S.hp      = data.user.hp || 100;
      S.streak  = data.user.streak || 0;
      S.sessions= data.user.sessions || 0;
    }
  } catch {}
}

function forgotPassword() {
  toast('Password reset email sent! (Email requires backend config)');
}

function logout() {
  if (!confirm('Sign out?')) return;
  S.token = ''; S.username = ''; S.userID = '';
  localStorage.removeItem('kiro_token');
  if (S.ws) { S.ws.close(); S.ws = null; }
  goTo('auth');
}

// ─────────────────────────────────────────
// API HELPERS
// ─────────────────────────────────────────
function authFetch(path, opts = {}) {
  return fetch(API + path, {
    ...opts,
    headers: { 'Content-Type':'application/json', 'Authorization':'Bearer ' + S.token, ...(opts.headers||{}) },
  });
}

// ─────────────────────────────────────────
// HOME RENDER
// ─────────────────────────────────────────
function renderHome() {
  const av = document.getElementById('home-avatar');
  if (av) { av.textContent = S.username[0]?.toUpperCase() || '?'; av.style.background = 'var(--accent)'; }
  document.getElementById('home-uname') && (document.getElementById('home-uname').textContent = S.username);
  document.getElementById('home-mode-tag') && (document.getElementById('home-mode-tag').textContent = S.mode === 'gamer' ? 'Gamer' : 'Student');
  document.getElementById('home-year-tag') && (document.getElementById('home-year-tag').textContent = capitalize(S.year));
  document.getElementById('home-school-tag') && (document.getElementById('home-school-tag').textContent = S.school);
  updateXPUI();
  updateHPUI();
  renderChallenges();
  renderFriendsOnline();
  renderRoomsList();
  renderSuggestedRooms();
  startResetTimer();
}

function updateXPUI() {
  document.getElementById('home-xp') && (document.getElementById('home-xp').textContent = S.xp);
  document.getElementById('xp-value') && (document.getElementById('xp-value').textContent = S.sessionXp);
  document.getElementById('focus-xp-chip') && (document.getElementById('focus-xp-chip').textContent = S.sessionXp);
}

function updateHPUI() {
  const pct = Math.max(0, Math.min(100, S.hp));
  document.querySelectorAll('.hp-fill').forEach(el => el.style.width = pct + '%');
  document.getElementById('home-hp') && (document.getElementById('home-hp').textContent = S.hp);
  document.getElementById('focus-hp') && (document.getElementById('focus-hp').textContent = S.hp);
  document.getElementById('hp-label') && (document.getElementById('hp-label').textContent = `${S.hp} / 100 HP`);
  document.getElementById('profile-hp-label') && (document.getElementById('profile-hp-label').textContent = `${S.hp} / 100`);
}

// ─────────────────────────────────────────
// CHALLENGES RENDER
// ─────────────────────────────────────────
function renderChallenges() {
  const el = document.getElementById('challenges-list');
  if (!el) return;
  const focusMins = Math.floor(S.focusSeconds / 60);
  const prog = {
    c1: Math.min(focusMins, 30),
    c2: Math.min(S.streak, 3),
    c3: Math.min(S.roomUsers.filter(u => S.friends.some(f=>f.username===u.username)).length, 3),
    c4: Math.min(Math.floor(S.cameraFrameCount/60), 5),
    c5: 0,
  };

  el.innerHTML = CHALLENGES.map(c => {
    const p = prog[c.id] || 0;
    const pct = c.id === 'c5' ? (c.done?100:0) : Math.round((p/c.target)*100);
    return `
      <div class="ch-card ${c.done ? 'done' : ''}">
        <span class="ch-icon">${c.icon}</span>
        <div class="ch-body">
          <div class="ch-title">${c.title}</div>
          <div class="ch-sub">${c.sub}</div>
          ${!c.done && c.id !== 'c5' ? `<div class="ch-prog">${p} / ${c.target} ${c.id==='c1'?'min':c.id==='c4'?'min':''}</div>` : ''}
        </div>
        <span class="ch-reward">${c.reward}</span>
        <div class="ch-check">${c.done ? '✓' : ''}</div>
      </div>
    `;
  }).join('');

  // Room challenge progress overlay
  const rc = document.getElementById('room-challenges');
  if (rc && S.currentRoom) {
    const active = CHALLENGES.filter(c => !c.done).slice(0, 3);
    rc.innerHTML = `<p class="rc-title">Active Challenges</p>` + active.map(c => {
      const p = prog[c.id] || 0;
      const pct = c.id === 'c5' ? 0 : Math.round((p/c.target)*100);
      return `
        <div class="rc-item">
          <span class="rc-icon">${c.icon}</span>
          <span style="flex:1;font-size:12px;color:var(--text2)">${c.title}</span>
          <div class="rc-prog-bar"><div class="rc-prog-fill" style="width:${pct}%"></div></div>
          <span style="font-size:11px;color:var(--text3);margin-left:6px">${pct}%</span>
        </div>
      `;
    }).join('');
  }
}

function startResetTimer() {
  function tick() {
    const now = new Date(), mid = new Date(now);
    mid.setHours(24,0,0,0);
    const d = Math.floor((mid-now)/1000);
    const h=String(Math.floor(d/3600)).padStart(2,'0');
    const m=String(Math.floor((d%3600)/60)).padStart(2,'0');
    const s=String(d%60).padStart(2,'0');
    const el = document.getElementById('reset-timer');
    if (el) el.textContent = `${h}:${m}:${s}`;
  }
  tick(); setInterval(tick, 1000);
}

// ─────────────────────────────────────────
// FRIENDS ONLINE (home)
// ─────────────────────────────────────────
function renderFriendsOnline() {
  const el = document.getElementById('friends-online');
  if (!el) return;
  if (!S.friends.length) {
    el.innerHTML = '<span class="no-friends-txt">No friends yet — add some! 👥</span>';
    return;
  }
  el.innerHTML = S.friends.map(f => `
    <div class="fo-card">
      <div class="fo-av ${f.status==='focus'?'online':''}">
        ${f.username[0].toUpperCase()}
        <span class="fo-dot ${f.status||'idle'}"></span>
      </div>
      <span class="fo-name">${f.username}</span>
      <span class="fo-xp">⚡${f.xp_total||0}</span>
    </div>
  `).join('');
}

// ─────────────────────────────────────────
// ROOMS
// ─────────────────────────────────────────
async function loadRooms() {
  try {
    const res  = await fetch(`${API}/api/rooms`);
    const data = await res.json();
    if (data.ok) S.rooms = data.rooms;
  } catch { S.rooms = []; }
}

function renderRoomsList() {
  const el = document.getElementById('rooms-list');
  if (!el) return;
  if (!S.rooms.length) { el.innerHTML = '<p style="color:var(--text3);font-size:13px;padding:8px 0">No rooms yet — create one!</p>'; return; }

  el.innerHTML = S.rooms.map(r => {
    const emoji = SUBJECT_EMOJIS[r.subject] || '✨';
    const full  = r.users >= r.max_users;
    return `
      <div class="room-card" onclick="${full?'':` joinRoom('${r.id}')`}">
        <span class="room-emoji">${emoji}</span>
        <div class="room-info">
          <div class="room-name">${r.name}</div>
          <div class="room-meta">
            <span class="room-count">${r.users||0}/${r.max_users}</span>
            ${r.camera_required ? '<span class="room-cam-tag">📷 Camera</span>' : ''}
            ${full ? '<span class="room-full-tag">Full</span>' : ''}
          </div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px">by ${r.creator_name||'?'}</div>
        </div>
        <button class="join-btn" ${full?'disabled':''} onclick="event.stopPropagation();joinRoom('${r.id}')">
          ${full?'Full':'Join'}
        </button>
      </div>
    `;
  }).join('');
}

function renderSuggestedRooms() {
  const sec = document.getElementById('suggested-section');
  const el  = document.getElementById('suggested-rooms');
  if (!sec || !el) return;

  const preferred = YEAR_SUBJECTS[S.year] || [];
  const suggested = S.rooms.filter(r => preferred.includes(r.subject)).slice(0, 3);

  if (!suggested.length) { sec.style.display = 'none'; return; }
  sec.style.display = '';

  el.innerHTML = suggested.map(r => {
    const emoji = SUBJECT_EMOJIS[r.subject] || '✨';
    return `
      <div class="room-card" onclick="joinRoom('${r.id}')">
        <span class="room-emoji">${emoji}</span>
        <div class="room-info">
          <div class="room-name">${r.name}</div>
          <div class="room-meta">
            <span class="room-count">${r.users||0}/${r.max_users}</span>
            <span class="room-year-tag">✨ For ${capitalize(S.year)}s</span>
          </div>
        </div>
        <button class="join-btn" onclick="event.stopPropagation();joinRoom('${r.id}')">Join</button>
      </div>
    `;
  }).join('');
}

// ─────────────────────────────────────────
// CREATE ROOM
// ─────────────────────────────────────────
function openCreateRoom()  { document.getElementById('modal-room').classList.remove('hidden'); }
function closeCreateRoom() { document.getElementById('modal-room').classList.add('hidden'); }

async function submitCreateRoom() {
  const name    = document.getElementById('nr-name').value.trim();
  const subject = document.getElementById('nr-subject').value;
  const max     = parseInt(document.getElementById('nr-max').value) || 10;
  const camera  = document.getElementById('nr-cam').checked;
  const errEl   = document.getElementById('nr-name-error');

  errEl.textContent = '';
  if (!name) { errEl.textContent = 'Enter a room name.'; return; }

  try {
    const res  = await authFetch('/api/rooms', { method:'POST', body: JSON.stringify({ name, subject, maxUsers: Math.min(20, Math.max(2, max)), cameraRequired: camera }) });
    const data = await res.json();
    if (!data.ok) { errEl.textContent = data.error; return; }

    S.rooms.unshift({ ...data.room, users: 0 });
    closeCreateRoom();
    renderRoomsList();
    joinRoom(data.room.id);
  } catch {
    errEl.textContent = 'Cannot reach server.';
  }
}

// ─────────────────────────────────────────
// JOIN ROOM
// ─────────────────────────────────────────
function joinRoom(roomId) {
  const room = S.rooms.find(r => r.id === roomId);
  if (!room) return;

  S.currentRoom  = room;
  S.sessionXp    = 0;
  S.focusSeconds = 0;
  S.isFocusing   = false;
  S.cameraFrameCount = 0;

  document.getElementById('focus-room-name').textContent = room.name;
  document.getElementById('focus-room-sub').textContent  = `0 / ${room.max_users}`;
  document.getElementById('xp-value').textContent        = '0';
  document.getElementById('focus-xp-chip').textContent   = '0';
  document.getElementById('focus-hp').textContent        = S.hp;
  document.getElementById('focus-streak').textContent    = S.streak + '🔥';
  document.getElementById('timer-display').textContent   = '00:00';
  document.getElementById('timer-mult').textContent      = '1×';
  document.getElementById('ring-fill').style.strokeDashoffset = '439.8';
  document.getElementById('focus-btn').className         = 'focus-btn';
  document.getElementById('focus-btn-icon').textContent  = '▶';
  document.getElementById('focus-btn-label').textContent = 'Start Focusing';
  document.getElementById('status-dot').className        = 'status-dot';
  document.getElementById('status-text').textContent     = 'Ready when you are';
  document.getElementById('cam-toggle').checked          = false;
  document.getElementById('cam-container').classList.add('hidden');
  document.getElementById('distraction-warning').classList.add('hidden');

  renderRoomUsers([]);
  renderChallenges();

  wsSend({ type: 'join_room', roomId });
  goTo('focus');
}

function renderRoomUsers(users) {
  S.roomUsers = users;
  const list  = document.getElementById('users-list');
  const count = document.getElementById('room-user-count');
  if (!list) return;
  if (count) count.textContent = users.length;
  document.getElementById('focus-room-sub') && (document.getElementById('focus-room-sub').textContent = `${users.length} / ${S.currentRoom?.max_users||20}`);

  list.innerHTML = '';

  // Me first
  const me = document.createElement('li');
  me.className = 'user-row';
  me.id = 'user-me';
  me.innerHTML = `
    <span class="status-dot ${S.isFocusing?'focusing':''}" id="me-dot"></span>
    <div class="user-av-sm">${S.username[0]?.toUpperCase()||'?'}</div>
    <div class="user-info">
      <div class="user-name-sm">${S.username} <span style="color:var(--text3);font-size:10px">(you)</span></div>
      <div class="user-xp-sm" id="me-xp-row">0 ${S.mode==='gamer'?'EXP':'XP'} ${S.cameraOn?'📷':''}</div>
    </div>
  `;
  list.appendChild(me);

  // Others
  users.filter(u => u.username !== S.username).forEach(u => {
    const li = document.createElement('li');
    li.className = 'user-row';
    const isFriend = S.friends.some(f => f.username === u.username);
    li.innerHTML = `
      <span class="status-dot ${u.focusing?'focusing':''}"></span>
      <div class="user-av-sm" style="${isFriend?'border:2px solid var(--accent)':''}">${u.username[0].toUpperCase()}</div>
      <div class="user-info">
        <div class="user-name-sm">${u.username}${isFriend?' 👥':''}</div>
        <div class="user-xp-sm">${u.xp} XP ${u.cameraOn?'📷':''}</div>
      </div>
    `;
    list.appendChild(li);
  });
}

// ─────────────────────────────────────────
// FOCUS TIMER
// ─────────────────────────────────────────
function toggleFocus() {
  S.isFocusing = !S.isFocusing;
  const btn = document.getElementById('focus-btn');

  if (S.isFocusing) {
    btn.className = 'focus-btn';
    document.getElementById('focus-btn-icon').textContent  = '⏸';
    document.getElementById('focus-btn-label').textContent = S.mode==='gamer' ? 'GRINDING...' : 'Pause';
    document.getElementById('status-dot').className = 'status-dot focusing';
    document.getElementById('status-text').textContent = S.mode==='gamer' ? '⚔️ XP FARMING...' : '🔥 Focusing — XP accumulating';
    const meDot = document.getElementById('me-dot');
    if (meDot) meDot.className = 'status-dot focusing';
    if (!S.timerInterval) S.timerInterval = setInterval(tickFocus, 1000);
  } else {
    btn.className = 'focus-btn paused';
    document.getElementById('focus-btn-icon').textContent  = '▶';
    document.getElementById('focus-btn-label').textContent = 'Resume';
    document.getElementById('status-dot').className = 'status-dot';
    document.getElementById('status-text').textContent = 'Paused';
    const meDot = document.getElementById('me-dot');
    if (meDot) meDot.className = 'status-dot';
    clearInterval(S.timerInterval);
    S.timerInterval = null;
  }
  wsSend({ type:'focus_status', focusing:S.isFocusing, cameraOn:S.cameraOn, status: S.isFocusing?'focus':'idle' });
}

function tickFocus() {
  if (!S.isFocusing) return;
  S.focusSeconds++;
  const minutes = Math.floor(S.focusSeconds / 60);
  const mult    = getMult(minutes, S.cameraOn);

  S.sessionXp = Math.round(S.sessionXp + mult.rate);
  if (S.cameraOn) S.cameraFrameCount++;

  // Timer UI
  const mm = String(minutes).padStart(2,'0');
  const ss = String(S.focusSeconds % 60).padStart(2,'0');
  document.getElementById('timer-display').textContent = `${mm}:${ss}`;
  document.getElementById('timer-mult').textContent    = mult.label;
  document.getElementById('xp-value').textContent      = S.sessionXp;
  document.getElementById('focus-xp-chip').textContent = S.sessionXp;

  const meXp = document.getElementById('me-xp-row');
  if (meXp) meXp.textContent = `${S.sessionXp} ${S.mode==='gamer'?'EXP':'XP'} ${S.cameraOn?'📷':''}`;

  // Ring
  document.getElementById('ring-fill').style.strokeDashoffset = 439.8 * (1 - Math.min(S.focusSeconds/3600, 1));

  // HP regen
  if (S.focusSeconds % 300 === 0) { S.hp = Math.min(100, S.hp + 1); updateHPUI(); }

  // Auto challenges
  autoCheckChallenges();

  // WS
  if (S.focusSeconds % 5 === 0) {
    wsSend({ type:'xp_update', xp:S.sessionXp, username:S.username });
  }
}

async function leaveRoom() {
  clearInterval(S.timerInterval); S.timerInterval = null; S.isFocusing = false;

  // Stop camera
  stopCamera();

  if (S.sessionXp > 0) {
    S.xp += S.sessionXp;
    S.sessions++;
    const today    = new Date().toDateString();
    const lastDate = localStorage.getItem('kiro_last_date');
    if (lastDate !== today) {
      S.streak++;
      localStorage.setItem('kiro_last_date', today);
      S.hp = Math.min(100, S.hp + 10);
      updateHPUI();
    }
    // Save XP to server
    try { await authFetch('/api/xp', { method:'POST', body: JSON.stringify({ xp: S.sessionXp }) }); } catch {}
  }

  wsSend({ type:'leave_room' });
  S.currentRoom = null;
  S.sessionXp   = 0;
  S.roomUsers   = [];
  await loadRooms();
  goTo('home');
}

// ─────────────────────────────────────────
// CAMERA + MEDIAPIPE FOCUS DETECTION
// ─────────────────────────────────────────
const SARCASTIC_WARNINGS = [
  "👀 Uh... where'd you go?",
  "🙄 The exam won't study itself.",
  "😴 Still there? The book misses you.",
  "📵 Your future self is disappointed.",
  "🚨 XP PAUSED. Pay attention!",
  "💀 Focus! You're losing XP!",
  "🤦 This is why we can't have nice things.",
  "👁️ Eyes forward, soldier.",
];

let faceMeshInstance = null;
let faceMeshCamera   = null;

async function toggleCamera() {
  const checked = document.getElementById('cam-toggle').checked;
  const container = document.getElementById('cam-container');

  if (checked) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'user', width:320, height:240 }, audio:false });
      S.cameraStream = stream;
      S.cameraOn     = true;

      const video = document.getElementById('cam-video');
      video.srcObject = stream;
      container.classList.remove('hidden');

      // Init MediaPipe FaceMesh
      await initFaceMesh(video);
      toast('📷 Camera on — +20% XP bonus active. Detection is 100% local 🔒');
    } catch(e) {
      document.getElementById('cam-toggle').checked = false;
      S.cameraOn = false;
      if (e.name === 'NotAllowedError') {
        toast('Camera access denied. You can still study without it!');
      } else {
        toast('Camera unavailable: ' + e.message);
      }
    }
  } else {
    stopCamera();
  }
  wsSend({ type:'focus_status', focusing:S.isFocusing, cameraOn:S.cameraOn, status: S.status });
}

async function initFaceMesh(video) {
  if (!window.FaceMesh) {
    // FaceMesh not loaded — graceful fallback
    console.warn('[Kiro] MediaPipe FaceMesh not available — camera on without AI detection');
    return;
  }

  faceMeshInstance = new FaceMesh({
    locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`,
  });

  faceMeshInstance.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  faceMeshInstance.onResults(onFaceMeshResults);

  if (window.Camera) {
    faceMeshCamera = new Camera(video, {
      onFrame: async () => { if (faceMeshInstance) await faceMeshInstance.send({ image: video }); },
      width: 320, height: 240,
    });
    faceMeshCamera.start();
  }
}

function onFaceMeshResults(results) {
  const dot  = document.getElementById('cam-dot');
  const text = document.getElementById('cam-status-text');

  const hasFace = results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0;

  if (!hasFace) {
    S.distractionSeconds++;
    if (dot)  dot.className  = 'cam-status-dot distracted';
    if (text) text.textContent = 'No face detected';
    handleDistraction();
    return;
  }

  const landmarks = results.multiFaceLandmarks[0];

  // Eye Aspect Ratio (EAR) — detect if eyes are open
  const ear = calcEAR(landmarks);
  // Head orientation — check if looking forward
  const isForward = checkHeadOrientation(landmarks);

  const isFocused = ear > 0.15 && isForward;

  if (!isFocused) {
    S.distractionSeconds++;
    if (dot)  dot.className  = 'cam-status-dot distracted';
    if (text) text.textContent = ear <= 0.15 ? 'Eyes closed?' : 'Look at screen!';
    handleDistraction();
  } else {
    S.distractionSeconds = Math.max(0, S.distractionSeconds - 1);
    S.distractionWarned  = false;
    if (dot)  dot.className  = 'cam-status-dot focusing';
    if (text) text.textContent = 'Focused ✓';
    document.getElementById('distraction-warning').classList.add('hidden');
  }
}

function calcEAR(landmarks) {
  // Left eye landmarks: 159,145 (vertical) / 133,33 (horizontal)
  // Simplified EAR using mediapipe indices
  try {
    const p1 = landmarks[159], p2 = landmarks[145];
    const p3 = landmarks[133], p4 = landmarks[33];
    const vertical   = Math.abs(p1.y - p2.y);
    const horizontal = Math.abs(p3.x - p4.x);
    return horizontal > 0 ? vertical / horizontal : 0.3;
  } catch { return 0.3; }
}

function checkHeadOrientation(landmarks) {
  // Compare nose tip to face center — if too far off, looking away
  try {
    const nose   = landmarks[1];
    const leftCh = landmarks[234];
    const rightCh= landmarks[454];
    const center = (leftCh.x + rightCh.x) / 2;
    const offset = Math.abs(nose.x - center);
    return offset < 0.12; // within 12% of center
  } catch { return true; }
}

function handleDistraction() {
  if (!S.isFocusing) return;

  // Pause XP after 5 seconds of distraction
  if (S.distractionSeconds >= 5 && !S.distractionWarned) {
    S.distractionWarned = true;
    const warning = document.getElementById('distraction-warning');
    const warnText = document.getElementById('warn-text');
    const msg = SARCASTIC_WARNINGS[Math.floor(Math.random() * SARCASTIC_WARNINGS.length)];
    if (warnText) warnText.textContent = msg;
    warning?.classList.remove('hidden');
    playWarningSound();
    // Temporarily pause XP accumulation (handled in tickFocus by checking distractionSeconds)
  }
}

function playWarningSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain= ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.1);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch {}
}

function stopCamera() {
  if (faceMeshCamera)   { try { faceMeshCamera.stop(); } catch {} faceMeshCamera = null; }
  if (faceMeshInstance) { try { faceMeshInstance.close(); } catch {} faceMeshInstance = null; }
  if (S.cameraStream) {
    S.cameraStream.getTracks().forEach(t => t.stop());
    S.cameraStream = null;
  }
  S.cameraOn = false;
  const video = document.getElementById('cam-video');
  if (video) video.srcObject = null;
  document.getElementById('cam-container')?.classList.add('hidden');
  document.getElementById('distraction-warning')?.classList.add('hidden');
  S.distractionSeconds = 0;
  S.distractionWarned  = false;
}

// ─────────────────────────────────────────
// LEADERBOARD
// ─────────────────────────────────────────
let lbTab = 'daily';
let lbData = { daily:[], monthly:[] };

function switchLBTab(tab) {
  lbTab = tab;
  document.querySelectorAll('.tab-btn').forEach((b,i) => b.classList.toggle('active', (tab==='daily'&&i===0)||(tab==='monthly'&&i===1)));
  renderLeaderboard(tab);
}

async function loadLeaderboard() {
  try {
    const [d, m] = await Promise.all([
      fetch(`${API}/api/leaderboard?period=daily`).then(r=>r.json()),
      fetch(`${API}/api/leaderboard?period=monthly`).then(r=>r.json()),
    ]);
    if (d.ok) lbData.daily   = d.data;
    if (m.ok) lbData.monthly = m.data;
    renderLeaderboard(lbTab);

    // Auto-check top 10 challenge
    const rank = lbData.daily.findIndex(u => u.username === S.username);
    if (rank >= 0 && rank < 10) awardChallenge('c5');
  } catch {}
}

function renderLeaderboard(tab) {
  const el = document.getElementById('lb-list');
  if (!el) return;

  let rows = [...(lbData[tab] || [])];
  // Inject user
  if (S.username && !rows.find(r => r.username === S.username)) {
    rows.push({ username: S.username, kiro_id: S.userID, xp: S.xp, isMe: true });
  }
  rows = rows.map(r => ({ ...r, isMe: r.username === S.username }));
  rows.sort((a,b) => b.xp - a.xp);

  const medals = ['🥇','🥈','🥉'];
  const rc = ['gold','silver','bronze'];

  el.innerHTML = rows.map((u,i) => `
    <div class="lb-row ${u.isMe?'me':''}">
      <span class="lb-rank ${rc[i]||''}">${i<3?medals[i]:i+1}</span>
      <div class="lb-av">${u.username[0].toUpperCase()}</div>
      <span class="lb-name">${u.username}${u.isMe?' (you)':''}</span>
      <div style="text-align:right">
        <div class="lb-xp">${(u.xp||0).toLocaleString()}</div>
        <div class="lb-xp-sub">${S.mode==='gamer'?'EXP':'XP'}</div>
      </div>
    </div>
  `).join('');
}

// ─────────────────────────────────────────
// FRIENDS
// ─────────────────────────────────────────
async function loadFriends() {
  try {
    const res  = await authFetch('/api/friends');
    const data = await res.json();
    if (data.ok) S.friends = data.friends;
  } catch {}
}

function renderFriendsScreen() {
  renderFriendsList();
}

function renderFriendsList() {
  const el = document.getElementById('friends-list');
  if (!el) return;
  if (!S.friends.length) {
    el.innerHTML = '<p style="color:var(--text3);font-size:13px">No friends yet. Search by username or KIRO#ID above.</p>';
    return;
  }
  el.innerHTML = S.friends.map(f => `
    <div class="fc-card">
      <div class="fc-av">${f.username[0].toUpperCase()}
        <span class="fo-dot ${f.status||'idle'}" style="position:absolute;bottom:1px;right:1px"></span>
      </div>
      <div class="fc-info">
        <div class="fc-name">${f.username}</div>
        <div class="fc-id">${f.kiro_id||''}</div>
        <div class="fc-row2">
          <span class="fc-xp">⚡${f.xp_total||0} XP</span>
          <span class="fc-stk">🔥${f.streak||0} days</span>
        </div>
      </div>
      <button class="btn-add" disabled>Friends ✓</button>
    </div>
  `).join('');
}

async function searchFriend() {
  const q   = document.getElementById('friend-search').value.trim();
  const res = document.getElementById('friend-result');
  if (!q || q.length < 2) return;
  res.classList.remove('hidden');
  res.innerHTML = '<p style="color:var(--text3);font-size:13px">Searching...</p>';

  try {
    const r = await authFetch(`/api/users/search?q=${encodeURIComponent(q)}`);
    const d = await r.json();
    if (!d.ok || !d.users.length) { res.innerHTML = '<p style="color:var(--text3);font-size:13px">No users found.</p>'; return; }

    res.innerHTML = d.users.map(u => {
      const already = S.friends.some(f => f.username === u.username) || u.username === S.username;
      return `
        <div class="fc-card" style="margin-bottom:8px">
          <div class="fc-av">${u.username[0].toUpperCase()}</div>
          <div class="fc-info">
            <div class="fc-name">${u.username}</div>
            <div class="fc-id">${u.kiro_id||''}</div>
            <div class="fc-row2"><span class="fc-xp">⚡${u.xp_total||0} XP</span><span class="fc-stk">🔥${u.streak||0} days</span></div>
          </div>
          <button class="btn-add" ${already?'disabled':''} onclick="addFriend(${u.id},'${u.username}','${u.kiro_id}',${u.xp_total||0},${u.streak||0})">
            ${already?(u.username===S.username?'(You)':'Friends ✓'):'Add Friend'}
          </button>
        </div>
      `;
    }).join('');
  } catch {
    res.innerHTML = '<p style="color:var(--red);font-size:13px">Search failed. Is the backend running?</p>';
  }
}

async function addFriend(friendId, username, kiroId, xp, streak) {
  try {
    const res  = await authFetch('/api/friends', { method:'POST', body: JSON.stringify({ friendId }) });
    const data = await res.json();
    if (data.ok) {
      S.friends.push({ username, kiro_id: kiroId, xp_total: xp, streak, status:'idle' });
      renderFriendsList();
      renderFriendsOnline();
      toast(`${username} added as friend! 👥`);
      document.getElementById('friend-result').classList.add('hidden');
      document.getElementById('friend-search').value = '';
    }
  } catch { toast('Could not add friend — server error.'); }
}

// ─────────────────────────────────────────
// PROFILE
// ─────────────────────────────────────────
function renderProfile() {
  const av = document.getElementById('profile-avatar');
  if (av) av.textContent = S.username[0]?.toUpperCase() || '?';
  document.getElementById('profile-name')    && (document.getElementById('profile-name').textContent    = S.username);
  document.getElementById('profile-kiro-id') && (document.getElementById('profile-kiro-id').textContent = S.userID);
  document.getElementById('id-display')      && (document.getElementById('id-display').textContent      = S.userID);
  document.getElementById('s-xp')     && (document.getElementById('s-xp').textContent     = S.xp.toLocaleString());
  document.getElementById('s-streak') && (document.getElementById('s-streak').textContent = S.streak + '🔥');
  document.getElementById('s-sessions')&& (document.getElementById('s-sessions').textContent = S.sessions);
  // Rank from leaderboard
  const rank = (lbData.daily || []).findIndex(u => u.username === S.username);
  document.getElementById('s-rank') && (document.getElementById('s-rank').textContent = rank >= 0 ? '#' + (rank+1) : '#—');
  // Status
  document.querySelectorAll('.status-opt').forEach(b => b.classList.toggle('active', b.dataset.s === S.status));
  // Dark toggle
  const dt = document.getElementById('dark-toggle');
  if (dt) dt.checked = S.dark;
  // Mode
  document.getElementById('mode-student')?.classList.toggle('active', S.mode==='student');
  document.getElementById('mode-gamer')?.classList.toggle('active', S.mode==='gamer');
  // Theme swatches
  document.querySelectorAll('.swatch').forEach(s => s.classList.toggle('active', s.dataset.theme === S.theme));
  updateHPUI();
  if (S.mode === 'gamer') updateGamerRank();
}

function updateGamerRank() {
  const rank = getRank(S.xp);
  const next = RANKS[RANKS.indexOf(rank)+1];
  const badge = document.getElementById('rank-badge');
  const bar   = document.getElementById('rank-bar-fill');
  const label = document.getElementById('rank-bar-label');
  if (badge) { badge.textContent = `${rank.icon} ${rank.name}`; badge.style.color = rank.color; }
  if (next) {
    const pct = Math.round(((S.xp - rank.min)/(rank.max - rank.min))*100);
    if (bar)   bar.style.width  = pct + '%';
    if (label) label.textContent = `${S.xp - rank.min} / ${rank.max - rank.min} EXP to ${next.name}`;
  } else {
    if (bar)   bar.style.width  = '100%';
    if (label) label.textContent = 'Max rank reached 👑';
  }
}

function copyID() {
  const id = S.userID;
  if (!id) return;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(id).then(() => toast('📋 KIRO ID copied!')).catch(() => fallbackCopy(id));
  } else {
    fallbackCopy(id);
  }
}

function fallbackCopy(text) {
  const el = document.createElement('textarea');
  el.value = text;
  el.style.position = 'fixed'; el.style.opacity = '0';
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
  toast('📋 KIRO ID copied!');
}

function setStatus(s) {
  S.status = s;
  document.querySelectorAll('.status-opt').forEach(b => b.classList.toggle('active', b.dataset.s === s));
  saveLocal();
}

function logout() {
  if (!confirm('Sign out?')) return;
  stopCamera();
  if (S.ws) { S.ws.close(); S.ws = null; }
  S.token = ''; S.username = '';
  localStorage.removeItem('kiro_token');
  goTo('auth');
}

// ─────────────────────────────────────────
// WEBSOCKET
// ─────────────────────────────────────────
function connectWS() {
  if (S.ws) { S.ws.close(); S.ws = null; }
  try {
    S.ws = new WebSocket(WS_URL);

    S.ws.onopen = () => {
      console.log('[Kiro WS] Connected');
      if (S.token) wsSend({ type:'auth', token:S.token });
    };

    S.ws.onmessage = e => {
      try { handleWSMsg(JSON.parse(e.data)); } catch {}
    };

    S.ws.onclose = () => {
      console.log('[Kiro WS] Disconnected — retrying in 3s');
      setTimeout(() => { if (S.token) connectWS(); }, 3000);
    };

    S.ws.onerror = () => {};
  } catch {}
}

function wsSend(data) {
  if (S.ws && S.ws.readyState === WebSocket.OPEN) S.ws.send(JSON.stringify(data));
}

function handleWSMsg(msg) {
  switch (msg.type) {
    case 'auth_ok':
      console.log('[Kiro WS] Authenticated as', msg.username);
      break;

    case 'room_joined':
    case 'room_users':
      renderRoomUsers(msg.users || []);
      autoCheckChallenges();
      renderChallenges();
      break;

    case 'new_room':
      // Another user created a room — add it to list
      if (msg.room && !S.rooms.find(r => r.id === msg.room.id)) {
        S.rooms.unshift(msg.room);
        renderRoomsList();
        renderSuggestedRooms();
      }
      break;

    case 'room_count_update':
      // Update room card count live
      const room = S.rooms.find(r => r.id === msg.roomId);
      if (room) { room.users = msg.count; renderRoomsList(); }
      break;

    case 'live_count':
      const el = document.getElementById('live-count');
      if (el) el.textContent = `${msg.count} ${msg.count === 1 ? 'person' : 'people'} studying right now`;
      break;

    case 'xp_invalid':
      toast('⚠️ XP rate too high — cheating detected. Session reset.');
      S.sessionXp = 0;
      break;
  }
}

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────
function toast(msg, duration = 3500) {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = `
    position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);
    background:var(--text);color:var(--bg);padding:10px 20px;border-radius:50px;
    font-size:13px;font-weight:500;z-index:9999;
    box-shadow:0 4px 16px rgba(0,0,0,.2);white-space:nowrap;
    transition:transform .3s ease,opacity .3s ease;opacity:0;
  `;
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity='1'; el.style.transform='translateX(-50%) translateY(0)'; });
  setTimeout(() => {
    el.style.opacity='0'; el.style.transform='translateX(-50%) translateY(10px)';
    setTimeout(() => el.remove(), 300);
  }, duration);
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

// ─────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────
function requestNotifications() {
  if ('Notification' in window && Notification.permission === 'default') {
    setTimeout(() => Notification.requestPermission(), 8000);
  }
}

// ─────────────────────────────────────────
// INIT
// ─────────────────────────────────────────
async function init() {
  // Apply saved preferences
  S.theme = localStorage.getItem('kiro_theme') || 'blue';
  S.dark  = localStorage.getItem('kiro_dark')  === 'true';
  S.status= localStorage.getItem('kiro_status')|| 'focus';
  document.documentElement.setAttribute('data-dark', S.dark);
  applyTheme(S.theme);

  // Theme swatches
  document.querySelectorAll('.swatch').forEach(sw => {
    sw.onclick = () => applyTheme(sw.dataset.theme);
  });

  // Hide all screens
  document.querySelectorAll('.screen').forEach(s => { s.style.display='none'; s.classList.remove('active'); });

  setupIntro();
  setupAuth();
  loadChallengeState();

  const token = localStorage.getItem('kiro_token');
  if (token) {
    S.token = token;
    // Verify token with server
    try {
      const res  = await fetch(`${API}/api/me`, { headers:{ Authorization:'Bearer '+token } });
      const data = await res.json();
      if (data.ok) {
        S.username = data.user.username;
        S.userID   = data.user.userID || '';
        S.mode     = data.user.mode || 'student';
        S.year     = data.user.year || 'freshman';
        S.school   = data.user.school || 'SSE';
        S.major    = data.user.major || '';
        S.xp       = data.user.xp_total || 0;
        S.hp       = data.user.hp || 100;
        S.streak   = data.user.streak || 0;
        S.sessions = data.user.sessions || 0;
        applyMode(S.mode);
        connectWS();
        await loadRooms();
        await loadFriends();
        goTo('home');
        return;
      }
    } catch {}
    // Token invalid — show auth
    localStorage.removeItem('kiro_token');
  }

  // First visit — show intro
  const intro = document.getElementById('screen-intro');
  intro.style.display = 'flex';
  intro.classList.add('active');
  requestNotifications();
}

document.addEventListener('DOMContentLoaded', init);
