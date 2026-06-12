// STATE
const State = {
  // Auth
  username:    '',
  email:       '',
  userID:      '',
  mode:        'student',
  status:      'focus',
  isLoggedIn:  false,

  // Stats
  xp:          0,
  totalXp:     0,
  hp:          100,
  maxHp:       100,
  streak:      0,
  sessions:    0,

  // Focus session
  currentRoom:   null,
  isFocusing:    false,
  focusSeconds:  0,
  sessionXp:     0,
  timerInterval: null,
  cameraOn:      false,
  cameraStream:  null,

  friends: [],

  rooms: [
    { id:'math',    name:'Late Night Calculus', subject:'math',    emoji:'📐', users:5,  max:20, camera:false, creator:'sara_m' },
    { id:'cs',      name:'Hackers...come here',           subject:'cs',      emoji:'💻', users:9,  max:15, camera:false, creator:'karim99' },
    { id:'chem',    name:'Organic Chem SOS',    subject:'chemistry',emoji:'🧪',users:3,  max:10, camera:true,  creator:'lena_s' },
    { id:'lang',    name:'le francais e.g.',  subject:'languages',emoji:'🌍',users:7, max:20, camera:false, creator:'omar_b' },
    { id:'open',    name:'Open Study Hall',      subject:'open',    emoji:'✨', users:12, max:20, camera:false, creator:'yassin_x' },
  ],
};


const SUBJECT_EMOJIS = {
  math:'📐', cs:'💻', physics:'⚛️', chemistry:'🧪',
  biology:'🧬', languages:'🌍', history:'📜', open:'✨'
};

// CHALLENGES

const CHALLENGES = [
  { id:'c1', icon:'⏱️', title:'Focus for 30 minutes',    sub:'In any room',         reward:'+50 XP',  xpVal:50,  done:false },
  { id:'c2', icon:'🔥', title:'Maintain a 3 day streak', sub:'Log in 3 days in a row',reward:'+30 XP', xpVal:30,  done:false },
  { id:'c3', icon:'👥', title:'Study with 3 friends',    sub:'Join a room together', reward:'+40 XP',  xpVal:40,  done:false },
  { id:'c4', icon:'📸', title:'Use camera focus',        sub:'Enable camera in a room',reward:'+25 XP',xpVal:25,  done:false },
  { id:'c5', icon:'🏆', title:'Reach top 10',            sub:'On the daily leaderboard',reward:'+60 XP',xpVal:60, done:false },
];

// LEADERBOARD DATA
const LEADERBOARD = {
  daily: [
    { name:'Omar_B',   id:'KIRO#1042', xp:490 },
    { name:'Sara_M',   id:'KIRO#2201', xp:340 },
    { name:'Yassin_X', id:'KIRO#3318', xp:270 },
    { name:'Karim99',  id:'KIRO#4455', xp:210 },
    { name:'Lena_S',   id:'KIRO#5590', xp:180 },
    { name:'Nadia_K',  id:'KIRO#6612', xp:95  },
  ],
  monthly: [
    { name:'Omar_B',   id:'KIRO#1042', xp:8420 },
    { name:'Yassin_X', id:'KIRO#3318', xp:7100 },
    { name:'Sara_M',   id:'KIRO#2201', xp:6540 },
    { name:'Lena_S',   id:'KIRO#5590', xp:5200 },
    { name:'Karim99',  id:'KIRO#4455', xp:4300 },
    { name:'Nadia_K',  id:'KIRO#6612', xp:3100 },
  ],
};
// MULTIPLIER
function getMultiplier(minutes, cameraOn) {
  let base;
  if (minutes >= 50) base = 2.0;
  else if (minutes >= 25) base = 1.5;
  else if (minutes >= 10) base = 1.2;
  else base = 1.0;
  const cam = cameraOn ? 1.2 : 1.0;
  const total = +(base * cam).toFixed(2);
  return { rate: total, label: `${total}×` };
}
// PERSISTENCE
function saveState() {
  const data = {
    username: State.username, email: State.email,
    userID: State.userID, mode: State.mode,
    status: State.status, isLoggedIn: State.isLoggedIn,
    totalXp: State.totalXp, hp: State.hp,
    streak: State.streak, sessions: State.sessions,
    friends: State.friends, rooms: State.rooms,
    challenges: CHALLENGES.map(c => ({ id:c.id, done:c.done })),
    lastSave: Date.now(),
    lastDate: localStorage.getItem('kiro_last_date') || '',
  };
  localStorage.setItem('kiro_state', JSON.stringify(data));
}

function loadState() {
  try {
    const raw = localStorage.getItem('kiro_state');
    if (!raw) return;
    const data = JSON.parse(raw);

    State.username  = data.username  || '';
    State.email     = data.email     || '';
    State.userID    = data.userID    || '';
    State.mode      = data.mode      || 'student';
    State.status    = data.status    || 'focus';
    State.isLoggedIn= data.isLoggedIn|| false;
    State.totalXp   = data.totalXp  || 0;
    State.hp        = data.hp       || 100;
    State.streak    = data.streak   || 0;
    State.sessions  = data.sessions || 0;
    State.friends   = data.friends  || [];

    if (data.rooms && data.rooms.length > 0) State.rooms = data.rooms;

    // Restore challenge completion
    if (data.challenges) {
      data.challenges.forEach(c => {
        const ch = CHALLENGES.find(x => x.id === c.id);
        if (ch) ch.done = c.done;
      });
    }

    // HP decay: lose 10 HP per day of missed studying (max loss 50)
    const hoursAgo = (Date.now() - (data.lastSave || 0)) / (1000 * 60 * 60);
    if (hoursAgo > 24) {
      const daysLost = Math.min(Math.floor(hoursAgo / 24), 5);
      State.hp = Math.max(0, State.hp - daysLost * 10);
    }

    // Streak reset if >48h
    if (hoursAgo > 48 && State.streak > 0) {
      State.streak = 0;
    }

  } catch(e) {
    console.warn('State load failed, starting fresh');
  }
}

// GENERATE USER ID
function generateID(username) {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `KIRO#${num}`;
}

// MODE SYSTEM
function applyMode(mode) {
  State.mode = mode;
  document.documentElement.setAttribute('data-mode', mode);

  // Update labels for gamer mode
  const xpLabel = mode === 'gamer' ? 'EXP' : 'XP';
  document.querySelectorAll('.pill-unit[data-xp]').forEach(el => el.textContent = xpLabel);
  const xpUnitLabel = document.getElementById('xp-unit-label');
  if (xpUnitLabel) xpUnitLabel.textContent = xpLabel;

  const roomsTitle = document.getElementById('rooms-section-title');
  if (roomsTitle) roomsTitle.textContent = mode === 'gamer' ? '🎮 Zones' : '📚 Study Rooms';

  const challengesTitle = document.getElementById('challenges-title');
  if (challengesTitle) challengesTitle.textContent = mode === 'gamer' ? '⚔️ Daily Quests' : '🎯 Daily Challenges';

  const lbTitle = document.getElementById('lb-title');
  if (lbTitle) lbTitle.textContent = mode === 'gamer' ? 'Hall of Fame' : 'Leaderboard';

  const modeTag = document.getElementById('home-mode-tag');
  if (modeTag) modeTag.textContent = mode === 'gamer' ? 'Gamer' : 'Student';

  // Profile mode buttons
  document.getElementById('mode-btn-student')?.classList.toggle('active', mode === 'student');
  document.getElementById('mode-btn-gamer')?.classList.toggle('active', mode === 'gamer');
}

function setMode(mode) {
  applyMode(mode);
  saveState();
}

// THEME SYSTEM (student only)
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

// HP SYSTEM
function updateHP(newHP) {
  State.hp = Math.max(0, Math.min(State.maxHp, newHP));
  const pct = (State.hp / State.maxHp) * 100;
  const fills = document.querySelectorAll('.hp-bar-fill');
  fills.forEach(el => el.style.width = pct + '%');
  document.querySelectorAll('#home-hp, #focus-hp').forEach(el => el && (el.textContent = State.hp));
  document.getElementById('hp-bar-label') && (document.getElementById('hp-bar-label').textContent = `${State.hp} / ${State.maxHp} HP`);
  document.getElementById('profile-hp-val') && (document.getElementById('profile-hp-val').textContent = `${State.hp} / ${State.maxHp}`);
  document.getElementById('profile-hp-bar') && (document.getElementById('profile-hp-bar').style.width = pct + '%');
}

// SCREEN NAVIGATION
function goTo(screen) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.style.display = 'none';
  });
  const target = document.getElementById('screen-' + screen);
  if (!target) return;
  target.style.display = 'flex';
  requestAnimationFrame(() => requestAnimationFrame(() => target.classList.add('active')));

  if (screen === 'home')        renderHome();
  if (screen === 'leaderboard') renderLeaderboard('daily');
  if (screen === 'profile')     renderProfile();
  if (screen === 'friends')     renderFriends();
}

// INTRO SLIDES
let currentSlide = 0;
const TOTAL_SLIDES = 3;

function setupIntro() {
  document.getElementById('intro-next').addEventListener('click', () => {
    if (currentSlide < TOTAL_SLIDES - 1) {
      moveSlide(currentSlide + 1);
    } else {
      // Done — go to auth
      document.getElementById('screen-intro').style.display = 'none';
      document.getElementById('screen-intro').classList.remove('active');
      goTo('auth');
    }
  });
}

function moveSlide(next) {
  const slides = document.querySelectorAll('.intro-slide');
  const dots   = document.querySelectorAll('.dot');
  const btn    = document.getElementById('intro-next');

  slides[currentSlide].classList.add('exit');
  slides[currentSlide].classList.remove('active');
  setTimeout(() => slides[currentSlide].classList.remove('exit'), 500);

  currentSlide = next;
  slides[currentSlide].classList.add('active');
  dots.forEach((d,i) => d.classList.toggle('active', i === currentSlide));
  btn.textContent = currentSlide === TOTAL_SLIDES - 1 ? "Let's Go →" : "Next →";
}

// AUTH — REGISTER
let regMode = 'student';
let currentRegStep = 1;

function setupAuth() {
  // Tab switching
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('form-' + tab.dataset.tab).classList.add('active');
    });
  });

  // Mode pick buttons
  document.querySelectorAll('.mode-pick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-pick-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      regMode = btn.dataset.pick;
    });
  });

  // Username live validation + suggestions
  const usernameInput = document.getElementById('reg-username');
  if (usernameInput) {
    usernameInput.addEventListener('input', () => {
      const val = usernameInput.value.trim();
      validateUsername(val);
      showUsernameSuggestions(val);
    });
  }

  // Password strength
  const pwInput = document.getElementById('reg-password');
  if (pwInput) {
    pwInput.addEventListener('input', () => {
      checkPasswordStrength(pwInput.value);
    });
  }
}

function regNextStep(currentStep) {
  document.getElementById(`reg-step-${currentStep}`).classList.remove('active');
  document.getElementById(`reg-step-${currentStep + 1}`).classList.add('active');
  currentRegStep = currentStep + 1;
}

function validateUsername(val) {
  const status = document.getElementById('username-status');
  if (!status) return;
  if (val.length < 3) { status.textContent = ''; return; }
  // MVP: just check length and chars
  const valid = /^[a-zA-Z0-9_]{3,20}$/.test(val);
  status.textContent = valid ? '✅' : '❌';
}

function showUsernameSuggestions(val) {
  const box = document.getElementById('username-suggestions');
  if (!box || val.length < 2) { box.innerHTML = ''; return; }
  const base = val.toLowerCase().replace(/[^a-z0-9]/g, '');
  const suggestions = [
    base + '_studies', base + '_grinds', base + '2025',
    '_' + base, base + '_kiro'
  ].filter(s => s !== val).slice(0, 3);

  box.innerHTML = suggestions.map(s =>
    `<button class="suggestion-pill" onclick="pickSuggestion('${s}')">${s}</button>`
  ).join('');
}

function pickSuggestion(name) {
  document.getElementById('reg-username').value = name;
  validateUsername(name);
  document.getElementById('username-suggestions').innerHTML = '';
}

function checkPasswordStrength(pw) {
  const bar = document.getElementById('pw-strength');
  if (!bar) return;
  if (pw.length < 6)       { bar.className = 'pw-strength weak';   return; }
  if (pw.length < 10)      { bar.className = 'pw-strength medium';  return; }
  bar.className = 'pw-strength strong';
}

function togglePw(id) {
  const input = document.getElementById(id);
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
}

function submitRegister() {
  const username = document.getElementById('reg-username').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const pw       = document.getElementById('reg-password').value;
  const pw2      = document.getElementById('reg-password2').value;
  const errEl    = document.getElementById('reg-error');

  if (!username || username.length < 3) { errEl.textContent = 'Username must be at least 3 characters.'; return; }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) { errEl.textContent = 'Username: letters, numbers, underscores only.'; return; }
  if (!email.includes('@'))              { errEl.textContent = 'Enter a valid email.'; return; }
  if (pw.length < 8)                    { errEl.textContent = 'Password must be at least 8 characters.'; return; }
  if (pw !== pw2)                        { errEl.textContent = 'Passwords do not match.'; return; }

  // MVP: store hashed password (simple hash — use bcrypt in production)
  const hash = btoa(pw + username); // NOT secure, replace with backend auth later

  State.username  = username;
  State.email     = email;
  State.userID    = generateID(username);
  State.mode      = regMode;
  State.isLoggedIn= true;
  State.hp        = 100;
  State.totalXp   = 0;
  State.streak    = 0;
  State.sessions  = 0;
  State.friends   = [];

  // Store auth (MVP — local only)
  const accounts = JSON.parse(localStorage.getItem('kiro_accounts') || '{}');
  accounts[username.toLowerCase()] = { username, email, hash, userID: State.userID };
  localStorage.setItem('kiro_accounts', JSON.stringify(accounts));

  saveState();
  applyMode(regMode);
  goTo('home');
}

function submitLogin() {
  const loginId = document.getElementById('login-id').value.trim().toLowerCase();
  const pw      = document.getElementById('login-password').value;
  const errEl   = document.getElementById('login-error');

  const accounts = JSON.parse(localStorage.getItem('kiro_accounts') || '{}');

  // Find by username or email
  let account = accounts[loginId];
  if (!account) {
    account = Object.values(accounts).find(a => a.email.toLowerCase() === loginId);
  }

  if (!account) { errEl.textContent = 'Account not found.'; return; }

  const hash = btoa(pw + account.username);
  if (hash !== account.hash) { errEl.textContent = 'Wrong password.'; return; }

  // Load saved state for this user
  State.username  = account.username;
  State.email     = account.email;
  State.userID    = account.userID;
  State.isLoggedIn= true;
  loadState();
  State.username  = account.username; // ensure after load
  State.isLoggedIn= true;

  applyMode(State.mode || 'student');
  goTo('home');
}

function showForgot() {
  alert('Password reset: check your email at ' + (State.email || '(not set)') + '\n\n(Email sending requires backend — coming soon)');
}

function logout() {
  if (!confirm('Sign out?')) return;
  State.isLoggedIn = false;
  saveState();
  goTo('auth');
}

// HOME RENDER
function renderHome() {
  document.getElementById('home-username').textContent = State.username;
  document.getElementById('home-avatar-letter').textContent = State.username[0]?.toUpperCase() || '?';
  document.getElementById('home-xp').textContent = State.totalXp;
  updateHP(State.hp);
  applyMode(State.mode);
  renderChallenges();
  renderFriendsOnline();
  renderRoomsList();
  startResetTimer();
  updateLiveCount();
}

// CHALLENGES RENDER
function renderChallenges() {
  const list = document.getElementById('challenges-list');
  if (!list) return;
  list.innerHTML = CHALLENGES.map(c => `
    <div class="challenge-card ${c.done ? 'done' : ''}" id="ch-${c.id}">
      <span class="ch-icon">${c.icon}</span>
      <div class="ch-info">
        <div class="ch-title">${c.title}</div>
        <div class="ch-sub">${c.sub}</div>
      </div>
      <span class="ch-reward">${c.reward}</span>
      <div class="ch-check" onclick="completeChallenge('${c.id}')">${c.done ? '✓' : ''}</div>
    </div>
  `).join('');
}

function completeChallenge(id) {
  const ch = CHALLENGES.find(c => c.id === id);
  if (!ch || ch.done) return;
  ch.done = true;
  State.totalXp += ch.xpVal;
  updateHP(State.hp + 5); // HP bonus for completing challenge
  document.getElementById('home-xp').textContent = State.totalXp;
  renderChallenges();
  saveState();
  flashMessage(`+${ch.xpVal} XP! Challenge complete 🎯`);
}

// RESET TIMER (challenges reset countdown)
function startResetTimer() {
  function tick() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const diff = Math.floor((midnight - now) / 1000);
    const h = String(Math.floor(diff / 3600)).padStart(2, '0');
    const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
    const s = String(diff % 60).padStart(2, '0');
    const el = document.getElementById('reset-timer');
    if (el) el.textContent = `${h}:${m}:${s}`;
  }
  tick();
  setInterval(tick, 1000);
}

// FRIENDS ONLINE (home row)

function renderFriendsOnline() {
  const row = document.getElementById('friends-online-row');
  if (!row) return;

  if (State.friends.length === 0) {
    row.innerHTML = '<span class="no-friends-msg">No friends yet — add some! 👥</span>';
    return;
  }

  row.innerHTML = State.friends.map(f => `
    <div class="friend-online-card" onclick="goTo('friends')">
      <div class="fo-avatar ${f.status === 'focus' ? 'online' : ''}">
        ${f.username[0].toUpperCase()}
        <span class="fo-status-dot ${f.status || 'break'}"></span>
      </div>
      <span class="fo-name">${f.username}</span>
      <span class="fo-xp">⚡${f.xp || 0}</span>
    </div>
  `).join('');
}

// ROOMS LIST (home)

function renderRoomsList() {
  const list = document.getElementById('rooms-list');
  if (!list) return;

  list.innerHTML = State.rooms.map(room => {
    const full = room.users >= room.max;
    const emoji = SUBJECT_EMOJIS[room.subject] || '✨';
    return `
      <div class="room-card" onclick="${full ? '' : `joinRoom('${room.id}')`}">
        <span class="room-emoji">${emoji}</span>
        <div class="room-info">
          <div class="room-name">${room.name}</div>
          <div class="room-meta">
            <span class="room-count">${room.users}/${room.max} studying</span>
            ${room.camera ? '<span class="room-cam-badge">📷 Camera</span>' : ''}
            ${full ? '<span class="room-full-badge">Full</span>' : ''}
          </div>
        </div>
        <button class="join-btn-sm" ${full ? 'disabled' : ''} onclick="event.stopPropagation();joinRoom('${room.id}')">
          ${full ? 'Full' : 'Join'}
        </button>
      </div>
    `;
  }).join('');
}


// CREATE ROOM
function openCreateRoom() {
  document.getElementById('modal-create-room').classList.remove('hidden');
}
function closeCreateRoom() {
  document.getElementById('modal-create-room').classList.add('hidden');
}

function submitCreateRoom() {
  const name    = document.getElementById('new-room-name').value.trim();
  const subject = document.getElementById('new-room-subject').value;
  const max     = Math.min(20, Math.max(2, parseInt(document.getElementById('new-room-max').value) || 10));
  const camera  = document.getElementById('new-room-camera').checked;

  if (!name) { alert('Enter a room name'); return; }

  const newRoom = {
    id:      'room_' + Date.now(),
    name,
    subject,
    emoji:   SUBJECT_EMOJIS[subject] || '✨',
    users:   1,
    max,
    camera,
    creator: State.username,
  };

  State.rooms.unshift(newRoom);
  closeCreateRoom();
  saveState();
  renderRoomsList();
  // Auto-join the room you created
  joinRoom(newRoom.id);
}

// JOIN ROOM → FOCUS SCREEn
const FAKE_USERS = [
  { name:'Sara_M',   xp:340, focusing:true  },
  { name:'Karim99',  xp:210, focusing:false },
  { name:'Lena_S',   xp:180, focusing:true  },
  { name:'Omar_B',   xp:490, focusing:true  },
  { name:'Nadia_K',  xp:95,  focusing:false },
];

function joinRoom(roomId) {
  const room = State.rooms.find(r => r.id === roomId);
  if (!room) return;

  State.currentRoom  = room;
  State.sessionXp    = 0;
  State.focusSeconds = 0;
  State.isFocusing   = false;

  // Reset UI
  document.getElementById('focus-room-name').textContent = room.name;
  document.getElementById('focus-room-sub').textContent  = `${room.users}/${room.max} people`;
  document.getElementById('xp-value').textContent        = '0';
  document.getElementById('focus-xp-display').textContent= '0';
  document.getElementById('focus-hp').textContent        = State.hp;
  document.getElementById('timer-display').textContent   = '00:00';
  document.getElementById('timer-mult').textContent      = '1×';
  document.getElementById('ring-fill').style.strokeDashoffset = '389.6';
  document.getElementById('toggle-label').textContent    = 'Start Focusing';
  document.getElementById('toggle-icon').textContent     = '▶';
  document.getElementById('status-text').textContent     = 'Ready when you are';
  document.getElementById('status-dot').className        = 'status-dot idle';
  document.getElementById('focus-toggle-btn').className  = 'focus-toggle-btn';

  // XP label gamer mode
  const xpLbl = document.getElementById('focus-xp-label');
  if (xpLbl) xpLbl.textContent = State.mode === 'gamer' ? 'EXP earned' : 'XP earned';

  // Camera row: show if room requires camera
  if (room.camera) {
    document.getElementById('camera-toggle').checked = false;
    document.getElementById('camera-row').style.display = '';
  } else {
    document.getElementById('camera-row').style.display = '';
  }

  renderRoomUsers(room);
  goTo('focus');
  connectWS(roomId);
}

function renderRoomUsers(room) {
  const list = document.getElementById('users-list');
  if (!list) return;
  list.innerHTML = '';

  // Current user first
  const me = document.createElement('li');
  me.className = 'user-row';
  me.id = 'user-row-me';
  me.innerHTML = `
    <span class="status-dot idle" id="my-status-dot"></span>
    <div class="user-avatar-sm">${State.username[0].toUpperCase()}</div>
    <div class="user-info">
      <div class="user-name-sm">${State.username} <span style="color:var(--text3);font-size:11px">(you)</span></div>
      <div class="user-xp-sm" id="my-user-xp">0 ${State.mode === 'gamer' ? 'EXP' : 'XP'}</div>
    </div>
  `;
  list.appendChild(me);

  // Fake users (slice to fit room)
  FAKE_USERS.slice(0, room.users - 1).forEach(u => {
    const li = document.createElement('li');
    li.className = 'user-row';
    li.innerHTML = `
      <span class="status-dot ${u.focusing ? 'focusing' : 'distracted'}"></span>
      <div class="user-avatar-sm">${u.name[0]}</div>
      <div class="user-info">
        <div class="user-name-sm">${u.name}</div>
        <div class="user-xp-sm">${u.xp} ${State.mode === 'gamer' ? 'EXP' : 'XP'}</div>
      </div>
    `;
    list.appendChild(li);
  });
}

// FOCUS TIMER
function toggleFocus() {
  State.isFocusing = !State.isFocusing;
  const btn = document.getElementById('focus-toggle-btn');
  const dot = document.getElementById('status-dot');
  const myDot = document.getElementById('my-status-dot');

  if (State.isFocusing) {
    btn.className = 'focus-toggle-btn';
    document.getElementById('toggle-icon').textContent  = '⏸';
    document.getElementById('toggle-label').textContent = 'Pause';
    dot.className   = 'status-dot focusing';
    if (myDot) myDot.className = 'status-dot focusing';
    document.getElementById('status-text').textContent  = State.mode === 'gamer' ? 'GRINDING...' : 'Focusing — XP accumulating';
    if (!State.timerInterval) State.timerInterval = setInterval(tickFocus, 1000);
  } else {
    btn.className = 'focus-toggle-btn paused';
    document.getElementById('toggle-icon').textContent  = '▶';
    document.getElementById('toggle-label').textContent = 'Resume';
    dot.className   = 'status-dot idle';
    if (myDot) myDot.className = 'status-dot idle';
    document.getElementById('status-text').textContent  = 'Paused';
    clearInterval(State.timerInterval);
    State.timerInterval = null;
  }
  wsSend({ type:'focus_status', focusing:State.isFocusing, username:State.username });
}

function tickFocus() {
  if (!State.isFocusing) return;
  State.focusSeconds++;
  const minutes = Math.floor(State.focusSeconds / 60);
  const mult = getMultiplier(minutes, State.cameraOn);

  State.sessionXp = Math.round(State.sessionXp + mult.rate);

  // UI updates
  const mm = String(minutes).padStart(2,'0');
  const ss = String(State.focusSeconds % 60).padStart(2,'0');
  document.getElementById('timer-display').textContent  = `${mm}:${ss}`;
  document.getElementById('timer-mult').textContent     = mult.label;
  document.getElementById('xp-value').textContent       = State.sessionXp;
  document.getElementById('focus-xp-display').textContent = State.sessionXp;
  const myXp = document.getElementById('my-user-xp');
  if (myXp) myXp.textContent = `${State.sessionXp} ${State.mode === 'gamer' ? 'EXP' : 'XP'}`;

  // Ring progress (max at 60 min)
  const progress = Math.min(State.focusSeconds / 3600, 1);
  document.getElementById('ring-fill').style.strokeDashoffset = 389.6 * (1 - progress);

  // HP regen: +1 HP every 5 minutes of focus
  if (State.focusSeconds % 300 === 0) {
    updateHP(State.hp + 1);
  }

  // Auto-complete "Focus 30 min" challenge
  if (minutes >= 30) {
    const ch = CHALLENGES.find(c => c.id === 'c1');
    if (ch && !ch.done) { ch.done = true; State.totalXp += ch.xpVal; }
  }

  wsSend({ type:'xp_update', xp:State.sessionXp, username:State.username });
}

function leaveRoom() {
  clearInterval(State.timerInterval);
  State.timerInterval = null;
  State.isFocusing = false;

  // Stop camera
  if (State.cameraStream) {
    State.cameraStream.getTracks().forEach(t => t.stop());
    State.cameraStream = null;
    State.cameraOn = false;
  }

  if (State.sessionXp > 0) {
    State.totalXp += State.sessionXp;
    State.sessions++;
    const today = new Date().toDateString();
    const lastDate = localStorage.getItem('kiro_last_date');
    if (lastDate !== today) {
      State.streak++;
      localStorage.setItem('kiro_last_date', today);
      updateHP(State.hp + 10); // HP for showing up today
    }
    saveState();
  }
  wsDisconnect();
  goTo('home');
}

// CAMERA
async function toggleCamera() {
  const checked = document.getElementById('camera-toggle').checked;
  const preview = document.getElementById('camera-preview');
  const wrap    = document.getElementById('camera-preview-wrap');

  if (checked) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'user' }, audio:false });
      State.cameraStream = stream;
      State.cameraOn = true;
      preview.srcObject = stream;
      wrap.classList.remove('hidden');
      flashMessage('Camera on — +20% XP bonus active 📷');
    } catch(e) {
      document.getElementById('camera-toggle').checked = false;
      State.cameraOn = false;
      alert('Camera access denied. Check browser permissions.');
    }
  } else {
    if (State.cameraStream) {
      State.cameraStream.getTracks().forEach(t => t.stop());
      State.cameraStream = null;
    }
    State.cameraOn = false;
    preview.srcObject = null;
    wrap.classList.add('hidden');
  }
}

// LEADERBOARD
let currentLBTab = 'daily';

function switchLBTab(tab) {
  currentLBTab = tab;
  document.querySelectorAll('.tab-btn').forEach((b,i) => b.classList.toggle('active', (i===0&&tab==='daily')||(i===1&&tab==='monthly')));
  renderLeaderboard(tab);
}

function renderLeaderboard(tab) {
  const list = document.getElementById('lb-list');
  if (!list) return;

  let rows = [...LEADERBOARD[tab]];
  // Inject user
  rows.push({ name:State.username, id:State.userID, xp:State.totalXp, isMe:true });
  rows.sort((a,b) => b.xp - a.xp);
  // Remove duplicate names
  const seen = new Set();
  rows = rows.filter(r => { if(seen.has(r.name)) return false; seen.add(r.name); return true; });

  const medals = ['🥇','🥈','🥉'];
  const rankClass = ['gold','silver','bronze'];

  list.innerHTML = rows.map((u,i) => `
    <div class="lb-row ${u.isMe ? 'me' : ''}">
      <span class="lb-rank ${rankClass[i]||''}">${i<3 ? medals[i] : i+1}</span>
      <div class="lb-avatar">${u.name[0].toUpperCase()}</div>
      <span class="lb-name">${u.name}${u.isMe?' (you)':''}</span>
      <div style="text-align:right">
        <div class="lb-xp">${u.xp.toLocaleString()}</div>
        <div class="lb-xp-sub">${State.mode==='gamer'?'EXP':'XP'}</div>
      </div>
    </div>
  `).join('');
}

// FRIENDS
function renderFriends() {
  const list = document.getElementById('friends-list');
  if (!list) return;

  if (State.friends.length === 0) {
    list.innerHTML = '<p style="color:var(--text3);font-size:13px;padding:8px 0">No friends yet. Search by username or KIRO# ID above.</p>';
    return;
  }

  list.innerHTML = State.friends.map(f => `
    <div class="friend-card">
      <div class="fc-avatar">
        ${f.username[0].toUpperCase()}
        <span class="fo-status-dot ${f.status||'break'}" style="position:absolute;bottom:0;right:0"></span>
      </div>
      <div class="fc-info">
        <div class="fc-name">${f.username}</div>
        <div class="fc-status">${statusLabel(f.status)} · ${f.id||''}</div>
        <div style="display:flex;gap:10px;margin-top:3px">
          <span class="fc-xp">⚡ ${f.xp||0} XP</span>
          <span class="fc-streak">🔥 ${f.streak||0} days</span>
        </div>
      </div>
      <button class="btn-invite" onclick="inviteFriend('${f.username}')">Invite</button>
    </div>
  `).join('');
}

function statusLabel(s) {
  if (s==='focus') return '🔥 Focusing';
  if (s==='break') return '☕ On break';
  if (s==='done')  return '✅ Done today';
  return '💤 Offline';
}

function searchFriend() {
  const query  = document.getElementById('add-friend-input').value.trim().toLowerCase();
  const result = document.getElementById('friend-search-result');
  if (!query) return;

  // MVP: simulate finding someone from leaderboard
  const allUsers = [...LEADERBOARD.daily, ...LEADERBOARD.monthly];
  const found = allUsers.find(u =>
    u.name.toLowerCase() === query || (u.id||'').toLowerCase() === query
  );

  if (!found) {
    result.classList.remove('hidden');
    result.innerHTML = `<p style="color:var(--text2);font-size:13px">No user found for "${query}"</p>`;
    return;
  }

  const alreadyFriend = State.friends.some(f => f.username.toLowerCase() === found.name.toLowerCase());

  result.classList.remove('hidden');
  result.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px">
      <div class="fc-avatar" style="width:40px;height:40px;border-radius:50%;background:var(--accent-light);display:grid;place-items:center;font-family:var(--font-display);font-size:16px;font-weight:700;color:var(--accent-dark)">${found.name[0].toUpperCase()}</div>
      <div style="flex:1">
        <div style="font-weight:600;color:var(--text)">${found.name}</div>
        <div style="font-size:12px;color:var(--text3)">${found.id||'KIRO#????'} · ⚡${found.xp} XP</div>
      </div>
      <button class="btn-invite" onclick="addFriend('${found.name}','${found.id||''}',${found.xp})" ${alreadyFriend?'disabled':''}>
        ${alreadyFriend ? 'Added ✓' : 'Add Friend'}
      </button>
    </div>
  `;
}

function addFriend(username, id, xp) {
  if (State.friends.some(f => f.username === username)) return;
  State.friends.push({ username, id, xp, streak:0, status:'break' });
  saveState();
  renderFriends();
  renderFriendsOnline();
  document.getElementById('friend-search-result').classList.add('hidden');
  document.getElementById('add-friend-input').value = '';
  flashMessage(`${username} added as friend! 👥`);
}

function inviteFriend(username) {
  flashMessage(`Invite sent to ${username}! (notifications coming soon)`);
}

// PROFILE
function renderProfile() {
  document.getElementById('profile-letter').textContent = State.username[0]?.toUpperCase() || '?';
  document.getElementById('profile-name').textContent   = State.username;
  document.getElementById('profile-id').textContent     = State.userID;
  document.getElementById('id-display').textContent     = State.userID;
  document.getElementById('stat-xp').textContent        = State.totalXp.toLocaleString();
  document.getElementById('stat-streak').textContent    = State.streak + '🔥';
  document.getElementById('stat-sessions').textContent  = State.sessions;
  const xpLbl = document.getElementById('stat-xp-lbl');
  if (xpLbl) xpLbl.textContent = State.mode === 'gamer' ? 'Total EXP' : 'Total XP';

  // Rank
  const allXp = LEADERBOARD.daily.map(u => u.xp);
  allXp.push(State.totalXp);
  allXp.sort((a,b) => b-a);
  document.getElementById('stat-rank').textContent = '#' + (allXp.indexOf(State.totalXp) + 1);

  updateHP(State.hp);

  // Status buttons
  document.querySelectorAll('.status-opt').forEach(b => b.classList.toggle('active', b.dataset.status === State.status));
  document.getElementById('mode-btn-student').classList.toggle('active', State.mode === 'student');
  document.getElementById('mode-btn-gamer').classList.toggle('active', State.mode === 'gamer');
}

function setStatus(s) {
  State.status = s;
  document.querySelectorAll('.status-opt').forEach(b => b.classList.toggle('active', b.dataset.status === s));
  saveState();
}

function copyID() {
  navigator.clipboard.writeText(State.userID).then(() => flashMessage('ID copied! Share it with friends 📋'));
}

function resetProfile() {
  if (!confirm('Reset all your progress? Cannot be undone.')) return;
  localStorage.clear();
  location.reload();
}

// FLASH MESSAGE (toast)
function flashMessage(msg) {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = `
    position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
    background:var(--text); color:var(--bg);
    padding:10px 20px; border-radius:50px;
    font-size:13px; font-weight:500;
    z-index:999; animation:slideUp 0.3s ease both;
    box-shadow:0 4px 16px rgba(0,0,0,0.2);
    white-space:nowrap;
  `;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}


// LIVE COUNT
function updateLiveCount() {
  const total = State.rooms.reduce((sum, r) => sum + r.users, 0) + 1;
  const el = document.getElementById('live-count');
  if (el) el.textContent = `${total} people studying right now`;
}

// WEBSOCKET
let ws = null;
function connectWS(roomId) {
  try {
    ws = new WebSocket(`ws://${location.hostname}:3001`);
    ws.onopen  = () => wsSend({ type:'join', room:roomId, username:State.username });
    ws.onmessage = e => { try { handleWSMessage(JSON.parse(e.data)); } catch{} };
    ws.onerror = () => {}; // silent — offline mode works fine
  } catch(e) {}
}
function wsSend(data) { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data)); }
function wsDisconnect() { if (ws) { ws.close(); ws = null; } }
function handleWSMessage(msg) {
  if (msg.type === 'live_count') updateLiveCount();
}

// NOTIFICATIONS
function requestNotifications() {
  if ('Notification' in window && Notification.permission === 'default') {
    setTimeout(() => Notification.requestPermission(), 6000);
  }
}

// INIT
function init() {
  loadState();
  applyMode(State.mode);

  // Hide all screens
  document.querySelectorAll('.screen').forEach(s => {
    s.style.display = 'none';
    s.classList.remove('active');
  });

  setupIntro();
  setupAuth();

  if (State.isLoggedIn && State.username) {
    // Already logged in — skip intro and go home
    goTo('home');
  } else {
    // First time — show intro
    const introScreen = document.getElementById('screen-intro');
    introScreen.style.display = 'flex';
    introScreen.classList.add('active');
  }

  requestNotifications();
}

document.addEventListener('DOMContentLoaded', init);
