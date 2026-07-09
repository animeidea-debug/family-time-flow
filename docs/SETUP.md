# Setup Guide

## Prerequisites

- A ZSpace NAS (or any Linux host with Docker)
- macOS development machine (or Windows with Git Bash)
- Tailscale Funnel or ZSpace remote access configured

## New Machine Setup (one-time per computer)

### 1. Configure ~/.nas-env

Create `~/.nas-env` with your NAS info (this file is NOT in git, shared across all projects):

```sh
# ~/.nas-env — example
NAS_IP="192.168.x.x"
SSH_USER="username"
SSH_PORT="22"
SSH_KEY_PATH="~/.ssh/nas_ed25519"
SSH_HOST_ALIAS="nas"
NAS_WEBDAV_PORT="8889"
NAS_DATA_ROOT="/tmp/zfsv3/nvme14/<user-id>/data"
KEYCHAIN_SSH_SERVICE="nas-ssh"
KEYCHAIN_WEBDAV_SERVICE="my-webdav"
```

### 2. Set up SSH key (passwordless login)

```sh
ssh-keygen -t ed25519 -f ~/.ssh/nas_ed25519
ssh-copy-id -i ~/.ssh/nas_ed25519.pub -p "$SSH_PORT" "$SSH_USER@$NAS_IP"
```

Configure `~/.ssh/config`:

```
Host nas
    HostName 192.168.x.x
    User username
    Port 22
    IdentityFile ~/.ssh/nas_ed25519
```

Now `ssh nas` works without password.

### 3. Store passwords in macOS Keychain

```sh
security add-generic-password -s "nas-ssh" -a "$SSH_USER" -w "your SSH password"
security add-generic-password -s "my-webdav" -a "$USER" -w "your WebDAV password"
```

### 4. Create project from template

Click "Use this template" on GitHub → clone locally.

### 5. Deploy to NAS

```sh
# macOS: Keychain-based auth (auto-reads ~/.nas-env)
sh deploy/deploy.sh

# Windows: env var-based auth
.\deploy\run_deploy.bat
```

## Quick Reference

| Operation | Command |
|-----------|---------|
| SSH to NAS | `ssh nas` |
| View NAS config | `. ~/.nas-env && echo $NAS_IP` |
| Get SSH password from Keychain | `security find-generic-password -s "nas-ssh" -a "$SSH_USER" -w` |
| Get WebDAV password | `security find-generic-password -s "$KEYCHAIN_WEBDAV_SERVICE" -a "$USER" -w` |