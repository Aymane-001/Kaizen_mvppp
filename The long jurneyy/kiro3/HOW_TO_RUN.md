# Kiro v3 — How To Run on Mac

## File Structure
```
kiro3/
├── frontend/
│   ├── index.html      ← All 6 screens
│   ├── style.css       ← 12 themes (6 colors × light/dark) + gamer mode
│   ├── app.js          ← All logic
│   └── manifest.json   ← PWA
└── backend/
    ├── package.json
    └── src/
        ├── index.js    ← Server (Express + WebSocket + JWT)
        └── db.js       ← PostgreSQL queries
```

---

## Run on Mac (no database — rooms still work live!)

### Terminal 1 — Backend
```bash
cd kiro3/backend
npm install
node src/index.js
```
You'll see: `KIRO v3 — Port 3001 ready`
The backend warns about no PostgreSQL — that's fine. Rooms sync live via WebSocket. Auth stores to memory only (restarts clear accounts — OK for testing).

### Terminal 2 — Frontend
```bash
cd kiro3/frontend
npx serve .
```
Open: http://localhost:3000

---

## Test real-time rooms
1. Open http://localhost:3000 in two browser tabs
2. Register two accounts (different usernames)
3. Both join the same room
4. You'll see each other's names, XP, and focus status update live

---

## Camera + AI Focus Detection
- MediaPipe FaceMesh loads from CDN (needs internet)
- Detection: face presence + eye openness + head orientation
- 100% local — no video leaves your device
- If camera denied: app works normally, just without the bonus

---

## Security implemented
- Passwords hashed with bcrypt (12 rounds)
- JWT tokens (30 day expiry)
- XP validated server-side (max 3 XP/sec — cheaters get reset)
- Rate limiting: 30 messages/second per WebSocket
- Room names enforced unique server-side
- Camera feed: never sent anywhere, MediaPipe runs in-browser

---

## With PostgreSQL (for persistent data)
```bash
# Install PostgreSQL on Mac
brew install postgresql@15
brew services start postgresql@15

# Create DB
createdb kiro
psql kiro -c "CREATE USER kiro_user WITH PASSWORD 'changeme';"
psql kiro -c "GRANT ALL ON DATABASE kiro TO kiro_user;"

# Set env and run
DB_PASSWORD=changeme node src/index.js
```

---

## What's automatic (no cheating)
- ✅ Focus 30 min → auto-unlocks when timer hits 30:00
- ✅ 3-day streak → auto-unlocks from login history
- ✅ Study with 3 friends → auto-unlocks when 3 friends in same room
- ✅ Camera 5 min → auto-unlocks after 5 min of camera on
- ✅ Top 10 → auto-unlocks when leaderboard is checked
- ❌ None can be manually clicked/cheated
