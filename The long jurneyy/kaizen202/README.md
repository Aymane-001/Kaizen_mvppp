# kaizen v2.02

## what's new vs v2.01

- **WebRTC video** in rooms — peer-to-peer, end-to-end encrypted, no server sees frames
- **Peer tiles** in corner showing each member's video + live xp + status
- **Shared room timer** — one clock for everyone, late joiners see time remaining
- **Room commitment rule** — leave before session ends = lose half the xp earned in that room
- **Room preview modal** — see subject, length, time left, phase, members before joining
- **Session length picker** when creating rooms (25, 50, 90, 120 min)
- **Auto session restart** — room cycles on its own; when one ends, a new one begins
- **Security hardening**: Helmet headers, rate limiting on auth/writes, CORS allowlist, CSP, WS payload caps, JWT_SECRET required in production, directory listing banned, path traversal blocked
- **Dedicated static server** (`serve-frontend.js`) replaces `npx serve` — no more accidental directory exposure

## run (dev)

```bash
cd backend
npm install
npm start

# in another terminal
node serve-frontend.js
```

Open http://localhost:3000

**On LAN / friends on same WiFi:** your friends hitting `http://10.x.x.x:3000` will get blocked by browsers trying to use the camera — browsers require HTTPS for camera access except on localhost. Either:
- use ngrok: `ngrok http 3000` (gives you an HTTPS url for free)
- or set up HTTPS properly on your Arch server (see below)

## deploy on your Arch server (HTTPS, proper)

### 1. install deps

```bash
sudo pacman -S nodejs npm nginx certbot certbot-nginx ufw
```

### 2. move kaizen to /opt

```bash
sudo cp -r kaizen /opt/
sudo chown -R ayman:ayman /opt/kaizen
cd /opt/kaizen/backend && npm install --production
```

### 3. firewall lockdown (this solves your "friend got my files" problem)

```bash
cd /opt/kaizen
sudo ./setup-firewall.sh
```

It asks which IPs to allow. For development with one friend, type their IP. For public, type `any` (but only after HTTPS is set up).

### 4. HTTPS with Let's Encrypt

You need a real domain name pointing to your server. If you don't have one, get a free subdomain:
- **DuckDNS** (free): sign up, claim `yourname.duckdns.org`, point it at your server IP.
- Then:

```bash
sudo certbot --nginx -d yourname.duckdns.org
```

Edit `/etc/nginx/sites-available/kaizen` and replace `YOUR_DOMAIN` with your actual domain. Copy the included `nginx.conf` there.

### 5. backend as systemd service

```bash
sudo tee /etc/systemd/system/kaizen.service <<EOF
[Unit]
Description=Kaizen backend
After=network.target

[Service]
Type=simple
User=ayman
WorkingDirectory=/opt/kaizen/backend
ExecStart=/usr/bin/node index.js
Restart=on-failure
Environment=NODE_ENV=production
Environment=JWT_SECRET=$(openssl rand -hex 32)
Environment=PORT=3001
Environment=ALLOWED_ORIGINS=https://yourname.duckdns.org

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable --now kaizen
```

### 6. frontend files

```bash
sudo mkdir -p /var/www/kaizen
sudo cp -r /opt/kaizen/frontend/* /var/www/kaizen/
sudo chown -R http:http /var/www/kaizen
sudo systemctl restart nginx
```

Done. Visit `https://yourname.duckdns.org` — camera will work, no "insecure" warnings, friends on your LAN can only access via that URL.

## security summary (what changed)

| risk | fix |
|------|-----|
| dir listing via `npx serve .` | replaced with locked-down Express static server |
| no rate limiting | 20 auth attempts / 15 min, 60 writes / min |
| weak CORS | explicit origin allowlist |
| no CSP | strict CSP blocking injected scripts |
| JWT dev secret in prod | fails fast if `NODE_ENV=production` without `JWT_SECRET` |
| WS payload abuse | 64 KB cap per message |
| WebRTC peer stalking | signaling only relays between users in same room |
| request body DOS | 256 KB cap on all API bodies |
| open ports to LAN | `setup-firewall.sh` allows only specific IPs |

## WebRTC notes

- Uses Google's public STUN servers (`stun:stun.l.google.com:19302`)
- Works fine on same network and most home networks
- AUI's campus firewall / symmetric NAT may block peer-to-peer — if connections fail, you need a TURN server (~$5/mo on Coturn, or free tier of Twilio/Cloudflare)
- No TURN = graceful fallback: peer tiles still show name + xp + status, just no video

## known limits

- In-memory storage — server restart wipes users, rooms, etc. Swap `db.js` for Postgres when you hit 20+ real users.
- No push notifications (browser only, needs service worker for mobile PWA)
- Camera focus detection is motion-based. Good enough to catch "left the desk" but not eye gaze.

## what to test with your first 20 users

Don't rebuild anything for 1 week. Watch:
1. Do rooms get joined more than solo? (hypothesis: yes, for motivation)
2. Do people actually use camera? (hypothesis: <30% will)
3. Does the half-xp penalty make people finish sessions? (hypothesis: yes)
4. Does the shared timer create "late joiner FOMO"? (the UX bet)

Write down the answers. Iterate on data, not on vibes.
