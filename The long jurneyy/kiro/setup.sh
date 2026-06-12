#!/usr/bin/env bash
# ═══════════════════════════════════════════════
# KIRO — setup.sh
# Run this ONCE on your Arch Linux server to install
# everything Kiro needs.
# Usage: chmod +x setup.sh && sudo ./setup.sh
# ═══════════════════════════════════════════════

set -e  # Exit on any error

echo "╔═══════════════════════════════════╗"
echo "║   KIRO Server Setup — Arch Linux  ║"
echo "╚═══════════════════════════════════╝"

# ── 1. Update system ──────────────────────────
echo "[1/7] Updating packages..."
pacman -Syu --noconfirm

# ── 2. Install Node.js ────────────────────────
echo "[2/7] Installing Node.js..."
pacman -S --noconfirm nodejs npm

echo "Node version: $(node --version)"
echo "npm version:  $(npm --version)"

# ── 3. Install PostgreSQL ─────────────────────
echo "[3/7] Installing PostgreSQL..."
pacman -S --noconfirm postgresql

# Init DB cluster if not done
if [ ! -d /var/lib/postgres/data ]; then
  sudo -u postgres initdb -D /var/lib/postgres/data
fi

systemctl enable --now postgresql

# Create DB and user for Kiro
sudo -u postgres psql <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'kiro_user') THEN
    CREATE USER kiro_user WITH PASSWORD 'changeme';
  END IF;
END
\$\$;

SELECT 'CREATE DATABASE kiro OWNER kiro_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'kiro')\gexec
SQL

echo "DB 'kiro' and user 'kiro_user' created."

# ── 4. Install nginx ──────────────────────────
echo "[4/7] Installing nginx..."
pacman -S --noconfirm nginx

# Copy nginx config
mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled
cp /home/$(logname)/kiro/nginx.conf /etc/nginx/sites-available/kiro
ln -sf /etc/nginx/sites-available/kiro /etc/nginx/sites-enabled/kiro

# Make sure nginx includes sites-enabled
if ! grep -q "sites-enabled" /etc/nginx/nginx.conf; then
  sed -i '/http {/a\    include /etc/nginx/sites-enabled/*;' /etc/nginx/nginx.conf
fi

nginx -t && systemctl enable --now nginx

# ── 5. Copy frontend to web root ──────────────
echo "[5/7] Deploying frontend..."
mkdir -p /var/www/kiro
cp -r /home/$(logname)/kiro/frontend/* /var/www/kiro/
chown -R http:http /var/www/kiro

# ── 6. Install backend dependencies ──────────
echo "[6/7] Installing backend dependencies..."
cd /home/$(logname)/kiro/backend
npm install

# ── 7. Create systemd service for backend ─────
echo "[7/7] Setting up Kiro backend service..."
cat > /etc/systemd/system/kiro.service <<SERVICE
[Unit]
Description=Kiro Study App Backend
After=network.target postgresql.service

[Service]
Type=simple
User=$(logname)
WorkingDirectory=/home/$(logname)/kiro/backend
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3001
Environment=DB_HOST=localhost
Environment=DB_PORT=5432
Environment=DB_NAME=kiro
Environment=DB_USER=kiro_user
Environment=DB_PASSWORD=changeme

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable --now kiro

echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║  ✓ KIRO is running!                           ║"
echo "║                                               ║"
echo "║  Frontend: http://$(hostname -I | awk '{print $1}')          ║"
echo "║  Backend:  http://$(hostname -I | awk '{print $1}'):3001      ║"
echo "║  Health:   http://$(hostname -I | awk '{print $1}'):3001/health║"
echo "║                                               ║"
echo "║  Check status:                                ║"
echo "║    sudo systemctl status kiro                 ║"
echo "║    sudo systemctl status nginx                ║"
echo "╚═══════════════════════════════════════════════╝"
