# Kiro — Stay In It
> Real-time competitive study app. MVP build.

---

## File Structure

```
kiro/
│
├── frontend/                  ← Everything users see in the browser
│   ├── index.html             ← The entire app (5 screens in one file)
│   ├── style.css              ← All styles, themes, animations
│   ├── app.js                 ← All logic: screens, XP, timer, WebSocket
│   └── manifest.json          ← Makes it installable as a PWA
│
├── backend/
│   ├── package.json           ← Node.js dependencies list
│   └── src/
│       ├── index.js           ← Main server: Express REST + WebSocket
│       └── db.js              ← All database queries (PostgreSQL)
│
├── nginx.conf                 ← Web server config for your Arch box
├── setup.sh                   ← Runs ONCE to install everything on Arch
└── README.md                  ← This file
```

---

## What Each File Does

### `frontend/index.html`
The whole app in one HTML file. Contains 5 `<div>` screens:
- `#screen-onboarding` — username + theme picker
- `#screen-rooms` — list of study rooms to join
- `#screen-focus` — the actual study room with timer + XP
- `#screen-leaderboard` — daily and monthly rankings
- `#screen-profile` — your stats and theme switcher
- `#screen-solo` — dark mode solo focus (no rooms)

Only one screen is visible at a time. `goTo('rooms')` handles switching.

### `frontend/style.css`
All the visual design. Uses CSS variables for theming:
```css
:root { --accent: #3b82f6; }          /* default blue */
[data-theme="green"] { --accent: #10b981; } /* overrides for each theme */
```
Changing `data-theme` on `<html>` is all it takes to switch themes instantly.

### `frontend/app.js`
All the JavaScript logic:
- `State` object — single source of truth for username, XP, theme, etc.
- `goTo(screen)` — shows/hides screens
- `toggleFocus()` — starts/pauses the XP timer
- `tickFocus()` — runs every second, adds XP with multiplier
- `getMultiplier(minutes)` — returns 1×/1.2×/1.5×/2× based on time
- `connectWS(roomId)` — connects to backend WebSocket
- `saveState() / loadState()` — localStorage persistence
- `applyTheme(theme)` — switches theme and saves it

### `backend/src/index.js`
Node.js server. Two things in one file:
1. **WebSocket server** on port 3001 — handles join/leave/XP in real-time
2. **REST API** — `/api/leaderboard`, `/api/rooms`, `/api/xp`

Has basic rate limiting: max 20 WebSocket messages per second per user.

### `backend/src/db.js`
All PostgreSQL queries. Tables:
- `users` — username, xp_daily, xp_monthly, xp_total, streak, sessions
- `sessions` — logs each completed study session

If the DB isn't available, the server still runs — just without persistence.

### `nginx.conf`
Routes traffic on port 80:
- `/` → serves the frontend files from `/var/www/kiro`
- `/api/*` → proxies to Node.js on port 3001

### `setup.sh`
Automated installer for Arch Linux. Installs: Node.js, PostgreSQL, nginx.
Creates the DB, copies files, sets up a systemd service so the backend
restarts automatically if it crashes.

---

## How To Run It

### On your Arch server (first time):
```bash
# 1. Clone or copy the kiro/ folder to your home directory
# 2. Run the setup script
chmod +x setup.sh
sudo ./setup.sh

# 3. Check everything is running
sudo systemctl status kiro     # backend
sudo systemctl status nginx    # frontend
curl http://localhost:3001/health
```

### During development (without nginx):
```bash
# Terminal 1 — backend
cd kiro/backend
npm install
node src/index.js

# Terminal 2 — frontend (any simple HTTP server)
cd kiro/frontend
npx serve .
# or: python3 -m http.server 8080
```

Then open `http://localhost:8080` in your browser.

### Change the DB password:
Edit `setup.sh` and `backend/src/index.js` — find `changeme` and replace it.
Or set environment variables before running:
```bash
export DB_PASSWORD=your_real_password
node src/index.js
```

---

## The XP System

| Time focused | Multiplier | XP/sec |
|-------------|------------|--------|
| 0–10 min    | 1×         | 1      |
| 10–25 min   | 1.2×       | 1.2    |
| 25–50 min   | 1.5×       | 1.5    |
| 50+ min     | 2×         | 2      |

---

## What's NOT in the MVP (add later)

- Camera focus detection (MediaPipe FaceMesh)
- Voice chat (WebRTC)
- Monthly challenge system
- Real push notifications (need a service worker + backend)
- Real user authentication
- Battle/timed sessions feature
- Rank decay (−30 XP after 48h)
- Comeback bonus (+50% XP after inactivity)

These were cut intentionally. Ship the core loop first.
