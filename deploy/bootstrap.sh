#!/usr/bin/env bash
# One-shot hardening + Docker install for a fresh Ubuntu 24.04 box.
# Idempotent: safe to re-run.
#
#   ssh root@<ip> 'bash -s' < deploy/bootstrap.sh
#
# Everything below assumes a brand-new host with nothing else on it.

set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "run as root" >&2
  exit 1
fi

echo "== base packages =="
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
# Deliberately no postgresql-client: dumps run inside the pinned
# supabase/postgres:17.6.1.136 image, which guarantees a pg_dump that matches
# the server version. Ubuntu 24.04 only ships client 16, which refuses to dump
# from a 17 server.
apt-get install -y -qq ca-certificates curl gnupg git ufw fail2ban unattended-upgrades \
  restic htop jq logrotate

echo "== swap (2 GB, no swap on a 8 GB box would make a memory spike fatal) =="
if [[ ! -f /swapfile ]]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -w vm.swappiness=10
  echo 'vm.swappiness=10' > /etc/sysctl.d/99-swappiness.conf
fi

echo "== ssh: keys only =="
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
systemctl reload ssh
# Keep an existing session open until you have confirmed a new key-based login.

echo "== firewall =="
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'ssh'
ufw allow 80/tcp comment 'acme + http->https'
ufw allow 443/tcp comment 'https'
ufw --force enable

echo "== fail2ban =="
cat >/etc/fail2ban/jail.local <<'JAIL'
[sshd]
enabled = true
maxretry = 5
bantime = 1h
findtime = 10m
JAIL
systemctl enable --now fail2ban

echo "== unattended security upgrades =="
cat >/etc/apt/apt.conf.d/20auto-upgrades <<'APT'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
APT
systemctl enable --now unattended-upgrades

echo "== docker =="
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    >/etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

echo "== docker log rotation (json-file grows without limit by default) =="
cat >/etc/docker/daemon.json <<'DOCKER'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "50m", "max-file": "5" },
  "live-restore": true
}
DOCKER
systemctl restart docker

echo "== layout =="
install -d -m 0750 /srv/herbally/{app,supabase,backups}

echo
echo "done. next: rsync the repo to /srv/herbally/app and read deploy/README.md"
