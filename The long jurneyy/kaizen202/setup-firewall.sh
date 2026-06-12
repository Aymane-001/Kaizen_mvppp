#!/usr/bin/env bash
set -euo pipefail

echo "kaizen firewall setup (Arch / systemd)"
echo "this locks down your server so only specified IPs can reach kaizen"
echo

if [ "$EUID" -ne 0 ]; then
  echo "run as root: sudo $0"
  exit 1
fi

if ! command -v ufw &>/dev/null; then
  echo "installing ufw..."
  pacman -S --noconfirm ufw
fi

systemctl enable --now ufw

ufw --force reset

ufw default deny incoming
ufw default allow outgoing

ufw allow 22/tcp comment 'ssh'

read -rp "allow kaizen access from which IPs? (space-separated, e.g. '10.126.73.50 10.126.73.51', or 'any' for public): " IPS

if [ "$IPS" = "any" ]; then
  ufw allow 443/tcp comment 'kaizen https'
  ufw allow 80/tcp comment 'kaizen http redirect'
  echo "public access enabled on 80/443. make sure you have HTTPS set up."
else
  for ip in $IPS; do
    ufw allow from "$ip" to any port 3000 proto tcp comment 'kaizen frontend'
    ufw allow from "$ip" to any port 3001 proto tcp comment 'kaizen backend'
    ufw allow from "$ip" to any port 443 proto tcp comment 'kaizen https'
    echo "  allowed $ip"
  done
fi

ufw --force enable
ufw status verbose

echo
echo "done. to change allowed IPs later: sudo ufw status numbered, then sudo ufw delete N"
echo "to disable: sudo ufw disable"
