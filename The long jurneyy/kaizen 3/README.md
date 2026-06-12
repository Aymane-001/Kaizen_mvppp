# Kaizen 改善

> continuous improvement · study together or alone

## Run locally (Mac)

```bash
# Terminal 1 — backend
cd backend && npm install && node index.js

# Terminal 2 — frontend
cd backend && node serve-frontend.js
```

Open http://localhost:3000

Share with friends on same WiFi: http://YOUR_MAC_IP:3000

## Files

```
kaizen/
├── frontend/
│   ├── index.html   all screens
│   ├── style.css    all styles + themes
│   └── app.js       all logic
└── backend/
    ├── index.js     Express + WebSocket + JWT + battles
    ├── db.js        in-memory data (add PostgreSQL later)
    ├── serve-frontend.js  static file server (secure)
    └── package.json
```

## What's in it

- register / login / guest mode
- animated screen transitions
- pulse hook — "X students from your school are online"
- solo focus with commit mode (leave early = 0 xp)
- study rooms (max 20 people, live sync)
- 1v1 duels (winner takes all session XP)
- ambient sounds: lo-fi / rain / café (generated locally, no CDN)
- optional camera with focus detection + peer video
- daily quests (auto-complete, no cheating)
- personal task list (+10 xp/task during session, max 3/day)
- leaderboard (today / week / month / all time)
- friends system (search by username or KZEN# ID)
- 12 themes (6 colors × ink/paper)
- session end screen with stats + quote
- XP milestone toasts (50/100/200/500 xp)
- streak system with freeze tokens
- no PostgreSQL required for MVP (in-memory, resets on restart)

## Deploy to your server

```bash
# Install nginx + node
sudo pacman -S nginx nodejs npm

# Copy files
scp -r kaizen/ user@your-server:/opt/kaizen

# Backend service (create /etc/systemd/system/kaizen.service)
[Service]
WorkingDirectory=/opt/kaizen/backend
ExecStart=/usr/bin/node index.js
Restart=always
Environment=NODE_ENV=production

# Frontend service
[Service]
WorkingDirectory=/opt/kaizen/backend
ExecStart=/usr/bin/node serve-frontend.js
Restart=always

sudo systemctl enable --now kaizen kaizen-frontend
```
