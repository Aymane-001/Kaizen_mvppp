const API = location.hostname === 'localhost' || location.hostname.startsWith('192.168') || location.hostname.startsWith('10.')
  ? `http://${location.hostname}:3001`
  : `${location.origin}`;
const WS_URL = API.replace(/^http/, 'ws') + '/ws';

const STUDY_METHODS = [
  { title: 'blurt it out', desc: 'close everything. on blank paper, write everything you can remember about what you just studied. messy is fine. this is the single most effective study technique in cognitive science.' },
  { title: 'teach it out loud', desc: 'explain the concept to an imaginary 12-year-old, aloud, in simple words. where you stumble is where you do not yet understand.' },
  { title: 'make 3 questions', desc: 'turn what you just read into three exam-style questions. write them down. answer them tomorrow without looking.' },
  { title: 'switch subjects', desc: 'next block, study something different. mixing subjects beats blocking one — even though it feels harder.' },
  { title: 'plan review for day 2, 3, 5, 7', desc: 'add four review dates to your calendar right now for this material. spaced repetition is what moves learning to long-term memory.' },
  { title: 'stand up, 2 minutes', desc: 'walk away from the screen. no phone. come back with a clearer head.' },
];

const S = {
  token: null, user: null, isGuest: false,
  ws: null, wsReady: false,
  screen: 'intro',
  focus: {
    active: false, roomId: null, subject: null,
    soloCommit: 0, start: 0, elapsed: 0,
    xp: 0, mult: 1, cam: false, camStream: null,
    camSeconds: 0, camDistractedSec: 0, distracted: false,
    tickInterval: null, methodTimer: null, detectTimer: null,
    sessionStart: 0, sessionEnd: 0,
    roomXpEarned: 0,
  },
  battle: { active: false, id: null, start: 0, duration: 0, opponent: null, youXp: 0, themXp: 0, tickInterval: null },
  todos: [], daily: [], rooms: [], friends: [], currentRoom: null,
  pendingBattle: null,
  pendingRoomId: null,
  roomPhase: 'focus',
  roomPhaseStart: 0,
  peers: new Map(),
  peerPresence: new Map(),
  roomTimerInterval: null,
};

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

function $(s) { return document.querySelector(s); }
function $$(s) { return document.querySelectorAll(s); }
function toast(msg, ms = 2200) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('visible');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('visible'), ms);
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function loadPulse() {
  if (S.isGuest || !S.token) return;
  const r = await api('/api/pulse');
  const el = $('#pulse-hook');
  if (!el || !r.ok) return;
  const { school_online, major_online, hotRoom, top3 } = r;
  let msg = '';
  if (major_online > 1) msg = `${major_online} students from your major are studying right now`;
  else if (school_online > 1) msg = `${school_online} ${r.school} students are online now`;
  else msg = 'you\'re the first one here · set the pace';
  el.innerHTML = `
    <div class="pulse-msg">${escapeHtml(msg)}</div>
    ${hotRoom ? `<button class="pulse-join" data-room="${hotRoom.id}">${escapeHtml(hotRoom.name)} · ${hotRoom.members} studying</button>` : ''}
    ${top3?.length ? `<div class="pulse-top">today's top: ${top3.map(u => escapeHtml(u.username) + ' ' + u.xp + 'xp').join(' · ')}</div>` : ''}
  `;
  el.querySelector('.pulse-join')?.addEventListener('click', (e) => {
    const id = e.target.dataset.room;
    if (id) { goTo('rooms'); setTimeout(() => showRoomPreview(id), 300); }
  });
}

const AMBIENT_SOUNDS = {
  lofi: { label: 'lo-fi', url: null, ctx: null, gain: null },
  rain: { label: 'rain', url: null, ctx: null, gain: null },
  cafe: { label: 'café', url: null, ctx: null, gain: null },
};
let ambientActive = null;

function createNoiseBuffer(ctx, type) {
  const sr = ctx.sampleRate;
  const frames = sr * 3;
  const buf = ctx.createBuffer(1, frames, sr);
  const data = buf.getChannelData(0);
  if (type === 'rain') {
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * 0.6;
  } else if (type === 'cafe') {
    let v = 0;
    for (let i = 0; i < frames; i++) { v += (Math.random() * 2 - 1) * 0.05; v *= 0.995; data[i] = v * 4; }
  } else {
    let v = 0;
    for (let i = 0; i < frames; i++) { v = v * 0.98 + Math.random() * 0.04; data[i] = v * 0.7; }
  }
  return buf;
}

function toggleAmbient(type) {
  if (ambientActive === type) {
    stopAmbient();
    return;
  }
  stopAmbient();
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const buf = createNoiseBuffer(ctx, type);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const gain = ctx.createGain();
    const filt = ctx.createBiquadFilter();
    if (type === 'lofi') { filt.type = 'lowpass'; filt.frequency.value = 800; gain.gain.value = 0.12; }
    else if (type === 'rain') { filt.type = 'highpass'; filt.frequency.value = 400; gain.gain.value = 0.18; }
    else { filt.type = 'bandpass'; filt.frequency.value = 1000; gain.gain.value = 0.08; }
    src.connect(filt); filt.connect(gain); gain.connect(ctx.destination);
    src.start();
    AMBIENT_SOUNDS[type].ctx = ctx;
    AMBIENT_SOUNDS[type].gain = gain;
    AMBIENT_SOUNDS[type]._src = src;
    ambientActive = type;
    $$('.amb-btn').forEach(b => b.classList.toggle('active', b.dataset.amb === type));
  } catch (e) {}
}

function stopAmbient() {
  if (!ambientActive) return;
  const s = AMBIENT_SOUNDS[ambientActive];
  try { s.gain?.gain.setTargetAtTime(0, s.ctx.currentTime, 0.3); setTimeout(() => s.ctx?.close(), 600); } catch {}
  s.ctx = null; s.gain = null; s._src = null;
  ambientActive = null;
  $$('.amb-btn').forEach(b => b.classList.remove('active'));
}

const XP_MILESTONES = [50, 100, 200, 500, 1000];
let lastMilestone = 0;
function checkXpMilestone(xp) {
  const hit = XP_MILESTONES.filter(m => m > lastMilestone && xp >= m).pop();
  if (hit) { lastMilestone = hit; toast(`${hit} xp today · you\'re on fire`); }
}

const SESSION_QUOTES = [
  'one session at a time.',
  'the work you did today is already in your head.',
  'small steps. every day.',
  'you showed up. that\'s the hardest part.',
  'compound interest applies to knowledge too.',
  'the person you\'ll be tomorrow started today.',
];

function showSessionEnd(data) {
  const { xp, mins, streak, streakNew } = data;
  $('#se-xp').textContent = xp;
  $('#se-mins').textContent = mins;
  $('#se-streak').textContent = streak || 0;
  $('#se-streak-new').style.display = streakNew ? 'inline' : 'none';
  $('#se-quote').textContent = SESSION_QUOTES[Math.floor(Math.random() * SESSION_QUOTES.length)];
  showModal('modal-session-end');
}


function goTo(name) {
  const current = [...$$('.screen.active')];
  const next = $('#screen-' + name);
  if (!next) return;

  const nav = ['home', 'rooms', 'friends', 'board', 'settings'];

  const activate = () => {
    current.forEach(s => s.classList.remove('active', 'leaving'));
    next.classList.add('active');
    S.screen = name;
    $('#nav').classList.toggle('visible', nav.includes(name));
    $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.go === name));
    if (name === 'rooms') loadRooms();
    if (name === 'friends') loadFriends();
    if (name === 'board') loadBoard('today');
    if (name === 'home') { refreshHome(); loadDailyTasks(); loadPulse(); }
    if (name === 'settings') refreshSettings();
  };

  if (current.length && current[0] !== next) {
    current.forEach(s => s.classList.add('leaving'));
    setTimeout(activate, 220);
  } else {
    activate();
  }
}

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (S.token) headers.Authorization = 'Bearer ' + S.token;
  try {
    const res = await fetch(API + path, { ...opts, headers });
    const data = await res.json().catch(() => ({ ok: false, error: 'Bad response' }));
    if (!res.ok && !data.error) data.error = 'Server error';
    return data;
  } catch (e) {
    return { ok: false, error: 'Connection failed' };
  }
}

function setupIntro() {
  const btn = $('#intro-next');
  const skip = $('#intro-skip');
  let i = 0;
  const slides = $$('.intro-slide');
  const dots = $$('.intro-dots .dot');
  btn.addEventListener('click', () => {
    if (i < 2) {
      slides[i].classList.remove('active');
      i++;
      slides[i].classList.add('active');
      dots.forEach((d, j) => d.classList.toggle('active', j === i));
      if (i === 2) btn.textContent = "let's go";
    } else {
      goTo('auth');
    }
  });
  skip.addEventListener('click', () => goTo('auth'));
}

function setupAuth() {
  $$('.auth-tabs .tab').forEach(t => {
    t.addEventListener('click', () => {
      $$('.auth-tabs .tab').forEach(x => x.classList.remove('active'));
      $$('.auth-form').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      const form = $('#form-' + t.dataset.tab);
      if (form) form.classList.add('active');
    });
  });

  $$('.mode-option').forEach(opt => {
    opt.addEventListener('click', () => {
      $$('.mode-option').forEach(x => x.classList.remove('active'));
      opt.classList.add('active');
      opt.querySelector('input').checked = true;
    });
  });

  $('#reg-pw').addEventListener('input', (e) => {
    const v = e.target.value;
    const bar = $('#pw-bar');
    bar.className = '';
    if (v.length === 0) return;
    if (v.length < 8) { bar.classList.add('weak'); return; }
    const score = [/\d/.test(v), /[A-Z]/.test(v), /[^a-zA-Z0-9]/.test(v), v.length >= 12].filter(Boolean).length;
    bar.classList.add(score >= 3 ? 'strong' : score >= 1 ? 'med' : 'weak');
  });

  $('#reg-username').addEventListener('input', (e) => {
    const v = e.target.value;
    const hint = $('#reg-username-hint');
    if (!v) return hint.textContent = '';
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(v)) {
      hint.textContent = '3-20 chars, letters/numbers/underscore';
      hint.style.color = 'var(--danger)';
    } else {
      hint.textContent = 'looks good';
      hint.style.color = 'var(--success)';
    }
  });

  $('#form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = $('#login-err'); errEl.textContent = '';
    const r = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: $('#login-id').value, password: $('#login-pw').value }),
    });
    if (!r.ok) return errEl.textContent = r.error || 'Login failed';
    onAuthSuccess(r);
  });

  $('#form-register').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = $('#reg-err'); errEl.textContent = '';
    const mode = document.querySelector('input[name=mode]:checked').value;
    const r = await api('/api/register', {
      method: 'POST',
      body: JSON.stringify({
        username: $('#reg-username').value,
        email: $('#reg-email').value,
        password: $('#reg-pw').value,
        mode, year: $('#reg-year').value,
        school: $('#reg-school').value,
        major: $('#reg-major').value,
      }),
    });
    if (!r.ok) return errEl.textContent = r.error || 'Registration failed';
    onAuthSuccess(r);
  });

  $('#guest-go').addEventListener('click', () => {
    S.isGuest = true;
    S.user = { username: 'guest', kzenId: '--------', xp_total: 0, xp_daily: 0, streak: 0, streak_freezes: 0, theme: 'ink', dark: true };
    goTo('home');
  });
}

function onAuthSuccess(r) {
  localStorage.setItem('kaizen_token', r.token);
  S.token = r.token;
  S.user = r.user;
  applyTheme(r.user.theme || 'ink');
  connectWS();
  goTo('home');
}

function applyTheme(theme) {
  if (theme === 'ink') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
  $$('.theme-swatch').forEach(sw => sw.classList.toggle('active', sw.dataset.theme === theme));
}

function connectWS() {
  if (!S.token) return;
  try {
    S.ws = new WebSocket(`${WS_URL}?token=${S.token}`);
    S.ws.onopen = () => { S.wsReady = true; };
    S.ws.onclose = () => { S.wsReady = false; setTimeout(connectWS, 3000); };
    S.ws.onerror = () => {};
    S.ws.onmessage = (e) => {
      try { handleWs(JSON.parse(e.data)); } catch {}
    };
  } catch (e) {}
}

function wsSend(msg) {
  if (S.ws && S.wsReady) S.ws.send(JSON.stringify(msg));
}

function handleWs(msg) {
  switch (msg.type) {
    case 'auth:ok':
      S.user = { ...S.user, ...msg.user };
      refreshHome();
      break;
    case 'room:new':
    case 'room:update':
    case 'room:delete':
      if (S.screen === 'rooms') loadRooms();
      refreshHomeRoomCount();
      break;
    case 'room:joined':
      S.currentRoom = { ...msg.room, members: msg.members };
      S.roomPhase = msg.room.voicePhase;
      S.roomPhaseStart = msg.phaseStart;
      S.focus.sessionStart = msg.sessionStart;
      S.focus.sessionEnd = msg.sessionEnd;
      updateFocusMembers();
      updatePhaseBanner();
      renderPeerTiles();
      if (Array.isArray(msg.peers)) {
        msg.peers.forEach(peerId => initiateRtcWith(peerId));
      }
      break;
    case 'room:join':
      if (S.currentRoom?.id === msg.roomId) {
        S.currentRoom.members.push(msg.user);
        updateFocusMembers();
        renderPeerTiles();
      }
      break;
    case 'room:leave':
      if (S.currentRoom?.id === msg.roomId) {
        S.currentRoom.members = S.currentRoom.members.filter(m =>
          m.userId !== msg.userId && m.kzenId !== msg.user?.kzenId && m.username !== msg.username
        );
        if (msg.userId) closeRtcWith(msg.userId);
        updateFocusMembers();
        renderPeerTiles();
      }
      break;
    case 'room:phase':
      S.roomPhase = msg.phase;
      S.roomPhaseStart = Date.now();
      updatePhaseBanner();
      toast(msg.phase === 'break' ? 'voice unlocked · take a break' : 'voice locked · focus phase');
      break;
    case 'room:session_restart':
      S.focus.sessionStart = msg.sessionStart;
      S.focus.sessionEnd = msg.sessionEnd;
      S.focus.roomXpEarned = 0;
      toast('new room session started · stay for the full cycle', 3500);
      break;
    case 'room:presence':
      if (S.currentRoom?.id === msg.roomId) {
        S.peerPresence.clear();
        msg.presence.forEach(p => S.peerPresence.set(p.userId, p));
        renderPeerTiles();
      }
      break;
    case 'room:penalty':
      toast(msg.reason, 4500);
      break;
    case 'xp:update':
      S.user.xp_total = msg.xp_total;
      S.user.xp_daily = msg.xp_daily;
      refreshHome();
      break;
    case 'daily:reward':
      msg.rewards.forEach(r => toast(`quest done: ${r.task} · +${r.reward} xp`, 4000));
      if (S.screen === 'home') loadDailyTasks();
      break;
    case 'friend:status':
      if (S.screen === 'friends') loadFriends();
      break;
    case 'battle:invite':
      S.pendingBattle = msg;
      $('#battle-invite-text').textContent = `${msg.from.username} challenges you · ${msg.duration} min`;
      showModal('modal-battle-invite');
      break;
    case 'battle:sent':
      toast(`challenge sent to ${msg.target}`);
      break;
    case 'battle:declined':
      toast('challenge declined');
      hideModal('modal-battle-invite');
      break;
    case 'battle:fail':
      toast(msg.error);
      break;
    case 'battle:start':
      startBattleUI(msg);
      break;
    case 'battle:tick':
      updateBattleXp(msg.xp);
      break;
    case 'battle:end':
      endBattleUI(msg);
      break;
    case 'rtc:offer':
      handleRtcOffer(msg);
      break;
    case 'rtc:answer':
      handleRtcAnswer(msg);
      break;
    case 'rtc:ice':
      handleRtcIce(msg);
      break;
  }
}

async function initiateRtcWith(peerId) {
  if (S.peers.has(peerId)) return;
  const pc = createPeer(peerId, true);
  try {
    const offer = await pc.createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: false });
    await pc.setLocalDescription(offer);
    wsSend({
      type: 'rtc:offer',
      to: peerId,
      roomId: S.currentRoom?.id,
      payload: offer,
    });
  } catch (e) {
    console.warn('rtc offer failed', e);
  }
}

function createPeer(peerId, isInitiator) {
  const pc = new RTCPeerConnection(RTC_CONFIG);

  pc.onicecandidate = (e) => {
    if (e.candidate) {
      wsSend({
        type: 'rtc:ice',
        to: peerId,
        roomId: S.currentRoom?.id,
        payload: e.candidate,
      });
    }
  };

  pc.ontrack = (e) => {
    const entry = S.peers.get(peerId) || {};
    entry.stream = e.streams[0];
    S.peers.set(peerId, entry);
    renderPeerTiles();
  };

  pc.onconnectionstatechange = () => {
    if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
      closeRtcWith(peerId);
    }
  };

  if (S.focus.camStream) {
    S.focus.camStream.getTracks().forEach(t => pc.addTrack(t, S.focus.camStream));
  }

  S.peers.set(peerId, { pc, stream: null });
  return pc;
}

async function handleRtcOffer(msg) {
  const peerId = msg.from;
  const existing = S.peers.get(peerId);
  let pc = existing?.pc;
  if (!pc) pc = createPeer(peerId, false);
  try {
    await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    wsSend({
      type: 'rtc:answer',
      to: peerId,
      roomId: S.currentRoom?.id,
      payload: answer,
    });
  } catch (e) {
    console.warn('rtc answer failed', e);
  }
}

async function handleRtcAnswer(msg) {
  const peer = S.peers.get(msg.from);
  if (!peer?.pc) return;
  try { await peer.pc.setRemoteDescription(new RTCSessionDescription(msg.payload)); }
  catch (e) { console.warn('rtc setRemoteDesc failed', e); }
}

async function handleRtcIce(msg) {
  const peer = S.peers.get(msg.from);
  if (!peer?.pc) return;
  try { await peer.pc.addIceCandidate(new RTCIceCandidate(msg.payload)); }
  catch (e) {}
}

function closeRtcWith(peerId) {
  const peer = S.peers.get(peerId);
  if (!peer) return;
  try { peer.pc?.close(); } catch {}
  S.peers.delete(peerId);
  S.peerPresence.delete(peerId);
  renderPeerTiles();
}

function closeAllPeers() {
  S.peers.forEach((_, id) => closeRtcWith(id));
  S.peers.clear();
  S.peerPresence.clear();
  renderPeerTiles();
}

function publishStreamToPeers() {
  if (!S.focus.camStream) return;
  S.peers.forEach(({ pc }) => {
    if (!pc) return;
    const existing = pc.getSenders().find(s => s.track?.kind === 'video');
    const track = S.focus.camStream.getVideoTracks()[0];
    if (!track) return;
    if (existing) existing.replaceTrack(track);
    else pc.addTrack(track, S.focus.camStream);
  });
}

function renderPeerTiles() {
  const el = $('#peer-grid');
  if (!el) return;
  if (!S.currentRoom) { el.innerHTML = ''; return; }
  const others = S.currentRoom.members.filter(m => m.userId !== S.user?.id);
  if (!others.length) { el.innerHTML = ''; return; }

  el.innerHTML = others.map(m => {
    const presence = S.peerPresence.get(m.userId) || {};
    const xp = presence.sessionXp || 0;
    const distracted = presence.distracted;
    const status = presence.status || m.status || '—';
    return `
      <div class="peer-tile" data-peer="${m.userId}">
        <div class="peer-video-wrap">
          <video id="peer-video-${m.userId}" autoplay playsinline muted></video>
          <div class="peer-placeholder" id="peer-ph-${m.userId}">${escapeHtml((m.username || '?').charAt(0).toUpperCase())}</div>
        </div>
        <div class="peer-info">
          <div class="peer-name">${escapeHtml(m.username || 'user')}</div>
          <div class="peer-stats">
            <span><span class="peer-status-dot ${distracted ? 'distracted' : ''}"></span>${escapeHtml(status)}</span>
            <span class="peer-xp">${xp} xp</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  others.forEach(m => {
    const peer = S.peers.get(m.userId);
    const videoEl = $('#peer-video-' + m.userId);
    const ph = $('#peer-ph-' + m.userId);
    if (videoEl && peer?.stream) {
      if (videoEl.srcObject !== peer.stream) videoEl.srcObject = peer.stream;
      if (ph) ph.style.display = 'none';
      videoEl.style.display = 'block';
    } else if (videoEl) {
      videoEl.style.display = 'none';
      if (ph) ph.style.display = 'flex';
    }
  });
}

async function refreshHome() {
  if (!S.user) return;
  $('#home-username').textContent = S.user.username || 'guest';
  $('#home-streak').textContent = S.user.streak || 0;
  $('#stat-daily').textContent = S.user.xp_daily || 0;
  $('#stat-total').textContent = S.user.xp_total || 0;
  $('#stat-freezes').textContent = S.user.streak_freezes ?? 0;

  if (!S.isGuest) await loadTodos();
  else renderTodos([]);

  refreshHomeRoomCount();
  updateRank();
}

async function refreshHomeRoomCount() {
  if (!S.token) return;
  const r = await api('/api/rooms');
  if (r.ok) $('#rooms-open-count').textContent = r.rooms.length;
}

async function updateRank() {
  if (S.isGuest) { $('#stat-rank').textContent = '—'; return; }
  const r = await api('/api/leaderboard?period=today');
  if (!r.ok) return;
  const idx = r.board.findIndex(x => x.kzenId === S.user.kzenId);
  $('#stat-rank').textContent = idx >= 0 ? '#' + (idx + 1) : '—';
}

async function loadDailyTasks() {
  if (S.isGuest) {
    $('#daily-tasks').innerHTML = '<div style="color:var(--ink-ghost);font-size:12px">sign up to unlock daily quests</div>';
    return;
  }
  const r = await api('/api/daily');
  if (!r.ok) return;
  S.daily = r.tasks;
  renderDailyTasks(r.tasks);
  if (r.rewards?.length) r.rewards.forEach(rw => toast(`quest done: ${rw.task} · +${rw.reward}`, 4000));
}

function renderDailyTasks(tasks) {
  const el = $('#daily-tasks');
  if (!tasks.length) { el.innerHTML = '<div style="color:var(--ink-ghost);font-size:12px">no quests today</div>'; return; }
  el.innerHTML = tasks.map(t => `
    <div class="quest ${t.done ? 'done' : ''}">
      <div>${escapeHtml(t.title)}</div>
      <div class="quest-reward">+${t.reward}</div>
    </div>
  `).join('');
}

async function loadTodos() {
  if (S.isGuest) return;
  const r = await api('/api/todos');
  if (r.ok) { S.todos = r.todos; renderTodos(r.todos); }
}

function renderTodos(list) {
  const el = $('#todo-list');
  if (!list.length) {
    el.innerHTML = '<div style="color:var(--ink-ghost);font-size:12px;padding:6px 0">no tasks yet</div>';
    return;
  }
  el.innerHTML = list.map(t => `
    <div class="todo-item ${t.done ? 'done' : ''}" data-id="${t.id}">
      <div class="todo-check"></div>
      <div class="todo-text">${escapeHtml(t.text)}</div>
      <button class="todo-del" data-del="${t.id}">×</button>
    </div>
  `).join('');
  el.querySelectorAll('.todo-check').forEach(c => c.addEventListener('click', () => toggleTodo(c.parentElement.dataset.id)));
  el.querySelectorAll('.todo-del').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); deleteTodo(b.dataset.del); }));
}

async function toggleTodo(id) {
  if (S.isGuest) return;
  const r = await api(`/api/todos/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ inSession: S.focus.active || S.battle.active }),
  });
  if (r.ok) {
    await loadTodos();
    if (r.bonus > 0) {
      toast(`+${r.bonus} xp · task done during focus`);
      if (S.user) { S.user.xp_total += r.bonus; S.user.xp_daily += r.bonus; refreshHome(); }
    }
  }
}

async function deleteTodo(id) {
  if (S.isGuest) return;
  await api(`/api/todos/${id}`, { method: 'DELETE' });
  await loadTodos();
}

function setupTodoForm() {
  $('#todo-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (S.isGuest) return toast('guest mode: sign up to save tasks');
    const input = $('#todo-input');
    const text = input.value.trim();
    if (!text) return;
    const r = await api('/api/todos', { method: 'POST', body: JSON.stringify({ text }) });
    if (r.ok) { input.value = ''; await loadTodos(); }
    else toast(r.error);
  });
}

function setupPathCards() {
  $$('.path-card').forEach(c => {
    c.addEventListener('click', () => {
      const action = c.dataset.action;
      if (action === 'solo') goTo('solo-setup');
      else if (action === 'rooms') goTo('rooms');
      else if (action === 'battle') {
        if (S.isGuest) return toast('guest mode: sign up to duel');
        showModal('modal-challenge');
      }
    });
  });
}

function setupSoloSetup() {
  let dur = 50;
  $$('.dur-btn').forEach(b => {
    b.addEventListener('click', () => {
      $$('.dur-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      dur = parseInt(b.dataset.dur, 10);
    });
  });
  $('#solo-start').addEventListener('click', () => {
    const subject = $('#solo-subject').value.trim();
    startFocus(null, { soloCommit: dur, subject });
  });
  $$('#screen-solo-setup [data-go]').forEach(b => {
    b.addEventListener('click', () => goTo(b.dataset.go));
  });
}

async function loadRooms() {
  const el = $('#rooms-list');
  const r = await api('/api/rooms');
  if (!r.ok) return el.innerHTML = '<p style="color:var(--ink-ghost)">error loading rooms</p>';
  S.rooms = r.rooms;
  if (!r.rooms.length) {
    el.innerHTML = '<p style="color:var(--ink-ghost);padding:2rem 0;text-align:center">no rooms yet. be the first.</p>';
    return;
  }
  el.innerHTML = r.rooms.map(room => `
    <div class="room-card" data-id="${room.id}">
      <div>
        <div class="room-name">${escapeHtml(room.name)}</div>
        <div class="room-meta">${escapeHtml(room.subject)} · ${room.sessionLength}m session · voice ${escapeHtml(room.voiceCycle)}${room.cameraRequired ? ' · cam req' : ''}<span class="room-phase ${room.voicePhase}">${room.voicePhase === 'break' ? 'voice open' : 'focus'}</span></div>
      </div>
      <div class="room-count">
        <div class="room-timer-inline" data-end="${room.sessionEnd}">${fmtRemaining(room.remaining)}</div>
        <em>${room.members}</em> / ${room.maxPeople}
      </div>
    </div>
  `).join('');
  el.querySelectorAll('.room-card').forEach(card => {
    card.addEventListener('click', () => {
      if (S.isGuest) return toast('guest mode: sign up to join rooms');
      showRoomPreview(card.dataset.id);
    });
  });
  startRoomsTicker();
}

function fmtRemaining(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function startRoomsTicker() {
  if (S.roomTimerInterval) clearInterval(S.roomTimerInterval);
  S.roomTimerInterval = setInterval(() => {
    if (S.screen !== 'rooms') return;
    $$('.room-timer-inline').forEach(el => {
      const end = parseInt(el.dataset.end, 10);
      el.textContent = fmtRemaining(end - Date.now());
    });
  }, 1000);
}

function showRoomPreview(roomId) {
  const room = S.rooms.find(r => r.id === roomId);
  if (!room) return;
  S.pendingRoomId = roomId;
  $('#rp-name').textContent = room.name;
  $('#rp-subject').textContent = room.subject;
  $('#rp-length').textContent = room.sessionLength + ' min';
  $('#rp-remaining').textContent = fmtRemaining(room.sessionEnd - Date.now());
  $('#rp-cycle').textContent = room.voiceCycle;
  $('#rp-phase').textContent = room.voicePhase === 'break' ? 'break · voice open' : 'focus · voice locked';
  $('#rp-members').textContent = `${room.members} / ${room.maxPeople}`;
  $('#rp-camera').textContent = room.cameraRequired ? 'required' : 'optional';
  showModal('modal-room-preview');
}

function setupRoomsScreen() {
  $('#btn-new-room').addEventListener('click', () => {
    if (S.isGuest) return toast('guest mode: sign up to create rooms');
    showModal('modal-new-room');
  });

  $('#new-room-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = $('#nr-err'); errEl.textContent = '';
    const r = await api('/api/rooms', {
      method: 'POST',
      body: JSON.stringify({
        name: $('#nr-name').value,
        subject: $('#nr-subject').value,
        voiceCycle: $('#nr-cycle').value,
        sessionLength: parseInt($('#nr-length').value, 10),
        maxPeople: parseInt($('#nr-max').value, 10),
        cameraRequired: $('#nr-cam').checked,
      }),
    });
    if (!r.ok) return errEl.textContent = r.error;
    hideModal('modal-new-room');
    $('#nr-name').value = '';
    await loadRooms();
    startFocus(r.room.id);
  });

  $('#rp-join').addEventListener('click', () => {
    if (!S.pendingRoomId) return;
    hideModal('modal-room-preview');
    startFocus(S.pendingRoomId);
    S.pendingRoomId = null;
  });
}

async function loadFriends() {
  const r = await api('/api/friends');
  const el = $('#friends-list');
  if (!r.ok || !r.friends.length) {
    el.innerHTML = '<p style="color:var(--ink-ghost);padding:1rem 0">search above to add friends by username or kzen id</p>';
    return;
  }
  el.innerHTML = r.friends.map(friendRowHtml).join('');
}

function friendRowHtml(f) {
  const statusTxt = !f.online ? 'offline' : f.status;
  return `
    <div class="friend-row">
      <div class="friend-info">
        <div class="friend-name"><span class="friend-online ${f.online ? '' : 'friend-offline'}"></span>${escapeHtml(f.username)}<span class="friend-status-tag">· ${statusTxt}</span></div>
        <div class="friend-kzen">${escapeHtml(f.kzenId)}</div>
      </div>
      <div class="friend-stats">
        <div><em>${f.xp_total}</em> xp</div>
        <div><em>${f.streak}</em> streak</div>
      </div>
    </div>
  `;
}

function setupFriendSearch() {
  let timer;
  $('#friend-search-input').addEventListener('input', (e) => {
    clearTimeout(timer);
    const q = e.target.value.trim();
    const el = $('#friend-results');
    if (!q) { el.innerHTML = ''; return; }
    timer = setTimeout(async () => {
      const r = await api('/api/search?q=' + encodeURIComponent(q));
      if (!r.ok) return;
      if (!r.results.length) {
        el.innerHTML = '<p style="color:var(--ink-ghost);padding:.5rem 0;font-size:12px">no one found</p>';
        return;
      }
      el.innerHTML = r.results.map(f => `
        <div class="friend-row">
          <div class="friend-info">
            <div class="friend-name"><span class="friend-online ${f.online ? '' : 'friend-offline'}"></span>${escapeHtml(f.username)}</div>
            <div class="friend-kzen">${escapeHtml(f.kzenId)}</div>
          </div>
          <button class="btn-ghost" data-add-btn="${f.kzenId}">+ add</button>
        </div>
      `).join('');
      el.querySelectorAll('[data-add-btn]').forEach(b => {
        b.addEventListener('click', async (ev) => {
          ev.stopPropagation();
          const res = await api('/api/friends/' + b.dataset.addBtn, { method: 'POST' });
          if (res.ok) { toast('added'); loadFriends(); }
        });
      });
    }, 220);
  });
}

async function loadBoard(period) {
  const r = await api('/api/leaderboard?period=' + period);
  const el = $('#board-list');
  if (!r.ok || !r.board.length) { el.innerHTML = '<p style="color:var(--ink-ghost)">no data yet</p>'; return; }
  el.innerHTML = r.board.slice(0, 50).map((u, i) => `
    <div class="board-row">
      <div class="board-rank">${i + 1}</div>
      <div class="board-name">${escapeHtml(u.username)}<span class="board-streak">· ${u.streak}d${u.battles_won ? ' · ' + u.battles_won + 'w' : ''}</span></div>
      <div class="board-xp">${u.xp}</div>
    </div>
  `).join('');
}

function setupBoard() {
  $$('#screen-board .seg-btn').forEach(b => {
    b.addEventListener('click', () => {
      $$('#screen-board .seg-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      loadBoard(b.dataset.period);
    });
  });
}

function setupSettings() {
  $$('.settings-tab').forEach(t => {
    t.addEventListener('click', () => {
      $$('.settings-tab').forEach(x => x.classList.remove('active'));
      $$('.settings-panel').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      $('#panel-' + t.dataset.panel).classList.add('active');
      if (t.dataset.panel === 'friend-mgr') loadFriendManager();
    });
  });

  $$('.theme-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      const theme = sw.dataset.theme;
      applyTheme(theme);
      if (!S.isGuest) api('/api/prefs', { method: 'POST', body: JSON.stringify({ theme }) });
    });
  });

  $('#auto-status-toggle').addEventListener('change', async (e) => {
    const on = e.target.checked;
    $('#manual-status-seg').style.display = on ? 'none' : 'flex';
    if (!S.isGuest) await api('/api/prefs', { method: 'POST', body: JSON.stringify({ auto_status: on }) });
    if (S.user) S.user.auto_status = on;
  });

  $$('.status-btn').forEach(b => {
    b.addEventListener('click', () => {
      $$('.status-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      const status = b.dataset.status;
      wsSend({ type: 'status:set', status });
      $('#status-display').textContent = status;
    });
  });

  $('#goal-range').addEventListener('input', (e) => {
    $('#goal-value').textContent = e.target.value + ' xp';
  });
  $('#goal-range').addEventListener('change', async (e) => {
    if (S.isGuest) return;
    const goal = parseInt(e.target.value, 10);
    await api('/api/prefs', { method: 'POST', body: JSON.stringify({ daily_goal_xp: goal }) });
    if (S.user) S.user.daily_goal_xp = goal;
  });

  ['battles', 'friends', 'rooms', 'methods'].forEach(k => {
    $('#notif-' + k).addEventListener('change', async () => {
      const prefs = {
        battles: $('#notif-battles').checked,
        friends: $('#notif-friends').checked,
        rooms: $('#notif-rooms').checked,
        methods: $('#notif-methods').checked,
      };
      if (!S.isGuest) await api('/api/prefs', { method: 'POST', body: JSON.stringify({ notif_prefs: prefs }) });
      if (S.user) S.user.notif_prefs = prefs;
    });
  });

  $('#pw-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = $('#pw-err'); errEl.textContent = '';
    const oldPw = $('#pw-old').value;
    const newPw = $('#pw-new').value;
    const conf = $('#pw-confirm').value;
    if (newPw !== conf) return errEl.textContent = 'New passwords do not match';
    const r = await api('/api/change-password', { method: 'POST', body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw }) });
    if (!r.ok) return errEl.textContent = r.error;
    toast('password updated');
    e.target.reset();
  });

  $('#btn-copy-id').addEventListener('click', async () => {
    if (!S.user?.kzenId) return;
    try { await navigator.clipboard.writeText(S.user.kzenId); toast('copied'); }
    catch {
      const ta = document.createElement('textarea');
      ta.value = S.user.kzenId;
      document.body.appendChild(ta);
      ta.select(); document.execCommand('copy'); ta.remove();
      toast('copied');
    }
  });

  $('#btn-signout').addEventListener('click', () => {
    localStorage.removeItem('kaizen_token');
    if (S.ws) S.ws.close();
    location.reload();
  });
}

function refreshSettings() {
  if (!S.user) return;
  $('#prof-username').textContent = S.user.username;
  $('#prof-meta').textContent = `${S.user.mode || 'student'} · ${S.user.year || ''} · ${S.user.school || ''} ${S.user.major ? '· ' + S.user.major : ''}`;
  $('#prof-kzen').textContent = S.user.kzenId;
  $('#p-total').textContent = S.user.xp_total || 0;
  $('#p-streak').textContent = S.user.streak || 0;
  $('#p-sessions').textContent = S.user.sessions || 0;
  $('#p-battles').textContent = S.user.battles_won || 0;
  $('#sec-email').textContent = S.user.email || '—';
  $('#goal-range').value = S.user.daily_goal_xp || 60;
  $('#goal-value').textContent = (S.user.daily_goal_xp || 60) + ' xp';
  $('#status-display').textContent = S.user.status || 'focus';
  const auto = S.user.auto_status !== false;
  $('#auto-status-toggle').checked = auto;
  $('#manual-status-seg').style.display = auto ? 'none' : 'flex';
  const np = S.user.notif_prefs || { battles: true, friends: true, rooms: true, methods: true };
  $('#notif-battles').checked = np.battles !== false;
  $('#notif-friends').checked = np.friends !== false;
  $('#notif-rooms').checked = np.rooms !== false;
  $('#notif-methods').checked = np.methods !== false;
}

async function loadFriendManager() {
  const r = await api('/api/friends');
  const el = $('#friend-mgr-list');
  if (!r.ok || !r.friends.length) {
    el.innerHTML = '<p style="color:var(--ink-ghost);font-size:13px">no friends yet</p>';
    return;
  }
  el.innerHTML = r.friends.map(f => `
    <div class="mgr-row">
      <div class="mgr-info">${escapeHtml(f.username)}<small>${escapeHtml(f.kzenId)}</small></div>
      <button class="btn-danger" data-unfriend="${f.kzenId}">unfriend</button>
    </div>
  `).join('');
  el.querySelectorAll('[data-unfriend]').forEach(b => {
    b.addEventListener('click', async () => {
      if (!confirm('remove this friend?')) return;
      await api('/api/friends/' + b.dataset.unfriend, { method: 'DELETE' });
      loadFriendManager();
    });
  });
}

function startFocus(roomId, opts = {}) {
  S.focus.active = true;
  S.focus.roomId = roomId;
  S.focus.subject = opts.subject || null;
  S.focus.soloCommit = opts.soloCommit || 0;
  S.focus.start = Date.now();
  S.focus.elapsed = 0;
  S.focus.xp = 0;
  S.focus.roomXpEarned = 0;
  S.focus.mult = 1;
  S.focus.cam = false;
  S.focus.camSeconds = 0;
  S.focus.camDistractedSec = 0;
  S.focus.distracted = false;
  S.focus.sessionStart = 0;
  S.focus.sessionEnd = 0;

  if (roomId) {
    wsSend({ type: 'room:join', roomId });
    const room = S.rooms.find(r => r.id === roomId);
    $('#focus-room-name').textContent = room ? room.name : 'room';
    $('#focus-commit').style.display = 'none';
    $('#phase-banner').style.display = 'inline-block';
  } else {
    $('#focus-room-name').textContent = 'solo';
    $('#focus-room-members').textContent = '';
    $('#phase-banner').style.display = 'none';
    if (S.focus.soloCommit > 0) {
      $('#focus-commit').style.display = 'block';
      $('#commit-target').textContent = S.focus.soloCommit;
    } else {
      $('#focus-commit').style.display = 'none';
    }
  }

  wsSend({
    type: 'session:start',
    subject: opts.subject,
    soloCommit: opts.soloCommit || 0,
    roomId: roomId || null,
  });
  goTo('focus');

  S.focus.tickInterval = setInterval(focusTick, 1000);
  scheduleMethodPrompt();
}

function focusTick() {
  if (!S.focus.active) return;
  S.focus.elapsed += 1;
  const mins = Math.floor(S.focus.elapsed / 60);
  if (mins >= 90) S.focus.mult = 2.0;
  else if (mins >= 45) S.focus.mult = 1.5;
  else if (mins >= 20) S.focus.mult = 1.2;
  else S.focus.mult = 1.0;

  if (S.focus.cam) S.focus.camSeconds += 1;
  if (S.focus.distracted) S.focus.camDistractedSec += 1;

  const camBonus = S.focus.cam && !S.focus.distracted ? 1.2 : 1.0;
  const effective = S.focus.mult * camBonus;

  const inRoomBreak = S.focus.roomId && S.roomPhase === 'break';

  if (!S.focus.distracted && !inRoomBreak) {
    const earned = Math.round(effective);
    S.focus.xp += earned;
    if (S.focus.roomId) S.focus.roomXpEarned += earned;
    wsSend({ type: 'xp:tick', amount: earned });
    if (S.user) checkXpMilestone((S.user.xp_daily || 0) + S.focus.xp);
  }

  if (S.focus.roomId && S.focus.elapsed % 2 === 0) {
    wsSend({
      type: 'room:presence',
      roomId: S.focus.roomId,
      sessionXp: S.focus.xp,
      camera: S.focus.cam,
      distracted: S.focus.distracted,
    });
  }

  updateFocusDisplay();

  if (S.focus.soloCommit > 0 && S.focus.elapsed >= S.focus.soloCommit * 60) {
    toast('commit done · full xp locked in', 3500);
    stopFocus(true);
  }
}

function updateFocusDisplay() {
  const m = Math.floor(S.focus.elapsed / 60);
  const s = S.focus.elapsed % 60;
  $('#focus-timer').textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  const camBonus = S.focus.cam && !S.focus.distracted ? 1.2 : 1.0;
  $('#focus-mult').textContent = '×' + (S.focus.mult * camBonus).toFixed(1);
  $('#focus-xp').textContent = S.focus.xp;

  if (S.focus.soloCommit > 0) {
    const remaining = S.focus.soloCommit * 60 - S.focus.elapsed;
    const rm = Math.max(0, Math.floor(remaining / 60));
    const rs = Math.max(0, remaining % 60);
    $('#commit-remaining').textContent = String(rm).padStart(2, '0') + ':' + String(rs).padStart(2, '0');
  }

  if (S.focus.roomId && S.focus.sessionEnd) {
    const remaining = S.focus.sessionEnd - Date.now();
    const rm = Math.max(0, Math.floor(remaining / 60000));
    const rs = Math.max(0, Math.floor((remaining % 60000) / 1000));
    const txt = `room: ${String(rm).padStart(2, '0')}:${String(rs).padStart(2, '0')} left`;
    const el = $('#focus-commit');
    el.style.display = 'block';
    el.innerHTML = `shared session · <em>${txt}</em>`;
  }
}

function updatePhaseBanner() {
  if (!S.focus.roomId) return;
  const el = $('#phase-banner');
  $('#phase-label').textContent = S.roomPhase === 'break' ? 'break' : 'focus phase';
  $('#phase-voice').textContent = S.roomPhase === 'break' ? 'open' : 'locked';
  el.classList.toggle('voice-open', S.roomPhase === 'break');
}

function updateFocusMembers() {
  if (!S.currentRoom) return;
  const names = S.currentRoom.members.map(m => m.username).join(' · ');
  $('#focus-room-members').textContent = names ? `in room: ${names}` : '';
}

function scheduleMethodPrompt() {
  const delay = 8 * 60 * 1000 + Math.random() * 5 * 60 * 1000;
  S.focus.methodTimer = setTimeout(() => {
    if (!S.focus.active) return;
    if (S.user?.notif_prefs?.methods === false) { scheduleMethodPrompt(); return; }
    showMethodPrompt();
    scheduleMethodPrompt();
  }, delay);
}

function showMethodPrompt() {
  const method = STUDY_METHODS[Math.floor(Math.random() * STUDY_METHODS.length)];
  $('#method-title').textContent = method.title;
  $('#method-desc').textContent = method.desc;
  $('#focus-method').style.display = 'block';
}
function hideMethodPrompt() { $('#focus-method').style.display = 'none'; }

function setupFocus() {
  $('#focus-exit').addEventListener('click', () => handleExitFocus());
  $('#focus-stop').addEventListener('click', () => handleExitFocus());
  $('#focus-camera').addEventListener('click', toggleCamera);
  $$('.amb-btn').forEach(b => b.addEventListener('click', () => toggleAmbient(b.dataset.amb)));
  $('#method-done').addEventListener('click', () => {
    S.focus.xp += 10;
    wsSend({ type: 'xp:tick', amount: 10 });
    wsSend({ type: 'session:method' });
    toast('+10 xp');
    hideMethodPrompt();
    updateFocusDisplay();
  });
  $('#method-skip').addEventListener('click', hideMethodPrompt);
  $('#se-done').addEventListener('click', () => { hideModal('modal-session-end'); goTo('home'); });
}

function handleExitFocus() {
  if (S.focus.soloCommit > 0) {
    const remaining = S.focus.soloCommit * 60 - S.focus.elapsed;
    if (remaining > 0) {
      if (!confirm(`you committed ${S.focus.soloCommit} min. leave now = 0 xp. sure?`)) return;
      stopFocus(false);
      return;
    }
  }
  if (S.focus.roomId && S.focus.sessionEnd) {
    const msLeft = S.focus.sessionEnd - Date.now();
    if (msLeft > 60000 && S.focus.roomXpEarned > 0) {
      const half = Math.floor(S.focus.roomXpEarned / 2);
      if (!confirm(`leave now? you'll lose ${half} xp (half of what you earned in this room). continue?`)) return;
    }
  }
  stopFocus(true);
}

async function toggleCamera() {
  if (S.focus.cam) {
    stopCamera();
    $('#focus-camera').textContent = 'camera: off';
    $('#cam-pip').style.display = 'none';
    S.focus.cam = false;
    S.peers.forEach(({ pc }) => {
      pc?.getSenders().filter(s => s.track?.kind === 'video').forEach(s => {
        try { pc.removeTrack(s); } catch {}
      });
    });
    return;
  }
  const ok = confirm('camera stays on your device. frames go directly peer-to-peer with end-to-end encryption. use it?');
  if (!ok) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, facingMode: 'user' }, audio: false });
    S.focus.camStream = stream;
    $('#cam-video').srcObject = stream;
    $('#cam-pip').style.display = 'block';
    $('#focus-camera').textContent = 'camera: on · +20%';
    S.focus.cam = true;
    startBasicFocusDetection();
    if (S.focus.roomId) publishStreamToPeers();
  } catch (e) {
    toast('camera blocked: ' + e.message);
  }
}

function stopCamera() {
  if (S.focus.camStream) { S.focus.camStream.getTracks().forEach(t => t.stop()); S.focus.camStream = null; }
  if (S.focus.detectTimer) { clearInterval(S.focus.detectTimer); S.focus.detectTimer = null; }
}

function startBasicFocusDetection() {
  const video = $('#cam-video');
  const canvas = document.createElement('canvas');
  canvas.width = 60; canvas.height = 45;
  const ctx = canvas.getContext('2d');
  let lastFrame = null;
  let stillCount = 0;

  S.focus.detectTimer = setInterval(() => {
    if (!S.focus.cam || video.videoWidth === 0) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    let brightness = 0;
    for (let i = 0; i < frame.length; i += 16) brightness += frame[i] + frame[i + 1] + frame[i + 2];
    brightness /= (frame.length / 16) * 3;
    const tooDark = brightness < 30;

    let tooStill = false;
    if (lastFrame) {
      let diff = 0;
      for (let i = 0; i < frame.length; i += 16) diff += Math.abs(frame[i] - lastFrame[i]);
      diff /= (frame.length / 16);
      tooStill = diff < 1.5;
    }
    lastFrame = frame;

    if (tooDark || tooStill) stillCount++; else stillCount = 0;

    const distracted = stillCount > 4;
    if (distracted !== S.focus.distracted) {
      S.focus.distracted = distracted;
      const cs = $('#cam-status');
      cs.textContent = distracted ? 'no one home' : 'focused';
      cs.classList.toggle('distracted', distracted);
      if (distracted) toast('xp paused · look at the screen');
    }
  }, 1500);
}

function stopFocus(success) {
  const committed = S.focus.soloCommit > 0;
  const completed = committed && success;
  const xpGained = (committed && !completed) ? 0 : S.focus.xp;

  S.focus.active = false;
  clearInterval(S.focus.tickInterval);
  clearTimeout(S.focus.methodTimer);
  stopCamera();
  stopAmbient();
  hideMethodPrompt();
  $('#cam-pip').style.display = 'none';
  $('#focus-camera').textContent = 'camera: off';

  wsSend({
    type: 'session:end',
    xp_gained: xpGained,
    camSeconds: S.focus.camSeconds,
    camDistractedSec: S.focus.camDistractedSec,
  });

  if (S.focus.roomId) {
    wsSend({ type: 'room:leave', roomId: S.focus.roomId });
    closeAllPeers();
    S.currentRoom = null;
  }

  if (committed && !completed) {
    toast('commit broken · 0 xp this session', 3500);
    if (S.user) {
      S.user.xp_total -= S.focus.xp;
      S.user.xp_daily = Math.max(0, S.user.xp_daily - S.focus.xp);
    }
  } else {
    const mins = Math.floor(S.focus.elapsed / 60);
    showSessionEnd({ xp: xpGained, mins, streak: S.user?.streak || 0, streakNew: mins >= 5 });
  }

  S.focus.roomId = null;
  S.focus.soloCommit = 0;
  S.focus.roomXpEarned = 0;
  if (committed && !completed) goTo('home');
  else setTimeout(() => goTo('home'), 200);
}

function setupChallenge() {
  $('#challenge-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const target = $('#ch-target').value.trim();
    const duration = parseInt($('#ch-duration').value, 10);
    if (!target) return;
    wsSend({ type: 'battle:challenge', kzenId: target, duration });
    hideModal('modal-challenge');
    $('#ch-target').value = '';
  });

  $('#battle-accept').addEventListener('click', () => {
    if (!S.pendingBattle) return;
    wsSend({ type: 'battle:accept', battleId: S.pendingBattle.battleId });
    hideModal('modal-battle-invite');
  });
  $('#battle-decline').addEventListener('click', () => {
    if (!S.pendingBattle) return;
    wsSend({ type: 'battle:decline', battleId: S.pendingBattle.battleId });
    hideModal('modal-battle-invite');
  });
  $('#battle-forfeit').addEventListener('click', () => {
    if (!S.battle.active) return;
    wsSend({ type: 'battle:forfeit', battleId: S.battle.id });
  });
  $('#battle-exit').addEventListener('click', () => {
    if (S.battle.active) wsSend({ type: 'battle:forfeit', battleId: S.battle.id });
  });
}

function startBattleUI(msg) {
  S.battle.active = true;
  S.battle.id = msg.battleId;
  S.battle.duration = msg.duration;
  S.battle.start = Date.now();
  S.battle.opponent = msg.opponent;
  S.battle.youXp = 0; S.battle.themXp = 0;

  $('#duel-you').textContent = S.user.username;
  $('#duel-them').textContent = msg.opponent.username;
  $('#duel-you-xp').textContent = '0';
  $('#duel-them-xp').textContent = '0';

  goTo('battle');
  S.battle.tickInterval = setInterval(battleTick, 1000);
}

function battleTick() {
  if (!S.battle.active) return;
  const elapsed = Math.floor((Date.now() - S.battle.start) / 1000);
  const remaining = Math.max(0, S.battle.duration * 60 - elapsed);
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  $('#battle-timer').textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');

  const mult = Math.floor(elapsed / 60) >= 20 ? 1.2 : 1.0;
  wsSend({ type: 'battle:xp', battleId: S.battle.id, amount: Math.round(mult) });

  if (remaining === 0) clearInterval(S.battle.tickInterval);
}

function updateBattleXp(xp) {
  const youId = S.user.id;
  const youXp = xp[youId] || 0;
  const themXp = Object.entries(xp).find(([k]) => String(k) !== String(youId))?.[1] || 0;
  S.battle.youXp = youXp; S.battle.themXp = themXp;
  $('#duel-you-xp').textContent = youXp;
  $('#duel-them-xp').textContent = themXp;
  const max = Math.max(youXp, themXp, 1);
  $('#duel-you-bar').style.width = (youXp / max * 100) + '%';
  $('#duel-them-bar').style.width = (themXp / max * 100) + '%';
}

function endBattleUI(msg) {
  S.battle.active = false;
  clearInterval(S.battle.tickInterval);
  const youWon = msg.winner === S.user.username;
  toast(youWon ? `you won · +${msg.pot} xp` : `${msg.winner} won`, 4000);
  S.battle.id = null;
  setTimeout(() => goTo('home'), 1500);
}

function showModal(id) { $('#' + id).classList.add('visible'); }
function hideModal(id) { $('#' + id).classList.remove('visible'); }

function setupModals() {
  document.querySelectorAll('[data-close]').forEach(b => {
    b.addEventListener('click', () => hideModal(b.dataset.close));
  });
  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', (e) => { if (e.target === m) hideModal(m.id); });
  });
}

function setupNav() {
  $$('.nav-btn').forEach(b => b.addEventListener('click', () => goTo(b.dataset.go)));
}

function showWelcomeBack(name) {
  $('#welcome-name').textContent = name || 'friend';
  goTo('welcome');
  setTimeout(() => goTo('home'), 1800);
}

async function init() {
  setupIntro();
  setupAuth();
  setupTodoForm();
  setupPathCards();
  setupSoloSetup();
  setupRoomsScreen();
  setupFriendSearch();
  setupBoard();
  setupSettings();
  setupFocus();
  setupChallenge();
  setupModals();
  setupNav();

  const token = localStorage.getItem('kaizen_token');
  if (token) {
    S.token = token;
    const r = await api('/api/me');
    if (r.ok) {
      S.user = r.user;
      applyTheme(r.user.theme || 'ink');
      connectWS();
      showWelcomeBack(r.user.username);
      return;
    }
    localStorage.removeItem('kaizen_token');
    S.token = null;
  }
  goTo('intro');
}

document.addEventListener('DOMContentLoaded', init);
