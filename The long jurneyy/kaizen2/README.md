# kaizen v2.01

## run it

```bash
cd backend
npm install
npm start
```

In another terminal:

```bash
cd frontend
npx serve -s . -l 3000
```

**The `-s` flag is not optional.** Without it, your frontend dir is browsable by anyone on your network (security hole we hit before).

Open http://localhost:3000

## what's new vs v2

- **2 default themes** (ink, paper) + **3 energy themes** opt-in (lime, electric, sunrise). Broken color themes removed.
- **Auto-status** — behavior-driven: focus / break / done / away. Toggleable in settings.
- **Settings split** into 5 tabs: profile, security, notifications, friends, appearance.
- **Leaderboard** has 4 periods: today / week / month / all-time.
- **Welcome-back splash** for returning users with valid token (1.8s, skips intro).
- **Daily rotating quests** — 3 per day, pulled from 29-task pool, deterministic per-user-per-day, auto-reward.
- **Voice cycles in rooms** — voice locked during focus phase, opens during break. 25/5, 50/10, 120/30.
- **Solo commit** — pick duration, leave early = 0 xp. Enforced server-side via session:end.
- **SVG line art** in intro — mountain, sunrise, open books.
- **Password change** endpoint + form in security panel.
- **Unfriend** endpoint + button in friend manager.

## deploy on your arch server

```bash
# backend as a service
sudo cp backend /opt/kaizen -r
cd /opt/kaizen && npm install --production

# systemd unit
sudo tee /etc/systemd/system/kaizen.service <<EOF
[Unit]
Description=Kaizen backend
After=network.target

[Service]
Type=simple
User=ayman
WorkingDirectory=/opt/kaizen
ExecStart=/usr/bin/node index.js
Restart=on-failure
Environment=JWT_SECRET=CHANGE_THIS
Environment=PORT=3001

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable --now kaizen
```

Put nginx in front using the included `nginx.conf`. Point it at `/var/www/kaizen` for static frontend.

## set a real JWT_SECRET

Before going public:

```bash
openssl rand -hex 32
```

Export it as `JWT_SECRET` in your systemd unit. The dev default in the code is insecure.

## storage

In-memory. Restarts wipe everything. When you have 20+ real users, swap `backend/db.js` for Postgres or SQLite — the API surface stays identical.

## known v2.01 limitations

- Camera focus detection is motion + brightness only. Good enough to catch "left the desk." For real gaze tracking, swap in MediaPipe FaceMesh in v3.
- No push notifications. Toasts only. Fine for web, need service worker for mobile PWA.
- Solo commit trusts the client clock for "finished full duration." Server validates the session:end event. A determined cheater could fake timestamps — worth hardening when it becomes a problem.
