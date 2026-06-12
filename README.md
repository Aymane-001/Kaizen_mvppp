<<<<<<< HEAD
# Kaizen_mvppp

> Study together, earn XP, battle friends, and stay accountable.

---

## What is Kaizen?

Kaizen (改善) means *continuous improvement* in Japanese.
The app turns studying into a social, competitive experience — live rooms, XP battles, focus detection via camera, and a leaderboard that resets daily so everyone has a shot.

---

## Features

* **Live Study Rooms** — Create or join rooms by subject. See who's focusing in real time.
* **XP Battles** — Challenge a friend to a 25, 50, or 120-minute focus battle. Winner takes all XP from both sides.
* **Focus Camera** — Optional AI detection using MediaPipe FaceMesh. Detects face presence, eye openness, and head orientation. Runs 100% locally — no video ever leaves your device.
* **HP System** — Your health points drain when you skip days and recharge when you study.
* **Auto Challenges** — Daily challenges complete automatically when you hit the milestone. No manual claiming, no cheating.
* **Leaderboard** — Daily and monthly XP rankings with battle win badges.
* **Friends System** — Add friends by username or KZEN# ID. See their XP, streak, and status.
* **Guest Mode** — Browse without an account. XP disappears on refresh. No rooms, no leaderboard.
* **12 Student Themes** — 6 colors × light/dark mode.
* **Gamer Mode** — Dark neon UI, rank system (Bronze → Silver → Gold → Platinum → Legend), pixel font timer.
* **AUI-specific** — School, major, and year picker. Rooms suggested based on your year level.

---

## Tech Stack

**Frontend** — Vanilla JS, CSS custom properties, MediaPipe FaceMesh
**Backend** — Node.js, Express, WebSocket (ws), bcryptjs, jsonwebtoken
**Database** — PostgreSQL (optional — falls back to in-memory for development)

---

## Project Structure
=======
# 改善 Kaizen

> Study hard. Or lose your streak. Your call.

Kaizen is a real-time social study app built for students who need accountability, not another productivity guru. XP is earned by time focused — not by what you claim. Sessions are tracked, streaks are enforced, and your friends can see exactly how much you're slacking.

---

## What it does

**Focus modes**
- **Solo commit** — pick a duration (25 / 50 / 90 / 120 min), lock in. Leave early = 0 XP.
- **Study rooms** — live rooms up to 20 people. Synced session timers, voice unlocked on break phase only.
- **1v1 Duels** — challenge a friend. Race for XP. Winner takes the loser's earned XP.

**XP & progression**
- XP multiplier scales with session length: ×1.0 → ×1.2 → ×1.5 → ×2.0
- Camera on = +20% XP bonus (peer-to-peer, never leaves your device)
- Random focus bursts (+10–19 XP) fire every 7–13 min — unpredictably, on purpose
- Daily / weekly / monthly / all-time leaderboards
- Streak system with freeze tokens (replenished every Monday)
- Identity labels: 7-day streak → `kaizen regular`, 30d → `kaizen grinder`, 100d → `kaizen machine`

**Camera & focus detection** *(optional)*
- Face presence tracked via BlazeFace (runs locally, no server)
- Phone detected via COCO-SSD object detection
- Head turned away → XP paused + sarcastic voice alert
- Session-end **Focus Score** (0–100): calculated from face presence %, phone detections, distraction count

**Daily quests**
- 3 quests per day, seeded by user + date (same every reload, no cheating)
- 28 quest types: time-based, camera, duels, streaks, todo completion, etc.
- Rewards auto-claimed and pushed via WebSocket

**Social**
- Friends by username or KZEN# ID (e.g. `AB3K7PQR`)
- Live online/offline/status push to friends
- Social ticker during sessions: friend comes online → you see it
- Streak-at-risk warning: if < 8h left in the day and 0 XP earned

**Ambient sound** *(no CDN, generated locally)*
- 🌧 Rain · ☕ Café · 📚 Library · 〰 White noise — all synthesized via Web Audio API

**12 themes** — 6 color variants × ink/paper modes + gamer mode

---

## Run locally

```bash
# 1 — backend
cd backend && npm install && node index.js
# runs on http://localhost:3001

# 2 — frontend (separate terminal)
cd frontend                               
npx serve -s . -l 8080
# runs on http://localhost:8080
```

Open [http://localhost:8080](http://localhost:8080)

Share on the same WiFi: `http://YOUR_MAC_IP:8080`

> **Note:** data is in-memory. Everything resets on server restart. Add PostgreSQL when you're ready to persist.

---

## Environment variables

| Variable | Default | Notes |
|----------|---------|-------|
| `JWT_SECRET` | random (dev) | **Required in production** |
| `PORT` | `3001` | Backend port |
| `ALLOWED_ORIGINS` | `localhost:8080` | CORS whitelist |

```bash
JWT_SECRET=your-secret-here node index.js
```

---

## Project structure
>>>>>>> bdb5305 (waaaaa finally ig)

```
kaizen/
├── frontend/
<<<<<<< HEAD
│   ├── index.html    ← All screens (intro, auth, home, focus, battles, leaderboard, friends, profile)
│   ├── style.css     ← All styles — 12 themes, student + gamer modes
│   └── app.js        ← All logic — auth, WebSocket, MediaPipe, battles, XP
└── backend/
    ├── index.js      ← Express server + WebSocket + JWT auth + battle engine
    ├── db.js         ← PostgreSQL queries (used when DB is available)
=======
│   ├── index.html       all screens (SPA)
│   ├── style.css        all styles + 12 themes
│   └── app.js           all client logic (~1700 lines)
└── backend/
    ├── index.js         Express + WebSocket + JWT + battle engine
    ├── db.js            in-memory store (users, rooms, sessions, todos)
    ├── serve-frontend.js static file server
>>>>>>> bdb5305 (waaaaa finally ig)
    └── package.json
```

---

<<<<<<< HEAD
## Run Locally

**Requirements:** Node.js 18+

```bash
# Terminal 1 — backend
cd kaizen/backend
npm install
node index.js
```

```bash
# Terminal 2 — frontend
cd kaizen/frontend
npx serve .
```

Open **http://localhost:3000**

The backend runs in in-memory mode by default — no database setup needed. Accounts reset when the backend restarts.

---

## Run With PostgreSQL (persistent data)

```bash
# Mac
brew install postgresql@15
brew services start postgresql@15
createdb kaizen
psql kaizen -c "CREATE USER kaizen_user WITH PASSWORD 'changeme';"
psql kaizen -c "GRANT ALL ON DATABASE kaizen TO kaizen_user;"

# Start backend with DB
DB_NAME=kaizen DB_USER=kaizen_user DB_PASSWORD=changeme node index.js
=======
## Deploy (Linux / VPS)

```bash
# Install
sudo apt install nginx nodejs npm   # or pacman / yum

# Copy
scp -r kaizen/ user@your-server:/opt/kaizen
cd /opt/kaizen/backend && npm install

# Backend service: /etc/systemd/system/kaizen.service
[Unit]
Description=Kaizen backend
After=network.target

[Service]
WorkingDirectory=/opt/kaizen/backend
ExecStart=/usr/bin/node index.js
Restart=always
Environment=NODE_ENV=production
Environment=JWT_SECRET=your-secret-here

[Install]
WantedBy=multi-user.target

# Frontend service: /etc/systemd/system/kaizen-frontend.service
[Unit]
Description=Kaizen frontend
After=network.target

[Service]
WorkingDirectory=/opt/kaizen/backend
ExecStart=/usr/bin/node serve-frontend.js
Restart=always

[Install]
WantedBy=multi-user.target

sudo systemctl enable --now kaizen kaizen-frontend
>>>>>>> bdb5305 (waaaaa finally ig)
```

---

<<<<<<< HEAD
## Share on Local Network

Once the backend and frontend are running, anyone on the same WiFi can access it at:

```
http://YOUR_MAC_IP:3000
```

Find your IP with `ipconfig getifaddr en0` on Mac.

---

## Environment Variables


| Variable      | Default                            | Description                           |
| ------------- | ---------------------------------- | ------------------------------------- |
| `PORT`        | `3001`                             | Backend port                          |
| `JWT_SECRET`  | `kaizen-dev-secret-change-in-prod` | Change this in production             |
| `DB_HOST`     | `localhost`                        | PostgreSQL host                       |
| `DB_PORT`     | `5432`                             | PostgreSQL port                       |
| `DB_NAME`     | `kaizen`                           | Database name                         |
| `DB_USER`     | `kaizen_user`                      | Database user                         |
| `DB_PASSWORD` | `changeme`                         | Database password                     |
| `MAIL_USER`   | —                                 | Gmail address for verification emails |
| `MAIL_PASS`   | —                                 | Gmail app password                    |
| `APP_URL`     | `http://localhost:3000`            | Used in verification email links      |

---

## Security

* Passwords hashed with bcrypt (10 rounds)
* JWT tokens with 30-day expiry
* XP validated server-side — max 3 XP/second, cheaters get reset
* Rate limiting: 40 WebSocket messages/second per connection
* Room names unique enforced server-side
* Camera: MediaPipe runs in-browser, zero frames sent to server

---

## Status

MVP - in active development.
Built at Al Akhawayn University, Ifrane, Morocco.

---

## License

`UNLICENSED` — All rights reserved.
Do not copy, distribute, or use without permission.
=======
## Stack

| Layer | Tech |
|-------|------|
| Backend | Node.js, Express, `ws` (WebSocket), JWT, bcrypt |
| Frontend | Vanilla JS SPA, Web Audio API, WebRTC (P2P camera) |
| ML (client) | TensorFlow.js · BlazeFace · COCO-SSD |
| Storage | In-memory (Map) — swap for PostgreSQL when needed |
| Auth | JWT (30-day tokens), bcrypt cost 12 |
>>>>>>> bdb5305 (waaaaa finally ig)
